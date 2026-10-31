import React, { useState, useEffect, useRef } from 'react';
import { QrCode, RefreshCw, X, ShieldAlert, CheckCircle2, Copy, Check } from 'lucide-react';
import { api } from '../services/api.js';
import type { LiveQrResponse } from '../services/responses.js';
import { Button, buttonClasses } from './ui/Button.js';
import { Badge } from './ui/Badge.js';
import { useFocusTrap } from './ui/useFocusTrap.js';
import { copyToClipboard } from '../lib/utils.js';

interface DynamicQrModalProps {
  eventId: string;
  eventTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export const DynamicQrModal: React.FC<DynamicQrModalProps> = ({ eventId, eventTitle, isOpen, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string>('');
  const [shortCode, setShortCode] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(20);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const expiresAtRef = useRef<number>(Date.now() + 20000);
  const loadingRef = useRef<boolean>(false);
  const surfaceRef = useRef<HTMLDivElement>(null);

  useFocusTrap(surfaceRef, isOpen, onClose);

  const fetchToken = async () => {
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<LiveQrResponse>(`/events/${eventId}/attendance/live-qr`);
      setQrDataUrl(res.qr_data_url);
      setToken(res.token);
      setShortCode(res.short_code || '');
      const seconds = res.expires_in_seconds || 20;
      setTimeLeft(seconds);
      expiresAtRef.current = Date.now() + seconds * 1000;
    } catch (err: any) {
      setError(err.message || 'Failed to generate dynamic token');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchToken();
    }
  }, [isOpen, eventId]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      const remainingMs = expiresAtRef.current - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
      setTimeLeft(remainingSec);
      if (remainingSec <= 0 && !loadingRef.current) {
        fetchToken();
      }
    }, 500);

    return () => clearInterval(timer);
  }, [isOpen, eventId]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const progressPercent = Math.min(100, Math.max(0, ((20 - timeLeft) / 20) * 100));
  const progressColor =
    timeLeft <= 5 ? 'bg-rose-600' :
    timeLeft <= 10 ? 'bg-amber-500' :
    'bg-blue-800';

  const handleCopyToken = async () => {
    if (!token) return;
    const success = await copyToClipboard(token);
    if (success) {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
    >
      <div
        ref={surfaceRef}
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-modal max-w-md w-full overflow-hidden border border-slate-200 focus:outline-none"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-blue-900 text-white flex justify-between items-center border-b border-blue-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-800 flex items-center justify-center text-blue-200">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 id="qr-modal-title" className="font-bold text-sm tracking-tight text-white">Dynamic Attendance Scanner</h2>
              <p className="text-[11px] text-blue-200 font-mono">20-Second Rotating Token</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-blue-200 hover:text-white hover:bg-blue-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center space-y-4">
          <div className="space-y-1">
            <Badge color="primary" size="sm">
              Live Organizer Display
            </Badge>
            <h3 className="text-base font-bold text-slate-900 line-clamp-1">{eventTitle}</h3>
          </div>

          {loading && !qrDataUrl ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <RefreshCw className="w-8 h-8 text-blue-900 animate-spin" />
              <span className="text-xs text-slate-500 font-medium">Computing cryptographic attendance token...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {error}
            </div>
          ) : (
            <div className="space-y-4">
              {/* QR Image Container */}
              <div className="relative mx-auto w-64 h-64 bg-white p-3.5 rounded-2xl border-2 border-slate-200 shadow-elevation flex items-center justify-center">
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="Attendance QR Token" className="w-full h-full object-contain" />
                )}
              </div>

              {/* Countdown Progress Bar */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Rotating Token Active</span>
                  </span>
                  <span className={`font-mono font-bold ${timeLeft <= 5 ? 'text-rose-600 animate-pulse' : timeLeft <= 10 ? 'text-amber-600' : 'text-blue-900'}`}>
                    {timeLeft}s remaining
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className={`${progressColor} h-full transition-all duration-300 ease-linear rounded-full`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Projected 6-Digit Short Code for Auditorium Participants */}
              {shortCode && (
                <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md text-center space-y-1.5 border border-slate-800">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                      Projected 6-Digit Short Code
                    </span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-mono font-bold tracking-widest text-emerald-300 select-all">
                    {shortCode.slice(0, 3)} {shortCode.slice(3)}
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Type this 6-digit code on your mobile device if camera scanning is not working.
                  </p>
                </div>
              )}

              {/* Manual Token Display (fallback for students with camera issues) */}
              {token && (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono">
                  <div className="text-left">
                    <span className="text-[11px] text-slate-400 font-sans font-bold block">Manual Check-In Token</span>
                    <span className="font-bold text-slate-800 break-all">{token}</span>
                  </div>
                  <button
                    onClick={handleCopyToken}
                    className={buttonClasses({ variant: 'outline', size: 'xs', className: 'font-sans shrink-0 ml-2' })}
                  >
                    {copiedToken ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Security Banner */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-left flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-900 leading-relaxed font-medium">
                  <strong>Anti-Proxy Protection:</strong> Tokens expire every 20 seconds. Screenshots or forwarded images are automatically rejected by the server verification engine.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-between items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchToken}
            disabled={loading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Regenerate Token
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Close Display
          </Button>
        </div>
      </div>
    </div>
  );
};
