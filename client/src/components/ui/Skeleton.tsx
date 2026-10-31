import React from 'react';
import { cn } from '../../lib/utils.js';
import { useT } from '../../i18n/index.js';

/** Grey shimmering block; purely decorative. */
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div aria-hidden="true" className={cn('animate-pulse rounded-lg bg-slate-200/80', className)} />
);

/** Several text-like skeleton lines. */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ lines = 3, className }) => (
  <div aria-hidden="true" className={cn('space-y-2', className)}>
    {Array.from({ length: lines }, (_, i) => (
      <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
    ))}
  </div>
);

/** Card-shaped skeleton grid, used while lists of cards load. */
export const SkeletonCards: React.FC<{ count?: number; className?: string }> = ({ count = 3, className }) => {
  const t = useT();
  return (
    <div role="status" aria-live="polite" className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6', className)}>
      <span className="sr-only">{t('common.state.loading')}</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-5 w-3/4" />
          <SkeletonText lines={2} />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
};

/** Centered spinner with a label; used for route-level Suspense and auth checks. */
export const PageLoader: React.FC<{ label?: string; className?: string }> = ({ label, className }) => {
  const t = useT();
  return (
    <div role="status" aria-live="polite" className={cn('min-h-[50vh] flex flex-col items-center justify-center gap-3', className)}>
      <div aria-hidden="true" className="animate-spin rounded-full h-9 w-9 border-2 border-slate-200 border-b-blue-900" />
      <p className="text-xs font-semibold text-slate-500">{label ?? t('common.state.loading')}</p>
    </div>
  );
};
