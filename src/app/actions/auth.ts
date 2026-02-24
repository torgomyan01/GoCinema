'use server';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';

export async function registerUser(formData: {
  name: string;
  password: string;
  phone: string;
}) {
  try {
    const { name, password, phone } = formData;

    // Validation
    if (!name || !phone || !password) {
      return {
        error: 'Անուն, հեռախոսահամար և password-ը պարտադիր են',
        success: false,
      };
    }

    if (password.length < 6) {
      return {
        error: 'Password-ը պետք է լինի առնվազն 6 նիշ',
        success: false,
      };
    }

    // Phone validation - Armenian format: 0XX XXX XXX (9 digits total, starting with 0)
    const cleanPhone = phone.replace(/\s/g, '');
    const phoneRegex = /^0[0-9]{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return {
        error: 'Մուտքագրեք վավեր հեռախոսահամար (օրինակ: 077 777 777)',
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
