import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { IDS } from '../src/db/demoData.js';
import { UserRole } from '../src/types/index.js';

const ROLES: Readonly<Record<string, UserRole>> = {
  fahim: 'CLUB_EXECUTIVE', jobair: 'FACULTY_ADVISOR', admin: 'ADMIN', rahim: 'STUDENT', ayesha: 'STUDENT',
  tanvir: 'CLUB_EXECUTIVE', nusrat: 'STUDENT', sadia: 'CLUB_EXECUTIVE', arif: 'FACULTY_ADVISOR', farzana: 'FACULTY_ADVISOR'
};

export type DemoName = keyof typeof ROLES & keyof typeof IDS;

/** Mints a short-lived access token for a seeded demo user (avoids slow bcrypt logins). */
export function tokenFor(name: DemoName): string {
  const userId = IDS[name];
  return jwt.sign({ userId, email: `${name}@test.local`, role: ROLES[name], fullName: name }, env.JWT_SECRET, {
    algorithm: 'HS256', expiresIn: '15m'
  });
}

export const bearer = (name: DemoName): [string, string] => ['Authorization', `Bearer ${tokenFor(name)}`];
