export const STAFF_ROLES = ['admin', 'moderator', 'employee'] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const ALL_ROLES = [
  'user',
  'admin',
  'moderator',
  'employee',
  'producer',
] as const;

export type AppRole = (typeof ALL_ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  user: 'Օգտատեր',
  admin: 'Ադմինիստրատոր',
  moderator: 'Մոդերատոր',
  employee: 'Աշխատակից',
  producer: 'Ֆիլմարտադրող',
};

/** Նորմալիզացնում է role-երի ցանկը՝ comma-separated string-ի */
export function serializeRoles(roles: string[]): string {
  const cleaned = Array.from(
    new Set(
      roles
        .map((r) => r.trim().toLowerCase())
        .filter((r) => (ALL_ROLES as readonly string[]).includes(r))
    )
  );
  return (cleaned.length ? cleaned : ['user']).join(',');
}

export function parseRoles(role?: string | null): string[] {
  if (!role) return ['user'];
  return role
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function hasRole(role: string | null | undefined, allowed: string[]) {
  const roles = parseRoles(role);
  return roles.some((item) => allowed.includes(item));
}

export function isStaffRole(role?: string | null) {
  return hasRole(role, [...STAFF_ROLES]);
}

export function isAdminRole(role?: string | null) {
  return hasRole(role, ['admin']);
}

export function isProducerRole(role?: string | null) {
  return hasRole(role, ['producer']);
}

