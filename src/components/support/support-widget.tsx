'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import {
  AlertCircle,
  Check,
  Headphones,
  Loader2,
  Paperclip,
  Send,
  X,
} from 'lucide-react';
import {
  addSupportMessage,
  createSupportRequest,
  getMySupportRequest,
  getSupportMessages,
  getSupportRequestById,
} from '@/app/actions/support';
import { formatTimeHy } from '@/lib/format';

interface ChatMessage {
  id: number;
  senderType: 'customer' | 'staff';
  senderName: string;
  message: string;
  createdAt: Date | string;
  pending?: boolean;
}

interface ChatMeta {
  id: number;
  subject: string;
  status: string;
}

const STORAGE_KEY = 'gocinema_support_request_id';
const READ_KEY = 'gocinema_support_last_read_id';
const OPEN_POLL_MS = 4000;
const BACKGROUND_POLL_MS = 15000;

const statusLabels: Record<string, string> = {
  new: 'Նոր',
  in_progress: 'Ընթացքում',
  resolved: 'Լուծված',
  archived: 'Արխիվ',
};

function formatTime(value: Date | string) {
  return formatTimeHy(value);
}

export default function SupportWidget() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ChatMeta | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const startFormRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tempIdRef = useRef(-1);
  const isLoggedIn = Boolean(session?.user);
  const pathname = usePathname();
  const isAdminArea = pathname?.startsWith('/admin') ?? false;

  const lastRealId = messages.reduce(
    (max, m) => (m.id > 0 && m.id > max ? m.id : max),
    0
  );

  const mergeMessages = useCallback((incoming: ChatMessage[]) => {
    setMessages((prev) => {
      const known = new Map<number, ChatMessage>();
      for (const m of prev) {
        if (m.id > 0) known.set(m.id, m);
      }
      for (const m of incoming) known.set(m.id, m);
      const real = Array.from(known.values()).sort((a, b) => a.id - b.id);
      const stillPending = prev.filter(
        (m) =>
          m.pending &&
          !real.some(
            (r) => r.message === m.message && r.senderType === 'customer'
          )
      );
      return [...real, ...stillPending];
    });
  }, []);

  const markRead = useCallback((msgs: ChatMessage[]) => {
    const maxId = msgs.reduce((max, m) => (m.id > max ? m.id : max), 0);
    if (maxId > 0) {
      localStorage.setItem(READ_KEY, String(maxId));
      setUnread(0);
    }
  }, []);

  const loadFullChat = useCallback(async (requestId: number) => {
    const result = await getSupportRequestById(requestId);
    if (result.success && result.request) {
      const req = result.request as any;
      setMeta({ id: req.id, subject: req.subject, status: req.status });
      setMessages(req.messages as ChatMessage[]);
      return req.messages as ChatMessage[];
    }
    localStorage.removeItem(STORAGE_KEY);
    setMeta(null);
    setMessages([]);
    return null;
  }, []);

  const pollMessages = useCallback(
    async (requestId: number, open: boolean) => {
      const result = await getSupportMessages(requestId, lastRealId);
      if (!result.success) return;
      if (result.messages.length > 0) {
        mergeMessages(result.messages as ChatMessage[]);
      }
      if (result.status) {
        setMeta((prev) =>
          prev ? { ...prev, status: result.status as string } : prev
        );
      }
      if (open) {
        // viewing -> everything is read
        const allIds = result.messages.map((m: any) => m.id);
        const maxId = Math.max(lastRealId, ...(allIds.length ? allIds : [0]));
        if (maxId > 0) localStorage.setItem(READ_KEY, String(maxId));
        setUnread(0);
      } else {
        const lastRead = Number(localStorage.getItem(READ_KEY)) || 0;
        const newStaff = result.messages.filter(
          (m: any) => m.senderType === 'staff' && m.id > lastRead
        );
        if (newStaff.length > 0) setUnread((u) => u + newStaff.length);
      }
    },
    [lastRealId, mergeMessages]
  );

  useEffect(() => {
    const initChat = async () => {
      if (session?.user) {
        const result = await getMySupportRequest();
        if (result.success && result.request) {
          const req = result.request as {
            id: number;
            subject: string;
            status: string;
            messages: ChatMessage[];
          };
          localStorage.setItem(STORAGE_KEY, String(req.id));
          setMeta({ id: req.id, subject: req.subject, status: req.status });
          setMessages(req.messages);
          return;
        }
      }

      const stored = Number(localStorage.getItem(STORAGE_KEY));
      if (Number.isFinite(stored) && stored > 0) {
        await loadFullChat(stored);
      }
    };

    void initChat();
  }, [session?.user, loadFullChat]);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      });
    }
  }, [messages.length, isOpen]);

  useEffect(() => {
    if (isOpen) markRead(messages);
  }, [isOpen, messages, markRead]);

  useEffect(() => {
    if (!meta?.id) return;
    const interval = window.setInterval(
      () => {
        void pollMessages(meta.id, isOpen);
      },
      isOpen ? OPEN_POLL_MS : BACKGROUND_POLL_MS
    );
    return () => window.clearInterval(interval);
  }, [meta?.id, isOpen, pollMessages]);

  const handleStartChat = async (formData: FormData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await createSupportRequest(formData);
      if (!result.success) {
        setError(result.error || 'Հարցումը ուղարկելիս սխալ է տեղի ունեցել');
        return;
      }
      startFormRef.current?.reset();
      localStorage.setItem(STORAGE_KEY, String(result.requestId));
      await loadFullChat(result.requestId as number);
    } catch (err) {
      console.error('Support request error:', err);
      setError('Հարցումը ուղարկելիս սխալ է տեղի ունեցել');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSend = async () => {
    if (!meta) return;
    const text = draft.trim();
    if (!text && files.length === 0) return;

    const senderName = session?.user?.name || session?.user?.phone || 'Դուք';
    const tempId = tempIdRef.current--;
    const optimistic: ChatMessage = {
      id: tempId,
      senderType: 'customer',
      senderName,
      message: text,
      createdAt: new Date(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    const sentFiles = files;
    setDraft('');
    setFiles([]);
    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set('requestId', String(meta.id));
      formData.set('message', text);
      for (const file of sentFiles) formData.append('attachments', file);

      const result = await addSupportMessage(formData);
      if (!result.success) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setDraft(text);
        setError(
          result.error || 'Հաղորդագրությունը ուղարկելիս սխալ է տեղի ունեցել'
        );
        return;
      }
      await pollMessages(meta.id, true);
    } catch (err) {
      console.error('Support chat error:', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
      setError('Հաղորդագրությունը ուղարկելիս սխալ է տեղի ունեցել');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (isAdminArea) return null;

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-12 right-5 z-50 shadow-xl flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-2xl shadow-red-950/30 transition hover:bg-red-500"
          aria-label="Աջակցություն"
        >
          <Headphones className="h-5 w-5" />
          <span className="hidden sm:inline">Աջակցություն</span>
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-500 px-1.5 text-xs font-bold text-white">
              {unread}
            </span>
          )}
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-50 flex h-dvh w-full flex-col bg-white shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[600px] sm:max-h-[85vh] sm:w-[400px] sm:rounded-2xl"
          >
            <div className="flex items-center justify-between gap-3 rounded-t-2xl bg-red-600 px-4 py-3 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                  <Headphones className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight">
                    Տեխնիկական աջակցություն
                  </p>
                  <p className="text-xs text-white/80">
                    {meta
                      ? `#${meta.id} · ${statusLabels[meta.status] || meta.status}`
                      : 'Սովորաբար պատասխանում ենք րոպեների ընթացքում'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                aria-label="Փակել"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!meta ? (
              <form
                ref={startFormRef}
                action={handleStartChat}
                className="flex-1 space-y-4 overflow-y-auto p-4"
              >
                {!isLoggedIn && (
                  <>
                    <p className="text-xs text-gray-500">
                      Յուրաքանչյուր հեռախոսահամարի համար մեկ աջակցության չատ է։
                      Նույն համարով կրկին գրելիս հաղորդագրությունը կգնա նույն
                      չատ։
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        name="name"
                        required
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                        placeholder="Անուն"
                      />
                      <input
                        name="phone"
                        required
                        inputMode="tel"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                        placeholder="077123456"
                      />
                    </div>
                  </>
                )}

                {isLoggedIn && (
                  <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                    Ձեր աջակցության չատը մեկ է՝{' '}
                    <span className="font-semibold text-gray-900">
                      {session?.user?.name || session?.user?.phone}
                    </span>
                    : գրեք հաղորդագրություն, և մենք կպատասխանենք նույն չատում։
                  </div>
                )}

                <input type="hidden" name="subject" value="Աջակցություն" />

                <textarea
                  name="message"
                  required
                  rows={4}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                  placeholder="Գրեք ձեր հարցը..."
                />

                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-600 hover:border-red-300 hover:bg-red-50">
                  <Paperclip className="h-4 w-4" />
                  <span>Կցել ֆայլեր (առավելագույնը 5)</span>
                  <input
                    name="attachments"
                    type="file"
                    multiple
                    className="hidden"
                    accept="image/*,.pdf,.txt"
                  />
                </label>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {isSubmitting ? 'Ուղարկվում է...' : 'Ուղարկել'}
                </button>
              </form>
            ) : (
              <>
                <div
                  ref={scrollRef}
                  className="flex-1 space-y-2.5 overflow-y-auto bg-gray-50 p-4"
                >
                  {messages.map((item) => {
                    const isCustomer = item.senderType === 'customer';
                    return (
                      <div
                        key={item.id}
                        className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                            isCustomer
                              ? 'rounded-br-md bg-red-600 text-white'
                              : 'rounded-bl-md bg-white text-gray-800 shadow-sm'
                          }`}
                        >
                          {!isCustomer && (
                            <p className="mb-0.5 text-[11px] font-semibold text-red-600">
                              {item.senderName}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap wrap-break-word">
                            {item.message}
                          </p>
                          <div
                            className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                              isCustomer ? 'text-white/70' : 'text-gray-400'
                            }`}
                          >
                            <span>{formatTime(item.createdAt)}</span>
                            {isCustomer &&
                              (item.pending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {error && (
                  <div className="flex items-start gap-2 border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {error}
                  </div>
                )}

                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2 border-t border-gray-100 px-4 py-2">
                    {files.map((file, idx) => (
                      <span
                        key={`${file.name}-${idx}`}
                        className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700"
                      >
                        <Paperclip className="h-3 w-3" />
                        <span className="max-w-32 truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setFiles((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-gray-400 hover:text-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2 border-t border-gray-100 p-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-red-600"
                    aria-label="Կցել ֆայլ"
                  >
                    <Paperclip className="h-5 w-5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept="image/*,.pdf,.txt"
                    onChange={(e) => {
                      const selected = Array.from(e.target.files || []);
                      setFiles((prev) => [...prev, ...selected].slice(0, 5));
                      e.target.value = '';
                    }}
                  />
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    className="max-h-28 min-h-10 flex-1 resize-none rounded-2xl border border-gray-300 px-3.5 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                    placeholder="Գրել հաղորդագրություն..."
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={
                      isSubmitting || (!draft.trim() && files.length === 0)
                    }
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-500 disabled:opacity-50"
                    aria-label="Ուղարկել"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
