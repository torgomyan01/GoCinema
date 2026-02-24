'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Users,
  Film,
  Ticket,
  Calendar,
  DollarSign,
  BarChart3,
  Settings,
  Phone,
  User as UserIcon,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import Link from 'next/link';
import AdminLayout from './admin-layout';
import { adminMenuItems } from '@/config/admin-menu';
import { getDashboardStats, getRecentActivity } from '@/app/actions/dashboard';

interface AdminDashboardClientProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
  };
}

interface Activity {
  type: string;
  action: string;
  user: string;
  time: Date;
}

export default function AdminDashboardClient({
  user,
}: AdminDashboardClientProps) {
  const [stats, setStats] = useState<any>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [statsResult, activityResult] = await Promise.all([
          getDashboardStats(),
          getRecentActivity(),
        ]);

        if (statsResult.success && statsResult.stats) {
          setStats(statsResult.stats);
        }

        if (activityResult.success && activityResult.activities) {
          setActivities(activityResult.activities);
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const formatPhoneDisplay = (phone: string | null | undefined): string => {
    if (!phone) return 'Չկա';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 9 && cleaned.startsWith('0')) {
      const digits = cleaned.slice(1);
      return `0${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
    }
    return phone;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hy-AM', {
      style: 'currency',
      currency: 'AMD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatTimeAgo = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Հենց հիմա';
    if (diffMins < 60) return `${diffMins} րոպե առաջ`;
    if (diffHours < 24) return `${diffHours} ժամ առաջ`;
    if (diffDays < 7) return `${diffDays} օր առաջ`;
    return d.toLocaleDateString('hy-AM', { month: 'short', day: 'numeric' });
  };

  const statsData = stats
    ? [
        {
          title: 'Ընդամենը օգտատերեր',
          value: stats.totalUsers.toLocaleString('hy-AM'),
          icon: Users,
          color: 'bg-blue-500',
          change: stats.changes.users,
          changeType: stats.changes.users >= 0 ? 'up' : 'down',
        },
        {
          title: 'Ֆիլմեր',
          value: stats.totalMovies.toString(),
          icon: Film,
          color: 'bg-purple-500',
          change: null,
          changeType: null,
        },
        {
          title: 'Տոմսեր այս ամիս',
          value: stats.ticketsThisMonth.toLocaleString('hy-AM'),
          icon: Ticket,
          color: 'bg-green-500',
          change: stats.changes.tickets,
          changeType: stats.changes.tickets >= 0 ? 'up' : 'down',
        },
        {
          title: 'Ընդհանուր եկամուտ',
          value: formatCurrency(stats.totalRevenue),
          icon: DollarSign,
          color: 'bg-yellow-500',
          change: stats.changes.revenue,
          changeType: stats.changes.revenue >= 0 ? 'up' : 'down',
        },
      ]
    : [];

  const quickActions = adminMenuItems
    .filter((item) => item.href !== '/admin')
    .map((item) => ({
      title: item.title,
      description: `Դիտել ${item.title.toLowerCase()}`,
      icon: item.icon,
      href: item.href,
      color: item.href.includes('movies')
        ? 'from-purple-500 to-pink-500'
        : item.href.includes('screenings')
          ? 'from-blue-500 to-cyan-500'
          : item.href.includes('tickets')
            ? 'from-green-500 to-emerald-500'
            : item.href.includes('users')
              ? 'from-orange-500 to-red-500'
              : item.href.includes('analytics')
                ? 'from-indigo-500 to-purple-500'
                : item.href.includes('settings')
                  ? 'from-gray-500 to-gray-700'
                  : item.href.includes('products')
                    ? 'from-amber-500 to-yellow-500'
                    : item.href.includes('seats')
                      ? 'from-indigo-500 to-blue-500'
                      : 'from-purple-500 to-pink-500',
    }));

  return (
    <AdminLayout user={user}>
      <div className="flex-1 overflow-y-auto py-8">
        <div className="container mx-auto px-4">
          {/* User Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-6 mb-8"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-bold text-gray-900">
                    {user.name || 'Ադմինիստրատոր'}
                  </h2>
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                    Admin
                  </span>
                </div>
                <div className="space-y-1">
                  {user.phone && (
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <Phone className="w-4 h-4" />
                      <span>{formatPhoneDisplay(user.phone)}</span>
                    </div>
                  )}
                  {user.email && (
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <UserIcon className="w-4 h-4" />
                      <span>{user.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-gray-600 text-sm">
                    <Shield className="w-4 h-4" />
                    <span>ID: #{user.id}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Statistics */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl shadow-lg p-6 animate-pulse"
                >
                  <div className="h-12 bg-gray-200 rounded-lg mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {statsData.map((stat, index) => (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center shadow-lg`}
                    >
                      <stat.icon className="w-6 h-6 text-white" />
                    </div>
                    {stat.change !== null && (
                      <div
                        className={`flex items-center gap-1 text-sm font-medium ${
                          stat.changeType === 'up'
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {stat.changeType === 'up' ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        {stat.change >= 0 ? '+' : ''}
                        {stat.change}%
                      </div>
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">
                    {stat.value}
                  </h3>
                  <p className="text-sm text-gray-600">{stat.title}</p>
                </motion.div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Արագ գործողություններ
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quickActions.map((action, index) => (
                <motion.div
                  key={action.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link
                    href={action.href}
                    className="block bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all group"
                  >
                    <div
                      className={`w-12 h-12 bg-gradient-to-r ${action.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                    >
                      <action.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {action.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {action.description}
                    </p>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Վերջին գործողություններ
            </h2>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Գործողություններ դեռ չկան</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((activity, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 px-2 -mx-2 rounded transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-gray-900 font-medium">
                        {activity.action}
                      </p>
                      <p className="text-sm text-gray-500">{activity.user}</p>
                    </div>
                    <span className="text-sm text-gray-500 whitespace-nowrap ml-4">
                      {formatTimeAgo(activity.time)}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
