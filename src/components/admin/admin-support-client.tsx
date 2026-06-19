'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Download,
  FileText,
  Headphones,
  Loader2,
  MessageCircle,
  Search,
  Send,
  X,
} from 'lucide-react';
import {
  addStaffSupportMessage,
  getAllSupportRequests,
  getSupportMessages,
  getSupportRequestById,
  updateSupportRequest,
} from '@/app/actions/support';

type SupportStatus = 'new' | 'in_progress' | 'resolved' | 'archived';

interface SupportAttachment {
  id: number;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  size: number;
}

interface SupportRequest {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  subject: string;
  message: string;
  status: SupportStatus;
  adminNote?: string | null;
  userId?: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  user?: {
    id: number;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  attachments: SupportAttachment[];
  messages: Array<{
    id: number;
    senderType: 'customer' | 'staff';
    senderName: string;
    message: string;
    createdAt: Date | string;
    pending?: boolean;
  }>;
}

const statusLabels: Record<SupportStatus, string> = {
  new: 'Նոր',
  in_progress: 'Ընթացքում',
  resolved: 'Լուծված',
  archived: 'Արխիվ',
};

const statusStyles: Record<SupportStatus, string> = {
  new: 'bg-red-50 text-red-700 border-red-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
  archived: 'bg-gray-50 text-gray-700 border-gray-200',
};

function formatDate(value: Date | string) {
  return new Date(value).toLocaleString('hy-AM', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminSupportClient({
  initialRequestId,
}: {
  initialRequestId?: number;
}) {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [selected, setSelected] = useState<SupportRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [reply, setReply] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const tempIdRef = useRef(-1);

  const loadRequests = async () => {
    setIsLoading(true);
    setError(null);
    const result = await getAllSupportRequests();
    if (result.success) {
      setRequests(result.requests as SupportRequest[]);
    } else {
      setError(result.error || 'Հարցումները բեռնելիս սխալ է տեղի ունեցել');
    }
    setIsLoading(false);
  };

  const openRequest = async (id: number) => {
    const result = await getSupportRequestById(id);
    if (result.success && result.request) {
      const request = result.request as SupportRequest;
      setSelected(request);
      setNote(request.adminNote || '');
      setReply('');
      setShowInfo(false);
      if (request.status === 'new') {
        await updateSupportRequest({ id, status: 'in_progress' });
        await loadRequests();
      }
    }
  };

  const refreshSelectedRequest = async (id: number) => {
    const lastRealId = (selected?.messages || []).reduce(
      (max, m) => (m.id > 0 && m.id > max ? m.id : max),
      0
    );
    const result = await getSupportMessages(id, lastRealId);
    if (!result.success) return;
    setSelected((current) => {
      if (!current || current.id !== id) return current;
      const known = new Map<number, SupportRequest['messages'][number]>();
      for (const m of current.messages) {
        if (m.id > 0) known.set(m.id, m);
      }
      for (const m of result.messages as SupportRequest['messages']) {
        known.set(m.id, m);
      }
      const real = Array.from(known.values()).sort((a, b) => a.id - b.id);
      const stillPending = current.messages.filter(
        (m) =>
          m.pending &&
          !real.some(
            (r) => r.message === m.message && r.senderType === 'staff'
          )
      );
      return {
        ...current,
        status: (result.status as SupportStatus) || current.status,
        messages: [...real, ...stillPending],
      };
    });
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  useEffect(() => {
    if (initialRequestId) {
      void openRequest(initialRequestId);
    }
  }, [initialRequestId]);

  useEffect(() => {
    if (!selected?.id) return;

    const interval = window.setInterval(() => {
      void refreshSelectedRequest(selected.id);
    }, 4000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  useEffect(() => {
    if (!selected?.messages.length) return;
    setTimeout(() => {
      chatScrollRef.current?.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 100);
  }, [selected?.messages.length]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return requests.filter((request) => {
      const matchesStatus =
        statusFilter === 'all' || request.status === statusFilter;
      const matchesQuery =
        !q ||
        request.name.toLowerCase().includes(q) ||
        request.phone.includes(q) ||
        request.subject.toLowerCase().includes(q) ||
        request.message.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [requests, statusFilter, query]);

  const updateSelected = async (status?: SupportStatus) => {
    if (!selected) return;
    const result = await updateSupportRequest({
      id: selected.id,
      status,
      adminNote: note,
    });
    if (result.success) {
      await loadRequests();
      await openRequest(selected.id);
    }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim() || isSending) return;
    const text = reply.trim();
    const requestId = selected.id;
    const tempId = tempIdRef.current--;

    setReply('');
    setError(null);
    setIsSending(true);
    setSelected((current) =>
      current && current.id === requestId
        ? {
            ...current,
            status: 'in_progress',
            messages: [
              ...current.messages,
              {
                id: tempId,
                senderType: 'staff',
                senderName: 'Դուք',
                message: text,
                createdAt: new Date(),
                pending: true,
              },
            ],
          }
        : current
    );

    try {
      const result = await addStaffSupportMessage({ requestId, message: text });
      if (!result.success) {
        setSelected((current) =>
          current && current.id === requestId
            ? {
                ...current,
                messages: current.messages.filter((m) => m.id !== tempId),
              }
            : current
        );
        setReply(text);
        setError(result.error || 'Պատասխանը ուղարկելիս սխալ է տեղի ունեցել');
        return;
      }
      await refreshSelectedRequest(requestId);
      void loadRequests();
    } catch {
      setSelected((current) =>
        current && current.id === requestId
          ? {
              ...current,
              messages: current.messages.filter((m) => m.id !== tempId),
            }
          : current
      );
      setReply(text);
      setError('Պատասխանը ուղարկելիս սխալ է տեղի ունեցել');
    } finally {
      setIsSending(false);
    }
  };

  const handleReplyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendReply();
    }
  };

  return (
    <div className="flex h-[calc(100dvh-2rem)] min-h-[560px] flex-col p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Headphones className="h-7 w-7 text-red-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Աջակցություն</h1>
          <p className="text-sm text-gray-600">
            Զրույցների ցուցակ և օգտատերերին պատասխանելու չատ
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Ձախ պանել՝ զրույցների ցուցակ */}
        <aside
          className={`${
            selected ? 'hidden lg:flex' : 'flex'
          } w-full shrink-0 flex-col border-r border-gray-100 lg:w-[340px]`}
        >
          <div className="space-y-3 border-b border-gray-100 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                placeholder="Որոնել..."
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
            >
              <option value="all">Բոլորը</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-gray-500">
                Բեռնվում է...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                Հարցումներ չկան
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map((request) => {
                  const isActive = selected?.id === request.id;
                  const last =
                    request.messages[request.messages.length - 1] ||
                    request.messages[0];
                  return (
                    <button
                      key={request.id}
                      onClick={() => openRequest(request.id)}
                      className={`flex w-full items-start gap-3 p-3 text-left transition ${
                        isActive
                          ? 'bg-red-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-700">
                        {request.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-gray-900">
                            {request.name}
                          </span>
                          <span className="shrink-0 text-[11px] text-gray-400">
                            {formatDate(request.createdAt)}
                          </span>
                        </div>
                        <p className="truncate text-xs font-medium text-gray-500">
                          #{request.id} · {request.subject}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">
                          {last?.senderType === 'staff' ? 'Դուք՝ ' : ''}
                          {last?.message || request.message}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            statusStyles[request.status]
                          }`}
                        >
                          {statusLabels[request.status]}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Աջ պանել՝ զրույց */}
        <section
          className={`${
            selected ? 'flex' : 'hidden lg:flex'
          } min-w-0 flex-1 flex-col bg-gray-50`}
        >
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-gray-400">
              <MessageCircle className="h-12 w-12" />
              <p className="text-sm">Ընտրեք զրույց՝ պատասխանելու համար</p>
            </div>
          ) : (
            <>
              {/* Չատի վերնագիր */}
              <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-full p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
                  aria-label="Հետ"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-700">
                  {selected.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">
                    {selected.name}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    #{selected.id} · {selected.phone} · {selected.subject}
                  </p>
                </div>
                <select
                  value={selected.status}
                  onChange={(e) =>
                    updateSelected(e.target.value as SupportStatus)
                  }
                  className={`hidden rounded-lg border px-2 py-1.5 text-xs font-semibold sm:block ${
                    statusStyles[selected.status]
                  }`}
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowInfo((v) => !v)}
                  className={`rounded-full p-2 transition ${
                    showInfo
                      ? 'bg-red-100 text-red-600'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                  aria-label="Մանրամասներ"
                >
                  <FileText className="h-5 w-5" />
                </button>
              </div>

              {/* Մանրամասների վահանակ */}
              {showInfo && (
                <div className="space-y-4 border-b border-gray-200 bg-white px-4 py-4">
                  <div className="sm:hidden">
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      Կարգավիճակ
                    </label>
                    <select
                      value={selected.status}
                      onChange={(e) =>
                        updateSelected(e.target.value as SupportStatus)
                      }
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selected.attachments.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold text-gray-700">
                        Կցված ֆայլեր
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {selected.attachments.map((file) => (
                          <a
                            key={file.id}
                            href={file.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 text-xs hover:border-red-300 hover:bg-red-50"
                          >
                            <Download className="h-4 w-4 shrink-0 text-red-600" />
                            <span className="min-w-0 flex-1 truncate">
                              {file.fileName}
                            </span>
                            <span className="shrink-0 text-gray-400">
                              {formatSize(file.size)}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      Ներքին նշում (միայն աշխատակիցների համար)
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                      placeholder="Ներքին նշում..."
                    />
                    <button
                      onClick={() => updateSelected()}
                      className="mt-2 flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Պահպանել նշումը
                    </button>
                  </div>
                </div>
              )}

              {/* Հաղորդագրություններ */}
              <div
                ref={chatScrollRef}
                className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4"
              >
                {selected.messages.map((item) => {
                  const isStaff = item.senderType === 'staff';
                  return (
                    <div
                      key={item.id}
                      className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${
                          isStaff
                            ? 'rounded-br-md bg-red-600 text-white'
                            : 'rounded-bl-md bg-white text-gray-800 shadow-sm'
                        }`}
                      >
                        {!isStaff && (
                          <p className="mb-0.5 text-[11px] font-semibold text-red-600">
                            {item.senderName}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap wrap-break-word">
                          {item.message}
                        </p>
                        <div
                          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                            isStaff ? 'text-white/70' : 'text-gray-400'
                          }`}
                        >
                          <span>{formatDate(item.createdAt)}</span>
                          {isStaff && item.pending && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Պատասխանի դաշտ */}
              <div className="flex items-end gap-2 border-t border-gray-200 bg-white p-3">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={handleReplyKeyDown}
                  rows={1}
                  className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-gray-300 px-3.5 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                  placeholder="Գրել պատասխան... (Enter՝ ուղարկել)"
                />
                <button
                  onClick={sendReply}
                  disabled={!reply.trim() || isSending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-500 disabled:opacity-50"
                  aria-label="Ուղարկել"
                >
                  {isSending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

