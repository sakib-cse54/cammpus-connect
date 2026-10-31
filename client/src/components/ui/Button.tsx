import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils.js';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'danger-outline' | 'success';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const baseStyles =
  'inline-flex items-center justify-center font-semibold rounded-full transition select-none whitespace-nowrap ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] ' +
  'disabled:opacity-50 disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none';

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-900 text-white hover:bg-blue-800 focus-visible:ring-blue-700',
  secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 focus-visible:ring-slate-400',
  outline: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 focus-visible:ring-blue-700',
  ghost: 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus-visible:ring-slate-400',
  danger: 'bg-rose-700 text-white hover:bg-rose-800 focus-visible:ring-rose-600',
  'danger-outline': 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 hover:border-rose-300 focus-visible:ring-rose-600',
  success: 'bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:ring-emerald-700'
};

// Fixed heights so buttons line up in rows: 32 / 36 / 44 / 48px
const sizeStyles: Record<ButtonSize, string> = {
  xs: 'text-xs h-8 px-3 gap-1.5 [&_svg]:w-3.5 [&_svg]:h-3.5',
  sm: 'text-xs h-9 px-4 gap-1.5 [&_svg]:w-4 [&_svg]:h-4',
  md: 'text-sm h-11 px-5 gap-2 [&_svg]:w-4 [&_svg]:h-4',
  lg: 'text-base h-12 px-6 gap-2.5 [&_svg]:w-5 [&_svg]:h-5'
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

/** Button look for non-button elements (router Links, download anchors). */
export const buttonClasses = ({ variant = 'primary', size = 'md', fullWidth = false, className }: ButtonStyleOptions = {}): string =>
  cn(baseStyles, variantStyles[variant], sizeStyles[size], fullWidth && 'w-full', className);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  className,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  type = 'button',
  ...props
}, ref) => (
  <button
    ref={ref}
    type={type}
    disabled={disabled || isLoading}
    aria-busy={isLoading || undefined}
    className={buttonClasses({ variant, size, fullWidth, className })}
    {...props}
  >
    {isLoading ? <Loader2 className="animate-spin shrink-0" aria-hidden="true" /> : leftIcon}
    {children}
    {!isLoading && rightIcon}
  </button>
));

Button.displayName = 'Button';
