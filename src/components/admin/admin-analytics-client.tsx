'use client';

import { motion } from 'framer-motion';
import {
  Users,
  Film,
  Calendar,
  Ticket,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  BarChart3,
  Clock,
  Star,
  CheckCircle,
  XCircle,
  CreditCard,
} from 'lucide-react';

interface AdminAnalyticsClientProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
  };
  analytics: any;
}

export default function AdminAnalyticsClient({
  user,
  analytics,
}: AdminAnalyticsClientProps) {
  if (!analytics) {
    return (
      <div className="p-6">
        <div className="text-center py-20">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">
            Վիճակագրությունը բեռնելիս սխալ է տեղի ունեցել
          </p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hy-AM', {
      style: 'currency',
      currency: 'AMD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('hy-AM', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Calculate ticket statistics from revenueByStatus
  const paidTickets = analytics.revenueByStatus.find(
    (item: any) => item.status === 'paid'
  );
  const usedTickets = analytics.revenueByStatus.find(
    (item: any) => item.status === 'used'
  );

  const paidTicketsCount = paidTickets?._count.id || 0;
  const paidTicketsRevenue = paidTickets?._sum.price || 0;
  const usedTicketsCount = usedTickets?._count.id || 0;
  const usedTicketsRevenue = usedTickets?._sum.price || 0;

  // Unused tickets = paid tickets that are not yet used
  const unusedTicketsCount = paidTicketsCount - usedTicketsCount;
  const unusedTicketsRevenue = paidTicketsRevenue - usedTicketsRevenue;

  const statCards = [
    {
      title: 'Ընդհանուր օգտատերեր',
      value: analytics.overview.totalUsers,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Ակտիվ ֆիլմեր',
      value: analytics.overview.totalMovies,
      icon: Film,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Ցուցադրություններ',
      value: analytics.overview.totalScreenings,
      icon: Calendar,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Ընդհանուր տոմսեր',
      value: analytics.overview.totalTickets,
      icon: Ticket,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Պատվերներ',
      value: analytics.overview.totalOrders,
      icon: ShoppingCart,
      color: 'from-pink-500 to-pink-600',
      bgColor: 'bg-pink-50',
    },
    {
      title: 'Ընդհանուր եկամուտ',
      value: formatCurrency(analytics.overview.totalRevenue),
      icon: DollarSign,
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Վճարված տոմսեր',
      value: paidTicketsCount,
      icon: CheckCircle,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Վճարված տոմսերի արժեք',
      value: formatCurrency(paidTicketsRevenue),
      icon: CreditCard,
      color: 'from-teal-500 to-teal-600',
      bgColor: 'bg-teal-50',
    },
    {
      title: 'Չփակված տոմսեր',
      value: unusedTicketsCount,
      icon: XCircle,
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      title: 'Չփակված տոմսերի արժեք',
      value: formatCurrency(unusedTicketsRevenue),
      icon: DollarSign,
      color: 'from-yellow-500 to-yellow-600',
      bgColor: 'bg-yellow-50',
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3 mb-2">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
          </div>
          Վիճակագրություն
        </h1>
        <p className="text-gray-600">
          Ընդհանուր վիճակագրություն և վերլուծություն
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={`p-4 bg-gradient-to-br ${stat.color} rounded-xl`}
                >
                  <Icon className="w-8 h-8 text-white" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue by Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Եկամուտ ըստ կարգավիճակի
          </h2>
          <div className="space-y-3">
            {analytics.revenueByStatus.map((item: any) => (
              <div
                key={item.status}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      item.status === 'paid'
                        ? 'bg-green-500'
                        : item.status === 'reserved'
                          ? 'bg-yellow-500'
                          : item.status === 'used'
                            ? 'bg-blue-500'
                            : 'bg-gray-500'
                    }`}
                  />
                  <span className="font-medium text-gray-900 capitalize">
                    {item.status === 'paid'
                      ? 'Վճարված'
                      : item.status === 'reserved'
                        ? 'Ամրագրված'
                        : item.status === 'used'
                          ? 'Օգտագործված'
                          : item.status === 'cancelled'
                            ? 'Չեղարկված'
                            : item.status}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">
                    {formatCurrency(item._sum.price || 0)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {item._count.id} տոմս
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Orders by Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-600" />
            Պատվերներ ըստ կարգավիճակի
          </h2>
          <div className="space-y-3">
            {analytics.ordersByStatus.map((item: any) => (
              <div
                key={item.status}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      item.status === 'completed'
                        ? 'bg-green-500'
                        : item.status === 'pending'
                          ? 'bg-yellow-500'
                          : 'bg-gray-500'
                    }`}
                  />
                  <span className="font-medium text-gray-900 capitalize">
                    {item.status === 'completed'
                      ? 'Ավարտված'
                      : item.status === 'pending'
                        ? 'Սպասման մեջ'
                        : item.status === 'cancelled'
                          ? 'Չեղարկված'
                          : item.status}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">
                    {item._count.id}
                  </div>
                  <div className="text-sm text-gray-500">պատվեր</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Top Movies */}
      {analytics.topMovies && analytics.topMovies.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-8"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-indigo-600" />
            Ամենահայտնի ֆիլմեր
          </h2>
          <div className="space-y-3">
            {analytics.topMovies.map((item: any, index: number) => (
              <div
                key={item.movie?.id || index}
                className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
              >
                <div className="text-2xl font-bold text-gray-400 w-8">
                  {index + 1}
                </div>
                {item.movie?.image && (
                  <img
                    src={item.movie.image}
                    alt={item.movie.title}
                    className="w-16 h-20 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">
                    {item.movie?.title || 'Անհայտ ֆիլմ'}
                  </div>
                  <div className="text-sm text-gray-500">
                    {item.ticketCount} վաճառված տոմս
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent Orders */}
      {analytics.recentOrders && analytics.recentOrders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Վերջին պատվերներ
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Օգտատեր
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Տոմսեր
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Գումար
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Կարգավիճակ
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ամսաթիվ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {analytics.recentOrders.map((order: any) => {
                  const totalAmount = order.tickets.reduce(
                    (sum: number, ticket: any) => sum + ticket.price,
                    0
                  );
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {order.user?.name || 'Անանուն'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {order.user?.phone}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {order.tickets.length}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {formatCurrency(totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            order.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : order.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {order.status === 'completed'
                            ? 'Ավարտված'
                            : order.status === 'pending'
                              ? 'Սպասման մեջ'
                              : order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(order.createdAt).toLocaleDateString('hy-AM')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
