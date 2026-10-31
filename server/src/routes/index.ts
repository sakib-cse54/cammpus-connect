import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { ClubController } from '../controllers/clubController.js';
import { EventController } from '../controllers/eventController.js';
import { RegistrationController } from '../controllers/registrationController.js';
import { AttendanceController } from '../controllers/attendanceController.js';
import { CertificateController } from '../controllers/certificateController.js';
import { FeedbackController } from '../controllers/feedbackController.js';
import { AnnouncementController } from '../controllers/announcementController.js';
import { AnalyticsController } from '../controllers/analyticsController.js';
import { ScheduleController } from '../controllers/scheduleController.js';
import { OutcomeController } from '../controllers/outcomeController.js';
import { authenticateToken, requireRoles, requireClubExecutive, requireEventClubRole, optionalAuth } from '../middleware/auth.js';
import { authRateLimiter, ipRateLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler as h } from '../utils/http.js';

const router = Router();

// ==========================================
// 1. Authentication & Users
// ==========================================
router.post('/auth/register', authRateLimiter, h(AuthController.register));
router.post('/auth/login', authRateLimiter, h(AuthController.login));
router.post('/auth/refresh', ipRateLimiter(30, 60 * 1000), h(AuthController.refresh));
router.post('/auth/logout', optionalAuth, h(AuthController.logout));
router.get('/auth/me', authenticateToken, h(AuthController.me));
router.get('/auth/users', authenticateToken, requireRoles('ADMIN'), h(AuthController.getAllUsers));
router.patch('/auth/users/:id/role', authenticateToken, requireRoles('ADMIN'), h(AuthController.updateUserRole));

// ==========================================
// 2. Clubs & Memberships
// ==========================================
router.get('/clubs', h(ClubController.getClubs));
router.get('/clubs/:idOrSlug', h(ClubController.getClubByIdOrSlug));
router.post('/clubs', authenticateToken, requireRoles('ADMIN'), h(ClubController.createClub));
router.post('/clubs/:clubId/apply', authenticateToken, h(ClubController.applyForMembership));
router.get('/clubs/:clubId/members', authenticateToken, h(ClubController.getClubMembers));
router.patch('/clubs/:clubId/members/:membershipId', authenticateToken, requireClubExecutive, h(ClubController.reviewMembership));
router.get('/clubs/:clubId/events', authenticateToken, requireClubExecutive, h(ClubController.getClubEvents));
router.get('/me/clubs', authenticateToken, h(ClubController.getMyClubs));
router.get('/clubs/:clubId/analytics', authenticateToken, requireClubExecutive, h(AnalyticsController.getClubExecutiveDashboard));

// Announcements
router.get('/clubs/:clubId/announcements', h(AnnouncementController.getClubAnnouncements));
router.post('/clubs/:clubId/announcements', authenticateToken, requireClubExecutive, h(AnnouncementController.createAnnouncement));

// ==========================================
// 3. Events Lifecycle
// ==========================================
router.get('/events', h(EventController.getEvents));
router.get('/events/review/pending', authenticateToken, requireRoles('FACULTY_ADVISOR', 'ADMIN'), h(EventController.getPendingApprovalEvents));
router.get('/events/:id', optionalAuth, h(EventController.getEventById));
router.post('/events', authenticateToken, h(EventController.createDraftEvent));
router.patch('/events/:id', authenticateToken, requireEventClubRole(['ADMIN', 'EXECUTIVE']), h(EventController.updateEvent));
router.post('/events/:id/submit', authenticateToken, requireEventClubRole(['ADMIN', 'EXECUTIVE']), h(EventController.submitForApproval));
router.post('/events/:id/review', authenticateToken, requireEventClubRole(['ADMIN', 'ADVISOR']), h(EventController.reviewEvent));
router.post('/events/:id/cancel', authenticateToken, requireEventClubRole(), h(EventController.cancelEvent));
router.post('/events/:id/complete', authenticateToken, requireEventClubRole(), h(EventController.completeEvent));

// ==========================================
// 4. Registrations & Waitlist (Concurrency)
// ==========================================
router.post('/events/:eventId/register', authenticateToken, h(RegistrationController.register));
router.post('/registrations/:registrationId/cancel', authenticateToken, h(RegistrationController.cancel));
router.get('/registrations/me', authenticateToken, h(RegistrationController.getUserRegistrations));
router.get('/events/:eventId/roster', authenticateToken, requireEventClubRole(), h(RegistrationController.getEventRoster));

// ==========================================
// 5. Dynamic QR & Attendance Tracking
// ==========================================
router.get('/events/:eventId/attendance/live-qr', authenticateToken, requireEventClubRole(), h(AttendanceController.getLiveQrPass));
router.post('/events/:eventId/attendance/scan', authenticateToken, h(AttendanceController.checkInWithQr));
router.post('/events/:eventId/attendance/manual', authenticateToken, requireEventClubRole(), h(AttendanceController.manualCheckIn));
router.post('/events/:eventId/attendance/batch', authenticateToken, requireEventClubRole(), h(AttendanceController.offlineBatch));
router.get('/events/:eventId/attendance', authenticateToken, requireEventClubRole(), h(AttendanceController.getEventAttendance));

// ==========================================
// 6. Certificates & Public Verification
// ==========================================
router.post('/events/:eventId/certificates/issue', authenticateToken, h(CertificateController.issueCertificate));
router.get('/certificates/me', authenticateToken, h(CertificateController.getStudentCertificates));
router.get('/certificates/download/:serialNumber', authenticateToken, h(CertificateController.downloadCertificate));
router.post('/certificates/:serialNumber/revoke', authenticateToken, h(CertificateController.revokeCertificate));
// Public endpoint for verification (no auth, light per-IP limit)
router.get('/certificates/:serialNumber/credential', ipRateLimiter(60, 60 * 1000), h(CertificateController.getCredential));
router.post('/certificates/verify-jws', ipRateLimiter(60, 60 * 1000), h(CertificateController.verifyJws));
router.get('/.well-known/jwks.json', h(CertificateController.jwks));
router.get('/certificates/verify/:serialNumber', ipRateLimiter(60, 60 * 1000), h(CertificateController.verifyPublic));

// ==========================================
// 7. Feedback & Notifications
// ==========================================
router.post('/events/:eventId/feedback', authenticateToken, h(FeedbackController.submitFeedback));
router.get('/events/:eventId/feedback', authenticateToken, requireEventClubRole(), h(FeedbackController.getEventFeedback));
router.get('/notifications', authenticateToken, h(AnnouncementController.getUserNotifications));
router.patch('/notifications/:id/read', authenticateToken, h(AnnouncementController.markNotificationRead));

// ==========================================
// 8. Academic Calendar, Venues & Scheduling
// ==========================================
router.get('/venues', optionalAuth, h(ScheduleController.listVenues));
router.post('/venues', authenticateToken, requireRoles('ADMIN'), h(ScheduleController.createVenue));
router.patch('/venues/:id', authenticateToken, requireRoles('ADMIN'), h(ScheduleController.updateVenue));
router.get('/venues/:id/free-slots', authenticateToken, h(ScheduleController.freeSlots));
router.get('/calendar', h(ScheduleController.getCalendar));
router.post('/calendar/blackouts', authenticateToken, requireRoles('ADMIN'), h(ScheduleController.createBlackout));
router.patch('/calendar/blackouts/:id', authenticateToken, requireRoles('ADMIN'), h(ScheduleController.updateBlackout));
router.post('/schedule/check', authenticateToken, h(ScheduleController.check));

// ==========================================
// 9. OBE Outcomes (BAETE PO1-PO12), Transcript & Reports
// ==========================================
router.get('/outcomes', h(OutcomeController.listOutcomes));
router.get('/events/:id/outcomes', optionalAuth, h(OutcomeController.getEventOutcomes));
router.put('/events/:id/outcomes', authenticateToken, requireEventClubRole(), h(OutcomeController.putEventOutcomes));
router.post('/events/:id/reflection', authenticateToken, h(OutcomeController.postReflection));
router.get('/me/transcript.pdf', authenticateToken, h(OutcomeController.myTranscriptPdf));
router.get('/me/transcript', authenticateToken, h(OutcomeController.myTranscript));
router.get('/transcripts/verify/:id', ipRateLimiter(60, 60 * 1000), h(OutcomeController.verify));
router.get('/reports/po-attainment', authenticateToken, requireRoles('FACULTY_ADVISOR', 'ADMIN'), h(OutcomeController.poAttainmentReport));

// ==========================================
// 10. Institutional Analytics & Health
// ==========================================
router.get('/analytics/admin', authenticateToken, requireRoles('ADMIN'), h(AnalyticsController.getAdminDashboard));
router.get('/health', (req, res) => {
  res.json({ status: 'HEALTHY', timestamp: new Date().toISOString(), platform: 'CampusConnect API v2.0' });
});

export default router;
