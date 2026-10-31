import { describe, it, expect, vi } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { HttpError, asyncHandler, validate, requestId, errorHandler } from '../src/utils/http.js';

function buildApp(): express.Express {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  const bodySchema = z.object({ name: z.string().min(2) });
  app.post('/validate', asyncHandler(async (req: Request, res: Response) => {
    const body = validate(bodySchema, req.body);
    res.json({ name: body.name });
  }));
  app.get('/forbidden', asyncHandler(async () => {
    throw new HttpError(403, 'Nope');
  }));
  app.get('/boom', asyncHandler(async () => {
    throw new Error('secret database detail');
  }));
  app.use(errorHandler);
  return app;
}

describe('http utilities', () => {
  it('validate returns parsed data on success', async () => {
    const res = await request(buildApp()).post('/validate').send({ name: 'UITS' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('UITS');
  });

  it('validate failures become 400 with error and issues', async () => {
    const res = await request(buildApp()).post('/validate').send({ name: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.issues[0].path).toBe('name');
  });

  it('HttpError maps to its status and message', async () => {
    const res = await request(buildApp()).get('/forbidden');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Nope');
  });

  it('unexpected errors become a generic 500 with a request id and no details', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await request(buildApp()).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
    expect(JSON.stringify(res.body)).not.toContain('secret');
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('malformed JSON becomes a 400, not a 500', async () => {
    const res = await request(buildApp())
      .post('/validate')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    expect(res.status).toBe(400);
  });

  it('honours a well-formed inbound X-Request-Id and replaces a bad one', async () => {
    const good = await request(buildApp()).get('/forbidden').set('X-Request-Id', 'abc12345-trace');
    expect(good.headers['x-request-id']).toBe('abc12345-trace');
    const bad = await request(buildApp()).get('/forbidden').set('X-Request-Id', '<script>');
    expect(bad.headers['x-request-id']).not.toBe('<script>');
  });
});
