'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  Home,
  LogOut,
  Menu,
  MoreHorizontal,
  Search,
  Shield,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { SITE_URL } from '@/utils/consts';
import { adminMenuItems } from '@/config/admin-menu';
import { isAdminRole } from '@/lib/roles';
import NotificationBell from '@/components/admin/notification-bell';
import SupportMenuBadge from '@/components/admin/support-menu-badge';
import ContactMenuBadge from '@/components/admin/contact-menu-badge';
import { dispatchMondayWeeklyReports } from '@/app/actions/producer-weekly-reports';

interface AdminLayoutProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
  };
  children: React.ReactNode;
}

const STAFF_ALLOWED_HREFS = [
  '/admin/support',
  '/admin/box-office',
  '/admin/hdm',
  '/admin/fiscal',
];

const MOBILE_SHORT_LABELS: Record<string, string> = {
  '/admin': 'Գլխավոր',
  '/admin/scanner': 'Սկաներ',
  '/admin/box-office': 'Դրամարկղ',
  '/admin/tickets': 'Տոմսեր',
  '/admin/hdm': 'ՀԴՄ',
  '/admin/fiscal': 'Ֆիսկալ',
  '/admin/support': 'Աջակցում',
};

function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return 'Չկա';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 9 && cleaned.startsWith('0')) {
    const digits = cleaned.slice(1);
    return `0${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
  }
  return phone;
}

function isItemActive(pathname: string, href: string): boolean {
  return (
    pathname === href ||
    (href !== '/admin' && pathname.startsWith(`${href}/`))
  );
}

export default function AdminLayout({ user, children }: AdminLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [menuQuery, setMenuQuery] = useState('');
  const router = useRouter();
  const pathname = usePathname();

  const menuItems = useMemo(
    () =>
      isAdminRole(user.role)
        ? adminMenuItems
        : adminMenuItems.filter((item) =>
            STAFF_ALLOWED_HREFS.includes(item.href)
          ),
    [user.role]
  );

  const filteredMenuItems = useMemo(() => {
    const q = menuQuery.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter((item) => item.title.toLowerCase().includes(q));
  }, [menuItems, menuQuery]);

  const currentTitle = useMemo(() => {
    const exact = menuItems.find((item) => item.href === pathname);
    if (exact) return exact.title;
    const nested = menuItems
      .filter((item) => item.href !== '/admin' && pathname.startsWith(item.href))
      .sort((a, b) => b.href.length - a.href.length)[0];
    return nested?.title || 'Ադմին';
  }, [menuItems, pathname]);

  const mobileQuickLinks = useMemo(() => {
    const preferred = isAdminRole(user.role)
      ? ['/admin', '/admin/scanner', '/admin/box-office', '/admin/tickets']
      : ['/admin/box-office', '/admin/hdm', '/admin/fiscal', '/admin/support'];
    return preferred
      .map((href) => menuItems.find((item) => item.href === href))
      .filter(Boolean) as typeof menuItems;
  }, [menuItems, user.role]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => {
      const mobile = mq.matches;
      setIsMobile(mobile);
      setIsSidebarOpen(!mobile);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
      setMenuQuery('');
    }
  }, [pathname, isMobile]);

  useEffect(() => {
    if (!isMobile || !isSidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSidebarOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isMobile, isSidebarOpen]);

  useEffect(() => {
    if (!isAdminRole(user.role)) return;
    const dayKey = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Yerevan',
    });
    const storageKey = `gocinema-monday-reports:${dayKey}`;
    if (sessionStorage.getItem(storageKey) === '1') return;
    sessionStorage.setItem(storageKey, '1');
    void dispatchMondayWeeklyReports();
  }, [user.role]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut({ redirect: false });
      router.push(SITE_URL.HOME);
      router.refresh();
    } catch (err) {
      console.error('[Admin Logout] Error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const closeMobileSidebar = () => {
    if (isMobile) setIsSidebarOpen(false);
  };

  const sidebarPanel = (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="border-b border-gray-200 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900">Admin</h2>
              <p className="text-xs text-gray-500">GoCinema</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-gray-600 transition-colors hover:bg-gray-100"
            aria-label="Փակել մենյուն"
          >
            {isMobile ? (
              <X className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100">
            <User className="h-5 w-5 text-purple-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              {user.name || 'Ադմինիստրատոր'}
            </p>
            <p className="truncate text-xs text-gray-500">
              {formatPhoneDisplay(user.phone)}
            </p>
          </div>
        </div>

        <label className="relative mt-3 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={menuQuery}
            onChange={(e) => setMenuQuery(e.target.value)}
            placeholder="Որոնել մենյուում…"
            className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-900 outline-none ring-purple-200 placeholder:text-gray-400 focus:border-purple-300 focus:ring-2"
          />
        </label>
      </div>

      <nav className="flex-1 overflow-y-auto overscroll-contain p-3">
        <ul className="space-y-1">
          {filteredMenuItems.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-gray-500">
              Ոչինչ չի գտնվել
            </li>
          ) : (
            filteredMenuItems.map((item) => {
              const active = isItemActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeMobileSidebar}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 transition-all active:scale-[0.99] ${
                      active
                        ? `${item.bgColor} ${item.color} font-semibold shadow-sm`
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1 text-sm leading-snug">
                      {item.title}
                    </span>
                    {item.href === '/admin/support' && <SupportMenuBadge />}
                    {item.href === '/admin/contacts' && <ContactMenuBadge />}
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </nav>

      <div className="border-t border-gray-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
          className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
            isLoggingOut
              ? 'cursor-not-allowed bg-gray-100 text-gray-400'
              : 'text-red-600 hover:bg-red-50 active:bg-red-100'
          }`}
        >
          {isLoggingOut ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
              <span className="text-sm">Ելք գործում...</span>
            </>
          ) : (
            <>
              <LogOut className="h-5 w-5" />
              <span className="text-sm font-medium">Ելք գործել</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <AnimatePresence initial={false}>
        {!isMobile && isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 288, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="hidden h-full shrink-0 overflow-hidden border-r border-gray-200 bg-white shadow-sm lg:block"
          >
            <div className="h-full w-72">{sidebarPanel}</div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Փակել մենյուն"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[min(100vw-2.5rem,20rem)] max-w-full flex-col bg-white shadow-2xl lg:hidden"
              style={{ paddingTop: 'env(safe-area-inset-top)' }}
            >
              {sidebarPanel}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className="sticky top-0 z-30 shrink-0 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-5 sm:py-3">
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
              {(isMobile || !isSidebarOpen) && (
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-700 transition-colors hover:bg-gray-100 active:bg-gray-200"
                  aria-label="Բացել մենյուն"
                >
                  <Menu className="h-6 w-6" />
                </button>
              )}
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-gray-900 sm:text-lg">
                  {currentTitle}
                </p>
                <p className="hidden truncate text-xs text-gray-500 sm:block">
                  {user.name || 'Ադմինիստրատոր'}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
              {isAdminRole(user.role) && <NotificationBell />}
              <Link
                href={SITE_URL.HOME}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100"
                aria-label="Գլխավոր էջ"
              >
                <Home className="h-4 w-4" />
                <span className="hidden text-sm font-medium sm:inline">
                  Կայք
                </span>
              </Link>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-5 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom quick nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="grid grid-cols-5 gap-0.5 px-1 pt-1">
          {mobileQuickLinks.map((item) => {
            const active = isItemActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors active:scale-[0.97] ${
                    active
                      ? `${item.color} ${item.bgColor}`
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="max-w-full truncate leading-tight">
                    {MOBILE_SHORT_LABELS[item.href] || item.title}
                  </span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className={`flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors active:scale-[0.97] ${
                isSidebarOpen
                  ? 'bg-purple-50 text-purple-600'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>Ավելին</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
