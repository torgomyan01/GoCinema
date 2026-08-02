'use client';

import { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { formatPrice } from '@/lib/format';

interface PrintProductItem {
  name: string;
  quantity: number;
  price: number;
}

interface PrintTicket {
  id: number;
  price: number;
  qrCode: string;
  /** Ամսաթիվ՝ սերվերում ձևավորված (hydration mismatch չլինի) */
  formattedStartTime: string;
  seat?: { row: string; number: number; seatType: string };
  orderId?: number;
  screening: {
    movie: { title: string };
  };
  items?: PrintProductItem[];
  total?: number;
}

const CINEMA_NAME = 'GoCinema';

const printStyles = `
  @page { size: 72mm 120mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print {
    .no-print { display: none !important; }
  }
`;

export default function TicketPrintClient({ ticket }: { ticket: PrintTicket }) {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, []);

  const isOrderPrint = Boolean(ticket.orderId);
  const total = ticket.total ?? ticket.price;
  const refLabel = isOrderPrint
    ? `Պատվեր #${ticket.orderId ?? ticket.id}`
    : `Տոմս #${ticket.id}`;

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

      <div
        className="no-print"
        style={{ display: 'flex', gap: 8, marginTop: 8 }}
      >
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
        <div
          style={{
            fontSize: '16pt',
            fontWeight: 800,
            letterSpacing: '1px',
          }}
        >
          {CINEMA_NAME}
        </div>
        <div
          style={{
            borderTop: '1px dashed #000',
            margin: '3mm 0',
          }}
        />

        <div style={{ fontSize: '13pt', fontWeight: 700, lineHeight: 1.2 }}>
          {ticket.screening.movie.title}
        </div>

        <div style={{ fontSize: '9pt', marginTop: '2mm' }}>
          {ticket.formattedStartTime}
        </div>

        {ticket.items && ticket.items.length > 0 && (
          <div
            style={{
              textAlign: 'left',
              fontSize: '9pt',
              margin: '3mm 0',
              padding: '2mm 0',
              borderTop: '1px dashed #000',
              borderBottom: '1px dashed #000',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '1.5mm' }}>
              Ապրանքներ
            </div>
            {ticket.items.map((item, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '0.5mm',
                }}
              >
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span style={{ fontWeight: 700 }}>
                  {formatPrice(item.price * item.quantity)} ֏
                </span>
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '1.5mm',
                fontWeight: 800,
                fontSize: '11pt',
              }}
            >
              <span>Ընդհանուր</span>
              <span>{formatPrice(total)} ֏</span>
            </div>
          </div>
        )}

        <div
          style={{ display: 'flex', justifyContent: 'center', margin: '3mm 0' }}
        >
          <QRCodeSVG value={ticket.qrCode} size={130} level="M" />
        </div>

        <div style={{ fontSize: '8pt', fontWeight: 700 }}>{refLabel}</div>
      </div>
    </div>
  );
}
