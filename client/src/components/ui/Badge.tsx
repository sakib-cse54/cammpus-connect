import React from 'react';
import { cn } from '../../lib/utils.js';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'subtle' | 'outline' | 'solid';
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  dot?: boolean;
  uppercase?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'subtle',
  color = 'primary',
  size = 'sm',
  dot = false,
  uppercase = false,
  children,
  ...props
}) => {
  const baseStyles = cn(
    'inline-flex items-center font-semibold rounded-full transition-colors',
    uppercase ? 'uppercase tracking-wide' : 'tracking-normal'
  );

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-0.5 gap-1.5',
    md: 'text-xs px-3 py-1 gap-1.5'
  };

  const colorStyles = {
    subtle: {
      primary: 'bg-blue-50 text-blue-900 border border-blue-200',
      success: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
      warning: 'bg-amber-50 text-amber-900 border border-amber-200',
      danger: 'bg-rose-50 text-rose-800 border border-rose-200',
      info: 'bg-indigo-50 text-indigo-900 border border-indigo-200',
      neutral: 'bg-slate-100 text-slate-700 border border-slate-200'
    },
    outline: {
      primary: 'border border-blue-800 text-blue-800 bg-transparent',
      success: 'border border-emerald-700 text-emerald-700 bg-transparent',
      warning: 'border border-amber-600 text-amber-700 bg-transparent',
      danger: 'border border-rose-600 text-rose-700 bg-transparent',
      info: 'border border-indigo-700 text-indigo-700 bg-transparent',
      neutral: 'border border-slate-300 text-slate-700 bg-transparent'
    },
    solid: {
      primary: 'bg-blue-900 text-white',
      success: 'bg-emerald-700 text-white',
      warning: 'bg-amber-600 text-white',
      danger: 'bg-rose-600 text-white',
      info: 'bg-indigo-700 text-white',
      neutral: 'bg-slate-700 text-white'
    }
  };

  const dotColors = {
    primary: 'bg-blue-800',
    success: 'bg-emerald-600',
    warning: 'bg-amber-600',
    danger: 'bg-rose-600',
    info: 'bg-indigo-600',
    neutral: 'bg-slate-500'
  };

  return (
    <span
      className={cn(baseStyles, sizeStyles[size], colorStyles[variant][color], className)}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[color])} />}
      <span>{children}</span>
    </span>
  );
};
