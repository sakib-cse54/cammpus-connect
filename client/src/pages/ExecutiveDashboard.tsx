import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  Users, Calendar, QrCode, FileText, CheckCircle2, 
  XCircle, Plus, Send, Download, AlertCircle, RefreshCw, 
  Clock, MapPin, Ticket, ShieldCheck, ChevronRight, X, ExternalLink
} from 'lucide-react';
import { api } from '../services/api.js';
import type { ClubsResponse, EventResponse, EventsResponse, MembersResponse, RosterResponse, VenuesResponse } from '../services/responses.js';
import { useAuth } from '../context/AuthContext.js';
import { Club, EventItem, Venue } from '../types.js';
import { DynamicQrModal } from '../components/DynamicQrModal.js';
import { Badge } from '../components/ui/Badge.js';
import { Button, buttonClasses } from '../components/ui/Button.js';
import { StatCard } from '../components/ui/StatCard.js';
import { Modal } from '../components/ui/Modal.js';
import { Input, Textarea } from '../components/ui/Input.js';
import { Alert } from '../components/ui/Alert.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { useToast } from '../components/ui/Toast.js';
import { formatDateTime } from '../lib/utils.js';
import { fromDhakaInputValue } from '../lib/dateBd.js';
import { downloadFromApi } from '../lib/download.js';

export const ExecutiveDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const preselectedEventId = searchParams.get('eventId');

  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string>('');
  const [venues, setVenues] = useState<Venue[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clubsLoaded, setClubsLoaded] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic QR Modal
  const [activeQrEvent, setActiveQrEvent] = useState<{ id: string; title: string } | null>(null);

  // Roster inspection modal
  const [selectedRosterEvent, setSelectedRosterEvent] = useState<EventItem | null>(null);
  const [rosterList, setRosterList] = useState<any[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  // Manual Check-in state in Roster (requires student_id_number)
  const [manualStudentId, setManualStudentId] = useState('');
  const [manualMsg, setManualMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // New Event Proposal Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEventData, setNewEventData] = useState({
    title: '',
    description: '',
    venue: '',
    venue_id: '',
    start_time: '',
    end_time: '',
    capacity: 50,
    registration_deadline: '',
    requires_feedback_for_cert: true,
    po_tag_code: 'PO5'
  });

  // Post Announcement Modal
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementData, setAnnouncementData] = useState({ title: '', content: '' });

  const fetchClubs = async () => {
    try {
      // Only list clubs this user can manage; admins can manage every club.
      const [clubsRes, venuesRes] = await Promise.all([
        api.get<ClubsResponse>(user?.role === 'ADMIN' ? '/clubs' : '/me/clubs'),
        api.get<VenuesResponse>('/venues').catch(() => ({ venues: [] }))
      ]);
      const clubList = clubsRes.clubs || [];
      setClubs(clubList);
      setVenues(venuesRes.venues?.filter(v => Boolean(v.is_active)) || []);

      if (preselectedEventId) {
        try {
          const evData = await api.get<EventResponse>(`/events/${preselectedEventId}`);
          const ev = evData.event || evData;
          if (ev?.club_id) {
            setSelectedClubId(ev.club_id);
            return;
          }
        } catch {
          // ignore
        }
      }

      if (clubList.length > 0 && !selectedClubId) {
        setSelectedClubId(clubList[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch clubs');
    } finally {
      setClubsLoaded(true);
    }
  };

  const handleVenueSelect = (venueId: string) => {
    if (venueId === 'custom' || !venueId) {
      setNewEventData(prev => ({ ...prev, venue_id: '', venue: '' }));
    } else {
      const v = venues.find(item => item.id === venueId);
      if (v) {
        setNewEventData(prev => ({
          ...prev,
          venue_id: v.id,
          venue: v.name,
          capacity: v.capacity || prev.capacity
        }));
      }
    }
  };

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClubId) return;

    try {
      setActionLoading(true);
      // datetime-local inputs carry no offset; the API requires ISO 8601 with one.
      await api.post('/events', {
        title: newEventData.title,
        description: newEventData.description,
        venue: newEventData.venue,
        venue_id: newEventData.venue_id || undefined,
        club_id: selectedClubId,
        capacity: Number(newEventData.capacity),
        po_tags: newEventData.po_tag_code ? [{ code: newEventData.po_tag_code, weight: 2 }] : undefined,
        requires_feedback_for_cert: newEventData.requires_feedback_for_cert,
        start_time: fromDhakaInputValue(newEventData.start_time),
        end_time: fromDhakaInputValue(newEventData.end_time),
        registration_deadline: fromDhakaInputValue(newEventData.registration_deadline)
      });
      setShowCreateModal(false);
      setNewEventData({
        title: '',
        description: '',
        venue: '',
        venue_id: '',
        start_time: '',
        end_time: '',
        capacity: 50,
        registration_deadline: '',
        requires_feedback_for_cert: true,
        po_tag_code: 'PO5'
      });
      toast.success('Event proposal drafted successfully.');
      await fetchClubDetails(selectedClubId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create event proposal');
    } finally {
      setActionLoading(false);
    }
  };

  const fetchClubDetails = async (clubId: string) => {
    if (!clubId) return;
    try {
      setLoading(true);
      setError(null);

      const [eventsRes, membersRes] = await Promise.all([
        api.get<EventsResponse>(`/clubs/${clubId}/events`),
        api.get<MembersResponse>(`/clubs/${clubId}/members`)
      ]);

      setEvents(eventsRes.events || []);
      setMembers(membersRes.members || []);

      if (preselectedEventId) {
        const found = eventsRes.events?.find((e: EventItem) => e.id === preselectedEventId);
        if (found) {
          handleViewRoster(found);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load club operations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClubs();
  }, []);

  useEffect(() => {
    if (selectedClubId) {
      fetchClubDetails(selectedClubId);
    }
  }, [selectedClubId]);


  const handleSubmitForReview = async (eventId: string) => {
    try {
      setActionLoading(true);
      await api.post(`/events/${eventId}/submit`);
      toast.success('Proposal submitted to Faculty Advisor review queue.');
      await fetchClubDetails(selectedClubId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit proposal');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewMembership = async (membershipId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      setActionLoading(true);
      await api.patch(`/clubs/${selectedClubId}/members/${membershipId}`, { decision: status });
      toast.success(`Membership application ${status === 'APPROVED' ? 'approved' : 'rejected'}.`);
      await fetchClubDetails(selectedClubId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to review application');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewRoster = async (ev: EventItem) => {
    setSelectedRosterEvent(ev);
    setManualMsg(null);
    try {
      setRosterLoading(true);
      const res = await api.get<RosterResponse>(`/events/${ev.id}/roster`);
      setRosterList(res.roster || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load attendee roster');
    } finally {
      setRosterLoading(false);
    }
  };

  const handleManualCheckIn = async (studentId: string, reason = 'Executive manual check-in') => {
    if (!selectedRosterEvent || !studentId.trim()) return;

    try {
      setActionLoading(true);
      setManualMsg(null);
      await api.post(`/events/${selectedRosterEvent.id}/attendance/manual`, {
        student_id_number: studentId.trim(),
        reason
      });
      setManualMsg({ text: `Student ${studentId.trim()} verified and checked in!` });
      toast.success(`Student ${studentId.trim()} checked in successfully.`);
      setManualStudentId('');
      // Reload roster
      const res = await api.get<RosterResponse>(`/events/${selectedRosterEvent.id}/roster`);
      setRosterList(res.roster || []);
    } catch (err: any) {
      const msg = err.message || 'Manual check-in failed';
      setManualMsg({ text: msg, isError: true });
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClubId || !announcementData.title.trim()) return;

    try {
      setActionLoading(true);
      await api.post(`/clubs/${selectedClubId}/announcements`, {
        ...announcementData,
        club_id: selectedClubId
      });
      setShowAnnouncementModal(false);
      setAnnouncementData({ title: '', content: '' });
      toast.success('Announcement broadcasted to enrolled club members.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish announcement');
    } finally {
      setActionLoading(false);
    }
  };

  const currentClub = clubs.find(c => c.id === selectedClubId);
  const approvedMembers = members.filter(m => m.status === 'APPROVED');
  const pendingApplicants = members.filter(m => m.status === 'PENDING');

  if (clubsLoaded && clubs.length === 0) {
    return (
      <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <EmptyState
          title={error ? 'Could not load your clubs' : 'You are not managing a club yet'}
          description={error ?? 'Club tools appear here once a club approves you as an executive or you are assigned as its faculty advisor.'}
          actionLabel="Browse clubs"
          onAction={() => navigate('/clubs')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      {/* Top Banner Header */}
      <div className="bg-blue-900 text-white rounded-2xl p-6 sm:p-8 border border-blue-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Club dashboard</h1>
          </div>
          <p className="text-xs text-slate-400">
            Signed in as {user?.fullName}
          </p>
        </div>

        {/* Club Selector Dropdown */}
        <div className="flex items-center gap-3">
          <label htmlFor="chartered-club-select" className="text-xs font-bold text-slate-400 tracking-wider">Chartered Club:</label>
          <select
            id="chartered-club-select"
            value={selectedClubId}
            onChange={(e) => setSelectedClubId(e.target.value)}
            className="px-3.5 py-2 bg-slate-900 border border-slate-700 text-white rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            {clubs.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <Alert variant="error" title="Could not load club data">
          {error}
        </Alert>
      )}

      {/* Metrics Row */}
      {currentClub && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            title="Club Category"
            value={currentClub.category}
            subtitle="Club focus"
            icon={<ShieldCheck className="w-6 h-6 text-blue-900" />}
            variant="primary"
          />
          <StatCard
            title="Active Members"
            value={approvedMembers.length}
            subtitle="Enrolled students"
            icon={<Users className="w-6 h-6 text-emerald-700" />}
            variant="success"
          />
          <StatCard
            title="Events Managed"
            value={events.length}
            subtitle="Total configured"
            icon={<Calendar className="w-6 h-6 text-indigo-700" />}
            variant="info"
          />
          <StatCard
            title="Pending Applicants"
            value={pendingApplicants.length}
            subtitle="Awaiting review"
            icon={<Ticket className="w-6 h-6 text-amber-700" />}
            variant="warning"
          />
        </div>
      )}

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Events and Operations Workflow</h2>
          <p className="text-xs text-slate-500">Draft proposals, launch dynamic QR scans, and review attendance</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAnnouncementModal(true)}
            leftIcon={<Send className="w-3.5 h-3.5" />}
          >
            Broadcast Announcement
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Propose New Event
          </Button>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table aria-label="Club Events List Table" className="w-full text-left border-collapse text-xs">
            <caption className="sr-only">Club Events List</caption>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs">
                <th className="py-3 px-4">Event Title</th>
                <th className="py-3 px-4">Venue & Time</th>
                <th className="py-3 px-4">Capacity Meter</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Host Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No events currently configured for this club.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <Link to={`/events/${ev.id}`} className="hover:text-blue-900 transition">
                        {ev.title}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div>{ev.venue}</div>
                      <div className="text-xs text-slate-400 font-mono">
                        {formatDateTime(ev.start_time)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold">
                      <span>{ev.registered_count}</span> / {ev.capacity}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        color={
                          ev.status === 'PUBLISHED' ? 'success' :
                          ev.status === 'PENDING_APPROVAL' ? 'warning' :
                          ev.status === 'APPROVED' ? 'primary' :
                          ev.status === 'DRAFT' ? 'neutral' : 'danger'
                        }
                        size="sm"
                        dot
                      >
                        {ev.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {ev.status === 'DRAFT' && (
                        <Button
                          variant="secondary"
                          size="xs"
                          isLoading={actionLoading}
                          onClick={() => handleSubmitForReview(ev.id)}
                        >
                          Submit for Review
                        </Button>
                      )}
                      {(ev.status === 'PUBLISHED' || ev.status === 'APPROVED') && (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => setActiveQrEvent({ id: ev.id, title: ev.title })}
                          leftIcon={<QrCode className="w-3 h-3" />}
                        >
                          Live QR
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => handleViewRoster(ev)}
                        leftIcon={<FileText className="w-3 h-3" />}
                      >
                        Roster
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Member Applications Section */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-subtle space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Club Membership Applications</h2>
          <p className="text-xs text-slate-500">Review student requests to join {currentClub?.name}</p>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table aria-label="Club Membership Applications Table" className="w-full text-left border-collapse text-xs">
            <caption className="sr-only">Club Membership Applications</caption>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs">
                <th className="py-2.5 px-4">Applicant</th>
                <th className="py-2.5 px-4">Student ID</th>
                <th className="py-2.5 px-4">Department</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Review Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No membership records available for this club.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.membership_id || m.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-4 font-bold text-slate-900">
                      {m.full_name || m.email}
                    </td>
                    <td className="py-2.5 px-4 font-mono">{m.student_id_number || 'N/A'}</td>
                    <td className="py-2.5 px-4 text-slate-600">{m.department || 'General'}</td>
                    <td className="py-2.5 px-4">
                      <Badge
                        color={
                          m.status === 'APPROVED' ? 'success' :
                          m.status === 'PENDING' ? 'warning' : 'neutral'
                        }
                        size="sm"
                      >
                        {m.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-1.5">
                      {m.status === 'PENDING' && (
                        <>
                          <Button
                            variant="success"
                            size="xs"
                            disabled={actionLoading}
                            onClick={() => handleReviewMembership(m.membership_id || m.id, 'APPROVED')}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            size="xs"
                            disabled={actionLoading}
                            onClick={() => handleReviewMembership(m.membership_id || m.id, 'REJECTED')}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Draft Event */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Draft New Event Proposal"
        description={`Propose an event under ${currentClub?.name || 'club'}. Upon drafting, submit it for Faculty Advisor review.`}
        size="md"
      >
        <form onSubmit={handleCreateDraft} className="space-y-3.5 text-xs">
          <Input
            label="Event Title"
            required
            value={newEventData.title}
            onChange={(e) => setNewEventData({ ...newEventData, title: e.target.value })}
            placeholder="e.g. AI & Robotics Innovation Workshop 2026"
          />

          <div className="space-y-1">
            <label htmlFor="create-event-venue" className="block text-xs font-semibold text-slate-700">
              Institutional Venue
            </label>
            <select
              id="create-event-venue"
              value={newEventData.venue_id || 'custom'}
              onChange={(e) => handleVenueSelect(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
            >
              <option value="custom">-- Custom Venue / Room Location --</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.building ? `${v.building} - ` : ''}Capacity: {v.capacity})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Venue Location Name"
            required
            value={newEventData.venue}
            onChange={(e) => setNewEventData({ ...newEventData, venue: e.target.value })}
            placeholder="e.g. Auditorium Hall B / Lab 402"
          />

          <div className="space-y-1">
            <label htmlFor="create-event-po" className="block text-xs font-semibold text-slate-700">
              Proposed BAETE Program Outcome (PO Tag)
            </label>
            <select
              id="create-event-po"
              value={newEventData.po_tag_code}
              onChange={(e) => setNewEventData({ ...newEventData, po_tag_code: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
            >
              <option value="PO1">PO1: Engineering Knowledge</option>
              <option value="PO2">PO2: Problem Analysis</option>
              <option value="PO3">PO3: Design/Development of Solutions</option>
              <option value="PO4">PO4: Investigation</option>
              <option value="PO5">PO5: Modern Tool Usage (Recommended)</option>
              <option value="PO6">PO6: Engineer & Society</option>
              <option value="PO7">PO7: Sustainability</option>
              <option value="PO8">PO8: Ethics</option>
              <option value="PO9">PO9: Individual & Team Work</option>
              <option value="PO10">PO10: Communication</option>
              <option value="PO11">PO11: Project Management & Finance</option>
              <option value="PO12">PO12: Life-Long Learning</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Start Date & Time"
              type="datetime-local"
              required
              value={newEventData.start_time}
              onChange={(e) => setNewEventData({ ...newEventData, start_time: e.target.value })}
            />
            <Input
              label="End Date & Time"
              type="datetime-local"
              required
              value={newEventData.end_time}
              onChange={(e) => setNewEventData({ ...newEventData, end_time: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Seating Capacity"
              type="number"
              min="5"
              max="1000"
              required
              value={newEventData.capacity}
              onChange={(e) => setNewEventData({ ...newEventData, capacity: parseInt(e.target.value) || 50 })}
            />
            <Input
              label="Registration Deadline"
              type="datetime-local"
              required
              value={newEventData.registration_deadline}
              onChange={(e) => setNewEventData({ ...newEventData, registration_deadline: e.target.value })}
            />
          </div>

          <Textarea
            label="Description & Objectives"
            rows={3}
            value={newEventData.description}
            onChange={(e) => setNewEventData({ ...newEventData, description: e.target.value })}
            placeholder="Outline syllabus, key speakers, attendance requirements..."
          />

          <fieldset className="border-0 p-0 m-0">
            <legend className="sr-only">Certificate Requirements</legend>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="req_feedback"
                checked={newEventData.requires_feedback_for_cert}
                onChange={(e) => setNewEventData({ ...newEventData, requires_feedback_for_cert: e.target.checked })}
                className="rounded text-blue-900 focus:ring-blue-800"
              />
              <label htmlFor="req_feedback" className="text-xs text-slate-700 font-medium">
                Require verified attendee feedback before issuing cryptographic certificate
              </label>
            </div>
          </fieldset>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={actionLoading}
            >
              Create Draft Event
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Roster Inspection */}
      {selectedRosterEvent && (
        <Modal
          isOpen={!!selectedRosterEvent}
          onClose={() => setSelectedRosterEvent(null)}
          title={`Attendee Roster: ${selectedRosterEvent.title}`}
          description={`Total Registrations: ${rosterList.length} / ${selectedRosterEvent.capacity}`}
          size="lg"
        >
          <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={() => downloadFromApi(`/events/${selectedRosterEvent.id}/roster?format=csv`, `roster-${selectedRosterEvent.id}.csv`).catch((err: Error) => toast.error(err.message || 'Export failed'))}
              >
                Export CSV
              </Button>
            </div>

            {/* Manual Check-in Form */}
            <form onSubmit={(e) => { e.preventDefault(); handleManualCheckIn(manualStudentId); }} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-800 whitespace-nowrap">Manual Check-In:</span>
              <input
                type="text"
                aria-label="Student ID number for manual check-in"
                placeholder="Student ID (e.g. 0432320005101007)"
                value={manualStudentId}
                onChange={(e) => setManualStudentId(e.target.value)}
                className="flex-1 h-9 px-3.5 bg-white border border-slate-300 rounded-full font-mono text-xs focus:ring-2 focus:ring-blue-800 focus:outline-none"
              />
              <Button
                type="submit"
                size="xs"
                isLoading={actionLoading}
                disabled={!manualStudentId.trim()}
              >
                Verify & Check In
              </Button>
            </form>
            {manualMsg && (
              <p role="status" aria-live="polite" className={`text-xs font-semibold px-1 ${manualMsg.isError ? 'text-rose-600' : 'text-emerald-700'}`}>
                {manualMsg.text}
              </p>
            )}

            {/* Roster Table */}
            <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl">
              <table aria-label="Attendee Check-In Roster Table" className="w-full text-left border-collapse text-xs">
                <caption className="sr-only">Attendee Check-In Roster</caption>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 text-[11px]">
                    <th className="py-2.5 px-3">Ticket</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Student ID</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Check-In Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {rosterLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        Loading roster records...
                      </td>
                    </tr>
                  ) : rosterList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No attendees registered yet.
                      </td>
                    </tr>
                  ) : (
                    rosterList.map((r) => (
                      <tr key={r.registration_id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{r.ticket_code}</td>
                        <td className="py-2.5 px-3">{r.full_name || r.email}</td>
                        <td className="py-2.5 px-3 font-mono">{r.student_id_number || 'N/A'}</td>
                        <td className="py-2.5 px-3">
                          <Badge
                            color={
                              r.registration_status === 'CONFIRMED' ? 'success' :
                              r.registration_status === 'WAITLISTED' ? 'warning' :
                              r.registration_status === 'ATTENDED' ? 'primary' : 'neutral'
                            }
                            size="sm"
                          >
                            {r.registration_status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-xs">
                          {r.registration_status === 'CONFIRMED' ? (
                            <Button
                              variant="success"
                              size="xs"
                              disabled={actionLoading || !r.student_id_number}
                              onClick={() => handleManualCheckIn(r.student_id_number)}
                            >
                              Check In
                            </Button>
                          ) : r.check_in_time ? (
                            <span className="text-emerald-800 font-mono font-semibold">
                              {new Date(r.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">
                              {r.registration_status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Broadcast Announcement */}
      <Modal
        isOpen={showAnnouncementModal}
        onClose={() => setShowAnnouncementModal(false)}
        title="Broadcast Club Announcement"
        description="Sends notifications to all enrolled members and participants."
        size="md"
      >
        <form onSubmit={handlePostAnnouncement} className="space-y-3.5 text-xs">
          <Input
            label="Announcement Headline"
            required
            value={announcementData.title}
            onChange={(e) => setAnnouncementData({ ...announcementData, title: e.target.value })}
            placeholder="e.g. Schedule Update or Room Assignment"
          />

          <Textarea
            label="Broadcast Message Content"
            rows={4}
            required
            value={announcementData.content}
            onChange={(e) => setAnnouncementData({ ...announcementData, content: e.target.value })}
            placeholder="Detail schedule adjustments, preparation requirements, or room changes..."
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAnnouncementModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={actionLoading}
            >
              Send Broadcast
            </Button>
          </div>
        </form>
      </Modal>

      {/* Dynamic Rotating QR Modal */}
      {activeQrEvent && (
        <DynamicQrModal
          eventId={activeQrEvent.id}
          eventTitle={activeQrEvent.title}
          isOpen={!!activeQrEvent}
          onClose={() => setActiveQrEvent(null)}
        />
      )}
    </div>
  );
};
