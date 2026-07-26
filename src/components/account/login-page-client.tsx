'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Phone,
  Lock,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  LogOut,
  Ticket,
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  Clapperboard,
  Shield,
  Film,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SITE_URL } from '@/utils/consts';
import { hasRole } from '@/lib/roles';
import { formatDateHy, formatTimeHy } from '@/lib/format';
import { getUserTickets } from '@/app/actions/tickets';
import {
  formatSeatsLabel,
  getNextUpGroup,
  groupUserTickets,
  type UserTicket,
} from '@/components/tickets/ticket-types';

function formatPhoneNumber(value: string): string {
  let cleaned = value.replace(/\D/g, '');
  if (cleaned.startsWith('374')) {
    cleaned = '0' + cleaned.slice(3);
  }
  cleaned = cleaned.slice(0, 9);
  if (cleaned.length === 0) return '';
  if (!cleaned.startsWith('0')) {
    cleaned = '0' + cleaned.slice(0, 8);
  }
  const digits = cleaned.slice(1);
  if (digits.length <= 2) return `0${digits}`;
  if (digits.length <= 5) return `0${digits.slice(0, 2)} ${digits.slice(2)}`;
  return `0${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
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

function getInitials(name: string | null | undefined): string {
  if (!name?.trim()) return 'GO';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function firstName(name: string | null | undefined): string {
  if (!name?.trim()) return 'բարեկամ';
  return name.trim().split(/\s+/)[0] ?? 'բարեկամ';
}

export default function LoginPageClient() {
  const { data: session, status, update } = useSession();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [nextTickets, setNextTickets] = useState<UserTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl');

  useEffect(() => {
    if (status === 'authenticated' && session) {
      setPhone('');
      setPassword('');
    }
  }, [status, session]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;
    const user = session.user as { id?: string | number };
    const userId =
      typeof user.id === 'string' ? parseInt(user.id, 10) : Number(user.id);
    if (!Number.isFinite(userId)) return;

    let cancelled = false;
    setTicketsLoading(true);
    void getUserTickets(userId)
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.tickets) {
          setNextTickets(result.tickets as UserTicket[]);
        }
      })
      .finally(() => {
        if (!cancelled) setTicketsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status, session]);

  const nextUp = useMemo(
    () => getNextUpGroup(groupUserTickets(nextTickets)),
    [nextTickets]
  );

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneNumber(e.target.value));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phone || !password) {
      setError('Բոլոր դաշտերը պարտադիր են');
      return;
    }

    const cleanPhone = phone.replace(/\s/g, '');
    if (!/^0[0-9]{8}$/.test(cleanPhone)) {
      setError('Մուտքագրեք վավեր հեռախոսահամար (օրինակ: 0XX XXX XXX)');
      return;
    }

    if (password.length < 6) {
      setError('Password-ը պետք է լինի առնվազն 6 նիշ');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        phone: cleanPhone,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Սխալ հեռախոսահամար կամ password');
        setIsLoading(false);
      } else if (result?.ok) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        await update();
        await new Promise((resolve) => setTimeout(resolve, 100));

        try {
          const freshSession = await fetch('/api/auth/session', {
            cache: 'no-store',
          }).then((res) => res.json());

          if (freshSession?.user) {
            const user = freshSession.user as { role?: string };
            if (callbackUrl && callbackUrl !== '/account') {
              window.location.href = decodeURIComponent(callbackUrl);
            } else if (hasRole(user.role, ['admin'])) {
              window.location.href = '/admin';
            } else {
              window.location.href = '/account';
            }
          } else {
            window.location.href = '/account';
          }
        } catch {
          window.location.href = '/account';
        }
      } else {
        setError('Մուտք գործելիս սխալ է տեղի ունեցել');
        setIsLoading(false);
      }
    } catch {
      setError('Սխալ է տեղի ունեցել');
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut({ redirect: false });
      router.refresh();
    } catch (err) {
      console.error('[Logout] Error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-20 pt-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-lg">
            <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-purple-600" />
              <p className="text-gray-600">Բեռնվում է...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'authenticated' && session?.user) {
    const user = session.user as {
      id?: string | number;
      name?: string | null;
      phone?: string | null;
      email?: string | null;
      role?: string | null;
    };
    const isAdmin = hasRole(user.role, ['admin']);
    const isProducer = hasRole(user.role, ['producer', 'admin']);
    const phoneLabel = formatPhoneDisplay(user.phone || user.email);

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-20 pt-20 sm:pt-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-lg space-y-4">
            {/* Profile header */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md"
            >
              <div className="h-1 bg-gradient-to-r from-purple-600 via-pink-500 to-amber-400" />
              <div className="flex items-center gap-4 p-5 sm:p-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-500 text-lg font-bold text-white shadow-sm">
                  {getInitials(user.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-purple-600">
                    Հաշիվ
                  </p>
                  <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">
                    Բարև, {firstName(user.name)}
                  </h1>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-600">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span>{phoneLabel}</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Next ticket */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md"
            >
              <div className="border-b border-gray-100 px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">
                  Հաջորդ ցուցադրություն
                </p>
              </div>

              {ticketsLoading ? (
                <div className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-gray-500">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
                  Բեռնվում է...
                </div>
              ) : nextUp ? (
                <Link
                  href={SITE_URL.TICKETS}
                  className="flex gap-3 p-4 transition hover:bg-purple-50/50 sm:p-5"
                >
                  <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-200 sm:h-24 sm:w-16">
                    <Image
                      src={
                        nextUp.screening.movie.image ||
                        'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400'
                      }
                      alt={nextUp.screening.movie.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-gray-900">
                      {nextUp.screening.movie.title}
                    </p>
                    <div className="mt-1.5 space-y-1 text-xs text-gray-600 sm:text-sm">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-purple-500" />
                        {formatDateHy(nextUp.screening.startTime, {
                          year: true,
                        })}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-purple-500" />
                        {formatTimeHy(nextUp.screening.startTime)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-purple-500" />
                        {nextUp.screening.hall.name} · {formatSeatsLabel(nextUp)}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-gray-300" />
                </Link>
              ) : (
                <div className="px-5 py-6 text-center">
                  <Film className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  <p className="mb-3 text-sm text-gray-500">
                    Առաջիկա տոմսեր չկան
                  </p>
                  <Link
                    href={SITE_URL.SCHEDULE}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:text-purple-800"
                  >
                    Դիտել ժամանակացույց
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </motion.div>

            {/* Primary actions */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-2.5"
            >
              <Link
                href={SITE_URL.TICKETS}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3.5 text-sm font-semibold text-white shadow-md transition hover:from-purple-700 hover:to-pink-700"
              >
                <Ticket className="h-4 w-4" />
                Իմ տոմսերը
              </Link>
              <Link
                href={SITE_URL.SCHEDULE}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white px-5 py-3.5 text-sm font-semibold text-purple-700 transition hover:bg-purple-50"
              >
                <Calendar className="h-4 w-4" />
                Ժամանակացույց
              </Link>
            </motion.div>

            {/* Staff links */}
            {(isAdmin || isProducer) && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
              >
                <div className="border-b border-gray-100 px-5 py-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    <Shield className="h-3.5 w-3.5" />
                    Աշխատանքային
                  </p>
                </div>
                <div className="divide-y divide-gray-50 p-2">
                  {isAdmin && (
                    <Link
                      href={SITE_URL.ADMIN}
                      className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
                    >
                      Ադմինիստրացիա
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </Link>
                  )}
                  {isProducer && (
                    <Link
                      href={SITE_URL.PRODUCER}
                      className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium text-gray-800 transition hover:bg-amber-50"
                    >
                      <span className="flex items-center gap-2">
                        <Clapperboard className="h-4 w-4 text-amber-600" />
                        Իմ ֆիլմերը
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </Link>
                  )}
                </div>
              </motion.div>
            )}

            {/* Account / logout */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-2"
            >
              <Link
                href="/forgot-password"
                className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-gray-600 transition hover:bg-white hover:text-gray-900"
              >
                <Lock className="h-4 w-4" />
                Փոխել գաղտնաբառը
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${
                  isLoggingOut
                    ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isLoggingOut ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
                    Ելք գործում...
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4" />
                    Ելք գործել
                  </>
                )}
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-20 pt-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md"
          >
            <div className="h-1 bg-gradient-to-r from-purple-600 via-pink-500 to-amber-400" />
            <div className="p-7 sm:p-8">
              <div className="mb-7 text-center">
                <h1 className="mb-1 text-2xl font-bold text-gray-900 sm:text-3xl">
                  Մուտք
                </h1>
                <p className="text-sm text-gray-600">
                  Մուտք գործեք ձեր GoCinema հաշիվ
                </p>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="phone"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Հեռախոսահամար
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={handlePhoneChange}
                      required
                      className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="0XX XXX XXX"
                      maxLength={11}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Գաղտնաբառ
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      required
                      className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-12 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <Link
                    href="/forgot-password"
                    className="text-sm text-purple-600 transition-colors hover:text-purple-700"
                  >
                    Մոռացել եք գաղտնաբառը?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold transition-all ${
                    isLoading
                      ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md hover:from-purple-700 hover:to-pink-700 hover:shadow-lg'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Մուտք գործում...
                    </>
                  ) : (
                    <>
                      <LogIn className="h-5 w-5" />
                      Մուտք գործել
                    </>
                  )}
                </button>
              </form>

              <div className="relative my-7">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-3 text-gray-400">կամ</span>
                </div>
              </div>

              <div className="text-center">
                <p className="mb-3 text-sm text-gray-600">Դեռ չունեք հաշիվ?</p>
                <Link
                  href={SITE_URL.REGISTER}
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-purple-600 px-6 py-3 font-semibold text-purple-600 transition-all hover:bg-purple-50"
                >
                  <UserPlus className="h-5 w-5" />
                  Գրանցվել
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
