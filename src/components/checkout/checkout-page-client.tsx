'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Ticket,
  Calendar,
  Clock,
  MapPin,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { SITE_URL } from '@/utils/consts';
import { getOrderById } from '@/app/actions/orders';

interface CheckoutPageClientProps {
  orderId: string;
}

interface Product {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  image?: string | null;
  category: string;
}

interface OrderItem {
  id: number;
  quantity: number;
  price: number;
  ticketId?: number | null;
  product: Product;
}

interface Order {
  id: number;
  userId: number;
  totalAmount: number;
  status: string;
  orderItems: OrderItem[];
  tickets: Array<{
    id: number;
    price: number;
    seat: {
      row: string;
      number: number;
    };
    screening: {
      movie: {
        title: string;
        image?: string | null;
      };
      hall: {
        name: string;
      };
      startTime: Date | string;
      endTime: Date | string;
    };
  }>;
}

export default function CheckoutPageClient({
  orderId,
}: CheckoutPageClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const orderResult = await getOrderById(parseInt(orderId, 10));

        if (orderResult.success && orderResult.order) {
          setOrder(orderResult.order as Order);
        } else {
          setError(orderResult.error || 'Պատվերը չի գտնվել');
        }
      } catch (err) {
        console.error('Error loading checkout data:', err);
        setError('Տվյալները բեռնելիս սխալ է տեղի ունեցել');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [orderId]);

  const totalPrice = useMemo(() => {
    if (!order) return 0;
    // Calculate tickets price from order tickets
    const ticketsPrice = order.tickets.reduce(
      (sum, ticket) => sum + (ticket.price || 0),
      0
    );
    // Calculate products price (all products from orderItems)
    const allProductsPrice = order.orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    // Total = tickets price + all products price
    return ticketsPrice + allProductsPrice;
  }, [order]);

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

  const handleProceedToPayment = async () => {
    if (!order || !session?.user) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Navigate directly to payment page - products are already saved from booking page
      router.push(SITE_URL.PAYMENT(order.id));
    } catch (err) {
      console.error('Error proceeding to payment:', err);
      setError('Վճարման էջին անցնելիս սխալ է տեղի ունեցել');
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
            href={SITE_URL.BOOKING(
              order.tickets[0]?.screening?.movie ? '1' : '1'
            )}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Վերադառնալ
          </Link>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Պատվերի ձևակերպում
          </h1>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Products Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tickets Summary */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Տոմսեր</h2>
              <div className="space-y-4">
                {order.tickets.map((ticket) => {
                  // Get products for this ticket
                  const ticketProducts = order.orderItems.filter(
                    (item) => item.ticketId === ticket.id
                  );
                  return (
                    <div
                      key={ticket.id}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Ticket className="w-5 h-5 text-purple-600" />
                          <div>
                            <p className="font-semibold text-gray-900">
                              Նստատեղ: {ticket.seat.row}
                              {ticket.seat.number}
                            </p>
                            <p className="text-sm text-gray-600">
                              {ticket.screening.movie.title}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(ticket.screening.startTime)} •{' '}
                              {formatTime(ticket.screening.startTime)}
                            </p>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-purple-600">
                          {ticket.price.toFixed(0)} ֏
                        </span>
                      </div>
                      {ticketProducts.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-sm font-medium text-gray-700 mb-2">
                            Այս տոմսի ապրանքներ:
                          </p>
                          <div className="space-y-1">
                            {ticketProducts.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="text-gray-600">
                                  {item.product.name} x{item.quantity}
                                </span>
                                <span className="font-semibold text-gray-900">
                                  {(item.price * item.quantity).toFixed(0)} ֏
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-24">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Պատվերի ամփոփում
              </h2>

              <div className="space-y-4 mb-6">
                {/* Tickets */}
                <div className="flex justify-between text-gray-600">
                  <span>Տոմսեր ({order.tickets.length})</span>
                  <span>
                    {order.tickets
                      .reduce((sum, ticket) => sum + (ticket.price || 0), 0)
                      .toFixed(0)}{' '}
                    ֏
                  </span>
                </div>

                {/* Products grouped by ticket */}
                {order.tickets.map((ticket) => {
                  const ticketProducts = order.orderItems.filter(
                    (item) => item.ticketId === ticket.id
                  );
                  if (ticketProducts.length === 0) return null;
                  return (
                    <div
                      key={ticket.id}
                      className="pt-3 border-t border-gray-200"
                    >
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        {ticket.seat.row}
                        {ticket.seat.number} - ապրանքներ:
                      </p>
                      {ticketProducts.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between text-sm text-gray-600 mb-1"
                        >
                          <span>
                            {item.product.name} x{item.quantity}
                          </span>
                          <span>
                            {(item.price * item.quantity).toFixed(0)} ֏
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {/* Order-level products (if any) */}
                {order.orderItems.filter((item) => !item.ticketId).length >
                  0 && (
                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      Պատվերի ապրանքներ:
                    </p>
                    {order.orderItems
                      .filter((item) => !item.ticketId)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between text-sm text-gray-600 mb-1"
                        >
                          <span>
                            {item.product.name} x{item.quantity}
                          </span>
                          <span>
                            {(item.price * item.quantity).toFixed(0)} ֏
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">
                    Ընդամենը
                  </span>
                  <span className="text-2xl font-bold text-gray-900">
                    {totalPrice.toFixed(0)} ֏
                  </span>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleProceedToPayment}
                disabled={isProcessing || !session?.user}
                className={`w-full px-6 py-3 rounded-lg font-semibold transition-all ${
                  isProcessing || !session?.user
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-md hover:shadow-lg'
                }`}
              >
                {isProcessing
                  ? 'Մշակվում է...'
                  : `Վճարել ${totalPrice.toFixed(0)} ֏`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
