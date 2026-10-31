import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, Calendar, Award, ShieldCheck, Sparkles, 
  Layers, Users, CheckCircle2, ArrowRight, Database, Lock, Clock
} from 'lucide-react';
import { api } from '../services/api.js';
import type { ClubsResponse, EventsResponse } from '../services/responses.js';
import { EventItem, Club } from '../types.js';
import { EventCard } from '../components/EventCard.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { getClubLogoUrl } from '../lib/utils.js';

export const Home: React.FC = () => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const fetchEvents = async () => {
    setLoading(true);
    try {
      let query = '/events?';
      if (search) query += `search=${encodeURIComponent(search)}&`;
      if (selectedCategory) query += `category=${encodeURIComponent(selectedCategory)}&`;

      const data = await api.get<EventsResponse>(query);
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [selectedCategory]);

  useEffect(() => {
    api.get<ClubsResponse>('/clubs')
      .then(res => setClubs(res.clubs || []))
      .catch(() => {});
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEvents();
  };

  const handleResetFilters = async () => {
    setSearch('');
    setSelectedCategory('');
    setLoading(true);
    try {
      const data = await api.get<EventsResponse>('/events');
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to reset events:', err);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    'All',
    'Technical',
    'Cultural',
    'Robotics & Hardware',
    'Career & Networking'
  ];

  return (
    <div className="space-y-12 pb-20">
      {/* Institutional Hero Masthead */}
      <section className="bg-slate-950 text-white pt-16 pb-20 px-4 sm:px-6 lg:px-8 border-b border-slate-800 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-64 bg-blue-900/10 blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center space-y-6 relative z-10">
          <div className="flex justify-center items-center gap-3">
            <img
              src="/images/campusconnect_logo.jpg"
              alt="CampusConnect Crest"
              className="w-14 h-14 rounded-2xl shadow-xl ring-2 ring-blue-500/40 object-cover"
            />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-950 border border-blue-800/80 text-xs font-semibold text-blue-300 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>University Extracurricular Governance Baseline | IEEE Std 830-1998</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight text-white">
            CampusConnect Portal
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
            Centralized hub for university clubs, faculty-reviewed event governance, strict ACID concurrency seat allocations, dynamic rotating anti-proxy QR attendance, and digitally verified completion certificates.
          </p>

          {/* Institutional Search Bar */}
          <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto pt-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                aria-label="Search events by title, keyword, or venue"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events by title, keyword, or venue..."
                className="w-full pl-10 pr-4 py-3 bg-white text-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg placeholder:text-slate-400 font-medium"
              />
            </div>
            <Button
              type="submit"
              size="md"
              className="px-6 py-3 rounded-xl shadow-lg"
            >
              Search
            </Button>
          </form>

          {/* Platform Pillars Pill Row */}
          <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto text-left">
            <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold">
                <Database className="w-3.5 h-3.5" />
                <span>ACID Concurrency</span>
              </div>
              <p className="text-[11px] text-slate-400">Zero overbooking guarantees</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold">
                <Lock className="w-3.5 h-3.5" />
                <span>Anti-Proxy QR</span>
              </div>
              <p className="text-[11px] text-slate-400">20-second dynamic rotation</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold">
                <Award className="w-3.5 h-3.5" />
                <span>SHA-256 Ledger</span>
              </div>
              <p className="text-[11px] text-slate-400">Cryptographically verifiable</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Faculty Review</span>
              </div>
              <p className="text-[11px] text-slate-400">Appointed advisor audit</p>
            </div>
          </div>

          {/* Panoramic Campus Hero Visual Showcase */}
          <div className="pt-6 max-w-4xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-2xl group bg-slate-900">
              <img
                src="/images/hero_campus_life.jpg"
                alt="Modern University Campus Life and Student Collaboration"
                className="w-full h-56 sm:h-80 object-cover object-center group-hover:scale-[1.02] transition-transform duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-90" />
              <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-left">
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-600/90 text-white font-bold text-[10px] tracking-wider uppercase mb-1.5 shadow-sm">
                    Collegiate Ecosystem
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                    Empowering Student Leadership & Extracurricular Excellence
                  </h3>
                  <p className="text-xs text-slate-300 hidden sm:block mt-1">
                    Connect with student organizations, technical hackathons, cultural fests, and verified workshops.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/80 text-xs font-semibold text-slate-200">
                    <span className="font-bold text-blue-400">100%</span> Verified Seats
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog Section */}
      <section aria-labelledby="events-catalog-heading" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <h2 id="events-catalog-heading" className="sr-only">Scheduled University Events Catalog</h2>

        {/* Category Filter Pills and Counts */}
        <div className="flex items-center justify-between flex-wrap gap-4 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {categories.map((cat) => {
              const isActive = (cat === 'All' && !selectedCategory) || selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat === 'All' ? '' : cat)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-blue-900 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <div className="text-xs font-semibold text-slate-500">
            Showing <strong className="text-slate-900 font-mono">{events.length}</strong> active campus events
          </div>
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900 mx-auto mb-3"></div>
            <p className="text-xs font-semibold text-slate-500">Loading scheduled university events...</p>
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={<Calendar className="w-7 h-7" />}
            title="No events found matching your criteria"
            description="Try adjusting your search terms or selecting another category filter above."
            actionLabel="Reset Filters"
            onAction={handleResetFilters}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        )}

        {/* Campus Clubs Spotlight */}
        <section className="pt-14 border-t border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Chartered Student Organizations</h2>
              <p className="text-xs text-slate-500">Explore official university societies governed under appointed academic advisors</p>
            </div>
            <Link
              to="/clubs"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-900 hover:text-blue-700"
            >
              <span>Explore All Clubs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {clubs.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-subtle hover:shadow-card hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={c.logo_url || getClubLogoUrl(c.slug || c.name)}
                      alt={c.name}
                      className="w-11 h-11 rounded-xl object-cover shadow-sm ring-1 ring-slate-200 shrink-0 bg-slate-900"
                    />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{c.name}</h3>
                      <Badge color="primary" size="sm">
                        {c.category}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {c.description}
                  </p>

                  <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 space-y-1">
                    <p>
                      <strong className="text-slate-700">Faculty Advisor:</strong> {c.advisor_name || c.advisor_email || 'Assigned Faculty'}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700">{c.member_count || 0} Members</span>
                  <span>{c.active_event_count || 0} Active Events</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
};
