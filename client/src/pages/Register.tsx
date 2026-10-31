import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, UserPlus, Mail, Lock, User, Hash, GraduationCap, Calendar, Phone, AlertCircle, ArrowLeft } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { Input, Select } from '../components/ui/Input.js';
import { Button } from '../components/ui/Button.js';
import { Alert } from '../components/ui/Alert.js';
import { Badge } from '../components/ui/Badge.js';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    fullName: '',
    studentIdNumber: '',
    department: 'Computer Science & Engineering',
    batchYear: '2024',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: ''
  });

  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const departments = [
    { value: 'Computer Science & Engineering', label: 'Computer Science & Engineering' },
    { value: 'Electrical & Electronic Engineering', label: 'Electrical & Electronic Engineering' },
    { value: 'Business Administration', label: 'Business Administration' },
    { value: 'Civil Engineering', label: 'Civil Engineering' },
    { value: 'Mechanical Engineering', label: 'Mechanical Engineering' },
    { value: 'English & Humanities', label: 'English & Humanities' }
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIssues([]);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/auth/register', {
        email: formData.email,
        password: formData.password,
        full_name: formData.fullName,
        student_id_number: formData.studentIdNumber,
        department: formData.department,
        batch_year: parseInt(formData.batchYear, 10),
        phone_number: formData.phoneNumber || undefined
      });

      // Auto login upon successful registration
      await login(formData.email, formData.password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      if (err.issues && Array.isArray(err.issues)) {
        setIssues(err.issues);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[90vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-xl w-full bg-white p-8 sm:p-10 rounded-2xl shadow-card border border-slate-200/90 space-y-7">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <img
              src="/images/campusconnect_logo.jpg"
              alt="CampusConnect Crest"
              className="w-16 h-16 rounded-2xl shadow-md ring-2 ring-blue-900/10 object-cover"
            />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Create Student Account</h1>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            Join chartered university societies, reserve seats with ACID concurrency, and earn verified credentials.
          </p>
        </div>

        {error && (
          <Alert variant="error" title={error}>
            {issues.length > 0 && (
              <ul className="list-disc list-inside text-xs space-y-0.5 pt-1">
                {issues.map((iss, i) => (
                  <li key={i}>{iss}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Legal Name"
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="e.g. Fahim Hossain"
              required
              leftIcon={<User className="w-4 h-4" />}
            />

            <Input
              label="Student ID Number"
              type="text"
              name="studentIdNumber"
              value={formData.studentIdNumber}
              onChange={handleChange}
              placeholder="e.g. 0432320005101007"
              required
              leftIcon={<Hash className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Academic Department"
              name="department"
              value={formData.department}
              onChange={handleChange}
              options={departments}
            />

            <Input
              label="Batch Year"
              type="number"
              name="batchYear"
              value={formData.batchYear}
              onChange={handleChange}
              min="2015"
              max="2035"
              required
              leftIcon={<Calendar className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Institutional Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="name@university.edu"
              required
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Phone Number (Optional)"
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="+8801700000000"
              leftIcon={<Phone className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Min 8 chars, 1 upper, 1 special"
              required
              leftIcon={<Lock className="w-4 h-4" />}
            />

            <Input
              label="Confirm Password"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Repeat password"
              required
              leftIcon={<Lock className="w-4 h-4" />}
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 space-y-1">
            <span className="font-semibold text-slate-700 block">Security Password Policy:</span>
            <span>Must contain at least 8 characters, one uppercase letter, one lowercase letter, one numeric digit, and one special symbol.</span>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full py-2.5 rounded-xl shadow-md"
              isLoading={submitting}
              leftIcon={<UserPlus className="w-4 h-4" />}
            >
              Complete Student Registration
            </Button>
          </div>
        </form>

        <div className="text-center pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Already registered on CampusConnect?{' '}
            <Link to="/login" className="font-bold text-blue-900 hover:text-blue-700 hover:underline">
              Sign In here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
