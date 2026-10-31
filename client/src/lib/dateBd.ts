/**
 * Asia/Dhaka date helpers (UTC+06:00, no DST) with Bangla digits and the
 * revised Bangladesh calendar (Bongabdo, 2019 revision).
 */
export type DateLang = 'en' | 'bn';
export type DateInput = string | number | Date;

export const DHAKA_TZ = 'Asia/Dhaka';
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export const BONGABDO_MONTHS = [
  'বৈশাখ', 'জ্যৈষ্ঠ', 'আষাঢ়', 'শ্রাবণ', 'ভাদ্র', 'আশ্বিন',
  'কার্তিক', 'অগ্রহায়ণ', 'পৌষ', 'মাঘ', 'ফাল্গুন', 'চৈত্র'
] as const;

export interface Bongabdo {
  year: number;
  /** 0 based month index (0 = Boishakh). */
  monthIndex: number;
  monthName: string;
  day: number;
  /** e.g. "১৪ কার্তিক ১৪৩৩" */
  label: string;
}

function toDate(d: DateInput): Date | null {
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Replaces ASCII digits with Bangla digits. */
export function toBanglaDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (c) => BN_DIGITS[Number(c)]);
}

/** Intl formatting in Asia/Dhaka; Bangla uses bn-BD with Bangla digits. Returns '-' for invalid input. */
export function formatDhaka(date: DateInput, lang: DateLang = 'en', opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }): string {
  const d = toDate(date);
  if (!d) return '-';
  const locale = lang === 'bn' ? 'bn-BD' : 'en-GB';
  const out = new Intl.DateTimeFormat(locale, { ...opts, timeZone: DHAKA_TZ }).format(d);
  return lang === 'bn' ? toBanglaDigits(out) : out;
}

/** Dhaka wall-clock parts for a moment in time. */
export function dhakaParts(date: DateInput): { year: number; month: number; day: number; hour: number; minute: number } | null {
  const d = toDate(date);
  if (!d) return null;
  const shifted = new Date(d.getTime() + DHAKA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes()
  };
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Dhaka calendar day as YYYY-MM-DD. */
export function toDhakaDay(date: DateInput): string {
  const p = dhakaParts(date);
  return p ? `${p.year}-${pad(p.month)}-${pad(p.day)}` : '';
}

/** ISO instant -> value for <input type="datetime-local"> in Dhaka wall time ('' if invalid). */
export function toDhakaInputValue(iso: DateInput | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') return '';
  const p = dhakaParts(iso);
  return p ? `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}` : '';
}

/** datetime-local value (Dhaka wall time) -> ISO 8601 with +06:00 offset ('' if malformed). */
export function fromDhakaInputValue(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local.trim());
  if (!m) return '';
  const [, y, mo, d, h, mi, s] = m;
  const check = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
  if (check.getUTCMonth() !== +mo - 1 || check.getUTCDate() !== +d || +h > 23 || +mi > 59) return '';
  return `${y}-${mo}-${d}T${h}:${mi}:${s ?? '00'}+06:00`;
}

function isGregorianLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Month lengths of a Bongabdo year whose Falgun falls in Gregorian year `gYearOfFalgun`. */
function bongabdoMonthLengths(gYearOfFalgun: number): number[] {
  return [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, isGregorianLeap(gYearOfFalgun) ? 30 : 29, 30];
}

/** Revised Bangladesh calendar date for the Dhaka calendar day of `date` (1 Boishakh = 14 April). */
export function toBongabdo(date: DateInput): Bongabdo | null {
  const p = dhakaParts(date);
  if (!p) return null;
  const today = Date.UTC(p.year, p.month - 1, p.day);
  const startYear = today >= Date.UTC(p.year, 3, 14) ? p.year : p.year - 1;
  let remaining = Math.round((today - Date.UTC(startYear, 3, 14)) / 86400000);
  const lengths = bongabdoMonthLengths(startYear + 1);
  let monthIndex = 0;
  while (remaining >= lengths[monthIndex]) {
    remaining -= lengths[monthIndex];
    monthIndex += 1;
  }
  const year = startYear - 593;
  const day = remaining + 1;
  const monthName = BONGABDO_MONTHS[monthIndex];
  return { year, monthIndex, monthName, day, label: `${toBanglaDigits(day)} ${monthName} ${toBanglaDigits(year)}` };
}
