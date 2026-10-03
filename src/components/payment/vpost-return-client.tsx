'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { SITE_URL } from '@/utils/consts';
import { completeVPostReturn } from '@/app/actions/payments';
import { getOrderById } from '@/app/actions/orders';

interface VpostReturnClientProps {
  orderId: string;
}

/** Tend-style continuous poll until paid/failed */
const POLL_MS = 4000;
const MAX_ATTEMPTS = 45; // ~3 minutes

/**
 * vPost backURL wait page. No login required so bank return does not lose session.
 * Tickets become paid only after a successful vPost settle.
 */
export default function VpostReturnClient({ orderId }: VpostReturnClientProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pendingHint, setPendingHint] = useState(false);
  const [pollKey, setPollKey] = useState(0);
  const inFlightRef = useRef(false);
  const stoppedRef = useRef(false);
  const attemptRef = useRef(0);

  const redirectIfPaid = useCallback(
    async (idNum: number) => {
      const refreshed = await getOrderById(idNum, { releaseExpired: false });
      if (!refreshed.success || !refreshed.order) return false;
      const tickets = refreshed.order.tickets as Array<{ status: string }>;
      const allPaid =
        tickets.length > 0 &&
        tickets.every((t) => t.status === 'paid' || t.status === 'used');
      if (allPaid) {
        router.replace(SITE_URL.PAYMENT(idNum));
        return true;
      }
      return false;
    },
    [router]
  );

  const confirmOnce = useCallback(async (): Promise<'done' | 'pending'> => {
    const idNum = parseInt(orderId, 10);
    if (!Number.isFinite(idNum)) {
      setError('Անվավեր պատվեր');
      return 'done';
    }

    if (inFlightRef.current || stoppedRef.current) return 'pending';
    inFlightRef.current = true;
    setIsSyncing(true);

    try {
      if (await redirectIfPaid(idNum)) {
        stoppedRef.current = true;
        return 'done';
      }

      attemptRef.current += 1;
      setAttempt(attemptRef.current);

      const syncResult = await completeVPostReturn(idNum);

      if (!syncResult.success) {
        setError(
          syncResult.error || 'Վճարման կարգավիճակը ստուգելիս սխալ եղավ'
        );
        stoppedRef.current = true;
        return 'done';
      }

      if (syncResult.state === 'paid') {
        if (await redirectIfPaid(idNum)) {
          stoppedRef.current = true;
          return 'done';
        }
        setPendingHint(true);
        return 'pending';
      }

      if (syncResult.state === 'failed') {
        setError(syncResult.message || 'Վճարումը մերժվել է');
        stoppedRef.current = true;
        return 'done';
      }

      if (syncResult.state === 'seat_taken') {
        setError(
          syncResult.message ||
            'Ընտրված տեղն այլևս հասանելի չէ։ Խնդրում ենք ընտրել այլ տեղ։'
        );
        stoppedRef.current = true;
        return 'done';
      }

      if (await redirectIfPaid(idNum)) {
        stoppedRef.current = true;
        return 'done';
      }

      setPendingHint(true);
      return 'pending';
    } catch (e) {
      console.error('[vpost-return]', e);
      setError('Վճարման կարգավիճակը ստուգելիս սխալ եղավ');
      stoppedRef.current = true;
      return 'done';
    } finally {
      inFlightRef.current = false;
      setIsSyncing(false);
    }
  }, [orderId, redirectIfPaid]);

  useEffect(() => {
    stoppedRef.current = false;
    attemptRef.current = 0;
    setAttempt(0);
    setError(null);

    void confirmOnce();

    const timer = window.setInterval(() => {
      if (stoppedRef.current) return;
      if (attemptRef.current >= MAX_ATTEMPTS) {
        stoppedRef.current = true;
        setError(
          'Վճարումը դեռ չի հաստատվել։ Եթե գումարը արդեն գանձվել է, սեղմեք «Կրկին ստուգել»։'
        );
        return;
      }
      void confirmOnce();
    }, POLL_MS);

    return () => {
      stoppedRef.current = true;
      window.clearInterval(timer);
    };
  }, [confirmOnce, pollKey]);

  const handleRetry = () => {
    setPollKey((k) => k + 1);
  };

  if (error) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 px-4 max-w-md mx-auto text-center">
        <AlertCircle className="w-14 h-14 text-amber-500" />
        <p className="text-gray-800">{error}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isSyncing}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
          >
            <RefreshCw
              className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
            />
            Կրկին ստուգել
          </button>
          <Link
            href={SITE_URL.PAYMENT(orderId)}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Վերադառնալ վճարման էջ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 px-4">
      <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
      <p className="text-gray-800 text-center font-medium">
        Սպասում ենք վճարման հաստատմանը…
      </p>
      <p className="text-gray-500 text-center text-sm max-w-sm">
        Խնդրում ենք չփակել այս էջը։ Տոմսը կհաստատվի միայն բանկի հաջող
        պատասխանից հետո։
      </p>
      {pendingHint && (
        <p className="text-xs text-amber-700 text-center max-w-sm">
          Բանկը հաստատել է վճարումը — սպասում ենք վերջնական գանձման
          հաստատմանը…
        </p>
      )}
      {attempt > 0 && (
        <p className="text-xs text-gray-400">Ստուգում #{attempt}</p>
      )}
    </div>
  );
}
