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
  const qrCodeRef = useRef<HTMLDivElement>(null);

  // Generate QR code data - only order ID for scanning
  const getQRCodeData = () => {
    if (ticket.order?.id) {
      return `ORDER-${ticket.order.id}`;
    }
    return `TICKET-${ticket.id}`;
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
      <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* Movie Image */}
          <div className="relative w-full md:w-48 h-48 md:h-auto overflow-hidden bg-gray-200">
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
              <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg p-2">
                <QrCode className="w-6 h-6 text-purple-600" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                {/* Status Badge */}
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(ticket.status)}`}
                  >
                    {getStatusLabel(ticket.status)}
                  </span>
                  {isUpcoming && ticket.status === 'paid' && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                      Մոտալուտ
                    </span>
                  )}
                </div>

                {/* Movie Title */}
                <Link
                  href={SITE_URL.MOVIE_DETAIL(
                    ticket.screening.movie.slug || ticket.screening.movie.id
                  )}
                  className="text-2xl font-bold text-gray-900 hover:text-purple-600 transition-colors mb-3 block"
                >
                  {ticket.screening.movie.title}
                </Link>

                {/* Details */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-5 h-5" />
                    <span>{formatDate(ticket.screening.startTime)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-5 h-5" />
                    <span>
                      {formatTime(ticket.screening.startTime)} -{' '}
                      {formatTime(ticket.screening.endTime)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-5 h-5" />
                    <span>{ticket.screening.hall.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Ticket className="w-5 h-5" />
                    <span>
                      Նստատեղ: {ticket.seat.row}
                      {ticket.seat.number}
                    </span>
                  </div>
                </div>

                {/* Products - Only show products for this specific ticket */}
                {ticket.order &&
                  ticket.order.orderItems.filter(
                    (item) => item.ticketId === ticket.id
                  ).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-2 text-gray-700 mb-2">
                        <ShoppingCart className="w-5 h-5" />
                        <span className="font-semibold">
                          Այս տոմսի ապրանքներ:
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
                              <span className="text-sm font-medium text-gray-800">
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
              <div className="flex flex-col items-end gap-4">
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">
                    {ticket.price.toFixed(0)} ֏
                  </div>
                  <div className="text-sm text-gray-500">Մեկ տոմս</div>
                </div>

                <div className="flex flex-col gap-2">
                  {ticket.status === 'paid' && (
                    <>
                      <button
                        onClick={() => setShowQRModal(true)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
                      >
                        <QrCode className="w-4 h-4" />
                        Դիտել QR
                      </button>
                    </>
                  )}
                  {ticket.status === 'reserved' && ticket.order && (
                    <Link
                      href={SITE_URL.PAYMENT(ticket.order.id)}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all text-center"
                    >
                      Վճարել
                    </Link>
                  )}
                  {ticket.status === 'paid' && isUpcoming && (
                    <Link
                      href={SITE_URL.SCREENING_DETAIL(ticket.screening.id)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-center"
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

      {/* QR Code Modal */}
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
      </AnimatePresence>
    </motion.div>
  );
}
