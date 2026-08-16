'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  Film,
  Calendar,
  User,
  Ticket,
  Package,
  Clapperboard,
  Gift,
  Coins,
  type LucideIcon,
} from 'lucide-react';
import { SITE_URL } from '@/utils/consts';
import { TIER_LABELS_HY } from '@/lib/bonus-labels';
import { formatPrice } from '@/lib/format';
import Image from 'next/image';
import clsx from 'clsx';

export type HeaderNavIcon =
  | 'film'
  | 'gift'
  | 'calendar'
  | 'package'
  | 'ticket'
  | 'clapperboard';

export type HeaderNavItem = {
  href: string;
  label: string;
  icon: HeaderNavIcon;
};

export type HeaderUserView = {
  name: string;
  initials: string;
} | null;

export type HeaderBonusView = {
  points: number;
  tier: string | null;
} | null;

const NAV_ICONS: Record<HeaderNavIcon, LucideIcon> = {
  film: Film,
  gift: Gift,
  calendar: Calendar,
  package: Package,
  ticket: Ticket,
  clapperboard: Clapperboard,
};

interface HeaderClientProps {
  user: HeaderUserView;
  bonus: HeaderBonusView;
  navItems: HeaderNavItem[];
}

export default function HeaderClient({
  user,
  bonus,
  navItems,
}: HeaderClientProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isHomePage = pathname === SITE_URL.HOME;
  const shouldHaveDarkBg = !isHomePage || isScrolled;
  const userName = user?.name ?? '';
  const bonusPoints = bonus?.points ?? null;
  const bonusTier = bonus?.tier ?? null;

  const renderAccountChip = (compact = false) => {
    if (!user) {
      return (
        <Link
          href={SITE_URL.ACCOUNT}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-lg font-medium transition-all',
            compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2',
            shouldHaveDarkBg
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg'
              : 'bg-white/15 backdrop-blur-md text-white border border-white/20 hover:bg-white/20'
          )}
        >
          <User className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
          {compact ? 'Մուտք' : <span className="hidden lg:inline">Հաշիվ</span>}
        </Link>
      );
    }

    return (
      <Link
        href={SITE_URL.ACCOUNT}
        onClick={() => setIsMobileMenuOpen(false)}
        title={userName || 'Հաշիվ'}
        className={clsx(
          'inline-flex items-center overflow-hidden rounded-full font-semibold transition-all',
          shouldHaveDarkBg
            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm hover:shadow-md'
            : 'bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-md hover:bg-white/25'
        )}
      >
        <span
          className={clsx(
            'inline-flex items-center justify-center font-bold tracking-wide',
            compact ? 'h-8 min-w-8 px-2 text-xs' : 'h-9 min-w-9 px-2.5 text-sm'
          )}
        >
          {user.initials || <User className={compact ? 'h-4 w-4' : 'h-5 w-5'} />}
        </span>
        {bonusPoints !== null && (
          <span
            className={clsx(
              'inline-flex items-center gap-1 border-l tabular-nums mr-1 rounded-[0_20px_20px_0]',
              compact
                ? 'gap-0.5 px-2 py-1 text-xs'
                : 'gap-1 px-2.5 py-1.5 text-sm',
              shouldHaveDarkBg
                ? 'border-white/25 bg-black/10'
                : 'border-white/20 bg-white/10'
            )}
            title={
              bonusTier
                ? `${TIER_LABELS_HY[bonusTier] ?? bonusTier} · Բոնուսներ`
                : 'Բոնուսներ'
            }
          >
            <Coins
              className={compact ? 'h-3 w-3 shrink-0' : 'h-3.5 w-3.5 shrink-0'}
            />
            {formatPrice(bonusPoints)}
          </span>
        )}
      </Link>
    );
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        shouldHaveDarkBg
          ? 'bg-white/95 backdrop-blur-md shadow-lg'
          : 'bg-transparent'
      }`}
    >
      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href={SITE_URL.HOME} className="flex items-center gap-2">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={clsx(
                'text-2xl font-bold flex-js-c gap-2',
                shouldHaveDarkBg ? 'text-gray-700' : 'text-white'
              )}
            >
              <Image
                src="/images/GoCinema.svg"
                alt="GoCinema"
                width={40}
                height={40}
              />
              <div className="text-2xl font-bold mt-1 text-[#E61E21]">
                CINEMA
              </div>
            </motion.div>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => {
              const Icon = NAV_ICONS[item.icon];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 font-medium transition-colors ${
                    shouldHaveDarkBg
                      ? 'text-gray-700 hover:text-purple-600'
                      : 'text-white hover:text-purple-200'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}

            {renderAccountChip()}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            {renderAccountChip(true)}

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`p-2 rounded-lg transition-colors ${
                shouldHaveDarkBg ? 'text-gray-700' : 'text-white'
              }`}
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {mounted &&
          createPortal(
            <AnimatePresence>
              {isMobileMenuOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] md:hidden"
                  />
                  <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed top-0 right-0 w-100 max-w-[85vw] h-full min-h-[100dvh] bg-white shadow-2xl z-[101] md:hidden overflow-y-auto"
                  >
                    <div className="sticky top-0 bg-white border-b border-gray-200 z-10 shrink-0">
                      <div className="flex items-center justify-between p-6">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg">
                            <Film className="w-5 h-5 text-white" />
                          </div>
                          <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                            GoCinema
                          </span>
                        </div>
                        <button
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <X className="w-6 h-6 text-gray-600" />
                        </button>
                      </div>
                    </div>

                    {bonusPoints !== null && (
                      <div className="px-6 pt-4">
                        <Link
                          href={SITE_URL.BONUS}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-amber-100 p-2.5">
                              <Coins className="h-5 w-5 text-amber-700" />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-amber-700/80">
                                Բոնուս միավորներ
                              </p>
                              <p className="text-lg font-bold tabular-nums text-amber-900">
                                {formatPrice(bonusPoints)}
                              </p>
                            </div>
                          </div>
                          {bonusTier && (
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                              {TIER_LABELS_HY[bonusTier] ?? bonusTier}
                            </span>
                          )}
                        </Link>
                      </div>
                    )}

                    <div className="p-6 space-y-2">
                      {navItems.map((item, index) => {
                        const Icon = NAV_ICONS[item.icon];
                        return (
                          <motion.div
                            key={item.href}
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.08, type: 'spring' }}
                          >
                            <Link
                              href={item.href}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-gray-50 to-purple-50/30 hover:from-purple-50 hover:to-pink-50 transition-all duration-300 group border border-gray-100 hover:border-purple-200 hover:shadow-md"
                            >
                              <div className="p-3 rounded-xl bg-white group-hover:bg-gradient-to-br group-hover:from-purple-500 group-hover:to-pink-500 shadow-sm group-hover:shadow-lg transition-all duration-300">
                                <Icon className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                              </div>
                              <div className="flex-1">
                                <span className="text-lg font-semibold text-gray-800 group-hover:text-purple-600 transition-colors">
                                  {item.label}
                                </span>
                              </div>
                              <motion.div
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: index * 0.08 + 0.2 }}
                                className="text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                →
                              </motion.div>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>

                    <div className="p-6 pt-0">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: navItems.length * 0.08 + 0.1 }}
                      >
                        <Link
                          href={SITE_URL.ACCOUNT}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-size-200 bg-pos-0 hover:bg-pos-100 text-white rounded-2xl font-semibold shadow-xl hover:shadow-2xl transition-all duration-500 group"
                        >
                          <div className="p-2 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                            <User className="w-5 h-5" />
                          </div>
                          <span className="text-lg">
                            {user ? userName : 'Հաշիվ'}
                          </span>
                        </Link>
                      </motion.div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>,
            document.body
          )}
      </nav>
    </header>
  );
}
