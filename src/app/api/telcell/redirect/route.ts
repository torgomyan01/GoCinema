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

function buildRedirect(
  request: NextRequest,
  issuerId: string,
  rawStatus: string
): NextResponse {
  const orderId = parseOrderId(issuerId);
  if (!orderId) {
    return NextResponse.redirect(new URL('/tickets', request.url));
  }

  const status = (rawStatus || '').toUpperCase();
  const redirectUrl = new URL(`/payment/${orderId}`, request.url);
  redirectUrl.searchParams.set('gateway', 'telcell');
  redirectUrl.searchParams.set('redirect', '1');
  redirectUrl.searchParams.set(
    'status',
    status === 'PAID' ? 'paid' : status === 'REJECTED' ? 'rejected' : 'pending'
  );

  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const issuerId = searchParams.get('issuer_id') || '';
  const status = searchParams.get('status') || '';
  return buildRedirect(request, issuerId, status);
}

// Telcell-ի redirect-ի մեթոդը դոկումենտացիայում նշված չէ. աջակցում ենք նաև POST-ին։
export async function POST(request: NextRequest) {
  let issuerId = '';
  let status = '';

  try {
    const formData = await request.formData();
    issuerId = String(formData.get('issuer_id') || '');
    status = String(formData.get('status') || '');
  } catch {
    // Եթե body-ն form չէ, փորձենք query-ից
  }

  if (!issuerId) {
    const { searchParams } = new URL(request.url);
    issuerId = searchParams.get('issuer_id') || '';
    if (!status) status = searchParams.get('status') || '';
  }

  return buildRedirect(request, issuerId, status);
}
