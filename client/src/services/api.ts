import { toApiError } from './apiError.js';

export { ApiError, isApiError, errorMessage } from './apiError.js';
export type { ApiIssue } from './apiError.js';

const API_BASE = '/api/v1';
const TOKEN_KEY = 'campusconnect_token';
const DEVICE_KEY = 'campusconnect_device_id';
export const AUTH_EXPIRED_EVENT = 'campusconnect:auth-expired';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Internal: skip the refresh-and-replay logic (used by the refresh call itself). */
  skipRefresh?: boolean;
}

function safeSession(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r % 4) + 8).toString(16);
  });
}

/** Stable random device id (used for the optional X-Device-Id header); null when storage is blocked. */
export function getDeviceId(): string | null {
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const id = makeUuid();
    window.localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return null;
  }
}

class ApiClient {
  private token: string | null = null;
  private refreshing: Promise<boolean> | null = null;

  constructor() {
    try {
      window.localStorage.removeItem(TOKEN_KEY); // legacy v2 storage location
    } catch {
      /* storage blocked: nothing to clean */
    }
    this.token = safeSession()?.getItem(TOKEN_KEY) ?? null;
  }

  public setToken(token: string | null): void {
    this.token = token;
    const s = safeSession();
    try {
      if (token) s?.setItem(TOKEN_KEY, token);
      else s?.removeItem(TOKEN_KEY);
    } catch {
      /* in-memory token is still used */
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private buildHeaders(body: unknown, extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json', ...extra };
    if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const deviceId = getDeviceId();
    if (deviceId) headers['X-Device-Id'] = deviceId;
    return headers;
  }

  /** Single shared refresh: concurrent 401s wait on the same promise. */
  public refresh(): Promise<boolean> {
    if (!this.refreshing) {
      this.refreshing = this.request<{ token?: string }>('POST', '/auth/refresh', {}, { skipRefresh: true })
        .then((res) => {
          if (typeof res.token === 'string') this.setToken(res.token);
          return true;
        })
        .catch(() => false)
        .finally(() => {
          this.refreshing = null;
        });
    }
    return this.refreshing;
  }

  private emitExpired(): void {
    this.setToken(null);
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }

  private async send(method: Method, endpoint: string, body: unknown, opts: RequestOptions): Promise<Response> {
    return fetch(`${API_BASE}${endpoint}`, {
      method,
      credentials: 'include',
      headers: this.buildHeaders(body, opts.headers),
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      signal: opts.signal
    });
  }

  public async request<T>(method: Method, endpoint: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
    let res = await this.send(method, endpoint, body, opts);
    if (res.status === 401 && !opts.skipRefresh) {
      const parsed: unknown = await res.clone().json().catch(() => null);
      const code = typeof parsed === 'object' && parsed !== null && 'code' in parsed ? (parsed as { code: unknown }).code : null;
      if (code === 'TOKEN_EXPIRED' || (code === null && this.token)) {
        const ok = await this.refresh();
        if (ok) res = await this.send(method, endpoint, body, opts);
        else this.emitExpired();
      }
    }
    return this.parse<T>(res);
  }

  private async parse<T>(res: Response): Promise<T> {
    if (res.status === 204) return {} as T;
    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) throw toApiError(res.status, data, res.headers.get('X-Request-Id'));
    return data as T;
  }

  /** Raw authenticated fetch (for PDFs and other binary downloads); refreshes once on 401. */
  public async blob(endpoint: string): Promise<Blob> {
    let res = await this.send('GET', endpoint, undefined, { headers: { Accept: '*/*' } });
    if (res.status === 401 && (await this.refresh())) res = await this.send('GET', endpoint, undefined, {});
    if (!res.ok) {
      const data: unknown = await res.json().catch(() => ({}));
      throw toApiError(res.status, data, res.headers.get('X-Request-Id'));
    }
    return res.blob();
  }

  public get<T = unknown>(endpoint: string, opts?: RequestOptions): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, opts);
  }

  public post<T = unknown>(endpoint: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return this.request<T>('POST', endpoint, body, opts);
  }

  public patch<T = unknown>(endpoint: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', endpoint, body, opts);
  }

  public put<T = unknown>(endpoint: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', endpoint, body, opts);
  }

  public delete<T = unknown>(endpoint: string, opts?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, opts);
  }
}

export const api = new ApiClient();
