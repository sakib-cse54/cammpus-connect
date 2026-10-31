export type UserRole = 'STUDENT' | 'CLUB_EXECUTIVE' | 'FACULTY_ADVISOR' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  status: string;
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

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
  fullName: string;
  studentIdNumber?: string;
}

export interface Club {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  logo_url?: string | null;
  faculty_advisor_id: string;
  advisor_name?: string;
  advisor_email?: string;
  member_count?: number;
  active_event_count?: number;
  status: string;
}

export interface EventItem {
  id: string;
  club_id: string;
  club_name: string;
  club_slug: string;
  club_category: string;
  club_logo_url?: string | null;
  title: string;
  description: string;
  venue: string;
  start_time: string;
  end_time: string;
  capacity: number;
  registered_count: number;
  registration_deadline: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED';
  advisor_remarks?: string | null;
  requires_feedback_for_cert: boolean;
  created_by: string;
  waitlist_count?: number;
}

export interface RegistrationItem {
  id: string;
  event_id: string;
  user_id: string;
  ticket_code: string;
  status: 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED' | 'ATTENDED';
  waitlist_position?: number | null;
  created_at: string;
  event_title: string;
  start_time: string;
  end_time: string;
  venue: string;
  club_name: string;
  check_in_time?: string | null;
  certificate_serial?: string | null;
}

export interface CertificateItem {
  id: string;
  serial_number: string;
  event_id: string;
  event_title: string;
  club_name: string;
  pdf_url: string;
  sha256_hash: string;
  status: 'VALID' | 'REVOKED';
  issued_at: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  link_url?: string | null;
  is_read: boolean;
  created_at: string;
}
