import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Menu, X, Bell, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import type { NotificationsResponse } from '../services/responses.js';
import { cn } from '../lib/utils.js';
import { buttonClasses } from './ui/Button.js';

const DASHBOARDS: Record<string, { path: string; label: string }> = {
  ADMIN: { path: '/admin', label: 'Admin' },
  FACULTY_ADVISOR: { path: '/advisor', label: 'Advisor' },
  CLUB_EXECUTIVE: { path: '/executive', label: 'My club' },
  STUDENT: { path: '/student', label: 'My portal' }
};

const NAV_LINKS = [
  { to: '/', label: 'Events' },
  { to: '/clubs', label: 'Clubs' },
  { to: '/verify', label: 'Verify certificate' }
];

const initials = (name?: string) =>
  (name || 'CC').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    api.get<NotificationsResponse>('/notifications')
      .then((res) => setUnreadCount(res.unread_count || 0))
      .catch(() => setUnreadCount(0));
  }, [user, location.pathname]);

  useEffect(() => setMobileMenuOpen(false), [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const dashboard = user ? DASHBOARDS[user.role] ?? DASHBOARDS.STUDENT : null;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'px-3.5 py-2 text-sm font-medium rounded-full transition-colors',
      isActive ? 'text-blue-900 bg-blue-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    );

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-slate-200/70">
      <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-8 min-w-0">
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <img src="/images/campusconnect_logo.jpg" alt="" className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-200" />
              <span className="font-display text-lg font-bold tracking-tight text-slate-900">CampusConnect</span>
            </Link>

            <nav aria-label="Main" className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-2">
            {user && dashboard ? (
              <>
                <Link
                  to="/student"
                  aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
                  className="relative w-10 h-10 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <Bell className="w-[18px] h-[18px]" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-marigold-400 ring-2 ring-white" />
                  )}
                </Link>

                <Link
                  to={dashboard.path}
                  className={buttonClasses({ size: 'sm', className: 'text-sm h-10' })}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  {dashboard.label}
                </Link>

                <div className="flex items-center gap-1.5 pl-3 ml-1 border-l border-slate-200">
                  <span
                    title={user.fullName}
                    className="w-9 h-9 rounded-full bg-marigold-100 text-marigold-800 flex items-center justify-center text-xs font-bold"
                  >
                    {initials(user.fullName)}
                  </span>
                  <button
                    onClick={handleLogout}
                    aria-label="Sign out"
                    title="Sign out"
                    className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut className="w-[18px] h-[18px]" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'text-sm h-10' })}>
                  Sign in
                </Link>
                <Link to="/register" className={buttonClasses({ size: 'sm', className: 'text-sm h-10' })}>
                  Create account
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav aria-label="Mobile" className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-1">
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn('block px-4 py-3 rounded-xl text-base font-medium', isActive ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-100')
              }
            >
              {item.label}
            </NavLink>
          ))}

          <div className="pt-3 mt-2 border-t border-slate-200 grid gap-2">
            {user && dashboard ? (
              <>
                <div className="px-4 py-2">
                  <p className="text-sm font-semibold text-slate-900">{user.fullName}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
                <Link to={dashboard.path} className={buttonClasses({ fullWidth: true })}>
                  <LayoutDashboard className="w-4 h-4" />
                  {dashboard.label}
                </Link>
                <button onClick={handleLogout} className={buttonClasses({ variant: 'danger-outline', fullWidth: true })}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={buttonClasses({ variant: 'outline', fullWidth: true })}>
                  Sign in
                </Link>
                <Link to="/register" className={buttonClasses({ fullWidth: true })}>
                  Create account
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
};
