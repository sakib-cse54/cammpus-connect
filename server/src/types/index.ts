export type UserRole = 'STUDENT' | 'CLUB_EXECUTIVE' | 'FACULTY_ADVISOR' | 'ADMIN';

export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED';

export type ClubRole = 'MEMBER' | 'EXECUTIVE' | 'PRESIDENT' | 'TREASURER';

export type MembershipStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'TERMINATED';

export type EventStatus = 
  | 'DRAFT' 
  | 'PENDING_APPROVAL' 
  | 'APPROVED' 
  | 'REJECTED' 
  | 'PUBLISHED' 
  | 'COMPLETED' 
  | 'CANCELLED';

export type RegistrationStatus = 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED' | 'ATTENDED';

export type AttendanceMethod = 'QR_SCAN' | 'MANUAL_OVERRIDE';

export type CertificateStatus = 'PENDING' | 'VALID' | 'REVOKED';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  token_version?: number;
  created_at: string;
  updated_at: string;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  student_id_number: string;
  full_name: string;
  department: string;
  batch_year: number;
  phone_number?: string | null;
  avatar_url?: string | null;
}

export interface Club {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  logo_url?: string | null;
  faculty_advisor_id: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  created_at: string;
}

export interface ClubMembership {
  id: string;
  club_id: string;
  user_id: string;
  club_role: ClubRole;
  status: MembershipStatus;
  joined_at?: string | null;
}

export interface Event {
  id: string;
  club_id: string;
  title: string;
  description: string;
  venue: string;
  start_time: string;
  end_time: string;
  capacity: number;
  registered_count: number;
  registration_deadline: string;
  status: EventStatus;
  advisor_remarks?: string | null;
  venue_id?: string | null;
  requires_feedback_for_cert: boolean;
  created_by: string;
}

export interface Registration {
  id: string;
  event_id: string;
  user_id: string;
  ticket_code: string;
  status: RegistrationStatus;
  waitlist_position?: number | null;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  event_id: string;
  user_id: string;
  registration_id: string;
  check_in_time: string;
  method: AttendanceMethod;
  recorded_by: string;
}

export interface Certificate {
  id: string;
  serial_number: string;
  event_id: string;
  user_id: string;
  pdf_url: string;
  sha256_hash: string;
  status: CertificateStatus;
  issued_at: string;
}

export interface Announcement {
  id: string;
  club_id: string;
  author_id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  link_url?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Feedback {
  id: string;
  event_id: string;
  user_id: string;
  rating: number;
  comments?: string | null;
  is_anonymous: boolean;
  submitted_at: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: string | null;
  ip_address?: string | null;
  timestamp: string;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  fullName: string;
  studentIdNumber?: string;
}
