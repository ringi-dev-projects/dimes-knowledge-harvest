'use client';

import { useLocale } from '@/lib/context/LocaleContext';
import type { Locale } from '@/lib/i18n/dictionaries';

const OPTIONS: Array<{ value: Locale }> = [
  { value: 'ja' },
  { value: 'en' },
];

export function LanguageToggle() {
  const { locale, setLocale, dictionary } = useLocale();

  return (
    <div className="inline-flex items-center rounded-full border border-white/60 bg-white/80 p-1 text-xs font-semibold text-slate-600 backdrop-blur sm:text-sm">
      {OPTIONS.map((option) => {
        const label = dictionary.common.languageName[option.value];
        const isActive = option.value === locale;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setLocale(option.value)}
            className={[
              'rounded-full px-3 py-1.5 transition',
              isActive ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30' : 'hover:bg-indigo-50 hover:text-indigo-600',
            ].join(' ')}
            aria-pressed={isActive}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
