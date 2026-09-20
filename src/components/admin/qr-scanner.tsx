'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Keyboard, QrCode, RefreshCw, X } from 'lucide-react';
import CameraQrReader, { prefersMobileCamera } from './camera-qr-reader';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onError?: (error: string) => void;
}

type ScanMode = 'camera' | 'manual';

export default function QRScanner({ onScanSuccess }: QRScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ScanMode>('manual');
  const [manualQRCode, setManualQRCode] = useState('');
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [pausedAfterScan, setPausedAfterScan] = useState(false);
  const [lastDecoded, setLastDecoded] = useState<string | null>(null);

  useEffect(() => {
    setMode(prefersMobileCamera() ? 'camera' : 'manual');
  }, []);

  useEffect(() => {
    if (mode !== 'manual') return;
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [mode]);

  const handleCameraScan = (value: string) => {
    setLastDecoded(value);
    setPausedAfterScan(true);
    setCameraEnabled(false);
    onScanSuccess(value);
  };

  const resumeCamera = () => {
    setPausedAfterScan(false);
    setLastDecoded(null);
    setCameraEnabled(true);
  };

  const handleManualSubmit = () => {
    if (!manualQRCode.trim()) return;
    onScanSuccess(manualQRCode.trim());
    setManualQRCode('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <div className="w-full space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => {
            setMode('camera');
            setPausedAfterScan(false);
            setCameraEnabled(true);
          }}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
            mode === 'camera'
              ? 'bg-white text-purple-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Տեսախցիկ
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
            mode === 'manual'
              ? 'bg-white text-purple-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Keyboard className="h-4 w-4" />
          Ձեռքով
        </button>
      </div>

      {mode === 'camera' ? (
        <div className="relative overflow-hidden rounded-xl">
          <CameraQrReader
            enabled={cameraEnabled && !pausedAfterScan}
            continuous={false}
            onScan={handleCameraScan}
            hint="Ուղղեք հեռախոսի տեսախցիկը հաճախորդի QR կոդին"
          />

          {pausedAfterScan && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-emerald-950/92 px-5 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
                <Check className="h-7 w-7" />
              </div>
              <div>
                <p className="text-base font-bold text-white">QR-ը կարդացվեց</p>
                {lastDecoded && (
                  <p className="mt-1 break-all text-xs text-emerald-100/90">
                    {lastDecoded}
                  </p>
                )}
                <p className="mt-2 text-sm text-emerald-100">
                  Ստորև կարող եք սպասարկել հաճախորդին
                </p>
              </div>
              <button
                type="button"
                onClick={resumeCamera}
                className="inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-emerald-800"
              >
                <RefreshCw className="h-4 w-4" />
                Հաջորդ QR սկան
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                className="text-xs text-emerald-200 underline"
              >
                Ձեռքով մուտքագրել
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-5 sm:p-8">
          <QrCode className="mb-3 h-12 w-12 text-gray-400 sm:mb-4 sm:h-16 sm:w-16" />
          <p className="mb-4 text-center text-sm text-gray-600 sm:text-base">
            Մուտքագրեք QR կոդը կամ օգտագործեք USB սկաները
            <br />
            <span className="text-xs text-gray-500 sm:text-sm">
              (օրինակ՝ ORDER-123 կամ TICKET-456)
            </span>
          </p>
          <div className="w-full max-w-sm space-y-3">
            <input
              ref={inputRef}
              type="text"
              value={manualQRCode}
              onChange={(e) => setManualQRCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleManualSubmit();
              }}
              placeholder="ORDER-123 կամ TICKET-456"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500 sm:text-lg"
              autoFocus
            />
            <div className="flex gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={!manualQRCode.trim()}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-4 text-sm font-semibold text-white shadow-lg transition-all hover:from-green-700 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check className="h-5 w-5" />
                Ստուգել
              </button>
              <button
                type="button"
                onClick={() => setManualQRCode('')}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gray-600 px-4 text-sm font-semibold text-white shadow-lg transition-all hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
                Մաքրել
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
