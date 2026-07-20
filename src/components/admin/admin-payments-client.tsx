'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  Search,
  User,
  Film,
  Clock,
  AlertCircle,
  RefreshCw,
  Armchair,
  Hash,
  ShieldCheck,
  Loader2,
  Database,
  Cloud,
  RotateCcw,
  Banknote,
  CheckCircle2,
  Info,
  X,
  Clapperboard,
} from 'lucide-react';
import AdminLayout from './admin-layout';
import {
  getAllPayments,
  getAllVPostTransactionsForAdmin,
  confirmVPostPaymentForOrder,
  cancelVPostPaymentForOrder,
  type AdminVPostTransactionRow,
} from '@/app/actions/payments';

type ViewMode = 'vpost' | 'local';
type VPostStatusFilter =
  | 'all'
  | 'payment_deposited'
  | 'payment_approved'
  | 'payment_started'
  | 'payment_declined'
  | 'payment_refunded';
/** Ցուցադրության ավարտի ֆիլտր՝ գանձման համար */
type ScreeningFilter = 'all' | 'ended' | 'ready_to_capture';
type DateRange = 90 | 365 | 'all';

interface AdminPaymentsClientProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
  };
}

const MONTHS = [
  'հունվ',
  'փետ',
  'մարտ',
  'ապր',
  'մայիս',
  'հունիս',
  'հուլիս',
  'օգոս',
  'սեպ',
  'հոկ',
  'նոյ',
  'դեկ',
];

export default function AdminPaymentsClient({
  user,
}: AdminPaymentsClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('vpost');
  const [vpostRows, setVpostRows] = useState<AdminVPostTransactionRow[]>([]);
  const [localPayments, setLocalPayments] = useState<any[]>([]);
  const [meta, setMeta] = useState<{
    days?: number | 'all';
    totalFromVPost?: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<VPostStatusFilter>('all');
  const [screeningFilter, setScreeningFilter] =
    useState<ScreeningFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>(365);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<AdminVPostTransactionRow | null>(
    null
  );

  const loadVPost = useCallback(async () => {
    const result = await getAllVPostTransactionsForAdmin({ days: dateRange });
    if (result.success) {
      setVpostRows(result.transactions || []);
      setMeta(result.meta ?? null);
    } else {
      throw new Error(
        result.error || 'vPost գործարքները բեռնելիս սխալ է տեղի ունեցել'
      );
    }
  }, [dateRange]);

  const loadLocal = useCallback(async () => {
    const result = await getAllPayments();
    if (result.success) {
      setLocalPayments((result.payments as any[]) || []);
    } else {
      throw new Error(
        result.error || 'Վճարումները բեռնելիս սխալ է տեղի ունեցել'
      );
    }
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (viewMode === 'vpost') {
        await loadVPost();
      } else {
        await loadLocal();
      }
    } catch (err) {
      console.error('[Admin Payments] load error:', err);
      setError(err instanceof Error ? err.message : 'Բեռնման սխալ');
    } finally {
      setIsLoading(false);
    }
  }, [viewMode, loadVPost, loadLocal]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCaptureVPost = async (row: AdminVPostTransactionRow) => {
    // Միայն այս գործարքի ID-ներ՝ partner (order/new) + ITF
    const itfOrderId =
      row.itfOrderId != null && Number.isFinite(row.itfOrderId)
        ? row.itfOrderId
        : null;
    const partnerOrderId =
      row.partnerOrderId != null && Number.isFinite(row.partnerOrderId)
        ? row.partnerOrderId
        : null;
    const customerID = getConfirmCustomerId(row);
    const amount = Number(row.amount);

    if (itfOrderId == null && partnerOrderId == null) {
      setError('orderID բացակայում է (ITF կամ partner գործարքի համարը)');
      return;
    }
    if (!customerID) {
      setError('customerID բացակայում է (բաժանորդի համարը)');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('amount բացակայում է (գործարքի գումարը)');
      return;
    }
    if (!isWithinConfirmWindow(row.createdAt)) {
      setError(
        'Հաստատումը հնարավոր է միայն գործարքի ստեղծումից հետո 30 օրվա ընթացքում'
      );
      return;
    }

    const key = `${partnerOrderId ?? itfOrderId}-capture`;
    setActionKey(key);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await confirmVPostPaymentForOrder({
        itfOrderId,
        partnerOrderId,
        customerID,
        amount,
        createdAt: row.createdAt,
        goCinemaOrderId: row.localOrder?.id,
      });

      console.log(result);

      if (!result.success) {
        setError(result.error || 'Գանձումը ձախողվեց');
        return;
      }

      // approved ≠ գանձված
      const provider = result.provider as
        | { paymentState?: string; needsConfirmation?: boolean }
        | null
        | undefined;
      const state = provider?.paymentState;
      if (
        state === 'payment_approved' ||
        state === 'payment_autoauthorized' ||
        provider?.needsConfirmation
      ) {
        setError(
          'Գանձումը չի հաստատվել։ Կարգավիճակը դեռ սառեցված է (payment_approved)։'
        );
        await loadVPost();
        return;
      }

      setSuccessMessage(result.message || 'Գումարը գանձվել է');
      await loadVPost();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Գանձումը ձախողվեց');
    } finally {
      setActionKey(null);
    }
  };

  const handleRefundVPost = async (row: AdminVPostTransactionRow) => {
    const orderId = row.itfOrderId ?? row.partnerOrderId ?? row.actionOrderId;
    if (!orderId) {
      setError('Order ID բացակայում է (ITF/partner)');
      return;
    }
    const ok = window.confirm(
      `Վերադարձնել ${row.amount.toLocaleString('hy-AM')} ֏\nOrder #${orderId}?\n\nԳումարը կազատվի հաճախորդի քարտից (cancel-payment)։`
    );
    if (!ok) return;

    const key = `${orderId}-refund`;
    setActionKey(key);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await cancelVPostPaymentForOrder({
        orderId,
        amount: row.amount,
      });

      if (!result.success) {
        setError(result.error || 'Վերադարձը ձախողվեց');
        return;
      }
      setSuccessMessage(result.message || 'Գումարը վերադարձվել է');
      await loadVPost();
    } catch {
      setError('Վերադարձը ձախողվեց');
    } finally {
      setActionKey(null);
    }
  };

  const isFrozenTransaction = (state: string) =>
    state === 'payment_approved' || state === 'payment_autoauthorized';

  const isReadyToCapture = (row: AdminVPostTransactionRow) =>
    Boolean(row.localOrder?.screeningEnded) &&
    isFrozenTransaction(row.paymentState);

  /** vPost confirm-payment՝ ստեղծումից հետո ≤ 30 օր */
  const isWithinConfirmWindow = (createdAt?: string | null) => {
    if (!createdAt) return true;
    const createdMs = new Date(createdAt).getTime();
    if (!Number.isFinite(createdMs)) return true;
    return (Date.now() - createdMs) / (24 * 60 * 60 * 1000) <= 30;
  };

  const getConfirmOrderId = (row: AdminVPostTransactionRow) =>
    row.partnerOrderId ?? row.itfOrderId ?? row.actionOrderId;

  const getConfirmCustomerId = (row: AdminVPostTransactionRow) =>
    String(
      row.vpost?.customerID ?? row.customerId ?? row.localOrder?.user?.id ?? ''
    ).trim();

  const canConfirmPayment = (row: AdminVPostTransactionRow) => {
    const orderID = getConfirmOrderId(row);
    const customerID = getConfirmCustomerId(row);
    const amount = Number(row.amount);
    return (
      orderID != null &&
      Number.isFinite(orderID) &&
      orderID > 0 &&
      Boolean(customerID) &&
      Number.isFinite(amount) &&
      amount > 0 &&
      isWithinConfirmWindow(row.createdAt)
    );
  };

  const formatDateTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (Number.isNaN(d.getTime())) return String(date);
    const time = d.toLocaleTimeString('hy-AM', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${time}`;
  };

  const getVPostStateLabel = (state?: string) => {
    switch (state) {
      case 'payment_started':
        return 'Սկսված';
      case 'payment_approved':
        return 'Սառեցված';
      case 'payment_deposited':
        return 'Գանձված';
      case 'payment_declined':
        return 'Մերժված';
      case 'payment_refunded':
        return 'Վերադարձված';
      case 'payment_autoauthorized':
        return 'Ավտո-ավտորիզացված';
      case 'payment_void':
        return 'Չեղարկված';
      default:
        return state || '—';
    }
  };

  const getVPostBadge = (state: string) => {
    if (state === 'payment_deposited') {
      return {
        label: getVPostStateLabel(state),
        className: 'bg-green-100 text-green-700 border-green-200',
      };
    }
    if (state === 'payment_approved' || state === 'payment_autoauthorized') {
      return {
        label: getVPostStateLabel(state),
        className: 'bg-amber-100 text-amber-800 border-amber-200',
      };
    }
    if (state === 'payment_started') {
      return {
        label: getVPostStateLabel(state),
        className: 'bg-slate-100 text-slate-700 border-slate-200',
      };
    }
    if (state === 'payment_declined' || state === 'payment_void') {
      return {
        label: getVPostStateLabel(state),
        className: 'bg-red-100 text-red-700 border-red-200',
      };
    }
    if (state === 'payment_refunded') {
      return {
        label: getVPostStateLabel(state),
        className: 'bg-blue-100 text-blue-700 border-blue-200',
      };
    }
    return {
      label: getVPostStateLabel(state),
      className: 'bg-gray-100 text-gray-700 border-gray-200',
    };
  };

  const filteredVPost = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return vpostRows.filter((row) => {
      if (statusFilter !== 'all' && row.paymentState !== statusFilter) {
        return false;
      }

      if (screeningFilter === 'ended') {
        if (!row.localOrder?.screeningEnded) return false;
      } else if (screeningFilter === 'ready_to_capture') {
        if (
          !(
            row.localOrder?.screeningEnded &&
            (row.paymentState === 'payment_approved' ||
              row.paymentState === 'payment_autoauthorized')
          )
        ) {
          return false;
        }
      }

      if (!q) return true;
      const haystack = [
        row.partnerOrderId,
        row.itfOrderId,
        row.customerId,
        row.responseCode,
        row.cardNumber,
        row.clientName,
        row.description,
        row.localOrder?.user?.name,
        row.localOrder?.user?.phone,
        ...(row.localOrder?.movieTitles ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [vpostRows, statusFilter, screeningFilter, searchQuery]);

  const vpostStats = useMemo(() => {
    const acc = {
      total: vpostRows.length,
      deposited: 0,
      approved: 0,
      pending: 0,
      declined: 0,
      notInDb: 0,
      revenue: 0,
      endedScreenings: 0,
      readyToCapture: 0,
      readyToCaptureAmount: 0,
    };
    for (const row of vpostRows) {
      if (!row.inDatabase) acc.notInDb += 1;
      if (row.localOrder?.screeningEnded) acc.endedScreenings += 1;
      const frozen =
        row.paymentState === 'payment_approved' ||
        row.paymentState === 'payment_autoauthorized';
      if (row.localOrder?.screeningEnded && frozen) {
        acc.readyToCapture += 1;
        acc.readyToCaptureAmount += row.amount;
      }
      if (row.paymentState === 'payment_deposited') {
        acc.deposited += 1;
        acc.revenue += row.amount;
      } else if (row.paymentState === 'payment_approved') {
        acc.approved += 1;
        acc.revenue += row.amount;
      } else if (
        row.paymentState === 'payment_started' ||
        row.paymentState === 'payment_autoauthorized'
      ) {
        acc.pending += 1;
      } else if (
        row.paymentState === 'payment_declined' ||
        row.paymentState === 'payment_void'
      ) {
        acc.declined += 1;
      }
    }
    return acc;
  }, [vpostRows]);

  const vpostStatusTabs: { value: VPostStatusFilter; label: string }[] = [
    { value: 'all', label: 'Բոլորը' },
    { value: 'payment_deposited', label: 'Գանձված' },
    { value: 'payment_approved', label: 'Սառեցված' },
    { value: 'payment_started', label: 'Սկսված' },
    { value: 'payment_declined', label: 'Մերժված' },
    { value: 'payment_refunded', label: 'Վերադարձ' },
  ];

  const screeningTabs: {
    value: ScreeningFilter;
    label: string;
    count?: number;
  }[] = [
    { value: 'all', label: 'Բոլոր ցուցադրություններ' },
    {
      value: 'ended',
      label: 'Ավարտված',
      count: vpostStats.endedScreenings,
    },
    {
      value: 'ready_to_capture',
      label: 'Գանձման ենթակա',
      count: vpostStats.readyToCapture,
    },
  ];

  const dateTabs: { value: DateRange; label: string }[] = [
    { value: 90, label: '90 օր' },
    { value: 365, label: '1 տարի' },
    { value: 'all', label: 'Բոլորը' },
  ];

  return (
    <AdminLayout user={user}>
      <div className="flex-1 overflow-y-auto bg-linear-to-b from-slate-50 to-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700">
                  <CreditCard className="w-5 h-5" />
                </span>
                Վճարումներ
              </h1>
              <p className="text-gray-600 mt-2">
                vPost-ից բոլոր քարտային գործարքները՝ անկախ մեր բազայից։ Ջնջված
                տեղային գրառումները այստեղ երևում են, եթե vPost-ում կան։
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white shadow-sm border border-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              />
              Թարմացնել
            </button>
          </div>

          {/* View toggle */}
          <div className="inline-flex items-center gap-1 p-1 mb-6 rounded-xl bg-white shadow-sm border border-gray-100">
            <button
              type="button"
              onClick={() => setViewMode('vpost')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'vpost'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Cloud className="w-4 h-4" />
              vPost գործարքներ
            </button>
            <button
              type="button"
              onClick={() => setViewMode('local')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'local'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Database className="w-4 h-4" />
              Մեր բազա
            </button>
          </div>

          {viewMode === 'vpost' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                <div className="px-4 py-3 rounded-xl bg-white shadow-sm border border-gray-100">
                  <p className="text-gray-500 text-sm">vPost ընդամենը</p>
                  <p className="text-xl font-bold text-gray-900">
                    {vpostStats.total}
                  </p>
                  {meta?.totalFromVPost != null &&
                    meta.totalFromVPost !== vpostStats.total && (
                      <p className="text-[10px] text-gray-400">
                        API: {meta.totalFromVPost}
                      </p>
                    )}
                </div>
                <button
                  type="button"
                  onClick={() => setScreeningFilter('ready_to_capture')}
                  className={`px-4 py-3 rounded-xl shadow-sm border text-left transition-colors ${
                    screeningFilter === 'ready_to_capture'
                      ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200'
                      : 'bg-white border-gray-100 hover:border-amber-200'
                  }`}
                >
                  <p className="text-gray-500 text-sm">Գանձման ենթակա</p>
                  <p className="text-xl font-bold text-amber-700">
                    {vpostStats.readyToCapture}
                  </p>
                  {vpostStats.readyToCaptureAmount > 0 && (
                    <p className="text-[11px] text-amber-600">
                      {vpostStats.readyToCaptureAmount.toLocaleString('hy-AM')}{' '}
                      ֏
                    </p>
                  )}
                </button>
                <div className="px-4 py-3 rounded-xl bg-white shadow-sm border border-gray-100">
                  <p className="text-gray-500 text-sm">Գանձված</p>
                  <p className="text-xl font-bold text-green-600">
                    {vpostStats.deposited}
                  </p>
                </div>
                <div className="px-4 py-3 rounded-xl bg-white shadow-sm border border-gray-100">
                  <p className="text-gray-500 text-sm">Հաստատված</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {vpostStats.approved}
                  </p>
                </div>
                <div className="px-4 py-3 rounded-xl bg-white shadow-sm border border-gray-100">
                  <p className="text-gray-500 text-sm">Սպասում</p>
                  <p className="text-xl font-bold text-amber-600">
                    {vpostStats.pending}
                  </p>
                </div>
                <div className="px-4 py-3 rounded-xl bg-white shadow-sm border border-gray-100">
                  <p className="text-gray-500 text-sm">Բազայում չկա</p>
                  <p className="text-xl font-bold text-orange-600">
                    {vpostStats.notInDb}
                  </p>
                </div>
                <div className="px-4 py-3 rounded-xl bg-white shadow-sm border border-gray-100">
                  <p className="text-gray-500 text-sm">Շրջանառություն</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {vpostStats.revenue.toLocaleString('hy-AM')} ֏
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Որոնել order ID, ITF ID, քարտ, ֆիլմ, օգտատեր..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {dateTabs.map((tab) => (
                    <button
                      key={String(tab.value)}
                      type="button"
                      onClick={() => setDateRange(tab.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                        dateRange === tab.value
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-gray-500 border-gray-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {screeningTabs.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setScreeningFilter(tab.value)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                        screeningFilter === tab.value
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-violet-50'
                      }`}
                    >
                      {tab.value !== 'all' && (
                        <Clapperboard className="w-3.5 h-3.5" />
                      )}
                      {tab.label}
                      {tab.count != null && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            screeningFilter === tab.value
                              ? 'bg-white/20 text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {screeningFilter === 'ready_to_capture' && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    Ցուցադրվում են ավարտված ցուցադրությունների սառեցված
                    վճարումները — սեղմեք «Գանձել գումարը» յուրաքանչյուրի վրա։
                  </p>
                )}
                {screeningFilter === 'ended' && (
                  <p className="text-xs text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                    Ավարտված ցուցադրությունների բոլոր վճարումները։ Գանձման համար
                    ընտրեք «Գանձման ենթակա» կամ կարգավիճակ՝ «Սառեցված»։
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {vpostStatusTabs.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setStatusFilter(tab.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        statusFilter === tab.value
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 p-4 mb-6 rounded-xl bg-red-50 border border-red-200 text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 p-4 mb-6 rounded-xl bg-green-50 border border-green-200 text-green-700">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span className="text-sm">{successMessage}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-20 text-center text-gray-500">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-gray-300" />
              Բեռնվում է vPost-ից...
            </div>
          ) : viewMode === 'vpost' ? (
            filteredVPost.length === 0 ? (
              <div className="py-20 text-center text-gray-500">
                <Cloud className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                {screeningFilter === 'ready_to_capture'
                  ? 'Գանձման ենթակա վճարումներ չկան'
                  : screeningFilter === 'ended'
                    ? 'Ավարտված ցուցադրությունների վճարումներ չեն գտնվել'
                    : 'vPost գործարքներ չեն գտնվել'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredVPost.map((row) => {
                  const badge = getVPostBadge(row.paymentState);
                  const orderId = getConfirmOrderId(row);
                  const captureKey = orderId ? `${orderId}-capture` : row.key;
                  const refundKey = orderId
                    ? `${orderId}-refund`
                    : `${row.key}-r`;
                  const isCapturing = actionKey === captureKey;
                  const isRefunding = actionKey === refundKey;
                  const canConfirm = canConfirmPayment(row);
                  const movies = row.localOrder?.movieTitles?.length
                    ? row.localOrder.movieTitles.join(', ')
                    : row.description || '—';
                  return (
                    <div
                      key={row.key}
                      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3"
                    >
                      <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Film className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="font-semibold text-gray-900 truncate">
                              {movies}
                            </span>
                            {row.localOrder?.screeningEnded && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-100 text-violet-800">
                                ցուցադրությունն ավարտված է
                              </span>
                            )}
                            {isReadyToCapture(row) && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">
                                գանձման ենթակա
                              </span>
                            )}
                            {!row.inDatabase && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-100 text-orange-700">
                                բազայում չկա
                              </span>
                            )}
                            {row.inDatabase &&
                              !row.localOrder?.screeningEnded && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700">
                                  կապված է
                                </span>
                              )}
                          </div>
                          <div className="mt-1 flex items-center gap-3 flex-wrap text-sm text-gray-500">
                            {row.localOrder?.screeningLabel && (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {row.localOrder.screeningLabel}
                              </span>
                            )}
                            {row.localOrder?.hallName && (
                              <span>{row.localOrder.hallName}</span>
                            )}
                            {row.localOrder?.seats?.length ? (
                              <span className="inline-flex items-center gap-1">
                                <Armchair className="w-3.5 h-3.5" />
                                {row.localOrder.seats.join(', ')}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-gray-600 md:w-44 min-w-0">
                          <User className="w-4 h-4 text-gray-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="truncate">
                              {row.localOrder?.user?.name ||
                                row.clientName ||
                                `Customer #${row.customerId ?? '—'}`}
                            </p>
                            {row.localOrder?.user?.phone && (
                              <p className="text-xs text-gray-400 truncate">
                                {row.localOrder.user.phone}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 md:w-48 shrink-0">
                          <div className="flex items-center justify-between md:justify-end gap-4 w-full">
                            <div className="text-right">
                              <p className="font-bold text-gray-900">
                                {row.amount.toLocaleString('hy-AM')} ֏
                              </p>
                              {row.fee != null && row.fee > 0 && (
                                <p className="text-xs text-gray-400">
                                  միջն. {row.fee.toLocaleString('hy-AM')} ֏
                                </p>
                              )}
                            </div>
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${badge.className} whitespace-nowrap`}
                            >
                              {badge.label}
                            </span>
                          </div>
                        </div>

                        <div className="md:w-40 text-xs text-gray-400 md:text-right shrink-0">
                          <p className="inline-flex items-center gap-1 md:justify-end">
                            <Hash className="w-3 h-3" />
                            {row.partnerOrderId != null
                              ? `Order #${row.partnerOrderId}`
                              : row.itfOrderId != null
                                ? `ITF #${row.itfOrderId}`
                                : '—'}
                          </p>
                          <p>
                            {row.humandate ||
                              (row.createdAt
                                ? formatDateTime(row.createdAt)
                                : '—')}
                          </p>
                          {row.cardNumber && <p>{row.cardNumber}</p>}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-gray-100">
                        {isFrozenTransaction(row.paymentState) && orderId && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRefundVPost(row)}
                              disabled={isRefunding || isCapturing}
                              title="vPost /order/cancel — ազատել սառեցված գումարը"
                              className="inline-flex flex-1 items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border-2 border-red-300 bg-red-50 text-red-800 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isRefunding ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                              Վերադարձնել գումարը
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCaptureVPost(row)}
                              disabled={
                                isCapturing || isRefunding || !canConfirm
                              }
                              title={
                                !isWithinConfirmWindow(row.createdAt)
                                  ? 'Հաստատումը հնարավոր է միայն 30 օրվա ընթացքում'
                                  : !getConfirmCustomerId(row)
                                    ? 'customerID բացակայում է'
                                    : 'vPost /order/confirm-payment — orderID, customerID, amount'
                              }
                              className="inline-flex flex-1 items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border-2 border-emerald-400 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isCapturing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Banknote className="w-4 h-4" />
                              )}
                              Գանձել գումարը
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => setDetailRow(row)}
                          className="inline-flex flex-1 items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                        >
                          <Info className="w-4 h-4" />
                          Մանրամասներ
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : localPayments.length === 0 ? (
            <div className="py-20 text-center text-gray-500">
              <Database className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              Տեղային վճարումներ չեն գտնվել
            </div>
          ) : (
            <div className="space-y-3">
              {localPayments.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-sm text-gray-600"
                >
                  #{p.id} — {(Number(p.amount) || 0).toLocaleString('hy-AM')} ֏
                  — {p.method} — {p.status}
                  {p.ticket?.screening?.movie?.title &&
                    ` — ${p.ticket.screening.movie.title}`}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {detailRow && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-detail-title"
          onClick={() => setDetailRow(null)}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4 rounded-t-2xl">
              <h2
                id="payment-detail-title"
                className="text-lg font-bold text-gray-900"
              >
                Վճարման մանրամասներ
              </h2>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Փակել"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5 px-5 py-4 text-sm">
              {/* Ֆիլմ և ցուցադրություն */}
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Ֆիլմ և ցուցադրություն
                </p>
                {detailRow.localOrder?.screenings?.length ? (
                  <div className="space-y-2">
                    {detailRow.localOrder.screenings.map((s, i) => (
                      <div
                        key={`${s.movieTitle}-${s.startTime}-${s.seat}-${i}`}
                        className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3"
                      >
                        <p className="flex items-center gap-2 font-semibold text-gray-900">
                          <Film className="h-4 w-4 text-emerald-600 shrink-0" />
                          {s.movieTitle}
                        </p>
                        <p className="mt-1.5 flex items-center gap-2 text-gray-600">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          Սկիզբ՝ {formatDateTime(s.startTime)}
                        </p>
                        {s.endTime && (
                          <p className="mt-1 flex items-center gap-2 text-gray-600">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            Ավարտ՝ {formatDateTime(s.endTime)}
                            {s.ended && (
                              <span className="text-[11px] font-medium text-violet-700">
                                (ավարտված)
                              </span>
                            )}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap gap-3 text-gray-500">
                          {s.hallName && <span>{s.hallName}</span>}
                          {s.seat && (
                            <span className="inline-flex items-center gap-1">
                              <Armchair className="h-3.5 w-3.5" />
                              {s.seat}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : detailRow.localOrder?.movieTitles?.length ? (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                    <p className="flex items-center gap-2 font-semibold text-gray-900">
                      <Film className="h-4 w-4 text-emerald-600" />
                      {detailRow.localOrder.movieTitles.join(', ')}
                    </p>
                    {detailRow.localOrder.screeningLabel && (
                      <p className="mt-1.5 flex items-center gap-2 text-gray-600">
                        <Clock className="h-3.5 w-3.5" />
                        {detailRow.localOrder.screeningLabel}
                      </p>
                    )}
                    {detailRow.localOrder.hallName && (
                      <p className="mt-1 text-gray-500">
                        {detailRow.localOrder.hallName}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-orange-800">
                    Ֆիլմի/ցուցադրության տվյալները բազայում չեն գտնվել
                    {detailRow.description ? ` — ${detailRow.description}` : ''}
                  </p>
                )}
              </section>

              {/* Հաճախորդ */}
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Հաճախորդ
                </p>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-1">
                  <p className="font-medium text-gray-900">
                    {detailRow.localOrder?.user?.name ||
                      detailRow.clientName ||
                      `Customer #${detailRow.customerId ?? '—'}`}
                  </p>
                  {detailRow.localOrder?.user?.phone && (
                    <p className="text-gray-500">
                      {detailRow.localOrder.user.phone}
                    </p>
                  )}
                  {detailRow.localOrder?.id != null && (
                    <p className="text-xs text-gray-400">
                      GoCinema պատվեր #{detailRow.localOrder.id} (
                      {detailRow.localOrder.status})
                    </p>
                  )}
                </div>
              </section>

              {/* Գումար */}
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Գումար և կարգավիճակ
                </p>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 grid grid-cols-2 gap-2">
                  <p>
                    <span className="text-gray-400">Գումար։</span>{' '}
                    <span className="font-bold text-gray-900">
                      {detailRow.amount.toLocaleString('hy-AM')} ֏
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-400">Կարգավիճակ։</span>{' '}
                    {getVPostStateLabel(detailRow.paymentState)}
                  </p>
                  {detailRow.fee != null && detailRow.fee > 0 && (
                    <p>
                      <span className="text-gray-400">Միջնորդավճար։</span>{' '}
                      {detailRow.fee.toLocaleString('hy-AM')} ֏
                    </p>
                  )}
                  {detailRow.totalAmount != null && (
                    <p>
                      <span className="text-gray-400">Ընդամենը։</span>{' '}
                      {detailRow.totalAmount.toLocaleString('hy-AM')} ֏
                    </p>
                  )}
                  <p className="col-span-2">
                    <span className="text-gray-400">Ամսաթիվ։</span>{' '}
                    {detailRow.humandate ||
                      (detailRow.createdAt
                        ? formatDateTime(detailRow.createdAt)
                        : '—')}
                  </p>
                </div>
              </section>

              {/* vPost */}
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  vPost տվյալներ
                </p>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 grid grid-cols-2 gap-x-3 gap-y-2 text-slate-700">
                  <p>
                    <span className="text-slate-400">ResponseCode։</span>{' '}
                    <span className="font-mono font-medium">
                      {detailRow.responseCode ||
                        detailRow.vpost?.responseCode ||
                        '—'}
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-400">ITF Order։</span>{' '}
                    <span className="font-mono">
                      {detailRow.itfOrderId ??
                        detailRow.vpost?.itfOrderId ??
                        '—'}
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-400">Partner Order։</span>{' '}
                    <span className="font-mono">
                      {detailRow.partnerOrderId ?? '—'}
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-400">Customer ID։</span>{' '}
                    <span className="font-mono">
                      {detailRow.customerId ??
                        detailRow.vpost?.customerID ??
                        '—'}
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-400">PaymentState։</span>{' '}
                    {getVPostStateLabel(detailRow.paymentState)}
                  </p>
                  <p>
                    <span className="text-slate-400">OrderStatus։</span>{' '}
                    {detailRow.vpost?.orderStatus || '—'}
                  </p>
                  {detailRow.cardNumber && (
                    <p className="col-span-2">
                      <span className="text-slate-400">Քարտ։</span>{' '}
                      {detailRow.cardNumber}
                    </p>
                  )}
                  {detailRow.description && (
                    <p className="col-span-2">
                      <span className="text-slate-400">Նկարագրություն։</span>{' '}
                      {detailRow.description}
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
