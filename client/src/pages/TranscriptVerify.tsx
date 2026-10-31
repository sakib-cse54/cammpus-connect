import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ShieldCheck, Award, CheckCircle2, XCircle, Search, 
  GraduationCap, Hash, Lock, ExternalLink, ArrowLeft, Copy, Check, Calendar, BookOpen
} from 'lucide-react';
import { api } from '../services/api.js';
import { TranscriptVerification } from '../types.js';
import { Badge } from '../components/ui/Badge.js';
import { Button, buttonClasses } from '../components/ui/Button.js';
import { Alert } from '../components/ui/Alert.js';
import { formatDate, copyToClipboard } from '../lib/utils.js';

const PO_TITLES: Record<string, string> = {
  PO1: 'Engineering Knowledge',
  PO2: 'Problem Analysis',
  PO3: 'Design & Development of Solutions',
  PO4: 'Investigation',
  PO5: 'Modern Tool Usage',
  PO6: 'The Engineer and Society',
  PO7: 'Environment & Sustainability',
  PO8: 'Ethics',
  PO9: 'Individual & Team Work',
  PO10: 'Communication',
  PO11: 'Project Management & Finance',
  PO12: 'Life-Long Learning'
};

export const TranscriptVerify: React.FC = () => {
  const { id: urlId } = useParams<{ id?: string }>();

  const [idInput, setIdInput] = useState(urlId || '');
  const [data, setData] = useState<TranscriptVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedJws, setCopiedJws] = useState(false);

  const performVerification = async (transcriptId: string) => {
    const trimmed = transcriptId.trim();
    if (!trimmed) return;

    try {
      setLoading(true);
      setError(null);
      setSearched(true);
      const res = await api.get<TranscriptVerification>(`/transcripts/verify/${encodeURIComponent(trimmed)}`);
      setData(res);
    } catch (err: any) {
      setData(null);
      setError(err.message || 'Transcript verification failed: Record not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (urlId) {
      setIdInput(urlId);
      performVerification(urlId);
    }
  }, [urlId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performVerification(idInput);
  };

  const handleCopyJws = async () => {
    if (!data?.jws) return;
    const success = await copyToClipboard(data.jws);
    if (success) {
      setCopiedJws(true);
      setTimeout(() => setCopiedJws(false), 2000);
    }
  };

  const getLevelBadgeColor = (level: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
    switch (level) {
      case 'EXEMPLARY':
        return 'success';
      case 'PROFICIENT':
        return 'primary';
      case 'DEVELOPING':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-10 pb-24">
      {/* Navigation Switcher between Certificate and Transcript Verification */}
      <div className="flex justify-center">
        <div className="inline-flex items-center p-1 bg-slate-100 rounded-full border border-slate-200 text-xs font-semibold">
          <Link
            to="/verify"
            className="px-4 py-1.5 rounded-full text-slate-600 hover:text-slate-900 transition-colors"
          >
            Verify Certificate
          </Link>
          <span className="px-4 py-1.5 rounded-full bg-white text-blue-900 shadow-sm border border-slate-200">
            Verify Co-Curricular Transcript
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-lg ring-4 ring-blue-900/10">
            <GraduationCap className="w-8 h-8 text-emerald-300" />
          </div>
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Verify Co-Curricular Transcript
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
            Validate institutional Outcome-Based Education (OBE) transcripts against the university Ed25519 cryptographic trust ledger.
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
            aria-label="Transcript Identifier"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            placeholder="Enter Transcript ID (e.g. TR-XXXXXXXXXXXXXXXXXXXX)"
            className="w-full h-12 pl-10 pr-4 bg-white border border-slate-300 rounded-full text-sm font-mono focus:outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100 transition placeholder:text-slate-400"
          />
        </div>
        <Button
          type="submit"
          isLoading={loading}
          disabled={!idInput.trim()}
          leftIcon={<Search className="w-4 h-4" />}
          className="h-12 px-6 rounded-full shrink-0"
        >
          Verify
        </Button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="max-w-xl mx-auto">
          <Alert variant="error" title="Verification Unsuccessful">
            {error}
          </Alert>
        </div>
      )}

      {/* Transcript Record Display */}
      {data && (
        <div className="bg-white rounded-3xl border-2 border-slate-200/90 shadow-card overflow-hidden transition-all duration-300 animate-in fade-in">
          {/* Status Header Strip */}
          <div className={`px-6 sm:px-8 py-5 border-b flex flex-wrap items-center justify-between gap-4 ${
            data.valid ? 'bg-emerald-50/70 border-emerald-200' : 'bg-rose-50 border-rose-200'
          }`}>
            <div className="flex items-center gap-3">
              {data.valid ? (
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center">
                  <XCircle className="w-6 h-6" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">
                    {data.valid ? 'Authentic Institutional Transcript' : 'Invalid Transcript Record'}
                  </h3>
                  <Badge color={data.valid ? 'success' : 'danger'} size="sm">
                    {data.valid ? 'CRYPTOGRAPHICALLY VALID' : 'TAMPERED / REVOKED'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  {data.signature_valid ? 'Verified with EdDSA (Ed25519) digital signature.' : 'Signature check pending or unsigned.'}
                </p>
              </div>
            </div>

            <div className="text-right text-xs font-mono text-slate-500">
              ID: <span className="font-bold text-slate-800">{data.transcript.tid}</span>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {/* Student & Accreditation Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-200/80">
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Student Credential Holder
                </span>
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-slate-900">{data.transcript.name}</h2>
                  <p className="text-xs text-slate-600 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                    {data.transcript.department}
                  </p>
                  <p className="text-xs font-mono text-slate-500">
                    Student ID: {data.transcript.sub}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Accreditation Standard
                </span>
                <div className="space-y-1 text-xs text-slate-600">
                  <p className="font-semibold text-slate-800">
                    Framework: {data.transcript.framework} (BAETE Graduate Attributes)
                  </p>
                  <p>Verified Activities: {data.transcript.activity_count} co-curricular records</p>
                  <p className="flex items-center gap-1 text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    Issued: {formatDate(data.transcript.issued_at)}
                  </p>
                </div>
              </div>
            </div>

            {/* BAETE Program Outcomes Attainment Matrix */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Program Outcomes (PO1 to PO12) Attainment</h4>
                  <p className="text-xs text-slate-500">Verified attainment points and assessed competency levels</p>
                </div>
                <Badge color="primary" size="sm">
                  BAETE Compliant
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.transcript.attainment.map((item) => (
                  <div
                    key={item.code}
                    className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-xs text-slate-900">
                        {item.code}: {PO_TITLES[item.code] || item.code}
                      </div>
                      <Badge color={getLevelBadgeColor(item.level)} size="sm">
                        {item.level.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                      <span>Attainment Score:</span>
                      <span className="font-mono font-bold text-slate-800">{item.points} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cryptographic Signature Ledger Proof */}
            {data.jws && (
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-blue-900" />
                    Signed JSON Web Signature (JWS)
                  </span>
                  <button
                    onClick={handleCopyJws}
                    className={buttonClasses({ variant: 'ghost', size: 'xs', className: 'text-xs' })}
                  >
                    {copiedJws ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600 mr-1" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" />
                        <span>Copy JWS</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl break-all max-h-24 overflow-y-auto select-all leading-relaxed">
                  {data.jws}
                </div>
                <p className="text-[11px] text-slate-400">
                  This signature can be independently verified against the institution's public JWKS endpoint at <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">/.well-known/jwks.json</code>.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Return to Catalog Footer */}
      <div className="text-center">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to CampusConnect Events
        </Link>
      </div>
    </div>
  );
};
