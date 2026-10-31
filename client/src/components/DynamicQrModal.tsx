import React, { useState, useEffect, useRef } from 'react';
import { QrCode, RefreshCw, X, ShieldAlert, CheckCircle2, Copy, Check } from 'lucide-react';
import { api } from '../services/api.js';
import type { LiveQrResponse } from '../services/responses.js';
import { Button } from './ui/Button.js';
import { Badge } from './ui/Badge.js';
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
  const [timeLeft, setTimeLeft] = useState<number>(20);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const expiresAtRef = useRef<number>(Date.now() + 20000);
  const loadingRef = useRef<boolean>(false);

  const fetchToken = async () => {
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<LiveQrResponse>(`/events/${eventId}/attendance/live-qr`);
      setQrDataUrl(res.qr_data_url);
      setToken(res.token);
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
      <div className="bg-white rounded-2xl shadow-modal max-w-md w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-900 flex items-center justify-center text-blue-200">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 id="qr-modal-title" className="font-bold text-sm tracking-tight text-white">Dynamic Attendance Scanner</h2>
              <p className="text-[10px] text-slate-400 font-mono">20-Second Rotating Token</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
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

              {/* Manual Token Display (fallback for students with camera issues) */}
              {token && (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono">
                  <div className="text-left">
                    <span className="text-[10px] text-slate-400 font-sans uppercase font-bold block">Manual Check-In Code</span>
                    <span className="font-bold text-slate-800">{token}</span>
                  </div>
                  <button
                    onClick={handleCopyToken}
                    className="inline-flex items-center gap-1 text-[11px] font-sans font-semibold text-blue-900 hover:text-blue-950 px-2 py-1 rounded bg-white border border-slate-200 shadow-sm"
                  >
                    {copiedToken ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Security Banner */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-left flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
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
