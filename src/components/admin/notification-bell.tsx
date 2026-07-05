'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Check,
  CheckCheck,
  Ticket as TicketIcon,
  ShoppingBag,
  Banknote,
  Ban,
  Headphones,
  Mail,
  X,
} from 'lucide-react';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
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

const POLL_INTERVAL = 20000; // 20 վրկ
const LAST_SEEN_KEY = 'gocinema_admin_last_seen_notification';

const typeStyles: Record<
  string,
  { icon: typeof Bell; color: string; bg: string }
> = {
  online_ticket: { icon: TicketIcon, color: 'text-green-600', bg: 'bg-green-50' },
  online_product: {
    icon: ShoppingBag,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  box_office: { icon: Banknote, color: 'text-amber-600', bg: 'bg-amber-50' },
  cancellation: { icon: Ban, color: 'text-red-600', bg: 'bg-red-50' },
  support: { icon: Headphones, color: 'text-blue-600', bg: 'bg-blue-50' },
  contact: { icon: Mail, color: 'text-sky-600', bg: 'bg-sky-50' },
};

function getTypeStyle(type: string) {
  return (
    typeStyles[type] || { icon: Bell, color: 'text-gray-600', bg: 'bg-gray-50' }
  );
}

function timeAgo(value: string | Date): string {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'հենց նոր';
  if (mins < 60) return `${mins} ր առաջ`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ժ առաջ`;
  const days = Math.floor(hours / 24);
  return `${days} օր առաջ`;
}

/** Կարճ ձայնային ազդանշան՝ Web Audio API-ով (առանց աուդիո ֆայլի) */
function playBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [880, 1175];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
      osc.start(start);
      osc.stop(start + 0.16);
    });
    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // անտեսում ենք
  }
}

export default function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [toasts, setToasts] = useState<NotificationItem[]>([]);

  const lastSeenRef = useRef<number>(0);
  const initializedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = Number(localStorage.getItem(LAST_SEEN_KEY) || '0');
    lastSeenRef.current = Number.isFinite(stored) ? stored : 0;
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const load = useCallback(async () => {
    const result = await getNotifications(20);
    if (!result.success) return;

    const list = result.notifications as unknown as NotificationItem[];
    setItems(list);
    setUnreadCount(result.unreadCount);

    const maxId = list.reduce((max, n) => Math.max(max, n.id), 0);

    if (!initializedRef.current) {
      // Առաջին բեռնում — միայն baseline, առանց ազդանշանի
      initializedRef.current = true;
      if (lastSeenRef.current === 0) {
        lastSeenRef.current = maxId;
        localStorage.setItem(LAST_SEEN_KEY, String(maxId));
      }
      return;
    }

    // Նոր ծանուցումներ՝ lastSeen-ից հետո
    const fresh = list.filter((n) => n.id > lastSeenRef.current);
    if (fresh.length > 0) {
      playBeep();
      setToasts((prev) => [...fresh.slice(0, 3), ...prev].slice(0, 4));
      fresh.slice(0, 3).forEach((n) => {
        setTimeout(() => dismissToast(n.id), 8000);
      });
      lastSeenRef.current = maxId;
      localStorage.setItem(LAST_SEEN_KEY, String(maxId));
    }
  }, [dismissToast]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [load]);

  // Փակել dropdown-ը դրսում սեղմելիս
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleOpenItem = async (item: NotificationItem) => {
    if (!item.isRead) {
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      await markNotificationRead(item.id);
    }
    setIsOpen(false);
    if (item.link) router.push(item.link);
  };

  const handleMarkAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await markAllNotificationsRead();
  };

  const handleToastClick = async (item: NotificationItem) => {
    dismissToast(item.id);
    await handleOpenItem(item);
  };

  return (
    <>
      <div className="relative" ref={containerRef}>
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Ծանուցումներ"
        >
          <Bell className="w-6 h-6 text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[70vh] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl z-50 flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                  <Bell className="w-4 h-4 text-purple-600" />
                  Ծանուցումներ
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                      {unreadCount}
                    </span>
                  )}
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAll}
                    className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Նշել կարդացված
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center text-gray-400">
                    <Bell className="w-10 h-10" />
                    <p className="text-sm">Ծանուցումներ չկան</p>
                  </div>
                ) : (
                  items.map((item) => {
                    const style = getTypeStyle(item.type);
                    const Icon = style.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleOpenItem(item)}
                        className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                          item.isRead ? '' : 'bg-purple-50/40'
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.bg} ${style.color}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {item.title}
                            </p>
                            {!item.isRead && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">
                            {item.message}
                          </p>
                          <p className="mt-1 text-[11px] text-gray-400">
                            {timeAgo(item.createdAt)}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="border-t border-gray-100 p-2">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    router.push('/admin/notifications');
                  }}
                  className="w-full rounded-lg px-4 py-2 text-center text-sm font-medium text-purple-600 hover:bg-purple-50"
                >
                  Տեսնել բոլորը
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toast-եր նոր ծանուցումների համար */}
      <div className="fixed right-4 top-20 z-60 flex w-80 flex-col gap-2">
        <AnimatePresence>
          {toasts.map((item) => {
            const style = getTypeStyle(item.type);
            const Icon = style.icon;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 60 }}
                onClick={() => handleToastClick(item)}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-lg hover:shadow-xl"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.bg} ${style.color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {item.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">
                    {item.message}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissToast(item.id);
                  }}
                  className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}
