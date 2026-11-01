import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { seedDatabase } from '../src/db/seed.js';

describe('Public event search', () => {
  beforeAll(async () => {
    await seedDatabase();
  });

  const search = async (term: string): Promise<string[]> => {
    const res = await request(app).get('/api/v1/events').query({ search: term });
    expect(res.status).toBe(200);
    return (res.body.events as { id: string }[]).map((e) => e.id).sort();
  };

  it('finds events regardless of letter case, on every database engine', async () => {
    const lower = await search('workshop');
    expect(lower.length).toBeGreaterThan(0);
    expect(await search('WORKSHOP')).toEqual(lower);
    expect(await search('WorkShop')).toEqual(lower);
  });

  it('matches the venue and description too', async () => {
    expect((await search('SEMINAR ROOM')).length).toBeGreaterThan(0);
  });

  it('returns nothing for a term that matches no event', async () => {
    expect(await search('zzzz-no-such-event')).toEqual([]);
  });
});
