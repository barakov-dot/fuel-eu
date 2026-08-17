'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useDictionary, useLocale } from '@/components/i18n/I18nProvider';
import { locales, type Locale } from '@/lib/i18n/config';
import styles from './LanguageSelector.module.css';

function buildLocaleHref(
  pathname: string,
  searchParams: URLSearchParams,
  nextLocale: Locale,
): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return `/${nextLocale}`;
  }

  if (locales.includes(segments[0] as Locale)) {
    segments[0] = nextLocale;
  } else {
    segments.unshift(nextLocale);
  }

  const query = searchParams.toString();
  const path = `/${segments.join('/')}`;
  return query ? `${path}?${query}` : path;
}

export function LanguageSelector() {
  const dict = useDictionary();
  const locale = useLocale();
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();

  return (
    <div className={styles.wrapper} aria-label={dict.language.label}>
      {locales.map((item) => (
        <Link
          key={item}
          href={buildLocaleHref(pathname, searchParams, item)}
          className={item === locale ? styles.active : styles.link}
          aria-current={item === locale ? 'true' : undefined}
        >
          {dict.language[item]}
        </Link>
      ))}
    </div>
  );
}
