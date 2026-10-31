/**
 * Department x PO attainment matrix for IQAC/department OBE evidence:
 * for each department and PO, how many students sit at each level.
 */
import { db } from '../db/index.js';
import { csvRow } from '../utils/csv.js';
import { ATTAINMENT_LEVELS, AttainmentLevel, PO_CODES, computeAttainment } from './attainmentService.js';
import { AttendedRow, RoleRow, listRoleOutcomes, tagsByEvent, toAttainmentInput } from './outcomeService.js';

export interface PoReportQuery {
  readonly department?: string;
  readonly from?: string;
  readonly to?: string;
}

export type LevelCounts = Record<AttainmentLevel, number>;

export interface DepartmentRow {
  readonly department: string;
  readonly students: number;
  readonly outcomes: Readonly<Record<string, LevelCounts>>;
}

export interface PoReport {
  readonly framework: 'BAETE';
  readonly filters: PoReportQuery;
  readonly levels: readonly AttainmentLevel[];
  readonly departments: readonly DepartmentRow[];
}

const zeroCounts = (): LevelCounts => ({ NOT_STARTED: 0, DEVELOPING: 0, PROFICIENT: 0, EXEMPLARY: 0 });

async function loadStudents(department?: string): Promise<{ user_id: string; department: string }[]> {
  return db.query(
    `SELECT p.user_id, p.department FROM student_profiles p JOIN users u ON u.id = p.user_id
     WHERE u.role IN ('STUDENT', 'CLUB_EXECUTIVE') AND u.status = 'ACTIVE' ${department ? 'AND p.department = $1' : ''}
     ORDER BY p.department`, department ? [department] : []);
}

async function loadAttendance(q: PoReportQuery): Promise<AttendedRow[]> {
  const params: string[] = [];
  const cond = (sql: string, v: string | undefined): string => (v ? (params.push(v), ` AND ${sql} $${params.length}`) : '');
  const where = cond('e.start_time >=', q.from) + cond('e.start_time <', q.to);
  return db.query<AttendedRow>(
    `SELECT a.user_id, a.event_id, a.check_in_time FROM attendance_records a JOIN events e ON e.id = a.event_id
     WHERE e.status <> 'CANCELLED'${where}`, params);
}

const groupBy = <T extends { user_id: string }>(rows: readonly T[]): Map<string, T[]> =>
  rows.reduce((m, r) => m.set(r.user_id, [...(m.get(r.user_id) ?? []), r]), new Map<string, T[]>());

export async function buildPoReport(q: PoReportQuery, nowMs = Date.now()): Promise<PoReport> {
  const students = await loadStudents(q.department);
  const attendance = groupBy(await loadAttendance(q));
  const roles = groupBy(await db.query<RoleRow>(`SELECT user_id, club_role, joined_at FROM club_memberships WHERE status = 'APPROVED'`));
  const reflections = groupBy(await db.query<{ user_id: string; event_id: string }>('SELECT user_id, event_id FROM reflections'));
  const tags = await tagsByEvent([...new Set([...attendance.values()].flat().map((a) => a.event_id))]);
  const roleMap = await listRoleOutcomes();

  const depts = new Map<string, { students: number; outcomes: Record<string, LevelCounts> }>();
  for (const s of students) {
    const reflected = new Set((reflections.get(s.user_id) ?? []).map((r) => r.event_id));
    const result = computeAttainment(toAttainmentInput(attendance.get(s.user_id) ?? [], roles.get(s.user_id) ?? [], reflected, tags, nowMs), roleMap);
    const prev = depts.get(s.department) ?? { students: 0, outcomes: Object.fromEntries(PO_CODES.map((c) => [c, zeroCounts()])) };
    const outcomes = Object.fromEntries(result.outcomes.map((o) => [o.code, { ...prev.outcomes[o.code], [o.level]: prev.outcomes[o.code][o.level] + 1 }]));
    depts.set(s.department, { students: prev.students + 1, outcomes });
  }
  return {
    framework: 'BAETE', filters: q, levels: ATTAINMENT_LEVELS,
    departments: [...depts.entries()].map(([department, d]) => ({ department, ...d }))
  };
}

export function poReportCsv(report: PoReport): string {
  const head = csvRow(['department', 'students', 'po_code', ...ATTAINMENT_LEVELS.map((l) => l.toLowerCase())]);
  const lines = report.departments.flatMap((d) =>
    PO_CODES.map((code) => csvRow([d.department, d.students, code, ...ATTAINMENT_LEVELS.map((l) => d.outcomes[code][l])])));
  return [head, ...lines].join('\r\n') + '\r\n';
}
