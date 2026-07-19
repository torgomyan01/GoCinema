'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { SITE_URL } from '@/utils/consts';
import { syncVPostOrderStatus } from '@/app/actions/payments';
import { getOrderById } from '@/app/actions/orders';

interface VpostReturnClientProps {
  orderId: string;
}

const MAX_ATTEMPTS = 12;
const RETRY_MS = 2000;

/**
 * vPost վերադարձի նպատակային էջ։ backURL-ում query չենք ավելացնում —
 * ITF-ը կցում է իր պարամետրերը։
 */
export default function VpostReturnClient({ orderId }: VpostReturnClientProps) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const syncStartedRef = useRef(false);

  const userId = session?.user
    ? Number((session.user as { id?: string | number }).id)
    : null;

  const redirectIfPaid = useCallback(
    async (idNum: number) => {
      const refreshed = await getOrderById(idNum);
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

  const runSync = useCallback(async () => {
    const idNum = parseInt(orderId, 10);
    if (!Number.isFinite(idNum) || !userId) return;

    setIsSyncing(true);
    setError(null);

    try {
      if (await redirectIfPaid(idNum)) return;

      for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
        setAttempt(i + 1);

        const syncResult = await syncVPostOrderStatus({
          userId,
          orderId: idNum,
        });

        if (!syncResult.success) {
          setError(
            syncResult.error || 'Վճարման կարգավիճակը ստուգելիս սխալ եղավ'
          );
          return;
        }

        if (syncResult.state === 'paid') {
          // Միայն եթե DB-ում տոմսերն իսկապես paid են — redirect
          if (await redirectIfPaid(idNum)) return;
          setError(
            'Վճարումը դեռ հաստատված չէ բազայում։ Սեղմեք «Կրկին ստուգել»։'
          );
          return;
        }

        if (syncResult.state === 'failed') {
          setError(syncResult.message || 'Վճարումը մերժվել է');
          return;
        }

        if (syncResult.state === 'seat_taken') {
          setError(
            syncResult.message ||
              'Ընտրված տեղն այլևս հասանելի չէ։ Խնդրում ենք ընտրել այլ տեղ։'
          );
          return;
        }

        if (await redirectIfPaid(idNum)) return;

        if (i < MAX_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, RETRY_MS));
        }
      }

      setError(
        'Վճարումը դեռ չի հաստատվել։ Եթե գումարը արդեն գանձվել է, սեղմեք «Կրկին ստուգել»։'
      );
    } catch (e) {
      console.error('[vpost-return]', e);
      setError('Վճարման կարգավիճակը ստուգելիս սխալ եղավ');
    } finally {
      setIsSyncing(false);
    }
  }, [orderId, userId, router, redirectIfPaid]);

  useEffect(() => {
    if (sessionStatus === 'loading') return;

    if (sessionStatus === 'unauthenticated' || !userId) {
      router.replace(
        `${SITE_URL.ACCOUNT}?callbackUrl=${encodeURIComponent(
          SITE_URL.PAYMENT_VPOST_RETURN(orderId)
        )}`
      );
      return;
    }

    if (syncStartedRef.current) return;
    syncStartedRef.current = true;
    void runSync();
  }, [sessionStatus, userId, orderId, router, runSync]);

  const handleRetry = () => {
    void runSync();
  };

  if (sessionStatus === 'loading' || sessionStatus === 'unauthenticated') {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 px-4">
        <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
        <p className="text-gray-600 text-center">
          {sessionStatus === 'unauthenticated'
            ? 'Վերահղում ենք մուտքի էջ…'
            : 'Բեռնվում է…'}
        </p>
      </div>
    );
  }

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
      <p className="text-gray-600 text-center">
        Ստուգում ենք վճարման կարգավիճակը…
      </p>
      {attempt > 0 && (
        <p className="text-xs text-gray-400">
          Փորձ {attempt}/{MAX_ATTEMPTS}
        </p>
      )}
    </div>
  );
}
