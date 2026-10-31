import { db } from '../db/index.js';
import { HttpError } from '../utils/http.js';
import { isWithinWindow, loadEventWindow, recordAttendance } from './checkInService.js';

/** Scans stamped this far in the future (device clock skew) are still accepted. */
const FUTURE_SKEW_MS = 2 * 60 * 1000;

export interface BatchItem {
  readonly ticket_code: string;
  readonly scanned_at: string;
  readonly idempotency_key: string;
}

export type BatchStatus = 'CHECKED_IN' | 'DUPLICATE' | 'NOT_FOUND' | 'INELIGIBLE' | 'OUT_OF_WINDOW';

export interface BatchItemResult {
  readonly idempotency_key: string;
  readonly ticket_code: string;
  readonly status: BatchStatus;
  readonly attendance_id?: string;
  readonly message?: string;
}

interface TicketRow {
  readonly user_id: string;
  readonly status: string;
  readonly attendance_id: string | null;
}

async function processItem(eventId: string, item: BatchItem, window: Awaited<ReturnType<typeof loadEventWindow>>,
  recordedBy: string): Promise<Omit<BatchItemResult, 'idempotency_key' | 'ticket_code'>> {
  const at = Date.parse(item.scanned_at);
  if (!isWithinWindow(window, at) || at > Date.now() + FUTURE_SKEW_MS) {
    return { status: 'OUT_OF_WINDOW', message: 'scanned_at is outside the check-in window' };
  }
  const row = await db.queryOne<TicketRow>(
    `SELECT r.user_id, r.status, a.id AS attendance_id FROM registrations r
     LEFT JOIN attendance_records a ON a.registration_id = r.id
     WHERE r.event_id = $1 AND r.ticket_code = $2`, [eventId, item.ticket_code]);
  if (!row) return { status: 'NOT_FOUND', message: 'No registration with this ticket code for this event' };
  if (row.attendance_id) return { status: 'DUPLICATE', attendance_id: row.attendance_id };
  if (row.status !== 'CONFIRMED') return { status: 'INELIGIBLE', message: `A ${row.status} registration cannot check in` };
  try {
    const r = await recordAttendance(eventId, row.user_id, {
      method: 'OFFLINE_BATCH', recordedBy, checkInTime: new Date(at).toISOString()
    });
    return { status: 'CHECKED_IN', attendance_id: r.attendanceId };
  } catch (err) {
    if (err instanceof HttpError && err.status === 409) return { status: 'DUPLICATE' };
    throw err;
  }
}

/** Applies offline scans in order; replays are idempotent because attendance is unique per registration. */
export async function applyOfflineBatch(eventId: string, items: readonly BatchItem[], recordedBy: string): Promise<BatchItemResult[]> {
  const window = await loadEventWindow(eventId);
  if (window.status !== 'PUBLISHED' && window.status !== 'COMPLETED') {
    throw new HttpError(400, `Offline check-ins are only accepted for published or completed events (status: ${window.status})`);
  }
  const results: BatchItemResult[] = [];
  for (const item of items) {
    const r = await processItem(eventId, item, window, recordedBy);
    results.push({ idempotency_key: item.idempotency_key, ticket_code: item.ticket_code, ...r });
  }
  return results;
}
