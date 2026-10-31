import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { 
  ShieldCheck, Award, Calendar, Users, CheckCircle2, 
  ExternalLink, ArrowUpRight, Lock, Database, Sparkles 
} from 'lucide-react';
import { Navbar } from './components/Navbar.js';
import { Home } from './pages/Home.js';
import { EventDetails } from './pages/EventDetails.js';
import { Clubs } from './pages/Clubs.js';
import { Login } from './pages/Login.js';
import { Register } from './pages/Register.js';
import { StudentDashboard } from './pages/StudentDashboard.js';
import { ExecutiveDashboard } from './pages/ExecutiveDashboard.js';
import { AdvisorDashboard } from './pages/AdvisorDashboard.js';
import { AdminDashboard } from './pages/AdminDashboard.js';
import { PublicVerify } from './pages/PublicVerify.js';
import { useAuth } from './context/AuthContext.js';
import { UserRole } from './types.js';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-blue-900"></div>
          <p className="text-xs font-semibold text-slate-500">Authenticating session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Skip to main content link for keyboard & screen reader accessibility */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-900 focus:text-white focus:rounded-lg focus:shadow-lg focus:font-semibold focus:outline-none"
      >
        Skip to main content
      </a>

      <Navbar />

      <main id="main" className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/events/:id" element={<EventDetails />} />
          <Route path="/clubs" element={<Clubs />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Student Dashboard (supports both /student and /dashboard/student) */}
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={['STUDENT', 'CLUB_EXECUTIVE', 'FACULTY_ADVISOR', 'ADMIN']}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard/student" element={<Navigate to="/student" replace />} />

          {/* Executive Dashboard (supports both /executive and /dashboard/executive) */}
          <Route
            path="/executive"
            element={
              <ProtectedRoute allowedRoles={['CLUB_EXECUTIVE', 'ADMIN']}>
                <ExecutiveDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard/executive" element={<Navigate to="/executive" replace />} />

          {/* Faculty Advisor Dashboard (supports both /advisor and /dashboard/advisor) */}
          <Route
            path="/advisor"
            element={
              <ProtectedRoute allowedRoles={['FACULTY_ADVISOR', 'ADMIN']}>
                <AdvisorDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard/advisor" element={<Navigate to="/advisor" replace />} />

          {/* Admin Dashboard (supports both /admin and /dashboard/admin) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard/admin" element={<Navigate to="/admin" replace />} />

          {/* Public Verification Portals */}
          <Route path="/verify" element={<PublicVerify />} />
          <Route path="/verify/:serialNumber" element={<PublicVerify />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="bg-slate-950 text-slate-400 pt-16 pb-12 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-slate-800">
            {/* Identity Column */}
            <div className="md:col-span-1 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center font-black text-lg shadow-md border border-blue-700/50">
                  CC
                </div>
                <div>
                  <span className="text-base font-black tracking-tight text-white">CampusConnect</span>
                  <p className="text-[10px] text-blue-400 font-mono font-medium">IEEE Std 830-1998 Platform</p>
                </div>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Centralized university extracurricular governance platform with strict ACID seat concurrency, dynamic rotating anti-proxy QR attendance, and digitally verified credentials.
              </p>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-[11px] font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>All Core Systems Operational</span>
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Campus Portals</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/" className="hover:text-white transition flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" /> Scheduled Events
                  </Link>
                </li>
                <li>
                  <Link to="/clubs" className="hover:text-white transition flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-500" /> Student Societies & Clubs
                  </Link>
                </li>
                <li>
                  <Link to="/verify" className="hover:text-white transition flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Verify Credential
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-white transition flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-500" /> Single Sign-On Portal
                  </Link>
                </li>
              </ul>
            </div>

            {/* Governance & Specifications */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">System Architecture</h4>
              <ul className="space-y-2 text-slate-400">
                <li className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-blue-400" />
                  <span>PostgreSQL ACID Row Locks</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-400" />
                  <span>20s Dynamic Anti-Proxy QR</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-blue-400" />
                  <span>SHA-256 Ledger Certificates</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Appointed Faculty Oversight</span>
                </li>
              </ul>
            </div>

            {/* Project Attribution */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Academic Review Team</h4>
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2 text-[11px]">
                <div>
                  <span className="text-slate-500 uppercase tracking-wide text-[10px] block">Team Leader</span>
                  <span className="font-bold text-slate-200">Md. Shakhawat Hossain</span>
                  <span className="text-slate-400 font-mono text-[10px] block">Student ID: 0432320005101009 | Batch 54</span>
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-slate-500 uppercase tracking-wide text-[10px] block">Team Member</span>
                  <span className="font-bold text-slate-200">Fahim Hossain</span>
                  <span className="text-slate-400 font-mono text-[10px] block">Student ID: 0432320005101007</span>
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-slate-500 uppercase tracking-wide text-[10px] block">Course Teacher</span>
                  <span className="font-bold text-slate-200">Al Imtiaz</span>
                  <span className="text-slate-400 text-[10px] block">Software Project Design and Development (416)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between text-slate-500 text-[11px] gap-3">
            <p>(c) 2026 CampusConnect. Institutional Academic Platform. Tamper-Proof Cryptographic Certification.</p>
            <p className="font-mono">Production Baseline v2.0 | IEEE Std Architecture</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
