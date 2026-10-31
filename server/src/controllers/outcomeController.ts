import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { env } from '../config/env.js';
import { logAudit } from '../middleware/audit.js';
import { HttpError, validate } from '../utils/http.js';
import { getClubAccess } from '../services/clubAccess.js';
import { PUBLIC_EVENT_STATUSES, EDITABLE_EVENT_STATUSES } from '../services/eventLifecycle.js';
import { LEVEL_THRESHOLDS, REFLECTION_BONUS, ROLE_MONTH_CAP } from '../services/attainmentService.js';
import {
  getEventOutcomes, hasAttended, listOutcomes, listRoleOutcomes, replaceEventOutcomes, upsertReflection
} from '../services/outcomeService.js';
import { buildTranscript, issueTranscript, verifyTranscript } from '../services/transcriptService.js';
import { renderTranscriptPdf } from '../services/transcriptPdf.js';
import { buildPoReport, poReportCsv } from '../services/poReportService.js';
import { poReportQuerySchema, putOutcomesSchema, reflectionSchema, transcriptIdSchema } from '../validation/outcomeSchemas.js';
import { EventStatus } from '../types/index.js';

interface EventRef { id: string; club_id: string; status: EventStatus }

async function loadEventRef(id: string): Promise<EventRef> {
  const e = await db.queryOne<EventRef>('SELECT id, club_id, status FROM events WHERE id = $1', [id]);
  if (!e) throw new HttpError(404, 'Event not found');
  return e;
}

const isPublic = (s: string): boolean => (PUBLIC_EVENT_STATUSES as readonly string[]).includes(s);

/** Public base URL that serves the client verify page. */
const verifyBase = (): string => env.PUBLIC_URL || env.CLIENT_URL;

export class OutcomeController {
  /** GET /outcomes: BAETE PO catalogue, role mapping and level thresholds. */
  public static async listOutcomes(_req: Request, res: Response): Promise<void> {
    res.json({
      framework: 'BAETE',
      outcomes: await listOutcomes(),
      role_outcomes: await listRoleOutcomes(),
      scoring: { level_thresholds: LEVEL_THRESHOLDS, reflection_bonus: REFLECTION_BONUS, role_month_cap: ROLE_MONTH_CAP }
    });
  }

  /** GET /events/:id/outcomes: public for public events, club managers otherwise. */
  public static async getEventOutcomes(req: Request, res: Response): Promise<void> {
    const event = await loadEventRef(String(req.params.id));
    if (!isPublic(event.status)) {
      const access = req.user ? await getClubAccess(req.user, event.club_id) : null;
      if (!access) throw new HttpError(404, 'Event not found');
    }
    res.json({ event_id: event.id, po_tags: await getEventOutcomes(event.id) });
  }

  /** PUT /events/:id/outcomes: executives on DRAFT/REJECTED; advisor or admin on any non-cancelled event. */
  public static async putEventOutcomes(req: Request, res: Response): Promise<void> {
    const { po_tags } = validate(putOutcomesSchema, req.body);
    const event = await loadEventRef(String(req.params.id));
    const access = await getClubAccess(req.user!, event.club_id);
    if (!access) throw new HttpError(403, 'Forbidden');
    if (event.status === 'CANCELLED') throw new HttpError(409, 'Cancelled events cannot be tagged');
    if (access === 'EXECUTIVE' && !EDITABLE_EVENT_STATUSES.includes(event.status)) {
      throw new HttpError(409, `Executives can only propose PO tags on DRAFT or REJECTED events (current: ${event.status})`);
    }
    await db.transaction((trx) => replaceEventOutcomes(trx, event.id, po_tags, req.user!.userId));
    await logAudit(req.user!.userId, 'EVENT_OUTCOMES_SET', 'events', event.id, { po_tags, access }, req.ip);
    res.json({ event_id: event.id, po_tags: await getEventOutcomes(event.id) });
  }

  /** POST /events/:id/reflection: attendees only; one reflection per event (re-posting updates it). */
  public static async postReflection(req: Request, res: Response): Promise<void> {
    const { text } = validate(reflectionSchema, req.body);
    const event = await loadEventRef(String(req.params.id));
    if (!(await hasAttended(event.id, req.user!.userId))) {
      throw new HttpError(403, 'Only verified attendees can write a reflection for this event');
    }
    const reflection = await upsertReflection(uuidv4(), req.user!.userId, event.id, text);
    res.status(201).json({ reflection });
  }

  /** GET /me/transcript */
  public static async myTranscript(req: Request, res: Response): Promise<void> {
    res.json({ transcript: await buildTranscript(req.user!.userId) });
  }

  /** GET /me/transcript.pdf: issues a signed snapshot and streams the PDF. */
  public static async myTranscriptPdf(req: Request, res: Response): Promise<void> {
    const transcript = await buildTranscript(req.user!.userId);
    const { id, summary, jws } = await issueTranscript(transcript);
    const pdf = await renderTranscriptPdf(transcript, summary, jws, `${verifyBase()}/transcripts/verify/${id}`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="transcript-${id}.pdf"`);
    res.setHeader('X-Transcript-Id', id);
    res.send(pdf);
  }

  /** GET /transcripts/verify/:id: public, masked. */
  public static async verify(req: Request, res: Response): Promise<void> {
    const id = validate(transcriptIdSchema, req.params.id);
    res.json(await verifyTranscript(id));
  }

  /** GET /reports/po-attainment?department&from&to&format=json|csv */
  public static async poAttainmentReport(req: Request, res: Response): Promise<void> {
    const { format, ...filters } = validate(poReportQuerySchema, req.query);
    const report = await buildPoReport(filters);
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="po-attainment.csv"');
      res.send(poReportCsv(report));
      return;
    }
    res.json(report);
  }
}
