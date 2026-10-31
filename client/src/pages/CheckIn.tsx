import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  CheckCircle2, QrCode, MapPin, Calendar, Building, 
  AlertCircle, ArrowRight, ShieldCheck, RefreshCw, KeyRound, Clock
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { EventItem } from '../types.js';
import { EventResponse, MessageResponse } from '../services/responses.js';
import { checkInPayload } from '../lib/checkIn.js';
import { Button, buttonClasses } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Alert } from '../components/ui/Alert.js';
import { useToast } from '../components/ui/Toast.js';
import { formatDateTime } from '../lib/utils.js';

interface CheckInSuccess {
  message: string;
  attendance_id?: string;
  flags?: string[];
  distance_m?: number;
}

export const CheckIn: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('t') || '';
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<CheckInSuccess | null>(null);

  // Input for token or 6-digit short code
  const [codeInput, setCodeInput] = useState(tokenFromUrl);

  useEffect(() => {
    if (!eventId) return;
    const fetchEvent = async () => {
      try {
        setLoadingEvent(true);
        const res = await api.get<EventResponse>(`/events/${eventId}`);
        setEvent(res.event);
      } catch (err: any) {
        setError(err.message || 'Unable to load event details.');
      } finally {
        setLoadingEvent(false);
      }
    };
    fetchEvent();
  }, [eventId]);

  const handleScanSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!eventId) return;

    const trimmed = codeInput.trim();
    if (!trimmed) {
      toast.warning('Please provide a rotating token or 6-digit short code.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Optional Geolocation capture
      let geoCoords: { lat?: number; lng?: number; accuracy?: number } = {};
      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 4000,
              maximumAge: 10000,
              enableHighAccuracy: false
            });
          });
          geoCoords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy)
          };
        } catch {
          // Geolocation optional: proceed without coordinates if denied or timed out
        }
      }

      const payload = {
        ...checkInPayload(trimmed),
        ...geoCoords
      };

      const res = await api.post<CheckInSuccess>(`/events/${eventId}/attendance/scan`, payload);
      setSuccessData(res);
      toast.success(res.message || 'Attendance verified and recorded.');
    } catch (err: any) {
      const msg = err.message || 'Check-in failed. Please verify the code and retry.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const returnTarget = encodeURIComponent(`/checkin/${eventId}${tokenFromUrl ? `?t=${tokenFromUrl}` : ''}`);

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-12 space-y-6">
      {/* Platform Branding Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-900 text-white shadow-md mb-1">
          <QrCode className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Session Check-In
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Anti-Proxy Dynamic Attendance Verification
        </p>
      </div>

      {/* Event Details Preview Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-subtle space-y-4">
        {loadingEvent ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-900" />
            <span className="text-xs">Loading event information...</span>
          </div>
        ) : event ? (
          <>
            <div className="space-y-1">
              <Badge color="primary" size="sm">
                {event.club_name}
              </Badge>
              <h2 className="text-lg font-bold text-slate-900 leading-snug">
                {event.title}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{formatDateTime(event.start_time)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{event.venue}</span>
              </div>
            </div>
          </>
        ) : (
          <Alert variant="error" title="Event Not Found">
            The requested event could not be found or has not been published yet.
          </Alert>
        )}
      </div>

      {/* Success State */}
      {successData && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-4 animate-in fade-in">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-emerald-950">Attendance Confirmed</h3>
            <p className="text-xs sm:text-sm text-emerald-800">
              {successData.message}
            </p>
            {successData.flags && successData.flags.length > 0 && (
              <div className="pt-2">
                <Badge color="warning" size="sm">
                  Flag: {successData.flags.join(', ')}
                </Badge>
              </div>
            )}
          </div>

          <div className="pt-3 flex flex-col sm:flex-row gap-2 justify-center">
            <Link to="/student" className={buttonClasses({ size: 'sm', className: 'text-xs' })}>
              View My Passes & Transcript
            </Link>
            {eventId && (
              <Link to={`/events/${eventId}`} className={buttonClasses({ variant: 'outline', size: 'sm', className: 'text-xs' })}>
                Back to Event Details
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Main Check-In Form or Login Gateway */}
      {!successData && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-subtle space-y-5">
          {!user ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-900 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-base font-bold text-slate-900">Sign In Required</h3>
                <p className="text-xs text-slate-500">
                  Please sign in with your university account to verify attendance for this session.
                </p>
              </div>
              <Link
                to={`/login?returnUrl=${returnTarget}`}
                className={buttonClasses({ fullWidth: true, className: 'justify-center text-sm' })}
              >
                Sign In to Check In
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleScanSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Verification Code or Short Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    placeholder="Enter rotating token or 6-digit short code"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Tokens rotate every 20s. You may also type the 6-digit code shown on the screen.
                </p>
              </div>

              {error && (
                <Alert variant="error" title="Check-In Error">
                  {error}
                </Alert>
              )}

              <Button
                type="submit"
                fullWidth
                isLoading={submitting}
                disabled={submitting || !codeInput.trim()}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                Confirm Attendance
              </Button>
            </form>
          )}
        </div>
      )}

      {/* Security Notice */}
      <div className="text-center text-xs text-slate-400 space-y-1">
        <p className="flex items-center justify-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          Attendance window: 30 minutes prior to start time through event conclusion.
        </p>
        <p>Tamper-proof HMAC verification with automated proxy detection.</p>
      </div>
    </div>
  );
};
