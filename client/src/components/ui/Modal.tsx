import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { useT } from '../../i18n/index.js';
import { useFocusTrap } from './useFocusTrap.js';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  /** Set false for dialogs that must not close on backdrop click (e.g. unsaved forms). */
  closeOnBackdrop?: boolean;
}

const sizeStyles = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

/** Accessible dialog: focus trap, Escape to close, focus restore, scroll lock. Full-screen sheet on phones. */
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, description, children, size = 'md', showCloseButton = true, closeOnBackdrop = true }) => {
  const t = useT();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  const descId = useId();

  useFocusTrap(surfaceRef, isOpen, () => onCloseRef.current());

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
      <div aria-hidden="true" onClick={closeOnBackdrop ? onClose : undefined} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full bg-white rounded-t-2xl sm:rounded-2xl shadow-modal border border-slate-200 overflow-hidden focus:outline-none',
          sizeStyles[size]
        )}
      >
        <div className="px-4 sm:px-6 py-3 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/60">
          <div className="pt-2">
            <h2 id={titleId} className="text-base font-bold text-slate-900 tracking-tight">{title}</h2>
            {description && <p id={descId} className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              aria-label={t('common.modal.close')}
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="p-4 sm:p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
