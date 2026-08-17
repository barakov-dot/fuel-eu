import { notFound } from 'next/navigation';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionaries';

export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ru' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  const locale = isLocale(localeParam) ? localeParam : 'en';
  const dict = getDictionary(locale);

  return {
    title: dict.app.title,
    description: dict.app.description,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) {
    notFound();
  }

  return (
    <I18nProvider locale={localeParam as Locale}>
      <AuthProvider>{children}</AuthProvider>
    </I18nProvider>
  );
}
