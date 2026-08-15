import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle: string;
  error?: string | null;
  onRefresh?: () => void;
  onDownload?: () => void;
  downloadDisabled?: boolean;
  extraActions?: ReactNode;
  children: ReactNode;
};

export default function SmmToolShell({
  title,
  subtitle,
  error,
  onRefresh,
  onDownload,
  downloadDisabled,
  extraActions,
  children,
}: Props) {
  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/smm"
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50"
            aria-label="Վերադառնալ SMM"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-xs font-medium text-fuchsia-700">SMM գործիք</p>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-600">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {extraActions}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              Թարմացնել
            </button>
          )}
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              disabled={downloadDisabled}
              className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-fuchsia-700 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Ներբեռնել PNG
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {children}
    </div>
  );
}
