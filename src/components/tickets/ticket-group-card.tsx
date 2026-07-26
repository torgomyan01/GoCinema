'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  QrCode,
  Download,
  ShoppingCart,
  Share2,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { SITE_URL } from '@/utils/consts';
import { formatDateHy, formatTimeHy } from '@/lib/format';
import { formatPaymentHoldRemaining } from '@/lib/reservation';
import { convertAwaitingPaymentOrderToCounter } from '@/app/actions/reservations';
import {
  formatSeatsLabel,
  getGroupQrCode,
  type TicketGroup,
} from './ticket-types';

interface TicketGroupCardProps {
  group: TicketGroup;
  index?: number;
  /** Եթե true՝ QR-ը ցույց տալ անմիջապես (հերո) */
  showInlineQr?: boolean;
  compact?: boolean;
  onOpenQr?: () => void;
}

function statusColor(status: string) {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-700';
    case 'awaiting_payment':
      return 'bg-amber-100 text-amber-700';
    case 'reserved':
      return 'bg-yellow-100 text-yellow-700';
    case 'used':
      return 'bg-blue-100 text-blue-700';
    case 'cancelled':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'paid':
      return 'Վճարված';
    case 'awaiting_payment':
      return 'Սպասում է վճարման';
    case 'reserved':
      return 'Ամրագրված';
    case 'used':
      return 'Օգտագործված';
    case 'cancelled':
      return 'Չեղարկված';
    default:
      return status;
  }
}

export default function TicketGroupCard({
  group,
  index = 0,
  showInlineQr = false,
  compact = false,
  onOpenQr,
}: TicketGroupCardProps) {
  const router = useRouter();
  const [showQRModal, setShowQRModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [holdLabel, setHoldLabel] = useState(() =>
    formatPaymentHoldRemaining(group.holdUntil)
  );
  const [isConverting, setIsConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const qrCodeRef = useRef<HTMLDivElement>(null);

  const isCounterReservation = group.paymentMethod === 'counter';
  const isAwaitingPayment = group.status === 'awaiting_payment';
  const qrData = getGroupQrCode(group);
  const seatsLabel = formatSeatsLabel(group);
  const canShowQr =
    group.status === 'paid' ||
    group.status === 'reserved' ||
    group.status === 'awaiting_payment';

  useEffect(() => {
    if (!isAwaitingPayment || !group.holdUntil) return;
    const tick = () => setHoldLabel(formatPaymentHoldRemaining(group.holdUntil));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [isAwaitingPayment, group.holdUntil]);

  const handleConvertToCounter = async () => {
    if (!group.orderId || isConverting) return;
    setIsConverting(true);
    setConvertError(null);
    try {
      const result = await convertAwaitingPaymentOrderToCounter(group.orderId);
      if (result.success) {
        router.refresh();
        window.location.reload();
      } else {
        setConvertError(result.error || 'Փոխարկումը ձախողվեց');
      }
    } catch {
      setConvertError('Փոխարկումը ձախողվեց');
    } finally {
      setIsConverting(false);
    }
  };

  const getShareUrl = () => {
    if (typeof window === 'undefined' || !qrData) return '';
    return `${window.location.origin}/ticket/share?code=${encodeURIComponent(qrData)}`;
  };

  const handleCopyShareLink = async () => {
    const url = getShareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  };

  const handleDownloadQR = () => {
    if (!qrCodeRef.current) return;
    const svg = qrCodeRef.current.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = document.createElement('img') as HTMLImageElement;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `order-${group.orderId ?? group.tickets[0]?.id}-qr.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      });
    };
    img.src =
      'data:image/svg+xml;base64,' +
      btoa(unescape(encodeURIComponent(svgData)));
  };

  const openQr = () => {
    if (onOpenQr) onOpenQr();
    else setShowQRModal(true);
  };

  const primaryCta = (() => {
    if (isAwaitingPayment && group.orderId) {
      return (
        <Link
          href={SITE_URL.PAYMENT(group.orderId)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:from-purple-700 hover:to-pink-700"
        >
          Վճարել հիմա
        </Link>
      );
    }
    if (group.status === 'reserved' && isCounterReservation) {
      return (
        <button
          type="button"
          onClick={openQr}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
        >
          <QrCode className="h-4 w-4" />
          Ցույց տալ QR · վճարում մուտքի մոտ
        </button>
      );
    }
    if (group.status === 'paid') {
      return (
        <button
          type="button"
          onClick={openQr}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
        >
          <QrCode className="h-4 w-4" />
          Մուտքի QR
        </button>
      );
    }
    if (canShowQr) {
      return (
        <button
          type="button"
          onClick={openQr}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
        >
          <QrCode className="h-4 w-4" />
          Դիտել QR
        </button>
      );
    }
    return null;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
    >
      <div
        className={`overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md ${
          compact ? '' : 'hover:shadow-lg'
        } transition-shadow`}
      >
        <div className="h-1 bg-gradient-to-r from-purple-600 via-pink-500 to-amber-400" />

        <div className={`flex flex-col ${showInlineQr ? 'sm:flex-row' : 'md:flex-row'}`}>
          <div
            className={`relative shrink-0 overflow-hidden bg-gray-200 ${
              showInlineQr
                ? 'h-40 w-full sm:h-auto sm:w-36'
                : 'h-36 w-full md:h-auto md:w-40'
            }`}
          >
            <Image
              src={
                group.screening.movie.image ||
                'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800'
              }
              alt={group.screening.movie.title}
              fill
              className="object-cover"
            />
          </div>

          <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor(group.status)}`}
              >
                {statusLabel(group.status)}
              </span>
              {isAwaitingPayment && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  <Clock className="h-3.5 w-3.5" />
                  {holdLabel}
                </span>
              )}
              {group.status === 'reserved' && isCounterReservation && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  Վճարեք մուտքի մոտ
                </span>
              )}
              {group.tickets.length > 1 && (
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                  {group.tickets.length} տոմս
                </span>
              )}
            </div>

            <div>
              <Link
                href={SITE_URL.MOVIE_DETAIL(
                  group.screening.movie.slug || group.screening.movie.id
                )}
                className="block text-xl font-bold text-gray-900 hover:text-purple-600 sm:text-2xl"
              >
                {group.screening.movie.title}
              </Link>
              <div className="mt-2 grid gap-1.5 text-sm text-gray-700 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  {formatDateHy(group.screening.startTime, { year: true })}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  {formatTimeHy(group.screening.startTime)} –{' '}
                  {formatTimeHy(group.screening.endTime)}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-purple-500" />
                  {group.screening.hall.name}
                </div>
                <div className="flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-purple-500" />
                  {seatsLabel}
                </div>
              </div>
            </div>

            {group.orderItems.length > 0 && (
              <div className="border-t border-dashed border-gray-200 pt-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <ShoppingCart className="h-4 w-4 text-purple-500" />
                  Ապրանքներ
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.orderItems.map((item) => (
                    <span
                      key={item.id}
                      className="rounded-lg border border-purple-100 bg-purple-50 px-2.5 py-1 text-xs font-medium text-gray-800"
                    >
                      {item.product.name} ×{item.quantity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-auto flex flex-col gap-3 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-400">
                  Ընդհանուր
                </p>
                <p className="text-2xl font-extrabold text-gray-900">
                  {group.totalPrice.toFixed(0)} ֏
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[200px]">
                {primaryCta}
                {isAwaitingPayment && group.orderId && (
                  <button
                    type="button"
                    onClick={handleConvertToCounter}
                    disabled={isConverting}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                  >
                    {isConverting
                      ? 'Փոխարկվում է…'
                      : 'Ամրագրել՝ վճարել դրամարկղում'}
                  </button>
                )}
                {convertError && (
                  <p className="text-xs text-red-600">{convertError}</p>
                )}
                {canShowQr && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowShareModal(true)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Տարածել
                    </button>
                    {!showInlineQr && group.status !== 'awaiting_payment' && (
                      <button
                        type="button"
                        onClick={openQr}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        QR
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {showInlineQr && canShowQr && qrData && (
            <div className="flex flex-col items-center justify-center border-t border-gray-100 bg-gray-50 p-5 sm:border-l sm:border-t-0">
              <div ref={qrCodeRef} className="rounded-xl bg-white p-3 shadow-sm">
                <QRCodeSVG
                  value={qrData}
                  size={160}
                  level="H"
                  includeMargin
                  fgColor="#7c3aed"
                  bgColor="#ffffff"
                />
              </div>
              {group.orderId != null && (
                <p className="mt-3 text-sm font-bold text-purple-700">
                  Պատվեր #{group.orderId}
                </p>
              )}
              <button
                type="button"
                onClick={handleDownloadQR}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-800"
              >
                <Download className="h-3.5 w-3.5" />
                Ներբեռնել
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showQRModal && qrData && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setShowQRModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">QR Կոդ</h3>
                <button
                  type="button"
                  onClick={() => setShowQRModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  ✕
                </button>
              </div>
              <div className="mb-4 flex flex-col items-center">
                <div
                  ref={qrCodeRef}
                  className="rounded-lg border-2 border-gray-200 bg-white p-4"
                >
                  <QRCodeSVG
                    value={qrData}
                    size={240}
                    level="H"
                    includeMargin
                    fgColor="#7c3aed"
                    bgColor="#ffffff"
                  />
                </div>
                {group.orderId != null && (
                  <p className="mt-3 text-lg font-bold text-purple-700">
                    Պատվեր #{group.orderId}
                  </p>
                )}
                <p className="mt-1 text-sm text-gray-600">{seatsLabel}</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDownloadQR}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 font-semibold text-white hover:bg-purple-700"
                >
                  <Download className="h-4 w-4" />
                  Ներբեռնել
                </button>
                <button
                  type="button"
                  onClick={() => setShowQRModal(false)}
                  className="flex-1 rounded-xl bg-gray-100 py-3 font-semibold text-gray-700 hover:bg-gray-200"
                >
                  Փակել
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showShareModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Տոմսի հղում</h3>
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  ✕
                </button>
              </div>
              <p className="mb-4 text-sm text-gray-600">
                Կիսվիր այս հղումով․ բացելիս երևում է QR կոդը մուտքի համար։
              </p>
              <div className="mb-3 flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={getShareUrl()}
                  className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                />
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
                >
                  Copy
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
