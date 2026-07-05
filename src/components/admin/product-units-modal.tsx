'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { motion } from 'framer-motion';
import {
  QrCode,
  X,
  Search,
  Pencil,
  Trash2,
  Check,
  Loader2,
  Package,
  ScanLine,
  RotateCcw,
  List,
  CheckCircle2,
  Circle,
  Copy,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  getProductUnits,
  updateProductUnitQr,
  deleteProductUnit,
  deleteAllInStockProductUnits,
  verifyProductUnitQr,
  resetProductUnitVerifications,
  type VerifyUnitOutcome,
} from '@/app/actions/products';

interface ProductUnitsModalProps {
  product: {
    id: number;
    name: string;
    stock: number;
    description?: string | null;
    price?: number;
    image?: string | null;
    category?: string;
    isActive?: boolean;
  };
  onClose: () => void;
  onStockUpdated: (productId: number, stock: number) => void;
}

interface ProductUnitRow {
  id: number;
  qrCode: string;
  status: string;
  soldAt: Date | string | null;
  verifiedAt: Date | string | null;
  pekReportedAt?: Date | string | null;
  createdAt: Date | string;
  orderItemId: number | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  snack: 'Նախուտեստ',
  drink: 'Խմիչք',
  combo: 'Կոմբո',
  popcorn: 'Պոպկորն',
  soda: 'Գազավորված խմիչք',
  candy: 'Քաղցրավենիք',
  hot_dog: 'Հոթ-դոգ',
  nachos: 'Նաչոս',
  coffee: 'Սրճարանային խմիչք',
  tea: 'Թեյ',
  juice: 'Հյութ',
  water: 'Ջուր',
  chips: 'Չիպս',
  chocolate: 'Շոկոլադ',
  ice_cream: 'Պաղպաղակ',
  sandwich: 'Սենդվիչ',
  pizza: 'Պիցցա',
  burger: 'Բուրգեր',
};

type StatusFilter = 'all' | 'in_stock' | 'sold';
type ModalTab = 'list' | 'verify';

interface VerifyLogEntry {
  id: string;
  qrCode: string;
  outcome: VerifyUnitOutcome | 'duplicate_session';
  message: string;
  at: Date;
}

export default function ProductUnitsModal({
  product,
  onClose,
  onStockUpdated,
}: ProductUnitsModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>('list');
  const [units, setUnits] = useState<ProductUnitRow[]>([]);
  const [inStock, setInStock] = useState(0);
  const [sold, setSold] = useState(0);
  const [verified, setVerified] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [scanInput, setScanInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyingQr, setVerifyingQr] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [verifyLog, setVerifyLog] = useState<VerifyLogEntry[]>([]);
  const [sessionScanned, setSessionScanned] = useState<Set<string>>(new Set());
  const scanInputRef = useRef<HTMLInputElement>(null);

  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [previewUnit, setPreviewUnit] = useState<ProductUnitRow | null>(null);
  const [qrCopied, setQrCopied] = useState(false);
  const [deleteAllPassword, setDeleteAllPassword] = useState('');
  const [deleteAllError, setDeleteAllError] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const deleteAllPasswordRef = useRef<HTMLInputElement>(null);

  const focusScanInput = useCallback(() => {
    if (activeTab !== 'verify') return;
    requestAnimationFrame(() => {
      scanInputRef.current?.focus({ preventScroll: true });
    });
  }, [activeTab]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (activeTab !== 'verify') return;
    const t = setTimeout(() => focusScanInput(), 50);
    const onWindowFocus = () => focusScanInput();
    window.addEventListener('focus', onWindowFocus);
    return () => {
      clearTimeout(t);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [activeTab, focusScanInput]);

  const handleScanInputBlur = useCallback(() => {
    window.setTimeout(() => {
      if (activeTab !== 'verify') return;
      const active = document.activeElement;
      if (
        active === scanInputRef.current ||
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        active instanceof HTMLButtonElement
      ) {
        return;
      }
      focusScanInput();
    }, 100);
  }, [activeTab, focusScanInput]);

  const loadUnits = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getProductUnits(product.id, {
        search: activeTab === 'list' ? debouncedSearch || undefined : undefined,
        status: activeTab === 'list' ? statusFilter : 'in_stock',
      });
      if (result.success) {
        setUnits(result.units as ProductUnitRow[]);
        setInStock(result.inStock);
        setSold(result.sold);
        setVerified(result.verified);
      } else {
        setError(result.error || 'Բեռնելիս սխալ');
      }
    } catch {
      setError('Միավորները բեռնելիս սխալ է տեղի ունեցել');
    } finally {
      setIsLoading(false);
    }
  }, [product.id, debouncedSearch, statusFilter, activeTab]);

  useEffect(() => {
    void loadUnits();
  }, [loadUnits]);

  const addVerifyLog = (
    qrCode: string,
    outcome: VerifyLogEntry['outcome'],
    message: string
  ) => {
    setVerifyLog((prev) => [
      {
        id: `${Date.now()}-${qrCode}`,
        qrCode,
        outcome,
        message,
        at: new Date(),
      },
      ...prev,
    ]);
  };

  const handleVerifyScan = async (raw: string) => {
    const code = raw.trim();
    if (!code) return;

    if (sessionScanned.has(code)) {
      addVerifyLog(code, 'duplicate_session', 'Այս սեսիայում արդեն սկանավորվել է');
      setScanInput('');
      focusScanInput();
      return;
    }

    setIsVerifying(true);
    setVerifyingQr(code);
    setError(null);
    setSessionScanned((prev) => new Set(prev).add(code));

    try {
      const result = await verifyProductUnitQr(product.id, code);

      if (result.success && result.outcome === 'verified') {
        addVerifyLog(code, 'verified', result.message || 'Ստուգված է');
        if (result.verified !== undefined) {
          setVerified(result.verified);
        }
        if (result.unit) {
          setUnits((prev) => {
            const exists = prev.some((u) => u.id === result.unit!.id);
            if (exists) {
              return prev.map((u) =>
                u.id === result.unit!.id
                  ? (result.unit as ProductUnitRow)
                  : u
              );
            }
            return [result.unit as ProductUnitRow, ...prev];
          });
        }
      } else if (result.outcome) {
        addVerifyLog(
          code,
          result.outcome,
          result.error || 'Ստուգումը չհաջողվեց'
        );
        if (result.outcome === 'already_verified' && result.unit?.verifiedAt) {
          setUnits((prev) =>
            prev.map((u) =>
              u.id === result.unit!.id
                ? { ...u, verifiedAt: result.unit!.verifiedAt }
                : u
            )
          );
        }
      } else {
        addVerifyLog(code, 'not_found', result.error || 'Ստուգումը չհաջողվեց');
      }
    } catch {
      addVerifyLog(code, 'not_found', 'Ստուգելիս սխալ է տեղի ունեցել');
    } finally {
      setIsVerifying(false);
      setVerifyingQr(null);
      setScanInput('');
      focusScanInput();
    }
  };

  const handleResetVerifications = async () => {
    if (
      !window.confirm(
        'Նոր ստուգում սկսե՞լ։ Բոլոր «ստուգված» նշումները կզրոյացվեն (պահեստում գտնվող միավորների համար)։'
      )
    ) {
      return;
    }

    setIsResetting(true);
    setError(null);
    try {
      const result = await resetProductUnitVerifications(product.id);
      if (result.success) {
        setVerified(0);
        setVerifyLog([]);
        setSessionScanned(new Set());
        await loadUnits();
      } else {
        setError(result.error || 'Զրոյացնելիս սխալ');
      }
    } catch {
      setError('Ստուգումը զրոյացնելիս սխալ է տեղի ունեցել');
    } finally {
      setIsResetting(false);
      focusScanInput();
    }
  };

  const startEdit = (unit: ProductUnitRow) => {
    if (unit.status !== 'in_stock') return;
    setEditingId(unit.id);
    setEditValue(unit.qrCode);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveEdit = async (unitId: number) => {
    const code = editValue.trim();
    if (!code) {
      setError('QR կոդը չի կարող դատարկ լինել');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const result = await updateProductUnitQr(unitId, code);
      if (result.success && result.unit) {
        setUnits((prev) =>
          prev.map((u) => (u.id === unitId ? (result.unit as ProductUnitRow) : u))
        );
        cancelEdit();
      } else {
        setError(result.error || 'Պահպանելիս սխալ');
      }
    } catch {
      setError('QR կոդը փոխելիս սխալ է տեղի ունեցել');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (unit: ProductUnitRow) => {
    if (unit.status !== 'in_stock') return;
    if (
      !window.confirm(
        `Ջնջե՞լ QR կոդը «${unit.qrCode}»։ Պաշարը կնվազի 1-ով։`
      )
    ) {
      return;
    }

    setDeletingId(unit.id);
    setError(null);
    try {
      const result = await deleteProductUnit(unit.id);
      if (result.success) {
        await loadUnits();
        if (result.stock !== undefined) {
          onStockUpdated(product.id, result.stock);
        }
      } else {
        setError(result.error || 'Ջնջելիս սխալ');
      }
    } catch {
      setError('Միավորը ջնջելիս սխալ է տեղի ունեցել');
    } finally {
      setDeletingId(null);
    }
  };

  const openDeleteAll = () => {
    setDeleteAllPassword('');
    setDeleteAllError(null);
    setShowDeleteAll(true);
    setTimeout(() => deleteAllPasswordRef.current?.focus(), 50);
  };

  const closeDeleteAll = () => {
    if (isDeletingAll) return;
    setShowDeleteAll(false);
    setDeleteAllPassword('');
    setDeleteAllError(null);
  };

  const handleDeleteAll = async (e?: FormEvent) => {
    e?.preventDefault();
    if (isDeletingAll) return;

    const password = deleteAllPassword.trim();
    if (!password) {
      setDeleteAllError('Մուտքագրեք ձեր գաղտնաբառը');
      return;
    }

    setIsDeletingAll(true);
    setDeleteAllError(null);
    setError(null);
    try {
      const result = await deleteAllInStockProductUnits(product.id, password);
      if (result.success) {
        setShowDeleteAll(false);
        setDeleteAllPassword('');
        setVerified(0);
        setVerifyLog([]);
        setSessionScanned(new Set());
        await loadUnits();
        if (result.stock !== undefined) {
          onStockUpdated(product.id, result.stock);
        }
      } else {
        setDeleteAllError(result.error || 'Ջնջելիս սխալ');
      }
    } catch {
      setDeleteAllError('Բոլոր միավորները ջնջելիս սխալ է տեղի ունեցել');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const formatDate = (d: Date | string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('hy-AM', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('hy-AM', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const formatPrice = (value?: number) =>
    value != null ? `${Math.round(value).toLocaleString('hy-AM')} ֏` : '—';

  const categoryLabel = (category?: string) =>
    category ? CATEGORY_LABELS[category] ?? category : '—';

  const copyPreviewQr = async () => {
    if (!previewUnit) return;
    try {
      await navigator.clipboard.writeText(previewUnit.qrCode);
      setQrCopied(true);
      window.setTimeout(() => setQrCopied(false), 2000);
    } catch {
      setError('QR կոդը պատճենել հնարավոր չեղավ');
    }
  };

  const logStyle = (outcome: VerifyLogEntry['outcome']) => {
    switch (outcome) {
      case 'verified':
        return 'border-green-200 bg-green-50 text-green-800';
      case 'already_verified':
      case 'duplicate_session':
        return 'border-amber-200 bg-amber-50 text-amber-800';
      case 'sold':
        return 'border-blue-200 bg-blue-50 text-blue-800';
      default:
        return 'border-red-200 bg-red-50 text-red-800';
    }
  };

  const logLabel = (outcome: VerifyLogEntry['outcome']) => {
    switch (outcome) {
      case 'verified':
        return 'Ստուգված';
      case 'already_verified':
        return 'Արդեն ստուգված';
      case 'duplicate_session':
        return 'Կրկնակի սկան';
      case 'sold':
        return 'Վաճառված';
      case 'wrong_product':
        return 'Սխալ ապրանք';
      default:
        return 'Չի գտնվել';
    }
  };

  const pendingVerify = Math.max(0, inStock - verified);

  const pendingVerifyUnits = useMemo(
    () =>
      units
        .filter((u) => u.status === 'in_stock' && !u.verifiedAt)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
    [units]
  );

  const verifiedUnits = useMemo(
    () =>
      units
        .filter((u) => u.status === 'in_stock' && u.verifiedAt)
        .sort((a, b) => {
          const ta = new Date(a.verifiedAt!).getTime();
          const tb = new Date(b.verifiedAt!).getTime();
          return tb - ta;
        }),
    [units]
  );

  const renderVerifyUnitRow = (unit: ProductUnitRow, isVerifiedRow: boolean) => {
    const isScanningThis = isVerifying && verifyingQr === unit.qrCode;
    const scannedInSession = sessionScanned.has(unit.qrCode);

    return (
      <div
        key={unit.id}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
          isVerifiedRow
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-orange-200 bg-orange-50'
        }`}
      >
        <div className="shrink-0">
          {isVerifiedRow ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <Circle className="h-4 w-4 text-orange-400" />
          )}
        </div>
        <button
          type="button"
          onClick={() => setPreviewUnit(unit)}
          className="shrink-0 rounded-md border border-white bg-white p-0.5 shadow-sm transition hover:border-purple-300 hover:shadow-md"
          title="Մեծացնել QR"
        >
          <QRCodeSVG
            value={unit.qrCode}
            size={48}
            level="M"
            includeMargin={false}
            bgColor="#ffffff"
            fgColor="#111827"
          />
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setPreviewUnit(unit)}
            className="truncate text-left font-mono text-sm font-medium text-gray-900 hover:text-purple-700"
            title="Մանրամասն տեղեկություն"
          >
            {unit.qrCode}
          </button>
          <p className="text-[11px] text-gray-500">
            {isVerifiedRow && unit.verifiedAt
              ? `Ստուգվել՝ ${formatDate(unit.verifiedAt)}`
              : `Ավելացվել՝ ${formatDate(unit.createdAt)}`}
            {scannedInSession && !isVerifiedRow && (
              <span className="ml-1 text-amber-600">· սկանավորվել է</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleVerifyScan(unit.qrCode)}
          disabled={isVerifying}
          title="Սկանավորել այս QR-ը"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-purple-200 bg-white px-2.5 py-1.5 text-xs font-medium text-purple-700 transition hover:bg-purple-50 disabled:opacity-50"
        >
          {isScanningThis ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ScanLine className="h-3.5 w-3.5" />
          )}
          Սկան
        </button>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">QR միավորներ</h3>
              <p className="text-sm text-gray-600">«{product.name}»</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3">
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
            Պահեստում՝ {inStock}
          </span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            Ստուգված՝ {verified}
          </span>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
            Վաճառված՝ {sold}
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
            Ընդամենը՝ {inStock + sold}
          </span>
        </div>

        <div className="border-b border-gray-100 px-5 py-3">
          <div className="flex gap-1 rounded-lg border border-gray-200 p-1">
            {(
              [
                ['list', 'Ցանկ', List],
                ['verify', 'Ստուգում', ScanLine],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === value
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'list' && (
          <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Որոնել QR կոդով..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex gap-1 rounded-lg border border-gray-200 p-1">
              {(
                [
                  ['all', 'Բոլորը'],
                  ['in_stock', 'Պահեստ'],
                  ['sold', 'Վաճառված'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === value
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {activeTab === 'verify' ? (
            <div
              className="space-y-4"
              onMouseDown={(e) => {
                const target = e.target as HTMLElement;
                if (
                  target.tagName === 'INPUT' ||
                  target.tagName === 'BUTTON' ||
                  target.closest('button')
                ) {
                  return;
                }
                e.preventDefault();
                focusScanInput();
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    Ստուգված՝ {verified} / {inStock}
                  </span>
                  <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-800">
                    Մնացել՝ {pendingVerify}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleResetVerifications()}
                  disabled={isResetting || verified === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {isResetting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  Նոր ստուգում
                </button>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Սկանավորեք QR կոդը ստուգման համար
                </label>
                <div className="relative">
                  <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    ref={scanInputRef}
                    type="text"
                    autoFocus
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onBlur={handleScanInputBlur}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleVerifyScan(scanInput);
                      }
                    }}
                    placeholder="Սկանավորեք կամ մուտքագրեք QR կոդը"
                    className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {isVerifying && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-purple-600" />
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Ապարատային սկաները ավտոմատ ստուգում է կոդը (Enter)։ Կամ սեղմեք
                  «Սկան» ցանկի ցանկացած միավորի վրա։
                </p>
              </div>

              {/* Չստուգված / Ստուգված ցանկեր */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-orange-200 bg-white">
                  <div className="flex items-center justify-between border-b border-orange-100 bg-orange-50 px-3 py-2">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-orange-800">
                      <Circle className="h-4 w-4" />
                      Չստուգված
                    </span>
                    <span className="rounded-full bg-orange-200 px-2 py-0.5 text-xs font-bold text-orange-900">
                      {pendingVerifyUnits.length}
                    </span>
                  </div>
                  <div className="max-h-48 space-y-1.5 overflow-y-auto p-2">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-6 text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    ) : pendingVerifyUnits.length === 0 ? (
                      <p className="py-6 text-center text-xs text-gray-400">
                        Բոլոր միավորները ստուգված են
                      </p>
                    ) : (
                      pendingVerifyUnits.map((unit) =>
                        renderVerifyUnitRow(unit, false)
                      )
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-200 bg-white">
                  <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50 px-3 py-2">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" />
                      Ստուգված
                    </span>
                    <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-900">
                      {verifiedUnits.length}
                    </span>
                  </div>
                  <div className="max-h-48 space-y-1.5 overflow-y-auto p-2">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-6 text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    ) : verifiedUnits.length === 0 ? (
                      <p className="py-6 text-center text-xs text-gray-400">
                        Դեռ ստուգված միավորներ չկան
                      </p>
                    ) : (
                      verifiedUnits.map((unit) =>
                        renderVerifyUnitRow(unit, true)
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Սկանավորման արդյունքներ
                  </span>
                  <span className="text-xs text-gray-500">
                    {verifyLog.length} գրառում
                  </span>
                </div>
                {verifyLog.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">
                    Սկանավորեք QR կոդ՝ ստուգումը սկսելու համար
                  </p>
                ) : (
                  <div className="max-h-64 space-y-1.5 overflow-y-auto">
                    {verifyLog.map((entry) => (
                      <div
                        key={entry.id}
                        className={`rounded-md border px-3 py-2 text-sm ${logStyle(entry.outcome)}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono font-medium">
                              {entry.qrCode}
                            </p>
                            <p className="mt-0.5 text-xs opacity-90">
                              {entry.message}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="rounded px-1.5 py-0.5 text-xs font-semibold">
                              {logLabel(entry.outcome)}
                            </span>
                            <p className="mt-0.5 text-[10px] opacity-70">
                              {formatTime(entry.at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Բեռնվում է...
            </div>
          ) : units.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Package className="mb-2 h-10 w-10" />
              <p className="text-sm">QR միավորներ չեն գտնվել</p>
            </div>
          ) : (
            <div className="space-y-2">
              {units.map((unit) => {
                const isEditing = editingId === unit.id;
                const isSold = unit.status === 'sold';
                const isVerified = !isSold && !!unit.verifiedAt;
                const isDeleting = deletingId === unit.id;

                return (
                  <div
                    key={unit.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => setPreviewUnit(unit)}
                          className="shrink-0 rounded-md border border-gray-200 bg-white p-0.5 shadow-sm transition hover:border-purple-300 hover:shadow-md"
                          title="Մեծացնել QR"
                        >
                          <QRCodeSVG
                            value={unit.qrCode}
                            size={48}
                            level="M"
                            includeMargin={false}
                            bgColor="#ffffff"
                            fgColor="#111827"
                          />
                        </button>
                      )}
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <input
                            type="text"
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void saveEdit(unit.id);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="w-full rounded border border-purple-300 px-2 py-1 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPreviewUnit(unit)}
                            className="truncate text-left font-mono text-sm font-medium text-gray-900 hover:text-purple-700"
                            title="Մանրամասն տեղեկություն"
                          >
                            {unit.qrCode}
                          </button>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span
                            className={`rounded px-1.5 py-0.5 font-medium ${
                              isSold
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {isSold ? 'Վաճառված' : 'Պահեստում'}
                          </span>
                          {isVerified && (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-800">
                              Ստուգված
                            </span>
                          )}
                          <span>Ավելացվել՝ {formatDate(unit.createdAt)}</span>
                          {isVerified && unit.verifiedAt && (
                            <span>
                              Ստուգվել՝ {formatDate(unit.verifiedAt)}
                            </span>
                          )}
                          {isSold && unit.soldAt && (
                            <span>Վաճառվել՝ {formatDate(unit.soldAt)}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-1">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void saveEdit(unit.id)}
                              disabled={isSaving}
                              className="rounded p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-50"
                              title="Պահպանել"
                            >
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={isSaving}
                              className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                              title="Չեղարկել"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            {!isSold && (
                              <button
                                type="button"
                                onClick={() => startEdit(unit)}
                                className="rounded p-1.5 text-blue-600 hover:bg-blue-50"
                                title="Փոխել QR"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {!isSold && (
                              <button
                                type="button"
                                onClick={() => void handleDelete(unit)}
                                disabled={isDeleting}
                                className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                title="Ջնջել"
                              >
                                {isDeleting ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-5 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              {activeTab === 'verify'
                ? '«Ստուգում» ներդիրում սկանավորեք պահեստում գտնվող միավորները։ Նույն QR-ը կրկին ստուգել հնարավոր չէ մինչև «Նոր ստուգում» սեղմելը։'
                : 'Վաճառված միավորները չեն ջնջվում և QR-ը չի փոխվում՝ հարկային հաշվառման համար։ Պահեստում գտնվող միավորները կարելի է փոխել կամ ջնջել։'}
            </p>
            {activeTab === 'list' && inStock > 0 && (
              <button
                type="button"
                onClick={openDeleteAll}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Ջնջել բոլոր QR-ները ({inStock})
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {previewUnit && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-4"
          onClick={() => {
            setPreviewUnit(null);
            setQrCopied(false);
          }}
        >
          <div
            className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setPreviewUnit(null);
                setQrCopied(false);
              }}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative pr-8">
              <h3 className="text-lg font-bold text-gray-900">{product.name}</h3>
              <p className="mt-0.5 text-sm text-gray-500">
                {categoryLabel(product.category)}
                {product.isActive === false && ' · Անջատված'}
              </p>
            </div>

            {product.image && (
              <div className="relative mt-4 h-36 w-full overflow-hidden rounded-xl bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">Գին</p>
                <p className="font-semibold text-gray-900">
                  {formatPrice(product.price)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">Պահեստում</p>
                <p className="font-semibold text-gray-900">{inStock}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">Ստուգված</p>
                <p className="font-semibold text-emerald-700">{verified}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">Վաճառված</p>
                <p className="font-semibold text-blue-700">{sold}</p>
              </div>
            </div>

            {product.description && (
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                {product.description}
              </p>
            )}

            <div className="mt-5 flex justify-center rounded-xl border border-gray-200 bg-white p-4">
              <QRCodeSVG
                value={previewUnit.qrCode}
                size={220}
                level="M"
                includeMargin
                bgColor="#ffffff"
                fgColor="#111827"
              />
            </div>

            <div className="mt-4 flex items-center gap-2">
              <code className="flex-1 break-all rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-800">
                {previewUnit.qrCode}
              </code>
              <button
                type="button"
                onClick={() => void copyPreviewQr()}
                className="shrink-0 rounded-lg border border-gray-200 p-2 hover:bg-gray-50"
                title="Պատճենել QR կոդը"
              >
                {qrCopied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4 text-gray-600" />
                )}
              </button>
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="font-semibold text-gray-800">Միավորի տվյալներ</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div>
                  <span className="text-gray-500">Կարգավիճակ՝ </span>
                  <span className="font-medium text-gray-900">
                    {previewUnit.status === 'sold' ? 'Վաճառված' : 'Պահեստում'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Ստուգում՝ </span>
                  <span className="font-medium text-gray-900">
                    {previewUnit.verifiedAt ? 'Ստուգված' : 'Չստուգված'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Ավելացվել՝ </span>
                  <span className="font-medium text-gray-900">
                    {formatDate(previewUnit.createdAt)}
                  </span>
                </div>
                {previewUnit.verifiedAt && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Ստուգվել՝ </span>
                    <span className="font-medium text-emerald-700">
                      {formatDate(previewUnit.verifiedAt)}
                    </span>
                  </div>
                )}
                {previewUnit.soldAt && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Վաճառվել՝ </span>
                    <span className="font-medium text-blue-700">
                      {formatDate(previewUnit.soldAt)}
                    </span>
                  </div>
                )}
                {previewUnit.orderItemId && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Պատվերի միավոր ID՝ </span>
                    <span className="font-medium text-gray-900">
                      #{previewUnit.orderItemId}
                    </span>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="text-gray-500">ՊԵԿ՝ </span>
                  <span className="font-medium text-gray-900">
                    {previewUnit.pekReportedAt
                      ? `Ուղարկված · ${formatDate(previewUnit.pekReportedAt)}`
                      : 'Շրջանառության մեջ'}
                  </span>
                </div>
              </div>
            </div>

            {activeTab === 'verify' &&
              previewUnit.status === 'in_stock' &&
              !previewUnit.verifiedAt && (
                <button
                  type="button"
                  onClick={() => {
                    void handleVerifyScan(previewUnit.qrCode);
                    setPreviewUnit(null);
                  }}
                  disabled={isVerifying}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  <ScanLine className="h-4 w-4" />
                  Սկանավորել և ստուգել
                </button>
              )}
          </div>
        </div>
      )}

      {showDeleteAll && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            e.stopPropagation();
            closeDeleteAll();
          }}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-gray-900">
                  Ջնջել բոլոր QR միավորները՞
                </h4>
                <p className="mt-1 text-sm text-gray-600">
                  «{product.name}» ապրանքի պահեստում գտնվող{' '}
                  <span className="font-semibold text-red-700">{inStock}</span>{' '}
                  QR կոդը կջնջվի։ Վաճառված միավորները կմնան։ Այս գործողությունը
                  չեղարկել հնարավոր չէ։
                </p>
              </div>
            </div>

            <form onSubmit={(e) => void handleDeleteAll(e)} className="space-y-3">
              <div>
                <label
                  htmlFor="delete-all-password"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Հաստատելու համար մուտքագրեք ձեր գաղտնաբառը
                </label>
                <input
                  ref={deleteAllPasswordRef}
                  id="delete-all-password"
                  type="password"
                  autoComplete="current-password"
                  value={deleteAllPassword}
                  onChange={(e) => {
                    setDeleteAllPassword(e.target.value);
                    if (deleteAllError) setDeleteAllError(null);
                  }}
                  disabled={isDeletingAll}
                  placeholder="Գաղտնաբառ"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60"
                />
              </div>

              {deleteAllError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {deleteAllError}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeDeleteAll}
                  disabled={isDeletingAll}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Չեղարկել
                </button>
                <button
                  type="submit"
                  disabled={isDeletingAll || !deleteAllPassword.trim()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeletingAll ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Հաստատել ջնջումը
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}
