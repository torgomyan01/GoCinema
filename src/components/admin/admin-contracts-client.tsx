'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  Mail,
  Pencil,
  Plus,
  ScrollText,
  Trash2,
  X,
} from 'lucide-react';
import {
  attachSignedLicenseContract,
  createLicenseContract,
  deleteLicenseContract,
  updateLicenseContractBody,
  type LicenseContractView,
} from '@/app/actions/license-contracts';
import { sendProducerWeeklyReportEmail } from '@/app/actions/producer-weekly-reports';
import DocumentUpload from '@/components/admin/document-upload';
import LicenseContractBody from '@/components/contracts/license-contract-body';
import {
  contractStatusLabel,
  formatContractDate,
  type LicenseContractContent,
} from '@/lib/license-contract';

type CompanyOption = {
  id: number;
  name: string;
  tin: string;
  bankName: string | null;
  bankAccount: string | null;
  address: string | null;
  director: string | null;
  email: string | null;
  isActive: boolean;
};

type MovieOption = {
  id: number;
  title: string;
  duration: number;
  ageRating: string | null;
  releaseDate: Date | string;
  hasContract: boolean;
};

function toDateInput(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function contractPath(token: string) {
  return `/contract/${token}`;
}

function contractContent(row: LicenseContractView): LicenseContractContent {
  return {
    number: row.number,
    contractDate: row.contractDate,
    premiereDate: row.premiereDate,
    movieTitle: row.movieTitle,
    productionCountry: row.productionCountry,
    language: row.language,
    durationMinutes: row.durationMinutes,
    ageRating: row.ageRating,
    royaltyPercent: row.royaltyPercent,
    company: {
      name: row.companyName,
      tin: row.companyTin,
      bankName: row.companyBankName,
      bankAccount: row.companyBankAccount,
      address: row.companyAddress,
      director: row.companyDirector,
      email: row.companyEmail,
    },
  };
}

type Props = {
  initialContracts: LicenseContractView[];
  initialError: string | null;
  companies: CompanyOption[];
  movies: MovieOption[];
};

export default function AdminContractsClient({
  initialContracts,
  initialError,
  companies,
  movies,
}: Props) {
  const [contracts, setContracts] = useState(initialContracts);
  const [error, setError] = useState(initialError);
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [preview, setPreview] = useState<LicenseContractView | null>(null);
  const [editingText, setEditingText] = useState(false);
  const [editHtml, setEditHtml] = useState('');
  const [savingText, setSavingText] = useState(false);
  const documentRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [signTarget, setSignTarget] = useState<LicenseContractView | null>(null);
  const [licenseeSignedUrl, setLicenseeSignedUrl] = useState('');
  const [licenseeSignedName, setLicenseeSignedName] = useState('');
  const [licensorSignedUrl, setLicensorSignedUrl] = useState('');
  const [licensorSignedName, setLicensorSignedName] = useState('');
  const [savingSignedSide, setSavingSignedSide] = useState<
    'licensee' | 'licensor' | null
  >(null);
  const [movieOptions, setMovieOptions] = useState(movies);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [sendingReportId, setSendingReportId] = useState<number | 'all' | null>(
    null
  );
  const [notice, setNotice] = useState<string | null>(null);

  const [companyId, setCompanyId] = useState('');
  const [movieId, setMovieId] = useState('');
  const [contractDate, setContractDate] = useState(todayInput());
  const [premiereDate, setPremiereDate] = useState('');
  const [productionCountry, setProductionCountry] = useState(
    'Հայաստանի Հանրապետություն'
  );
  const [language, setLanguage] = useState('Հայերեն');
  const [royaltyPercent, setRoyaltyPercent] = useState('50');

  const selectedCompany = companies.find((c) => String(c.id) === companyId);
  const selectedMovie = movieOptions.find((m) => String(m.id) === movieId);
  const availableMovies = useMemo(
    () => movieOptions.filter((m) => !m.hasContract),
    [movieOptions]
  );

  const openCreate = () => {
    setCompanyId('');
    setMovieId('');
    setContractDate(todayInput());
    setPremiereDate('');
    setProductionCountry('Հայաստանի Հանրապետություն');
    setLanguage('Հայերեն');
    setRoyaltyPercent('50');
    setFormError(null);
    setIsOpen(true);
  };

  const handleMovieChange = (id: string) => {
    setMovieId(id);
    const movie = movieOptions.find((m) => String(m.id) === id);
    if (movie) setPremiereDate(toDateInput(movie.releaseDate));
  };

  const handleCreate = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const res = await createLicenseContract({
        movieId: Number(movieId),
        companyId: Number(companyId),
        contractDate,
        premiereDate,
        productionCountry,
        language,
        royaltyPercent: Number(royaltyPercent),
      });
      if (!res.success || !res.contract) {
        setFormError(res.error || 'Չհաջողվեց ստեղծել');
        return;
      }
      setContracts((prev) => [res.contract!, ...prev]);
      setMovieOptions((prev) =>
        prev.map((movie) =>
          movie.id === res.contract!.movieId
            ? { ...movie, hasContract: true }
            : movie
        )
      );
      setIsOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async (row: LicenseContractView) => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${contractPath(row.publicToken)}`
      );
      setCopiedId(row.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setError('Չհաջողվեց պատճենել հղումը');
    }
  };

  const handleAttachSigned = async (side: 'licensee' | 'licensor') => {
    if (!signTarget) return;
    const signedUrl = side === 'licensee' ? licenseeSignedUrl : licensorSignedUrl;
    const signedName = side === 'licensee' ? licenseeSignedName : licensorSignedName;
    if (!signedUrl) return;

    setSavingSignedSide(side);
    const res = await attachSignedLicenseContract(
      signTarget.id,
      side,
      signedUrl,
      signedName
    );
    setSavingSignedSide(null);
    if (!res.success || !res.contract) {
      setError(res.error || 'Չհաջողվեց կցել');
      return;
    }
    setContracts((prev) =>
      prev.map((row) => (row.id === res.contract!.id ? res.contract! : row))
    );
    setSignTarget(res.contract);
    if (side === 'licensee') {
      setLicenseeSignedUrl(res.contract.licenseeSignedUrl || '');
      setLicenseeSignedName(res.contract.licenseeSignedName || '');
    } else {
      setLicensorSignedUrl(res.contract.licensorSignedUrl || '');
      setLicensorSignedName(res.contract.licensorSignedName || '');
    }
  };

  const startEditingText = () => {
    const html = documentRef.current?.innerHTML || preview?.bodyHtml || '';
    setEditHtml(html);
    setEditingText(true);
  };

  const handleDelete = async (row: LicenseContractView) => {
    const signedNote =
      row.licenseeSignedUrl || row.licensorSignedUrl
        ? ' Կցված ֆայլերը կմնան սերվերում, բայց պայմանագիրը ցանկից կհեռացվի։'
        : '';
    if (
      !window.confirm(
        `Ջնջե՞լ № ${row.number} պայմանագիրը («${row.movieTitle}»)։ Հանրային հղումը այլևս չի աշխատի։${signedNote}`
      )
    ) {
      return;
    }

    setDeletingId(row.id);
    setError(null);
    try {
      const res = await deleteLicenseContract(row.id);
      if (!res.success) {
        setError(res.error || 'Չհաջողվեց ջնջել պայմանագիրը');
        return;
      }
      setContracts((prev) => prev.filter((item) => item.id !== row.id));
      setMovieOptions((prev) =>
        prev.map((movie) =>
          movie.id === row.movieId ? { ...movie, hasContract: false } : movie
        )
      );
      if (preview?.id === row.id) {
        setPreview(null);
        setEditingText(false);
      }
      if (signTarget?.id === row.id) {
        setSignTarget(null);
        setLicenseeSignedUrl('');
        setLicenseeSignedName('');
        setLicensorSignedUrl('');
        setLicensorSignedName('');
      }
    } finally {
      setDeletingId(null);
    }
  };

  const summarizeReportResult = (
    results: Array<{ movieTitle: string; status: string; reason?: string; recipients: string[] }>
  ) => {
    const sent = results.filter((row) => row.status === 'sent');
    const skipped = results.filter((row) => row.status === 'skipped');
    const failed = results.filter((row) => row.status === 'failed');
    if (failed.length) {
      const reasons = [
        ...new Set(failed.map((row) => row.reason || 'սխալ')),
      ];
      if (reasons.length === 1) {
        return `${failed.length} հաշվետվություն չգնաց։ ${reasons[0]}`;
      }
      return failed
        .map((row) => `${row.movieTitle}: ${row.reason || 'սխալ'}`)
        .join(' · ');
    }
    if (sent.length) {
      const emails = sent.flatMap((row) => row.recipients);
      return `Ուղարկվեց ${sent.length} հաշվետվություն${emails.length ? ` · ${emails.join(', ')}` : ''}`;
    }
    return skipped[0]?.reason || 'Հաշվետվություն չուղարկվեց';
  };

  const handleSendReport = async (row: LicenseContractView, force = false) => {
    const question = force
      ? `Կրկի՞ն ուղարկել նախորդ շաբաթվա հաշվետվությունը «${row.movieTitle}» ֆիլմի համար։`
      : `Ուղարկե՞լ նախորդ շաբաթվա հաշվետվությունը «${row.movieTitle}» ֆիլմի արտադրողին։`;
    if (!window.confirm(question)) return;

    setSendingReportId(row.id);
    setError(null);
    setNotice(null);
    try {
      const res = await sendProducerWeeklyReportEmail({
        movieId: row.movieId,
        period: 'previous',
        force,
      });
      if (!res.success && !res.results.length) {
        setError(res.error || 'Չհաջողվեց ուղարկել հաշվետվությունը');
        return;
      }
      const alreadySent = res.results.some(
        (item) =>
          item.status === 'skipped' &&
          item.reason?.includes('արդեն ուղարկված')
      );
      if (alreadySent && !force) {
        if (
          window.confirm(
            'Այս շաբաթվա հաշվետվությունն արդեն ուղարկված է։ Կրկի՞ն ուղարկել։'
          )
        ) {
          setSendingReportId(null);
          await handleSendReport(row, true);
          return;
        }
      }
      const failed = res.results.some((item) => item.status === 'failed');
      const sent = res.results.find((item) => item.status === 'sent');
      const message = summarizeReportResult(res.results);
      if (failed) {
        setError(message || res.error || 'Չհաջողվեց ուղարկել հաշվետվությունը');
      } else {
        setNotice(`${res.weekLabel} · ${message}`);
      }
      if (sent) {
        setContracts((prev) =>
          prev.map((item) =>
            item.id === row.id
              ? {
                  ...item,
                  lastWeeklyReport: {
                    weekStart: new Date(),
                    weekEnd: new Date(),
                    sentAt: new Date(),
                    recipients: JSON.stringify(sent.recipients),
                  },
                }
              : item
          )
        );
      }
    } finally {
      setSendingReportId(null);
    }
  };

  const handleSendAllReports = async () => {
    if (
      !window.confirm(
        'Ուղարկե՞լ նախորդ շաբաթվա հաշվետվությունները բոլոր ֆիլմ արտադրողներին։ Արդեն ուղարկվածները կրկին չեն գնա։'
      )
    ) {
      return;
    }
    setSendingReportId('all');
    setError(null);
    setNotice(null);
    try {
      const res = await sendProducerWeeklyReportEmail({ period: 'previous' });
      if (!res.success && !res.results.length) {
        setError(res.error || 'Չհաջողվեց ուղարկել հաշվետվությունները');
        return;
      }
      const message = summarizeReportResult(res.results);
      if (res.results.some((item) => item.status === 'failed')) {
        setError(message || res.error || 'Չհաջողվեց ուղարկել հաշվետվությունը');
      } else {
        setNotice(`${res.weekLabel} · ${message}`);
      }
    } finally {
      setSendingReportId(null);
    }
  };

  const handleSaveText = async () => {
    if (!preview) return;
    const html = editorRef.current?.innerHTML || editHtml;
    setSavingText(true);
    setError(null);
    try {
      const res = await updateLicenseContractBody(preview.id, html);
      if (!res.success || !res.contract) {
        setError(res.error || 'Չհաջողվեց պահպանել տեքստը');
        return;
      }
      setContracts((prev) =>
        prev.map((row) => (row.id === res.contract!.id ? res.contract! : row))
      );
      setPreview(res.contract);
      setEditingText(false);
    } finally {
      setSavingText(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-slate-100 p-2">
            <ScrollText className="h-6 w-6 text-slate-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Պայմանագրեր</h1>
            <p className="text-sm text-gray-600">
              Լիցենզային պայմանագիր ֆիլմի համար. հղումը ուղարկիր արտադրողին
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleSendAllReports()}
            disabled={sendingReportId === 'all'}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            <Mail className="h-4 w-4" />
            {sendingReportId === 'all'
              ? 'Ուղարկվում է…'
              : 'Շաբաթական հաշվետվություններ'}
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            Ստեղծել պայմանագիր
          </button>
        </div>
      </div>

      {notice && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {contracts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center text-sm text-gray-500">
          Պայմանագիր չկա։ Ստեղծիր առաջինը։
        </div>
      ) : (
        <ul className="space-y-3">
          {contracts.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500">
                    № {row.number}
                  </p>
                  <h2 className="font-semibold text-gray-900">{row.movieTitle}</h2>
                  <p className="text-sm text-gray-600">{row.companyName}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatContractDate(row.contractDate)} · պրեմիերա{' '}
                    {formatContractDate(row.premiereDate)} · ռոյալթի{' '}
                    {row.royaltyPercent}%
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {contractStatusLabel(row.status)}
                    {row.agreedAt && (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        հաստատվել է {formatContractDate(row.agreedAt)}
                      </span>
                    )}
                    {row.bodyHtml && (
                      <span className="ml-2 text-xs font-normal text-purple-600">
                        · տեքստը խմբագրված է
                      </span>
                    )}
                  </p>
                  {row.lastWeeklyReport?.sentAt && (
                    <p className="mt-1 text-xs text-gray-500">
                      Վերջին հաշվետվություն՝{' '}
                      {formatContractDate(row.lastWeeklyReport.sentAt)}
                      {row.companyEmail ? ` · ${row.companyEmail}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyLink(row)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {copiedId === row.id ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Հղում
                  </button>
                  <a
                    href={contractPath(row.publicToken)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Բացել
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setPreview(row);
                      setEditingText(false);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <FileText className="h-4 w-4" />
                    Տեքստ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSignTarget(row);
                      setLicenseeSignedUrl(row.licenseeSignedUrl || '');
                      setLicenseeSignedName(row.licenseeSignedName || '');
                      setLicensorSignedUrl(row.licensorSignedUrl || '');
                      setLicensorSignedName(row.licensorSignedName || '');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white"
                  >
                    Սկան
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSendReport(row)}
                    disabled={sendingReportId === row.id || sendingReportId === 'all'}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Mail className="h-4 w-4" />
                    {sendingReportId === row.id ? 'Ուղարկվում է…' : 'Հաշվետվություն'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(row)}
                    disabled={deletingId === row.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deletingId === row.id ? 'Ջնջվում է…' : 'Ջնջել'}
                  </button>
                </div>
              </div>
              {(row.licenseeSignedUrl || row.licensorSignedUrl) && (
                <div className="mt-3 flex flex-wrap gap-4">
                  {row.licenseeSignedUrl && (
                    <a
                      href={row.licenseeSignedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-purple-700 hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      Լիցենզատու · {row.licenseeSignedName || 'Ֆայլ'}
                    </a>
                  )}
                  {row.licensorSignedUrl && (
                    <a
                      href={row.licensorSignedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-purple-700 hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      Լիցենզառու · {row.licensorSignedName || 'Ֆայլ'}
                    </a>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Նոր պայմանագիր
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 text-sm">
                <span className="mb-1 block font-medium text-gray-700">
                  Ընկերություն *
                </span>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-slate-400"
                >
                  <option value="">Ընտրել…</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name} · ՀՎՀՀ {company.tin}
                    </option>
                  ))}
                </select>
              </label>

              {selectedCompany && (
                <div className="sm:col-span-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  <p>Տնօրեն՝ {selectedCompany.director || '—'}</p>
                  <p>Հասցե՝ {selectedCompany.address || '—'}</p>
                  <p>Email՝ {selectedCompany.email || '—'}</p>
                  <p>
                    {selectedCompany.bankName || '—'} ·{' '}
                    {selectedCompany.bankAccount || '—'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Ռեկվիզիտները վերցվում են ընկերության քարտից։ Եթե թերի են,{' '}
                    <Link href="/admin/companies" className="underline">
                      լրացրու ընկերությունում
                    </Link>
                    ։
                  </p>
                </div>
              )}

              <label className="sm:col-span-2 text-sm">
                <span className="mb-1 block font-medium text-gray-700">
                  Ֆիլմ *
                </span>
                <select
                  value={movieId}
                  onChange={(e) => handleMovieChange(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-slate-400"
                >
                  <option value="">Ընտրել…</option>
                  {availableMovies.map((movie) => (
                    <option key={movie.id} value={movie.id}>
                      {movie.title}
                    </option>
                  ))}
                </select>
                {availableMovies.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Բոլոր ֆիլմերն արդեն պայմանագիր ունեն։
                  </p>
                )}
              </label>

              {selectedMovie && (
                <p className="sm:col-span-2 text-xs text-gray-500">
                  Տևողություն՝ {selectedMovie.duration} րոպե
                  {selectedMovie.ageRating
                    ? ` · ${selectedMovie.ageRating}`
                    : ''}
                </p>
              )}

              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">
                  Կնքման ամսաթիվ
                </span>
                <input
                  type="date"
                  value={contractDate}
                  onChange={(e) => setContractDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">
                  Պրեմիերա
                </span>
                <input
                  type="date"
                  value={premiereDate}
                  onChange={(e) => setPremiereDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">
                  Արտադրող երկիր
                </span>
                <input
                  value={productionCountry}
                  onChange={(e) => setProductionCountry(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">Լեզու</span>
                <input
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">
                  Ռոյալթի %
                </span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={royaltyPercent}
                  onChange={(e) => setRoyaltyPercent(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700"
              >
                Փակել
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={saving}
                className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Ստեղծվում է…' : 'Ստեղծել և ստանալ հղում'}
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto my-6 max-w-4xl rounded-2xl bg-[#f4f1ea] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-700">
                {editingText
                  ? 'Խմբագրիր տեքստը ուղիղ փաստաթղթի վրա'
                  : preview.bodyHtml
                    ? 'Պահպանված խմբագրված տեքստ'
                    : 'Կաղապարից գեներացված տեքստ'}
              </p>
              <div className="flex flex-wrap gap-2">
                {editingText ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditingText(false)}
                      className="rounded-lg bg-white px-3 py-2 text-sm font-semibold"
                    >
                      Չեղարկել
                    </button>
                    <button
                      type="button"
                      disabled={savingText}
                      onClick={() => void handleSaveText()}
                      className="rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {savingText ? 'Պահպանվում է…' : 'Պահպանել տեքստը'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={startEditingText}
                      className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold"
                    >
                      <Pencil className="h-4 w-4" />
                      Խմբագրել տեքստը
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPreview(null);
                        setEditingText(false);
                      }}
                      className="rounded-lg bg-white px-3 py-2 text-sm font-semibold"
                    >
                      Փակել
                    </button>
                  </>
                )}
              </div>
            </div>
            {editingText ? (
              <div
                key="editor"
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{ __html: editHtml }}
                className="rounded-xl ring-2 ring-purple-400 ring-offset-2 outline-none"
              />
            ) : (
              <div ref={documentRef}>
                <LicenseContractBody
                  content={contractContent(preview)}
                  bodyHtml={preview.bodyHtml}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {signTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                Ստորագրված սկաններ · {signTarget.number}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setSignTarget(null);
                  setLicenseeSignedUrl('');
                  setLicenseeSignedName('');
                  setLicensorSignedUrl('');
                  setLicensorSignedName('');
                }}
                className="rounded-lg p-2 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200 p-4">
                <h3 className="mb-1 text-sm font-semibold text-gray-900">
                  Լիցենզատուի կողմից
                </h3>
                <p className="mb-3 text-xs text-gray-500">
                  Լիցենզատուի ստորագրված օրինակը
                </p>
                <DocumentUpload
                  url={licenseeSignedUrl}
                  fileName={licenseeSignedName}
                  onChange={({ url, fileName }) => {
                    setLicenseeSignedUrl(url);
                    setLicenseeSignedName(fileName);
                  }}
                  deleteOnRemove={false}
                />
                <button
                  type="button"
                  onClick={() => void handleAttachSigned('licensee')}
                  disabled={!licenseeSignedUrl || savingSignedSide === 'licensee'}
                  className="mt-3 w-full rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {savingSignedSide === 'licensee' ? 'Պահպանվում է…' : 'Պահպանել'}
                </button>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <h3 className="mb-1 text-sm font-semibold text-gray-900">
                  Լիցենզառուի կողմից
                </h3>
                <p className="mb-3 text-xs text-gray-500">
                  GoCinema-ի ստորագրված օրինակը
                </p>
                <DocumentUpload
                  url={licensorSignedUrl}
                  fileName={licensorSignedName}
                  onChange={({ url, fileName }) => {
                    setLicensorSignedUrl(url);
                    setLicensorSignedName(fileName);
                  }}
                  deleteOnRemove={false}
                />
                <button
                  type="button"
                  onClick={() => void handleAttachSigned('licensor')}
                  disabled={!licensorSignedUrl || savingSignedSide === 'licensor'}
                  className="mt-3 w-full rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {savingSignedSide === 'licensor' ? 'Պահպանվում է…' : 'Պահպանել'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
