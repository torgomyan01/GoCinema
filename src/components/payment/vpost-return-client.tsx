'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { SITE_URL } from '@/utils/consts';
import { syncVPostOrderStatus } from '@/app/actions/payments';

interface VpostReturnClientProps {
  orderId: string;
}

/**
 * vPost վերադարձի նպատակային էջ։ backURL-ում չպետք է լինեն մեր query-ները —
 * հակառակ դեպքում ITF-ը կցում է ?orderId=… և URL-ում կրկնակի ? է առաջանում,
 * Next-ի searchParams-ը չի տեսնում return=1։
 */
export default function VpostReturnClient({ orderId }: VpostReturnClientProps) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus === 'loading') return;

    if (!session?.user) {
      router.replace(
        `${SITE_URL.ACCOUNT}?callbackUrl=${encodeURIComponent(
          SITE_URL.PAYMENT_VPOST_RETURN(orderId)
        )}`
      );
      return;
    }

    let cancelled = false;

    const run = async () => {
      const idNum = parseInt(orderId, 10);
      if (!Number.isFinite(idNum)) {
        setError('Անվավեր պատվերի համար');
        return;
      }

      const userId =
        typeof (session.user as { id?: string | number }).id === 'string'
          ? parseInt(String((session.user as { id: string }).id), 10)
          : Number((session.user as { id: string | number }).id);

      setError(null);

      try {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          if (cancelled) return;

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
            router.replace(SITE_URL.PAYMENT(idNum));
            return;
          }

          if (syncResult.state === 'failed') {
            setError(syncResult.message || 'Վճարումը մերժվել է');
            return;
          }

          if (attempt < 5) {
            await new Promise((r) => setTimeout(r, 2000));
          }
        }

        if (!cancelled) {
          setError('Վճարումը դեռ չի հաստատվել։ Փորձեք թարմացնել վճարման էջը։');
        }
      } catch (e) {
        console.error('[vpost-return]', e);
        if (!cancelled) {
          setError('Վճարման կարգավիճակը ստուգելիս սխալ եղավ');
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [orderId, session, sessionStatus, router]);

  if (error) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 px-4 max-w-md mx-auto text-center">
        <AlertCircle className="w-14 h-14 text-amber-500" />
        <p className="text-gray-800">{error}</p>
        <Link
          href={SITE_URL.PAYMENT(orderId)}
          className="text-purple-600 font-semibold hover:underline"
        >
          Վերադառնալ վճարման էջ
        </Link>
      </div>
    );
  }

  if (
    sessionStatus === 'loading' ||
    sessionStatus === 'unauthenticated' ||
    (session?.user && !error)
  ) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 px-4">
        <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
        <p className="text-gray-600 text-center">
          {sessionStatus === 'unauthenticated'
            ? 'Վերահղում ենք մուտքի էջ…'
            : 'Ստուգում ենք վճարման կարգավիճակը…'}
        </p>
      </div>
    );
  }

  return null;
}
