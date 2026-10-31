import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users, Award, Clock, ArrowRight, ShieldCheck } from 'lucide-react';
import { EventItem } from '../types.js';
import { Badge } from './ui/Badge.js';
import { formatDateTime, getClubLogoUrl } from '../lib/utils.js';

interface EventCardProps {
  event: EventItem;
}

export const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const isFull = event.registered_count >= event.capacity;
  const fillPercent = Math.min(100, Math.round((event.registered_count / event.capacity) * 100));
  const spotsLeft = Math.max(0, event.capacity - event.registered_count);

  const getCapacityColor = () => {
    if (isFull) return 'bg-amber-500';
    if (fillPercent >= 80) return 'bg-amber-500';
    return 'bg-emerald-600';
  };

  const getEventBanner = () => {
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
    <div className="group bg-white rounded-xl border border-slate-200/90 shadow-subtle hover:shadow-elevation hover:border-slate-300 transition-all duration-200 flex flex-col overflow-hidden">
      {/* Event Header Banner Image */}
      <div className="relative h-44 w-full overflow-hidden bg-slate-900">
        <img
          src={getEventBanner()}
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent" />

        {/* Floating Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-semibold text-white bg-slate-900/80 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[11px] border border-white/20 truncate max-w-[65%] shadow-sm">
            <img
              src={event.club_logo_url || getClubLogoUrl(event.club_slug || event.club_name)}
              alt=""
              className="w-3.5 h-3.5 rounded-full object-cover shrink-0 ring-1 ring-white/40"
            />
            <span className="truncate">{event.club_name}</span>
          </span>
          {isFull ? (
            <Badge color="warning" size="sm" variant="subtle">
              Waitlist Active
            </Badge>
          ) : (
            <Badge color="success" size="sm" variant="subtle" dot>
              {spotsLeft} Seats Open
            </Badge>
          )}
        </div>

        {/* Category Pill on bottom left */}
        {event.club_category && (
          <div className="absolute bottom-2.5 left-3">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-blue-200 bg-blue-950/80 backdrop-blur-sm px-2 py-0.5 rounded border border-blue-400/30">
              {event.club_category}
            </span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <Link to={`/events/${event.id}`}>
            <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-900 transition-colors line-clamp-2 leading-snug">
              {event.title}
            </h3>
          </Link>

          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {event.description}
          </p>
        </div>

        {/* Schedule & Venue Meta */}
        <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{formatDateTime(event.start_time)}</span>
          </div>
          
          <div className="flex items-center gap-2 text-slate-600">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{event.venue}</span>
          </div>

          {event.requires_feedback_for_cert && (
            <div className="flex items-center gap-1.5 text-indigo-700 font-semibold text-[11px] bg-indigo-50/70 px-2 py-1 rounded-md border border-indigo-100">
              <Award className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Tamper-Proof Certificate Eligible</span>
            </div>
          )}
        </div>

        {/* Capacity Meter */}
        <div className="pt-2">
          <div className="flex justify-between items-center text-[11px] font-medium text-slate-500 mb-1.5">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 text-slate-400" /> Seat Capacity
            </span>
            <span className="font-mono text-slate-700 font-semibold">
              {event.registered_count} / {event.capacity} ({fillPercent}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${getCapacityColor()}`}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
        <Link
          to={`/events/${event.id}`}
          className="w-full text-center py-2 px-3 rounded-lg text-xs font-bold bg-blue-900 text-white hover:bg-blue-800 active:scale-[0.98] transition shadow-sm flex items-center justify-center gap-1.5 group-hover:bg-blue-800"
        >
          <span>{isFull ? 'Join Event Waitlist' : 'View & Register'}</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
};
