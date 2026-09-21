import { NextResponse } from 'next/server';
import { reconcilePendingVPostPayments } from '@/app/actions/payments';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  // Never trust x-vercel-cron on self-hosted VPS — spoofable by any client.
  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

async function runReconcile() {
  process.env.CRON_INTERNAL = '1';
  try {
    const result = await reconcilePendingVPostPayments(25);
    return NextResponse.json(result);
  } finally {
    delete process.env.CRON_INTERNAL;
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runReconcile();
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runReconcile();
}
