'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard,
  Lock,
  Check,
  Calendar,
  Clock,
  MapPin,
  Ticket,
  ArrowLeft,
  AlertCircle,
  Download,
  QrCode as QrCodeIcon,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { QRCodeSVG } from 'qrcode.react';
import { useRef } from 'react';
import { SITE_URL } from '@/utils/consts';
import { getTicketById } from '@/app/actions/tickets';
import { createPayment, createPaymentForOrder } from '@/app/actions/payments';
import { getOrderById } from '@/app/actions/orders';

interface PaymentPageClientProps {
  orderId: string;
}

interface Ticket {
  id: number;
  userId: number;
  screeningId: number;
  seatId: number;
  price: number;
  status: string;
  qrCode?: string | null;
  createdAt: Date | string;
  screening: {
    id: number;
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
    startTime: Date | string;
    endTime: Date | string;
    basePrice: number;
  };
  seat: {
    id: number;
    row: string;
    number: number;
  };
  payment?: {
    id: number;
    status: string;
    method: string;
    transactionId?: string | null;
  } | null;
}

interface Order {
  id: number;
  userId: number;
  totalAmount: number;
  status: string;
  tickets: Ticket[];
  orderItems: Array<{
    id: number;
    quantity: number;
    price: number;
    product: {
      id: number;
      name: string;
      image?: string | null;
      category: string;
    };
  }>;
}

export default function PaymentPageClient({ orderId }: PaymentPageClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<
    'card' | 'bank_transfer' | null
  >(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [qrCodes, setQrCodes] = useState<Map<number, string>>(new Map());
  const qrCodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardTouched, setCardTouched] = useState({
    cardNumber: false,
    expiry: false,
    cvv: false,
    cardHolder: false,
  });

  const cardErrors = {
    cardNumber:
      cardNumber.replace(/\s/g, '').length < 16
        ? 'Քարտի համարը պետք է լինի 16 թիվ'
        : '',
    expiry: (() => {
      const clean = expiry.replace(/\D/g, '');
      if (clean.length < 4) return 'Մուտքագրեք վավեր ժամկետ';
      const month = parseInt(clean.slice(0, 2), 10);
      const year = parseInt('20' + clean.slice(2, 4), 10);
      const now = new Date();
      const exp = new Date(year, month - 1);
      if (month < 1 || month > 12) return 'Ամիսը սխալ է';
      if (exp < new Date(now.getFullYear(), now.getMonth()))
        return 'Քարտի ժամկետն անցել է';
      return '';
    })(),
    cvv: cvv.length < 3 ? 'CVV-ն պետք է լինի 3-4 թիվ' : '',
    cardHolder:
      cardHolder.trim().length < 3 ? 'Մուտքագրեք քարտատիրոջ անունը' : '',
  };

  const isCardValid = Object.values(cardErrors).every((e) => e === '');

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + ' / ' + digits.slice(2);
    if (digits.length === 2) return digits + ' / ';
    return digits;
  };

  useEffect(() => {
    const loadOrder = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const orderResult = await getOrderById(parseInt(orderId, 10));
        if (orderResult.success && orderResult.order) {
          const loadedOrder = orderResult.order as Order;
          setOrder(loadedOrder);

          // Check if all tickets are paid
          const allPaid = loadedOrder.tickets.every(
            (ticket) => ticket.status === 'paid' || ticket.status === 'used'
          );

          if (allPaid) {
            setIsSuccess(true);
            // Load QR codes for all tickets
            const qrCodesMap = new Map<number, string>();
            loadedOrder.tickets.forEach((ticket) => {
              if (ticket.qrCode) {
                qrCodesMap.set(ticket.id, ticket.qrCode);
              }
            });
            setQrCodes(qrCodesMap);
          }
        } else {
          setError(orderResult.error || 'Պատվերը չի գտնվել');
        }
      } catch (err) {
        console.error('Error loading order:', err);
        setError('Պատվերը բեռնելիս սխալ է տեղի ունեցել');
      } finally {
        setIsLoading(false);
      }
    };

    loadOrder();
  }, [orderId]);

  // Check if user is logged in
  useEffect(() => {
    if (!session?.user && !isLoading) {
      router.push('/account');
    }
  }, [session, router, isLoading]);

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('hy-AM', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('hy-AM', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Generate QR code data - only order ID for scanning
  const getQRCodeData = (ticketId: number) => {
    if (!order) return '';
    return `ORDER-${order.id}`;
  };

  // Download QR code as PNG
  const handleDownloadQR = (ticketId: number) => {
    const qrCodeRef = qrCodeRefs.current.get(ticketId);
    if (!qrCodeRef) return;

    const svg = qrCodeRef.querySelector('svg');
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
        link.download = `ticket-${ticketId}-qr-code.png`;
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

  const handlePayment = async () => {
    if (!paymentMethod || !order || !session?.user) return;

    if (paymentMethod === 'card') {
      setCardTouched({
        cardNumber: true,
        expiry: true,
        cvv: true,
        cardHolder: true,
      });
      if (!isCardValid) return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const userId =
        typeof (session.user as any).id === 'string'
          ? parseInt((session.user as any).id, 10)
          : (session.user as any).id;

      const result = await createPaymentForOrder({
        userId,
        orderId: order.id,
        method: paymentMethod,
      });

      if (result.success && result.payments) {
        setIsSuccess(true);

        // Set QR codes for all tickets
        const qrCodesMap = new Map<number, string>();
        result.qrCodes.forEach((qrCode, index) => {
          if (result.tickets[index]) {
            qrCodesMap.set(result.tickets[index].id, qrCode);
          }
        });
        setQrCodes(qrCodesMap);

        // Reload order to get updated status
        const orderResult = await getOrderById(order.id);
        if (orderResult.success && orderResult.order) {
          setOrder(orderResult.order as Order);
        }
      } else {
        setError(result.error || 'Վճարում կատարելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error processing payment:', err);
      setError('Վճարում կատարելիս սխալ է տեղի ունեցել');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-xl text-gray-600">Բեռնվում է...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center py-20">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <p className="text-xl text-red-600 mb-4">{error}</p>
            <Link
              href={SITE_URL.SCHEDULE}
              className="text-purple-600 hover:text-purple-700 underline"
            >
              Վերադառնալ ժամանակացույց
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const allTicketsPaid = order.tickets.every(
    (ticket) => ticket.status === 'paid' || ticket.status === 'used'
  );

  if (isSuccess || allTicketsPaid) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto text-center"
          >
            <div className="bg-white rounded-xl shadow-lg p-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                <Check className="w-10 h-10 text-green-600" />
              </div>

              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Վճարումը հաջողությամբ ավարտվեց
              </h1>

              <p className="text-xl text-gray-600 mb-8">
                Ձեր {order.tickets.length} տոմս
                {order.tickets.length > 1 ? 'երը' : 'ը'} ամրագրված{' '}
                {order.tickets.length > 1 ? 'են' : 'է'}: QR կոդերը կարող եք
                գտնել «Իմ տոմսերը» բաժնում:
              </p>

              {/* Order Info */}
              <div className="mb-8 p-6 bg-purple-50 rounded-lg">
                <div className="text-center">
                  <p className="text-sm font-medium text-purple-700 mb-1">
                    Պատվերի ID
                  </p>
                  <p className="text-3xl font-bold text-purple-900 tracking-wider">
                    #{order.id}
                  </p>
                </div>
              </div>

              {/* Products */}
              {order.orderItems.length > 0 && (
                <div className="mb-8 p-6 bg-white rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Պատվիրված ապրանքներ
                  </h3>
                  <div className="space-y-2">
                    {order.orderItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          {item.product.image && (
                            <div className="relative w-12 h-12 rounded overflow-hidden bg-gray-100">
                              <Image
                                src={item.product.image}
                                alt={item.product.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">
                              {item.product.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {item.product.category} • x{item.quantity}
                            </p>
                          </div>
                        </div>
                        <p className="font-semibold text-gray-900">
                          {(item.price * item.quantity).toFixed(0)} ֏
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tickets with QR Codes */}
              <div className="mb-8 space-y-6">
                {order.tickets.map((ticket, index) => (
                  <div key={ticket.id} className="p-6 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <QrCodeIcon className="w-5 h-5 text-purple-600" />
                        <p className="text-lg font-semibold text-gray-900">
                          Տոմս #{index + 1} - QR Կոդ
                        </p>
                      </div>
                      <button
                        onClick={() => handleDownloadQR(ticket.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                      >
                        <Download className="w-4 h-4" />
                        Ներբեռնել
                      </button>
                    </div>

                    <div
                      ref={(el) => {
                        if (el) qrCodeRefs.current.set(ticket.id, el);
                      }}
                      className="flex flex-col items-center mb-4"
                    >
                      <div className="p-4 bg-white rounded-lg shadow-md">
                        <QRCodeSVG
                          value={getQRCodeData(ticket.id)}
                          size={200}
                          level="H"
                          includeMargin={true}
                          fgColor="#7c3aed"
                          bgColor="#ffffff"
                        />
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Տոմսի ID:</span>
                        <span className="font-semibold text-gray-900">
                          #{ticket.id}
                        </span>
                      </div>
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
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ամսաթիվ:</span>
                        <span className="font-semibold text-gray-900">
                          {formatDate(ticket.screening.startTime)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ժամ:</span>
                        <span className="font-semibold text-gray-900">
                          {formatTime(ticket.screening.startTime)}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 mt-4 text-center">
                      QR կոդը ցուցադրեք մուտքի ժամանակ սկանավորման համար
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href={SITE_URL.TICKETS}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all"
                >
                  Դիտել իմ տոմսերը
                </Link>
                <Link
                  href={SITE_URL.SCHEDULE}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all"
                >
                  Վերադառնալ ժամանակացույց
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link
            href={SITE_URL.TICKETS}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Վերադառնալ
          </Link>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Վճարում
          </h1>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Order Summary */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Պատվերի մանրամասներ
              </h2>

              {/* Movie Info */}
              {order.tickets.length > 0 && (
                <div className="flex gap-6 mb-6 pb-6 border-b">
                  {order.tickets[0].screening.movie.image && (
                    <div className="relative w-32 h-40 overflow-hidden rounded-lg bg-gray-200">
                      <Image
                        src={
                          order.tickets[0].screening.movie.image ||
                          'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800'
                        }
                        alt={order.tickets[0].screening.movie.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}

                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      {order.tickets[0].screening.movie.title}
                    </h3>

                    <div className="space-y-2 text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        <span>
                          {formatDate(order.tickets[0].screening.startTime)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        <span>
                          {formatTime(order.tickets[0].screening.startTime)} -{' '}
                          {formatTime(order.tickets[0].screening.endTime)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5" />
                        <span>{order.tickets[0].screening.hall.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Ticket className="w-5 h-5" />
                        <span>
                          {order.tickets.length} նստատեղ
                          {order.tickets.length > 1 ? 'եր' : ''}:{' '}
                          {order.tickets
                            .map((t) => `${t.seat.row}${t.seat.number}`)
                            .join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Price Summary */}
              <div className="space-y-3">
                {/* Tickets */}
                <div className="flex justify-between text-gray-600">
                  <span>Տոմսեր ({order.tickets.length} հատ)</span>
                  <span>
                    {order.tickets
                      .reduce((sum, ticket) => sum + ticket.price, 0)
                      .toFixed(0)}{' '}
                    ֏
                  </span>
                </div>

                {/* Products */}
                {order.orderItems.length > 0 && (
                  <>
                    {order.orderItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between text-gray-600 text-sm"
                      >
                        <span>
                          {item.product.name} x{item.quantity}
                        </span>
                        <span>{(item.price * item.quantity).toFixed(0)} ֏</span>
                      </div>
                    ))}
                  </>
                )}

                {/* Total */}
                <div className="flex justify-between text-lg font-bold text-gray-900 pt-3 border-t">
                  <span>Ընդամենը</span>
                  <span>{order.totalAmount.toFixed(0)} ֏</span>
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Վճարման եղանակ
                </h2>
                <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                  <Lock className="w-3.5 h-3.5" />
                  SSL անվտանգ
                </div>
              </div>

              <div className="p-6 space-y-4">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <span className="text-red-700 text-sm">{error}</span>
                  </div>
                )}

                {/* Payment method option */}
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left group ${
                    paymentMethod === 'card'
                      ? 'border-purple-500 bg-purple-50/60'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Radio */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        paymentMethod === 'card'
                          ? 'border-purple-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {paymentMethod === 'card' && (
                        <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                      )}
                    </div>

                    {/* Icon */}
                    <div
                      className={`p-2 rounded-lg transition-colors ${
                        paymentMethod === 'card'
                          ? 'bg-purple-100'
                          : 'bg-gray-100'
                      }`}
                    >
                      <CreditCard
                        className={`w-5 h-5 ${paymentMethod === 'card' ? 'text-purple-600' : 'text-gray-400'}`}
                      />
                    </div>

                    {/* Label */}
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm">
                        Բանկային քարտ
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Visa, Mastercard, ArCa
                      </p>
                    </div>

                    {/* Card logos */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Visa */}
                      <div className="h-6 px-2 bg-[#1A1F71] rounded flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold italic tracking-tight">
                          VISA
                        </span>
                      </div>
                      {/* Mastercard */}
                      <div className="h-6 w-9 relative flex items-center justify-center">
                        <div className="absolute left-0 w-6 h-6 rounded-full bg-[#EB001B] opacity-90" />
                        <div className="absolute right-0 w-6 h-6 rounded-full bg-[#F79E1B] opacity-90" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-3 h-6 bg-[#FF5F00] opacity-80" />
                        </div>
                      </div>
                      {/* ArCa */}
                      <div className="h-6 px-2 bg-gradient-to-r from-orange-500 to-red-500 rounded flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold tracking-tight">
                          ArCa
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Card form */}
                {paymentMethod === 'card' && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 space-y-4"
                  >
                    {/* Card number */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Քարտի համար
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0000  0000  0000  0000"
                          maxLength={19}
                          value={cardNumber}
                          onChange={(e) =>
                            setCardNumber(formatCardNumber(e.target.value))
                          }
                          onBlur={() =>
                            setCardTouched((p) => ({ ...p, cardNumber: true }))
                          }
                          className={`w-full pl-4 pr-12 py-3 bg-white border rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:border-transparent transition-all placeholder:tracking-normal placeholder:font-sans placeholder:text-gray-400 ${
                            cardTouched.cardNumber && cardErrors.cardNumber
                              ? 'border-red-400 focus:ring-red-400'
                              : cardTouched.cardNumber && !cardErrors.cardNumber
                                ? 'border-green-400 focus:ring-green-400'
                                : 'border-gray-200 focus:ring-purple-500'
                          }`}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          {cardTouched.cardNumber && !cardErrors.cardNumber ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <CreditCard className="w-4 h-4 text-gray-300" />
                          )}
                        </div>
                      </div>
                      {cardTouched.cardNumber && cardErrors.cardNumber && (
                        <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          {cardErrors.cardNumber}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Expiry */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                          Վավ. ժամկետ
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="MM / YY"
                          maxLength={7}
                          value={expiry}
                          onChange={(e) =>
                            setExpiry(formatExpiry(e.target.value))
                          }
                          onBlur={() =>
                            setCardTouched((p) => ({ ...p, expiry: true }))
                          }
                          className={`w-full px-4 py-3 bg-white border rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:border-transparent transition-all placeholder:tracking-normal placeholder:font-sans placeholder:text-gray-400 ${
                            cardTouched.expiry && cardErrors.expiry
                              ? 'border-red-400 focus:ring-red-400'
                              : cardTouched.expiry && !cardErrors.expiry
                                ? 'border-green-400 focus:ring-green-400'
                                : 'border-gray-200 focus:ring-purple-500'
                          }`}
                        />
                        {cardTouched.expiry && cardErrors.expiry && (
                          <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            {cardErrors.expiry}
                          </p>
                        )}
                      </div>
                      {/* CVV */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                          CVV / CVC
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          placeholder="•••"
                          maxLength={4}
                          value={cvv}
                          onChange={(e) =>
                            setCvv(
                              e.target.value.replace(/\D/g, '').slice(0, 4)
                            )
                          }
                          onBlur={() =>
                            setCardTouched((p) => ({ ...p, cvv: true }))
                          }
                          className={`w-full px-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all placeholder:text-gray-400 ${
                            cardTouched.cvv && cardErrors.cvv
                              ? 'border-red-400 focus:ring-red-400'
                              : cardTouched.cvv && !cardErrors.cvv
                                ? 'border-green-400 focus:ring-green-400'
                                : 'border-gray-200 focus:ring-purple-500'
                          }`}
                        />
                        {cardTouched.cvv && cardErrors.cvv && (
                          <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            {cardErrors.cvv}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Cardholder */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Քարտատիրոջ անուն
                      </label>
                      <input
                        type="text"
                        placeholder="ԱՆՈՒՆ ԱԶԳԱՆՈՒՆ"
                        value={cardHolder}
                        onChange={(e) =>
                          setCardHolder(e.target.value.toUpperCase())
                        }
                        onBlur={() =>
                          setCardTouched((p) => ({ ...p, cardHolder: true }))
                        }
                        className={`w-full px-4 py-3 bg-white border rounded-xl text-sm uppercase tracking-widest focus:outline-none focus:ring-2 focus:border-transparent transition-all placeholder:normal-case placeholder:tracking-normal placeholder:text-gray-400 ${
                          cardTouched.cardHolder && cardErrors.cardHolder
                            ? 'border-red-400 focus:ring-red-400'
                            : cardTouched.cardHolder && !cardErrors.cardHolder
                              ? 'border-green-400 focus:ring-green-400'
                              : 'border-gray-200 focus:ring-purple-500'
                        }`}
                      />
                      {cardTouched.cardHolder && cardErrors.cardHolder && (
                        <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          {cardErrors.cardHolder}
                        </p>
                      )}
                    </div>

                    {/* Security note */}
                    <div className="flex items-center gap-2 pt-1">
                      <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <p className="text-xs text-gray-400">
                        Ձեր քարտի տվյալները գաղտնագրված են SSL/TLS-ով և չեն
                        պահվում մեր սերվերներում
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          {/* Payment Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-24">
              <div className="flex items-center gap-2 text-gray-600 mb-6">
                <Lock className="w-5 h-5" />
                <span className="text-sm">Անվտանգ վճարում</span>
              </div>

              <div className="space-y-4 mb-6">
                {/* Ticket Price */}
                <div className="flex justify-between text-gray-600">
                  <span>Տոմսեր ({order.tickets.length} հատ)</span>
                  <span>
                    {order.tickets
                      .reduce((sum, ticket) => sum + ticket.price, 0)
                      .toFixed(0)}{' '}
                    ֏
                  </span>
                </div>

                {/* Products */}
                {order.orderItems.length > 0 && (
                  <>
                    {order.orderItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between text-gray-600 text-sm"
                      >
                        <span className="truncate mr-2">
                          {item.product.name} x{item.quantity}
                        </span>
                        <span className="flex-shrink-0">
                          {(item.price * item.quantity).toFixed(0)} ֏
                        </span>
                      </div>
                    ))}
                  </>
                )}

                {/* Total */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">
                      Ընդամենը
                    </span>
                    <span className="text-2xl font-bold text-gray-900">
                      {order.totalAmount.toFixed(0)} ֏
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handlePayment}
                disabled={
                  !paymentMethod ||
                  isProcessing ||
                  (paymentMethod === 'card' && !isCardValid)
                }
                className={`w-full px-6 py-3 rounded-lg font-semibold transition-all ${
                  paymentMethod &&
                  !isProcessing &&
                  (paymentMethod !== 'card' || isCardValid)
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-md hover:shadow-lg'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isProcessing
                  ? 'Վճարում...'
                  : `Վճարել ${order.totalAmount.toFixed(0)} ֏`}
              </button>

              <p className="text-xs text-gray-500 text-center mt-4">
                Վճարելով, դուք համաձայնվում եք մեր օգտագործման պայմաններին
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
