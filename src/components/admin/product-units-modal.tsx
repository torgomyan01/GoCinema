'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import {
  getProductUnits,
  updateProductUnitQr,
  deleteProductUnit,
  verifyProductUnitQr,
  resetProductUnitVerifications,
  type VerifyUnitOutcome,
} from '@/app/actions/products';

interface ProductUnitsModalProps {
  product: {
    id: number;
    name: string;
    stock: number;
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
  createdAt: Date | string;
  orderItemId: number | null;
}

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
  const [isResetting, setIsResetting] = useState(false);
  const [verifyLog, setVerifyLog] = useState<VerifyLogEntry[]>([]);
  const [sessionScanned, setSessionScanned] = useState<Set<string>>(new Set());
  const scanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (activeTab === 'verify') {
      const t = setTimeout(() => scanInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [activeTab]);

  const loadUnits = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getProductUnits(product.id, {
        search: debouncedSearch || undefined,
        status: statusFilter,
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
  }, [product.id, debouncedSearch, statusFilter]);

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
    if (!code || isVerifying) return;

    if (sessionScanned.has(code)) {
      addVerifyLog(code, 'duplicate_session', 'Այս սեսիայում արդեն սկանավորվել է');
      setScanInput('');
      return;
    }

    setIsVerifying(true);
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
            return prev;
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
      setScanInput('');
      scanInputRef.current?.focus();
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
      scanInputRef.current?.focus();
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
            <div className="space-y-4">
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleVerifyScan(scanInput);
                      }
                    }}
                    disabled={isVerifying}
                    placeholder="Սկանավորեք կամ մուտքագրեք QR կոդը"
                    className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
                  />
                  {isVerifying && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-purple-600" />
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Ապարատային սկաները ավտոմատ ստուգում է կոդը (Enter)։ Նույն
                  միավորը կրկին սկանել հնարավոր չէ մինչև «Նոր ստուգում»։
                </p>
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
                          <p className="truncate font-mono text-sm font-medium text-gray-900">
                            {unit.qrCode}
                          </p>
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
          <p className="text-xs text-gray-500">
            {activeTab === 'verify'
              ? '«Ստուգում» ներդիրում սկանավորեք պահեստում գտնվող միավորները։ Նույն QR-ը կրկին ստուգել հնարավոր չէ մինչև «Նոր ստուգում» սեղմելը։'
              : 'Վաճառված միավորները չեն ջնջվում և QR-ը չի փոխվում՝ հարկային հաշվառման համար։ Պահեստում գտնվող միավորները կարելի է փոխել կամ ջնջել։'}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
