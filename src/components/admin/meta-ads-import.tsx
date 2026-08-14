'use client';

import { useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import {
  confirmMetaAdsImport,
  previewMetaAdsCsv,
} from '@/app/actions/accounting';
import type { MetaAdsImportPreview } from '@/lib/meta-ads-csv';

function formatAmd(value: number): string {
  return `${Math.round(value).toLocaleString('hy-AM')} ֏`;
}

export default function MetaAdsImportButton({
  compact = false,
  onImported,
}: {
  compact?: boolean;
  onImported?: () => Promise<void> | void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MetaAdsImportPreview | null>(null);

  const reset = () => {
    setOpen(false);
    setError(null);
    setPreview(null);
    setIsReading(false);
    setIsSaving(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setIsReading(true);
    setError(null);
    setPreview(null);
    setOpen(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await previewMetaAdsCsv(formData);
      if (!res.success || !res.data) {
        setError(res.error || 'Ֆայլը չհաջողվեց կարդալ');
        return;
      }
      setPreview(res.data);
    } catch (err) {
      console.error('[MetaAdsImport]', err);
      setError('Ֆայլը չհաջողվեց կարդալ');
    } finally {
      setIsReading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleConfirm = async () => {
    if (!preview || preview.newCount === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await confirmMetaAdsImport({ items: preview.items });
      if (!res.success) {
        setError(res.error || 'Գրանցելիս սխալ է տեղի ունեցել');
        return;
      }
      await onImported?.();
      reset();
    } catch (err) {
      console.error('[MetaAdsImport confirm]', err);
      setError('Գրանցելիս սխալ է տեղի ունեցել');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isReading || isSaving}
        className={
          compact
            ? 'inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-800 hover:bg-rose-100 disabled:opacity-60'
            : 'inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-800 transition hover:bg-rose-50 disabled:opacity-60'
        }
      >
        {isReading ? (
          <Loader2 className={compact ? 'h-3 w-3 animate-spin' : 'h-4 w-4 animate-spin'} />
        ) : (
          <Upload className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
        )}
        {compact ? 'Facebook CSV' : 'Բեռնել Facebook CSV'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Facebook Ads հաշիվներ
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  Գրանցվում է որպես փաստաթղթավորված իրացման ծախս (հոդ. 258)։
                  ԿԲ կուրսը վերցվում է վճարման օրվա համար։ ԱԱՀ-ն արդեն ներառված է
                  գումարում։
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                aria-label="Փակել"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {isReading && (
                <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  ԿԲ կուրսերը բեռնվում են...
                </div>
              )}

              {error && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              {preview && (
                <div className="space-y-3">
                  <div className="grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                    {preview.periodLabel && (
                      <p>
                        <span className="text-gray-500">Ժամանակաշրջան՝ </span>
                        {preview.periodLabel}
                      </p>
                    )}
                    {preview.paymentMethod && (
                      <p>
                        <span className="text-gray-500">Վճարում՝ </span>
                        {preview.paymentMethod}
                      </p>
                    )}
                    {preview.accountId && (
                      <p>
                        <span className="text-gray-500">Հաշիվ՝ </span>
                        {preview.accountId}
                      </p>
                    )}
                    <p>
                      <span className="text-gray-500">Նոր՝ </span>
                      {preview.newCount} ·{' '}
                      <span className="text-gray-500">կրկնօրինակ՝ </span>
                      {preview.duplicateCount}
                    </p>
                  </div>

                  {preview.duplicateCount > 0 && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {preview.duplicateCount} վճարում արդեն գրանցված է հաշվի
                      համարով. դրանք կբաց թողնվեն։
                    </p>
                  )}

                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-3 py-2">Ամսաթիվ</th>
                          <th className="px-3 py-2">Transaction ID</th>
                          <th className="px-3 py-2 text-right">Բնօրինակ</th>
                          <th className="px-3 py-2 text-right">ԿԲ կուրս</th>
                          <th className="px-3 py-2 text-right">AMD</th>
                          <th className="px-3 py-2">Կարգավիճակ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.items.map((row) => (
                          <tr
                            key={row.transactionId}
                            className={`border-b border-gray-100 ${
                              row.duplicate ? 'bg-amber-50/70 text-gray-500' : ''
                            }`}
                          >
                            <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                              {row.date}
                            </td>
                            <td
                              className="max-w-[180px] truncate px-3 py-2 font-mono text-xs"
                              title={row.transactionId}
                            >
                              {row.transactionId}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {row.originalAmount.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{' '}
                              {row.currency}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {row.fxRate.toLocaleString('hy-AM', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 4,
                              })}
                              {row.rateDate !== row.date ? (
                                <span className="block text-[10px] text-gray-400">
                                  {row.rateDate}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums">
                              {formatAmd(row.amountAmd)}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {row.duplicate ? 'կրկնօրինակ' : 'նոր'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between gap-3 border-t border-gray-100 pt-3 text-sm font-semibold text-gray-900">
                    <span>Նոր հաշիվներ (առանց կրկնօրինակների)</span>
                    <span className="tabular-nums">
                      {formatAmd(preview.totalAmd)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Չեղարկել
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={!preview || preview.newCount === 0 || isSaving || isReading}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Հաստատել և ավելացնել
                {preview && preview.newCount > 0 ? ` (${preview.newCount})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
