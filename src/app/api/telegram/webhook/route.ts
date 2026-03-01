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
        select: { id: true, name: true, telegramChatId: true },
      });

      if (!user) {
        await sendTelegramMessage(
          chatId,
          `❌ <b>${text}</b> հեռախոսահամարով գրանցված հաշիվ չի գտնվել:\n\nՎստահեցե՛ք, որ ճիշտ համարն եք մուտքագրել:`,
        );
        return NextResponse.json({ ok: true });
      }

      const wasAlreadyLinked = !!user.telegramChatId;

      // Save the chat_id and mark phone as verified
      await prisma.user.update({
        where: { id: user.id },
        data: {
          telegramChatId: String(chatId),
          phoneVerified: true,
        },
      });

      if (wasAlreadyLinked) {
        // Returning user — likely doing password reset
        await sendTelegramMessage(
          chatId,
          `✅ Ձեր Telegram հաշիվը կապված է <b>${user.name ?? cleanedPhone}</b> հաշվի հետ:\n\nՀիմա կարող եք ավարտել գաղտնաբառի վերականգնումը կայքում:`,
        );
      } else {
        // First time linking — registration flow
        await sendTelegramMessage(
          chatId,
          `🎉 Բարի գալուստ <b>GoCinema</b>-ում, <b>${user.name ?? cleanedPhone}</b>:\n\n` +
          `✅ Ձեր հաշիվը հաջողությամբ վերիֆիկացված է:\n\n` +
          `🎬 Այստեղ կստանաք.\n` +
          `• Գաղտնաբառի վերականգնման կոդեր\n` +
          `• Պրեմիերաների ծանուցումներ\n` +
          `• Հատուկ առաջարկներ\n\n` +
          `Հիմա կարող եք վերադառնալ կայք և ավարտել գրանցումը:`,
        );
      }

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
