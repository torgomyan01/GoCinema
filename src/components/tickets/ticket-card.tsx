'use client';

import { useState, useRef } from 'react';
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
import { QRCodeSVG } from 'qrcode.react';
import { SITE_URL } from '@/utils/consts';

interface TicketCardProps {
  ticket: {
    id: number;
    screening: {
      id: number;
      startTime: Date | string;
      endTime: Date | string;
      movie: {
        id: number;
        title: string;
        slug?: string | null;
        image?: string | null;
        duration: number;
      };
      hall: {
        id: number;
        name: string;
      };
    };
    seat: {
      id: number;
      row: string;
      number: number;
    };
    price: number;
    status: 'reserved' | 'paid' | 'used' | 'cancelled';
    qrCode?: string | null;
    createdAt: Date | string;
    order?: {
      id: number;
      orderItems: Array<{
        id: number;
        quantity: number;
        price: number;
        ticketId?: number | null;
        product: {
          id: number;
          name: string;
          image?: string | null;
          category: string;
        };
      }>;
    } | null;
  };
  index?: number;
}

export default function TicketCard({ ticket, index = 0 }: TicketCardProps) {
  const [showQRModal, setShowQRModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const qrCodeRef = useRef<HTMLDivElement>(null);

  // Generate QR code data - only order ID for scanning
  const getQRCodeData = () => {
    if (ticket.order?.id) {
      return `ORDER-${ticket.order.id}`;
    }
    return `TICKET-${ticket.id}`;
  };

  const getShareUrl = () => {
    if (typeof window === 'undefined') return '';
    const code = encodeURIComponent(getQRCodeData());
    return `${window.location.origin}/ticket/share?code=${code}`;
  };

  const handleCopyShareLink = async () => {
    const url = getShareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      // optional: could add toast later
    } catch {
      // ignore clipboard errors for now
    }
  };

  // Download QR code as PNG
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
        link.download = `ticket-${ticket.id}-qr-code.png`;
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

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('hy-AM', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('hy-AM', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-700';
      case 'reserved':
        return 'bg-yellow-100 text-yellow-700';
      case 'used':
        return 'bg-blue-100 text-blue-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Վճարված';
      case 'reserved':
        return 'Ամրագրված';
      case 'used':
        return 'Օգտագործված';
      case 'cancelled':
        return 'Չեղարկված';
      default:
        return status;
    }
  };

  const isUpcoming = new Date(ticket.screening.startTime) > new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl border border-gray-100 overflow-hidden transition-shadow duration-300">
        {/* Accent bar like cinema ticket strip */}
        <div className="h-1 bg-gradient-to-r from-purple-600 via-pink-500 to-amber-400" />

        <div className="flex flex-col md:flex-row">
          {/* Movie Image */}
          <div className="relative w-full md:w-52 h-48 md:h-auto overflow-hidden bg-gray-200">
            <Image
              src={
                ticket.screening.movie.image ||
                'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800'
              }
              alt={ticket.screening.movie.title}
              fill
              className="object-cover"
            />
            {ticket.status === 'paid' && ticket.qrCode && (
              <div className="absolute top-2 right-2 bg-black/60 text-white rounded-lg px-2 py-1 flex items-center gap-1 text-xs">
                <QrCode className="w-4 h-4" />
                <span>QR</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-6 md:p-7">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div className="flex-1">
                {/* Status Badge row */}
                <div className="flex items-center flex-wrap gap-3 mb-3">
                  <span
                    className={`px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold tracking-wide ${getStatusColor(
                      ticket.status
                    )}`}
                  >
                    {getStatusLabel(ticket.status)}
                  </span>
                  {isUpcoming && ticket.status === 'paid' && (
                    <span className="px-3 py-1.5 rounded-full text-xs md:text-sm font-medium bg-purple-50 text-purple-700 border border-purple-100">
                      Մոտալուտ ցուցադրում
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-gray-400 uppercase tracking-[0.25em]">
                    Cinema Ticket
                  </span>
                </div>

                {/* Movie Title */}
                <Link
                  href={SITE_URL.MOVIE_DETAIL(
                    ticket.screening.movie.slug || ticket.screening.movie.id
                  )}
                  className="text-2xl md:text-3xl font-bold text-gray-900 hover:text-purple-600 transition-colors mb-2 block"
                >
                  {ticket.screening.movie.title}
                </Link>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-4">
                  {ticket.screening.hall.name}
                </p>

                {/* Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5 text-sm">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Calendar className="w-4 h-4 text-purple-500" />
                    <span>{formatDate(ticket.screening.startTime)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock className="w-4 h-4 text-purple-500" />
                    <span>
                      {formatTime(ticket.screening.startTime)} -{' '}
                      {formatTime(ticket.screening.endTime)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <MapPin className="w-4 h-4 text-purple-500" />
                    <span>{ticket.screening.hall.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Ticket className="w-4 h-4 text-purple-500" />
                    <span>
                      Նստատեղ {ticket.seat.row}
                      {ticket.seat.number}
                    </span>
                  </div>
                </div>

                {/* Products - Only show products for this specific ticket */}
                {ticket.order &&
                  ticket.order.orderItems.filter(
                    (item) => item.ticketId === ticket.id
                  ).length > 0 && (
                    <div className="mt-3 pt-4 border-t border-dashed border-gray-200">
                      <div className="flex items-center gap-2 text-gray-800 mb-3">
                        <ShoppingCart className="w-5 h-5 text-purple-500" />
                        <span className="font-semibold text-sm">
                          Այս տոմսի ապրանքներ
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {ticket.order.orderItems
                          .filter((item) => item.ticketId === ticket.id)
                          .map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg border border-purple-100"
                            >
                              {item.product.image && (
                                <div className="relative w-6 h-6 rounded overflow-hidden">
                                  <Image
                                    src={item.product.image}
                                    alt={item.product.name}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              )}
                              <span className="text-sm font-medium text-gray-900">
                                {item.product.name}
                              </span>
                              <span className="text-xs text-gray-500">
                                x{item.quantity}
                              </span>
                              <span className="text-xs font-semibold text-purple-600">
                                {item.price.toFixed(0)} ֏
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
              </div>

              {/* Price & Actions */}
              <div className="flex flex-col items-end justify-between gap-4 md:pl-6 md:border-l md:border-dashed md:border-gray-200 pt-4 md:pt-0">
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-[0.25em] text-gray-400 mb-1">
                    Ընդհանուր արժեք
                  </div>
                  <div className="text-3xl md:text-4xl font-extrabold text-gray-900">
                    {ticket.price.toFixed(0)} ֏
                  </div>
                  <div className="text-xs text-gray-500 mt-1 text-right">
                    մեկ տոմս
                  </div>
                </div>

                <div className="flex flex-col gap-2 w-full md:w-auto">
                  {ticket.status === 'paid' && (
                    <>
                      <button
                        onClick={() => setShowQRModal(true)}
                        className="px-4 py-2.5 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 active:bg-purple-800 transition-colors flex items-center justify-center gap-2 shadow-sm"
                      >
                        <QrCode className="w-4 h-4" />
                        Դիտել QR
                      </button>
                      <button
                        onClick={() => setShowShareModal(true)}
                        className="px-4 py-2.5 bg-white text-purple-600 border border-purple-200 rounded-lg font-medium hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <Share2 className="w-4 h-4" />
                        Տարածել տոմսը
                      </button>
                    </>
                  )}
                  {ticket.status === 'reserved' && ticket.order && (
                    <Link
                      href={SITE_URL.PAYMENT(ticket.order.id)}
                      className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all text-center shadow-sm"
                    >
                      Վճարել
                    </Link>
                  )}
                  {ticket.status === 'paid' && isUpcoming && (
                    <Link
                      href={SITE_URL.SCREENING_DETAIL(ticket.screening.id)}
                      className="px-4 py-2.5 bg-gray-100 text-gray-800 rounded-lg font-medium hover:bg-gray-200 transition-colors text-center"
                    >
                      Դիտել մանրամասներ
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR & Share Modals */}
      <AnimatePresence>
        {showQRModal && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowQRModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">QR Կոդ</h3>
                <button
                  onClick={() => setShowQRModal(false)}
                  className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col items-center mb-6">
                <div
                  ref={qrCodeRef}
                  className="p-4 bg-white rounded-lg border-2 border-gray-200"
                >
                  <QRCodeSVG
                    value={getQRCodeData()}
                    size={256}
                    level="H"
                    includeMargin={true}
                    fgColor="#7c3aed"
                    bgColor="#ffffff"
                  />
                </div>
                {ticket.order?.id && (
                  <div className="mt-4 px-6 py-3 bg-purple-600 text-white rounded-lg">
                    <div className="text-center">
                      <p className="text-xs font-medium opacity-90 mb-1">
                        Պատվերի ID
                      </p>
                      <p className="text-2xl font-bold tracking-wider">
                        #{ticket.order.id}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Տոմսի ID:</span>
                  <span className="font-semibold text-gray-900">
                    #{ticket.id}
                  </span>
                </div>
                {ticket.order?.id && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Պատվերի ID:</span>
                    <span className="font-semibold text-purple-600">
                      #{ticket.order.id}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Նստատեղ:</span>
                  <span className="font-semibold text-gray-900">
                    {ticket.seat.row}
                    {ticket.seat.number}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ֆիլմ:</span>
                  <span className="font-semibold text-gray-900">
                    {ticket.screening.movie.title}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleDownloadQR}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Ներբեռնել
                </button>
                <button
                  onClick={() => setShowQRModal(false)}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Փակել
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showShareModal && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  Տոմսի հղում
                </h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 transition-colors"
                >
                  ✕
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Կիսվիր այս հղումով ընկերոջդ հետ․ բացելիս նա կտեսնի QR կոդը և
                կարող է այն ցույց տալ մուտքի ժամանակ:
              </p>

              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Հղում
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getShareUrl()}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors whitespace-nowrap"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
                Ուշադրություն․ հղումն ունեցող ցանկացած մարդ կկարողանա տեսնել այս
                տոմսի QR կոդը:
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
