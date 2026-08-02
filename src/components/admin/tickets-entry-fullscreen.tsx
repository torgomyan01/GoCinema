'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Check,
  CheckCircle,
  Film,
  MapPin,
  Clock,
  ScanLine,
  ShoppingCart,
} from 'lucide-react';
import {
  isTicketQrReady,
  ticketNeedsQrScan,
  ticketQrScanProgress,
} from '@/lib/preorder-entry';

interface TicketsEntryFullscreenProps {
  open: boolean;
  onClose: () => void;
  tickets: any[];
  formatTime: (date: Date | string) => string;
  getStatusBadge: (status: string) => { label: string; color: string };
  getSeatTypeLabel: (seatType: string) => string;
  onEntryChange: (ticketId: number, checked: boolean) => Promise<boolean> | boolean;
  onScanPreOrderProducts?: (ticket: any) => void;
}

export default function TicketsEntryFullscreen({
  open,
  onClose,
  tickets,
  formatTime,
  getStatusBadge,
  getSeatTypeLabel,
  onEntryChange,
  onScanPreOrderProducts,
}: TicketsEntryFullscreenProps) {
  const [mounted, setMounted] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const handleToggle = useCallback(
    async (ticket: any) => {
      const id = Number(ticket.id);
      const canToggle =
        ticket.status === 'paid' || ticket.status === 'used';
      if (!canToggle || pendingIds.has(id)) return;

      const nextChecked = ticket.status !== 'used';
      setPendingIds((prev) => new Set(prev).add(id));
      try {
        await onEntryChange(id, nextChecked);
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [onEntryChange, pendingIds]
  );

  if (!mounted || !open) return null;

  const usedCount = tickets.filter((t) => t.status === 'used').length;
  const movieTitle =
    tickets[0]?.screening?.movie?.title || 'Տոմսեր';
  const hallName = tickets[0]?.screening?.hall?.name;
  const startTime = tickets[0]?.screening?.startTime;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-slate-50"
      role="dialog"
      aria-modal="true"
      aria-label="Բոլոր տոմսերի արագ հաստատում"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">
            Արագ մուտք · {tickets.length} տոմս
          </p>
          <h2 className="truncate text-lg font-bold text-gray-900 sm:text-xl">
            {movieTitle}
          </h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 sm:text-sm">
            {hallName && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {hallName}
              </span>
            )}
            {startTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatTime(startTime)}
              </span>
            )}
            <span className="flex items-center gap-1 font-medium text-green-700">
              <CheckCircle className="h-3.5 w-3.5" />
              {usedCount}/{tickets.length} մուտք
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
          aria-label="Փակել"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-5">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tickets.map((ticket) => {
            const id = Number(ticket.id);
            const isUsed = ticket.status === 'used';
            const canToggle =
              ticket.status === 'paid' || ticket.status === 'used';
            const isPending = pendingIds.has(id);
            const statusBadge = getStatusBadge(ticket.status);
            const seatLabel = `${ticket.seat?.row ?? ''}${ticket.seat?.number ?? ''}`;
            const needsQr = ticketNeedsQrScan(ticket);
            const qrReady = isTicketQrReady(ticket);
            const qrProgress = ticketQrScanProgress(ticket);
            const productCount = ticket.orderItems?.length ?? 0;

            return (
              <div
                key={ticket.id}
                className={`flex flex-col rounded-2xl border-2 bg-white p-4 shadow-sm transition ${
                  isUsed
                    ? 'border-green-400 bg-green-50/40'
                    : 'border-gray-200'
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-gray-500">Տեղ</p>
                    <p className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                      {seatLabel || '—'}
                    </p>
                    {ticket.seat?.seatType &&
                      ticket.seat.seatType !== 'standard' && (
                        <p className="mt-0.5 text-xs font-medium text-purple-600">
                          {getSeatTypeLabel(ticket.seat.seatType)}
                        </p>
                      )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${statusBadge.color}`}
                  >
                    {statusBadge.label}
                  </span>
                </div>

                <div className="mb-3 space-y-1 text-xs text-gray-600">
                  <div className="flex items-center gap-1.5 truncate">
                    <Film className="h-3.5 w-3.5 shrink-0 text-purple-500" />
                    <span className="truncate">
                      {ticket.screening?.movie?.title || 'Անհայտ ֆիլմ'}
                    </span>
                  </div>
                  {productCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <ShoppingCart className="h-3.5 w-3.5 text-gray-400" />
                      {productCount} ապրանք
                      {needsQr && (
                        <span className="text-amber-600">
                          · QR {qrProgress.done}/{qrProgress.total}
                        </span>
                      )}
                      {qrReady && !needsQr && productCount > 0 && (
                        <span className="text-green-600">· QR պատրաստ</span>
                      )}
                    </div>
                  )}
                </div>

                {needsQr && onScanPreOrderProducts && (
                  <button
                    type="button"
                    onClick={() => onScanPreOrderProducts(ticket)}
                    className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 py-2.5 text-sm font-semibold text-purple-700 hover:bg-purple-100"
                  >
                    <ScanLine className="h-4 w-4" />
                    Սկանավորել QR
                  </button>
                )}

                {canToggle ? (
                  <label
                    className={`mt-auto flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3.5 transition ${
                      isUsed
                        ? 'border-green-400 bg-green-100'
                        : 'border-purple-200 bg-purple-50 hover:border-purple-400'
                    } ${isPending ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isUsed}
                      disabled={isPending}
                      onChange={() => void handleToggle(ticket)}
                      className="h-8 w-8 shrink-0 cursor-pointer rounded border-2 border-gray-300 text-purple-600 focus:ring-2 focus:ring-purple-500 disabled:cursor-not-allowed"
                    />
                    <span className="min-w-0 flex-1">
                      {isPending ? (
                        <span className="flex items-center gap-2 text-base font-bold text-gray-600">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
                          Նշվում է...
                        </span>
                      ) : isUsed ? (
                        <span className="flex items-center gap-1.5 text-base font-bold text-green-700">
                          <Check className="h-5 w-5" />
                          Մուտք է գործել
                        </span>
                      ) : (
                        <span className="text-base font-bold text-purple-800">
                          Հաստատել մուտքը
                        </span>
                      )}
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {isUsed
                          ? 'Անջատելու համար հանեք նշումը'
                          : 'Նշեք՝ անցումը հաստատելու համար'}
                      </span>
                    </span>
                  </label>
                ) : (
                  <div className="mt-auto rounded-xl bg-gray-100 py-3 text-center text-sm font-medium text-gray-500">
                    Մուտք հնարավոր չէ ({statusBadge.label})
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            Մուտք գործած՝{' '}
            <span className="font-bold text-green-700">
              {usedCount}/{tickets.length}
            </span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Փակել
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
