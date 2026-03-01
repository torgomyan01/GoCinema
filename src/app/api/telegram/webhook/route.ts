import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    contact?: {
      phone_number: string;
      user_id?: number;
    };
  };
}

async function sendTelegramMessage(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();
    const message = update.message;

    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text?.trim() ?? '';

    // /start command — the user tapped Start in the bot
    if (text === '/start' || text.startsWith('/start')) {
      await sendTelegramMessage(
        chatId,
        `👋 Բարի գալուստ <b>GoCinema</b> բոտ!\n\nԱյս բոտը կօգնի ձեզ վերականգնել ձեր գաղտնաբառը:\n\n📱 Ուղարկեք ձեր հեռախոսահամարը հետևյալ ձևաչափով.\n<code>0XX XXX XXX</code>\n\nՕրինակ` + `\u003a <code>077 123 456</code>`,
      );
      return NextResponse.json({ ok: true });
    }

    // If the message looks like an Armenian phone number — try to link it
    const cleanedPhone = text.replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^0[0-9]{8}$/;

    if (phoneRegex.test(cleanedPhone)) {
      const user = await prisma.user.findUnique({
        where: { phone: cleanedPhone },
      });

      if (!user) {
        await sendTelegramMessage(
          chatId,
          `❌ <b>${text}</b> հեռախոսահամարով գրանցված հաշիվ չի գտնվել:\n\nՎստահեցե՛ք, որ ճիշտ համարն եք մուտքագրել:`,
        );
        return NextResponse.json({ ok: true });
      }

      // Save the chat_id to the user record
      await prisma.user.update({
        where: { id: user.id },
        data: { telegramChatId: String(chatId) },
      });

      await sendTelegramMessage(
        chatId,
        `✅ Ձեր Telegram հաշիվը հաջողությամբ կապվեց <b>${user.name ?? cleanedPhone}</b> հաշվի հետ:\n\nՀիմա կարող եք ավարտել գաղտնաբառի վերականգնումը կայքում:`,
      );

      return NextResponse.json({ ok: true });
    }

    // Unknown message
    await sendTelegramMessage(
      chatId,
      `ℹ️ Ուղարկե՛ք ձեր հեռախոսահամարը` + ` (օրինակ` + `\u003a <code>077 123 456</code>) գաղտնաբառի վերականգնման համար:`,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Telegram Webhook] Error:', error);
    return NextResponse.json({ ok: true }); // always return 200 to Telegram
  }
}
