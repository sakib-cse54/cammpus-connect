import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Calendar, ArrowRight } from 'lucide-react';
import { api } from '../services/api.js';
import type { ClubsResponse, EventsResponse } from '../services/responses.js';
import { EventItem, Club } from '../types.js';
import { EventCard } from '../components/EventCard.js';
import { EmptyState } from '../components/ui/EmptyState.js';
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
    <div className="pb-8">
      <section className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-12 grid gap-10 lg:grid-cols-[1.05fr_1fr] items-center">
        <div className="space-y-6">
          <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.05] tracking-tight text-slate-900 max-w-xl">
            What's happening on campus this week
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-lg">
            Browse events from every club, reserve your seat in seconds and collect a certificate you can share.
          </p>

          <form onSubmit={handleSearchSubmit} role="search" className="flex flex-col sm:flex-row gap-2 max-w-lg">
            <div className="relative flex-1">
              <Search className="w-[18px] h-[18px] absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search events"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, keyword or venue"
                className="w-full h-12 pl-11 pr-4 bg-white border border-slate-300 rounded-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100 transition"
              />
            </div>
            <Button type="submit" size="lg" className="text-sm">Search</Button>
          </form>

          {clubs.length > 0 && (
            <div className="flex items-center gap-3 pt-2">
              <div className="flex -space-x-2">
                {clubs.slice(0, 5).map((c) => (
                  <img
                    key={c.id}
                    src={c.logo_url || getClubLogoUrl(c.slug || c.name)}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-50 bg-slate-900"
                  />
                ))}
              </div>
              <p className="text-sm text-slate-600">
                <strong className="font-semibold text-slate-900">{clubs.length} clubs</strong> hosting events
              </p>
            </div>
          )}
        </div>

        <div className="relative">
          <img
            src="/images/hero_campus_life.jpg"
            alt="Students gathered on the university campus"
            className="w-full aspect-[4/3] lg:aspect-[5/4] object-cover rounded-[2rem]"
          />
          <div className="absolute -bottom-5 left-5 sm:left-8 bg-white rounded-2xl shadow-elevation px-5 py-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-marigold-100 text-marigold-700 flex items-center justify-center">
              <Calendar className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-xl font-bold text-slate-900 leading-none tabular-nums">{events.length}</p>
              <p className="text-xs text-slate-500 mt-1">upcoming events</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="events-heading" className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <h2 id="events-heading" className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Upcoming events</h2>
          <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
            {categories.map((cat) => {
              const isActive = (cat === 'All' && !selectedCategory) || selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat === 'All' ? '' : cat)}
                  aria-pressed={isActive}
                  className={`h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[26rem] rounded-2xl bg-slate-200/60 animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={<Calendar className="w-7 h-7" />}
            title="No events match your search"
            description="Try a different keyword or category."
            actionLabel="Clear filters"
            onAction={handleResetFilters}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </section>

      {clubs.length > 0 && (
        <section aria-labelledby="clubs-heading" className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 pt-16 space-y-6">
          <div className="flex items-end justify-between gap-4">
            <h2 id="clubs-heading" className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Clubs</h2>
            <Link to="/clubs" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-900 hover:text-blue-700 transition-colors">
              See all clubs
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clubs.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                to="/clubs"
                className="group flex gap-4 p-5 bg-white rounded-2xl border border-slate-200 hover:border-blue-200 hover:shadow-elevation transition"
              >
                <img
                  src={c.logo_url || getClubLogoUrl(c.slug || c.name)}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover shrink-0 bg-slate-900"
                />
                <div className="min-w-0 space-y-1">
                  <h3 className="text-base font-semibold text-slate-900 truncate group-hover:text-blue-900 transition-colors">{c.name}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">{c.description}</p>
                  <p className="text-xs text-slate-500 pt-1">
                    {c.member_count || 0} members | {c.active_event_count || 0} events
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
