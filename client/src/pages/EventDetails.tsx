import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Calendar, Clock, MapPin, Users, Award, ShieldCheck, 
  CheckCircle2, AlertTriangle, ArrowLeft, Ticket, Star, 
  Send, ExternalLink, QrCode, FileText, Download, UserCheck, Check
} from 'lucide-react';
import { api } from '../services/api.js';
import type { CertificatesResponse, EventResponse, IssueCertificateResponse, MessageResponse, RegisterEventResponse, RegistrationsResponse } from '../services/responses.js';
import { useAuth } from '../context/AuthContext.js';
import { EventItem, RegistrationItem } from '../types.js';
import { DynamicQrModal } from '../components/DynamicQrModal.js';
import { Badge } from '../components/ui/Badge.js';
import { checkInPayload } from '../lib/checkIn.js';
import { Button, buttonClasses } from '../components/ui/Button.js';
import { downloadFromApi } from '../lib/download.js';
import { Alert } from '../components/ui/Alert.js';
import { Modal } from '../components/ui/Modal.js';
import { useToast } from '../components/ui/Toast.js';
import { formatDateTime, formatDate, copyToClipboard, getClubLogoUrl } from '../lib/utils.js';

export const EventDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [userRegistration, setUserRegistration] = useState<RegistrationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Dynamic QR Modal (For Executive/Admin)
  const [showQrModal, setShowQrModal] = useState(false);

  // Student check-in via token prompt
  const [tokenInput, setTokenInput] = useState('');
  const [checkInMsg, setCheckInMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Feedback form state
  const [rating, setRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [certificateSerial, setCertificateSerial] = useState<string | null>(null);

  const fetchEventData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      const data = await api.get<EventResponse>(`/events/${id}`);
      const eventItem = data.event || data;
      setEvent(eventItem);

      if (user) {
        const [regData, certData] = await Promise.all([
          api.get<RegistrationsResponse>('/registrations/me').catch(() => ({ registrations: [] })),
          api.get<CertificatesResponse>('/certificates/me').catch(() => ({ certificates: [] }))
        ]);

        const match = regData.registrations?.find((r: RegistrationItem) => r.event_id === id);
        if (match) {
          setUserRegistration(match);
        } else if (data.userRegistration) {
          setUserRegistration(data.userRegistration);
        }

        const certMatch = certData.certificates?.find((c: any) => c.event_id === id);
        if (certMatch) {
          setCertificateSerial(certMatch.serial_number);
          setFeedbackSubmitted(true);
        } else if (match?.certificate_serial) {
          setCertificateSerial(match.certificate_serial);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventData();
  }, [id, user]);

  const handleRegister = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!event) return;

    try {
      setActionLoading(true);
      setError(null);
      const res = await api.post<RegisterEventResponse>(`/events/${event.id}/register`);
      toast.success(res.message || (res.status === 'WAITLISTED' ? 'Added to waitlist queue.' : 'Seat confirmed successfully!'));
      await fetchEventData();
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      toast.error(err.message || 'Registration failed');
    } finally {
      setActionLoading(false);
    }
  };

  const executeCancelRegistration = async () => {
    if (!userRegistration) return;
    try {
      setActionLoading(true);
      await api.post(`/registrations/${userRegistration.id}/cancel`);
      setUserRegistration(null);
      setShowCancelModal(false);
      toast.info('Seat reservation cancelled. Waitlist candidate promoted.');
      await fetchEventData();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel registration');
      toast.error(err.message || 'Failed to cancel registration');
    } finally {
      setActionLoading(false);
    }
  };

  const handleScanToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim() || !event) return;

    try {
      setActionLoading(true);
      setCheckInMsg(null);
      const res = await api.post<MessageResponse>(`/events/${event.id}/attendance/scan`, checkInPayload(tokenInput));
      setCheckInMsg({ type: 'success', text: res.message || 'Attendance verified successfully!' });
      toast.success('Attendance confirmed via rotating QR token.');
      setTokenInput('');
      await fetchEventData();
    } catch (err: any) {
      setCheckInMsg({ type: 'error', text: err.message || 'Token verification failed' });
      toast.error(err.message || 'Token verification failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    try {
      setActionLoading(true);
      await api.post(`/events/${event.id}/feedback`, {
        rating,
        comments: feedbackComment
      });
      setFeedbackSubmitted(true);
      toast.success('Session feedback recorded.');

      // Automatically generate & issue certificate for verified attendee
      try {
        const certRes = await api.post<IssueCertificateResponse>(`/events/${event.id}/certificates/issue`);
        if (certRes.certificate?.serial_number) {
          setCertificateSerial(certRes.certificate.serial_number);
          toast.success(`Digital Certificate ${certRes.certificate.serial_number} issued!`);
        }
      } catch (issueErr: any) {
        // Ineligible attendees get a 4xx with a reason; show it instead of hiding it.
        toast.warning(issueErr.message || 'Your certificate could not be issued yet.');
      }

      await fetchEventData();
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
      toast.error(err.message || 'Failed to submit feedback');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
          <p className="text-xs font-semibold text-slate-500">Loading event dossier...</p>
        </div>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 role="alert" aria-live="assertive" className="text-xl font-bold text-slate-900">Event Not Found</h2>
          <p className="text-xs text-slate-500">{error}</p>
        </div>
        <div>
          <Link to="/">
            <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Return to Events Catalog
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!event) return null;

  const isFull = event.registered_count >= event.capacity;
  const isPast = new Date(event.end_time) < new Date();
  const isExecutive = user && (user.role === 'CLUB_EXECUTIVE' || user.role === 'ADMIN');
  const percentFull = Math.min(100, Math.round((event.registered_count / event.capacity) * 100));

  const getEventBanner = () => {
    if (!event) return '/images/hero_campus_life.jpg';
    const cat = (event.club_category || '').toLowerCase();
    const title = (event.title || '').toLowerCase();
    if (cat.includes('robot') || title.includes('robot') || title.includes('hardware')) {
      return '/images/event_robotics.jpg';
    }
    if (cat.includes('cultur') || cat.includes('art') || title.includes('fest') || title.includes('music')) {
      return '/images/event_cultural_fest.jpg';
    }
    if (cat.includes('tech') || title.includes('hack') || title.includes('code') || title.includes('cyber')) {
      return '/images/event_tech_hackathon.jpg';
    }
    return '/images/hero_campus_life.jpg';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-24">
      {/* Navigation Breadcrumb */}
      <div>
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to All Events
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Event Dossier & Feedback */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-subtle overflow-hidden">
            {/* Cinematic Event Header Image Banner */}
            <div className="relative h-60 sm:h-72 w-full overflow-hidden bg-slate-950">
              <img
                src={getEventBanner()}
                alt={event.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
              <div className="absolute bottom-4 left-6 right-6 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-950/90 text-white backdrop-blur-md border border-blue-400/40 shadow-sm">
                  <img
                    src={event.club_logo_url || getClubLogoUrl(event.club_slug || event.club_name)}
                    alt=""
                    className="w-4 h-4 rounded-full object-cover shrink-0 ring-1 ring-white/50"
                  />
                  <span>{event.club_name}</span>
                </span>
                <Badge color="neutral" size="md">
                  {event.club_category}
                </Badge>
                <Badge
                  color={
                    event.status === 'PUBLISHED' ? 'success' :
                    event.status === 'COMPLETED' ? 'neutral' : 'warning'
                  }
                  size="md"
                  dot
                >
                  {event.status}
                </Badge>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight tracking-tight">
              {event.title}
            </h1>

            {/* Event Metadata Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-5 border-y border-slate-100 text-xs sm:text-sm text-slate-700">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center shrink-0 border border-blue-200/80">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-xs">Event Date</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {formatDate(event.start_time, {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center shrink-0 border border-blue-200/80">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-xs">Time Schedule</p>
                  <p className="text-xs text-slate-600 mt-0.5 font-mono">
                    {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to {new Date(event.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center shrink-0 border border-blue-200/80">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-xs">Campus Venue</p>
                  <p className="text-xs text-slate-600 mt-0.5">{event.venue}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-900 flex items-center justify-center shrink-0 border border-indigo-200/80">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-xs">Verified Certification</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {event.requires_feedback_for_cert 
                      ? 'Issued after verified attendance and feedback' 
                      : 'Issued upon attendance check-in'}
                  </p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-slate-900">Event Overview</h2>
              <div className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {event.description}
              </div>
            </div>

            {event.advisor_remarks && (
              <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 text-xs space-y-1">
                <p className="font-bold text-blue-950 text-xs">
                  Faculty Advisor Governance Note
                </p>
                <p className="text-blue-900 italic leading-relaxed">{event.advisor_remarks}</p>
              </div>
            )}
            </div>
          </div>

          {/* Attended & Feedback Section */}
          {(userRegistration?.status === 'ATTENDED' || event.status === 'COMPLETED') && user && (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-subtle space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Participant Feedback and Certificate</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Submit verified feedback to unlock your tamper-proof cryptographic certificate.
                  </p>
                </div>
                {certificateSerial && (
                  <Badge color="success" size="md" dot>
                    Certificate Ready
                  </Badge>
                )}
              </div>

              {certificateSerial ? (
                <div className="p-5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <img
                      src="/images/cert_tamperproof_seal.jpg"
                      alt="Tamper-proof Cryptographic Seal"
                      className="w-14 h-14 rounded-xl object-cover shadow-sm ring-1 ring-emerald-300 shrink-0"
                    />
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-bold text-emerald-900">Authentic Credential Issued</p>
                      <p className="text-sm font-mono font-bold text-slate-900">Serial: {certificateSerial}</p>
                      <p className="text-xs text-emerald-700">SHA-256 Digitally Signed PDF</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="success"
                      size="sm"
                      leftIcon={<Download className="w-3.5 h-3.5" />}
                      onClick={() => downloadFromApi(`/certificates/download/${certificateSerial}`, `${certificateSerial}.pdf`).catch((err: Error) => toast.error(err.message || 'Download failed'))}
                    >
                      Download PDF
                    </Button>
                    <Link
                      to={`/verify/${certificateSerial}`}
                      className={buttonClasses({ variant: 'outline', size: 'sm' })}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Verify Online</span>
                    </Link>
                  </div>
                </div>
              ) : !feedbackSubmitted ? (
                <form onSubmit={handleFeedbackSubmit} className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Session Evaluation Rating (1 to 5 Stars)
                    </label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className="p-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 transition active:scale-95"
                          aria-label={`Rate ${star} star`}
                        >
                          <Star className={`w-6 h-6 ${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                        </button>
                      ))}
                      <span className="text-xs font-bold text-slate-700 ml-2">{rating} of 5 Stars</span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="event-feedback-comments" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Constructive Session Feedback
                    </label>
                    <textarea
                      id="event-feedback-comments"
                      rows={3}
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="Share your experience regarding speakers, technical depth, organization..."
                      required
                      className="w-full p-3 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-blue-800 focus:outline-none placeholder:text-slate-400"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={actionLoading}
                    leftIcon={<Send className="w-3.5 h-3.5" />}
                  >
                    Submit Feedback and Claim Certificate
                  </Button>
                </form>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-200">
                  Feedback recorded. Your verified certificate is being rendered into the tamper-proof ledger.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Seat Reservation Card & Host Actions */}
        <div className="space-y-6">
          {/* Reservation Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-subtle space-y-5">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Seat Reservation Station</h2>

            {/* Capacity Meter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">Seat Allocation</span>
                <span className="font-mono font-bold text-slate-900">
                  {event.registered_count} / {event.capacity} ({percentFull}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${
                    percentFull >= 100 ? 'bg-amber-500' :
                    percentFull >= 80 ? 'bg-amber-500' : 'bg-emerald-600'
                  }`}
                  style={{ width: `${percentFull}%` }}
                />
              </div>
              {isFull && (
                <p className="text-xs text-amber-800 font-medium">
                  Event is at capacity. Registrations are automatically assigned to the FIFO waitlist.
                </p>
              )}
            </div>

            {/* User State */}
            {userRegistration ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500">Your Reservation</span>
                  <Badge
                    color={
                      userRegistration.status === 'CONFIRMED' ? 'success' :
                      userRegistration.status === 'WAITLISTED' ? 'warning' :
                      userRegistration.status === 'ATTENDED' ? 'primary' : 'neutral'
                    }
                    size="sm"
                  >
                    {userRegistration.status}
                  </Badge>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 font-mono text-center shadow-subtle">
                  <p className="text-[11px] text-slate-400 font-sans font-bold">Pass Identification Code</p>
                  <p className="text-base font-bold text-slate-900">{userRegistration.ticket_code}</p>
                </div>

                {userRegistration.status === 'WAITLISTED' && (
                  <p className="text-xs text-amber-800 font-medium leading-relaxed">
                    Waitlist Queue Position: <strong>#{userRegistration.waitlist_position || 1}</strong>.
                    If another attendee cancels, you will be automatically promoted with concurrency lock.
                  </p>
                )}

                {userRegistration.status === 'CONFIRMED' && (
                  <div className="space-y-3 pt-2">
                    <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                      <p className="font-bold flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-blue-800" /> Confirmed Seat Reserved
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Scan the host's rotating dynamic QR display at the venue entrance to check in.
                      </p>
                    </div>

                    {/* Quick Token Check-in Box for Student */}
                    <form onSubmit={handleScanToken} className="space-y-2 pt-2 border-t border-slate-200">
                      <label className="block text-xs font-bold text-slate-700">
                        Check-in via Dynamic Display Token
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          aria-label="Dynamic QR attendance token"
                          value={tokenInput}
                          onChange={(e) => setTokenInput(e.target.value)}
                          placeholder="e.g. 7f8a3c9b..."
                          className="flex-1 h-9 px-3.5 rounded-full border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-blue-800 focus:outline-none"
                        />
                        <Button
                          type="submit"
                          size="xs"
                          isLoading={actionLoading}
                          disabled={!tokenInput.trim()}
                        >
                          Check In
                        </Button>
                      </div>
                      {checkInMsg && (
                        <p role="status" aria-live="polite" className={`text-xs font-semibold ${checkInMsg.type === 'success' ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {checkInMsg.text}
                        </p>
                      )}
                    </form>
                  </div>
                )}

                {userRegistration.status === 'ATTENDED' && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Attendance Verified
                    </p>
                    <p className="text-xs text-emerald-800">
                      Check-in recorded at {userRegistration.check_in_time ? new Date(userRegistration.check_in_time).toLocaleTimeString() : 'Session'}.
                    </p>
                  </div>
                )}

                {userRegistration.status !== 'ATTENDED' && (
                  <Button
                    variant="danger-outline"
                    size="sm"
                    fullWidth
                    isLoading={actionLoading}
                    onClick={() => setShowCancelModal(true)}
                  >
                    Cancel Seat Reservation
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  variant={isFull ? 'secondary' : 'primary'}
                  size="md"
                  fullWidth
                  isLoading={actionLoading}
                  disabled={isPast || event.status !== 'PUBLISHED'}
                  onClick={handleRegister}
                  leftIcon={<Ticket className="w-4 h-4" />}
                >
                  {isPast ? 'Event Concluded' : isFull ? 'Join Concurrency Waitlist' : 'Register Instant Seat'}
                </Button>
                <p className="text-xs text-center text-slate-500">
                  Seats are confirmed the moment you reserve.
                </p>
              </div>
            )}
          </div>

          {/* Host Operations Station (Executive / Admin Only) */}
          {isExecutive && (
            <div className="bg-white rounded-2xl p-6 space-y-4 border border-slate-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-700" />
                <h3 className="text-base font-semibold text-slate-900">Organizer tools</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tools for club executives and faculty advisors to manage event operations.
              </p>

              <div className="space-y-2 pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={() => setShowQrModal(true)}
                  leftIcon={<QrCode className="w-4 h-4" />}
                >
                  Show check-in QR
                </Button>

                <Link
                  to={`/executive?eventId=${event.id}`}
                  className={buttonClasses({ variant: 'outline', size: 'sm', fullWidth: true })}
                >
                  <FileText className="w-4 h-4" />
                  <span>View attendee roster</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic QR Modal */}
      {showQrModal && (
        <DynamicQrModal
          eventId={event.id}
          eventTitle={event.title}
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
        />
      )}

      {/* Confirmation Modal for Seat Cancellation */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Event Reservation"
        description="Are you sure you want to release your seat? This action will automatically promote the next waitlisted student."
        size="sm"
      >
        <div className="space-y-4 pt-1 text-xs">
          <p className="text-slate-600 leading-relaxed">
            Your pass <strong className="font-mono text-slate-900">{userRegistration?.ticket_code}</strong> will be invalidated immediately in the university ledger.
          </p>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCancelModal(false)}
            >
              Keep My Seat
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={actionLoading}
              onClick={executeCancelRegistration}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
