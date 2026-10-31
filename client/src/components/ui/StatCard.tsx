import React from 'react';
import { cn } from '../../lib/utils.js';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'info' | 'neutral';
}

export const StatCard: React.FC<StatCardProps> = ({
  className,
  title,
  value,
  subtitle,
  icon,
  variant = 'neutral',
  ...props
}) => {
  const iconVariants = {
    primary: 'bg-blue-50 text-blue-900 border-blue-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    info: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-slate-200 p-5 shadow-card flex items-center justify-between gap-4 min-w-0',
        className
      )}
      {...props}
    >
      <div className="space-y-1 min-w-0">
        <p className="text-xs font-semibold text-slate-600 truncate">{title}</p>
        <p
          className={cn(
            'font-display font-bold text-slate-900 tracking-tight tabular-nums break-words',
            typeof value === 'string' && value.length > 8 ? 'text-lg leading-snug' : 'text-2xl sm:text-3xl'
          )}
        >
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-slate-500">{subtitle}</p>
        )}
      </div>
      {icon && (
        <div
          className={cn(
            'w-12 h-12 rounded-full border flex items-center justify-center shrink-0',
            iconVariants[variant]
          )}
        >
          {icon}
        </div>
      )}
    </div>
  );
};
