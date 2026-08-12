'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Calendar,
  Clock,
  ChevronDown,
  Armchair,
  User,
  Phone,
  Wallet,
  Ticket as TicketIcon,
  Loader2,
  Trash2,
} from 'lucide-react';
import {
  getScreeningsForMovieAdmin,
  getTicketsForScreeningAdmin,
  updateTicketStatus,
} from '@/app/actions/tickets';
import { deleteScreening } from '@/app/actions/screenings';

type TicketStatus =
  | 'reserved'
  | 'awaiting_payment'
  | 'paid'
  | 'used'
  | 'cancelled';

interface ScreeningSummary {
  id: number;
  startTime: Date | string;
  endTime: Date | string;
  price: number;
  hallId: number | null;
  hallName: string;
  capacity: number;
  totalTickets: number;
  sold: number;
  counts: {
    reserved: number;
    awaiting_payment: number;
    paid: number;
    used: number;
    cancelled: number;
  };
  revenue: number;
}

interface AdminTicket {
  id: number;
  price: number;
  status: string;
  qrCode?: string | null;
  createdAt: Date | string;
  user: {
    id: number;
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  seat: {
    id: number;
    row: string;
    number: number;
    seatType: string;
  } | null;
  order: { id: number; paymentMethod: string | null } | null;
}

interface Props {
  movie: { id: number; title: string; image?: string | null };
  onClose: () => void;
}

const STATUS_META: Record<
  TicketStatus,
  { label: string; badge: string; dot: string }
> = {
  reserved: {
    label: 'Ամրագրված',
    badge: 'bg-amber-100 text-amber-800',
    dot: 'bg-amber-500',
  },
  awaiting_payment: {
    label: 'Սպասում է վճարման',
    badge: 'bg-amber-100 text-amber-800',
    dot: 'bg-amber-500',
  },
  paid: {
    label: 'Վճարված',
    badge: 'bg-emerald-100 text-emerald-800',
    dot: 'bg-emerald-500',
  },
  used: {
    label: 'Օգտագործված',
    badge: 'bg-blue-100 text-blue-800',
    dot: 'bg-blue-500',
  },
  cancelled: {
    label: 'Չեղարկված',
    badge: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
  },
};

const STATUS_ORDER: TicketStatus[] = [
  'awaiting_payment',
  'reserved',
  'paid',
  'used',
  'cancelled',
];

function formatAmd(value: number): string {
  return `${Math.round(value).toLocaleString('hy-AM')} ֏`;
}

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString('hy-AM', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(value: Date | string): string {
  return new Date(value).toLocaleTimeString('hy-AM', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MovieTicketsModal({ movie, onClose }: Props) {
  const [screenings, setScreenings] = useState<ScreeningSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openScreeningId, setOpenScreeningId] = useState<number | null>(null);

  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadScreenings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await getScreeningsForMovieAdmin(movie.id);
    if (result.success) {
      setScreenings(result.screenings as ScreeningSummary[]);
    } else {
      setError(result.error || 'Ցուցադրությունները բեռնելիս սխալ է տեղի ունեցել');
    }
    setIsLoading(false);
  }, [movie.id]);

  useEffect(() => {
    void loadScreenings();
  }, [loadScreenings]);

  const loadTickets = useCallback(async (screeningId: number) => {
    setTicketsLoading(true);
    const result = await getTicketsForScreeningAdmin(screeningId);
    if (result.success) {
      setTickets(result.tickets as unknown as AdminTicket[]);
    } else {
      setTickets([]);
    }
    setTicketsLoading(false);
  }, []);

  const toggleScreening = (screeningId: number) => {
    if (openScreeningId === screeningId) {
      setOpenScreeningId(null);
      setTickets([]);
      return;
    }
    setOpenScreeningId(screeningId);
    void loadTickets(screeningId);
  };

  const handleChangeStatus = async (
    ticketId: number,
    status: TicketStatus
  ) => {
    setUpdatingId(ticketId);
    const result = await updateTicketStatus(ticketId, status);
    if (result.success) {
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status } : t))
      );
      // Թարմացնենք ամփոփ վիճակագրությունը
      void loadScreenings();
    } else {
      alert(result.error || 'Կարգավիճակը թարմացնելիս սխալ է տեղի ունեցել');
    }
    setUpdatingId(null);
  };

  const handleDeleteScreening = async (
    e: React.MouseEvent,
    screening: ScreeningSummary
  ) => {
    e.stopPropagation();
    const soldLabel =
      screening.sold > 0
        ? `\nՎաճառված/ամրագրված տոմսեր՝ ${screening.sold}։`
        : '';
    if (
      !confirm(
        `Ջնջե՞լ այս ցուցադրությունը (${formatDate(screening.startTime)} · ${formatTime(screening.startTime)})։${soldLabel}\n\nԿջնջվեն նաև բոլոր կապված տոմսերը, վճարումները և պատվերները։ Այս գործողությունը հետ չի բերվում։`
      )
    ) {
      return;
    }

    setDeletingId(screening.id);
    const result = await deleteScreening(screening.id);
    if (result.success) {
      setScreenings((prev) => prev.filter((s) => s.id !== screening.id));
      if (openScreeningId === screening.id) {
        setOpenScreeningId(null);
        setTickets([]);
      }
    } else {
      alert(result.error || 'Ցուցադրությունը ջնջելիս սխալ է տեղի ունեցել');
    }
    setDeletingId(null);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
                <TicketIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight">
                  {movie.title}
                </h2>
                <p className="text-xs text-white/80">
                  Ցուցադրություններ և տոմսեր
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 transition hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : screenings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center text-gray-500">
                <Calendar className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                Այս ֆիլմի համար ցուցադրություններ չկան
              </div>
            ) : (
              <div className="space-y-3">
                {screenings.map((s) => (
                  <div
                    key={s.id}
                    className="overflow-hidden rounded-xl border border-gray-200"
                  >
                    <div className="flex w-full items-center gap-2 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleScreening(s.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-90"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900">
                            {formatDate(s.startTime)} ·{' '}
                            {formatTime(s.startTime)}
                          </p>
                          <p className="flex items-center gap-2 text-xs text-gray-500">
                            <Clock className="h-3 w-3" />
                            {s.hallName} · {s.sold}/{s.capacity} վաճառված ·{' '}
                            {formatAmd(s.revenue)}
                          </p>
                        </div>
                        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                          {STATUS_ORDER.map((st) =>
                            s.counts[st] > 0 ? (
                              <span
                                key={st}
                                title={STATUS_META[st].label}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_META[st].badge}`}
                              >
                                {s.counts[st]}
                              </span>
                            ) : null
                          )}
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${
                            openScreeningId === s.id ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        title="Ջնջել ցուցադրությունը"
                        disabled={deletingId === s.id}
                        onClick={(e) => void handleDeleteScreening(e, s)}
                        className="shrink-0 rounded-lg p-2 text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                      >
                        {deletingId === s.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {openScreeningId === s.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-t border-gray-100 bg-gray-50"
                        >
                          <div className="p-3 sm:p-4">
                            {ticketsLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                              </div>
                            ) : tickets.length === 0 ? (
                              <p className="py-6 text-center text-sm text-gray-400">
                                Այս ցուցադրության համար տոմսեր չկան
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {tickets.map((t) => (
                                  <TicketRow
                                    key={t.id}
                                    ticket={t}
                                    updating={updatingId === t.id}
                                    onChangeStatus={handleChangeStatus}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function TicketRow({
  ticket,
  updating,
  onChangeStatus,
}: {
  ticket: AdminTicket;
  updating: boolean;
  onChangeStatus: (id: number, status: TicketStatus) => void;
}) {
  const status = (
    ['reserved', 'awaiting_payment', 'paid', 'used', 'cancelled'].includes(
      ticket.status
    )
      ? ticket.status
      : 'reserved'
  ) as TicketStatus;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Seat */}
        <div className="flex h-11 min-w-11 items-center justify-center rounded-lg bg-purple-50 px-2 font-bold text-purple-700">
          <Armchair className="mr-1 h-4 w-4" />
          {ticket.seat ? `${ticket.seat.row}${ticket.seat.number}` : '—'}
        </div>

        {/* User */}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-gray-900">
            <User className="h-3.5 w-3.5 text-gray-400" />
            {ticket.user?.name || 'Անանուն'}
          </p>
          <p className="flex items-center gap-3 text-xs text-gray-500">
            {ticket.user?.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {ticket.user.phone}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Wallet className="h-3 w-3" />
              {formatAmd(ticket.price)}
            </span>
            {ticket.seat?.seatType === 'vip' && (
              <span className="font-semibold text-amber-500">VIP</span>
            )}
          </p>
        </div>

        {/* Current status badge */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_META[status].badge}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${STATUS_META[status].dot}`}
          />
          {STATUS_META[status].label}
        </span>
      </div>

      {/* Status change buttons */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2">
        <span className="mr-1 text-xs text-gray-400">Փոխել՝</span>
        {STATUS_ORDER.map((st) => {
          const active = st === status;
          return (
            <button
              key={st}
              disabled={active || updating}
              onClick={() => onChangeStatus(ticket.id, st)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                active
                  ? `${STATUS_META[st].badge} cursor-default`
                  : 'border border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700'
              } ${updating ? 'opacity-50' : ''}`}
            >
              {STATUS_META[st].label}
            </button>
          );
        })}
        {updating && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600" />
        )}
      </div>
    </div>
  );
}
