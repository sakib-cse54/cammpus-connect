import { Request, Response } from 'express';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { CertificateService, CERT_PUBLIC_PREFIX, resolveCertificateFile } from '../services/certificateService.js';
import { getClubAccess } from '../services/clubAccess.js';
import { logAudit } from '../middleware/audit.js';
import { AuthTokenPayload, Certificate } from '../types/index.js';
import { nowIso } from '../utils/time.js';
import { dhakaDate } from '../services/scheduleRules.js';
import { getEventOutcomes } from '../services/outcomeService.js';
import { CREDENTIAL_ISSUER, CredentialPayload, getJwks, signCredential, verifyCredential } from '../services/signingService.js';
import { HttpError, validate } from '../utils/http.js';
import { env } from '../config/env.js';

interface CertEvent {
  readonly id: string;
  readonly title: string;
  readonly club_id: string;
  readonly club_name: string;
  readonly status: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly requires_feedback_for_cert: number;
}

const issueSchema = z.object({ user_id: z.string().trim().min(1).max(100).optional() });
const verifyJwsSchema = z.object({ jws: z.string().trim().min(10).max(8192) });
const revokeSchema = z.object({ reason: z.string().trim().min(3).max(1000) });

async function loadCertEvent(eventId: string): Promise<CertEvent> {
  const event = await db.queryOne<CertEvent>(
    `SELECT e.id, e.title, e.club_id, c.name as club_name, e.status, e.start_time, e.end_time, e.requires_feedback_for_cert
     FROM events e JOIN clubs c ON c.id = e.club_id WHERE e.id = $1`, [eventId]);
  if (!event) throw new HttpError(404, 'Event not found');
  return event;
}

/** body.user_id is honoured only for managers of the event's club. */
async function resolveRecipient(user: AuthTokenPayload, event: CertEvent, requested?: string): Promise<string> {
  if (!requested || requested === user.userId) return user.userId;
  return (await getClubAccess(user, event.club_id)) ? requested : user.userId;
}

async function assertEligible(event: CertEvent, userId: string): Promise<void> {
  if (event.status === 'CANCELLED') throw new HttpError(403, 'Certificates are not issued for cancelled events');
  if (event.status !== 'COMPLETED' && Date.now() < Date.parse(event.end_time)) {
    throw new HttpError(403, 'Certificates become available after the event ends');
  }
  const attendance = await db.queryOne('SELECT id FROM attendance_records WHERE event_id = $1 AND user_id = $2', [event.id, userId]);
  if (!attendance) throw new HttpError(403, 'Certificate ineligibility: Verified attendance record required');
  if (!event.requires_feedback_for_cert) return;
  const feedback = await db.queryOne('SELECT id FROM feedback WHERE event_id = $1 AND user_id = $2', [event.id, userId]);
  if (!feedback) {
    throw new HttpError(403, 'Certificate ineligibility: Post-event feedback submission is mandatory before certificate issuance');
  }
}

/** Claims the (event, user) slot first; returns false if a certificate already exists. */
async function claimCertificate(id: string, serial: string, eventId: string, userId: string): Promise<boolean> {
  const r = await db.execute(
    `INSERT INTO certificates (id, serial_number, event_id, user_id, pdf_url, sha256_hash, status, issued_at)
     VALUES ($1, $2, $3, $4, $5, '', 'PENDING', $6)
     ON CONFLICT (event_id, user_id) DO NOTHING`,
    [id, serial, eventId, userId, `${CERT_PUBLIC_PREFIX}/${serial}.pdf`, nowIso()]
  );
  return r.rowCount > 0;
}

/** A PENDING claim older than this is treated as abandoned (crash mid-render) and may be re-claimed. */
export const STALE_PENDING_MS = 10 * 60 * 1000;

/** Re-claims an abandoned PENDING row; true when this request now owns it. */
async function reclaimStale(id: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - STALE_PENDING_MS).toISOString();
  const r = await db.execute(
    `UPDATE certificates SET issued_at = $1 WHERE id = $2 AND status = 'PENDING' AND issued_at < $3`,
    [nowIso(), id, cutoff]);
  return r.rowCount > 0;
}

function pendingConflict(): HttpError {
  return new HttpError(409, 'Certificate issuance is already in progress; retry shortly', undefined, 'CERTIFICATE_PENDING');
}

async function findCertificate(eventId: string, userId: string): Promise<Certificate | undefined> {
  return (await db.queryOne<Certificate>('SELECT * FROM certificates WHERE event_id = $1 AND user_id = $2', [eventId, userId])) ?? undefined;
}

/** Owns a slot for (event, user): a fresh claim or a re-claimed stale PENDING row. */
async function acquireSlot(eventId: string, userId: string): Promise<{ id: string; serial: string } | Certificate> {
  const id = uuidv4();
  const serial = CertificateService.generateSerialNumber();
  if (await claimCertificate(id, serial, eventId, userId)) return { id, serial };
  const current = await findCertificate(eventId, userId);
  if (!current) throw pendingConflict();
  if (current.status !== 'PENDING') return current;
  if (await reclaimStale(current.id)) return { id: current.id, serial: current.serial_number };
  throw pendingConflict();
}

async function renderAndFinalize(id: string, serial: string, event: CertEvent, userId: string, hostBase: string): Promise<string> {
  const profile = await db.queryOne<{ full_name: string; student_id_number: string }>(
    'SELECT full_name, student_id_number FROM student_profiles WHERE user_id = $1', [userId]);
  try {
    const { sha256Hash } = await CertificateService.generateCertificatePdf({
      studentName: profile?.full_name || 'STUDENT ATTENDEE',
      studentIdNumber: profile?.student_id_number || 'N/A',
      eventTitle: event.title,
      clubName: event.club_name,
      issueDate: new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Dhaka' }),
      serialNumber: serial
    }, hostBase);
    const po = (await getEventOutcomes(event.id)).map((t) => t.code);
    const jws = signCredential(buildPayload(serial, event, profile, sha256Hash, nowIso(), po));
    await db.execute(`UPDATE certificates SET sha256_hash = $1, jws = $2, status = 'VALID' WHERE id = $3`, [sha256Hash, jws, id]);
    return sha256Hash;
  } catch (err) {
    // Release the claim so the attendee can retry; only the DB row is removed.
    await db.execute(`DELETE FROM certificates WHERE id = $1 AND status = 'PENDING'`, [id]);
    throw err;
  }
}

function buildPayload(serial: string, event: CertEvent,
  profile: { full_name: string; student_id_number: string } | null, sha256: string, issuedAt: string,
  po: readonly string[]): CredentialPayload {
  return {
    iss: CREDENTIAL_ISSUER,
    sub: maskStudentId(profile?.student_id_number ?? null),
    name: profile?.full_name || 'STUDENT ATTENDEE',
    event: event.title,
    club: event.club_name,
    event_date: dhakaDate(event.start_time),
    issued_at: issuedAt,
    serial,
    po,
    sha256
  };
}

function maskStudentId(id: string | null): string | null {
  if (!id) return null;
  return id.length <= 4 ? id : `${'*'.repeat(id.length - 4)}${id.slice(-4)}`;
}

export class CertificateController {
  public static async issueCertificate(req: Request, res: Response): Promise<void> {
    const body = validate(issueSchema, req.body ?? {});
    const event = await loadCertEvent(String(req.params.eventId));
    const userId = await resolveRecipient(req.user!, event, body.user_id);
    const existing = await findCertificate(event.id, userId);
    if (existing && existing.status !== 'PENDING') {
      res.json({ message: 'Certificate already issued', certificate: existing });
      return;
    }
    await assertEligible(event, userId);
    const slot = await acquireSlot(event.id, userId);
    if ('status' in slot) {
      res.json({ message: 'Certificate already issued', certificate: slot });
      return;
    }
    const { id, serial } = slot;
    const hostBase = env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const sha256Hash = await renderAndFinalize(id, serial, event, userId, hostBase);
    await logAudit(req.user!.userId, 'CERTIFICATE_ISSUED', 'certificates', id, { serialNumber: serial, eventId: event.id, recipientId: userId }, req.ip);
    res.status(201).json({
      message: 'Certificate successfully generated and cryptographically signed',
      certificate: { id, serial_number: serial, pdf_url: `${CERT_PUBLIC_PREFIX}/${serial}.pdf`, sha256_hash: sha256Hash, status: 'VALID' }
    });
  }

  public static async getStudentCertificates(req: Request, res: Response): Promise<void> {
    const certificates = await db.query(`
      SELECT cert.*, e.title as event_title, e.start_time, c.name as club_name, c.logo_url as club_logo_url
      FROM certificates cert
      JOIN events e ON cert.event_id = e.id
      JOIN clubs c ON e.club_id = c.id
      WHERE cert.user_id = $1 AND cert.status != 'PENDING'
      ORDER BY cert.issued_at DESC
    `, [req.user!.userId]);
    res.json({ certificates });
  }

  /** Owner, managers of the event's club, or ADMIN only. */
  public static async downloadCertificate(req: Request, res: Response): Promise<void> {
    const serialNumber = String(req.params.serialNumber);
    const cert = await db.queryOne<Certificate & { club_id: string }>(
      `SELECT cert.*, e.club_id FROM certificates cert JOIN events e ON e.id = cert.event_id
       WHERE cert.serial_number = $1 AND cert.status != 'PENDING'`, [serialNumber]);
    if (!cert) throw new HttpError(404, 'Certificate not found');
    const user = req.user!;
    if (cert.user_id !== user.userId && !(await getClubAccess(user, cert.club_id))) {
      throw new HttpError(403, 'Forbidden: You cannot download this certificate');
    }
    const filePath = resolveCertificateFile(cert.pdf_url);
    if (!fs.existsSync(filePath)) throw new HttpError(404, 'Certificate PDF file not found');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${cert.serial_number}.pdf"`);
    fs.createReadStream(filePath).pipe(res);
  }

  /** Public verification: masks the student id and omits the department. */
  public static async verifyPublic(req: Request, res: Response): Promise<void> {
    const serialNumber = String(req.params.serialNumber);
    const cert = await db.queryOne<Record<string, string | null>>(`
      SELECT cert.serial_number, cert.status, cert.issued_at, cert.sha256_hash, cert.revoked_at,
             e.title as event_title, c.name as club_name,
             p.full_name as recipient_name, p.student_id_number
      FROM certificates cert
      JOIN events e ON cert.event_id = e.id
      JOIN clubs c ON e.club_id = c.id
      LEFT JOIN student_profiles p ON cert.user_id = p.user_id
      WHERE cert.serial_number = $1 AND cert.status != 'PENDING'
    `, [serialNumber]);
    if (!cert) {
      res.status(404).json({ valid: false, error: 'Invalid Certificate: No credential found matching this serial number' });
      return;
    }
    res.json({
      valid: cert.status === 'VALID',
      serial_number: cert.serial_number,
      status: cert.status,
      recipient_name: cert.recipient_name,
      student_id_number: maskStudentId(cert.student_id_number),
      event_title: cert.event_title,
      club_name: cert.club_name,
      issued_at: cert.issued_at,
      revoked_at: cert.revoked_at,
      sha256_hash: cert.sha256_hash,
      verification_authority: 'CampusConnect | UITS Club Activities Platform'
    });
  }

  /** POST /certificates/:serialNumber/revoke: ADMIN or the event club's faculty advisor. */
  public static async revokeCertificate(req: Request, res: Response): Promise<void> {
    const serialNumber = String(req.params.serialNumber);
    const { reason } = validate(revokeSchema, req.body);
    const cert = await db.queryOne<{ id: string; status: string; club_id: string }>(
      `SELECT cert.id, cert.status, e.club_id FROM certificates cert JOIN events e ON e.id = cert.event_id
       WHERE cert.serial_number = $1`, [serialNumber]);
    if (!cert) throw new HttpError(404, 'Certificate not found');
    const access = await getClubAccess(req.user!, cert.club_id);
    if (access !== 'ADMIN' && access !== 'ADVISOR') {
      throw new HttpError(403, 'Only an admin or the club faculty advisor can revoke certificates');
    }
    const r = await db.execute(
      `UPDATE certificates SET status = 'REVOKED', revoked_reason = $1, revoked_at = $2, revoked_by = $3
       WHERE id = $4 AND status = 'VALID'`,
      [reason, nowIso(), req.user!.userId, cert.id]);
    if (r.rowCount === 0) throw new HttpError(409, `Certificate is not valid (status: ${cert.status})`);
    await logAudit(req.user!.userId, 'CERTIFICATE_REVOKED', 'certificates', cert.id, { serialNumber, reason }, req.ip);
    res.json({ message: 'Certificate revoked', serial_number: serialNumber, status: 'REVOKED' });
  }

  /** GET /.well-known/jwks.json: public Ed25519 verification key(s). */
  public static async jwks(_req: Request, res: Response): Promise<void> {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(getJwks());
  }

  /** GET /certificates/:serialNumber/credential: public signed credential for offline verification. */
  public static async getCredential(req: Request, res: Response): Promise<void> {
    const cert = await db.queryOne<{ jws: string | null; status: string }>(
      `SELECT jws, status FROM certificates WHERE serial_number = $1 AND status != 'PENDING'`, [String(req.params.serialNumber)]);
    if (!cert) throw new HttpError(404, 'Certificate not found');
    if (!cert.jws) throw new HttpError(404, 'No signed credential exists for this certificate (issued before signing was enabled)');
    const verified = verifyCredential(cert.jws);
    res.json({ jws: cert.jws, payload: verified.ok ? verified.payload : null, status: cert.status });
  }

  /** POST /certificates/verify-jws: signature + serial existence + revocation status. */
  public static async verifyJws(req: Request, res: Response): Promise<void> {
    const { jws } = validate(verifyJwsSchema, req.body);
    const result = verifyCredential(jws);
    if (!result.ok) {
      res.json({ valid: false, signature_valid: false, reason: result.reason });
      return;
    }
    const cert = await db.queryOne<{ status: string; revoked_at: string | null; jws: string | null }>(
      `SELECT status, revoked_at, jws FROM certificates WHERE serial_number = $1 AND status != 'PENDING'`, [result.payload.serial]);
    const base = { signature_valid: true, kid: result.kid, payload: result.payload };
    if (!cert) {
      res.json({ ...base, valid: false, reason: 'UNKNOWN_SERIAL' });
      return;
    }
    if (cert.status !== 'VALID') {
      res.json({ ...base, valid: false, reason: cert.status, revoked_at: cert.revoked_at });
      return;
    }
    const matches = cert.jws === jws;
    res.json({ ...base, valid: matches, status: cert.status, ...(matches ? {} : { reason: 'SUPERSEDED' }) });
  }
}
