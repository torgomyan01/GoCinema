'use server';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { validateBirthDate } from '@/lib/birth-date';

export async function registerUser(formData: {
  name: string;
  password: string;
  phone: string;
  birthDate: string;
}) {
  try {
    const { name, password, phone, birthDate } = formData;

    // Validation
    if (!name || !phone || !password || !birthDate) {
      return {
        error: 'Անուն, հեռախոսահամար, ծննդյան ամսաթիվ և գաղտնաբառը պարտադիր են',
        success: false,
      };
    }

    if (password.length < 6) {
      return {
        error: 'Password-ը պետք է լինի առնվազն 6 նիշ',
        success: false,
      };
    }

    const birth = validateBirthDate(birthDate);
    if (!birth.ok) {
      return {
        error: birth.error,
        success: false,
      };
    }

    // Phone validation - Armenian format: 0XX XXX XXX (9 digits total, starting with 0)
    const cleanPhone = phone.replace(/\s/g, '');
    const phoneRegex = /^0[0-9]{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return {
        error: 'Մուտքագրեք վավեր հեռախոսահամար (օրինակ: 0XX XXX XXX)',
        success: false,
      };
    }

    // Check if user already exists by phone
    const existingUser = await prisma.user.findUnique({
      where: { phone: cleanPhone },
    });

    if (existingUser) {
      return {
        error: 'Այս հեռախոսահամարով օգտատեր արդեն գոյություն ունի',
        success: false,
      };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        phone: cleanPhone,
        password: hashedPassword,
        birthDate: birth.date,
        email: null,
        role: 'user',
        phoneVerified: false,
        emailVerified: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        birthDate: true,
        role: true,
        phoneVerified: true,
        emailVerified: true,
      },
    });

    return {
      message: 'Գրանցումը հաջողությամբ ավարտվեց',
      user,
      success: true,
    };
  } catch (error: any) {
    console.error('[Register Action] Error:', error);

    // Handle Prisma unique constraint error
    if (error.code === 'P2002') {
      return {
        error: 'Այս հեռախոսահամարով օգտատեր արդեն գոյություն ունի',
        success: false,
      };
    }

    return {
      error: 'Սխալ է տեղի ունեցել',
      success: false,
    };
  }
}

/** Մուտք գործած օգտատերը ծննդյան ամսաթիվ ունի՞։ */
export async function getMyBirthDateStatus() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user
      ? Number((session.user as { id?: string | number }).id)
      : null;

    if (!userId || Number.isNaN(userId)) {
      return { success: true, needsBirthDate: false };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { birthDate: true },
    });

    if (!user) {
      return { success: true, needsBirthDate: false };
    }

    return {
      success: true,
      needsBirthDate: user.birthDate == null,
    };
  } catch (error) {
    console.error('[getMyBirthDateStatus] Error:', error);
    return { success: false, needsBirthDate: false, error: 'Սխալ է տեղի ունեցել' };
  }
}

/** Առկա օգտատիրոջ ծննդյան ամսաթվի լրացում (մոդալից)։ */
export async function updateMyBirthDate(birthDate: string) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user
      ? Number((session.user as { id?: string | number }).id)
      : null;

    if (!userId || Number.isNaN(userId)) {
      return { success: false, error: 'Անհրաժեշտ է մուտք գործել' };
    }

    const birth = validateBirthDate(birthDate);
    if (!birth.ok) {
      return { success: false, error: birth.error };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { birthDate: birth.date },
    });

    return { success: true, message: 'Ծննդյան ամսաթիվը պահպանվեց' };
  } catch (error) {
    console.error('[updateMyBirthDate] Error:', error);
    return { success: false, error: 'Սխալ է տեղի ունեցել' };
  }
}

export async function verifyCredentials(email: string, password: string) {
  try {
    if (!email || !password) {
      return {
        error: 'Email և password-ը պարտադիր են',
        success: false,
      };
    }

    // Verify credentials
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return {
        error: 'Սխալ email կամ password',
        success: false,
      };
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return {
        error: 'Սխալ email կամ password',
        success: false,
      };
    }

    return {
      message: 'Credentials verified',
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  } catch (error) {
    console.error('[Verify Credentials] Error:', error);
    return {
      error: 'Սխալ է տեղի ունեցել',
      success: false,
    };
  }
}
