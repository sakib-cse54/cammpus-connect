import { common } from './common.js';
import { transcript } from './transcript.js';
import { checkin } from './checkin.js';
import { calendar } from './calendar.js';
import { verify } from './verify.js';
import { executive } from './executive.js';
import { student } from './student.js';
import { advisor } from './advisor.js';
import { admin } from './admin.js';
import { events } from './events.js';

/** English dictionary: one object per namespace. Add a namespace here and in ../bn/index.ts. */
export const en = { common, transcript, checkin, calendar, verify, executive, student, advisor, admin, events };
export type Dictionary = typeof en;
