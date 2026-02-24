'use client';

import { useState, useEffect, useRef } from 'react';
import { QrCode, Check, X } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onError?: (error: string) => void;
}

export default function QRScanner({ onScanSuccess, onError }: QRScannerProps) {
  const [manualQRCode, setManualQRCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when component mounts or when switching windows
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleManualSubmit = () => {
    if (manualQRCode.trim()) {
      onScanSuccess(manualQRCode.trim());
      setManualQRCode('');
      // Refocus input after submission
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
        <QrCode className="w-16 h-16 text-gray-400 mb-4" />
        <p className="text-gray-600 mb-4 text-center">
          Մուտքագրեք QR կոդը սկաների միջոցով
          <br />
          <span className="text-sm text-gray-500">
            (օրինակ: ORDER-123 կամ TICKET-456)
          </span>
        </p>
        <div className="w-full max-w-sm space-y-3">
          <input
            ref={inputRef}
            type="text"
            value={manualQRCode}
            onChange={(e) => setManualQRCode(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleManualSubmit();
              }
            }}
            placeholder="ORDER-123 կամ TICKET-456"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-lg"
            autoFocus
          />
          <div className="flex gap-3">
            <button
              onClick={handleManualSubmit}
              disabled={!manualQRCode.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-5 h-5" />
              Ստուգել
            </button>
            <button
              onClick={() => {
                setManualQRCode('');
              }}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-all shadow-lg"
            >
              <X className="w-5 h-5" />
              Մաքրել
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
