import crypto from 'crypto';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { z, ZodTypeAny } from 'zod';

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

/** An error whose status and message are safe to expose to clients. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues?: readonly ValidationIssue[],
    public readonly code?: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wraps an async route so rejections reach the central error handler. */
export function asyncHandler(fn: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

function toIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

/** Parses data with a zod schema or throws HttpError(400) carrying the issues. */
export function validate<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new HttpError(400, 'Validation failed', toIssues(parsed.error), 'VALIDATION_ERROR');
  }
  return parsed.data as z.output<S>;
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

/** Assigns res.locals.requestId (honouring a sane inbound X-Request-Id) and echoes it. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.get('x-request-id');
  const id = inbound && REQUEST_ID_PATTERN.test(inbound) ? inbound : crypto.randomUUID();
  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

interface ErrorBody {
  error: string;
  code?: string;
  issues?: readonly ValidationIssue[];
  requestId?: string;
}

function statusOf(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const candidate = (err as { status?: unknown; statusCode?: unknown }).status
    ?? (err as { statusCode?: unknown }).statusCode;
  return typeof candidate === 'number' && candidate >= 400 && candidate < 500 ? candidate : undefined;
}

function clientErrorBody(err: unknown, status: number): ErrorBody {
  if (err instanceof HttpError) {
    return { error: err.message, code: err.code, issues: err.issues };
  }
  // body-parser and similar libraries flag client errors with expose=true
  const exposed = typeof err === 'object' && err !== null && (err as { expose?: unknown }).expose === true;
  const message = exposed && err instanceof Error ? err.message : 'Bad request';
  return { error: status === 404 ? 'Not found' : message };
}

/** Central error handler: maps HttpError to its status, hides details of 5xx errors. */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  const id = typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined;
  const status = err instanceof HttpError ? err.status : statusOf(err);
  if (status !== undefined && status < 500) {
    res.status(status).json({ ...clientErrorBody(err, status), requestId: id });
    return;
  }
  console.error(`[${id ?? 'no-request-id'}] Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  res.status(err instanceof HttpError ? err.status : 500).json({ error: 'Internal Server Error', requestId: id });
}
