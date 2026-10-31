/**
 * OBE co-curricular transcript: per-semester activity record mapped to
 * BAETE PO1 to PO12 plus an attainment summary, issued as a signed snapshot.
 */
import crypto from 'node:crypto';
import { db } from '../db/index.js';
import { HttpError } from '../utils/http.js';
import { nowIso } from '../utils/time.js';
import { dhakaDate } from './scheduleRules.js';
import { toBase32 } from './certificateService.js';
import { AttainmentResult, computeAttainment } from './attainmentService.js';
import { listRoleOutcomes, tagsByEvent, toAttainmentInput } from './outcomeService.js';
import { CREDENTIAL_ISSUER, signJson, TRANSCRIPT_CTY, verifyJson } from './signingService.js';

export interface TranscriptActivity {
  readonly event_id: string;
  readonly event_title: string;
  readonly club_id: string;
  readonly club_name: string;
  readonly club_role: string;
  readonly attended_at: string;
  readonly attended_date: string;
  readonly certificate_serial: string | null;
  readonly po_tags: readonly { code: string; weight: number }[];
  readonly reflection: boolean;
}

export interface TranscriptSemester {
  readonly semester_id: string | null;
  readonly name: string;
  readonly activities: readonly TranscriptActivity[];
}

export interface StudentProfile {
  readonly user_id: string;
  readonly full_name: string;
  readonly student_id_number: string;
  readonly department: string;
  readonly batch_year: number;
}

export interface Transcript {
  readonly framework: 'BAETE';
  readonly generated_at: string;
  readonly student: StudentProfile;
  readonly semesters: readonly TranscriptSemester[];
  readonly roles: readonly { club_id: string; club_name: string; club_role: string; joined_at: string | null }[];
  readonly attainment: AttainmentResult;
}

interface ActivityRow {
  event_id: string; event_title: string; club_id: string; club_name: string; club_role: string | null;
  check_in_time: string; certificate_serial: string | null; reflected: number;
}

interface RoleRowFull { club_id: string; club_name: string; club_role: string; joined_at: string | null }

async function loadProfile(userId: string): Promise<StudentProfile> {
  const p = await db.queryOne<StudentProfile>(
    'SELECT user_id, full_name, student_id_number, department, batch_year FROM student_profiles WHERE user_id = $1', [userId]);
  if (!p) throw new HttpError(404, 'Student profile not found');
  return p;
}

async function loadActivities(userId: string): Promise<ActivityRow[]> {
  return db.query<ActivityRow>(`
    SELECT a.event_id, e.title as event_title, e.club_id, c.name as club_name, m.club_role, a.check_in_time,
           (SELECT ce.serial_number FROM certificates ce WHERE ce.event_id = a.event_id AND ce.user_id = a.user_id AND ce.status = 'VALID') as certificate_serial,
           (SELECT COUNT(*) FROM reflections rf WHERE rf.event_id = a.event_id AND rf.user_id = a.user_id) as reflected
    FROM attendance_records a
    JOIN events e ON e.id = a.event_id
    JOIN clubs c ON c.id = e.club_id
    LEFT JOIN club_memberships m ON m.club_id = e.club_id AND m.user_id = a.user_id AND m.status = 'APPROVED'
    WHERE a.user_id = $1 AND e.status <> 'CANCELLED'
    ORDER BY a.check_in_time ASC`, [userId]);
}

async function loadRoles(userId: string): Promise<RoleRowFull[]> {
  return db.query<RoleRowFull>(`
    SELECT m.club_id, c.name as club_name, m.club_role, m.joined_at
    FROM club_memberships m JOIN clubs c ON c.id = m.club_id
    WHERE m.user_id = $1 AND m.status = 'APPROVED' ORDER BY c.name`, [userId]);
}

type SemesterRow = { id: string; name: string; start_date: string; end_date: string };

function groupBySemester(activities: readonly TranscriptActivity[], semesters: readonly SemesterRow[]): TranscriptSemester[] {
  const find = (date: string): SemesterRow | undefined => semesters.find((s) => s.start_date <= date && date <= s.end_date);
  const groups = activities.reduce((m, a) => {
    const s = find(a.attended_date);
    const key = s?.id ?? '';
    const prev = m.get(key) ?? { semester_id: s?.id ?? null, name: s?.name ?? 'Outside a recorded semester', activities: [] };
    return m.set(key, { ...prev, activities: [...prev.activities, a] });
  }, new Map<string, TranscriptSemester>());
  return [...groups.values()];
}

export async function buildTranscript(userId: string, nowMs = Date.now()): Promise<Transcript> {
  const [student, rows, roles, semesters, roleMap] = [
    await loadProfile(userId), await loadActivities(userId), await loadRoles(userId),
    await db.query<SemesterRow>('SELECT id, name, start_date, end_date FROM semesters ORDER BY start_date'),
    await listRoleOutcomes()
  ];
  const tags = await tagsByEvent(rows.map((r) => r.event_id));
  const activities = rows.map((r): TranscriptActivity => ({
    event_id: r.event_id, event_title: r.event_title, club_id: r.club_id, club_name: r.club_name,
    club_role: r.club_role ?? 'PARTICIPANT', attended_at: r.check_in_time, attended_date: dhakaDate(r.check_in_time),
    certificate_serial: r.certificate_serial,
    po_tags: Object.entries(tags.get(r.event_id) ?? {}).map(([code, weight]) => ({ code, weight })),
    reflection: Number(r.reflected) > 0
  }));
  const reflected = new Set(rows.filter((r) => Number(r.reflected) > 0).map((r) => r.event_id));
  const input = toAttainmentInput(rows.map((r) => ({ user_id: userId, event_id: r.event_id, check_in_time: r.check_in_time })),
    roles.map((r) => ({ user_id: userId, club_role: r.club_role, joined_at: r.joined_at })), reflected, tags, nowMs);
  return {
    framework: 'BAETE', generated_at: new Date(nowMs).toISOString(), student,
    semesters: groupBySemester(activities, semesters), roles, attainment: computeAttainment(input, roleMap)
  };
}

export function maskStudentId(id: string): string {
  return id.length <= 4 ? id : `${'*'.repeat(id.length - 4)}${id.slice(-4)}`;
}

export interface TranscriptSummary {
  readonly typ: 'CC-OBE-TRANSCRIPT';
  readonly iss: string;
  readonly tid: string;
  readonly sub: string;
  readonly name: string;
  readonly department: string;
  readonly framework: 'BAETE';
  readonly issued_at: string;
  readonly activity_count: number;
  readonly attainment: readonly { code: string; points: number; level: string }[];
}

/** Fixed key order so the snapshot serialises identically every time. */
export function toSummary(id: string, t: Transcript, issuedAt: string): TranscriptSummary {
  return {
    typ: 'CC-OBE-TRANSCRIPT', iss: CREDENTIAL_ISSUER, tid: id, sub: maskStudentId(t.student.student_id_number),
    name: t.student.full_name, department: t.student.department, framework: 'BAETE', issued_at: issuedAt,
    activity_count: t.semesters.reduce((n, s) => n + s.activities.length, 0),
    attainment: t.attainment.outcomes.map((o) => ({ code: o.code, points: o.points, level: o.level }))
  };
}

export function newTranscriptId(): string {
  return `TR-${toBase32(crypto.randomBytes(12))}`;
}

/** Stores a signed snapshot. Signing failure is logged and leaves jws null (unsigned snapshot). */
export async function issueTranscript(t: Transcript): Promise<{ id: string; summary: TranscriptSummary; jws: string | null }> {
  const id = newTranscriptId();
  const summary = toSummary(id, t, nowIso());
  let jws: string | null = null;
  try {
    jws = signJson({ ...summary }, TRANSCRIPT_CTY);
  } catch (err) {
    console.error('[transcript] signing failed; issuing unsigned snapshot', err);
  }
  await db.execute('INSERT INTO transcripts (id, user_id, issued_at, summary_json, jws) VALUES ($1, $2, $3, $4, $5)',
    [id, t.student.user_id, summary.issued_at, JSON.stringify(summary), jws]);
  return { id, summary, jws };
}

export interface TranscriptVerification {
  readonly valid: boolean;
  readonly signature_valid: boolean | null;
  readonly transcript: TranscriptSummary;
  readonly jws: string | null;
}

export async function verifyTranscript(id: string): Promise<TranscriptVerification> {
  const row = await db.queryOne<{ summary_json: string; jws: string | null }>(
    'SELECT summary_json, jws FROM transcripts WHERE id = $1', [id]);
  if (!row) throw new HttpError(404, 'Transcript not found');
  const transcript = JSON.parse(row.summary_json) as TranscriptSummary;
  if (!row.jws) return { valid: true, signature_valid: null, transcript, jws: null };
  const v = verifyJson(row.jws, TRANSCRIPT_CTY);
  const matches = v.ok && JSON.stringify(v.payload) === JSON.stringify(transcript);
  return { valid: matches, signature_valid: v.ok, transcript, jws: row.jws };
}
