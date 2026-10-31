import type { Dictionary } from '../en/index.js';
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

type Loose<D> = { [N in keyof D]: { [K in keyof D[N]]: string } };

/** Bangla dictionary: type-checked to contain every English key. */
export const bn: Loose<Dictionary> = { common, transcript, checkin, calendar, verify, executive, student, advisor, admin, events };
