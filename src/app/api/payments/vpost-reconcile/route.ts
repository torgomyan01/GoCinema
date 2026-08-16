import { NextResponse } from 'next/server';
import { reconcilePendingVPostPayments } from '@/app/actions/payments';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  if (request.headers.get('x-vercel-cron') === '1') return true;
  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

async function runReconcile() {
  const result = await reconcilePendingVPostPayments(25);
  return NextResponse.json(result);
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
