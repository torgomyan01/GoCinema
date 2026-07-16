'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Ticket as TicketIcon,
  AlertCircle,
  Search,
  Filter,
  User,
  Calendar as CalendarIcon,
  Clock,
  Film,
  BarChart3,
  List,
  Armchair,
  TrendingUp,
  Clapperboard,
} from 'lucide-react';
import AdminLayout from './admin-layout';
import AdminTicketCard from './ticket-card';
import { getAllTicketsForAdmin } from '@/app/actions/tickets';
import { getScreenings } from '@/app/actions/screenings';
import { markTicketAsUsed, unmarkTicketAsUsed } from '@/app/actions/scanner';

type ViewMode = 'list' | 'screenings';

type TicketStatus = 'all' | 'reserved' | 'paid' | 'used' | 'cancelled';

interface AdminTicketsClientProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
  };
}

export default function AdminTicketsClient({ user }: AdminTicketsClientProps) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingIds, setMarkingIds] = useState<Set<number>>(new Set());
  const [selectedMovieId, setSelectedMovieId] = useState<'all' | string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [screenings, setScreenings] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [ticketsResult, screeningsResult] = await Promise.all([
          getAllTicketsForAdmin(),
          getScreenings(),
        ]);

        if (ticketsResult.success && ticketsResult.tickets) {
          setTickets(ticketsResult.tickets as any[]);
        } else {
          setError(
            ticketsResult.error || 'Տոմսերը բեռնելիս սխալ է տեղի ունեցել'
          );
        }

        if (screeningsResult.success && screeningsResult.screenings) {
          setScreenings(screeningsResult.screenings as any[]);
        }
      } catch (err) {
        console.error('[Admin Tickets] load error:', err);
        setError('Տոմսերը բեռնելիս սխալ է տեղի ունեցել');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const months = [
      'հունվար',
      'փետրվար',
      'մարտ',
      'ապրիլ',
      'մայիս',
      'հունիս',
      'հուլիս',
      'օգոստոս',
      'սեպտեմբեր',
      'հոկտեմբեր',
      'նոյեմբեր',
      'դեկտեմբեր',
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('hy-AM', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Local date key (avoids UTC off-by-one issues from toISOString)
  const getLocalDateKey = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return {
          label: 'Վճարված',
          color: 'bg-green-100 text-green-700',
        };
      case 'awaiting_payment':
        return {
          label: 'Սպասում է վճարման',
          color: 'bg-amber-100 text-amber-700',
        };
      case 'reserved':
        return {
          label: 'Ամրագրված',
          color: 'bg-yellow-100 text-yellow-700',
        };
      case 'used':
        return {
          label: 'Օգտագործված',
          color: 'bg-blue-100 text-blue-700',
        };
      case 'cancelled':
        return {
          label: 'Չեղարկված',
          color: 'bg-red-100 text-red-700',
        };
      default:
        return {
          label: status,
          color: 'bg-gray-100 text-gray-700',
        };
    }
  };

  const getSeatTypeLabel = (seatType: string) => {
    switch (seatType) {
      case 'vip':
        return 'VIP';
      case 'love':
      case 'couple':
        return 'Զույգ';
      default:
        return 'Ստանդարտ';
    }
  };

  const handleCheckedChange = async (
    ticketId: string,
    checked: boolean
  ): Promise<boolean> => {
    const idNum = Number(ticketId);
    if (Number.isNaN(idNum)) return false;

    setMarkingIds((prev) => new Set(prev).add(idNum));
    try {
      const result = checked
        ? await markTicketAsUsed(idNum)
        : await unmarkTicketAsUsed(idNum);
      if (result.success) {
        setTickets((prev) =>
          prev.map((t) =>
            t.id === idNum
              ? {
                  ...t,
                  status: checked ? 'used' : 'paid',
                }
              : t
          )
        );
        return true;
      }
      alert(
        result.error ||
          (checked
            ? 'Տոմսը օգտագործված նշելու ժամանակ սխալ տեղի ունեցավ'
            : 'Տոմսը վճարված վերադարձնելիս սխալ տեղի ունեցավ')
      );
      return false;
    } catch (err) {
      console.error('[Admin Tickets] entry toggle error:', err);
      alert(
        checked
          ? 'Տոմսը օգտագործված նշելու ժամանակ սխալ տեղի ունեցավ'
          : 'Տոմսը վճարված վերադարձնելիս սխալ տեղի ունեցավ'
      );
      return false;
    } finally {
      setMarkingIds((prev) => {
        const next = new Set(prev);
        next.delete(idNum);
        return next;
      });
    }
  };

  const movieOptions = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    tickets.forEach((t) => {
      const movieId = t.screening?.movie?.id;
      const title = t.screening?.movie?.title;
      if (!movieId || !title) return;
      const key = String(movieId);
      if (!map.has(key)) {
        map.set(key, { id: key, title });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.title.localeCompare(b.title, 'hy')
    );
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    let result = [...tickets];

    if (selectedStatus !== 'all') {
      // «Ամրագրված» ֆիլտրը ընդգրկում է նաև օնլայն «սպասում է վճարման»-ը։
      result = result.filter((t) =>
        selectedStatus === 'reserved'
          ? t.status === 'reserved' || t.status === 'awaiting_payment'
          : t.status === selectedStatus
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => {
        const movieTitle = t.screening?.movie?.title?.toLowerCase() || '';
        const hallName = t.screening?.hall?.name?.toLowerCase() || '';
        const userName = t.user?.name?.toLowerCase() || '';
        const userPhone = t.user?.phone?.toLowerCase() || '';
        return (
          movieTitle.includes(q) ||
          hallName.includes(q) ||
          userName.includes(q) ||
          userPhone.includes(q) ||
          String(t.id).includes(q)
        );
      });
    }

    if (selectedMovieId !== 'all') {
      result = result.filter(
        (t) => String(t.screening?.movie?.id || '') === selectedMovieId
      );
    }

    // Sort first by screening date (newest first), then by movie title
    result.sort((a, b) => {
      const dateA = new Date(a.screening?.startTime || a.createdAt || 0).getTime();
      const dateB = new Date(b.screening?.startTime || b.createdAt || 0).getTime();

      if (dateA !== dateB) {
        return dateB - dateA; // newer dates first
      }

      const titleA = (a.screening?.movie?.title || '').toLowerCase();
      const titleB = (b.screening?.movie?.title || '').toLowerCase();

      if (titleA < titleB) return -1;
      if (titleA > titleB) return 1;
      return 0;
    });

    return result;
  }, [tickets, selectedStatus, searchQuery, selectedMovieId]);

  const stats = useMemo(() => {
    const total = tickets.length;
    const paid = tickets.filter((t) => t.status === 'paid').length;
    const used = tickets.filter((t) => t.status === 'used').length;
    const reserved = tickets.filter(
      (t) => t.status === 'reserved' || t.status === 'awaiting_payment'
    ).length;
    const cancelled = tickets.filter((t) => t.status === 'cancelled').length;
    const revenue = tickets
      .filter((t) => t.status === 'paid' || t.status === 'used')
      .reduce((sum, t) => sum + (t.price || 0), 0);
    return { total, paid, used, reserved, cancelled, revenue };
  }, [tickets]);

  const statusCounts = useMemo(() => {
    return {
      all: tickets.length,
      reserved: tickets.filter(
        (t) => t.status === 'reserved' || t.status === 'awaiting_payment'
      ).length,
      paid: tickets.filter((t) => t.status === 'paid').length,
      used: tickets.filter((t) => t.status === 'used').length,
      cancelled: tickets.filter((t) => t.status === 'cancelled').length,
    };
  }, [tickets]);

  const movieAnalytics = useMemo(() => {
    if (selectedMovieId === 'all') return null;

    const movieTickets = tickets.filter(
      (t) => String(t.screening?.movie?.id || '') === selectedMovieId
    );

    if (movieTickets.length === 0) return null;

    const movieTitle =
      movieTickets[0].screening?.movie?.title || 'Անհայտ ֆիլմ';

    const total = movieTickets.length;
    const paid = movieTickets.filter((t) => t.status === 'paid').length;
    const used = movieTickets.filter((t) => t.status === 'used').length;
    const reserved = movieTickets.filter(
      (t) => t.status === 'reserved' || t.status === 'awaiting_payment'
    ).length;
    const cancelled = movieTickets.filter(
      (t) => t.status === 'cancelled'
    ).length;
    const revenue = movieTickets
      .filter((t) => t.status === 'paid' || t.status === 'used')
      .reduce((sum, t) => sum + (t.price || 0), 0);

    const byDateMap = new Map<
      string,
      { count: number; revenue: number; firstDate: Date }
    >();

    movieTickets.forEach((t) => {
      const d = new Date(t.screening?.startTime || t.createdAt || new Date());
      const key = getLocalDateKey(d);
      const existing = byDateMap.get(key);
      if (existing) {
        existing.count += 1;
        existing.revenue += t.price || 0;
      } else {
        byDateMap.set(key, {
          count: 1,
          revenue: t.price || 0,
          firstDate: d,
        });
      }
    });

    const byDate = Array.from(byDateMap.entries())
      .map(([key, value]) => ({
        dateKey: key,
        label: formatDate(value.firstDate),
        count: value.count,
        revenue: value.revenue,
      }))
      .sort(
        (a, b) =>
          new Date(a.dateKey).getTime() - new Date(b.dateKey).getTime()
      );

    return { movieTitle, total, paid, used, reserved, cancelled, revenue, byDate };
  }, [tickets, selectedMovieId]);

  // Revenue per screening (price is on tickets, not on the screening list payload)
  const revenueByScreening = useMemo(() => {
    const map = new Map<number, number>();
    tickets.forEach((t) => {
      if (t.status !== 'paid' && t.status !== 'used') return;
      const sid = t.screening?.id;
      if (!sid) return;
      map.set(sid, (map.get(sid) || 0) + (t.price || 0));
    });
    return map;
  }, [tickets]);

  // Per-movie, per-screening breakdown (sold / not sold / occupancy / revenue)
  const screeningGroups = useMemo(() => {
    let source = [...screenings];

    if (selectedMovieId !== 'all') {
      source = source.filter(
        (s) => String(s.movie?.id || '') === selectedMovieId
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      source = source.filter(
        (s) =>
          (s.movie?.title || '').toLowerCase().includes(q) ||
          (s.hall?.name || '').toLowerCase().includes(q)
      );
    }

    type Row = {
      id: number;
      startTime: Date | string;
      hallName: string;
      capacity: number;
      paid: number;
      used: number;
      reserved: number;
      cancelled: number;
      sold: number;
      notSold: number;
      revenue: number;
      occupancy: number;
    };

    const makeTotals = () => ({
      screenings: 0,
      capacity: 0,
      paid: 0,
      used: 0,
      reserved: 0,
      cancelled: 0,
      sold: 0,
      notSold: 0,
      revenue: 0,
    });

    const movieMap = new Map<
      string,
      {
        movieId: string;
        title: string;
        image: string | null;
        rows: Row[];
        totals: ReturnType<typeof makeTotals>;
      }
    >();

    source.forEach((s) => {
      const movieId = String(s.movie?.id || '');
      if (!movieId) return;

      const capacity = s.hall?.capacity || 0;
      let paid = 0;
      let used = 0;
      let reserved = 0;
      let cancelled = 0;
      (s.tickets || []).forEach((t: any) => {
        if (t.status === 'paid') paid += 1;
        else if (t.status === 'used') used += 1;
        else if (t.status === 'reserved' || t.status === 'awaiting_payment')
          reserved += 1;
        else if (t.status === 'cancelled') cancelled += 1;
      });

      const sold = paid + used;
      const occupied = sold + reserved;
      const notSold = Math.max(capacity - occupied, 0);
      const revenue = revenueByScreening.get(s.id) || 0;
      const occupancy = capacity > 0 ? sold / capacity : 0;

      const row: Row = {
        id: s.id,
        startTime: s.startTime,
        hallName: s.hall?.name || '—',
        capacity,
        paid,
        used,
        reserved,
        cancelled,
        sold,
        notSold,
        revenue,
        occupancy,
      };

      let group = movieMap.get(movieId);
      if (!group) {
        group = {
          movieId,
          title: s.movie?.title || 'Անհայտ ֆիլմ',
          image: s.movie?.image || null,
          rows: [],
          totals: makeTotals(),
        };
        movieMap.set(movieId, group);
      }

      group.rows.push(row);
      group.totals.screenings += 1;
      group.totals.capacity += capacity;
      group.totals.paid += paid;
      group.totals.used += used;
      group.totals.reserved += reserved;
      group.totals.cancelled += cancelled;
      group.totals.sold += sold;
      group.totals.notSold += notSold;
      group.totals.revenue += revenue;
    });

    const groups = Array.from(movieMap.values());
    groups.forEach((g) =>
      g.rows.sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      )
    );
    groups.sort((a, b) => b.totals.sold - a.totals.sold);
    return groups;
  }, [screenings, selectedMovieId, searchQuery, revenueByScreening]);

  const screeningTotals = useMemo(() => {
    return screeningGroups.reduce(
      (acc, g) => {
        acc.screenings += g.totals.screenings;
        acc.capacity += g.totals.capacity;
        acc.sold += g.totals.sold;
        acc.notSold += g.totals.notSold;
        acc.reserved += g.totals.reserved;
        acc.cancelled += g.totals.cancelled;
        acc.revenue += g.totals.revenue;
        return acc;
      },
      {
        screenings: 0,
        capacity: 0,
        sold: 0,
        notSold: 0,
        reserved: 0,
        cancelled: 0,
        revenue: 0,
      }
    );
  }, [screeningGroups]);

  return (
    <AdminLayout user={user}>
      <div className="flex-1 overflow-y-auto bg-linear-to-b from-slate-50 to-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-green-100 text-green-700">
                  <TicketIcon className="w-5 h-5" />
                </span>
                Տոմսեր
              </h1>
              <p className="text-gray-600 mt-2">
                Դիտեք և կառավարեք բոլոր գնված ու ամրագրված տոմսերը։
              </p>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div className="px-3 py-2 rounded-lg bg-white shadow-sm border border-gray-100">
                <p className="text-gray-500">Ընդամենը</p>
                <p className="text-lg font-semibold text-gray-900">
                  {stats.total}
                </p>
              </div>
              <div className="px-3 py-2 rounded-lg bg-white shadow-sm border border-gray-100">
                <p className="text-gray-500">Օգտագործված</p>
                <p className="text-lg font-semibold text-blue-600">
                  {stats.used}
                </p>
              </div>
              <div className="px-3 py-2 rounded-lg bg-white shadow-sm border border-gray-100 col-span-2 sm:col-span-1">
                <p className="text-gray-500">Շրջանառություն</p>
                <p className="text-lg font-semibold text-green-600">
                  {stats.revenue.toLocaleString('hy-AM')} ֏
                </p>
              </div>
            </div>
          </div>

          {/* View toggle */}
          <div className="inline-flex items-center gap-1 p-1 mb-4 rounded-xl bg-white shadow-sm border border-gray-100">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <List className="w-4 h-4" />
              Տոմսերի ցանկ
            </button>
            <button
              type="button"
              onClick={() => setViewMode('screenings')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'screenings'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Ցուցադրությունների վերլուծություն
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={
                    viewMode === 'screenings'
                      ? 'Փնտրել ըստ ֆիլմի կամ դահլիճի...'
                      : 'Փնտրել ըստ ֆիլմի, օգտատիրոջ, հեռախոսահամարի կամ ID-ի...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                />
              </div>
              {viewMode === 'list' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 uppercase">
                    <Filter className="w-3 h-3" />
                    Կարգավիճակ
                  </span>
                  {(
                    [
                      { key: 'all', label: 'Բոլորը' },
                      { key: 'reserved', label: 'Ամրագրված' },
                      { key: 'paid', label: 'Վճարված' },
                      { key: 'used', label: 'Օգտագործված' },
                      { key: 'cancelled', label: 'Չեղարկված' },
                    ] as { key: TicketStatus; label: string }[]
                  ).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSelectedStatus(item.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        selectedStatus === item.key
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      {item.label}{' '}
                      <span className="ml-1 text-[10px] opacity-70">
                        ({statusCounts[item.key]})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase">
                <Film className="w-3 h-3" />
                <span>Ֆիլմ</span>
              </div>
              <div className="flex-1 max-w-xs">
                <select
                  value={selectedMovieId}
                  onChange={(e) =>
                    setSelectedMovieId(
                      e.target.value === 'all' ? 'all' : e.target.value
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="all">Բոլոր ֆիլմերը</option>
                  {movieOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Movie analytics */}
          {viewMode === 'list' && movieAnalytics && (
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-800">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <span>Ֆիլմի ամփոփում</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  {movieAnalytics.movieTitle}
                </p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ընդհանուր տոմսեր</span>
                    <span className="font-semibold text-gray-900">
                      {movieAnalytics.total}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Վճարված</span>
                    <span className="font-semibold text-green-600">
                      {movieAnalytics.paid}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Օգտագործված</span>
                    <span className="font-semibold text-blue-600">
                      {movieAnalytics.used}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ամրագրված</span>
                    <span className="font-semibold text-yellow-600">
                      {movieAnalytics.reserved}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Չեղարկված</span>
                    <span className="font-semibold text-red-600">
                      {movieAnalytics.cancelled}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-100 mt-1">
                    <span className="text-gray-500">Շրջանառություն</span>
                    <span className="font-semibold text-green-700">
                      {movieAnalytics.revenue.toLocaleString('hy-AM')} ֏
                    </span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-800">
                  <CalendarIcon className="w-4 h-4 text-purple-600" />
                  <span>Տոմսեր ըստ օրերի</span>
                </div>
                {movieAnalytics.byDate.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    Այս ֆիլմի համար տոմսեր չկան ընտրված ֆիլտրերով։
                  </p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto text-sm">
                    {movieAnalytics.byDate.map((d) => (
                      <div
                        key={d.dateKey}
                        className="flex items-center justify-between px-2 py-1 rounded hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2 text-gray-700">
                          <span>{d.label}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-gray-500">
                            {d.count} տոմս
                          </span>
                          <span className="font-semibold text-green-600">
                            {d.revenue.toLocaleString('hy-AM')} ֏
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div className="py-16 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4" />
              <p className="text-gray-600">Տվյալները բեռնվում են...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center">
              <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-900 mb-2">
                Սխալ է տեղի ունեցել
              </p>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors"
              >
                Կրկին փորձել
              </button>
            </div>
          ) : viewMode === 'screenings' ? (
            screeningGroups.length === 0 ? (
              <div className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
                  <Clapperboard className="w-10 h-10 text-gray-400" />
                </div>
                <p className="text-xl font-bold text-gray-900 mb-2">
                  Ցուցադրություններ չեն գտնվել
                </p>
                <p className="text-gray-600">
                  Փորձեք փոխել ֆիլտրերը կամ որոնման հարցումը։
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Overall summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {[
                    {
                      label: 'Ցուցադրություններ',
                      value: screeningTotals.screenings.toLocaleString('hy-AM'),
                      color: 'text-gray-900',
                    },
                    {
                      label: 'Ընդհանուր տեղեր',
                      value: screeningTotals.capacity.toLocaleString('hy-AM'),
                      color: 'text-gray-900',
                    },
                    {
                      label: 'Վաճառված',
                      value: screeningTotals.sold.toLocaleString('hy-AM'),
                      color: 'text-green-600',
                    },
                    {
                      label: 'Չվաճառված',
                      value: screeningTotals.notSold.toLocaleString('hy-AM'),
                      color: 'text-gray-500',
                    },
                    {
                      label: 'Ամրագրված',
                      value: screeningTotals.reserved.toLocaleString('hy-AM'),
                      color: 'text-yellow-600',
                    },
                    {
                      label: 'Չեղարկված',
                      value: screeningTotals.cancelled.toLocaleString('hy-AM'),
                      color: 'text-red-600',
                    },
                    {
                      label: 'Շրջանառություն',
                      value: `${screeningTotals.revenue.toLocaleString('hy-AM')} ֏`,
                      color: 'text-green-700',
                    },
                  ].map((card) => (
                    <div
                      key={card.label}
                      className="px-3 py-2 rounded-lg bg-white shadow-sm border border-gray-100"
                    >
                      <p className="text-[11px] text-gray-500">{card.label}</p>
                      <p className={`text-lg font-semibold ${card.color}`}>
                        {card.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Per-movie breakdown */}
                {screeningGroups.map((group) => {
                  const occ =
                    group.totals.capacity > 0
                      ? group.totals.sold / group.totals.capacity
                      : 0;
                  return (
                    <div
                      key={group.movieId}
                      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                    >
                      {/* Movie header */}
                      <div className="flex items-center gap-4 p-4 border-b border-gray-100 bg-gray-50/60">
                        {group.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={group.image}
                            alt={group.title}
                            className="w-12 h-16 object-cover rounded-md shadow-sm"
                          />
                        ) : (
                          <div className="w-12 h-16 rounded-md bg-gray-200 flex items-center justify-center">
                            <Film className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold text-gray-900 truncate">
                            {group.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-600">
                            <span className="inline-flex items-center gap-1">
                              <Clapperboard className="w-3 h-3" />
                              {group.totals.screenings} ցուցադրություն
                            </span>
                            <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                              <TicketIcon className="w-3 h-3" />
                              {group.totals.sold} վաճառված
                            </span>
                            <span className="inline-flex items-center gap-1 text-gray-500">
                              <Armchair className="w-3 h-3" />
                              {group.totals.notSold} չվաճառված
                            </span>
                            <span className="inline-flex items-center gap-1 text-purple-600 font-medium">
                              <TrendingUp className="w-3 h-3" />
                              {Math.round(occ * 100)}% լրացվածություն
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] text-gray-500">
                            Շրջանառություն
                          </p>
                          <p className="text-base font-bold text-green-700">
                            {group.totals.revenue.toLocaleString('hy-AM')} ֏
                          </p>
                        </div>
                      </div>

                      {/* Screenings table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-gray-500 uppercase bg-gray-50/40">
                              <th className="px-4 py-2 font-medium">Ամսաթիվ</th>
                              <th className="px-3 py-2 font-medium">Ժամ</th>
                              <th className="px-3 py-2 font-medium">Դահլիճ</th>
                              <th className="px-3 py-2 font-medium text-center">
                                Տեղեր
                              </th>
                              <th className="px-3 py-2 font-medium text-center">
                                Վաճառված
                              </th>
                              <th className="px-3 py-2 font-medium text-center">
                                Չվաճառված
                              </th>
                              <th className="px-3 py-2 font-medium text-center">
                                Ամրագր.
                              </th>
                              <th className="px-3 py-2 font-medium text-center">
                                Չեղարկ.
                              </th>
                              <th className="px-3 py-2 font-medium text-center">
                                Լրացվ.
                              </th>
                              <th className="px-4 py-2 font-medium text-right">
                                Շրջանառություն
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {group.rows.map((row) => {
                              const pct = Math.round(row.occupancy * 100);
                              return (
                                <tr
                                  key={row.id}
                                  className="hover:bg-gray-50/60"
                                >
                                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">
                                    {formatDate(row.startTime)}
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">
                                    {formatTime(row.startTime)}
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">
                                    {row.hallName}
                                  </td>
                                  <td className="px-3 py-2.5 text-center text-gray-900 font-medium">
                                    {row.capacity}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-semibold text-green-600">
                                    {row.sold}
                                  </td>
                                  <td className="px-3 py-2.5 text-center text-gray-500">
                                    {row.notSold}
                                  </td>
                                  <td className="px-3 py-2.5 text-center text-yellow-600">
                                    {row.reserved}
                                  </td>
                                  <td className="px-3 py-2.5 text-center text-red-600">
                                    {row.cancelled}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <div className="flex items-center gap-2 justify-center">
                                      <div className="w-14 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${
                                            pct >= 80
                                              ? 'bg-green-500'
                                              : pct >= 40
                                                ? 'bg-yellow-500'
                                                : 'bg-purple-400'
                                          }`}
                                          style={{
                                            width: `${Math.min(pct, 100)}%`,
                                          }}
                                        />
                                      </div>
                                      <span className="text-xs text-gray-600 w-9 text-right">
                                        {pct}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-semibold text-green-700 whitespace-nowrap">
                                    {row.revenue.toLocaleString('hy-AM')} ֏
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50/70 font-semibold text-gray-800 text-xs">
                              <td className="px-4 py-2.5" colSpan={3}>
                                Ընդամենը՝ {group.totals.screenings} ցուցադրություն
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {group.totals.capacity}
                              </td>
                              <td className="px-3 py-2.5 text-center text-green-700">
                                {group.totals.sold}
                              </td>
                              <td className="px-3 py-2.5 text-center text-gray-500">
                                {group.totals.notSold}
                              </td>
                              <td className="px-3 py-2.5 text-center text-yellow-700">
                                {group.totals.reserved}
                              </td>
                              <td className="px-3 py-2.5 text-center text-red-700">
                                {group.totals.cancelled}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {Math.round(occ * 100)}%
                              </td>
                              <td className="px-4 py-2.5 text-right text-green-800 whitespace-nowrap">
                                {group.totals.revenue.toLocaleString('hy-AM')} ֏
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : filteredTickets.length === 0 ? (
            <div className="py-16 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
                <TicketIcon className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-xl font-bold text-gray-900 mb-2">
                Տոմսեր չեն գտնվել
              </p>
              <p className="text-gray-600">
                Փորձեք փոխել ֆիլտրերը կամ որոնման հարցումը։
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTickets.map((ticket) => (
                <AdminTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  formatDate={formatDate}
                  formatTime={formatTime}
                  getStatusBadge={getStatusBadge}
                  getSeatTypeLabel={getSeatTypeLabel}
                  onCheckedChange={handleCheckedChange}
                  isChecked={ticket.status === 'used'}
                  isMarking={markingIds.has(ticket.id)}
                />
              ))}
            </div>
          )}

          {/* Small footer info */}
          <div className="mt-10 text-xs text-gray-400 flex items-center gap-3">
            <User className="w-3 h-3" />
            <span>
              Ընդամենը {stats.total} տոմս • Վերջին թարմացում՝{' '}
              {tickets[0]?.createdAt
                ? formatDate(tickets[0].createdAt)
                : '—'}
            </span>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

