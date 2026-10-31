import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, CheckCircle2, XCircle, Clock, Calendar, 
  MapPin, AlertCircle, RefreshCw, MessageSquare, ExternalLink, 
  Check, X, FileText, ArrowRight, Download, BarChart3, GraduationCap, Tag
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

const AVAILABLE_PO_TAGS = [
  { code: 'PO1', title: 'Engineering Knowledge' },
  { code: 'PO2', title: 'Problem Analysis' },
  { code: 'PO3', title: 'Design/Development' },
  { code: 'PO4', title: 'Investigation' },
  { code: 'PO5', title: 'Modern Tool Usage' },
  { code: 'PO6', title: 'Engineer & Society' },
  { code: 'PO7', title: 'Sustainability' },
  { code: 'PO8', title: 'Ethics' },
  { code: 'PO9', title: 'Individual & Team Work' },
  { code: 'PO10', title: 'Communication' },
  { code: 'PO11', title: 'Project Management' },
  { code: 'PO12', title: 'Life-Long Learning' }
];

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
  const [selectedPoTags, setSelectedPoTags] = useState<{ code: string; weight: number }[]>([
    { code: 'PO5', weight: 2 },
    { code: 'PO9', weight: 2 }
  ]);

  // OBE Attainment Report state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

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

  const handleOpenReview = async (ev: EventItem, action: 'APPROVED' | 'REJECTED') => {
    setSelectedEvent(ev);
    setDecision(action);
    setRemarks(action === 'APPROVED' ? 'Approved for institutional hosting and seat allocation.' : '');
    
    // Fetch existing outcomes or populate defaults
    try {
      const res = await api.get<{ po_tags?: { code: string; weight: number }[] }>(`/events/${ev.id}/outcomes`);
      if (res.po_tags && res.po_tags.length > 0) {
        setSelectedPoTags(res.po_tags.map(t => ({ code: t.code, weight: t.weight || 2 })));
      } else {
        setSelectedPoTags([
          { code: 'PO5', weight: 2 },
          { code: 'PO9', weight: 2 }
        ]);
      }
    } catch {
      setSelectedPoTags([
        { code: 'PO5', weight: 2 },
        { code: 'PO9', weight: 2 }
      ]);
    }
  };

  const handleTogglePoTag = (code: string) => {
    setSelectedPoTags(prev => {
      const exists = prev.find(p => p.code === code);
      if (exists) {
        return prev.filter(p => p.code !== code);
      } else {
        return [...prev, { code, weight: 2 }];
      }
    });
  };

  const handleChangePoWeight = (code: string, weight: number) => {
    setSelectedPoTags(prev => prev.map(p => p.code === code ? { ...p, weight } : p));
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    if (decision === 'REJECTED' && !remarks.trim()) {
      toast.error('Remarks are required when returning or rejecting an event proposal.');
      return;
    }

    if (decision === 'APPROVED' && selectedPoTags.length === 0) {
      toast.warning('At least one BAETE Program Outcome (PO) tag is required to approve the proposal.');
      return;
    }

    try {
      setActionLoading(true);
      const payload: any = {
        decision,
        remarks: remarks.trim()
      };
      if (decision === 'APPROVED') {
        payload.po_tags = selectedPoTags;
      }

      await api.post(`/events/${selectedEvent.id}/review`, payload);
      toast.success(decision === 'APPROVED' ? 'Event proposal approved and published to catalog.' : 'Proposal returned to organizers with feedback.');
      setSelectedEvent(null);
      await fetchAdvisorData();
    } catch (err: any) {
      toast.error(err.message || 'Review submission failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReportModal = async () => {
    setShowReportModal(true);
    try {
      setReportLoading(true);
      const res = await api.get('/reports/po-attainment');
      setReportData(res);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch attainment report');
    } finally {
      setReportLoading(false);
    }
  };

  const handleDownloadReportCsv = async () => {
    try {
      setDownloadingReport(true);
      const blob = await api.blob('/reports/po-attainment?format=csv');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'po-attainment.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('PO Attainment CSV exported successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to export attainment report CSV');
    } finally {
      setDownloadingReport(false);
    }
  };

  return (
    <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      {/* Header Banner */}
      <div className="bg-blue-900 text-white rounded-2xl p-6 sm:p-8 border border-blue-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Advisor dashboard</h1>
          </div>
          <p className="text-xs text-slate-400">
            Institutional Oversight, Proposal Review & Compliance Audit | Advisor: {user?.fullName} ({user?.email})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenReportModal}
            leftIcon={<BarChart3 className="w-3.5 h-3.5" />}
          >
            OBE Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            isLoading={downloadingReport}
            onClick={handleDownloadReportCsv}
            leftIcon={<Download className="w-3.5 h-3.5" />}
            className="bg-blue-800/60 text-white border-blue-700 hover:bg-blue-800"
          >
            Export CSV
          </Button>
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
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Proposals Awaiting Approval</h2>
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
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs">
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
              <label htmlFor="advisor-remarks" className="block text-xs font-bold text-slate-700 mb-1.5">
                Faculty Advisor Formal Remarks {decision === 'REJECTED' && '(Mandatory)'}
              </label>
              <textarea
                id="advisor-remarks"
                rows={3}
                required={decision === 'REJECTED'}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={decision === 'APPROVED' ? 'Optional feedback or directives for organizers...' : 'Specify reasons for rejection and requested changes...'}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-800 focus:outline-none placeholder:text-slate-400"
              />
            </div>

            {/* BAETE PO Tags Assignment on Approval */}
            {decision === 'APPROVED' && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    BAETE Program Outcomes (PO Tags) Assignment (Mandatory)
                  </label>
                  <span className="text-[11px] font-mono text-slate-500">
                    {selectedPoTags.length} selected
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Select outcomes developed by this event and designate weights (1 to 3) to satisfy accreditation requirements:
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {AVAILABLE_PO_TAGS.map((tag) => {
                    const active = selectedPoTags.find(p => p.code === tag.code);
                    return (
                      <div
                        key={tag.code}
                        className={`p-2 rounded-lg border text-left transition-colors ${
                          active ? 'bg-blue-50/90 border-blue-300 text-blue-950 shadow-xs' : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => handleTogglePoTag(tag.code)}
                            className="font-bold text-xs hover:underline flex-1 text-left truncate"
                          >
                            {tag.code}: {tag.title}
                          </button>
                          {active && (
                            <select
                              value={active.weight}
                              onChange={(e) => handleChangePoWeight(tag.code, Number(e.target.value))}
                              className="px-1 py-0.5 text-[10px] font-bold bg-white border border-slate-300 rounded focus:outline-none"
                              title="Weight (1-3)"
                            >
                              <option value={1}>w: 1</option>
                              <option value={2}>w: 2</option>
                              <option value={3}>w: 3</option>
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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

      {/* OBE Attainment Report Modal */}
      {showReportModal && (
        <Modal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          title="Institutional OBE Attainment Report"
          description="Department-wide summary of student co-curricular progress mapped against the 12 BAETE Program Outcomes."
          size="lg"
        >
          <div className="space-y-4 pt-1 text-xs">
            {reportLoading ? (
              <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-900" />
                <span>Generating accreditation metrics...</span>
              </div>
            ) : !reportData?.departments ? (
              <div className="p-8 text-center text-slate-500">
                No departmental attainment data available.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">
                    Framework: {reportData.framework} (Graduate Attributes)
                  </span>
                  <Button
                    variant="outline"
                    size="xs"
                    isLoading={downloadingReport}
                    onClick={handleDownloadReportCsv}
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                  >
                    Export CSV
                  </Button>
                </div>

                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                  {reportData.departments.map((dept: any, dIdx: number) => (
                    <div key={dIdx} className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900 text-sm">{dept.department}</h4>
                        <Badge color="primary" size="sm">{dept.students} Students Assessed</Badge>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                              <th className="py-1 px-2">Outcome</th>
                              <th className="py-1 px-2 text-center">Exemplary</th>
                              <th className="py-1 px-2 text-center">Proficient</th>
                              <th className="py-1 px-2 text-center">Developing</th>
                              <th className="py-1 px-2 text-center">Not Started</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {Object.entries(dept.outcomes || {}).map(([poCode, counts]: [string, any]) => (
                              <tr key={poCode} className="hover:bg-white transition-colors">
                                <td className="py-1 px-2 font-mono font-bold text-slate-800">{poCode}</td>
                                <td className="py-1 px-2 text-center font-semibold text-emerald-700">{counts.EXEMPLARY || 0}</td>
                                <td className="py-1 px-2 text-center font-semibold text-blue-700">{counts.PROFICIENT || 0}</td>
                                <td className="py-1 px-2 text-center font-semibold text-amber-700">{counts.DEVELOPING || 0}</td>
                                <td className="py-1 px-2 text-center text-slate-400">{counts.NOT_STARTED || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowReportModal(false)}
              >
                Close Report
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
