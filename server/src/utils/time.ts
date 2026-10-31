import { z } from 'zod';

/** Bangladesh Standard Time: UTC+06:00, no daylight saving. */
export const DHAKA_TIME_ZONE = 'Asia/Dhaka';

const MS_PER_MINUTE = 60_000;
const EXPLICIT_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;

export type TimeInput = string | Date | number;

/** Current instant as an ISO 8601 UTC string, the canonical storage format. */
export function nowIso(): string {
  return new Date().toISOString();
}

function toDate(input: TimeInput): Date {
  if (input instanceof Date) {
    return new Date(input.getTime());
  }
  if (typeof input === 'number') {
    return new Date(input);
  }
  const trimmed = input.trim();
  if (!EXPLICIT_OFFSET.test(trimmed)) {
    throw new RangeError(`Datetime must include a timezone offset (e.g. +06:00 or Z): ${input}`);
  }
  return new Date(trimmed);
}

/**
 * Normalizes a Date, epoch millis, or an ISO 8601 string carrying an explicit
 * offset into an ISO 8601 UTC string. Throws RangeError on invalid input.
 */
export function toIso(input: TimeInput): string {
  const date = toDate(input);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid datetime: ${String(input)}`);
  }
  return date.toISOString();
}

/** Returns a new Date offset by the given number of minutes (negative allowed). */
export function addMinutes(input: TimeInput, minutes: number): Date {
  const base = new Date(toIso(input));
  return new Date(base.getTime() + minutes * MS_PER_MINUTE);
}

const dhakaFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: DHAKA_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

/** Human readable Dhaka wall-clock time, e.g. "10 Nov 2026, 10:00". */
export function formatDhaka(input: TimeInput): string {
  return dhakaFormatter.format(new Date(toIso(input)));
}

/** Zod schema for client datetimes: ISO 8601 with Z or an explicit offset. */
export const isoDateTimeSchema = z.string().datetime({ offset: true });

const DHAKA_OFFSET_MINUTES = 6 * 60;

/**
 * Builds the instant for a Dhaka wall-clock time `dayOffset` calendar days
 * after `base` (in Dhaka), e.g. dhakaWallTime(now, 7, 10) = next week 10:00 BST.
 */
export function dhakaWallTime(base: Date, dayOffset: number, hour: number, minute = 0): Date {
  const shifted = new Date(base.getTime() + DHAKA_OFFSET_MINUTES * MS_PER_MINUTE);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() + dayOffset,
      hour,
      minute - DHAKA_OFFSET_MINUTES
    )
  );
}
