import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Ticket, Award, Bell, CheckCircle2, Clock, Calendar, 
  MapPin, AlertCircle, Download, ExternalLink, Hash, 
  GraduationCap, RefreshCw, XCircle, Star, Send, ArrowRight, User,
  FileCheck, BookOpen, PenLine
} from 'lucide-react';
import { api } from '../services/api.js';
import type { CertificatesResponse, NotificationsResponse, RegistrationsResponse, TranscriptResponse } from '../services/responses.js';
import { useAuth } from '../context/AuthContext.js';
import { RegistrationItem, CertificateItem, NotificationItem, TranscriptData } from '../types.js';
import { Badge } from '../components/ui/Badge.js';
import { checkInPayload } from '../lib/checkIn.js';
import { Button, buttonClasses } from '../components/ui/Button.js';
import { StatCard } from '../components/ui/StatCard.js';
import { Tabs } from '../components/ui/Tabs.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { Alert } from '../components/ui/Alert.js';
import { Modal } from '../components/ui/Modal.js';
import { useToast } from '../components/ui/Toast.js';
import { formatDate, formatDateTime, formatRelativeTime } from '../lib/utils.js';

const PO_TITLES: Record<string, string> = {
  PO1: 'Engineering Knowledge',
  PO2: 'Problem Analysis',
  PO3: 'Design & Development of Solutions',
  PO4: 'Investigation',
  PO5: 'Modern Tool Usage',
  PO6: 'The Engineer and Society',
  PO7: 'Environment & Sustainability',
  PO8: 'Ethics',
  PO9: 'Individual & Team Work',
  PO10: 'Communication',
  PO11: 'Project Management & Finance',
  PO12: 'Life-Long Learning'
};

export const StudentDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<string>('tickets');
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cancellation modal state
  const [cancellingRegId, setCancellingRegId] = useState<string | null>(null);

  // Reflection modal state
  const [reflectingEvent, setReflectingEvent] = useState<{ id: string; title: string } | null>(null);
  const [reflectionText, setReflectionText] = useState('');

  // Quick check-in state
  const [checkInEventId, setCheckInEventId] = useState<string | null>(null);
  const [checkInToken, setCheckInToken] = useState('');
  const [checkInStatus, setCheckInStatus] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [regRes, certRes, notifRes, transRes] = await Promise.all([
        api.get<RegistrationsResponse>('/registrations/me'),
        api.get<CertificatesResponse>('/certificates/me'),
        api.get<NotificationsResponse>('/notifications'),
        api.get<TranscriptResponse>('/me/transcript').catch(() => ({ transcript: null }))
      ]);

      setRegistrations(regRes.registrations || []);
      setCertificates(certRes.certificates || []);
      setNotifications(notifRes.notifications || []);
      if (transRes?.transcript) {
        setTranscript(transRes.transcript);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleDownloadTranscriptPdf = async () => {
    try {
      setDownloadingPdf(true);
      const blob = await api.blob('/me/transcript.pdf');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcript-${profile?.student_id_number || 'me'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Official signed transcript downloaded successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download transcript PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleOpenReflection = (event: { id: string; title: string }) => {
    setReflectingEvent(event);
    setReflectionText('');
  };

  const handleSubmitReflection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reflectingEvent || reflectionText.trim().length < 20) {
      toast.warning('Reflection must contain at least 20 characters.');
      return;
    }

    try {
      setActionLoading(true);
      await api.post(`/events/${reflectingEvent.id}/reflection`, {
        text: reflectionText.trim()
      });
      toast.success('Reflection submitted! Bonus co-curricular points awarded.');
      setReflectingEvent(null);
      setReflectionText('');
      await fetchDashboardData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit reflection');
    } finally {
      setActionLoading(false);
    }
  };

  const getLevelBadgeColor = (level: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
    switch (level) {
      case 'EXEMPLARY': return 'success';
      case 'PROFICIENT': return 'primary';
      case 'DEVELOPING': return 'warning';
      default: return 'neutral';
    }
  };

  const executeCancelRegistration = async () => {
    if (!cancellingRegId) return;
    try {
      setActionLoading(true);
      await api.post(`/registrations/${cancellingRegId}/cancel`);
      setCancellingRegId(null);
      toast.info('Registration cancelled. Next waitlisted student promoted.');
      await fetchDashboardData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel registration');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckIn = async (eventId: string) => {
    if (!checkInToken.trim()) return;
    try {
      setActionLoading(true);
      setCheckInStatus(null);
      await api.post(`/events/${eventId}/attendance/scan`, checkInPayload(checkInToken));
      toast.success('Attendance confirmed via dynamic token!');
      setCheckInToken('');
      setCheckInEventId(null);
      await fetchDashboardData();
    } catch (err: any) {
      const msg = err.message || 'Token verification failed';
      setCheckInStatus(`Error: ${msg}`);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      // Ignore
    }
  };

  const attendedCount = registrations.filter(r => r.status === 'ATTENDED').length;
  const unreadNotifs = notifications.filter(n => !n.is_read).length;

  const dashboardTabs = [
    { id: 'tickets', label: 'My Event Passes', count: registrations.length, icon: <Ticket className="w-4 h-4" /> },
    { id: 'certificates', label: 'Verified Certificates', count: certificates.length, icon: <Award className="w-4 h-4" /> },
    { id: 'transcript', label: 'Co-Curricular Transcript (OBE)', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', count: unreadNotifs, icon: <Bell className="w-4 h-4" /> }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-24">
      {/* Student Profile Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-900 text-white font-bold text-2xl flex items-center justify-center shadow-inner border border-blue-800">
            {profile?.full_name ? profile.full_name.charAt(0) : (user?.fullName?.charAt(0) || 'S')}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {profile?.full_name || user?.fullName || 'Student Portal'}
              </h1>
              <Badge color="primary" size="sm">
                {user?.role.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1 font-mono font-semibold text-slate-700">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                {profile?.student_id_number || 'ID: Pending'}
              </span>
              <span className="flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                {profile?.department || 'General Academic'}
              </span>
              <span>Batch {profile?.batch_year || '2024'}</span>
              <span>{user?.email}</span>
            </div>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={fetchDashboardData}
          isLoading={loading}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </Button>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Reservations"
          value={registrations.length}
          subtitle="Confirmed and waitlisted passes"
          icon={<Ticket className="w-6 h-6 text-blue-900" />}
          variant="primary"
        />
        <StatCard
          title="Verified Attendance"
          value={attendedCount}
          subtitle="Completed sessions on record"
          icon={<CheckCircle2 className="w-6 h-6 text-emerald-700" />}
          variant="success"
        />
        <StatCard
          title="Earned Credentials"
          value={certificates.length}
          subtitle="Digitally signed certificates"
          icon={<Award className="w-6 h-6 text-indigo-700" />}
          variant="info"
        />
      </div>

      {/* Navigation Tabs */}
      <Tabs
        tabs={dashboardTabs}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {error && (
        <Alert variant="error" title="Dashboard Error">
          {error}
        </Alert>
      )}

      {/* Tab 1: Registrations & Passes */}
      {activeTab === 'tickets' && (
        <div className="space-y-4">
          {registrations.length === 0 ? (
            <EmptyState
              icon={<Ticket className="w-7 h-7" />}
              title="No Event Registrations Found"
              description="Explore scheduled campus events and reserve seats with guaranteed fair-access queueing."
              actionLabel="Browse Events Catalog"
              onAction={() => navigate('/')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {registrations.map((reg) => (
                <div
                  key={reg.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-subtle hover:shadow-card transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-900">
                        {reg.club_name}
                      </span>
                      <Badge
                        color={
                          reg.status === 'CONFIRMED' ? 'success' :
                          reg.status === 'WAITLISTED' ? 'warning' :
                          reg.status === 'ATTENDED' ? 'primary' : 'neutral'
                        }
                        size="sm"
                      >
                        {reg.status}
                      </Badge>
                    </div>

                    <Link to={`/events/${reg.event_id}`} className="block group">
                      <h2 className="text-base font-bold text-slate-900 group-hover:text-blue-900 transition leading-snug">
                        {reg.event_title}
                      </h2>
                    </Link>

                    <div className="space-y-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100">
                      <p className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formatDateTime(reg.start_time)}</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{reg.venue}</span>
                      </p>
                    </div>
                  </div>

                  {/* Pass identification banner */}
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-mono text-center">
                      <p className="text-[11px] font-bold text-slate-400">Digital Pass ID</p>
                      <p className="text-sm font-bold text-slate-900 tracking-wider">{reg.ticket_code}</p>
                    </div>

                    {reg.status === 'CONFIRMED' && (
                      <div>
                        {checkInEventId === reg.event_id ? (
                          <div className="space-y-2 p-3 bg-blue-50/80 border border-blue-200 rounded-xl">
                            <label htmlFor={`checkin-token-${reg.id}`} className="block text-xs font-bold text-blue-900">
                              Enter Rotating Venue Token
                            </label>
                            <div className="flex gap-2">
                              <input
                                id={`checkin-token-${reg.id}`}
                                type="text"
                                aria-label="Attendance check-in token"
                                value={checkInToken}
                                onChange={(e) => setCheckInToken(e.target.value)}
                                placeholder="Paste display token..."
                                className="flex-1 h-9 px-3.5 bg-white border border-slate-300 rounded-full text-xs font-mono focus:ring-2 focus:ring-blue-800 focus:outline-none"
                              />
                              <Button
                                size="xs"
                                isLoading={actionLoading}
                                disabled={!checkInToken.trim()}
                                onClick={() => handleCheckIn(reg.event_id)}
                              >
                                Submit
                              </Button>
                            </div>
                            {checkInStatus && (
                              <p role="status" aria-live="polite" className="text-xs font-bold text-slate-700">{checkInStatus}</p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              className="flex-1"
                              onClick={() => { setCheckInEventId(reg.event_id); setCheckInStatus(null); }}
                            >
                              Check In with Token
                            </Button>
                            <Button
                              variant="danger-outline"
                              size="sm"
                              
                              isLoading={actionLoading}
                              onClick={() => setCancellingRegId(reg.id)}
                            >
                              Cancel Pass
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {reg.status === 'WAITLISTED' && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-amber-800 font-semibold">Queue Position: #{reg.waitlist_position || 1}</span>
                        <button
                          onClick={() => setCancellingRegId(reg.id)}
                          disabled={actionLoading}
                          className="text-rose-700 hover:underline font-bold text-xs"
                        >
                          Leave Waitlist
                        </button>
                      </div>
                    )}

                    {reg.status === 'ATTENDED' && (
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Attendance Confirmed
                        </span>
                        <Link
                          to={`/events/${reg.event_id}`}
                          className="text-xs font-bold text-blue-900 hover:underline inline-flex items-center gap-1"
                        >
                          <span>Feedback & Certificate</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Earned Certificates */}
      {activeTab === 'certificates' && (
        <div className="space-y-4">
          {certificates.length === 0 ? (
            <EmptyState
              icon={<Award className="w-7 h-7" />}
              title="No Certificates Issued Yet"
              description="Attend verified university events and submit mandatory post-event feedback to earn cryptographically signed credentials."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="bg-white rounded-xl border border-slate-200 p-6 shadow-subtle hover:shadow-card transition-all space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-blue-900">
                        {cert.club_name}
                      </span>
                      <h2 className="text-base font-bold text-slate-900 mt-0.5 leading-snug">
                        {cert.event_title}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Issued on {formatDate(cert.issued_at, { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <Badge color="success" size="sm" dot>
                      {cert.status}
                    </Badge>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1 font-mono text-xs">
                    <p className="text-[11px] font-bold text-slate-400 font-sans">Official Serial Number</p>
                    <p className="text-xs font-bold text-slate-900">{cert.serial_number}</p>
                    <p className="text-[11px] text-slate-500 truncate pt-1">
                      SHA-256: {cert.sha256_hash}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <a
                      href={`/api/v1/certificates/download/${cert.serial_number}`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonClasses({ variant: 'primary', size: 'sm', className: 'flex-1' })}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </a>
                    <Link
                      to={`/verify/${cert.serial_number}`}
                      className={buttonClasses({ variant: 'outline', size: 'sm' })}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Verify Online</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: System Notifications */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 shadow-subtle overflow-hidden">
          {notifications.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No notifications on record.
            </div>
          ) : (
            notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition ${
                  notif.is_read ? 'bg-white' : 'bg-blue-50/40'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900">{notif.title}</h2>
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-800 inline-block animate-pulse" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>
                  <p className="text-xs text-slate-400">
                    {formatRelativeTime(notif.created_at)}
                  </p>
                </div>

                {!notif.is_read && (
                  <button
                    onClick={() => handleMarkNotificationRead(notif.id)}
                    className="text-xs font-bold text-blue-900 hover:underline shrink-0"
                  >
                    Mark as Read
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 4: Co-Curricular Transcript (OBE) */}
      {activeTab === 'transcript' && (
        <div className="space-y-6">
          {!transcript ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-xs">
              Loading co-curricular transcript records...
            </div>
          ) : (
            <>
              {/* Transcript Overview & Action Header */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-6 h-6 text-blue-900" />
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                      BAETE Co-Curricular Transcript
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                    Institutional Outcome-Based Education transcript mapping university club activities, attendance, leadership roles, and written reflections directly to BAETE Program Outcomes (PO1 to PO12).
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge color="success" size="sm">
                      Exemplary: {transcript.attainment.level_counts.EXEMPLARY}
                    </Badge>
                    <Badge color="primary" size="sm">
                      Proficient: {transcript.attainment.level_counts.PROFICIENT}
                    </Badge>
                    <Badge color="warning" size="sm">
                      Developing: {transcript.attainment.level_counts.DEVELOPING}
                    </Badge>
                    <Badge color="neutral" size="sm">
                      Total Points: {transcript.attainment.total_points.toFixed(1)}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={downloadingPdf}
                    onClick={handleDownloadTranscriptPdf}
                    leftIcon={<Download className="w-4 h-4" />}
                  >
                    Download Signed PDF
                  </Button>
                  <Link
                    to="/transcripts/verify"
                    className={buttonClasses({ variant: 'outline', size: 'sm', className: 'text-xs' })}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Verify Portal
                  </Link>
                </div>
              </div>

              {/* 12 Program Outcomes Breakdown */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Program Outcomes (PO1 to PO12) Attainment Matrix</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {transcript.attainment.outcomes.map((po) => (
                    <div
                      key={po.code}
                      className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-subtle hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-xs text-slate-900 block">
                            {po.code}: {PO_TITLES[po.code] || po.code}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Score: <strong className="text-slate-800">{po.points.toFixed(1)} pts</strong>
                          </span>
                        </div>
                        <Badge color={getLevelBadgeColor(po.level)} size="sm">
                          {po.level.replace('_', ' ')}
                        </Badge>
                      </div>

                      {po.sources && (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                          <span>Events: {po.sources.events}</span>
                          <span>Reflections: {po.sources.reflections}</span>
                          <span>Roles: {po.sources.roles}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Semester Activity Timeline */}
              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-bold text-slate-900">Co-Curricular Activity History by Academic Term</h3>
                {transcript.semesters.length === 0 ? (
                  <div className="p-8 bg-white border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                    No verified activities recorded across academic terms yet.
                  </div>
                ) : (
                  transcript.semesters.map((sem, sIdx) => (
                    <div key={sem.semester_id || `sem-${sIdx}`} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-subtle">
                      <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-800">{sem.name}</span>
                        <span className="text-xs text-slate-500">{sem.activities.length} Activities</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {sem.activities.map((act) => (
                          <div key={act.event_id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-slate-900">{act.event_title}</h4>
                                <Badge color="primary" size="sm">{act.club_name}</Badge>
                                {act.club_role && act.club_role !== 'PARTICIPANT' && (
                                  <Badge color="info" size="sm">{act.club_role}</Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                                <span>Attended: {formatDate(act.attended_date)}</span>
                                {act.certificate_serial && (
                                  <span className="font-mono text-emerald-700 font-medium">
                                    Cert: {act.certificate_serial}
                                  </span>
                                )}
                              </div>
                              {act.po_tags && act.po_tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {act.po_tags.map((tag) => (
                                    <span key={tag.code} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-mono font-semibold">
                                      {tag.code} (w: {tag.weight})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="shrink-0 flex items-center gap-2">
                              {act.reflection ? (
                                <Badge color="success" size="sm">
                                  Reflection Logged (+0.5x)
                                </Badge>
                              ) : (
                                <button
                                  onClick={() => handleOpenReflection({ id: act.event_id, title: act.event_title })}
                                  className={buttonClasses({ variant: 'outline', size: 'xs', className: 'text-xs text-blue-900 border-blue-200 hover:bg-blue-50' })}
                                >
                                  <PenLine className="w-3 h-3 mr-1" />
                                  Write Reflection (+0.5x)
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Student Reflection Submission Modal */}
      <Modal
        isOpen={!!reflectingEvent}
        onClose={() => setReflectingEvent(null)}
        title="Submit Co-Curricular Reflection"
        description={`Record your learning insights from attending "${reflectingEvent?.title || 'the event'}". Submitting reflection grants a 0.5x bonus to BAETE outcome weights.`}
        size="md"
      >
        <form onSubmit={handleSubmitReflection} className="space-y-4 pt-1">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Reflective Summary (Min 20 characters)
            </label>
            <textarea
              required
              rows={5}
              value={reflectionText}
              onChange={(e) => setReflectionText(e.target.value)}
              placeholder="Describe key takeaways, engineering concepts applied, or team collaboration experience gained during this session..."
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Supports BAETE Criterion 4 (Continuous Improvement)</span>
              <span>{reflectionText.trim().length}/20 chars</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReflectingEvent(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={actionLoading}
              disabled={actionLoading || reflectionText.trim().length < 20}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Submit Reflection
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Dialog for Pass Cancellation */}
      <Modal
        isOpen={!!cancellingRegId}
        onClose={() => setCancellingRegId(null)}
        title="Cancel Seat Registration"
        description="Are you sure you want to release this event pass? If confirmed, the next student on the waitlist will be promoted automatically."
        size="sm"
      >
        <div className="space-y-4 pt-1 text-xs">
          <p className="text-slate-600 leading-relaxed">
            Your seat reservation and digital ticket code will be invalidated in the ledger.
          </p>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancellingRegId(null)}
            >
              Keep Reservation
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
