'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Film, Calendar, User, Ticket } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { SITE_URL } from '@/utils/consts';
import Image from 'next/image';
import clsx from 'clsx';

export default function Header() {
  const { data: session } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  const user = session?.user as any;
  const userName = user?.name || 'Հաշիվ';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Header should have dark background (white bg) if:
  // 1. Not on home page, OR
  // 2. User has scrolled on home page
  const isHomePage = pathname === SITE_URL.HOME;
  const shouldHaveDarkBg = !isHomePage || isScrolled;

  const navItems = [
    { href: SITE_URL.MOVIES, label: 'Ֆիլմեր', icon: Film },
    { href: SITE_URL.SCHEDULE, label: 'Ժամանակացույց', icon: Calendar },
    { href: SITE_URL.TICKETS, label: 'Իմ տոմսերը', icon: Ticket },
  ];

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
          {/* Logo */}
          <Link href={SITE_URL.HOME} className="flex items-center gap-2">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={clsx(
                'text-2xl font-bold flex-js-c gap-4',
                shouldHaveDarkBg ? 'text-gray-700' : 'text-white'
              )}
            >
              <Image
                src="/images/logo.svg"
                alt="GoCinema"
                width={40}
                height={40}
              />
              GoCinema
            </motion.div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 font-medium transition-colors ${
                  shouldHaveDarkBg
                    ? 'text-gray-700 hover:text-purple-600'
                    : 'text-white hover:text-purple-200'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}

            <Link
              href={SITE_URL.ACCOUNT}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                shouldHaveDarkBg
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg'
                  : 'bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20'
              }`}
            >
              <User className="w-5 h-5" />
              <span className="hidden lg:inline">
                {session?.user ? userName : 'Հաշիվ'}
              </span>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`md:hidden p-2 rounded-lg transition-colors ${
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

        {/* Mobile Menu - Portal to body so fixed = viewport (not clipped by header backdrop-blur) */}
        {mounted &&
          createPortal(
            <AnimatePresence>
              {isMobileMenuOpen && (
                <>
                  {/* Backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] md:hidden"
                  />
                  {/* Menu Content - Full viewport height */}
                  <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed top-0 right-0 w-100 max-w-[85vw] h-full min-h-[100dvh] bg-white shadow-2xl z-[101] md:hidden overflow-y-auto"
                  >
                    {/* Menu Header */}
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

                    {/* Menu Items */}
                    <div className="p-6 space-y-2">
                      {navItems.map((item, index) => (
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
                              <item.icon className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
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
                      ))}
                    </div>

                    {/* Account Section */}
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
                            {session?.user ? userName : 'Հաշիվ'}
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
