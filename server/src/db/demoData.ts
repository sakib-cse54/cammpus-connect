/**
 * DEMO DATA for local development and tests. Every club, event and person
 * below is fictional and labelled "[Demo]". Shapes follow UITS (University of
 * Information Technology and Sciences, Dhaka) clubs paired with departments,
 * but no official names, logos or rosters are claimed. Dates are computed
 * relative to "now" so fixtures never expire.
 */
import { addMinutes, dhakaWallTime } from '../utils/time.js';

export const DEMO_LABEL = '[Demo]';

/** Departments used for demo profiles and club pairing (verify against the official UITS list before production). */
export const UITS_DEPARTMENTS = [
  'Department of Computer Science and Engineering',
  'Department of Information Technology',
  'Department of Electrical and Electronic Engineering',
  'Department of Civil Engineering',
  'Department of Pharmacy',
  'Department of Business Administration',
  'Department of English',
  'Department of Law'
] as const;

const [CSE, IT, EEE, , , BBA, ENGLISH, LAW] = UITS_DEPARTMENTS;

export const IDS = {
  shakhawat: 'user-shakhawat-0432320005101009',
  fahim: 'user-fahim-0432320005101007',
  jobair: 'user-jobair-advisor',
  admin: 'user-campus-admin',
  rahim: 'user-student-2',
  ayesha: 'user-student-3',
  tanvir: 'user-demo-tanvir-it',
  nusrat: 'user-demo-nusrat-eee',
  sadia: 'user-demo-sadia-bba',
  arif: 'user-demo-arif-advisor',
  farzana: 'user-demo-farzana-advisor',
  computerClub: 'club-uits-computer',
  roboticsClub: 'club-robotics-society',
  culturalClub: 'club-cultural-forum',
  itClub: 'club-uits-it',
  eeeClub: 'club-uits-eee',
  businessClub: 'club-uits-business',
  englishClub: 'club-uits-english',
  lawClub: 'club-uits-law',
  workshop: 'event-ai-web-workshop',
  hackathon: 'event-robotics-hackathon',
  techFest: 'event-tech-fest-draft'
} as const;

export type PasswordKind = 'student' | 'admin';

export interface DemoUser {
  readonly id: string;
  readonly email: string;
  readonly password: PasswordKind;
  readonly role: 'STUDENT' | 'CLUB_EXECUTIVE' | 'FACULTY_ADVISOR' | 'ADMIN';
  readonly profileId: string;
  readonly studentIdNumber: string;
  readonly fullName: string;
  readonly department: string;
  readonly batchYear: number;
}

const user = (
  id: string, email: string, password: PasswordKind, role: DemoUser['role'],
  profileId: string, studentIdNumber: string, fullName: string, department: string, batchYear: number
): DemoUser => ({ id, email, password, role, profileId, studentIdNumber, fullName, department, batchYear });

/** The first five accounts (ids, emails, passwords) are relied upon by tests and the login page. */
export const DEMO_USERS: readonly DemoUser[] = [
  user(IDS.shakhawat, 'shakhawat@university.edu', 'student', 'CLUB_EXECUTIVE', 'prof-0', '0432320005101009', 'Md. Shakhawat Hossain', CSE, 2023),
  user(IDS.fahim, 'fahim@university.edu', 'student', 'CLUB_EXECUTIVE', 'prof-1', '0432320005101007', 'Fahim Hossain', CSE, 2023),
  user(IDS.jobair, 'imtiaz@university.edu', 'student', 'FACULTY_ADVISOR', 'prof-2', 'FAC-CSE-001', 'Al Imtiaz', CSE, 2018),
  user(IDS.admin, 'admin@university.edu', 'admin', 'ADMIN', 'prof-3', 'ADM-IT-001', 'System Administrator', 'Information Technology Division', 2015),
  user(IDS.rahim, 'rahim@university.edu', 'student', 'STUDENT', 'prof-4', '0432320005101088', 'Rahim Ahmed', CSE, 2023),
  user(IDS.ayesha, 'ayesha@university.edu', 'student', 'STUDENT', 'prof-5', '0432320005101099', 'Ayesha Siddiqua', CSE, 2023),
  user(IDS.tanvir, 'tanvir.demo@uits.edu.bd', 'student', 'CLUB_EXECUTIVE', 'prof-demo-6', '0432320005201014', 'Tanvir Rahman (Demo)', IT, 2023),
  user(IDS.nusrat, 'nusrat.demo@uits.edu.bd', 'student', 'STUDENT', 'prof-demo-7', '0432320005301022', 'Nusrat Jahan (Demo)', EEE, 2024),
  user(IDS.sadia, 'sadia.demo@uits.edu.bd', 'student', 'CLUB_EXECUTIVE', 'prof-demo-8', '0432320005401031', 'Sadia Islam (Demo)', BBA, 2022),
  user(IDS.arif, 'arif.demo@uits.edu.bd', 'student', 'FACULTY_ADVISOR', 'prof-demo-9', 'FAC-EEE-002', 'Arif Hasan (Demo Advisor)', EEE, 2016),
  user(IDS.farzana, 'farzana.demo@uits.edu.bd', 'student', 'FACULTY_ADVISOR', 'prof-demo-10', 'FAC-ENG-003', 'Farzana Akter (Demo Advisor)', ENGLISH, 2017)
];

export const DEMO_CATEGORIES: readonly (readonly [string, string, string])[] = [
  ['cat-tech', 'Technical & Coding', 'Workshops, hackathons, and programming bootcamps'],
  ['cat-robotics', 'Robotics & Hardware', 'IoT competitions and embedded systems projects'],
  ['cat-cultural', 'Cultural & Arts', 'Debates, music performances, and exhibitions'],
  ['cat-career', 'Career & Networking', 'Industry seminars, alumni talks, and career fairs']
];

export interface DemoClub {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly category: string;
  readonly advisorId: string;
}

const club = (id: string, name: string, slug: string, dept: string, about: string, category: string, advisorId: string): DemoClub => ({
  id, name, slug, category, advisorId,
  description: `${DEMO_LABEL} ${about} Paired department: ${dept}.`
});

export const DEMO_CLUBS: readonly DemoClub[] = [
  club(IDS.computerClub, 'Computer Club', 'computer-club', CSE, 'Fostering computing excellence, competitive programming and modern web engineering.', 'Technology & Engineering', IDS.jobair),
  club(IDS.roboticsClub, 'Robotics & AI Society', 'robotics-society', CSE, 'Autonomous robotics, microcontrollers and computer vision projects.', 'Technology & Engineering', IDS.jobair),
  club(IDS.culturalClub, 'Cultural Club', 'cultural-forum', 'Office of Student Welfare', 'Music, dance, recitation and cultural nights celebrating Bangladeshi heritage.', 'Arts & Culture', IDS.farzana),
  club(IDS.itClub, 'IT Club', 'it-club', IT, 'Networking, cybersecurity awareness and cloud skills for every student.', 'Technology & Engineering', IDS.jobair),
  club(IDS.eeeClub, 'EEE Club', 'eee-club', EEE, 'Power systems, renewable energy and embedded electronics projects.', 'Technology & Engineering', IDS.arif),
  club(IDS.businessClub, 'Business Club', 'business-club', BBA, 'Case competitions, entrepreneurship talks and industry networking.', 'Business & Entrepreneurship', IDS.arif),
  club(IDS.englishClub, 'English Club', 'english-club', ENGLISH, 'Debate, public speaking and creative writing in English.', 'Arts & Culture', IDS.farzana),
  club(IDS.lawClub, 'Law Club', 'law-club', LAW, 'Moot courts, legal aid awareness and constitutional law discussions.', 'Social & Community Welfare', IDS.farzana)
];

/** [id, clubId, userId, clubRole, status] */
export const DEMO_MEMBERSHIPS: readonly (readonly [string, string, string, string, string])[] = [
  ['mem-0', IDS.computerClub, IDS.shakhawat, 'PRESIDENT', 'APPROVED'],
  ['mem-1', IDS.computerClub, IDS.fahim, 'EXECUTIVE', 'APPROVED'],
  ['mem-2', IDS.computerClub, IDS.rahim, 'MEMBER', 'APPROVED'],
  ['mem-3', IDS.computerClub, IDS.ayesha, 'MEMBER', 'APPROVED'],
  ['mem-4', IDS.roboticsClub, IDS.fahim, 'EXECUTIVE', 'APPROVED'],
  ['mem-demo-5', IDS.itClub, IDS.tanvir, 'PRESIDENT', 'APPROVED'],
  ['mem-demo-6', IDS.eeeClub, IDS.nusrat, 'MEMBER', 'APPROVED'],
  ['mem-demo-7', IDS.businessClub, IDS.sadia, 'PRESIDENT', 'APPROVED'],
  ['mem-demo-8', IDS.englishClub, IDS.ayesha, 'MEMBER', 'PENDING'],
  ['mem-demo-9', IDS.culturalClub, IDS.rahim, 'MEMBER', 'APPROVED']
];

export interface DemoEvent {
  readonly id: string;
  readonly clubId: string;
  readonly title: string;
  readonly description: string;
  readonly venue: string;
  readonly start: string;
  readonly end: string;
  readonly deadline: string;
  readonly capacity: number;
  readonly status: string;
  readonly requiresFeedback: number;
  readonly createdBy: string;
}

type EventSpec = Omit<DemoEvent, 'start' | 'end' | 'deadline'> & {
  readonly day: number; readonly hour: number; readonly hours: number; readonly deadlineDay: number;
};

function scheduled(now: Date, spec: EventSpec): DemoEvent {
  const { day, hour, hours, deadlineDay, ...rest } = spec;
  const start = dhakaWallTime(now, day, hour);
  return {
    ...rest,
    start: start.toISOString(),
    end: addMinutes(start, hours * 60).toISOString(),
    deadline: dhakaWallTime(now, deadlineDay, 23, 59).toISOString()
  };
}

/** The workshop is "live" right now so the rotating QR check-in demo works at any time. */
function liveWorkshop(now: Date): DemoEvent {
  return {
    id: IDS.workshop, clubId: IDS.computerClub,
    title: 'Full-Stack Web & AI Engineering Workshop',
    description: `${DEMO_LABEL} Hands-on session covering React, TypeScript REST APIs, transactional registration and rotating QR attendance.`,
    venue: 'Seminar Hall, Level 2',
    start: addMinutes(now, -120).toISOString(),
    end: addMinutes(now, 240).toISOString(),
    deadline: addMinutes(now, -180).toISOString(),
    capacity: 3, status: 'PUBLISHED', requiresFeedback: 1, createdBy: IDS.fahim
  };
}

const d = (about: string): string => `${DEMO_LABEL} ${about}`;

export function buildDemoEvents(now: Date): DemoEvent[] {
  const base = { requiresFeedback: 1, status: 'PUBLISHED' } as const;
  const specs: EventSpec[] = [
    { ...base, id: IDS.hackathon, clubId: IDS.roboticsClub, title: 'Autonomous Robotics Hackathon', description: d('24-hour robotics challenge on obstacle navigation and embedded telemetry.'), venue: 'Robotics Lab, Level 4', day: 7, hour: 9, hours: 24, deadlineDay: 5, capacity: 50, createdBy: IDS.fahim },
    { ...base, id: IDS.techFest, clubId: IDS.computerClub, title: 'Annual Campus Tech Fest Proposal', description: d('Proposal for an inter-university programming contest and tech career summit.'), venue: 'Campus Main Grounds', day: 35, hour: 9, hours: 33, deadlineDay: 30, capacity: 200, status: 'PENDING_APPROVAL', createdBy: IDS.fahim },
    { ...base, id: 'event-demo-it-cyber-seminar', clubId: IDS.itClub, title: 'Cybersecurity Awareness Seminar', description: d('Phishing, password hygiene and safe mobile banking practices for students.'), venue: 'Room 501', day: 4, hour: 14, hours: 3, deadlineDay: 3, capacity: 80, requiresFeedback: 0, createdBy: IDS.tanvir },
    { ...base, id: 'event-demo-eee-solar-expo', clubId: IDS.eeeClub, title: 'Solar Microgrid Project Expo', description: d('Student teams demo rooftop solar and microgrid prototypes.'), venue: 'EEE Lab Complex', day: 10, hour: 10, hours: 5, deadlineDay: 8, capacity: 60, createdBy: IDS.arif },
    { ...base, id: 'event-demo-business-case', clubId: IDS.businessClub, title: 'Business Case Competition: Round 1', description: d('Teams of three solve a local retail growth case in 90 minutes.'), venue: 'Conference Room, Level 3', day: 12, hour: 11, hours: 4, deadlineDay: 9, capacity: 45, createdBy: IDS.sadia },
    { ...base, id: 'event-demo-english-debate', clubId: IDS.englishClub, title: 'Inter-Department English Debate', description: d('British Parliamentary style debate with faculty adjudicators.'), venue: 'Seminar Hall, Level 2', day: 6, hour: 15, hours: 3, deadlineDay: 5, capacity: 40, createdBy: IDS.farzana },
    { ...base, id: 'event-demo-law-moot', clubId: IDS.lawClub, title: 'Moot Court Practice Session', description: d('Mock appellate hearing on a constitutional rights problem.'), venue: 'Moot Court Room', day: 14, hour: 10, hours: 4, deadlineDay: 12, capacity: 30, createdBy: IDS.farzana },
    { ...base, id: 'event-demo-cultural-night', clubId: IDS.culturalClub, title: 'Autumn Cultural Night', description: d('Music, dance and recitation by student performers.'), venue: 'Open Air Stage', day: 20, hour: 17, hours: 4, deadlineDay: 18, capacity: 300, requiresFeedback: 0, createdBy: IDS.farzana },
    { ...base, id: 'event-demo-cse-contest-past', clubId: IDS.computerClub, title: 'Intra-University Programming Contest', description: d('Completed ICPC-style contest; certificates available after feedback.'), venue: 'Computer Lab 3', day: -14, hour: 10, hours: 5, deadlineDay: -16, capacity: 100, status: 'COMPLETED', createdBy: IDS.fahim }
  ];
  return [liveWorkshop(now), ...specs.map((s) => scheduled(now, s))];
}

/** [id, eventId, userId, ticketCode, status] */
export const DEMO_REGISTRATIONS: readonly (readonly [string, string, string, string, string])[] = [
  ['reg-1', IDS.workshop, IDS.rahim, 'TCK-RAHIM-01', 'ATTENDED'],
  ['reg-2', IDS.workshop, IDS.ayesha, 'TCK-AYESHA-02', 'CONFIRMED'],
  ['reg-3', IDS.hackathon, IDS.fahim, 'TCK-FAHIM-03', 'CONFIRMED'],
  ['reg-demo-4', 'event-demo-cse-contest-past', IDS.ayesha, 'TCK-DEMO-AYESHA-04', 'ATTENDED'],
  ['reg-demo-5', 'event-demo-cse-contest-past', IDS.rahim, 'TCK-DEMO-RAHIM-05', 'ATTENDED'],
  ['reg-demo-6', 'event-demo-it-cyber-seminar', IDS.nusrat, 'TCK-DEMO-NUSRAT-06', 'CONFIRMED']
];

/** [id, eventId, userId, registrationId, minutesAfterStart, recordedBy] */
export const DEMO_ATTENDANCE: readonly (readonly [string, string, string, string, number, string])[] = [
  ['att-1', IDS.workshop, IDS.rahim, 'reg-1', 5, IDS.fahim],
  ['att-demo-2', 'event-demo-cse-contest-past', IDS.ayesha, 'reg-demo-4', 3, IDS.fahim],
  ['att-demo-3', 'event-demo-cse-contest-past', IDS.rahim, 'reg-demo-5', 8, IDS.fahim]
];

/** [id, eventId, userId, rating, comments] */
export const DEMO_FEEDBACK: readonly (readonly [string, string, string, number, string])[] = [
  ['fb-1', IDS.workshop, IDS.rahim, 5, 'Excellent workshop. The concurrency and dynamic QR explanations were very clear.'],
  ['fb-demo-2', 'event-demo-cse-contest-past', IDS.ayesha, 4, 'Well organised contest, problem set was balanced.']
];

/** [id, clubId, authorId, title, content, minutesAgo] */
export const DEMO_ANNOUNCEMENTS: readonly (readonly [string, string, string, string, string, number])[] = [
  ['ann-1', IDS.computerClub, IDS.fahim, 'Welcome to CampusConnect!', 'The Computer Club is launching its new event and membership platform. (Demo announcement)', 60 * 24],
  ['ann-demo-2', IDS.itClub, IDS.tanvir, 'Seminar seats filling fast', 'Register early for the Cybersecurity Awareness Seminar. (Demo announcement)', 90]
];

/** BAETE PO tags for demo events: eventId -> [[code, weight 1..3]]. Drafts/pending events stay untagged where tests rely on it. */
export const DEMO_EVENT_OUTCOMES: Readonly<Record<string, readonly (readonly [string, number])[]>> = {
  [IDS.workshop]: [['PO5', 3], ['PO3', 2], ['PO12', 1]],
  [IDS.hackathon]: [['PO3', 3], ['PO9', 2], ['PO5', 2]],
  [IDS.techFest]: [['PO11', 2], ['PO9', 2], ['PO10', 1]],
  'event-demo-it-cyber-seminar': [['PO6', 2], ['PO8', 2], ['PO12', 1]],
  'event-demo-eee-solar-expo': [['PO7', 3], ['PO3', 2], ['PO10', 1]],
  'event-demo-business-case': [['PO11', 3], ['PO2', 2], ['PO9', 2]],
  'event-demo-english-debate': [['PO10', 3], ['PO8', 1]],
  'event-demo-law-moot': [['PO8', 3], ['PO6', 2], ['PO10', 2]],
  'event-demo-cultural-night': [['PO9', 2], ['PO6', 1]],
  'event-demo-cse-contest-past': [['PO2', 3], ['PO1', 2], ['PO5', 2]]
};

/** [id, userId, eventId, text] */
export const DEMO_REFLECTIONS: readonly (readonly [string, string, string, string])[] = [
  ['refl-demo-1', IDS.ayesha, 'event-demo-cse-contest-past', 'Breaking graph problems into smaller cases under time pressure taught me to test assumptions early.']
];
