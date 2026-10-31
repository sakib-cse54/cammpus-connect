import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
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
import { CheckIn } from './pages/CheckIn.js';
import { TranscriptVerify } from './pages/TranscriptVerify.js';
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
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-blue-900"></div>
          <p className="text-sm text-slate-500">Checking your session...</p>
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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
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

          {/* Mobile Check-In Deep Link */}
          <Route path="/checkin/:eventId" element={<CheckIn />} />

          {/* Public Verification Portals */}
          <Route path="/verify" element={<PublicVerify />} />
          <Route path="/verify/:serialNumber" element={<PublicVerify />} />
          <Route path="/transcripts/verify" element={<TranscriptVerify />} />
          <Route path="/transcripts/verify/:id" element={<TranscriptVerify />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="mt-16 border-t border-slate-200 bg-white">
        <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 py-10 grid gap-8 md:grid-cols-[1.4fr_1fr_1fr] text-sm">
          <div className="space-y-3 max-w-sm">
            <div className="flex items-center gap-2.5">
              <img src="/images/campusconnect_logo.jpg" alt="" className="w-8 h-8 rounded-lg object-cover" />
              <span className="font-display text-base font-bold text-slate-900">CampusConnect</span>
            </div>
            <p className="text-slate-500 leading-relaxed">
              Find club events, reserve a seat, check in with a QR code and keep a verified record of everything you take part in.
            </p>
          </div>

          <nav aria-label="Footer" className="space-y-2">
            <p className="font-semibold text-slate-900">Explore</p>
            <ul className="space-y-1.5 text-slate-600">
              <li><Link to="/" className="hover:text-blue-900 transition-colors">Events</Link></li>
              <li><Link to="/clubs" className="hover:text-blue-900 transition-colors">Clubs</Link></li>
              <li><Link to="/verify" className="hover:text-blue-900 transition-colors">Verify a certificate</Link></li>
              <li><Link to="/transcripts/verify" className="hover:text-blue-900 transition-colors">Verify a transcript</Link></li>
              <li><Link to="/login" className="hover:text-blue-900 transition-colors">Sign in</Link></li>
            </ul>
          </nav>

          <div className="space-y-2">
            <p className="font-semibold text-slate-900">Project team</p>
            <ul className="space-y-1.5 text-slate-600">
              <li>Md. Shakhawat Hossain, team leader</li>
              <li>Fahim Hossain</li>
              <li className="text-slate-500">Supervised by Al Imtiaz, CSE 416</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-100">
          <p className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 py-5 text-xs text-slate-500">(c) 2026 CampusConnect</p>
        </div>
      </footer>
    </div>
  );
};
