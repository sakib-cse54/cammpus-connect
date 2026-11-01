import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ShieldCheck, Award, CheckCircle2, XCircle, Search, 
  Download, Calendar, Building, User, Hash, Lock, 
  ExternalLink, ArrowLeft, Copy, Check
} from 'lucide-react';
import { api } from '../services/api.js';
import { Badge } from '../components/ui/Badge.js';
import { Button, buttonClasses } from '../components/ui/Button.js';
import { Alert } from '../components/ui/Alert.js';
import { formatDate, copyToClipboard } from '../lib/utils.js';
import { downloadFromApi } from '../lib/download.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../components/ui/Toast.js';

export const PublicVerify: React.FC = () => {
  const { serialNumber: urlSerial } = useParams<{ serialNumber?: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const [serialInput, setSerialInput] = useState(urlSerial || '');
  const [certData, setCertData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  const performVerification = async (serial: string) => {
    if (!serial.trim()) return;
    try {
      setLoading(true);
      setError(null);
      setSearched(true);
      const res = await api.get(`/certificates/verify/${encodeURIComponent(serial.trim())}`);
      setCertData(res);
    } catch (err: any) {
      setCertData(null);
      setError(err.message || 'Certificate verification failed: Record not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (urlSerial) {
      setSerialInput(urlSerial);
      performVerification(urlSerial);
    }
  }, [urlSerial]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performVerification(serialInput);
  };

  const handleCopyHash = async () => {
    if (!certData?.sha256_hash) return;
    const success = await copyToClipboard(certData.sha256_hash);
    if (success) {
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-10 pb-24">
      {/* Navigation Switcher between Certificate and Transcript Verification */}
      <div className="flex justify-center">
        <div className="inline-flex items-center p-1 bg-slate-100 rounded-full border border-slate-200 text-xs font-semibold">
          <span className="px-4 py-1.5 rounded-full bg-white text-blue-900 shadow-sm border border-slate-200">
            Verify Certificate
          </span>
          <Link
            to="/transcripts/verify"
            className="px-4 py-1.5 rounded-full text-slate-600 hover:text-slate-900 transition-colors"
          >
            Verify Co-Curricular Transcript
          </Link>
        </div>
      </div>

      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <img
            src="/images/cert_tamperproof_seal.jpg"
            alt="Cryptographic Certification Seal"
            className="w-20 h-20 rounded-2xl shadow-xl ring-2 ring-blue-900/20 object-cover"
          />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Verify a certificate
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
            Enter the serial number printed on a CampusConnect certificate to confirm it is genuine.
          </p>
        </div>
      </div>

      {/* Verification Query Search Box */}
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto flex gap-2">
        <div className="relative flex-1">
          <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            required
            aria-label="Certificate Serial Number"
            value={serialInput}
            onChange={(e) => setSerialInput(e.target.value)}
            placeholder="Enter Serial Number (e.g. CERT-2026-XXXXXX)"
            className="w-full h-12 pl-10 pr-4 bg-white border border-slate-300 rounded-full text-sm font-mono focus:outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100 transition placeholder:text-slate-400"
          />
        </div>
        <Button
          type="submit"
          isLoading={loading}
          disabled={!serialInput.trim()}
          leftIcon={<Search className="w-4 h-4" />}
          size="lg"
        >
          Verify
        </Button>
      </form>

      {/* Verification Dossier Result */}
      {searched && (
        <div className="max-w-2xl mx-auto">
          {error && (
            <div className="bg-white rounded-2xl border border-rose-200 p-8 shadow-card text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <XCircle className="w-7 h-7" />
              </div>
              <h2 className="text-base font-bold text-rose-950">Unverified or Revoked Credential</h2>
              <p className="text-xs text-rose-700 max-w-md mx-auto leading-relaxed">
                No active certificate matching serial "{serialInput}" was found in the tamper-proof ledger. Verify the serial number format and try again.
              </p>
            </div>
          )}

          {certData && certData.valid && (
            <div className="bg-white rounded-2xl border-2 border-emerald-500 p-6 sm:p-10 shadow-elevation space-y-7 relative overflow-hidden">
              {/* Authenticity Watermark Tag */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-3">
                <div className="flex items-center gap-3.5 text-emerald-800">
                  <img
                    src="/images/cert_tamperproof_seal.jpg"
                    alt="Verified Seal"
                    className="w-14 h-14 rounded-xl object-cover shadow-md ring-2 ring-emerald-400 shrink-0"
                  />
                  <div>
                    <h2 className="text-sm font-bold text-emerald-950">
                      Verified Authentic Credential
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Issuing Authority: {certData.verification_authority}
                    </p>
                  </div>
                </div>

                {user && (
                  <Button
                    size="sm"
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                    onClick={() => downloadFromApi(`/certificates/download/${certData.serial_number}`, `${certData.serial_number}.pdf`).catch((err: Error) => toast.error(err.message || 'Download failed'))}
                  >
                    Download PDF
                  </Button>
                )}
              </div>

              {/* Certificate Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                <div className="space-y-1">
                  <span className="font-semibold text-slate-400 text-[11px] tracking-wider">Recipient Legal Name</span>
                  <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-blue-800 shrink-0" />
                    <span>{certData.recipient_name}</span>
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="font-semibold text-slate-400 text-[11px] tracking-wider">Student ID Number</span>
                  <p className="text-sm font-mono font-bold text-slate-900">
                    {certData.student_id_number || 'N/A'}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="font-semibold text-slate-400 text-[11px] tracking-wider">Academic Department</span>
                  <p className="text-xs font-semibold text-slate-700">
                    {certData.student_department || 'General'}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="font-semibold text-slate-400 text-[11px] tracking-wider">Issuance Date</span>
                  <p className="text-xs font-semibold text-slate-700">
                    {formatDate(certData.issued_at, { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                <div className="sm:col-span-2 space-y-1 pt-3 border-t border-slate-100">
                  <span className="font-semibold text-slate-400 text-[11px] tracking-wider">Event Title</span>
                  <p className="text-sm font-bold text-slate-900">
                    {certData.event_title}
                  </p>
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <span className="font-semibold text-slate-400 text-[11px] tracking-wider">Chartered University Club</span>
                  <p className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-blue-700 shrink-0" />
                    <span>{certData.club_name}</span>
                  </p>
                </div>
              </div>

              {/* Cryptographic SHA-256 Hash Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <Lock className="w-3.5 h-3.5 text-blue-900" />
                    <span>SHA-256 Digital Fingerprint</span>
                  </span>
                  <button
                    onClick={handleCopyHash}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-800 hover:text-blue-950 transition"
                  >
                    {copiedHash ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Fingerprint</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="break-all text-slate-800 font-semibold text-xs bg-white p-2.5 rounded-lg border border-slate-200 select-all">
                  {certData.sha256_hash}
                </p>
                <div className="flex items-center gap-1.5 text-emerald-700 font-sans font-semibold text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tamper-Proof Ledger Match Verified</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Return to home link */}
      <div className="text-center pt-4">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition">
          <ArrowLeft className="w-3.5 h-3.5" /> Return to CampusConnect Homepage
        </Link>
      </div>
    </div>
  );
};
