import Link from 'next/link';
import { LoginForm } from '@/components/auth/LoginForm';
import { AccountMenu } from '@/components/auth/AccountMenu';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { isLocale } from '@/lib/i18n/config';
import { notFound } from 'next/navigation';
import formStyles from '@/components/auth/AuthForm.module.css';

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) {
    notFound();
  }
  const { returnTo } = await searchParams;
  const dict = getDictionary(localeParam);

  return (
    <div className={formStyles.page}>
      <header className={formStyles.header}>
        <div>
          <Link href={`/${localeParam}`} className={formStyles.subtle}>
            ← {dict.nav.back}
          </Link>
          <h1 className={formStyles.title}>{dict.auth.loginTitle}</h1>
        </div>
        <div>
          <AccountMenu />
          <LanguageSelector />
        </div>
      </header>
      <LoginForm returnTo={returnTo ?? null} />
      <p className={formStyles.linkRow}>
        <span>{dict.auth.noAccount}</span>
        <Link href={`/${localeParam}/register`}>{dict.auth.createAccount}</Link>
      </p>
    </div>
  );
}
