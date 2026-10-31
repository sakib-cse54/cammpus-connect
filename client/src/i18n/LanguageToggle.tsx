import React from 'react';
import { Languages } from 'lucide-react';
import { useI18n } from './I18nProvider.js';
import { cn } from '../lib/utils.js';

/** EN | বাংলা switch; persisted by the provider. */
export const LanguageToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { lang, setLang, t } = useI18n();
  const opt = (value: 'en' | 'bn', label: string) => (
    <button
      type="button"
      onClick={() => setLang(value)}
      aria-pressed={lang === value}
      lang={value}
      className={cn(
        'min-h-[44px] min-w-[44px] px-2.5 text-xs font-bold rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700',
        lang === value ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-100'
      )}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label={t('common.lang.label')} className={cn('inline-flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5', className)}>
      <Languages className="w-4 h-4 mx-1 text-slate-400 hidden sm:block" aria-hidden="true" />
      {opt('en', 'EN')}
      {opt('bn', 'বাংলা')}
    </div>
  );
};
