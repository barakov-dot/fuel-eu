'use client';

import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from 'react';
import type { Locale } from '@/lib/i18n/config';
import {
  getDictionary,
  type Dictionary,
} from '@/lib/i18n/dictionaries';

type I18nContextValue = {
  locale: Locale;
  dict: Dictionary;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const dict = getDictionary(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, dict }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

export function useDictionary(): Dictionary {
  return useI18n().dict;
}
