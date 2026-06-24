'use client';

import { useEffect } from 'react';

interface PrintOrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface PrintOrder {
  id: number;
  createdAt: string;
  items: PrintOrderItem[];
  total: number;
}

const CINEMA_NAME = 'GoCinema';
const CINEMA_ADDRESS = 'Ք. Մարտունի, Երևանյան 74/7';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('hy-AM', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const printStyles = `
  @page { size: 72mm 120mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print {
    .no-print { display: none !important; }
  }
`;

export default function OrderPrintClient({ order }: { order: PrintOrder }) {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f3f4f6',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: 16,
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          onClick={() => window.print()}
          style={{
            background: '#16a34a',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Տպել
        </button>
        <button
          onClick={() => window.close()}
          style={{
            background: '#e5e7eb',
            color: '#111827',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Փակել
        </button>
      </div>

      {/* 72mm լայնությամբ չեկ */}
      <div
        style={{
          width: '72mm',
          background: '#fff',
          color: '#000',
          padding: '4mm',
          boxSizing: 'border-box',
          textAlign: 'center',
          border: '1px solid #e5e7eb',
        }}
      >
        <div style={{ fontSize: '16pt', fontWeight: 800, letterSpacing: '1px' }}>
          {CINEMA_NAME}
        </div>
        <div style={{ fontSize: '9pt', marginTop: '1mm' }}>Ապրանքների վաճառք</div>
        <div style={{ borderTop: '1px dashed #000', margin: '3mm 0' }} />

        <div style={{ fontSize: '8.5pt' }}>{formatDateTime(order.createdAt)}</div>

        <div
          style={{
            textAlign: 'left',
            fontSize: '9.5pt',
            margin: '3mm 0',
            paddingTop: '2mm',
            borderTop: '1px dashed #000',
          }}
        >
          {order.items.map((item, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '1mm',
              }}
            >
              <span>
                {item.name} × {item.quantity}
              </span>
              <span style={{ fontWeight: 700 }}>
                {(item.price * item.quantity).toLocaleString()} ֏
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '2mm 0',
            borderTop: '1px dashed #000',
            borderBottom: '1px dashed #000',
            fontWeight: 800,
            fontSize: '13pt',
          }}
        >
          <span>Ընդհանուր</span>
          <span>{order.total.toLocaleString()} ֏</span>
        </div>

        <div style={{ fontSize: '8pt', fontWeight: 700, marginTop: '3mm' }}>
          Պատվեր #{order.id}
        </div>
        <div style={{ fontSize: '8pt', marginTop: '1mm' }}>Կանխիկ վճարում</div>

        <div style={{ borderTop: '1px dashed #000', margin: '3mm 0' }} />
        <div style={{ fontSize: '7.5pt', lineHeight: 1.3 }}>{CINEMA_ADDRESS}</div>
        <div style={{ fontSize: '7.5pt', marginTop: '1mm' }}>Շնորհակալություն</div>
      </div>
    </div>
  );
}
