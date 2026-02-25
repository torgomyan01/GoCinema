'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';

export interface UpdateUserData {
  id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: 'user' | 'admin';
  phoneVerified?: boolean;
  emailVerified?: boolean;
}

export interface ChangePasswordData {
  id: number;
  newPassword: string;
}

export async function getAllUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        phoneVerified: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            tickets: true,
            orders: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, users };
  } catch (error: any) {
    console.error('[Get All Users] Error:', error);
    return {
      success: false,
      error: 'Օգտատերերը բեռնելիս սխալ է տեղի ունեցել',
      users: [],
    };
  }
}

export async function getUserById(id: number) {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        phoneVerified: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            tickets: true,
            orders: true,
            payments: true,
          },
        },
      },
    });

    if (!user) {
      return {
        success: false,
        error: 'Օգտատերը չի գտնվել',
        user: null,
      };
    }

    return { success: true, user };
  } catch (error: any) {
    console.error('[Get User By ID] Error:', error);
    return {
      success: false,
      error: 'Օգտատերը բեռնելիս սխալ է տեղի ունեցել',
      user: null,
    };
  }
}

export async function updateUser(data: UpdateUserData) {
  try {
    const { id, name, email, phone, role, phoneVerified, emailVerified } = data;

    // Build a Prisma-compatible update object (no null for optional string fields)
    const updateData: {
      name?: string | null;
      email?: string;
      phone?: string;
      role?: 'user' | 'admin';
      phoneVerified?: boolean;
      emailVerified?: boolean;
    } = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined && email !== null) updateData.email = email;
    if (phone !== undefined && phone !== null) updateData.phone = phone;
    if (role !== undefined) updateData.role = role;
    if (phoneVerified !== undefined) updateData.phoneVerified = phoneVerified;
    if (emailVerified !== undefined) updateData.emailVerified = emailVerified;

    // Phone validation if provided
    if (updateData.phone) {
      const cleanPhone = updateData.phone.replace(/\s/g, '');
      const phoneRegex = /^0[0-9]{8}$/;
      if (!phoneRegex.test(cleanPhone)) {
        return {
          success: false,
          error: 'Մուտքագրեք վավեր հեռախոսահամար (օրինակ: 0XX XXX XXX)',
          user: null,
        };
      }
      updateData.phone = cleanPhone;
    }

    // Check if phone already exists (excluding current user)
    if (updateData.phone) {
      const existingUser = await prisma.user.findFirst({
        where: {
          phone: updateData.phone,
          NOT: { id },
        },
      });

      if (existingUser) {
        return {
          success: false,
          error: 'Այս հեռախոսահամարով օգտատեր արդեն գոյություն ունի',
          user: null,
        };
      }
    }

    // Check if email already exists (excluding current user)
    if (updateData.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: updateData.email,
          NOT: { id },
        },
      });

      if (existingUser) {
        return {
          success: false,
          error: 'Այս էլեկտրոնային հասցեով օգտատեր արդեն գոյություն ունի',
          user: null,
        };
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        phoneVerified: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    revalidatePath('/admin/users');

    return { success: true, user };
  } catch (error: any) {
    console.error('[Update User] Error:', error);
    return {
      success: false,
      error: 'Օգտատերը թարմացնելիս սխալ է տեղի ունեցել',
      user: null,
    };
  }
}

export async function changeUserPassword(data: ChangePasswordData) {
  try {
    if (!data.newPassword || data.newPassword.length < 6) {
      return {
        success: false,
        error: 'Password-ը պետք է լինի առնվազն 6 նիշ',
      };
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 10);

    await prisma.user.update({
      where: { id: data.id },
      data: { password: hashedPassword },
    });

    revalidatePath('/admin/users');

    return { success: true };
  } catch (error: any) {
    console.error('[Change User Password] Error:', error);
    return {
      success: false,
      error: 'Password-ը փոխելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function deleteUser(id: number) {
  try {
    await prisma.user.delete({
      where: { id },
    });

    revalidatePath('/admin/users');

    return { success: true };
  } catch (error: any) {
    console.error('[Delete User] Error:', error);
    return {
      success: false,
      error: 'Օգտատերը ջնջելիս սխալ է տեղի ունեցել',
    };
  }
}
