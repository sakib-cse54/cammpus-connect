import { describe, it, expect } from 'vitest';
import { ApiError, isApiError, errorMessage, toApiError } from './apiError.js';

describe('ApiError and toApiError parser', () => {
  it('creates ApiError instance with default properties', () => {
    const err = new ApiError({
      status: 400,
      message: 'Bad Request'
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(400);
    expect(err.message).toBe('Bad Request');
    expect(err.code).toBeNull();
    expect(err.issues).toEqual([]);
    expect(err.requestId).toBeNull();
    expect(isApiError(err)).toBe(true);
  });

  it('correctly parses object issues with path and message', () => {
    const body = {
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      issues: [
        { path: 'email', message: 'Must be a valid university email' },
        { path: ['user', 'password'], message: 'Password is too short' }
      ],
      requestId: 'req-abc-123'
    };

    const err = toApiError(422, body, null);
    expect(err.status).toBe(422);
    expect(err.message).toBe('Validation failed');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.requestId).toBe('req-abc-123');
    expect(err.issues).toHaveLength(2);
    expect(err.issues[0]).toEqual({ path: 'email', message: 'Must be a valid university email' });
    expect(err.issues[1]).toEqual({ path: 'user.password', message: 'Password is too short' });
  });

  it('normalizes string issues array into structured ApiIssue objects', () => {
    const body = {
      error: 'Registration failed',
      issues: [
        'Password must contain an uppercase letter',
        'Password must contain a special symbol'
      ]
    };

    const err = toApiError(400, body, 'req-header-xyz');
    expect(err.status).toBe(400);
    expect(err.message).toBe('Registration failed');
    expect(err.requestId).toBe('req-header-xyz');
    expect(err.issues).toEqual([
      { path: '', message: 'Password must contain an uppercase letter' },
      { path: '', message: 'Password must contain a special symbol' }
    ]);
  });

  it('handles non-record body and non-array issues gracefully', () => {
    const errFromNull = toApiError(500, null, 'req-null');
    expect(errFromNull.status).toBe(500);
    expect(errFromNull.message).toBe('Request failed with status 500');
    expect(errFromNull.issues).toEqual([]);
    expect(errFromNull.requestId).toBe('req-null');

    const errFromString = toApiError(502, 'Bad Gateway', null);
    expect(errFromString.status).toBe(502);
    expect(errFromString.message).toBe('Request failed with status 502');
    expect(errFromString.issues).toEqual([]);
  });

  it('extracts error messages reliably across various error types', () => {
    expect(errorMessage(new Error('Explicit failure'))).toBe('Explicit failure');
    expect(errorMessage('Direct string error')).toBe('Direct string error');
    expect(errorMessage(null, 'Fallback notice')).toBe('Fallback notice');
    expect(errorMessage(undefined, 'Custom fallback')).toBe('Custom fallback');
    expect(errorMessage({}, 'Default generic error')).toBe('Default generic error');
  });

  it('identifies ApiError instances with isApiError typeguard', () => {
    const apiErr = new ApiError({ status: 404, message: 'Not Found' });
    const standardErr = new Error('Generic error');
    expect(isApiError(apiErr)).toBe(true);
    expect(isApiError(standardErr)).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError({ status: 404, message: 'Fake error' })).toBe(false);
  });
});
