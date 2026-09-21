import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isStaffRole } from '@/lib/roles';

const SESSION_COOKIE =
  process.env.NODE_ENV === 'production'
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';

async function readAuthToken(request: NextRequest) {
  const named = request.cookies.get(SESSION_COOKIE);
  const legacy = request.cookies.get('next-auth.session-token');
  const secure = request.cookies.get('__Secure-next-auth.session-token');
  const sessionCookie = named || secure || legacy;

  if (!sessionCookie?.value) {
    return null;
  }

  return getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: sessionCookie.name,
  });
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow /account page (login + profile live here)
  if (pathname === '/account') {
    return NextResponse.next();
  }

  // Admin routes — staff only
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    try {
      const token = await readAuthToken(request);

      if (token && isStaffRole((token as { role?: string }).role)) {
        return NextResponse.next();
      }

      const signInUrl = new URL('/account', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    } catch {
      const signInUrl = new URL('/account', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  const token = await readAuthToken(request);

  if (!token) {
    const signInUrl = new URL('/account', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/account',
    '/account-menu',
    '/account/:path*',
    '/im/:path*',
    '/admin/:path*',
    '/admin',
  ],
};
