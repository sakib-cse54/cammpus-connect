import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Calendar, Users, Award, ShieldCheck, LogOut, LogIn, UserPlus, 
  Menu, X, Bell, LayoutDashboard, QrCode, ChevronDown, CheckCircle2 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import type { NotificationsResponse } from '../services/responses.js';
import { Badge } from './ui/Badge.js';
import { Button } from './ui/Button.js';
import { cn } from '../lib/utils.js';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      api.get<NotificationsResponse>('/notifications')
        .then(res => setUnreadCount(res.unread_count || 0))
        .catch(() => {});
    }
  }, [user, location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'ADMIN': return '/admin';
      case 'FACULTY_ADVISOR': return '/advisor';
      case 'CLUB_EXECUTIVE': return '/executive';
      default: return '/student';
    }
  };

  const getDashboardLabel = () => {
    if (!user) return 'Dashboard';
    switch (user.role) {
      case 'ADMIN': return 'Admin Console';
      case 'FACULTY_ADVISOR': return 'Advisor Workspace';
      case 'CLUB_EXECUTIVE': return 'Executive Desk';
      default: return 'Student Portal';
    }
  };

  const getRoleBadgeColor = () => {
    if (!user) return 'neutral';
    switch (user.role) {
      case 'ADMIN': return 'danger';
      case 'FACULTY_ADVISOR': return 'warning';
      case 'CLUB_EXECUTIVE': return 'info';
      default: return 'primary';
    }
  };

  const navLinks = [
    { to: '/', label: 'Events Catalog', icon: Calendar },
    { to: '/clubs', label: 'Student Clubs', icon: Users },
    { to: '/verify', label: 'Verify Credential', icon: ShieldCheck, highlight: true }
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3 group">
              <img
                src="/images/campusconnect_logo.jpg"
                alt="CampusConnect University Seal"
                className="w-10 h-10 rounded-xl object-cover shadow-sm ring-1 ring-slate-200 group-hover:ring-blue-500 transition-all shrink-0"
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black tracking-tight text-slate-900 group-hover:text-blue-900 transition-colors">
                    CampusConnect
                  </span>
                  <span className="hidden sm:inline-block text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200">
                    v2.0
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium hidden md:inline-block -mt-0.5">
                  University Extracurricular Governance
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav aria-label="Main Navigation" className="hidden md:flex items-center space-x-1">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-900 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70',
                      item.highlight && !isActive && 'text-emerald-700 hover:text-emerald-800'
                    )}
                  >
                    <Icon className={cn('w-4 h-4', item.highlight ? 'text-emerald-600' : 'text-slate-500')} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User Controls & Actions */}
          <div className="hidden md:flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-3">
                {/* Notification Bell */}
                <Link
                  to="/student"
                  aria-label="View notifications in student portal"
                  title="View notifications in student portal"
                  className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
                  )}
                </Link>

                {/* Dashboard Shortcut Button */}
                <Link
                  to={getDashboardPath()}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-900 text-white hover:bg-blue-800 shadow-sm transition active:scale-95"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>{getDashboardLabel()}</span>
                </Link>

                {/* User Info Capsule */}
                <div className="flex items-center gap-2.5 border-l pl-3 border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
                    {user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'CC'}
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900 leading-tight line-clamp-1 max-w-[130px]">
                      {user.fullName}
                    </div>
                    <div className="mt-0.5">
                      <Badge color={getRoleBadgeColor()} size="sm">
                        {user.role.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Sign Out Button */}
                <button
                  onClick={handleLogout}
                  title="Sign out of CampusConnect"
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-blue-900 hover:bg-slate-100 transition"
                >
                  <LogIn className="w-3.5 h-3.5" /> Sign In
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-900 text-white hover:bg-blue-800 shadow-sm transition active:scale-95"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Register Student
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <nav aria-label="Mobile Navigation" className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-2 shadow-lg">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition',
                  isActive
                    ? 'bg-blue-50 text-blue-900 font-bold'
                    : 'text-slate-700 hover:bg-slate-100'
                )}
              >
                <Icon className="w-4 h-4 text-slate-500" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {user ? (
            <div className="border-t border-slate-200 pt-3 space-y-2.5">
              <div className="px-3 py-1.5 bg-slate-50 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">{user.fullName}</div>
                  <div className="text-[11px] text-slate-500">{user.email}</div>
                </div>
                <Badge color={getRoleBadgeColor()} size="sm">
                  {user.role.replace('_', ' ')}
                </Badge>
              </div>

              <Link
                to={getDashboardPath()}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-bold bg-blue-900 text-white shadow-sm"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>{getDashboardLabel()}</span>
              </Link>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full text-center py-2 px-3 rounded-lg text-sm font-semibold text-rose-600 hover:bg-rose-50 transition"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="border-t border-slate-200 pt-3 flex flex-col space-y-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 rounded-lg bg-blue-900 text-white text-sm font-bold shadow-sm"
              >
                Register Student
              </Link>
            </div>
          )}
        </nav>
      )}
    </header>
  );
};
