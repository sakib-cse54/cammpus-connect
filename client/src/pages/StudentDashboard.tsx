import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Ticket, Award, Bell, CheckCircle2, Clock, Calendar, 
  MapPin, AlertCircle, Download, ExternalLink, Hash, 
  GraduationCap, RefreshCw, XCircle, Star, Send, ArrowRight, User
} from 'lucide-react';
import { api } from '../services/api.js';
import type { CertificatesResponse, NotificationsResponse, RegistrationsResponse } from '../services/responses.js';
import { useAuth } from '../context/AuthContext.js';
import { RegistrationItem, CertificateItem, NotificationItem } from '../types.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { StatCard } from '../components/ui/StatCard.js';
import { Tabs } from '../components/ui/Tabs.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { Alert } from '../components/ui/Alert.js';
import { Modal } from '../components/ui/Modal.js';
import { useToast } from '../components/ui/Toast.js';
import { formatDate, formatDateTime, formatRelativeTime } from '../lib/utils.js';

export const StudentDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<string>('tickets');
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cancellation modal state
  const [cancellingRegId, setCancellingRegId] = useState<string | null>(null);

  // Quick check-in state
  const [checkInEventId, setCheckInEventId] = useState<string | null>(null);
  const [checkInToken, setCheckInToken] = useState('');
  const [checkInStatus, setCheckInStatus] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [regRes, certRes, notifRes] = await Promise.all([
        api.get<RegistrationsResponse>('/registrations/me'),
        api.get<CertificatesResponse>('/certificates/me'),
        api.get<NotificationsResponse>('/notifications')
      ]);

      setRegistrations(regRes.registrations || []);
      setCertificates(certRes.certificates || []);
      setNotifications(notifRes.notifications || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

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
      await api.post(`/events/${eventId}/attendance/scan`, {
        token: checkInToken.trim()
      });
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
    { id: 'notifications', label: 'System Notices', count: unreadNotifs, icon: <Bell className="w-4 h-4" /> }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-24">
      {/* Student Profile Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-900 text-white font-black text-2xl flex items-center justify-center shadow-inner border border-blue-800">
            {profile?.full_name ? profile.full_name.charAt(0) : (user?.fullName?.charAt(0) || 'S')}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
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
          Refresh Portal
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
          subtitle="Tamper-proof digital certificates"
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
                      <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
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
                      <p className="text-[10px] uppercase font-bold text-slate-400">Digital Pass ID</p>
                      <p className="text-sm font-black text-slate-900 tracking-wider">{reg.ticket_code}</p>
                    </div>

                    {reg.status === 'CONFIRMED' && (
                      <div>
                        {checkInEventId === reg.event_id ? (
                          <div className="space-y-2 p-3 bg-blue-50/80 border border-blue-200 rounded-xl">
                            <label htmlFor={`checkin-token-${reg.id}`} className="block text-[11px] font-bold text-blue-900 uppercase">
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
                                className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-800 focus:outline-none"
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
                              <p role="status" aria-live="polite" className="text-[11px] font-bold text-slate-700">{checkInStatus}</p>
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
                              variant="outline"
                              size="sm"
                              className="text-rose-700 hover:text-rose-800 hover:bg-rose-50 border-rose-200"
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
                      <span className="text-xs font-bold uppercase tracking-wide text-blue-900">
                        {cert.club_name}
                      </span>
                      <h2 className="text-base font-black text-slate-900 mt-0.5 leading-snug">
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
                    <p className="text-[10px] uppercase font-bold text-slate-400 font-sans">Official Serial Number</p>
                    <p className="text-xs font-black text-slate-900">{cert.serial_number}</p>
                    <p className="text-[10px] text-slate-500 truncate pt-1">
                      SHA-256: {cert.sha256_hash}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <a
                      href={`/api/v1/certificates/download/${cert.serial_number}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-2 px-3 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition inline-flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </a>
                    <Link
                      to={`/verify/${cert.serial_number}`}
                      className="py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 shadow-sm"
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
                  <p className="text-[11px] text-slate-400">
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
