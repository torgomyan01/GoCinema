'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Users,
  Film,
  Ticket,
  DollarSign,
  Phone,
  User as UserIcon,
  TrendingUp,
  TrendingDown,
  Cake,
  Check,
  PhoneCall,
  PhoneOff,
} from 'lucide-react';
import AdminLayout from './admin-layout';
import ProductDemandSection from './product-demand-section';
import {
  getDashboardStats,
  getRecentActivity,
  getUpcomingBirthdays,
  setBirthdayPromoCalled,
  type UpcomingBirthdayUser,
} from '@/app/actions/dashboard';

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

function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return 'Չկա';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 9 && cleaned.startsWith('0')) {
    const digits = cleaned.slice(1);
    return `0${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
  }
  return phone;
}

function formatBirthDay(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString('hy-AM', {
    day: '2-digit',
    month: 'long',
  });
}

function daysLabel(days: number): string {
  if (days === 0) return 'Այսօր';
  if (days === 1) return 'Վաղը';
  return `${days} օրից`;
}

export default function AdminDashboardClient({
  user,
}: AdminDashboardClientProps) {
  const [stats, setStats] = useState<any>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [birthdays, setBirthdays] = useState<UpcomingBirthdayUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [birthdayLoading, setBirthdayLoading] = useState(true);
  const [callingId, setCallingId] = useState<number | null>(null);

  const loadBirthdays = useCallback(async () => {
    setBirthdayLoading(true);
    try {
      const result = await getUpcomingBirthdays(15);
      if (result.success) {
        setBirthdays(result.users);
      }
    } catch (err) {
      console.error('Error loading birthdays:', err);
    } finally {
      setBirthdayLoading(false);
    }
  }, []);

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

    void loadData();
    void loadBirthdays();
  }, [loadBirthdays]);

  const handleToggleCalled = async (row: UpcomingBirthdayUser) => {
    if (callingId) return;
    setCallingId(row.id);
    const nextCalled = !row.called;
    setBirthdays((prev) =>
      prev.map((u) => (u.id === row.id ? { ...u, called: nextCalled } : u))
    );
    try {
      const res = await setBirthdayPromoCalled(row.id, nextCalled);
      if (!res.success) {
        setBirthdays((prev) =>
          prev.map((u) => (u.id === row.id ? { ...u, called: row.called } : u))
        );
      }
    } catch {
      setBirthdays((prev) =>
        prev.map((u) => (u.id === row.id ? { ...u, called: row.called } : u))
      );
    } finally {
      setCallingId(null);
    }
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

  const uncalledCount = birthdays.filter((b) => !b.called).length;

  return (
    <AdminLayout user={user}>
      <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-6">
          {/* User Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-white p-4 shadow-lg sm:p-6"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 sm:h-16 sm:w-16">
                <Shield className="h-6 w-6 text-white sm:h-8 sm:w-8" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2 sm:mb-2">
                  <h2 className="truncate text-lg font-bold text-gray-900 sm:text-xl">
                    {user.name || 'Ադմինիստրատոր'}
                  </h2>
                  <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
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
            <div className="mb-0 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-xl bg-white p-4 shadow-lg sm:p-6"
                >
                  <div className="mb-3 h-10 rounded-lg bg-gray-200 sm:mb-4 sm:h-12"></div>
                  <div className="mb-2 h-7 rounded bg-gray-200 sm:h-8"></div>
                  <div className="h-4 w-2/3 rounded bg-gray-200"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {statsData.map((stat, index) => (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="rounded-xl bg-white p-3 shadow-lg transition-shadow hover:shadow-xl sm:p-6"
                >
                  <div className="mb-3 flex items-center justify-between sm:mb-4">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg shadow-lg sm:h-12 sm:w-12 ${stat.color}`}
                    >
                      <stat.icon className="h-4 w-4 text-white sm:h-6 sm:w-6" />
                    </div>
                    {stat.change !== null && (
                      <div
                        className={`flex items-center gap-1 text-xs font-medium sm:text-sm ${
                          stat.changeType === 'up'
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {stat.changeType === 'up' ? (
                          <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        )}
                        {stat.change >= 0 ? '+' : ''}
                        {stat.change}%
                      </div>
                    )}
                  </div>
                  <h3 className="mb-0.5 text-lg font-bold leading-tight text-gray-900 sm:mb-1 sm:text-2xl">
                    {stat.value}
                  </h3>
                  <p className="text-[11px] leading-snug text-gray-600 sm:text-sm">
                    {stat.title}
                  </p>
                </motion.div>
              ))}
            </div>
          )}

          {/* Upcoming birthdays — promo calls */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-xl border border-pink-100 bg-white shadow-lg"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pink-100 bg-gradient-to-r from-pink-50 to-rose-50 px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pink-500 text-white shadow">
                  <Cake className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-gray-900 sm:text-lg">
                    Մոտակա ծնունդներ (15 օր)
                  </h2>
                  <p className="text-xs text-gray-500">
                    Ակցիայի համար զանգելու ցանկ
                    {!birthdayLoading && birthdays.length > 0
                      ? ` · ${uncalledCount} չզանգված / ${birthdays.length}`
                      : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-5">
              {birthdayLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-14 animate-pulse rounded-xl bg-gray-100"
                    />
                  ))}
                </div>
              ) : birthdays.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  Մոտակա 15 օրվա ընթացքում ծնունդ չկա
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {birthdays.map((row) => (
                    <li
                      key={row.id}
                      className={`flex flex-col gap-2.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
                        row.called ? 'opacity-70' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-gray-900">
                            {row.name || `Հաճախորդ #${row.id}`}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              row.daysUntil === 0
                                ? 'bg-pink-600 text-white'
                                : row.daysUntil <= 3
                                  ? 'bg-pink-100 text-pink-700'
                                  : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {daysLabel(row.daysUntil)}
                          </span>
                          {row.called && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              <Check className="h-3 w-3" />
                              Զանգել ենք
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                          <a
                            href={`tel:${row.phone}`}
                            className="inline-flex min-h-10 items-center gap-1.5 font-medium text-purple-700 hover:underline"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {formatPhoneDisplay(row.phone)}
                          </a>
                          <span>{formatBirthDay(row.nextBirthday)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:grid-cols-none">
                        <a
                          href={`tel:${row.phone}`}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 text-sm font-semibold text-purple-700 transition hover:bg-purple-100 sm:hidden"
                        >
                          <Phone className="h-4 w-4" />
                          Զանգ
                        </a>
                        <button
                          type="button"
                          disabled={callingId === row.id}
                          onClick={() => void handleToggleCalled(row)}
                          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition disabled:opacity-50 sm:px-4 ${
                            row.called
                              ? 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                              : 'bg-pink-600 text-white shadow-sm hover:bg-pink-500'
                          }`}
                        >
                          {row.called ? (
                            <>
                              <PhoneOff className="h-4 w-4" />
                              <span className="sm:hidden">Հանել</span>
                              <span className="hidden sm:inline">
                                Հանել նշումը
                              </span>
                            </>
                          ) : (
                            <>
                              <PhoneCall className="h-4 w-4" />
                              Զանգել ենք
                            </>
                          )}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>

          <ProductDemandSection />

          {/* Recent Activity */}
          <div className="rounded-xl bg-white p-4 shadow-lg sm:p-6">
            <h2 className="mb-4 text-xl font-bold text-gray-900 sm:mb-6 sm:text-2xl">
              Վերջին գործողություններ
            </h2>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="mb-2 h-4 rounded bg-gray-200"></div>
                    <div className="h-3 w-1/2 rounded bg-gray-200"></div>
                  </div>
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-gray-500">Գործողություններ դեռ չկան</p>
              </div>
            ) : (
              <div className="space-y-1 sm:space-y-2">
                {activities.map((activity, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start justify-between gap-3 rounded-lg border-b border-gray-100 px-1 py-3 last:border-0 hover:bg-gray-50 sm:items-center sm:px-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug text-gray-900">
                        {activity.action}
                      </p>
                      <p className="text-sm text-gray-500">{activity.user}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500 sm:text-sm">
                      {formatTimeAgo(activity.time)}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
      </div>
    </AdminLayout>
  );
}
