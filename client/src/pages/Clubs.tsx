import React, { useState, useEffect } from 'react';
import { Users, Layers, ShieldCheck, CheckCircle2, UserPlus, ArrowRight, AlertCircle, RefreshCw, Building } from 'lucide-react';
import { api } from '../services/api.js';
import type { ClubsResponse } from '../services/responses.js';
import { useAuth } from '../context/AuthContext.js';
import { Club } from '../types.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { Alert } from '../components/ui/Alert.js';
import { useToast } from '../components/ui/Toast.js';
import { getClubLogoUrl } from '../lib/utils.js';

export const Clubs: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [actionStatus, setActionStatus] = useState<{ [clubId: string]: string }>({});
  const [actionLoading, setActionLoading] = useState<{ [clubId: string]: boolean }>({});

  const categories = [
    'ALL',
    'Technology & Engineering',
    'Arts & Culture',
    'Business & Entrepreneurship',
    'Sports & Athletics',
    'Social & Community Welfare'
  ];

  const fetchClubs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<ClubsResponse>('/clubs');
      setClubs(res.clubs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch clubs directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClubs();
  }, []);

  const handleApply = async (clubId: string) => {
    if (!user) {
      toast.info('Please sign in to apply for club membership.');
      return;
    }

    try {
      setActionLoading(prev => ({ ...prev, [clubId]: true }));
      setActionStatus(prev => ({ ...prev, [clubId]: 'Submitting application...' }));
      await api.post(`/clubs/${clubId}/apply`);
      setActionStatus(prev => ({ ...prev, [clubId]: 'Application submitted (Pending Review)' }));
      toast.success('Membership application submitted for faculty advisor review.');
      await fetchClubs();
    } catch (err: any) {
      const msg = err.message || 'Application failed';
      setActionStatus(prev => ({ ...prev, [clubId]: msg }));
      toast.error(msg);
    } finally {
      setActionLoading(prev => ({ ...prev, [clubId]: false }));
    }
  };

  const filteredClubs = selectedCategory === 'ALL'
    ? clubs
    : clubs.filter(c => c.category === selectedCategory);

  return (
    <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 pb-20">
      {/* Header Banner with Clubs Fair Illustration */}
      <div className="bg-blue-900 text-white rounded-2xl border border-blue-800 relative overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 p-6 sm:p-10 space-y-4 relative z-10 flex flex-col justify-center">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
            Find your club
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
            Student-run academic, cultural and technical clubs, each guided by a faculty advisor. Apply to join and take part in their events.
          </p>
        </div>
        <div className="lg:col-span-5 relative h-52 sm:h-64 lg:h-auto overflow-hidden border-t lg:border-t-0 lg:border-l border-slate-800">
          <img
            src="/images/clubs_banner.jpg"
            alt="Campus Clubs and Student Societies Fair"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-blue-900 via-blue-900/20 to-transparent" />
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-200">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedCategory === cat
                ? 'bg-blue-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {error && (
        <Alert variant="error" title="Error Loading Clubs">
          {error}
        </Alert>
      )}

      {/* Clubs Grid */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900 mx-auto mb-3"></div>
          <p className="text-xs font-semibold text-slate-500">Loading student organizations...</p>
        </div>
      ) : filteredClubs.length === 0 ? (
        <EmptyState
          icon={<Building className="w-7 h-7" />}
          title="No clubs found in this category"
          description="Try selecting another category or check back later for newly chartered student societies."
          actionLabel="Show All Clubs"
          onAction={() => setSelectedCategory('ALL')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClubs.map((club) => (
            <div
              key={club.id}
              className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-subtle hover:shadow-card hover:border-slate-300 transition-all flex flex-col justify-between space-y-5"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge color="primary" size="sm">
                    {club.category}
                  </Badge>
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    {club.member_count || 0} Members
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <img
                    src={club.logo_url || getClubLogoUrl(club.slug || club.name)}
                    alt={club.name}
                    className="w-12 h-12 rounded-xl object-cover shadow-sm ring-1 ring-slate-200 shrink-0 bg-slate-900"
                  />
                  <h2 className="text-base font-bold text-slate-900 leading-snug line-clamp-1">{club.name}</h2>
                </div>

                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                  {club.description}
                </p>

                <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Faculty Advisor:</span>
                    <span className="font-semibold text-slate-800 line-clamp-1">
                      {club.advisor_name || club.advisor_email || 'Assigned Faculty'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Active Events:</span>
                    <span className="font-semibold text-slate-800">
                      {club.active_event_count || 0} scheduled
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  isLoading={actionLoading[club.id]}
                  onClick={() => handleApply(club.id)}
                  leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                >
                  Apply for Membership
                </Button>
                {actionStatus[club.id] && (
                  <p className="text-xs font-semibold text-blue-900 text-center bg-blue-50 py-1 px-2 rounded-md border border-blue-200">
                    {actionStatus[club.id]}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
