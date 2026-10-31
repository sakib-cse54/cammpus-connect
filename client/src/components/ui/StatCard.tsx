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
        'bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between gap-4 transition-all hover:shadow-md hover:border-slate-300',
        className
      )}
      {...props}
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-600 tracking-tight">{title}</p>
        <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">{value}</p>
        {subtitle && (
          <p className="text-[11px] text-slate-500">{subtitle}</p>
        )}
      </div>
      {icon && (
        <div
          className={cn(
            'w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 shadow-inner',
            iconVariants[variant]
          )}
        >
          {icon}
        </div>
      )}
    </div>
  );
};
