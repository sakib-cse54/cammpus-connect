/** Typed error thrown by the API client for every non-2xx response. */
export interface ApiIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string | null;
  public readonly issues: ApiIssue[];
  public readonly requestId: string | null;

  constructor(init: { status: number; message: string; code?: string | null; issues?: ApiIssue[]; requestId?: string | null }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code ?? null;
    this.issues = init.issues ?? [];
    this.requestId = init.requestId ?? null;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** Human readable message for any thrown value (falls back to a generic text). */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseIssues(raw: unknown): ApiIssue[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((i) => {
    if (typeof i === 'string') return { path: '', message: i };
    if (isRecord(i)) {
      return {
        path: typeof i.path === 'string' ? i.path : Array.isArray(i.path) ? i.path.join('.') : '',
        message: typeof i.message === 'string' ? i.message : ''
      };
    }
    return { path: '', message: String(i) };
  });
}

/** Builds an ApiError from a parsed JSON body (server envelope: error, code, issues, requestId). */
export function toApiError(status: number, body: unknown, headerRequestId: string | null): ApiError {
  const b = isRecord(body) ? body : {};
  let message = typeof b.error === 'string' ? b.error : typeof b.message === 'string' ? b.message : `Request failed with status ${status}`;
  if (status === 405) {
    message = 'Backend API endpoint not found (HTTP 405 Method Not Allowed). The frontend is hosted on a static server without an active backend. Please start the local backend server (npm run dev) or set VITE_API_URL to point to a live API.';
  }
  return new ApiError({
    status,
    message,
    code: typeof b.code === 'string' ? b.code : null,
    issues: parseIssues(b.issues),
    requestId: typeof b.requestId === 'string' ? b.requestId : headerRequestId
  });
}
