'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDictionary, useLocale } from '@/components/i18n/I18nProvider';
import styles from './AccountMenu.module.css';

export function AccountMenu() {
  const dict = useDictionary();
  const locale = useLocale();
  const { state } = useAuth();

  if (state.status === 'loading') {
    return <span className={styles.loading}>{dict.auth.loading}</span>;
  }

  if (state.status === 'anonymous') {
    return (
      <Link href={`/${locale}/login`} className={styles.link}>
        {dict.auth.signIn}
      </Link>
    );
  }

  const label = state.user.displayName ?? state.user.email;

  return (
    <div className={styles.menu}>
      <Link href={`/${locale}/account`} className={styles.link}>
        {label}
      </Link>
    </div>
  );
}
