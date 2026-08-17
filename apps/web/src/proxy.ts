import { NextResponse, type NextRequest } from 'next/server';
import {
  isLocale,
  localeFromAcceptLanguage,
} from '@/lib/i18n/config';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/status' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];

  if (firstSegment && isLocale(firstSegment)) {
    return NextResponse.next();
  }

  const locale = localeFromAcceptLanguage(
    request.headers.get('accept-language'),
  );

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname =
    pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
