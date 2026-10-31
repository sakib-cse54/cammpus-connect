import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Users, Calendar, Award, Database, 
  Activity, Plus, CheckCircle2, RefreshCw, AlertCircle, 
  UserCheck, Layers, FileText, Lock, Download, BarChart3
} from 'lucide-react';
import { api } from '../services/api.js';
import type { AdminAnalyticsResponse, UsersResponse } from '../services/responses.js';
import { useAuth } from '../context/AuthContext.js';
import { UserRole } from '../types.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { StatCard } from '../components/ui/StatCard.js';
import { Modal } from '../components/ui/Modal.js';
import { Input, Select, Textarea } from '../components/ui/Input.js';
import { Alert } from '../components/ui/Alert.js';
import { useToast } from '../components/ui/Toast.js';
import { formatDateTime } from '../lib/utils.js';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [metrics, setMetrics] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [userList, setUserList] = useState<any[]>([]);
  const [advisors, setAdvisors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Club Provisioning Modal
  const [showClubModal, setShowClubModal] = useState(false);
  const [newClub, setNewClub] = useState({
    name: '',
    slug: '',
    description: '',
    category: 'Technology & Engineering',
    faculty_advisor_id: ''
  });

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashRes, usersRes] = await Promise.all([
        api.get<AdminAnalyticsResponse>('/analytics/admin'),
        api.get<UsersResponse>('/auth/users')
      ]);

      setMetrics(dashRes.metrics || {});
      setAuditLogs(dashRes.recent_audit_logs || []);
      const allUsers = usersRes.users || [];
      setUserList(allUsers);
      setAdvisors(allUsers.filter((u: any) => u.role === 'FACULTY_ADVISOR' || u.role === 'ADMIN'));
    } catch (err: any) {
      setError(err.message || 'Failed to fetch institutional administration data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleRoleChange = async (userId: string, targetRole: UserRole) => {
    try {
      setActionLoading(true);
      await api.patch(`/auth/users/${userId}/role`, { role: targetRole });
      await fetchAdminData();
      toast.success(`User role successfully updated to ${targetRole}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user role');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClub.faculty_advisor_id) {
      toast.warning('Please assign a Faculty Advisor to this club.');
      return;
    }

    try {
      setActionLoading(true);
      await api.post('/clubs', newClub);
      setShowClubModal(false);
      setNewClub({
        name: '',
        slug: '',
        description: '',
        category: 'Technology & Engineering',
        faculty_advisor_id: ''
      });
      await fetchAdminData();
      toast.success('Student club successfully chartered and provisioned.');
    } catch (err: any) {
      toast.error(err.message || 'Club provisioning failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportPoReport = async () => {
    try {
      setDownloadingReport(true);
      const blob = await api.blob('/reports/po-attainment?format=csv');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `po-attainment-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('OBE Attainment CSV downloaded');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download attainment report');
    } finally {
      setDownloadingReport(false);
    }
  };

  const clubCategories = [
    { value: 'Technology & Engineering', label: 'Technology & Engineering' },
    { value: 'Arts & Culture', label: 'Arts & Culture' },
    { value: 'Business & Entrepreneurship', label: 'Business & Entrepreneurship' },
    { value: 'Sports & Athletics', label: 'Sports & Athletics' },
    { value: 'Social & Community Welfare', label: 'Social & Community Welfare' }
  ];

  return (
    <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      {/* Platform Banner */}
      <div className="bg-blue-900 text-white rounded-2xl p-6 sm:p-8 border border-blue-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Institutional System Administration</h1>
          </div>
          <p className="text-xs text-slate-400">
            Manage users, roles and the audit log. Signed in as {user?.email}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportPoReport}
            isLoading={downloadingReport}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Export OBE CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowClubModal(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Charter New Club
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchAdminData}
            isLoading={loading}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error" title="Administration Error">
          {error}
        </Alert>
      )}

      {/* Institutional KPI Cards */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <StatCard
            title="Total Users"
            value={metrics.users?.total_users || 0}
            subtitle={`${metrics.users?.students || 0} Students`}
            icon={<Users className="w-5 h-5 text-blue-900" />}
            variant="primary"
          />
          <StatCard
            title="Chartered Clubs"
            value={metrics.clubs || 0}
            subtitle="Active Societies"
            icon={<Layers className="w-5 h-5 text-indigo-700" />}
            variant="info"
          />
          <StatCard
            title="Events Hosted"
            value={metrics.events?.total_events || 0}
            subtitle={`${metrics.events?.published_events || 0} Published`}
            icon={<Calendar className="w-5 h-5 text-slate-700" />}
            variant="neutral"
          />
          <StatCard
            title="Registrations"
            value={metrics.registrations?.total_registrations || 0}
            subtitle={`${metrics.registrations?.attended_count || 0} Attended`}
            icon={<UserCheck className="w-5 h-5 text-emerald-700" />}
            variant="success"
          />
          <StatCard
            title="Certificates"
            value={metrics.certificates || 0}
            subtitle="Digitally signed"
            icon={<Award className="w-5 h-5 text-amber-700" />}
            variant="warning"
          />
        </div>
      )}

      {/* User Directory & Role Elevation */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-subtle space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">User Identity and RBAC Directory</h2>
            <p className="text-xs text-slate-500">Manage user accounts and elevate roles across institutions</p>
          </div>
          <Badge color="primary" size="sm">
            {userList.length} Authenticated Accounts
          </Badge>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table aria-label="User Identity and RBAC Directory Table" className="w-full text-left border-collapse text-xs">
            <caption className="sr-only">User Identity and RBAC Directory</caption>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs">
                <th className="py-2.5 px-3.5">Full Legal Name</th>
                <th className="py-2.5 px-3.5">Student ID</th>
                <th className="py-2.5 px-3.5">Email Address</th>
                <th className="py-2.5 px-3.5">Department</th>
                <th className="py-2.5 px-3.5">Assigned Role</th>
                <th className="py-2.5 px-3.5 text-right">Role Elevation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {userList.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-2.5 px-3.5 font-bold text-slate-900">{u.full_name || 'N/A'}</td>
                  <td className="py-2.5 px-3.5 font-mono text-slate-600">{u.student_id_number || '-'}</td>
                  <td className="py-2.5 px-3.5 font-mono text-slate-600">{u.email}</td>
                  <td className="py-2.5 px-3.5 text-slate-600">{u.department || 'General'}</td>
                  <td className="py-2.5 px-3.5">
                    <Badge
                      color={
                        u.role === 'ADMIN' ? 'danger' :
                        u.role === 'FACULTY_ADVISOR' ? 'warning' :
                        u.role === 'CLUB_EXECUTIVE' ? 'info' : 'primary'
                      }
                      size="sm"
                    >
                      {u.role.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3.5 text-right">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                      disabled={actionLoading || u.id === user?.userId}
                      aria-label={`Elevate role for ${u.full_name || u.email}`}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-800 disabled:opacity-50"
                    >
                      <option value="STUDENT">STUDENT</option>
                      <option value="CLUB_EXECUTIVE">CLUB_EXECUTIVE</option>
                      <option value="FACULTY_ADVISOR">FACULTY_ADVISOR</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Immutable Security Audit Trail */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-subtle space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-900" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Immutable Security Audit Trail</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Last 15 System Events</span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table aria-label="Immutable Security Audit Trail Table" className="w-full text-left border-collapse text-xs">
            <caption className="sr-only">Immutable Security Audit Trail</caption>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs">
                <th className="py-2.5 px-3.5">Timestamp</th>
                <th className="py-2.5 px-3.5">Action Type</th>
                <th className="py-2.5 px-3.5">Actor Identity</th>
                <th className="py-2.5 px-3.5">Target Entity</th>
                <th className="py-2.5 px-3.5">Network IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-2 px-3.5 text-xs text-slate-500 whitespace-nowrap">
                    {formatDateTime(log.timestamp)}
                  </td>
                  <td className="py-2 px-3.5 font-bold text-slate-900 font-sans">{log.action}</td>
                  <td className="py-2 px-3.5 text-blue-900">{log.actor_email || log.actor_id || 'System'}</td>
                  <td className="py-2 px-3.5">{log.entity_type}:{log.entity_id ? log.entity_id.substring(0, 8) : '-'}</td>
                  <td className="py-2 px-3.5 text-xs text-slate-400">{log.ip_address || '127.0.0.1'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Charter New Club */}
      <Modal
        isOpen={showClubModal}
        onClose={() => setShowClubModal(false)}
        title="Charter New Student Club"
        description="Provision an official university club with assigned faculty governance and RBAC isolation."
        size="md"
      >
        <form onSubmit={handleCreateClub} className="space-y-3.5 text-xs">
          <Input
            label="Club Name"
            required
            value={newClub.name}
            onChange={(e) => {
              const name = e.target.value;
              const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
              setNewClub({ ...newClub, name, slug });
            }}
            placeholder="e.g. University Debating Society"
          />

          <Input
            label="URL Identifier Slug"
            required
            value={newClub.slug}
            onChange={(e) => setNewClub({ ...newClub, slug: e.target.value })}
            placeholder="e.g. debating-society"
          />

          <Select
            label="Category"
            value={newClub.category}
            onChange={(e) => setNewClub({ ...newClub, category: e.target.value })}
            options={clubCategories}
          />

          <div>
            <label htmlFor="club-faculty-advisor" className="block text-xs font-semibold text-slate-700 tracking-tight mb-1.5">
              Assigned Faculty Advisor
            </label>
            <select
              id="club-faculty-advisor"
              required
              value={newClub.faculty_advisor_id}
              onChange={(e) => setNewClub({ ...newClub, faculty_advisor_id: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
            >
              <option value="">Select Faculty Member...</option>
              {advisors.map((adv) => (
                <option key={adv.id} value={adv.id}>
                  {adv.full_name || adv.email} ({adv.email})
                </option>
              ))}
            </select>
          </div>

          <Textarea
            label="Charter Mandate & Description"
            rows={3}
            required
            value={newClub.description}
            onChange={(e) => setNewClub({ ...newClub, description: e.target.value })}
            placeholder="Official mission statement and charter objectives..."
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClubModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={actionLoading}
            >
              Provision Club
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
