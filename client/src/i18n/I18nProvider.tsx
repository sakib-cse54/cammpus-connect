import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { formatDhaka, type DateInput } from '../lib/dateBd.js';
import { translate, formatNumber, type Lang, type TKey, type TParams } from './translate.js';

const STORAGE_KEY = 'campusconnect_lang';
const BN_FONT_ID = 'cc-bn-font';
const BN_FONT_HREF = 'https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700;800&display=swap';

export type TFunction = (key: TKey, params?: TParams) => string;

export type DateFormatter = (date: DateInput, opts?: Intl.DateTimeFormatOptions) => string;

interface I18nContextValue {
  lang: Lang;
  /** Asia/Dhaka date formatting in the active language. */
  formatDate: DateFormatter;
  /** Number with Bangla digits when lang is bn. */
  formatNum: (n: number) => string;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: TFunction;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function readStoredLang(): Lang {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'bn' ? 'bn' : 'en';
  } catch {
    return 'en';
  }
}

/** Loads the Bengali web fonts only once and only when Bangla is selected. */
function ensureBanglaFont(): void {
  if (document.getElementById(BN_FONT_ID)) return;
  const link = document.createElement('link');
  link.id = BN_FONT_ID;
  link.rel = 'stylesheet';
  link.href = BN_FONT_HREF;
  document.head.appendChild(link);
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    if (lang === 'bn') ensureBanglaFont();
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* preference simply is not remembered */
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggleLang = useCallback(() => setLangState((l) => (l === 'en' ? 'bn' : 'en')), []);
  const t = useCallback<TFunction>((key, params) => translate(lang, key, params), [lang]);

  const formatDate = useCallback<DateFormatter>((d, opts) => formatDhaka(d, lang, opts), [lang]);
  const formatNum = useCallback((n: number) => formatNumber(lang, n), [lang]);

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, t, formatDate, formatNum }),
    [lang, setLang, toggleLang, t, formatDate, formatNum]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
  return ctx;
}

/** Shorthand: const t = useT(); t('common.nav.events') */
export function useT(): TFunction {
  return useI18n().t;
}
