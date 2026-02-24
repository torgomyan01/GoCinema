'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Ticket as TicketIcon, AlertCircle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import TicketCard from './ticket-card';
import TicketsFilter from './tickets-filter';
import { SITE_URL } from '@/utils/consts';
import { getUserTickets } from '@/app/actions/tickets';

type TicketStatus = 'all' | 'reserved' | 'paid' | 'used' | 'cancelled';

interface Ticket {
  id: number;
  price: number;
  status: 'reserved' | 'paid' | 'used' | 'cancelled';
  qrCode?: string | null;
  createdAt: Date | string;
  screening: {
    id: number;
    startTime: Date | string;
    endTime: Date | string;
    movie: {
      id: number;
      title: string;
      slug?: string | null | undefined;
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
  order?: {
    id: number;
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
  } | null;
}

export default function TicketsPageClient() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus>('all');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Redirect if not authenticated
    if (sessionStatus === 'unauthenticated') {
      router.push(SITE_URL.ACCOUNT);
      return;
    }

    // Load tickets if authenticated
    if (sessionStatus === 'authenticated' && session?.user) {
      const loadTickets = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const user = session.user as any;
          const userId =
            typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
          if (isNaN(userId)) {
            setError('Օգտատիրոջ ID-ն վավեր չէ');
            setIsLoading(false);
            return;
          }
          const result = await getUserTickets(userId);
          if (result.success && result.tickets) {
            setTickets(result.tickets as Ticket[]);
          } else {
            setError(result.error || 'Տոմսերը բեռնելիս սխալ է տեղի ունեցել');
          }
        } catch (err) {
          console.error('Error loading tickets:', err);
          setError('Տոմսերը բեռնելիս սխալ է տեղի ունեցել');
        } finally {
          setIsLoading(false);
        }
      };

      loadTickets();
    }
  }, [session, sessionStatus, router]);

  const filteredTickets = useMemo(() => {
    if (selectedStatus === 'all') {
      return tickets;
    }
    return tickets.filter((ticket) => ticket.status === selectedStatus);
  }, [tickets, selectedStatus]);

  const statusCounts = useMemo(() => {
    return {
      all: tickets.length,
      reserved: tickets.filter((t) => t.status === 'reserved').length,
      paid: tickets.filter((t) => t.status === 'paid').length,
      used: tickets.filter((t) => t.status === 'used').length,
      cancelled: tickets.filter((t) => t.status === 'cancelled').length,
    };
  }, [tickets]);

  if (sessionStatus === 'loading' || isLoading) {
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

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Սխալ է տեղի ունեցել
            </h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
            >
              Կրկին փորձել
            </button>
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
          className="text-center mb-12"
        >
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
            Իմ տոմսերը
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Դիտեք ձեր բոլոր ամրագրված և գնված տոմսերը
          </p>
        </motion.div>

        {/* Filter */}
        <TicketsFilter
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          statusCounts={statusCounts}
        />

        {/* Tickets List */}
        {filteredTickets.length > 0 ? (
          <div className="space-y-6">
            {filteredTickets.map((ticket, index) => (
              <TicketCard key={ticket.id} ticket={ticket} index={index} />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
              <TicketIcon className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Տոմսեր չեն գտնվել
            </h3>
            <p className="text-gray-600 mb-6">
              {selectedStatus === 'all'
                ? 'Դուք դեռ չունեք ամրագրված տոմսեր'
                : `Չկան ${selectedStatus === 'reserved' ? 'ամրագրված' : selectedStatus === 'paid' ? 'վճարված' : selectedStatus === 'used' ? 'օգտագործված' : 'չեղարկված'} տոմսեր`}
            </p>
            <a
              href={SITE_URL.SCHEDULE}
              className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all"
            >
              Դիտել ժամանակացույց
            </a>
          </motion.div>
        )}
      </div>
    </div>
  );
}
