import type { NextRequest } from 'next/server';

/** Production/public site origin — env-ից, fallback request origin-ին */
export function getPublicAppOrigin(request?: NextRequest): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';
  if (fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, '');
  }

  if (request) {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  }

  return '';
}

export function buildPublicAppUrl(
  path: string,
  request?: NextRequest
): URL {
  const origin = getPublicAppOrigin(request);
  if (!origin) {
    throw new Error('APP URL կարգավորումը բացակայում է (.env)');
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, `${origin}/`);
}
