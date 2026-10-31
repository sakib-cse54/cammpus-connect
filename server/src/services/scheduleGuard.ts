import { db, DbClient } from '../db/index.js';
import { AuthTokenPayload } from '../types/index.js';
import { HttpError } from '../utils/http.js';
import { getClubAccess } from './clubAccess.js';
import { checkSchedule, ScheduleCheckInput, ScheduleIssue } from './scheduleService.js';
import { redactScheduleResult } from './scheduleVisibility.js';

export interface ScheduleGuardInput {
  readonly user: AuthTokenPayload;
  readonly clubId: string;
  readonly check: ScheduleCheckInput;
  readonly overrideReason?: string;
  readonly client?: DbClient;
}

export interface ScheduleGuardResult {
  readonly warnings: readonly ScheduleIssue[];
  /** Errors bypassed by an ADMIN/advisor override; empty when nothing was overridden. */
  readonly overridden: readonly ScheduleIssue[];
}

export function scheduleConflict(errors: readonly ScheduleIssue[]): HttpError {
  return new HttpError(
    409,
    'Schedule conflict: ' + errors.map((e) => e.message).join('; '),
    errors.map((e) => ({ path: e.code, message: e.message })),
    'SCHEDULE_CONFLICT'
  );
}

/**
 * Runs checkSchedule and throws 409 SCHEDULE_CONFLICT on errors, unless the
 * caller is ADMIN or the club's advisor AND passed an override reason. The
 * caller must audit-log `overridden` (outside any open transaction).
 */
export async function enforceSchedule(input: ScheduleGuardInput): Promise<ScheduleGuardResult> {
  const client = input.client ?? db;
  const result = await redactScheduleResult(await checkSchedule(input.check, client), input.user, client);
  if (result.errors.length === 0) return { warnings: result.warnings, overridden: [] };
  if (!input.overrideReason) throw scheduleConflict(result.errors);
  const access = await getClubAccess(input.user, input.clubId, client);
  if (access !== 'ADMIN' && access !== 'ADVISOR') {
    throw new HttpError(403, 'Only an admin or the club advisor may override schedule conflicts', undefined, 'OVERRIDE_FORBIDDEN');
  }
  return { warnings: result.warnings, overridden: result.errors };
}
