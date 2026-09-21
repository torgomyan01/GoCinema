import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminRole, isStaffRole } from '@/lib/roles';

export type SessionUser = {
  id: number;
  role?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

function parseUserId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const id = parseUserId(session?.user?.id);
  if (!id) return null;
  return {
    id,
    role: (session?.user as { role?: string | null } | undefined)?.role ?? null,
    name: session?.user?.name ?? null,
    email: session?.user?.email ?? null,
    phone: (session?.user as { phone?: string | null } | undefined)?.phone ?? null,
  };
}

/** Returns staff user or null */
export async function requireStaff(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || !isStaffRole(user.role)) return null;
  return user;
}

/** Returns admin user or null */
export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || !isAdminRole(user.role)) return null;
  return user;
}

/** Throws if not staff — for API routes */
export async function assertStaff(): Promise<SessionUser> {
  const user = await requireStaff();
  if (!user) {
    const err = new Error('UNAUTHORIZED');
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  return user;
}

/** Throws if not admin — for API routes */
export async function assertAdmin(): Promise<SessionUser> {
  const user = await requireAdmin();
  if (!user) {
    const err = new Error('UNAUTHORIZED');
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  return user;
}

export { safeCallbackPath } from '@/lib/safe-url';
