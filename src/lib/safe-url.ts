/** Safe same-origin relative redirect path only (client + server safe). */
export function safeCallbackPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('\\') || value.includes('\n') || value.includes('\r')) {
    return null;
  }
  try {
    const u = new URL(value, 'https://gocinema.am');
    if (u.origin !== 'https://gocinema.am') return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}
