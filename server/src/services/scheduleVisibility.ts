/**
 * Redacts VENUE_CONFLICT details the viewer may not see: an unpublished
 * (e.g. PENDING_APPROVAL) event of another club is reported as a booked
 * window only, without its id or title.
 */
import { db, DbClient } from '../db/index.js';
import { AuthTokenPayload } from '../types/index.js';
import { getClubAccess } from './clubAccess.js';
import { ScheduleIssue, ScheduleResult } from './scheduleRules.js';

const PUBLIC_STATUSES: readonly string[] = ['PUBLISHED', 'COMPLETED', 'CANCELLED'];

async function canSeeEvent(viewer: AuthTokenPayload, eventId: string, client: DbClient): Promise<boolean> {
  if (viewer.role === 'ADMIN') return true;
  const row = await client.queryOne<{ club_id: string; status: string }>('SELECT club_id, status FROM events WHERE id = $1', [eventId]);
  if (!row) return false;
  if (PUBLIC_STATUSES.includes(row.status)) return true;
  return (await getClubAccess(viewer, row.club_id, client)) !== null;
}

function redact(issue: ScheduleIssue): ScheduleIssue {
  const window = issue.ref ? { starts_at: issue.ref.starts_at, ends_at: issue.ref.ends_at } : undefined;
  return { code: issue.code, message: 'The venue is already booked during this time', ...(window ? { window } : {}) };
}

async function redactIssues(issues: readonly ScheduleIssue[], viewer: AuthTokenPayload, client: DbClient): Promise<ScheduleIssue[]> {
  return Promise.all(issues.map(async (i) => {
    if (i.code !== 'VENUE_CONFLICT' || !i.ref) return i;
    return (await canSeeEvent(viewer, i.ref.id, client)) ? i : redact(i);
  }));
}

export async function redactScheduleResult(result: ScheduleResult, viewer: AuthTokenPayload, client: DbClient = db): Promise<ScheduleResult> {
  const [errors, warnings] = await Promise.all([
    redactIssues(result.errors, viewer, client),
    redactIssues(result.warnings, viewer, client)
  ]);
  return { errors, warnings };
}
