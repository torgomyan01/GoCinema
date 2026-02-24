'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { SITE_URL } from '@/utils/consts';

export default function ShareTicketPageClient({
  initialCode,
}: {
  initialCode?: string;
}) {
  const searchParams = useSearchParams();
  const code = initialCode || searchParams.get('code') || '';

  const hasCode = !!code;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-2">
          Տոմսի QR
        </h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          Ցույց տվեք այս QR կոդը մուտքի ժամանակ՝ դահլիճ մուտք գործելու համար։
        </p>

        {hasCode ? (
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-white rounded-xl border-2 border-gray-200">
              <QRCodeSVG
                value={code}
                size={260}
                level="H"
                includeMargin={true}
                fgColor="#7c3aed"
                bgColor="#ffffff"
              />
            </div>
            <p className="text-xs text-gray-500 text-center">
              Խնդրում ենք պահել էկրանը լուսավոր և QR կոդը ամբողջությամբ տեսանելի,
              որպեսզի սկաները հեշտությամբ կարդա այն։
            </p>
          </div>
        ) : (
          <div className="text-center text-sm text-red-600">
            Հղման մեջ QR կոդի տվյալներ չկան։ Խնդրում ենք կրկին բացել հղումը կամ
            ստանալ նոր հղում։
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href={SITE_URL.HOME}
            className="inline-block px-5 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors"
          >
            Վերադառնալ GoCinema
          </Link>
        </div>
      </div>
    </div>
  );
}

