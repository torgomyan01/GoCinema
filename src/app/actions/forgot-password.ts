'use server';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS_PER_HOUR = 5;

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendTelegramOtp(chatId: string, otp: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('[ForgotPassword] TELEGRAM_BOT_TOKEN is not set');
    return false;
  }

  const text =
    `🔐 <b>GoCinema</b> — Գաղտնաբառի վերականգնում\n\n` +
    `Ձեր վերականգնման կոդն է` + `\u003a\n\n` +
    `<code>${otp}</code>\n\n` +
    `⏰ Կոդը վավեր է <b>${OTP_EXPIRY_MINUTES} րոպե</b>:\n` +
    `⚠️ Մի կիսվեք այս կոդով ոչ ոքի հետ:`;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      },
    );
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.error('[ForgotPassword] Telegram send error:', err);
    return false;
  }
}

// ─── Step 1: User enters phone ───────────────────────────────────────────────
export async function requestPasswordReset(phone: string): Promise<{
  success: boolean;
  error?: string;
  hasTelegram?: boolean;
  telegramBotUsername?: string;
}> {
  try {
    const cleanPhone = phone.replace(/\s/g, '');
    const phoneRegex = /^0[0-9]{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return { success: false, error: 'Մուտքագրեք վավեր հեռախոսահամար' };
    }

    const user = await prisma.user.findUnique({
      where: { phone: cleanPhone },
      select: { id: true, telegramChatId: true },
    });

    if (!user) {
      // Return success anyway to not leak user existence
      return { success: true, hasTelegram: false };
    }

    // Rate limiting: max 5 requests per hour
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.passwordResetToken.count({
      where: { userId: user.id, createdAt: { gte: hourAgo } },
    });
    if (recentCount >= MAX_ATTEMPTS_PER_HOUR) {
      return {
        success: false,
        error: 'Չափազանց շատ փորձ: Խնդրում ենք 1 ժամ հետո կրկին փորձել:',
      };
    }

    if (!user.telegramChatId) {
      // User has not started the bot yet
      return {
        success: true,
        hasTelegram: false,
        telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME ?? '',
      };
    }

    // Invalidate old tokens
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    // Create new OTP
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token: otp, expiresAt },
    });

    const sent = await sendTelegramOtp(user.telegramChatId, otp);
    if (!sent) {
      return {
        success: false,
        error: 'Telegram-ի միջոցով կոդ ուղարկելը ձախողվեց: Փորձեք կրկին:',
      };
    }

    return { success: true, hasTelegram: true };
  } catch (err) {
    console.error('[requestPasswordReset] Error:', err);
    return { success: false, error: 'Սխալ է տեղի ունեցել: Փորձեք կրկին:' };
  }
}

// ─── Step 1b: Poll whether user started the bot ──────────────────────────────
export async function checkTelegramLinked(phone: string): Promise<{
  linked: boolean;
}> {
  try {
    const cleanPhone = phone.replace(/\s/g, '');
    const user = await prisma.user.findUnique({
      where: { phone: cleanPhone },
      select: { telegramChatId: true },
    });
    return { linked: !!user?.telegramChatId };
  } catch {
    return { linked: false };
  }
}

// ─── Step 2: User enters OTP ─────────────────────────────────────────────────
export async function verifyResetOtp(
  phone: string,
  otp: string,
): Promise<{ success: boolean; resetToken?: string; error?: string }> {
  try {
    const cleanPhone = phone.replace(/\s/g, '');

    const user = await prisma.user.findUnique({
      where: { phone: cleanPhone },
      select: { id: true },
    });

    if (!user) {
      return { success: false, error: 'Օգտատերը չի գտնվել' };
    }

    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        token: otp.trim(),
        used: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!tokenRecord) {
      return { success: false, error: 'Սխալ կամ ժամկետանց կոդ' };
    }

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: { used: true },
    });

    // Issue a short-lived signed reset token (we encode userId + expiry as a simple signed string)
    // We reuse the OTP id + userId as the "reset session" — store a fresh one-time token
    const resetSessionToken = generateOtp() + generateOtp(); // 12 chars, one-time
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetSessionToken,
        expiresAt,
      },
    });

    return { success: true, resetToken: resetSessionToken };
  } catch (err) {
    console.error('[verifyResetOtp] Error:', err);
    return { success: false, error: 'Սխալ է տեղի ունեցել' };
  }
}

// ─── Step 3: Set new password ────────────────────────────────────────────────
export async function resetPassword(
  resetToken: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!newPassword || newPassword.length < 6) {
      return {
        success: false,
        error: 'Գաղտնաբառը պետք է լինի առնվազն 6 նիշ',
      };
    }

    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: {
        token: resetToken,
        used: false,
        expiresAt: { gte: new Date() },
      },
    });

    if (!tokenRecord) {
      return { success: false, error: 'Վերականգնման նիստը ժամկետանց է' };
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: tokenRecord.userId },
      data: { password: hashed },
    });

    // Invalidate the reset token
    await prisma.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: { used: true },
    });

    return { success: true };
  } catch (err) {
    console.error('[resetPassword] Error:', err);
    return { success: false, error: 'Սխալ է տեղի ունեցել' };
  }
}
