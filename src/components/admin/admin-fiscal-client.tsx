'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import {
  applyFiscalReprintResult,
  getFiscalReceipts,
  getFiscalReceiptForReprint,
  type FiscalReceiptListItem,
} from '@/app/actions/fiscal';
import {
  checkHdmAgentHealth,
  isHdmAgentEnabled,
  printHdmReceipt,
  printHdmReturn,
  type HdmPrintReceiptInput,
  type HdmReturnReceiptInput,
} from '@/lib/hdm-agent';
import { submitReturnFiscal } from '@/lib/fiscal-flow';

type StatusFilter = 'all' | 'printed' | 'failed';

function formatAmd(value: number) {
  return `${Math.round(value).toLocaleString('hy-AM')} ֏`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('hy-AM', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const OPERATION_LABELS: Record<string, string> = {
  sale: 'Վաճառք',
  return: 'Վերադարձ',
};

const SOURCE_LABELS: Record<string, string> = {
  box_office: 'Դրամարկղ',
  scanner: 'Մուտքի կետ',
};

export default function AdminFiscalClient() {
  const [items, setItems] = useState<FiscalReceiptListItem[]>([]);
  const [failedCount, setFailedCount] = useState(0);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    type: 'success' | 'warning';
    message: string;
  } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getFiscalReceipts({ status: filter, limit: 200 });
      if (res.success) {
        setItems(res.items);
        setFailedCount(res.failedCount);
      } else {
        setError(res.error);
      }
    } catch {
      setError('Ֆիսկալ ցանկը բեռնելիս սխալ');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isHdmAgentEnabled()) {
      setAgentOnline(false);
      return;
    }
    let active = true;
    void checkHdmAgentHealth().then((ok) => {
      if (active) setAgentOnline(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleReprint = async (id: number) => {
    if (busyId) return;
    setBusyId(id);
    setNotice(null);
    try {
      const info = await getFiscalReceiptForReprint(id);
      if (!info.success) {
        setNotice({ type: 'warning', message: info.error });
        return;
      }
      const { operation, requestPayload } = info.receipt;

      if (operation === 'return') {
        const res = await printHdmReturn(
          requestPayload as unknown as HdmReturnReceiptInput
        );
        if (res.ok && res.fiscal) {
          await applyFiscalReprintResult(id, res.fiscal);
          setNotice({
            type: 'success',
            message: `Վերադարձի կտրոն վերատպվեց · № ${res.fiscal.fiscal}`,
          });
        } else {
          setNotice({
            type: 'warning',
            message: res.error ?? 'Վերատպումը ձախողվեց',
          });
        }
      } else {
        const res = await printHdmReceipt(
          requestPayload as unknown as HdmPrintReceiptInput
        );
        if (res.ok && res.fiscal) {
          await applyFiscalReprintResult(id, res.fiscal);
          setNotice({
            type: 'success',
            message: `Կտրոն վերատպվեց · № ${res.fiscal.fiscal}`,
          });
        } else {
          setNotice({
            type: 'warning',
            message: res.error ?? 'Վերատպումը ձախողվեց',
          });
        }
      }
      await load();
    } catch {
      setNotice({ type: 'warning', message: 'Վերատպման սխալ (ՀԴՄ agent)' });
    } finally {
      setBusyId(null);
    }
  };

  const handleReturn = async (item: FiscalReceiptListItem) => {
    if (busyId) return;
    if (!item.crn || item.rseq == null) {
      setNotice({
        type: 'warning',
        message: 'Բացակայում է սկզբնական կտրոնի CRN/համարը',
      });
      return;
    }
    if (
      !window.confirm(
        `Վերադարձնե՞լ կտրոն № ${item.fiscalNumber ?? item.rseq}-ը (${formatAmd(
          item.total
        )})։ ՀԴՄ-ում կտպվի վերադարձի կտրոն։`
      )
    ) {
      return;
    }
    setBusyId(item.id);
    setNotice(null);
    try {
      const notice = await submitReturnFiscal({
        input: {
          crn: item.crn,
          returnTicketId: item.rseq,
          paymentMethod: item.paymentMethod === 'card' ? 'card' : 'cash',
        },
        source: 'box_office',
        ticketId: item.ticketId,
        orderId: item.orderId,
      });
      setNotice(notice);
      await load();
    } catch {
      setNotice({ type: 'warning', message: 'Վերադարձի սխալ (ՀԴՄ agent)' });
    } finally {
      setBusyId(null);
    }
  };

  const filters: Array<{ id: StatusFilter; label: string }> = [
    { id: 'all', label: 'Բոլորը' },
    { id: 'printed', label: 'Տպված' },
    { id: 'failed', label: `Ձախողված${failedCount ? ` (${failedCount})` : ''}` },
  ];

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-teal-100 p-2">
            <ReceiptText className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ֆիսկալ կտրոններ</h1>
            <p className="text-sm text-gray-600">
              ՀԴՄ գործարքների պատմություն, վերատպում և վերադարձ
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isHdmAgentEnabled() && (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                agentOnline
                  ? 'bg-emerald-50 text-emerald-700'
                  : agentOnline === false
                    ? 'bg-amber-50 text-amber-800'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  agentOnline
                    ? 'bg-emerald-500'
                    : agentOnline === false
                      ? 'bg-amber-500'
                      : 'bg-gray-400'
                }`}
              />
              {agentOnline
                ? 'ՀԴՄ agent'
                : agentOnline === false
                  ? 'ՀԴՄ agent offline'
                  : 'ՀԴՄ agent…'}
            </div>
          )}
          <button
            onClick={() => void load()}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Թարմացնել
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`mb-4 flex items-center gap-3 rounded-xl border p-4 text-sm ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              filter === f.id
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Բեռնվում է…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center text-gray-500">
          Ֆիսկալ կտրոններ չկան
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Կարգավիճակ</th>
                <th className="px-4 py-3">Գործ.</th>
                <th className="px-4 py-3">Ֆիսկալ №</th>
                <th className="px-4 py-3">Գումար</th>
                <th className="px-4 py-3">Վճարում</th>
                <th className="px-4 py-3">Աղբյուր</th>
                <th className="px-4 py-3">Գանձապահ</th>
                <th className="px-4 py-3">Ամսաթիվ</th>
                <th className="px-4 py-3 text-right">Գործողություն</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {item.status === 'printed' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Տպված
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
                        title={item.errorMessage ?? undefined}
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                        Ձախողված
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                        item.operation === 'return'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-sky-50 text-sky-700'
                      }`}
                    >
                      {OPERATION_LABELS[item.operation] ?? item.operation}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-900">
                    {item.fiscalNumber ?? '—'}
                    {item.rseq != null && (
                      <span className="ml-1 text-xs text-gray-400">
                        #{item.rseq}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {formatAmd(item.total)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {item.paymentMethod === 'card' ? 'Քարտ' : 'Կանխիկ'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {SOURCE_LABELS[item.source] ?? item.source}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {item.cashierName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDateTime(item.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {item.status === 'failed' && (
                        <button
                          onClick={() => void handleReprint(item.id)}
                          disabled={busyId === item.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-100 disabled:opacity-50"
                        >
                          {busyId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Printer className="h-3.5 w-3.5" />
                          )}
                          Վերատպել
                        </button>
                      )}
                      {item.status === 'printed' &&
                        item.operation === 'sale' && (
                          <button
                            onClick={() => void handleReturn(item)}
                            disabled={busyId === item.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                          >
                            {busyId === item.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                            Վերադարձ
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
