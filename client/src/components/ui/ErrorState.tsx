import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button.js';
import { cn } from '../../lib/utils.js';
import { useT } from '../../i18n/index.js';
import { isApiError } from '../../services/api.js';

export interface ErrorStateProps {
  /** The caught error (ApiError adds a request id) or a message. */
  error?: unknown;
  title?: string;
  onRetry?: () => void;
  className?: string;
}

/** Inline error block with optional retry and the server request id for bug reports. */
export const ErrorState: React.FC<ErrorStateProps> = ({ error, title, onRetry, className }) => {
  const t = useT();
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : t('common.state.errorBody');
  const requestId = isApiError(error) ? error.requestId : null;
  return (
    <div role="alert" className={cn('rounded-xl border border-rose-200 bg-rose-50/60 p-6 text-center space-y-3', className)}>
      <AlertTriangle className="w-7 h-7 text-rose-600 mx-auto" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-bold text-slate-900">{title ?? t('common.state.errorTitle')}</p>
        <p className="text-xs text-slate-600">{message}</p>
        {requestId && <p className="text-xs font-mono text-slate-500">{t('common.state.requestId', { id: requestId })}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} leftIcon={<RefreshCw className="w-3.5 h-3.5" />} className="min-h-[44px]">
          {t('common.action.retry')}
        </Button>
      )}
    </div>
  );
};
