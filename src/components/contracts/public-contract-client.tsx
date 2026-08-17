'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  FileUp,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import {
  agreeToLicenseContract,
  uploadSignedLicenseByToken,
} from '@/app/actions/license-contracts';
import LicenseContractBody from '@/components/contracts/license-contract-body';
import { GOCINEMA_LEGAL } from '@/lib/gocinema-legal';
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
    <div className="min-h-screen bg-[#12110f] text-[#1a1a1a]">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0c0b0a]/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/images/gocinema-go-logo.png"
              alt="GO CINEMA"
              width={72}
              height={80}
              className="h-12 w-auto shrink-0 bg-black"
            />
            <div className="min-w-0">
              <div className="truncate text-[11px] tracking-[0.16em] text-[#e61e21] uppercase">
                Լիցենզային պայմանագիր
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-xs text-white/55 sm:inline">№ {number}</span>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 border border-[#d4a574] px-3 py-2 text-xs font-semibold tracking-wide text-[#d4a574] transition-colors hover:bg-[#d4a574] hover:text-[#0c0b0a]"
            >
              <Printer className="h-4 w-4" />
              Տպել / PDF
            </button>
          </div>
        </div>
      </header>

      <main className="px-3 py-8 sm:py-12">
        <p className="mx-auto mb-6 max-w-[210mm] text-center text-[11px] font-medium tracking-[0.28em] text-[#d4a574]/80 uppercase print:hidden">
          Գաղտնի փաստաթուղթ · միայն պայմանագրի կողմերի համար
        </p>
        <p className="mx-auto mb-8 max-w-[210mm] text-center text-sm text-white/70 print:hidden">
          {content.movieTitle}
        </p>

        <LicenseContractBody content={content} bodyHtml={bodyHtml} />

        <section className="mx-auto mt-10 max-w-[210mm] border border-[#d4a574]/25 bg-[#1a1814] p-6 text-white shadow-xl print:hidden">
          <div className="mb-5 flex items-start gap-3 border-b border-white/10 pb-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#d4a574]" />
            <div>
              <h2 className="text-lg font-semibold tracking-wide">
                Էլեկտրոնային հաստատում
              </h2>
              <p className="mt-1 text-sm text-white/65">
                Կարդացեք փաստաթուղթը, հաստատեք պայմանները, տպեք և կցեք
                ստորագրված օրինակը։
              </p>
            </div>
          </div>

          <ol className="mb-6 grid gap-3 text-sm text-white/80 sm:grid-cols-2">
            <li className="border border-white/10 bg-white/5 px-3 py-2">
              1. Ծանոթացեք պայմանագրին
            </li>
            <li className="border border-white/10 bg-white/5 px-3 py-2">
              2. Հաստատեք համաձայնությունը
            </li>
            <li className="border border-white/10 bg-white/5 px-3 py-2">
              3. Տպեք և ստորագրեք
            </li>
            <li className="border border-white/10 bg-white/5 px-3 py-2">
              4. Կցեք ստորագրված PDF-ը
            </li>
          </ol>

          {error && (
            <p className="mb-4 border border-red-400/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          {agreedAt ? (
            <p className="mb-5 flex items-center gap-2 border border-emerald-400/30 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Պայմաններին համաձայն եք։ Կարող եք տպել և կցել ստորագրված տարբերակը։
            </p>
          ) : (
            <div className="mb-5 space-y-4">
              <label className="flex items-start gap-3 border border-[#d4a574]/30 bg-black/30 px-4 py-3 text-sm leading-relaxed text-white/90">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#d4a574]"
                />
                Հաստատում եմ, որ ծանոթացել եմ սույն լիցենզային պայմանագրին ու
                հավելվածին և համաձայն եմ դրանց պայմաններին։
              </label>
              <button
                type="button"
                onClick={() => void handleAgree()}
                disabled={saving || !checked}
                className="w-full bg-[#d4a574] px-4 py-3 text-sm font-semibold tracking-wide text-[#0c0b0a] transition-opacity disabled:opacity-40 sm:w-auto"
              >
                {saving ? 'Հաստատվում է…' : 'Հաստատել պայմանները'}
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
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#d4a574] underline underline-offset-4"
                >
                  <FileUp className="h-4 w-4" />
                  {signedName || 'Ստորագրված ֆայլ'}
                </a>
              ) : (
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-white/85">
                    <FileUp className="h-4 w-4 text-[#d4a574]" />
                    Կցել ստորագրված օրինակը
                  </span>
                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleUpload(file);
                    }}
                    className="block w-full text-sm text-white/80 file:mr-3 file:border-0 file:bg-[#d4a574] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#0c0b0a]"
                  />
                  <p className="mt-2 text-xs text-white/45">
                    PDF կամ նկար, մինչև 15MB
                    {uploading ? ' · Ներբեռնվում է…' : ''}
                  </p>
                </label>
              )}
            </div>
          )}
        </section>

        <footer className="mx-auto mt-10 max-w-[210mm] pb-8 text-center text-[11px] leading-relaxed text-white/40 print:hidden">
          {GOCINEMA_LEGAL.shortName}
          <br />
          {GOCINEMA_LEGAL.address} · {GOCINEMA_LEGAL.email} · ՀՎՀՀ{' '}
          {GOCINEMA_LEGAL.tin}
        </footer>
      </main>
    </div>
  );
}
