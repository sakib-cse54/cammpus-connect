import type { Club, EventItem, RegistrationItem, CertificateItem, NotificationItem, User, StudentProfile, AuthUser, Venue, PoTag, TranscriptData } from '../types.js';

/** Loose row for endpoints whose shape is consumed dynamically (admin tables, rosters). */
export type Row = Record<string, unknown>;

export interface LoginResponse { message?: string; token: string; user: AuthUser }
export interface RefreshResponse { token: string; user: AuthUser }
export interface MeResponse { user: User; profile: StudentProfile | null }
export interface ClubsResponse { clubs: Club[] }
export interface EventsResponse { events: EventItem[] }
export interface EventResponse { event: EventItem; userRegistration?: RegistrationItem | null }
export interface RegistrationsResponse { registrations: RegistrationItem[] }
export interface CertificatesResponse { certificates: CertificateItem[] }
export interface NotificationsResponse { unread_count: number; notifications: NotificationItem[] }
export interface MessageResponse { message?: string; status?: string }
export interface RegisterEventResponse extends MessageResponse { registration?: RegistrationItem }
export interface IssueCertificateResponse extends MessageResponse { certificate?: CertificateItem }
export interface LiveQrResponse { qr_data_url: string; token: string; short_code?: string; expires_in_seconds?: number; checkin_url?: string }
export interface MembersResponse { members: Row[] }
export interface RosterResponse { roster: Row[] }
export interface UsersResponse { users: Row[] }
export interface AdminAnalyticsResponse { metrics?: Row; recent_audit_logs?: Row[] }
export interface TranscriptResponse { transcript: TranscriptData }
export interface VenuesResponse { venues: Venue[] }
export interface OutcomesResponse { outcomes: { code: string; title_en: string; title_bn?: string; description?: string }[] }
