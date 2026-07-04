'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  RefreshCw,
  ShoppingBag,
  Ticket,
  X,
} from 'lucide-react';
import AdminLayout from './admin-layout';
import {
  getPreparationScreening,
  getPreparationScreenings,
  setTicketPreparationServed,
} from '@/app/actions/preparation';

interface AdminPreparationClientProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
  };
}

interface ProductItem {
  id: number;
  orderId: number;
  ticketId: number | null;
  productId: number;
  quantity: number;
  price: number;
  product: {
    id: number;
    name: string;
    category: string;
    image?: string | null;
    price: number;
  };
}

interface Seat {
  id: number;
  row: string;
  number: number;
  seatType: string;
}

interface PrepTicket {
  id: number;
  status: string;
  price: number;
  qrCode?: string | null;
  preparationServedAt: Date | string | null;
  user: {
    id: number;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  seat: Seat;
  orderId: number | null;
  order: {
    id: number;
    totalAmount: number;
    status: string;
    paymentMethod: string;
  } | null;
  seatItems: ProductItem[];
  unassignedOrderItems: ProductItem[];
}

interface PrepScreening {
  id: number;
  startTime: Date | string;
  endTime: Date | string;
  basePrice: number;
  movie: {
    id: number;
    title: string;
    image?: string | null;
    duration: number;
  };
  hall: {
    id: number;
    name: string;
    capacity: number;
    seats: Seat[];
  };
  tickets: PrepTicket[];
  productSummary: Array<{
    productId: number;
    name: string;
    category: string;
    image?: string | null;
    quantity: number;
  }>;
}

const MONTHS = [
  'հունվ',
  'փետ',
  'մարտ',
  'ապր',
  'մայիս',
  'հունիս',
  'հուլիս',
  'օգոս',
  'սեպ',
  'հոկ',
  'նոյ',
  'դեկ',
];

function formatDateTime(value: Date | string) {
  const d = new Date(value);
  const day = d.getDate();
  const month = MONTHS[d.getMonth()] ?? '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month}, ${hh}:${mm}`;
}

function formatTime(value: Date | string) {
  const d = new Date(value);
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

function statusLabel(status: string) {
  if (status === 'paid') return 'Վճարված';
  if (status === 'reserved') return 'Ամրագրված';
  return status;
}

function itemSummary(items: ProductItem[]) {
  if (items.length === 0) return 'Պատվեր չկա';
  return items
    .map((item) => `${item.product.name} x${item.quantity}`)
    .join(', ');
}

function getSeatClass(
  seat: Seat,
  ticket?: PrepTicket
) {
  if (seat.seatType === 'disabled') {
    return 'bg-gray-300 text-gray-500 cursor-not-allowed';
  }
  if (!ticket) {
    return 'bg-white text-gray-500 border-gray-200 hover:border-gray-300';
  }
  if (ticket.preparationServedAt) {
    return 'bg-slate-700 text-white border-slate-700 ring-2 ring-slate-200';
  }
  if (ticket.status === 'paid') {
    return 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-100';
  }
  return 'bg-amber-500 text-white border-amber-500 ring-2 ring-amber-100';
}

export default function AdminPreparationClient({
  user,
}: AdminPreparationClientProps) {
  const [screenings, setScreenings] = useState<PrepScreening[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<PrepScreening | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<PrepTicket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savingTicketId, setSavingTicketId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await getPreparationScreenings();
    if (!result.success) {
      setError(result.error || 'Բեռնման սխալ');
      setScreenings([]);
      setSelected(null);
      setIsLoading(false);
      return;
    }

    const rows = result.screenings as PrepScreening[];
    setScreenings(rows);
    const nextSelectedId = selectedId ?? rows[0]?.id ?? null;
    setSelectedId(nextSelectedId);
    setSelected(rows.find((s) => s.id === nextSelectedId) ?? rows[0] ?? null);
    setIsLoading(false);
  }, [selectedId]);

  const refreshSelected = useCallback(
    async (id = selectedId) => {
      if (!id) return;
      setIsRefreshing(true);
      setError(null);
      const result = await getPreparationScreening(id);
      if (result.success && result.screening) {
        const next = result.screening as PrepScreening;
        setSelected(next);
        setScreenings((prev) => prev.map((s) => (s.id === next.id ? next : s)));
        setSelectedTicket((current) =>
          current ? next.tickets.find((t) => t.id === current.id) ?? null : null
        );
      } else {
        setError(result.error || 'Ցուցադրությունը բեռնելիս սխալ է տեղի ունեցել');
      }
      setIsRefreshing(false);
    },
    [selectedId]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSelectScreening = async (id: number) => {
    setSelectedId(id);
    const cached = screenings.find((s) => s.id === id) ?? null;
    setSelected(cached);
    setSelectedTicket(null);
    await refreshSelected(id);
  };

  const seatsByRow = useMemo(() => {
    const grouped = new Map<string, Seat[]>();
    for (const seat of selected?.hall.seats ?? []) {
      if (!grouped.has(seat.row)) grouped.set(seat.row, []);
      grouped.get(seat.row)!.push(seat);
    }
    grouped.forEach((rowSeats) =>
      rowSeats.sort((a, b) => a.number - b.number)
    );
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [selected]);

  const ticketBySeatId = useMemo(() => {
    const map = new Map<number, PrepTicket>();
    for (const ticket of selected?.tickets ?? []) {
      map.set(ticket.seat.id, ticket);
    }
    return map;
  }, [selected]);

  const stats = useMemo(() => {
    const tickets = selected?.tickets ?? [];
    const withProducts = tickets.filter(
      (ticket) =>
        ticket.seatItems.length > 0 || ticket.unassignedOrderItems.length > 0
    ).length;
    const served = tickets.filter((ticket) => ticket.preparationServedAt).length;
    return {
      waiting: tickets.length,
      withProducts,
      served,
      remaining: Math.max(0, tickets.length - served),
    };
  }, [selected]);

  const toggleServed = async (ticket: PrepTicket, served: boolean) => {
    setSavingTicketId(ticket.id);
    setError(null);
    const result = await setTicketPreparationServed(ticket.id, served);
    if (!result.success) {
      setError(result.error || 'Նշումը չպահպանվեց');
      setSavingTicketId(null);
      return;
    }
    await refreshSelected(selected?.id ?? selectedId);
    setSavingTicketId(null);
  };

  const selectedItems = selectedTicket
    ? [...selectedTicket.seatItems, ...selectedTicket.unassignedOrderItems]
    : [];

  return (
    <AdminLayout user={user}>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-7 h-7 text-purple-600" />
              Պատվերների նախապատրաստում
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Այսօրվա և հաջորդող ցուցադրությունների տոմսերը և ապրանքները՝ ըստ
              նստատեղերի
            </p>
          </div>
          <button
            type="button"
            onClick={() => refreshSelected()}
            disabled={!selected || isRefreshing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Թարմացնել
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-gray-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Բեռնվում է...
          </div>
        ) : screenings.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center text-gray-500">
            Առաջիկա ցուցադրություններ չկան
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ընտրել ցուցադրությունը
              </label>
              <select
                value={selected?.id ?? ''}
                onChange={(e) => handleSelectScreening(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              >
                {screenings.map((screening) => (
                  <option key={screening.id} value={screening.id}>
                    {formatDateTime(screening.startTime)} ·{' '}
                    {screening.movie.title} · {screening.hall.name}
                  </option>
                ))}
              </select>
            </div>

            {selected && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <StatCard
                    icon={<Ticket className="w-5 h-5 text-purple-600" />}
                    label="Սպասվող տոմսեր"
                    value={stats.waiting}
                  />
                  <StatCard
                    icon={<ShoppingBag className="w-5 h-5 text-amber-600" />}
                    label="Ապրանքով աթոռներ"
                    value={stats.withProducts}
                  />
                  <StatCard
                    icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                    label="Սպասարկված"
                    value={stats.served}
                  />
                  <StatCard
                    icon={<Clock className="w-5 h-5 text-rose-600" />}
                    label="Մնացել է"
                    value={stats.remaining}
                  />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">
                          {selected.movie.title}
                        </h2>
                        <p className="text-sm text-gray-500">
                          {formatDateTime(selected.startTime)} -{' '}
                          {formatTime(selected.endTime)} · {selected.hall.name}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <Legend color="bg-white border border-gray-300" label="Ազատ" />
                        <Legend color="bg-amber-500" label="Ամրագրված" />
                        <Legend color="bg-emerald-600" label="Վճարված" />
                        <Legend color="bg-slate-700" label="Սպասարկված" />
                      </div>
                    </div>

                    <div className="mb-8 text-center">
                      <div className="inline-block bg-linear-to-r from-purple-600 to-pink-600 text-white px-12 py-2 rounded-t-xl shadow-sm">
                        ԷԿՐԱՆ
                      </div>
                    </div>

                    <div className="space-y-2 pb-2">
                      {seatsByRow.map(([row, rowSeats]) => (
                        <div key={row} className="flex items-center gap-3 min-w-max">
                          <div className="w-10 text-center font-semibold text-gray-500">
                            {row}
                          </div>
                          <div className="flex gap-1.5">
                            {rowSeats.map((seat) => {
                              const ticket = ticketBySeatId.get(seat.id);
                              const allItems = ticket
                                ? [
                                    ...ticket.seatItems,
                                    ...ticket.unassignedOrderItems,
                                  ]
                                : [];
                              const canOpen = Boolean(ticket);
                              return (
                                <button
                                  key={seat.id}
                                  type="button"
                                  disabled={!canOpen}
                                  onClick={() => ticket && setSelectedTicket(ticket)}
                                  className={`group relative w-11 h-11 rounded-lg border text-xs font-bold transition-all ${getSeatClass(
                                    seat,
                                    ticket
                                  )} ${
                                    allItems.length > 0
                                      ? 'after:absolute after:-top-1 after:-right-1 after:w-3 after:h-3 after:bg-purple-500 after:rounded-full after:ring-2 after:ring-white'
                                      : ''
                                  }`}
                                >
                                  {seat.number}
                                  <span className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-left text-xs font-normal text-white shadow-xl group-hover:block">
                                    <span className="block font-semibold mb-1">
                                      {row}
                                      {seat.number}
                                      {ticket ? ` · ${statusLabel(ticket.status)}` : ''}
                                    </span>
                                    {ticket ? (
                                      <>
                                        <span className="block">
                                          {ticket.user?.name ||
                                            ticket.user?.phone ||
                                            'Հաճախորդ'}
                                        </span>
                                        <span className="block mt-1 text-white/80">
                                          {allItems.length > 0
                                            ? itemSummary(allItems)
                                            : 'Լրացուցիչ պատվեր չկա'}
                                        </span>
                                        {ticket.preparationServedAt && (
                                          <span className="block mt-1 text-emerald-300">
                                            Սպասարկված է
                                          </span>
                                        )}
                                      </>
                                    ) : (
                                      <span className="block text-white/80">
                                        Ակտիվ տոմս չկա
                                      </span>
                                    )}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <aside className="space-y-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <h3 className="font-bold text-gray-900 mb-3">
                        Ընդհանուր պատրաստվող ապրանքներ
                      </h3>
                      {selected.productSummary.length === 0 ? (
                        <p className="text-sm text-gray-500">Ապրանքներ չկան</p>
                      ) : (
                        <div className="space-y-2">
                          {selected.productSummary.map((item) => (
                            <div
                              key={item.productId}
                              className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2"
                            >
                              <span className="text-sm font-medium text-gray-900">
                                {item.name}
                              </span>
                              <span className="rounded-full bg-purple-100 px-2.5 py-1 text-sm font-bold text-purple-700">
                                x{item.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4 text-sm text-purple-800">
                      Ապրանք ունեցող աթոռները նշված են մանուշակագույն կետով։
                      Աթոռի վրա պահեք մկնիկը՝ արագ տեսնելու, սեղմեք՝ մանրամասների
                      և սպասարկված նշելու համար։
                    </div>
                  </aside>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {selectedTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Նստատեղ {selectedTicket.seat.row}
                  {selectedTicket.seat.number}
                </h3>
                <p className="text-sm text-gray-500">
                  {statusLabel(selectedTicket.status)} · Պատվեր #
                  {selectedTicket.orderId ?? '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl bg-gray-50 p-4 mb-4 text-sm space-y-2">
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Հաճախորդ</span>
                <span className="font-medium text-gray-900 text-right">
                  {selectedTicket.user?.name ||
                    selectedTicket.user?.phone ||
                    selectedTicket.user?.email ||
                    '—'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Հեռախոս</span>
                <span className="font-medium text-gray-900">
                  {selectedTicket.user?.phone || '—'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Սպասարկում</span>
                <span
                  className={`font-semibold ${
                    selectedTicket.preparationServedAt
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }`}
                >
                  {selectedTicket.preparationServedAt
                    ? 'Սպասարկված է'
                    : 'Սպասարկված չէ'}
                </span>
              </div>
            </div>

            <div className="mb-5">
              <h4 className="font-semibold text-gray-900 mb-2">
                Այս աթոռի պատվերները
              </h4>
              {selectedItems.length === 0 ? (
                <p className="rounded-lg border border-gray-200 p-3 text-sm text-gray-500">
                  Լրացուցիչ ապրանքներ չկան
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedItems.map((item) => (
                    <div
                      key={`${item.id}-${item.ticketId ?? 'order'}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {item.product.name}
                        </p>
                        {item.ticketId === null && (
                          <p className="text-xs text-gray-500">
                            Ընդհանուր պատվեր
                          </p>
                        )}
                      </div>
                      <span className="rounded-full bg-purple-100 px-2.5 py-1 text-sm font-bold text-purple-700">
                        x{item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={savingTicketId === selectedTicket.id}
              onClick={() =>
                toggleServed(
                  selectedTicket,
                  !Boolean(selectedTicket.preparationServedAt)
                )
              }
              className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition-colors disabled:opacity-60 ${
                selectedTicket.preparationServedAt
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {savingTicketId === selectedTicket.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {selectedTicket.preparationServedAt
                ? 'Հանել սպասարկված նշումը'
                : 'Նշել որպես սպասարկված'}
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded ${color}`} />
      {label}
    </span>
  );
}
