import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildTelcellCallbackChecksum, fromBase64 } from '@/lib/telcell';

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
      console.error('[Telcell Callback] Invalid checksum');
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const orderId = parseOrderId(issuerId);
    if (!orderId) {
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
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    if (status === 'PAID') {
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
          const qrCode = Buffer.from(
            JSON.stringify({
              ticketId: ticket.id,
              timestamp: Date.now(),
            })
          ).toString('base64');

          await prisma.ticket.update({
            where: { id: ticket.id },
            data: {
              status: 'paid',
              qrCode: ticket.qrCode || qrCode,
            },
          });
        }
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'completed' },
      });
    } else if (status === 'REJECTED') {
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
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Telcell Callback] Error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
