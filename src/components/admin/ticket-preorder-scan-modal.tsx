'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, ScanLine, X } from 'lucide-react';
import {
  getQrOrderItems,
  type PreOrderLine,
  type TicketWithPreOrder,
} from '@/lib/preorder-entry';

interface LookupResult {
  success: boolean;
  error?: string;
  orderItemId?: number;
  orderItemName?: string;
  unit?: {
    qrCode: string;
    name: string;
    category: string;
  };
}

function buildInitialAssignments(lines: PreOrderLine[]) {
  const map: Record<number, string[]> = {};
  for (const line of lines) {
    map[line.id] =
      line.units
        ?.filter((u) => u.status === 'in_stock')
        .map((u) => u.qrCode) ?? [];
  }
  return map;
}

interface TicketPreOrderScanModalProps {
  ticket: TicketWithPreOrder;
  isSubmitting: boolean;
  error?: string | null;
  /** 'entry' = վճարված տոմս՝ մուտք + ՀԴՄ; 'attach' = ամրագրված՝ միայն QR կցում */
  mode?: 'entry' | 'attach';
  onClose: () => void;
  lookupScan: (qrCode: string) => Promise<LookupResult>;
  onComplete: (
    items: Array<{ orderItemId: number; qrCodes: string[]; quantity: number }>
  ) => void;
}

export default function TicketPreOrderScanModal({
  ticket,
  isSubmitting,
  error,
  mode = 'entry',
  onClose,
  lookupScan,
  onComplete,
}: TicketPreOrderScanModalProps) {
  const isAttachMode = mode === 'attach';
  const lines = useMemo(() => getQrOrderItems(ticket), [ticket]);
  const [assignments, setAssignments] = useState<Record<number, string[]>>(() =>
    buildInitialAssignments(lines)
  );
  const [scanInput, setScanInput] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const focusScanInput = useCallback(() => {
    requestAnimationFrame(() => {
      scanInputRef.current?.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => focusScanInput(), 60);
    return () => clearTimeout(t);
  }, [focusScanInput]);

  const totalNeeded = lines.reduce((sum, line) => sum + line.quantity, 0);
  const totalScanned = lines.reduce((sum, line) => {
    return sum + Math.min(assignments[line.id]?.length ?? 0, line.quantity);
  }, 0);
  const allReady = lines.every(
    (line) => (assignments[line.id]?.length ?? 0) >= line.quantity
  );

  const handleScan = async (raw: string) => {
    const code = raw.trim();
    if (!code || scanBusy) return;

    const alreadyUsed = Object.values(assignments).some((codes) =>
      codes.includes(code)
    );
    if (alreadyUsed) {
      setScanError(`QR «${code}» արդեն ավելացված է`);
      setScanInput('');
      focusScanInput();
      return;
    }

    setScanBusy(true);
    setScanError(null);
    try {
      const result = await lookupScan(code);
      if (!result.success || !result.orderItemId || !result.unit) {
        setScanError(result.error || 'QR-ը չհաջողվեց ավելացնել');
        return;
      }

      const line = lines.find((l) => l.id === result.orderItemId);
      if (!line) {
        setScanError('Ապրանքի տողը չի գտնվել');
        return;
      }

      const current = assignments[line.id] ?? [];
      if (current.length >= line.quantity) {
        setScanError(`«${line.product.name}»-ի բոլոր QR-ները արդեն սկանավորված են`);
        return;
      }

      setAssignments((prev) => ({
        ...prev,
        [line.id]: [...(prev[line.id] ?? []), result.unit!.qrCode],
      }));
    } catch {
      setScanError('QR-ը ստուգելիս սխալ է տեղի ունեցել');
    } finally {
      setScanBusy(false);
      setScanInput('');
      focusScanInput();
    }
  };

  const handleSubmit = () => {
    if (!allReady) return;
    onComplete(
      lines.map((line) => ({
        orderItemId: line.id,
        qrCodes: (assignments[line.id] ?? []).slice(0, line.quantity),
        quantity: line.quantity,
      }))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Ապրանքների QR</h3>
            <p className="text-sm text-gray-500">
              {isAttachMode
                ? `Կցեք ապրանքների QR · վճարումը՝ դրամարկղում · ${totalScanned}/${totalNeeded}`
                : `Սկանավորեք ամրագրված ապրանքները · ${totalScanned}/${totalNeeded}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              <ScanLine className="h-4 w-4" />
              Սկանավորել ապրանքի QR
            </label>
            <input
              ref={scanInputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleScan(scanInput);
                }
              }}
              disabled={scanBusy || allReady}
              placeholder={
                allReady
                  ? 'Բոլոր QR-ները սկանավորված են'
                  : 'Սկանավորեք ապրանքի QR կոդը...'
              }
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
            {(scanError || error) && (
              <p className="mt-2 text-sm text-red-600">{scanError || error}</p>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-gray-200 p-3">
            {lines.map((line) => {
              const scanned = assignments[line.id] ?? [];
              const ready = scanned.length >= line.quantity;
              return (
                <div
                  key={line.id}
                  className="flex items-start justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {ready ? (
                        <Check className="h-4 w-4 shrink-0 text-green-600" />
                      ) : (
                        <span className="h-4 w-4 shrink-0 rounded-full border-2 border-orange-400" />
                      )}
                      <span className="truncate text-sm font-medium text-gray-900">
                        {line.product.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        x{line.quantity}
                      </span>
                    </div>
                    {scanned.length > 0 && (
                      <div className="mt-1 space-y-0.5 pl-6">
                        {scanned.map((code) => (
                          <p
                            key={code}
                            className="truncate font-mono text-[10px] text-gray-500"
                          >
                            {code}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-xs font-semibold ${
                      ready ? 'text-green-600' : 'text-orange-600'
                    }`}
                  >
                    {Math.min(scanned.length, line.quantity)}/{line.quantity}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Փակել
          </button>
          <button
            type="button"
            disabled={!allReady || isSubmitting}
            onClick={handleSubmit}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isAttachMode ? 'Կցվում է...' : 'Մուտք...'}
              </>
            ) : isAttachMode ? (
              'Կցել QR-ները'
            ) : (
              'Մուտք + ՀԴՄ'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
