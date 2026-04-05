import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { buildTelcellCallbackChecksum, fromBase64 } from '@/lib/telcell';
import { generateQRCode } from '@/app/actions/tickets';

function telcellCallbackLog(event: string, payload: Record<string, unknown>) {
  const log =
    (process.env.PAYMENT_LOG || '').toLowerCase() === 'true' ||
    (process.env.PAYMENT_LOG || '').toLowerCase() === '1' ||
    (process.env.PAYMENT_DEBUG || '').toLowerCase() === 'true' ||
    process.env.NODE_ENV === 'development';
  if (!log) return;
  try {
    console.info(`[Telcell] ${event}`, JSON.stringify(payload));
  } catch {
    console.info(`[Telcell] ${event}`, payload);
  }
}

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const invoice = String(formData.get('invoice') || '');
    const issuerId = String(formData.get('issuer_id') || '');
    const paymentId = String(formData.get('payment_id') || '');
    const currency = String(formData.get('currency') || '');
    const sum = String(formData.get('sum') || '');
    const time = String(formData.get('time') || '');
    const status = String(formData.get('status') || '');
    const checksum = String(formData.get('checksum') || '');

    telcellCallbackLog('callback_received', {
      invoice,
      issuer_id: issuerId,
      payment_id: paymentId,
      currency,
      sum,
      time,
      status,
      checksumLength: checksum.length,
    });

    const secretKey =
      process.env.TELLCELL_SHOP_KEY || process.env.TELLCEL_SHOP_KEY;

    if (!secretKey) {
      console.error('[Telcell Callback] Missing secret key');
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    const expectedChecksum = buildTelcellCallbackChecksum({
      secretKey,
      invoice,
      issuerId,
      paymentId,
      currency,
      sum,
      time,
      status,
    });

    if (checksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
      telcellCallbackLog('checksum_mismatch', {
        invoice,
        issuer_id: issuerId,
        status,
      });
      console.error('[Telcell Callback] Invalid checksum');
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const orderId = parseOrderId(issuerId);
    if (!orderId) {
      telcellCallbackLog('invalid_issuer_id', { issuer_id: issuerId });
      console.error('[Telcell Callback] Invalid issuer_id payload');
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        tickets: {
          include: {
            payment: true,
          },
        },
      },
    });

    if (!order) {
      telcellCallbackLog('order_not_found', { orderId });
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    if (status === 'PAID') {
      telcellCallbackLog('status_paid', {
        orderId,
        ticketCount: order.tickets.length,
        payment_id: paymentId,
        invoice,
      });
      for (const ticket of order.tickets) {
        await prisma.payment.upsert({
          where: { ticketId: ticket.id },
          update: {
            amount: ticket.price,
            method: 'card',
            status: 'completed',
            transactionId: paymentId || invoice,
          },
          create: {
            userId: order.userId,
            ticketId: ticket.id,
            amount: ticket.price,
            method: 'card',
            status: 'completed',
            transactionId: paymentId || invoice,
          },
        });

        if (ticket.status !== 'paid' && ticket.status !== 'used') {
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: { status: 'paid' },
          });
          await generateQRCode(ticket.id);
        } else if (!ticket.qrCode) {
          await generateQRCode(ticket.id);
        }
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'completed' },
      });

      revalidatePath('/tickets');
      revalidatePath('/payment');
    } else if (status === 'REJECTED') {
      telcellCallbackLog('status_rejected', {
        orderId,
        payment_id: paymentId,
        invoice,
      });
      await prisma.payment.updateMany({
        where: {
          ticketId: {
            in: order.tickets.map((ticket) => ticket.id),
          },
          status: {
            not: 'completed',
          },
        },
        data: {
          status: 'failed',
          transactionId: paymentId || invoice || null,
        },
      });
    } else {
      telcellCallbackLog('status_other', { orderId, status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Telcell Callback] Error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
