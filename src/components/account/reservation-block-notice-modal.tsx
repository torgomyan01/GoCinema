'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Ban, X } from 'lucide-react';
import { getMyReservationBlockStatus } from '@/app/actions/users';

const DISMISS_KEY_PREFIX = 'gocinema_block_notice_dismissed';

function dismissStorageKey(userId: string | number, blockedAt: string | null) {
  return `${DISMISS_KEY_PREFIX}:${userId}:${blockedAt || 'blocked'}`;
}

function wasDismissed(userId: string | number, blockedAt: string | null) {
  try {
    return localStorage.getItem(dismissStorageKey(userId, blockedAt)) === '1';
  } catch {
    return false;
  }
}

function markDismissed(userId: string | number, blockedAt: string | null) {
  try {
    localStorage.setItem(dismissStorageKey(userId, blockedAt), '1');
  } catch {
    // ignore
  }
}

/**
 * Արգելափակված օգտատիրոջը մուտքից հետո ցույց է տալիս մոդալ։
 * Փակելուց հետո նույն արգելափակման համար այլևս չի բացվում։
 */
export default function ReservationBlockNoticeModal() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [blockedAt, setBlockedAt] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const userId = session?.user
    ? (session.user as { id?: string | number }).id
    : null;

  useEffect(() => {
    if (status === 'unauthenticated') {
      setOpen(false);
      setChecked(false);
      setBlockedAt(null);
      return;
    }

    if (status !== 'authenticated' || userId == null) return;

    let cancelled = false;
    (async () => {
      const result = await getMyReservationBlockStatus();
      if (cancelled) return;
      setChecked(true);

      if (
        result.success &&
        result.isBlocked &&
        !wasDismissed(userId, result.blockedAt)
      ) {
        setBlockedAt(result.blockedAt);
        setOpen(true);
      } else {
        setOpen(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, userId]);

  const handleClose = () => {
    if (userId != null) {
      markDismissed(userId, blockedAt);
    }
    setOpen(false);
  };

  if (!open || !checked || status !== 'authenticated') {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="block-notice-title"
        className="relative w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200"
          aria-label="Փակել"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-5 pb-2 pt-6">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Ban className="h-7 w-7" />
          </div>
          <h2
            id="block-notice-title"
            className="text-center text-lg font-bold text-gray-900"
          >
            Ամրագրման հնարավորությունը արգելափակված է
          </h2>
          <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-gray-600">
            <p>
              Ձեր հաշիվը արգելափակվել է «Ամրագրել, վճարել մուտքի մոտ»
              հնարավորությունից։
            </p>
            <p>
              Պատճառը՝ դուք ամրագրել եք տոմսեր, որոնք պետք է վճարեիք
              դրամարկղում, սակայն չեք եկել։ Այդ իսկ պատճառով այլևս չեք կարող
              օգտվել այս հնարավորությունից։
            </p>
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-950">
              Դուք դեռ կարող եք գնել տոմսեր օնլայն վճարմամբ։
            </p>
          </div>
        </div>

        <div className="px-5 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="w-full rounded-xl bg-purple-600 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
          >
            Հասկացա
          </button>
        </div>
      </div>
    </div>
  );
}
