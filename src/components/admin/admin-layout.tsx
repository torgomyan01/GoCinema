'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  LogOut,
  User,
  Phone,
  Menu,
  ChevronLeft,
  Home,
} from 'lucide-react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { SITE_URL } from '@/utils/consts';
import { adminMenuItems } from '@/config/admin-menu';

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

export default function AdminLayout({ user, children }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

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

  const formatPhoneDisplay = (phone: string | null | undefined): string => {
    if (!phone) return 'Չկա';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 9 && cleaned.startsWith('0')) {
      const digits = cleaned.slice(1);
      return `0${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
    }
    return phone;
  };

  const menuItems = adminMenuItems;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white shadow-lg overflow-hidden"
          >
            <div className="h-full flex flex-col">
              {/* Sidebar Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-900">Admin</h2>
                      <p className="text-xs text-gray-500">GoCinema</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {user.name || 'Ադմինիստրատոր'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {formatPhoneDisplay(user.phone) || 'Admin'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar Menu */}
              <nav className="flex-1 overflow-y-auto p-4">
                <ul className="space-y-2">
                  {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                            isActive
                              ? `${item.bgColor} ${item.color} font-medium shadow-sm`
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <item.icon className="w-5 h-5 shrink-0" />
                          <span className="text-sm">{item.title}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* Sidebar Footer */}
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isLoggingOut
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'text-red-600 hover:bg-red-50'
                  }`}
                >
                  {isLoggingOut ? (
                    <>
                      <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm">Ելք գործում...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-5 h-5" />
                      <span className="text-sm font-medium">Ելք գործել</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {!isSidebarOpen && (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Menu className="w-6 h-6 text-gray-600" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Link
                href={SITE_URL.HOME}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Գլխավոր էջ</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {children}
      </div>
    </div>
  );
}
