import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { nowIso } from '../utils/time.js';

export async function logAudit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details?: string | object,
  ipAddress?: string
): Promise<void> {
  try {
    const detailStr = typeof details === 'object' ? JSON.stringify(details) : details;
    await db.execute(
      `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details, ip_address, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [uuidv4(), actorId, action, entityType, entityId, detailStr || null, ipAddress || null, nowIso()]
    );
  } catch (err) {
    console.error('Audit logging failed:', err);
  }
}
