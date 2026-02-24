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
} from 'lucide-react';
import AdminLayout from './admin-layout';
import AdminTicketCard from './ticket-card';
import { getAllTicketsForAdmin } from '@/app/actions/tickets';
import { markTicketAsUsed } from '@/app/actions/scanner';

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

  useEffect(() => {
    const loadTickets = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getAllTicketsForAdmin();
        if (result.success && result.tickets) {
          setTickets(result.tickets as any[]);
        } else {
          setError(result.error || 'Տոմսերը բեռնելիս սխալ է տեղի ունեցել');
        }
      } catch (err) {
        console.error('[Admin Tickets] load error:', err);
        setError('Տոմսերը բեռնելիս սխալ է տեղի ունեցել');
      } finally {
        setIsLoading(false);
      }
    };

    loadTickets();
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return {
          label: 'Վճարված',
          color: 'bg-green-100 text-green-700',
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

  const handleCheckedChange = async (ticketId: string, checked: boolean) => {
    const idNum = Number(ticketId);
    if (!checked || Number.isNaN(idNum)) return;

    setMarkingIds((prev) => new Set(prev).add(idNum));
    try {
      const result = await markTicketAsUsed(idNum);
      if (result.success) {
        setTickets((prev) =>
          prev.map((t) =>
            t.id === idNum
              ? {
                  ...t,
                  status: 'used',
                }
              : t
          )
        );
      } else {
        alert(result.error || 'Տոմսը օգտագործված նշելու ժամանակ սխալ տեղի ունեցավ');
      }
    } catch (err) {
      console.error('[Admin Tickets] mark used error:', err);
      alert('Տոմսը օգտագործված նշելու ժամանակ սխալ տեղի ունեցավ');
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
      result = result.filter((t) => t.status === selectedStatus);
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
    const reserved = tickets.filter((t) => t.status === 'reserved').length;
    const cancelled = tickets.filter((t) => t.status === 'cancelled').length;
    const revenue = tickets
      .filter((t) => t.status === 'paid' || t.status === 'used')
      .reduce((sum, t) => sum + (t.price || 0), 0);
    return { total, paid, used, reserved, cancelled, revenue };
  }, [tickets]);

  const statusCounts = useMemo(() => {
    return {
      all: tickets.length,
      reserved: tickets.filter((t) => t.status === 'reserved').length,
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
    const reserved = movieTickets.filter((t) => t.status === 'reserved').length;
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
      const key = d.toISOString().split('T')[0];
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

  return (
    <AdminLayout user={user}>
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white">
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

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Փնտրել ըստ ֆիլմի, օգտատիրոջ, հեռախոսահամարի կամ ID-ի..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                />
              </div>
              <div className="flex flex-wrap.items-center gap-2">
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
          {movieAnalytics && (
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
                  <div className="flex justify_between">
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
              <p className="text-gray-600">Տոմսերը բեռնվում են...</p>
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

