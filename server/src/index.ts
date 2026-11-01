import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { db } from './db/index.js';
import apiRouter from './routes/index.js';
import { requestId, errorHandler, asyncHandler } from './utils/http.js';
import { CertificateController } from './controllers/certificateController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

app.use(requestId);

app.use(helmet({
  contentSecurityPolicy: false // Allows inline rendering of certificates and QR codes
}));

const allowedOrigins = [
  env.CLIENT_URL,
  'https://cammpus-connect.vercel.app',
  'https://cc54.vercel.app',
  'https://cc-cse.vercel.app',
  'http://localhost:5173',
  'http://localhost:5000'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      /^https:\/\/cammpus-connect.*\.vercel\.app$/.test(origin) ||
      /^https:\/\/cc54.*\.vercel\.app$/.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Certificate PDFs are never served statically; use the authenticated
// GET /api/v1/certificates/download/:serialNumber route instead.

// Public certificate verification keys (also served under /api/v1).
app.get('/.well-known/jwks.json', asyncHandler(CertificateController.jwks));

// API Root
app.use('/api/v1', apiRouter);

// Serve static frontend if built
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/storage')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  // Root fallback when client is not built
  app.get('/', (req: Request, res: Response) => {
    res.json({
      message: 'Welcome to CampusConnect REST API v2.0',
      documentation: '/api/v1/health',
      team_lead: 'Md. Shakhawat Hossain (ID: 0432320005101009)',
      team_member: 'Fahim Hossain (ID: 0432320005101007)',
      course_teacher: 'Al Imtiaz'
    });
  });
}

// Central error handler: HttpError -> status/json, 5xx details are logged, never returned
app.use(errorHandler);

if (env.NODE_ENV !== 'test') {
  // Refuse to serve traffic until the schema is in place (PostgreSQL migrates asynchronously).
  db.ready()
    .then(() => {
      app.listen(env.PORT, () => {
        console.log(`CampusConnect Server running on port ${env.PORT}`);
        console.log(`API Base: http://localhost:${env.PORT}/api/v1`);
      });
    })
    .catch((err: unknown) => {
      console.error('[boot] database is not ready, exiting:', err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
