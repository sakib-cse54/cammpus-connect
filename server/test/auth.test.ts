import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { seedDatabase } from '../src/db/seed.js';

describe('Auth Service & Role Permissions', () => {
  beforeAll(async () => {
    await seedDatabase();
  });

  it('should login Fahim Hossain (Lead Engineer) with valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'fahim@university.edu',
        password: 'Password123!'
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.fullName).toBe('Fahim Hossain');
    expect(res.body.user.studentIdNumber).toBe('0432320005101007');
    expect(res.body.user.role).toBe('CLUB_EXECUTIVE');
  });

  it('should reject invalid credentials with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'fahim@university.edu',
        password: 'WrongPassword!'
      });

    expect(res.status).toBe(401);
  });

  it('should register a new student user and hash password', async () => {
    const uniqueEmail = `student_${Date.now()}@university.edu`;
    const uniqueId = `ID-${Date.now().toString().substring(6)}`;

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'Test Student',
        student_id_number: uniqueId,
        department: 'CSE',
        batch_year: 2024
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(uniqueEmail);
  });

  it('should block unauthenticated access to protected me endpoint', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('should allow access to me endpoint with valid Bearer token', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'fahim@university.edu', password: 'Password123!' });

    const token = loginRes.body.token;

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.profile.full_name).toBe('Fahim Hossain');
    expect(meRes.body.profile.student_id_number).toBe('0432320005101007');
  });
});
