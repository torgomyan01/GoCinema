'use client';

import { useState } from 'react';
import {
  agreeToLicenseContract,
  uploadSignedLicenseByToken,
} from '@/app/actions/license-contracts';
import LicenseContractBody from '@/components/contracts/license-contract-body';
import type { LicenseContractContent } from '@/lib/license-contract';

type Props = {
  token: string;
  number: string;
  status: string;
  agreedAt: Date | string | null;
  signedUrl: string | null;
  signedName: string | null;
  content: LicenseContractContent;
  bodyHtml?: string | null;
};

export default function PublicContractClient({
  token,
  number,
  agreedAt: initialAgreedAt,
  signedUrl: initialSignedUrl,
  signedName: initialSignedName,
  content,
  bodyHtml,
}: Props) {
  const [agreedAt, setAgreedAt] = useState<Date | string | null>(initialAgreedAt);
  const [signedUrl, setSignedUrl] = useState(initialSignedUrl);
  const [signedName, setSignedName] = useState(initialSignedName);
  const [checked, setChecked] = useState(Boolean(initialAgreedAt));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAgree = async () => {
    if (!checked) {
      setError('Նշիր, որ համաձայն ես պայմաններին');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await agreeToLicenseContract(token);
      if (!res.success) {
        setError(res.error || 'Չհաջողվեց հաստատել');
        return;
      }
      setAgreedAt(res.agreedAt || new Date());
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await uploadSignedLicenseByToken(token, formData);
      if (!res.success) {
        setError(res.error || 'Չհաջողվեց կցել ֆայլը');
        return;
      }
      setSignedUrl(res.signedUrl || null);
      setSignedName(res.signedName || file.name);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#1a1a1a]">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-center gap-2 bg-[#111] px-3 py-3 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded bg-white px-4 py-2 text-sm font-medium text-black"
        >
          Տպել / Պահել որպես PDF
        </button>
        <span className="text-xs text-white/70">№ {number}</span>
      </div>

      <div className="mx-auto max-w-4xl px-3 py-6">
        <LicenseContractBody content={content} bodyHtml={bodyHtml} />

        <section className="mx-auto mt-8 max-w-[210mm] rounded-2xl bg-white p-5 shadow print:hidden">
          <h2 className="mb-3 text-lg font-semibold">Հաստատում և ստորագրություն</h2>
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-gray-700">
            <li>Կարդա պայմանագիրը։</li>
            <li>Հաստատիր, որ համաձայն ես պայմաններին։</li>
            <li>Տպիր, ստորագրիր և սկանավորիր։</li>
            <li>Կցիր ստորագրված PDF-ը կամ նկարը։</li>
          </ol>

          {error && (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {agreedAt ? (
            <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Պայմաններին համաձայն ես։ Կարող ես տպել և կցել ստորագրված տարբերակը։
            </p>
          ) : (
            <div className="mb-4 space-y-3">
              <label className="flex items-start gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="mt-1"
                />
                Համաձայն եմ սույն լիցենզային պայմանագրի պայմաններին և
                հավելվածին։
              </label>
              <button
                type="button"
                onClick={() => void handleAgree()}
                disabled={saving || !checked}
                className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Հաստատվում է…' : 'Հաստատել'}
              </button>
            </div>
          )}

          {agreedAt && (
            <div>
              {signedUrl ? (
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-purple-700 underline"
                >
                  {signedName || 'Ստորագրված ֆայլ'}
                </a>
              ) : (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">
                    Կցել ստորագրված ֆայլը
                  </span>
                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleUpload(file);
                    }}
                    className="block w-full text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    PDF կամ նկար, մինչև 15MB
                    {uploading ? ' · Ներբեռնվում է…' : ''}
                  </p>
                </label>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
