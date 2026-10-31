import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, Award } from 'lucide-react';
import { EventItem } from '../types.js';
import { getClubLogoUrl } from '../lib/utils.js';
import { buttonClasses } from './ui/Button.js';

interface EventCardProps {
  event: EventItem;
}

const getEventBanner = (event: EventItem): string => {
  const cat = (event.club_category || '').toLowerCase();
  const title = (event.title || '').toLowerCase();
  if (cat.includes('robot') || title.includes('robot') || title.includes('hardware')) return '/images/event_robotics.jpg';
  if (cat.includes('cultur') || cat.includes('art') || title.includes('fest') || title.includes('music')) return '/images/event_cultural_fest.jpg';
  if (cat.includes('tech') || title.includes('hack') || title.includes('code') || title.includes('cyber')) return '/images/event_tech_hackathon.jpg';
  return '/images/hero_campus_life.jpg';
};

const getDateParts = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return {
    day: d.toLocaleDateString('en-US', { day: 'numeric' }),
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  };
};

/** Event shown as an admission ticket: photo, details, then a tear-off stub with seats left. */
export const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const capacity = Math.max(1, event.capacity);
  const isFull = event.registered_count >= event.capacity;
  const fillPercent = Math.min(100, Math.round((event.registered_count / capacity) * 100));
  const spotsLeft = Math.max(0, event.capacity - event.registered_count);
  const date = getDateParts(event.start_time);

  return (
    <Link
      to={`/events/${event.id}`}
      className="group flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-blue-200 hover:shadow-elevation hover:-translate-y-0.5 transition focus-visible:ring-2 focus-visible:ring-blue-700"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-slate-900">
        <img
          src={getEventBanner(event)}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />
        {date && (
          <div className="absolute top-3 left-3 w-14 rounded-xl bg-white/95 backdrop-blur text-center py-1.5 shadow-subtle">
            <p className="text-[11px] font-semibold text-marigold-600 leading-none">{date.month}</p>
            <p className="font-display text-2xl font-bold text-slate-900 leading-tight tabular-nums">{date.day}</p>
          </div>
        )}
      </div>

      <div className="flex-1 p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
          <img
            src={event.club_logo_url || getClubLogoUrl(event.club_slug || event.club_name)}
            alt=""
            className="w-5 h-5 rounded-full object-cover shrink-0 bg-slate-900"
          />
          <span className="truncate font-medium text-slate-600">{event.club_name}</span>
        </div>

        <h3 className="font-display text-lg font-semibold leading-snug text-slate-900 line-clamp-2 group-hover:text-blue-900 transition-colors">
          {event.title}
        </h3>

        <ul className="space-y-1.5 text-sm text-slate-600">
          {date && (
            <li className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
              <span className="truncate">{date.weekday}, {date.time}</span>
            </li>
          )}
          <li className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="truncate">{event.venue}</span>
          </li>
          {Boolean(event.requires_feedback_for_cert) && (
            <li className="flex items-center gap-2 text-blue-800">
              <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Certificate on completion</span>
            </li>
          )}
        </ul>
      </div>

      {/* Tear line: notches on both edges plus a dashed rule */}
      <div className="relative h-0" aria-hidden="true">
        <span className="absolute -left-2.5 -top-2.5 w-5 h-5 rounded-full bg-slate-50 border border-slate-200" />
        <span className="absolute -right-2.5 -top-2.5 w-5 h-5 rounded-full bg-slate-50 border border-slate-200" />
        <span className="absolute left-4 right-4 top-0 border-t-2 border-dashed border-slate-200" />
      </div>

      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {isFull ? 'Full, waitlist open' : `${spotsLeft} of ${event.capacity} seats left`}
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${fillPercent >= 80 ? 'bg-marigold-400' : 'bg-blue-600'}`}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>
        <span className={buttonClasses({ size: 'sm', className: 'shrink-0 text-sm group-hover:bg-blue-800' })}>
          {isFull ? 'Join waitlist' : 'Reserve'}
        </span>
      </div>
    </Link>
  );
};
