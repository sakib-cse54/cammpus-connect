import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { seedDatabase } from '../src/db/seed.js';

describe('Digital Certificate & Public Verification Engine', () => {
  let ayeshaToken: string;
  const testEventId = 'event-demo-cse-contest-past';
  let generatedSerial: string;

  beforeAll(async () => {
    await seedDatabase();

    // Ayesha attended the completed contest and submitted feedback in the seed
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ayesha@university.edu', password: 'Password123!' });
    ayeshaToken = loginRes.body.token;
  });

  it('should issue a digitally signed PDF certificate for eligible attendee', async () => {
    const res = await request(app)
      .post(`/api/v1/events/${testEventId}/certificates/issue`)
      .set('Authorization', `Bearer ${ayeshaToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.certificate.serial_number).toMatch(/^CC-\d{4}-[A-Z2-7]{26}$/);
    expect(res.body.certificate.sha256_hash).toBeDefined();
    expect(res.body.certificate.status).toBe('VALID');

    generatedSerial = res.body.certificate.serial_number;
  });

  it('should publicly verify the certificate without authentication credentials', async () => {
    expect(generatedSerial).toBeDefined();

    const res = await request(app).get(`/api/v1/certificates/verify/${generatedSerial}`);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.serial_number).toBe(generatedSerial);
    expect(res.body.recipient_name).toBe('Ayesha Siddiqua');
    expect(res.body.student_id_number).toBe('************1099');
    expect(res.body.student_department).toBeUndefined();
    expect(res.body.event_title).toBe('Intra-University Programming Contest');
    expect(res.body.club_name).toBe('Computer Club');
    expect(res.body.sha256_hash).toBeDefined();
  });

  it('should reject non-existent certificate serial numbers with 404', async () => {
    const res = await request(app).get('/api/v1/certificates/verify/CC-2026-NONEXIST');
    expect(res.status).toBe(404);
    expect(res.body.valid).toBe(false);
  });
});
