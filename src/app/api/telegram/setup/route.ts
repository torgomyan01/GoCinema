import { NextResponse } from 'next/server';

/**
 * GET /api/telegram/setup
 * Registers the Telegram webhook with Telegram's servers.
 * Call this once after deploy: https://gocinema.am/api/telegram/setup
 */
export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!token) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN is not set' }, { status: 500 });
  }
  if (!appUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL is not set' }, { status: 500 });
  }

  const webhookUrl = `${appUrl}/api/telegram/webhook`;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
      },
    );
    const data = await res.json();

    if (data.ok) {
      return NextResponse.json({
        success: true,
        message: `Webhook set to: ${webhookUrl}`,
        telegram: data,
      });
    }

    return NextResponse.json({ success: false, telegram: data }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
