/**
 * DEMO academic calendar and venues for UITS-shaped data. NOT the official
 * UITS calendar: semester, midterm and final exam windows are computed
 * relative to "now" so fixtures never expire, and admins can edit them through
 * the /calendar and /venues admin endpoints. Venue coordinates are
 * APPROXIMATE (near the Baridhara / Vatara campus area, ~23.80N, 90.43E).
 */
import { dhakaWallTime } from '../utils/time.js';
import { IDS } from './demoData.js';
import { dhakaDate } from '../services/scheduleRules.js';

export interface DemoVenue {
  readonly id: string;
  readonly name: string;
  readonly building: string;
  readonly capacity: number;
  readonly latitude: number;
  readonly longitude: number;
  readonly radius_m: number;
}

export const VENUE_IDS = {
  multipurposeHall: 'venue-demo-multipurpose-hall',
  auditorium: 'venue-demo-auditorium',
  computerLab501: 'venue-demo-computer-lab-501',
  seminarRoom: 'venue-demo-seminar-room',
  openGround: 'venue-demo-open-ground'
} as const;

export const DEMO_VENUES: readonly DemoVenue[] = [
  { id: VENUE_IDS.multipurposeHall, name: '[Demo] Multipurpose Hall', building: 'Main Academic Building', capacity: 400, latitude: 23.8013, longitude: 90.4282, radius_m: 60 },
  { id: VENUE_IDS.auditorium, name: '[Demo] Auditorium', building: 'Main Academic Building', capacity: 250, latitude: 23.8015, longitude: 90.4285, radius_m: 50 },
  { id: VENUE_IDS.computerLab501, name: '[Demo] Computer Lab 501', building: 'Main Academic Building, Level 5', capacity: 100, latitude: 23.8012, longitude: 90.4280, radius_m: 30 },
  { id: VENUE_IDS.seminarRoom, name: '[Demo] Seminar Room', building: 'Main Academic Building, Level 2', capacity: 120, latitude: 23.8014, longitude: 90.4281, radius_m: 30 },
  { id: VENUE_IDS.openGround, name: '[Demo] Open Ground', building: 'Campus Grounds', capacity: 1500, latitude: 23.8020, longitude: 90.4290, radius_m: 120 }
];

/** Demo event to venue links (the free-text venue column is rewritten to the venue name). */
export const DEMO_EVENT_VENUES: Readonly<Record<string, string>> = {
  [IDS.workshop]: VENUE_IDS.seminarRoom,
  'event-demo-english-debate': VENUE_IDS.seminarRoom,
  'event-demo-it-cyber-seminar': VENUE_IDS.computerLab501,
  'event-demo-cse-contest-past': VENUE_IDS.computerLab501,
  'event-demo-cultural-night': VENUE_IDS.openGround,
  [IDS.techFest]: VENUE_IDS.openGround
};

export interface DemoSemester {
  readonly id: string; readonly name: string; readonly start_date: string; readonly end_date: string;
}

export interface DemoBlackout {
  readonly id: string;
  readonly semester_id: string | null;
  readonly kind: 'FINAL_EXAM' | 'MIDTERM' | 'HOLIDAY' | 'NATIONAL_DAY';
  readonly title_en: string;
  readonly title_bn: string;
  readonly starts_at: string;
  readonly ends_at: string;
  readonly tentative: number;
  readonly severity: 'BLOCK' | 'WARN';
}

const DAY_MS = 86_400_000;const dhakaDay = (now: Date, offset: number): string => dhakaDate(dhakaWallTime(now, offset, 12).getTime());

function seasonName(date: Date): string {
  const month = date.getUTCMonth() + 1;
  const season = month <= 4 ? 'Spring' : month <= 8 ? 'Summer' : 'Autumn';
  return `${DEMO_SEASON_PREFIX}${season} ${date.getUTCFullYear()}`;
}

const DEMO_SEASON_PREFIX = '[Demo] ';

export function buildDemoSemesters(now: Date): DemoSemester[] {
  const current = { id: 'sem-demo-current', start: -60, end: 90 };
  const next = { id: 'sem-demo-next', start: 91, end: 240 };
  return [current, next].map((s) => ({
    id: s.id,
    name: seasonName(new Date(now.getTime() + (s.start + 30) * DAY_MS)),
    start_date: dhakaDay(now, s.start),
    end_date: dhakaDay(now, s.end)
  }));
}

function examBlock(now: Date, id: string, kind: 'MIDTERM' | 'FINAL_EXAM', days: readonly [number, number], tentative: boolean): DemoBlackout {
  const isMid = kind === 'MIDTERM';
  return {
    id, semester_id: 'sem-demo-current', kind,
    title_en: `[Demo] ${isMid ? 'Midterm' : 'Final'} Examinations`,
    title_bn: isMid ? 'মধ্যবর্তী পরীক্ষা' : 'চূড়ান্ত পরীক্ষা',
    starts_at: dhakaWallTime(now, days[0], 0).toISOString(),
    ends_at: dhakaWallTime(now, days[1] + 1, 0).toISOString(),
    tentative: tentative ? 1 : 0,
    severity: 'BLOCK'
  };
}

const NATIONAL_DAYS: readonly (readonly [string, number, number, string, string])[] = [
  ['victory-day', 12, 16, 'Victory Day', 'বিজয় দিবস'],
  ['mother-language-day', 2, 21, 'International Mother Language Day', 'আন্তর্জাতিক মাতৃভাষা দিবস'],
  ['independence-day', 3, 26, 'Independence Day', 'স্বাধীনতা দিবস'],
  ['pohela-boishakh', 4, 14, 'Pohela Boishakh (Bangla New Year)', 'পহেলা বৈশাখ']
];

/** Fixed-date national days that fall within the demo calendar window (WARN: campus closed or programmes only). */
function nationalDays(now: Date, fromDay: number, toDay: number): DemoBlackout[] {
  const from = dhakaDay(now, fromDay);
  const to = dhakaDay(now, toDay);
  const year = Number(dhakaDay(now, 0).slice(0, 4));
  return [year - 1, year, year + 1].flatMap((y) => NATIONAL_DAYS.map(([key, m, d, en, bn]) => {
    const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const start = Date.parse(`${date}T00:00:00+06:00`);
    return { date, row: {
      id: `blk-demo-${key}-${y}`, semester_id: null, kind: 'NATIONAL_DAY' as const,
      title_en: en, title_bn: bn,
      starts_at: new Date(start).toISOString(), ends_at: new Date(start + DAY_MS).toISOString(),
      tentative: 0, severity: 'WARN' as const
    } };
  })).filter((n) => n.date >= from && n.date <= to).map((n) => n.row);
}

/** Midterms in ~6 weeks, finals in ~11 weeks (tentative), plus national days in range. */
export function buildDemoBlackouts(now: Date): DemoBlackout[] {
  return [
    examBlock(now, 'blk-demo-midterm', 'MIDTERM', [40, 46], false),
    examBlock(now, 'blk-demo-final', 'FINAL_EXAM', [75, 88], true),
    ...nationalDays(now, -60, 240)
  ];
}
