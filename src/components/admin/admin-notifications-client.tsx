'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CheckCheck,
  Trash2,
  Ticket as TicketIcon,
  ShoppingBag,
  Banknote,
  Ban,
  Headphones,
  Mail,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotification,
  clearAllNotifications,
} from '@/app/actions/notifications';

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string | Date;
}

type FilterType =
  | 'all'
  | 'unread'
  | 'online_ticket'
  | 'online_product'
  | 'box_office'
  | 'cancellation'
  | 'support'
  | 'contact';

const typeStyles: Record<
  string,
  { icon: typeof Bell; color: string; bg: string; label: string }
> = {
  online_ticket: {
    icon: TicketIcon,
    color: 'text-green-600',
    bg: 'bg-green-50',
    label: 'Օնլայն տոմս',
  },
  online_product: {
    icon: ShoppingBag,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    label: 'Օնլայն ապրանք',
  },
  box_office: {
    icon: Banknote,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    label: 'Դրամարկղ',
  },
  cancellation: {
    icon: Ban,
    color: 'text-red-600',
    bg: 'bg-red-50',
    label: 'Չեղարկում',
  },
  support: {
    icon: Headphones,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    label: 'Աջակցություն',
  },
  contact: {
    icon: Mail,
    color: 'text-sky-600',
    bg: 'bg-sky-50',
    label: 'Կոնտակտ',
  },
};

function getTypeStyle(type: string) {
  return (
    typeStyles[type] || {
      icon: Bell,
      color: 'text-gray-600',
      bg: 'bg-gray-50',
      label: 'Այլ',
    }
  );
}

function formatDateTime(value: string | Date): string {
  const d = new Date(value);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hh}:${mm}`;
}

export default function AdminNotificationsClient() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  const load = async () => {
    setIsLoading(true);
    setError(null);
    const result = await getNotifications(100);
    if (result.success) {
      setItems(result.notifications as unknown as NotificationItem[]);
    } else {
      setError(result.error || 'Ծանուցումները բեռնելիս սխալ է տեղի ունեցել');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    return {
      all: items.length,
      unread: items.filter((n) => !n.isRead).length,
      online_ticket: items.filter((n) => n.type === 'online_ticket').length,
      online_product: items.filter((n) => n.type === 'online_product').length,
      box_office: items.filter((n) => n.type === 'box_office').length,
      cancellation: items.filter((n) => n.type === 'cancellation').length,
      support: items.filter((n) => n.type === 'support').length,
      contact: items.filter((n) => n.type === 'contact').length,
    };
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'unread') return items.filter((n) => !n.isRead);
    return items.filter((n) => n.type === filter);
  }, [items, filter]);

  const handleOpen = async (item: NotificationItem) => {
    if (!item.isRead) {
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      await markNotificationRead(item.id);
    }
    if (item.link) router.push(item.link);
  };

  const handleMarkAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await markAllNotificationsRead();
  };

  const handleDelete = async (id: number) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(id);
  };

  const handleClearAll = async () => {
    if (!confirm('Ջնջե՞լ բոլոր ծանուցումները։')) return;
    setItems([]);
    await clearAllNotifications();
  };

  const filterTabs: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'Բոլորը' },
    { key: 'unread', label: 'Չկարդացած' },
    { key: 'online_ticket', label: 'Օնլայն տոմս' },
    { key: 'online_product', label: 'Օնլայն ապրանք' },
    { key: 'box_office', label: 'Դրամարկղ' },
    { key: 'cancellation', label: 'Չեղարկում' },
    { key: 'support', label: 'Աջակցություն' },
    { key: 'contact', label: 'Կոնտակտ' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-linear-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                <Bell className="h-5 w-5" />
              </span>
              Ծանուցումներ
            </h1>
            <p className="mt-2 text-gray-600">
              Օնլայն վաճառքներ, դրամարկղ, չեղարկումներ և աջակցության հարցումներ։
            </p>
          </div>
          <div className="flex items-center gap-2">
            {counts.unread > 0 && (
              <button
                onClick={handleMarkAll}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
              >
                <CheckCheck className="h-4 w-4" />
                Նշել բոլորը կարդացված
              </button>
            )}
            {items.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Trash2 className="h-4 w-4" />
                Մաքրել
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === tab.key
                  ? 'border-purple-600 bg-purple-600 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300'
              }`}
            >
              {tab.label}
              <span className="ml-1 text-[10px] opacity-70">
                ({counts[tab.key]})
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="py-16 text-center">
            <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-purple-600" />
            <p className="text-gray-600">Բեռնվում է...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-600" />
            <p className="text-gray-700">{error}</p>
            <button
              onClick={load}
              className="mt-4 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700"
            >
              Կրկին փորձել
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
              <Bell className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-lg font-semibold text-gray-900">
              Ծանուցումներ չկան
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => {
              const style = getTypeStyle(item.type);
              const Icon = style.icon;
              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 rounded-xl border bg-white p-4 shadow-sm transition-colors ${
                    item.isRead ? 'border-gray-100' : 'border-purple-200 bg-purple-50/30'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${style.bg} ${style.color}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <button
                    onClick={() => handleOpen(item)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">
                        {item.title}
                      </p>
                      {!item.isRead && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.color}`}
                      >
                        {style.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{item.message}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    title="Ջնջել"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
