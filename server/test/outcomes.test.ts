import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';
import { IDS } from '../src/db/demoData.js';
import { dhakaWallTime, addMinutes } from '../src/utils/time.js';
import { bearer } from './helpers.js';

const API = '/api/v1';
const PAST = 'event-demo-cse-contest-past';

const draftBody = (extra: Record<string, unknown> = {}): Record<string, unknown> => {
  const start = dhakaWallTime(new Date(), 3, 10);
  return {
    club_id: IDS.computerClub, title: 'OBE Tagging Test Event', venue: 'Room 707',
    start_time: start.toISOString(), end_time: addMinutes(start, 120).toISOString(),
    registration_deadline: addMinutes(start, -60).toISOString(), capacity: 20, ...extra
  };
};

beforeAll(async () => {
  await seedDatabase();
});

describe('PO catalogue and event tags', () => {
  it('lists the 12 BAETE POs with Bangla titles and the scoring rules', async () => {
    const res = await request(app).get(`${API}/outcomes`);
    expect(res.status).toBe(200);
    expect(res.body.outcomes.map((o: { code: string }) => o.code)).toEqual(
      ['PO1', 'PO2', 'PO3', 'PO4', 'PO5', 'PO6', 'PO7', 'PO8', 'PO9', 'PO10', 'PO11', 'PO12']);
    expect(res.body.outcomes[8]).toMatchObject({ title_en: 'Individual work and teamwork', title_bn: expect.any(String) });
    expect(res.body.role_outcomes.PRESIDENT).toMatchObject({ PO9: 3, PO11: 2 });
    expect(res.body.scoring.level_thresholds).toEqual({ DEVELOPING: 0, PROFICIENT: 3, EXEMPLARY: 6 });
  });

  it('shows seeded tags of a public event anonymously', async () => {
    const res = await request(app).get(`${API}/events/${PAST}/outcomes`);
    expect(res.status).toBe(200);
    expect(res.body.po_tags.map((t: { code: string }) => t.code)).toEqual(['PO1', 'PO2', 'PO5']);
  });

  it('hides tags of a non-public event from outsiders', async () => {
    expect((await request(app).get(`${API}/events/${IDS.techFest}/outcomes`)).status).toBe(404);
    expect((await request(app).get(`${API}/events/${IDS.techFest}/outcomes`).set(...bearer('fahim'))).status).toBe(200);
  });

  it('rejects invalid tag payloads', async () => {
    const put = (po_tags: unknown) => request(app).put(`${API}/events/${PAST}/outcomes`).set(...bearer('jobair')).send({ po_tags });
    expect((await put([{ code: 'PO13', weight: 2 }])).status).toBe(400);
    expect((await put([{ code: 'PO1', weight: 4 }])).status).toBe(400);
    expect((await put([{ code: 'PO1' }, { code: 'PO1' }])).status).toBe(400);
  });

  it('lets an executive tag only DRAFT/REJECTED events, the advisor any non-cancelled event', async () => {
    const execRes = await request(app).put(`${API}/events/${IDS.workshop}/outcomes`).set(...bearer('fahim'))
      .send({ po_tags: [{ code: 'PO5', weight: 3 }] });
    expect(execRes.status).toBe(409);
    const adv = await request(app).put(`${API}/events/${IDS.workshop}/outcomes`).set(...bearer('jobair'))
      .send({ po_tags: [{ code: 'PO5', weight: 3 }, { code: 'PO12' }] });
    expect(adv.status).toBe(200);
    expect(adv.body.po_tags).toEqual([
      expect.objectContaining({ code: 'PO5', weight: 3 }), expect.objectContaining({ code: 'PO12', weight: 2 })]);
    expect((await request(app).put(`${API}/events/${IDS.workshop}/outcomes`).set(...bearer('rahim')).send({ po_tags: [] })).status).toBe(403);
  });
});

describe('tags through the event lifecycle', () => {
  it('stores proposed tags on create and requires tags on approval', async () => {
    const created = await request(app).post(`${API}/events`).set(...bearer('fahim'))
      .send(draftBody({ po_tags: [{ code: 'PO3', weight: 3 }] }));
    expect(created.status).toBe(201);
    const id: string = created.body.eventId;
    expect((await request(app).get(`${API}/events/${id}/outcomes`).set(...bearer('fahim'))).body.po_tags).toHaveLength(1);

    const patched = await request(app).patch(`${API}/events/${id}`).set(...bearer('fahim')).send({ po_tags: [] });
    expect(patched.status).toBe(200);
    expect(patched.body.po_tags).toEqual([]);

    expect((await request(app).post(`${API}/events/${id}/submit`).set(...bearer('fahim')).send({})).status).toBe(200);
    const noTags = await request(app).post(`${API}/events/${id}/review`).set(...bearer('jobair')).send({ decision: 'APPROVED' });
    expect(noTags.status).toBe(400);
    expect(noTags.body.code).toBe('PO_TAGS_REQUIRED');
    const ok = await request(app).post(`${API}/events/${id}/review`).set(...bearer('jobair'))
      .send({ decision: 'APPROVED', po_tags: [{ code: 'PO9', weight: 1 }, { code: 'PO10', weight: 2 }] });
    expect(ok.status).toBe(200);
    const tags = await db.query<{ po_code: string }>('SELECT po_code FROM event_outcomes WHERE event_id = $1', [id]);
    expect(tags.map((t) => t.po_code).sort()).toEqual(['PO10', 'PO9']);
  });
});

describe('reflections', () => {
  it('requires attendance and 20 to 1000 characters, and upserts', async () => {
    const text = 'I learned how to plan contest strategy with my team.';
    expect((await request(app).post(`${API}/events/${PAST}/reflection`).set(...bearer('nusrat')).send({ text })).status).toBe(403);
    expect((await request(app).post(`${API}/events/${PAST}/reflection`).set(...bearer('rahim')).send({ text: 'too short' })).status).toBe(400);
    expect((await request(app).post(`${API}/events/${PAST}/reflection`).set(...bearer('rahim')).send({ text: 'x'.repeat(1001) })).status).toBe(400);
    const first = await request(app).post(`${API}/events/${PAST}/reflection`).set(...bearer('rahim')).send({ text });
    expect(first.status).toBe(201);
    const second = await request(app).post(`${API}/events/${PAST}/reflection`).set(...bearer('rahim')).send({ text: `${text} Updated.` });
    expect(second.body.reflection.id).toBe(first.body.reflection.id);
    expect(second.body.reflection.text).toMatch(/Updated\.$/);
  });
});

describe('transcript', () => {
  let transcriptId = '';

  it('returns the JSON transcript with activities, tags and attainment', async () => {
    const res = await request(app).get(`${API}/me/transcript`).set(...bearer('ayesha'));
    expect(res.status).toBe(200);
    const t = res.body.transcript;
    expect(t.student).toMatchObject({ user_id: IDS.ayesha, department: expect.any(String) });
    const acts = t.semesters.flatMap((s: { activities: unknown[] }) => s.activities);
    const contest = acts.find((a: { event_id: string }) => a.event_id === PAST);
    expect(contest).toMatchObject({ reflection: true, club_role: 'MEMBER', attended_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    const po2 = t.attainment.outcomes.find((o: { code: string }) => o.code === 'PO2');
    expect(po2).toMatchObject({ points: 4.5, level: 'PROFICIENT' });
    expect((await request(app).get(`${API}/me/transcript`)).status).toBe(401);
  });

  it('issues a signed black and white PDF snapshot', async () => {
    const res = await request(app).get(`${API}/me/transcript.pdf`).set(...bearer('ayesha'))
      .buffer(true).parse((r, cb) => { const c: Buffer[] = []; r.on('data', (d: Buffer) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect((res.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    transcriptId = String(res.headers['x-transcript-id']);
    expect(transcriptId).toMatch(/^TR-[A-Z2-7]{20}$/);
  });

  it('verifies publicly with a masked student id', async () => {
    const res = await request(app).get(`${API}/transcripts/verify/${transcriptId}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ valid: true, signature_valid: true });
    expect(res.body.transcript.sub).toMatch(/^\*+.{4}$/);
    expect(res.body.transcript).not.toHaveProperty('user_id');
    expect(res.body.transcript.attainment).toHaveLength(12);
  });

  it('detects a tampered snapshot and rejects unknown or malformed ids', async () => {
    await db.execute(`UPDATE transcripts SET summary_json = REPLACE(summary_json, '"PROFICIENT"', '"EXEMPLARY"') WHERE id = $1`, [transcriptId]);
    expect((await request(app).get(`${API}/transcripts/verify/${transcriptId}`)).body.valid).toBe(false);
    expect((await request(app).get(`${API}/transcripts/verify/TR-AAAAAAAAAAAAAAAAAAAA`)).status).toBe(404);
    expect((await request(app).get(`${API}/transcripts/verify/nope`)).status).toBe(400);
  });
});

describe('PO attainment report', () => {
  it('is restricted to advisors and admins', async () => {
    expect((await request(app).get(`${API}/reports/po-attainment`).set(...bearer('rahim'))).status).toBe(403);
    expect((await request(app).get(`${API}/reports/po-attainment`).set(...bearer('fahim'))).status).toBe(403);
  });

  it('returns a department x PO matrix of level counts', async () => {
    const res = await request(app).get(`${API}/reports/po-attainment`).set(...bearer('jobair'));
    expect(res.status).toBe(200);
    expect(res.body.levels).toEqual(['NOT_STARTED', 'DEVELOPING', 'PROFICIENT', 'EXEMPLARY']);
    for (const d of res.body.departments) {
      for (const counts of Object.values(d.outcomes) as Record<string, number>[]) {
        expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(d.students);
      }
    }
    const anyProficient = res.body.departments.some((d: { outcomes: Record<string, Record<string, number>> }) => d.outcomes.PO2.PROFICIENT > 0);
    expect(anyProficient).toBe(true);
  });

  it('filters by department and date range and validates the query', async () => {
    const future = await request(app).get(`${API}/reports/po-attainment`).set(...bearer('admin'))
      .query({ from: addMinutes(new Date(), 60 * 24 * 365).toISOString() });
    // No attendance in range: event-only POs (PO2 here) are NOT_STARTED for everyone.
    expect(future.status).toBe(200);
    expect(future.body.departments.every((d: { students: number; outcomes: Record<string, Record<string, number>> }) =>
      d.outcomes.PO2.NOT_STARTED === d.students)).toBe(true);
    expect((await request(app).get(`${API}/reports/po-attainment`).set(...bearer('admin')).query({ department: 'No Such Dept' })).body.departments).toEqual([]);
    expect((await request(app).get(`${API}/reports/po-attainment`).set(...bearer('admin')).query({ from: 'yesterday' })).status).toBe(400);
  });

  it('exports escaped CSV', async () => {
    const res = await request(app).get(`${API}/reports/po-attainment`).set(...bearer('admin')).query({ format: 'csv' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.trim().split('\r\n');
    expect(lines[0]).toBe('"department","students","po_code","not_started","developing","proficient","exemplary"');
    expect(lines.length).toBeGreaterThan(12);
  });
});
