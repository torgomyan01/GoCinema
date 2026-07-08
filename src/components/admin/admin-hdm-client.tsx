'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plug,
  Printer,
  RefreshCw,
  ScanLine,
  Users,
} from 'lucide-react';
import {
  checkHdmAgentHealth,
  checkHdmEmark,
  diagnoseHdmAgent,
  getHdmAgentStatus,
  getHdmAgentUrl,
  getHdmOperators,
  hdmAgentLogin,
  hdmAgentLogout,
  isHdmAgentEnabled,
  printHdmReceipt,
} from '@/lib/hdm-agent';

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="max-h-72 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-green-300">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function AdminHdmClient() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<unknown>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [eMark, setEmark] = useState('');
  const [testAmount, setTestAmount] = useState('1000');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');

  const agentUrl = getHdmAgentUrl();
  const enabled = isHdmAgentEnabled();

  const refreshHealth = useCallback(async () => {
    if (!enabled) {
      setOnline(null);
      return;
    }
    const ok = await checkHdmAgentHealth();
    setOnline(ok);
  }, [enabled]);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setLastError(null);
    try {
      const result = await fn();
      const payload = result as { ok?: boolean; error?: string };
      if (payload && payload.ok === false) {
        setLastError(payload.error ?? 'Սխալ');
      }
      setLastResult(result);
      await refreshHealth();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setLastError(message);
      setLastResult({ ok: false, error: message });
    } finally {
      setBusy(null);
    }
  };

  const actionBtn =
    'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:opacity-50';

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ՀԴՄ Agent</h1>
          <p className="mt-1 text-sm text-gray-600">
            Լոկալ կապ GoCinema ↔ HDM agent ↔ ՀԴՄ սարք
          </p>
        </div>
        <button
          onClick={() => void refreshHealth()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Թարմացնել
        </button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Agent URL
          </p>
          <p className="mt-1 break-all text-sm font-semibold text-gray-900">
            {agentUrl}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Կարգավիճակ
          </p>
          <p
            className={`mt-1 inline-flex items-center gap-2 text-sm font-semibold ${
              online ? 'text-emerald-700' : online === false ? 'text-amber-700' : 'text-gray-600'
            }`}
          >
            {online ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {!enabled
              ? 'Անջատված (.env)'
              : online
                ? 'Online'
                : online === false
                  ? 'Offline'
                  : 'Ստուգում…'}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Լոկալ գործարկում
          </p>
          <p className="mt-1 text-sm text-gray-700">
            <code className="rounded bg-gray-100 px-1.5 py-0.5">npm run dev:local</code>{' '}
            — Next.js + HDM agent միասին
          </p>
        </div>
      </div>

      {lastError && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {lastError}
        </div>
      )}

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Plug className="h-4 w-4" />
          API endpoints
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={!!busy}
            className={actionBtn}
            onClick={() => run('health', async () => {
              const ok = await checkHdmAgentHealth();
              return { ok, endpoint: 'GET /health' };
            })}
          >
            GET /health
          </button>
          <button
            disabled={!!busy}
            className={actionBtn}
            onClick={() => run('diagnose', () => diagnoseHdmAgent())}
          >
            GET /v1/diagnose
          </button>
          <button
            disabled={!!busy}
            className={actionBtn}
            onClick={() => run('status', () => getHdmAgentStatus())}
          >
            GET /v1/status
          </button>
          <button
            disabled={!!busy}
            className={actionBtn}
            onClick={() => run('login', () => hdmAgentLogin())}
          >
            POST /v1/login
          </button>
          <button
            disabled={!!busy}
            className={actionBtn}
            onClick={() => run('logout', () => hdmAgentLogout())}
          >
            POST /v1/logout
          </button>
          <button
            disabled={!!busy}
            className={actionBtn}
            onClick={() => run('operators', () => getHdmOperators())}
          >
            <Users className="mr-1 inline h-4 w-4" />
            GET /v1/operators
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <ScanLine className="h-4 w-4" />
            eMark ստուգում
          </h2>
          <input
            value={eMark}
            onChange={(e) => setEmark(e.target.value)}
            placeholder="eMark կոդ"
            className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <button
            disabled={!!busy || !eMark.trim()}
            className={actionBtn}
            onClick={() =>
              run('check-emark', () => checkHdmEmark(eMark.trim()))
            }
          >
            POST /v1/check-emark
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Printer className="h-4 w-4" />
            Փորձնական կտրոն
          </h2>
          <div className="mb-3 flex gap-2">
            <input
              value={testAmount}
              onChange={(e) => setTestAmount(e.target.value)}
              type="number"
              min="1"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as 'cash' | 'card')
              }
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="cash">Կանխիկ</option>
              <option value="card">Քարտ</option>
            </select>
          </div>
          <button
            disabled={!!busy}
            className={actionBtn}
            onClick={() => {
              const total = Number(testAmount);
              if (!Number.isFinite(total) || total <= 0) {
                setLastError('Մուտքագրեք վավեր գումար');
                return;
              }
              void run('print-receipt', () =>
                printHdmReceipt({
                  paymentMethod,
                  total,
                  items: [
                    {
                      productCode: 'TEST-001',
                      productName: 'Փորձնական ապրանք',
                      price: total,
                      qty: 1,
                      unit: 'հատ',
                    },
                  ],
                })
              );
            }}
          >
            POST /v1/print-receipt
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Վերջին պատասխան</h2>
          {busy && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {busy}
            </span>
          )}
        </div>
        {lastResult ? (
          <JsonBlock data={lastResult} />
        ) : (
          <p className="text-sm text-gray-500">Դեռ հարցում չի ուղարկվել</p>
        )}
      </div>
    </div>
  );
}
