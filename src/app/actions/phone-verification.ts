'use server';

import { prisma } from '@/lib/prisma';
import { sendVerificationSms } from '@/lib/sms';

const OTP_EXPIRY_MINUTES = 10;
const MAX_SEND_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isValidArmenianPhone(phone: string): boolean {
  return /^0[0-9]{8}$/.test(phone);
}

/**
 * Ուղարկում է գրանցման SMS վերիֆիկացիայի կոդը։
 */
export async function sendRegistrationOtp(phone: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const cleanPhone = phone.replace(/\s/g, '');
    if (!isValidArmenianPhone(cleanPhone)) {
      return { success: false, error: 'Մուտքագրեք վավեր հեռախոսահամար' };
    }

    const user = await prisma.user.findUnique({
      where: { phone: cleanPhone },
      select: { id: true, phoneVerified: true },
    });

    if (!user) {
      return { success: false, error: 'Օգտատերը չի գտնվել' };
    }
    if (user.phoneVerified) {
      return { success: true };
    }

    // Rate limiting՝ ժամում առավելագույնը 5 կոդ
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.phoneVerification.count({
      where: {
        phone: cleanPhone,
        purpose: 'register',
        createdAt: { gte: hourAgo },
      },
    });
    if (recentCount >= MAX_SEND_PER_HOUR) {
      return {
        success: false,
        error: 'Չափազանց շատ փորձ: Խնդրում ենք 1 ժամ հետո կրկին փորձել:',
      };
    }

    // Չեղարկել հին կոդերը
    await prisma.phoneVerification.updateMany({
      where: { phone: cleanPhone, purpose: 'register', used: false },
      data: { used: true },
    });

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.phoneVerification.create({
      data: {
        phone: cleanPhone,
        code,
        purpose: 'register',
        expiresAt,
      },
    });

    const sent = await sendVerificationSms(cleanPhone, code, 'verification');
    if (!sent.success) {
      return {
        success: false,
        error: sent.error || 'SMS ուղարկելը ձախողվեց: Փորձեք կրկին:',
      };
    }

    return { success: true };
  } catch (err) {
    console.error('[sendRegistrationOtp] Error:', err);
    return { success: false, error: 'Սխալ է տեղի ունեցել: Փորձեք կրկին:' };
  }
}

/**
 * Ստուգում է գրանցման SMS կոդը և վերիֆիկացնում օգտատիրոջ հեռախոսը։
 */
export async function verifyRegistrationOtp(
  phone: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanPhone = phone.replace(/\s/g, '');
    const cleanCode = code.trim();

    const user = await prisma.user.findUnique({
      where: { phone: cleanPhone },
      select: { id: true, phoneVerified: true },
    });

    if (!user) {
      return { success: false, error: 'Օգտատերը չի գտնվել' };
    }
    if (user.phoneVerified) {
      return { success: true };
    }

    const record = await prisma.phoneVerification.findFirst({
      where: {
        phone: cleanPhone,
        purpose: 'register',
        used: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return { success: false, error: 'Կոդը սխալ է կամ ժամկետանց' };
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      return {
        success: false,
        error: 'Չափազանց շատ փորձ: Խնդրեք նոր կոդ:',
      };
    }

    if (record.code !== cleanCode) {
      await prisma.phoneVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      return { success: false, error: 'Սխալ կոդ' };
    }

    await prisma.$transaction([
      prisma.phoneVerification.update({
        where: { id: record.id },
        data: { used: true },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { phoneVerified: true },
      }),
    ]);

    return { success: true };
  } catch (err) {
    console.error('[verifyRegistrationOtp] Error:', err);
    return { success: false, error: 'Սխալ է տեղի ունեցել' };
  }
}
