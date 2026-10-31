import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, CheckCircle2, XCircle, Clock, Calendar, 
  MapPin, AlertCircle, RefreshCw, MessageSquare, ExternalLink, 
  Check, X, FileText, ArrowRight
} from 'lucide-react';
import { api } from '../services/api.js';
import type { EventsResponse } from '../services/responses.js';
import { useAuth } from '../context/AuthContext.js';
import { EventItem } from '../types.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { StatCard } from '../components/ui/StatCard.js';
import { Modal } from '../components/ui/Modal.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { Alert } from '../components/ui/Alert.js';
import { useToast } from '../components/ui/Toast.js';
import { formatDateTime } from '../lib/utils.js';

export const AdvisorDashboard: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [pendingEvents, setPendingEvents] = useState<EventItem[]>([]);
  const [historyEvents, setHistoryEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Review Modal state
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [remarks, setRemarks] = useState('');

  const fetchAdvisorData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [pendingRes, allRes] = await Promise.all([
        api.get<EventsResponse>('/events/review/pending'),
        api.get<EventsResponse>('/events?status=PUBLISHED')
      ]);

      setPendingEvents(pendingRes.events || []);
      setHistoryEvents(allRes.events || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch advisor review queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvisorData();
  }, []);

  const handleOpenReview = (ev: EventItem, action: 'APPROVED' | 'REJECTED') => {
    setSelectedEvent(ev);
    setDecision(action);
    setRemarks(action === 'APPROVED' ? 'Approved for institutional hosting and seat allocation.' : '');
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    if (decision === 'REJECTED' && !remarks.trim()) {
      toast.error('Remarks are required when returning or rejecting an event proposal.');
      return;
    }

    try {
      setActionLoading(true);
      await api.post(`/events/${selectedEvent.id}/review`, {
        decision,
        remarks: remarks.trim()
      });
      toast.success(decision === 'APPROVED' ? 'Event proposal approved and published to catalog.' : 'Proposal returned to organizers with feedback.');
      setSelectedEvent(null);
      await fetchAdvisorData();
    } catch (err: any) {
      toast.error(err.message || 'Review submission failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      {/* Header Banner */}
      <div className="bg-slate-950 text-white rounded-2xl p-6 sm:p-8 shadow-elevation border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">Faculty Advisor Governance Workspace</h1>
          </div>
          <p className="text-xs text-slate-400">
            Institutional Oversight, Proposal Review & Compliance Audit | Advisor: {user?.fullName} ({user?.email})
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={fetchAdvisorData}
          isLoading={loading}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh Queue
        </Button>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Pending Proposals"
          value={pendingEvents.length}
          subtitle="Awaiting advisor evaluation"
          icon={<Clock className="w-6 h-6 text-amber-700" />}
          variant="warning"
        />
        <StatCard
          title="Supervised Events"
          value={historyEvents.length}
          subtitle="Currently published or active"
          icon={<CheckCircle2 className="w-6 h-6 text-emerald-700" />}
          variant="success"
        />
        <StatCard
          title="Academic Oversight"
          value="100%"
          subtitle="Faculty verified compliance"
          icon={<ShieldCheck className="w-6 h-6 text-blue-900" />}
          variant="primary"
        />
      </div>

      {error && (
        <Alert variant="error" title="Advisor Error">
          {error}
        </Alert>
      )}

      {/* Pending Proposals Queue */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Proposals Awaiting Approval</h2>
            <Badge color="warning" size="md">
              {pendingEvents.length} Pending
            </Badge>
          </div>
        </div>

        {pendingEvents.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="w-7 h-7 text-emerald-600" />}
            title="Review Queue Clear"
            description="All submitted club event proposals have been evaluated and dispositioned."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {pendingEvents.map((ev) => (
              <div
                key={ev.id}
                className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-subtle hover:shadow-card transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge color="primary" size="sm">
                      {ev.club_name}
                    </Badge>
                    <Badge color="warning" size="sm" dot>
                      Pending Review
                    </Badge>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {ev.title}
                  </h3>

                  <div className="space-y-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100">
                    <p className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDateTime(ev.start_time)}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{ev.venue}</span>
                    </p>
                    <p className="text-slate-700 font-semibold pt-1">
                      Capacity: {ev.capacity} seats | Certificate: {ev.requires_feedback_for_cert ? 'Feedback Required' : 'Standard'}
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80 leading-relaxed">
                    {ev.description || 'No detailed syllabus provided.'}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100">
                  <Button
                    variant="success"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleOpenReview(ev, 'APPROVED')}
                    leftIcon={<Check className="w-4 h-4" />}
                  >
                    Approve Proposal
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleOpenReview(ev, 'REJECTED')}
                    leftIcon={<X className="w-4 h-4" />}
                  >
                    Reject / Return
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Supervised Events History */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-subtle space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Institutional Event Supervisions</h2>
          <p className="text-xs text-slate-500">Events actively conducted or approved across university clubs</p>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table aria-label="Institutional Event Supervisions Table" className="w-full text-left border-collapse text-xs">
            <caption className="sr-only">Institutional Event Supervisions</caption>
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-black font-bold uppercase text-[11px]">
                <th className="py-2.5 px-3">Club</th>
                <th className="py-2.5 px-3">Event Title</th>
                <th className="py-2.5 px-3">Venue</th>
                <th className="py-2.5 px-3">Capacity Meter</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {historyEvents.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-2.5 px-3 font-bold text-blue-900">{ev.club_name}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{ev.title}</td>
                  <td className="py-2.5 px-3 text-slate-600">{ev.venue}</td>
                  <td className="py-2.5 px-3 font-mono">{ev.registered_count} / {ev.capacity}</td>
                  <td className="py-2.5 px-3">
                    <Badge color="success" size="sm">
                      {ev.status}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <Link
                      to={`/events/${ev.id}`}
                      className="text-xs font-bold text-blue-900 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Dialog Modal */}
      {selectedEvent && (
        <Modal
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          title={decision === 'APPROVED' ? 'Confirm Event Approval' : 'Return Event Proposal'}
          description={`Evaluating proposal "${selectedEvent.title}" submitted by ${selectedEvent.club_name}.`}
          size="md"
        >
          <form onSubmit={handleSubmitReview} className="space-y-4 text-xs">
            <div>
              <label htmlFor="advisor-remarks" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Faculty Advisor Formal Remarks {decision === 'REJECTED' && '(Mandatory)'}
              </label>
              <textarea
                id="advisor-remarks"
                rows={4}
                required={decision === 'REJECTED'}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={decision === 'APPROVED' ? 'Optional feedback or directives for organizers...' : 'Specify reasons for rejection and requested changes...'}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-800 focus:outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedEvent(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={decision === 'APPROVED' ? 'success' : 'danger'}
                size="sm"
                isLoading={actionLoading}
              >
                {decision === 'APPROVED' ? 'Approve & Publish' : 'Submit Rejection'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
