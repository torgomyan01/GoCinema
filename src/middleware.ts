import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow /account page
  if (pathname === '/account') {
    return NextResponse.next();
  }

  // For admin routes, check token manually
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    try {
      // Get session cookie
      const sessionCookie =
        request.cookies.get('next-auth.session-token') ||
        request.cookies.get('__Secure-next-auth.session-token');

      if (!sessionCookie?.value) {
        const signInUrl = new URL('/account', request.url);
        signInUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(signInUrl);
      }

      // Decode token manually
      const cookieName = sessionCookie.name || 'next-auth.session-token';

      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
        cookieName: cookieName,
      });

      if (token && (token as any)?.role === 'admin') {
        return NextResponse.next();
      }

      const signInUrl = new URL('/account', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    } catch (error) {
      const signInUrl = new URL('/account', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  // For other protected routes, check if token exists
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

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
