import { auth } from '@/auth';
import { getMyBonusSummary } from '@/app/actions/bonus';
import { hasRole } from '@/lib/roles';
import { SITE_URL } from '@/utils/consts';
import HeaderClient, {
  type HeaderBonusView,
  type HeaderNavItem,
  type HeaderUserView,
} from './header-client';

function userInitialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default async function Header() {
  const session = await auth();
  const sessionUser = session?.user as
    | { name?: string | null; role?: string }
    | undefined;

  const isLoggedIn = Boolean(session?.user);
  const userName = sessionUser?.name?.trim() || '';
  const isProducer = hasRole(sessionUser?.role, ['producer', 'admin']);

  const user: HeaderUserView = isLoggedIn
    ? {
        name: userName,
        initials: userName ? userInitialsFromName(userName) : '',
      }
    : null;

  let bonus: HeaderBonusView = null;
  if (isLoggedIn) {
    const summary = await getMyBonusSummary();
    if (summary?.success && summary.isActive) {
      bonus = {
        points: summary.points,
        tier: summary.tier,
      };
    }
  }

  const navItems: HeaderNavItem[] = [
    { href: SITE_URL.MOVIES, label: 'Ֆիլմեր', icon: 'film' },
    ...(isLoggedIn
      ? [{ href: SITE_URL.BONUS, label: 'Բոնուսներ', icon: 'gift' as const }]
      : []),
    { href: SITE_URL.SCHEDULE, label: 'Ժամանակացույց', icon: 'calendar' },
    { href: SITE_URL.PACKAGES, label: 'Փաթեթներ', icon: 'package' },
    { href: SITE_URL.TICKETS, label: 'Իմ տոմսերը', icon: 'ticket' },
    ...(isProducer
      ? [
          {
            href: SITE_URL.PRODUCER,
            label: 'Իմ ֆիլմերը',
            icon: 'clapperboard' as const,
          },
        ]
      : []),
  ];

  return <HeaderClient user={user} bonus={bonus} navItems={navItems} />;
}
