/** Body for POST /events/:id/attendance/scan. The API takes exactly one of the two fields. */
export type CheckInPayload = { token: string } | { short_code: string };

/** A 6-digit entry is the projected short code; anything else is the rotating QR token. */
export function checkInPayload(input: string): CheckInPayload {
  const value = input.trim();
  return /^\d{6}$/.test(value) ? { short_code: value } : { token: value };
}
