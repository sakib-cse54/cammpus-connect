import { DbClient } from '../db/index.js';
import { EventStatus } from '../types/index.js';
import { HttpError } from '../utils/http.js';

/**
 * Pure event lifecycle table. APPROVED is a legacy status that no flow
 * produces any more (approval publishes directly), so it has no edges.
 */
export const EVENT_TRANSITIONS: Readonly<Record<EventStatus, readonly EventStatus[]>> = Object.freeze({
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['PUBLISHED', 'REJECTED', 'CANCELLED'],
  REJECTED: ['PENDING_APPROVAL'],
  APPROVED: [],
  PUBLISHED: ['CANCELLED', 'COMPLETED'],
  COMPLETED: [],
  CANCELLED: []
});

export const ALL_EVENT_STATUSES: readonly EventStatus[] = Object.keys(EVENT_TRANSITIONS) as EventStatus[];

/** Statuses visible on the public event listing. */
export const PUBLIC_EVENT_STATUSES = ['PUBLISHED', 'COMPLETED', 'CANCELLED'] as const;

/** Statuses in which organizers may still edit the event payload. */
export const EDITABLE_EVENT_STATUSES: readonly EventStatus[] = ['DRAFT', 'REJECTED'];

export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return (EVENT_TRANSITIONS[from] ?? []).includes(to);
}

/** Columns a transition may set alongside the status (whitelisted, never user input). */
export type TransitionColumn = 'advisor_remarks' | 'cancellation_reason';

export interface TransitionRequest {
  readonly eventId: string;
  readonly from: EventStatus;
  readonly to: EventStatus;
  readonly set?: Readonly<Partial<Record<TransitionColumn, string | null>>>;
}

/**
 * Applies a lifecycle transition with a guarded UPDATE (WHERE status = from),
 * so a concurrent change makes it affect zero rows and raise 409.
 */
export async function applyTransition(client: DbClient, req: TransitionRequest): Promise<void> {
  if (!canTransition(req.from, req.to)) {
    throw new HttpError(409, `Event cannot move from ${req.from} to ${req.to}`, undefined, 'INVALID_TRANSITION');
  }
  const extra = Object.entries(req.set ?? {}) as [TransitionColumn, string | null][];
  const assignments = extra.map(([col], i) => `, ${col} = $${i + 4}`).join('');
  const result = await client.execute(
    `UPDATE events SET status = $1${assignments} WHERE id = $2 AND status = $3`,
    [req.to, req.eventId, req.from, ...extra.map(([, v]) => v)]
  );
  if (result.rowCount === 0) {
    throw new HttpError(409, 'Event status changed concurrently; reload and retry', undefined, 'STATUS_CONFLICT');
  }
}
