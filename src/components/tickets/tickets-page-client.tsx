'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Ticket as TicketIcon, AlertCircle, QrCode, CreditCard } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TicketsFilter from './tickets-filter';
import TicketGroupCard from './ticket-group-card';
import { SITE_URL } from '@/utils/consts';
import { getUserTickets } from '@/app/actions/tickets';
import {
  filterTicketGroups,
  getNextUpGroup,
  groupUserTickets,
  type TicketsViewFilter,
  type UserTicket,
} from './ticket-types';

export default function TicketsPageClient() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [selectedFilter, setSelectedFilter] =
    useState<TicketsViewFilter>('upcoming');
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReservedNotice, setShowReservedNotice] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const nextUpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('reserved') === '1'
    ) {
      setShowReservedNotice(true);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push(SITE_URL.ACCOUNT);
      return;
    }

    if (sessionStatus === 'authenticated' && session?.user) {
      const loadTickets = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const user = session.user as { id?: string | number };
          const userId =
            typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
          if (userId == null || Number.isNaN(Number(userId))) {
            setError('Օգտատիրոջ ID-ն վավեր չէ');
            setIsLoading(false);
            return;
          }
          const result = await getUserTickets(Number(userId));
          if (result.success && result.tickets) {
            setTickets(result.tickets as UserTicket[]);
          } else {
            setError(result.error || 'Տոմսերը բեռնելիս սխալ է տեղի ունեցել');
          }
        } catch (err) {
          console.error('Error loading tickets:', err);
          setError('Տոմսերը բեռնելիս սխալ է տեղի ունեցել');
        } finally {
          setIsLoading(false);
        }
      };

      void loadTickets();
    }
  }, [session, sessionStatus, router]);

  const allGroups = useMemo(() => groupUserTickets(tickets), [tickets]);

  const filterCounts = useMemo(
    () => ({
      upcoming: filterTicketGroups(allGroups, 'upcoming').length,
      past: filterTicketGroups(allGroups, 'past').length,
      cancelled: filterTicketGroups(allGroups, 'cancelled').length,
    }),
    [allGroups]
  );

  const filteredGroups = useMemo(
    () => filterTicketGroups(allGroups, selectedFilter),
    [allGroups, selectedFilter]
  );

  const nextUp = useMemo(() => getNextUpGroup(allGroups), [allGroups]);

  // Sticky CTA՝ երբ NextUp հերոն այլևս տեսադաշտում չէ
  useEffect(() => {
    if (!nextUpRef.current || !nextUp) {
      setShowStickyCta(false);
      return;
    }
    const el = nextUpRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyCta(!entry.isIntersecting);
      },
      { threshold: 0.15, rootMargin: '-48px 0px 0px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextUp]);

  if (sessionStatus === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-20 pt-24">
        <div className="container mx-auto px-4">
          <div className="py-20 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-purple-600" />
            <p className="text-lg text-gray-600">Բեռնվում է...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-20 pt-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-20 text-center"
          >
            <AlertCircle className="mx-auto mb-4 h-14 w-14 text-red-600" />
            <h3 className="mb-2 text-2xl font-bold text-gray-900">
              Սխալ է տեղի ունեցել
            </h3>
            <p className="mb-6 text-gray-600">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-block rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700"
            >
              Կրկին փորձել
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  const stickyIsPay =
    nextUp?.status === 'awaiting_payment' && nextUp.orderId != null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-28 pt-20 sm:pb-20 sm:pt-24">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center sm:mb-8"
        >
          <h1 className="mb-1 text-3xl font-bold text-gray-900 sm:text-4xl">
            Իմ տոմսերը
          </h1>
          <p className="text-sm text-gray-600 sm:text-base">
            Հաջորդ ցուցադրությունը և ձեր QR-ը՝ մեկ տեղում
          </p>
        </motion.div>

        {showReservedNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
          >
            <TicketIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              <p className="mb-0.5 font-semibold">
                Տոմսը ամրագրված է։ Վճարումը՝ մուտքի մոտ։
              </p>
              <p>
                Ցույց տվեք QR կոդը դրամարկղում։ QR-ը մնում է հասանելի։
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowReservedNotice(false)}
              className="ml-auto text-amber-500 hover:text-amber-700"
            >
              ✕
            </button>
          </motion.div>
        )}

        {/* Հաջորդ տոմս հերո */}
        {nextUp && (
          <div ref={nextUpRef} className="mb-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-600">
              Հաջորդ ցուցադրություն
            </p>
            <TicketGroupCard
              group={nextUp}
              index={0}
              showInlineQr={
                nextUp.status === 'paid' ||
                nextUp.status === 'reserved' ||
                nextUp.status === 'awaiting_payment'
              }
              compact
            />
          </div>
        )}

        <TicketsFilter
          selectedFilter={selectedFilter}
          onFilterChange={setSelectedFilter}
          counts={filterCounts}
        />

        {(() => {
          const list =
            selectedFilter === 'upcoming' && nextUp
              ? filteredGroups.filter((g) => g.key !== nextUp.key)
              : filteredGroups;

          if (filteredGroups.length === 0) {
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-16 text-center"
              >
                <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <TicketIcon className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-gray-900">
                  Տոմսեր չեն գտնվել
                </h3>
                <p className="mb-6 text-gray-600">
                  {selectedFilter === 'upcoming'
                    ? 'Առաջիկա տոմսեր չկան'
                    : selectedFilter === 'past'
                      ? 'Անցյալ տոմսեր չկան'
                      : 'Չեղարկված տոմսեր չկան'}
                </p>
                <Link
                  href={SITE_URL.SCHEDULE}
                  className="inline-block rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white hover:from-purple-700 hover:to-pink-700"
                >
                  Դիտել ժամանակացույց
                </Link>
              </motion.div>
            );
          }

          if (list.length === 0) {
            return (
              <p className="py-6 text-center text-sm text-gray-500">
                Այլ առաջիկա տոմսեր չկան
              </p>
            );
          }

          return (
            <div className="space-y-4">
              {list.map((group, index) => (
                <TicketGroupCard key={group.key} group={group} index={index} />
              ))}
            </div>
          );
        })()}
      </div>

      {/* Mobile sticky CTA */}
      {nextUp && showStickyCta && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 p-3 shadow-2xl backdrop-blur sm:hidden">
          <div className="mb-1 truncate text-xs text-gray-500">
            {nextUp.screening.movie.title}
          </div>
          {stickyIsPay ? (
            <Link
              href={SITE_URL.PAYMENT(nextUp.orderId!)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 py-3 text-sm font-semibold text-white"
            >
              <CreditCard className="h-4 w-4" />
              Վճարել հիմա
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                nextUpRef.current?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                });
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-sm font-semibold text-white"
            >
              <QrCode className="h-4 w-4" />
              {nextUp.status === 'reserved' ? 'Ցույց տալ QR' : 'Մուտքի QR'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
