import React, { useState } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { ShieldCheck, LogIn, Mail, Lock, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { Input } from '../components/ui/Input.js';
import { Button } from '../components/ui/Button.js';
import { Alert } from '../components/ui/Alert.js';
import { Badge } from '../components/ui/Badge.js';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both institutional email and password.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await login(email, password);
      const destination = (location.state as any)?.from || searchParams.get('returnUrl') || '/';
      navigate(destination, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-md w-full space-y-7 bg-white p-8 sm:p-10 rounded-2xl shadow-card border border-slate-200/90">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <img
              src="/images/campusconnect_logo.jpg"
              alt="CampusConnect Crest"
              className="w-16 h-16 rounded-2xl shadow-md ring-2 ring-blue-900/10 object-cover"
            />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sign in</h1>
          <p className="text-xs text-slate-500">
            Use your university email to continue.
          </p>
        </div>

        {error && (
          <Alert variant="error" title="Could not sign in">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="University email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@university.edu"
            required
            leftIcon={<Mail className="w-4 h-4" />}
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            required
            leftIcon={<Lock className="w-4 h-4" />}
          />

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              isLoading={submitting}
              leftIcon={<LogIn className="w-4 h-4" />}
            >
              Sign in
            </Button>
          </div>
        </form>

        {/* Quick Fill Demo Credentials Box */}
        <div className="pt-5 border-t border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500r">
              Demo accounts
            </p>
            <Badge color="primary" size="sm">
              Seeded Credentials
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('shakhawat@university.edu', 'Password123!')}
              className="text-left p-3 rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 text-xs transition flex items-center justify-between group"
            >
              <div>
                <p className="font-bold text-slate-900 group-hover:text-blue-900">Md. Shakhawat Hossain (Team Leader)</p>
                <p className="text-slate-500 text-xs">ID: 0432320005101009 | shakhawat@university.edu</p>
              </div>
              <UserCheck className="w-4 h-4 text-slate-400 group-hover:text-blue-800 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('fahim@university.edu', 'Password123!')}
              className="text-left p-3 rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 text-xs transition flex items-center justify-between group"
            >
              <div>
                <p className="font-bold text-slate-900 group-hover:text-blue-900">Fahim Hossain (Team Member / Executive)</p>
                <p className="text-slate-500 text-xs">ID: 0432320005101007 | fahim@university.edu</p>
              </div>
              <UserCheck className="w-4 h-4 text-slate-400 group-hover:text-blue-800 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('imtiaz@university.edu', 'Password123!')}
              className="text-left p-3 rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 text-xs transition flex items-center justify-between group"
            >
              <div>
                <p className="font-bold text-slate-900 group-hover:text-blue-900">Al Imtiaz (Course Teacher & Supervisor)</p>
                <p className="text-slate-500 text-xs">imtiaz@university.edu</p>
              </div>
              <UserCheck className="w-4 h-4 text-slate-400 group-hover:text-blue-800 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('admin@university.edu', 'AdminPassword123!')}
              className="text-left p-3 rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 text-xs transition flex items-center justify-between group"
            >
              <div>
                <p className="font-bold text-slate-900 group-hover:text-blue-900">Platform Administrator (Central IT)</p>
                <p className="text-slate-500 text-xs">admin@university.edu</p>
              </div>
              <UserCheck className="w-4 h-4 text-slate-400 group-hover:text-blue-800 shrink-0" />
            </button>
          </div>
        </div>

        <div className="text-center pt-2">
          <p className="text-xs text-slate-500">
            New university student?{' '}
            <Link to="/register" className="font-bold text-blue-900 hover:text-blue-700 hover:underline inline-flex items-center gap-0.5">
              <span>Register student account</span>
              <ArrowRight className="w-3 h-3 ml-0.5" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
