'use client';

import { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface PrintProductItem {
  name: string;
  quantity: number;
  price: number;
}

interface PrintTicket {
  id: number;
  price: number;
  qrCode: string;
  seat: { row: string; number: number; seatType: string };
  screening: {
    startTime: string;
    movie: { title: string };
    hall: { name: string };
  };
  items?: PrintProductItem[];
  total?: number;
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

export default function TicketPrintClient({ ticket }: { ticket: PrintTicket }) {
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

      {/* 72mm լայնությամբ տոմս */}
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
          {formatDateTime(ticket.screening.startTime)}
        </div>
        <div style={{ fontSize: '9pt', marginTop: '1mm' }}>
          {ticket.screening.hall.name}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            margin: '3mm 0',
            padding: '2mm 0',
            borderTop: '1px dashed #000',
            borderBottom: '1px dashed #000',
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '7pt' }}>ՏԵՂ</div>
            <div style={{ fontSize: '18pt', fontWeight: 800 }}>
              {ticket.seat.row}
              {ticket.seat.number}
            </div>
            {ticket.seat.seatType === 'vip' && (
              <div style={{ fontSize: '7pt', fontWeight: 700 }}>VIP</div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '7pt' }}>ԳԻՆ</div>
            <div style={{ fontSize: '14pt', fontWeight: 800 }}>
              {ticket.price.toLocaleString()} ֏
            </div>
          </div>
        </div>

        {ticket.items && ticket.items.length > 0 && (
          <div
            style={{
              textAlign: 'left',
              fontSize: '9pt',
              marginBottom: '3mm',
              paddingBottom: '2mm',
              borderBottom: '1px dashed #000',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '1.5mm' }}>Ապրանքներ</div>
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
                  {(item.price * item.quantity).toLocaleString()} ֏
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
              <span>
                {(ticket.total ?? ticket.price).toLocaleString()} ֏
              </span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', margin: '2mm 0' }}>
          <QRCodeSVG value={ticket.qrCode} size={130} level="M" />
        </div>

        <div style={{ fontSize: '8pt', fontWeight: 700 }}>
          Տոմս #{ticket.id}
        </div>

        <div
          style={{
            borderTop: '1px dashed #000',
            margin: '3mm 0',
          }}
        />
        <div style={{ fontSize: '7.5pt', lineHeight: 1.3 }}>
          {CINEMA_ADDRESS}
        </div>
        <div style={{ fontSize: '7.5pt', marginTop: '1mm' }}>
          Խնդրում ենք ներկայանալ ցուցադրությունից 15 րոպե շուտ։
        </div>
      </div>
    </div>
  );
}
