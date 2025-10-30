'use client';

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { DEFAULT_LOCALE, Dictionary, Locale, getDictionary, resolveLocale } from '@/lib/i18n/dictionaries';

type LocaleContextValue = {
  locale: Locale;
  dictionary: Dictionary;
  setLocale: (nextLocale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

type LocaleProviderProps = {
  initialLocale?: string | null;
  children: ReactNode;
};

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export function LocaleProvider({ initialLocale, children }: LocaleProviderProps) {
  const resolvedInitial = resolveLocale(initialLocale);
  const [locale, setLocaleState] = useState<Locale>(resolvedInitial);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
    if (typeof document !== 'undefined') {
      document.cookie = `locale=${locale}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}`;
    }
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => {
    const dictionary = getDictionary(locale);
    const setLocale = (nextLocale: Locale) => {
      setLocaleState(resolveLocale(nextLocale));
    };
    return { locale, dictionary, setLocale };
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}
