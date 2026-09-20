'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, RefreshCw } from 'lucide-react';

interface CameraQrReaderProps {
  onScan: (code: string) => void;
  /** false = տեսախցիկը չի աշխատում (օր. մոդալը busy է) */
  enabled?: boolean;
  /** pause overlay-ից հետո ավտոմատ շարունակել */
  continuous?: boolean;
  className?: string;
  hint?: string;
}

export function prefersMobileCamera(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(ua);
  const touchNarrow =
    navigator.maxTouchPoints > 0 &&
    window.matchMedia('(max-width: 1023px)').matches;
  return mobileUa || touchNarrow;
}

export default function CameraQrReader({
  onScan,
  enabled = true,
  continuous = true,
  className = '',
  hint = 'Ուղղեք տեսախցիկը QR կոդին',
}: CameraQrReaderProps) {
  const reactId = useId().replace(/:/g, '');
  const readerId = `cam-qr-${reactId}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startingRef = useRef(false);
  const lastScanRef = useRef<{ value: string; at: number }>({ value: '', at: 0 });
  const onScanRef = useRef(onScan);

  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stop = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    startingRef.current = false;
    if (!scanner) {
      setReady(false);
      return;
    }
    try {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    } catch {
      // ignore
    } finally {
      setReady(false);
    }
  }, []);

  const handleDecoded = useCallback(
    (decodedText: string) => {
      const value = decodedText.trim();
      if (!value) return;
      const now = Date.now();
      if (
        lastScanRef.current.value === value &&
        now - lastScanRef.current.at < (continuous ? 1800 : 2500)
      ) {
        return;
      }
      lastScanRef.current = { value, at: now };
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(35);
      }
      onScanRef.current(value);
    },
    [continuous]
  );

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError(null);
    await stop();

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Տեսախցիկը հասանելի չէ այս սարքում');
      }

      const scanner = new Html5Qrcode(readerId, { verbose: false });
      scannerRef.current = scanner;
      const boxSize = Math.min(240, Math.floor(window.innerWidth * 0.62));

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 12,
          qrbox: { width: boxSize, height: boxSize },
          aspectRatio: 1,
          disableFlip: false,
        },
        (text) => handleDecoded(text),
        () => undefined
      );
      setReady(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Չհաջողվեց միացնել տեսախցիկը';
      setError(
        message.toLowerCase().includes('permission') ||
          message.includes('NotAllowedError')
          ? 'Տեսախցիկի թույլտվությունը մերժված է'
          : message
      );
      scannerRef.current = null;
      setReady(false);
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [handleDecoded, readerId, stop]);

  useEffect(() => {
    if (!enabled) {
      void stop();
      return;
    }
    void start();
    return () => {
      void stop();
    };
  }, [enabled, start, stop]);

  return (
    <div
      className={`overflow-hidden rounded-xl border border-gray-200 bg-black ${className}`}
    >
      <div className="relative">
        <div
          id={readerId}
          className="min-h-[220px] w-full overflow-hidden bg-black [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        />

        {(starting || (!ready && !error)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-900/80 text-white">
            <RefreshCw className="h-6 w-6 animate-spin text-purple-300" />
            <p className="text-xs">Տեսախցիկը միանում է…</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-950 px-4 text-center">
            <CameraOff className="h-8 w-8 text-red-300" />
            <p className="text-xs text-red-100">{error}</p>
            <button
              type="button"
              onClick={() => void start()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-purple-600 px-3 text-xs font-semibold text-white"
            >
              <Camera className="h-3.5 w-3.5" />
              Կրկին
            </button>
          </div>
        )}
      </div>
      {ready && !error && (
        <p className="bg-gray-900 px-3 py-1.5 text-center text-[11px] text-gray-300">
          {hint}
        </p>
      )}
    </div>
  );
}
