import { en, type Dictionary } from './locales/en/index.js';
import { bn } from './locales/bn/index.js';
import { toBanglaDigits } from '../lib/dateBd.js';

export type Lang = 'en' | 'bn';
export const LANGS: readonly Lang[] = ['en', 'bn'];

/** Every valid key, e.g. 'common.nav.events'. */
export type TKey = {
  [N in keyof Dictionary & string]: `${N}.${keyof Dictionary[N] & string}`;
}[keyof Dictionary & string];

export type TParams = Record<string, string | number>;

type Flat = Record<string, Record<string, string>>;
const dictionaries: Record<Lang, Flat> = { en: en as unknown as Flat, bn: bn as unknown as Flat };

function interpolate(lang: Lang, text: string, params?: TParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (!(k in params)) return m;
    const v = params[k];
    return typeof v === 'number' && lang === 'bn' ? toBanglaDigits(v) : String(v);
  });
}

/** Number in the active language's digits. */
export function formatNumber(lang: Lang, n: number): string {
  return lang === 'bn' ? toBanglaDigits(n) : String(n);
}

/** Pure translate: Bangla falls back to English, then to the key itself. */
export function translate(lang: Lang, key: TKey, params?: TParams): string {
  const dot = key.indexOf('.');
  const ns = key.slice(0, dot);
  const k = key.slice(dot + 1);
  const text = dictionaries[lang][ns]?.[k] ?? dictionaries.en[ns]?.[k] ?? key;
  return interpolate(lang, text, params);
}
