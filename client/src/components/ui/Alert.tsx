import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils.js';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  onDismiss?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  className,
  variant = 'info',
  title,
  onDismiss,
  children,
  ...props
}) => {
  const variantStyles = {
    info: 'bg-blue-50/80 border-blue-200 text-blue-900',
    success: 'bg-emerald-50/80 border-emerald-200 text-emerald-900',
    warning: 'bg-amber-50/80 border-amber-200 text-amber-900',
    error: 'bg-rose-50/80 border-rose-200 text-rose-900'
  };

  const iconStyles = {
    info: <Info className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />,
    success: <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />,
    error: <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
  };

  return (
    <div
      role="alert" aria-live="assertive"
      className={cn(
        'p-4 rounded-xl border flex items-start gap-3.5 text-xs sm:text-sm leading-relaxed transition-all shadow-subtle',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {iconStyles[variant]}
      <div className="flex-1 space-y-1">
        {title && <h4 className="font-bold tracking-tight">{title}</h4>}
        <div>{children}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="w-8 h-8 -mr-1.5 -mt-1.5 shrink-0 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
