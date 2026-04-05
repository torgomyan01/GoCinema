import { NextRequest, NextResponse } from 'next/server';
import { fromBase64 } from '@/lib/telcell';

function parseOrderId(rawIssuerId: string): number | null {
  try {
    const decoded = fromBase64(rawIssuerId);
    const normalized = decoded.startsWith('order:')
      ? decoded.replace('order:', '')
      : decoded;
    const orderId = Number(normalized);
    return Number.isFinite(orderId) ? orderId : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const issuerId = searchParams.get('issuer_id') || '';
  const status = (searchParams.get('status') || '').toUpperCase();

  const orderId = parseOrderId(issuerId);
  if (!orderId) {
    return NextResponse.redirect(new URL('/tickets', request.url));
  }

  const redirectUrl = new URL(`/payment/${orderId}`, request.url);
  redirectUrl.searchParams.set('gateway', 'telcell');
  redirectUrl.searchParams.set('redirect', '1');
  redirectUrl.searchParams.set(
    'status',
    status === 'PAID' ? 'paid' : status === 'REJECTED' ? 'rejected' : 'pending'
  );

  return NextResponse.redirect(redirectUrl);
}

