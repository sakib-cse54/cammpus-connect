import { db, DbClient } from '../db/index.js';
import { AuthTokenPayload } from '../types/index.js';

export const EXECUTIVE_CLUB_ROLES = ['EXECUTIVE', 'PRESIDENT', 'TREASURER'] as const;

/** How the caller is entitled to manage a club, or null when they are not. */
export type ClubAccess = 'ADMIN' | 'ADVISOR' | 'EXECUTIVE' | null;

function isExecutiveRole(role: string): boolean {
  return (EXECUTIVE_CLUB_ROLES as readonly string[]).includes(role);
}

/** Resolves the caller's management access to a club (admin, advisor, approved executive). */
export async function getClubAccess(user: AuthTokenPayload, clubId: string, client: DbClient = db): Promise<ClubAccess> {
  if (user.role === 'ADMIN') return 'ADMIN';
  const club = await client.queryOne<{ faculty_advisor_id: string }>(
    'SELECT faculty_advisor_id FROM clubs WHERE id = $1',
    [clubId]
  );
  if (club && club.faculty_advisor_id === user.userId) return 'ADVISOR';
  const membership = await client.queryOne<{ club_role: string; status: string }>(
    'SELECT club_role, status FROM club_memberships WHERE club_id = $1 AND user_id = $2',
    [clubId, user.userId]
  );
  if (membership && membership.status === 'APPROVED' && isExecutiveRole(membership.club_role)) {
    return 'EXECUTIVE';
  }
  return null;
}

/** Loads the owning club id of an event, or null when the event does not exist. */
export async function getEventClubId(eventId: string, client: DbClient = db): Promise<string | null> {
  const row = await client.queryOne<{ club_id: string }>('SELECT club_id FROM events WHERE id = $1', [eventId]);
  return row ? row.club_id : null;
}
