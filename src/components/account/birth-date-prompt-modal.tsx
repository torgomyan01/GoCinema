'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Calendar, Cake } from 'lucide-react';
import {
  getMyBirthDateStatus,
  updateMyBirthDate,
} from '@/app/actions/auth';
import {
  birthDateInputMax,
  birthDateInputMin,
} from '@/lib/birth-date';

/**
 * Առկա օգտատերերին, որոնք ծննդյան ամսաթիվ չունեն,
 * խնդրում է լրացնել մոդալով։
 */
export default function BirthDatePromptModal() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      setOpen(false);
      setChecked(false);
      setBirthDate('');
      setError('');
      return;
    }

    if (status !== 'authenticated') return;

    let cancelled = false;
    (async () => {
      const result = await getMyBirthDateStatus();
      if (cancelled) return;
      setChecked(true);
      if (result.success && result.needsBirthDate) {
        setOpen(true);
      } else {
        setOpen(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!birthDate) {
      setError('Խնդրում ենք լրացնել ծննդյան ամսաթիվը');
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateMyBirthDate(birthDate);
      if (!result.success) {
        setError(result.error || 'Պահպանելը ձախողվեց');
        return;
      }
      setOpen(false);
    } catch {
      setError('Սխալ է տեղի ունեցել');
    } finally {
      setIsSaving(false);
    }
  };

  if (!open || !checked || status !== 'authenticated') {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="birthdate-prompt-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-purple-100">
            <Cake className="h-7 w-7 text-purple-600" />
          </div>
          <h2
            id="birthdate-prompt-title"
            className="text-xl font-bold text-gray-900"
          >
            Լրացրեք ծննդյան ամսաթիվը
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Խնդրում ենք լրացնել ձեր ծննդյան ամսաթիվը՝ հաշիվը ամբողջական
            դարձնելու համար։
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="birthDatePrompt"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Ծննդյան ամսաթիվ <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                id="birthDatePrompt"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
                min={birthDateInputMin()}
                max={birthDateInputMax()}
                className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving || !birthDate}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold transition-all ${
              isSaving || !birthDate
                ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                : 'bg-linear-to-r from-purple-600 to-pink-600 text-white shadow-md hover:from-purple-700 hover:to-pink-700 hover:shadow-lg'
            }`}
          >
            {isSaving ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Պահպանվում է...
              </>
            ) : (
              'Պահպանել'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
