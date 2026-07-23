'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { parseRoles, serializeRoles } from '@/lib/roles';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export interface UpdateUserData {
  id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string;
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
        isBlocked: true,
        blockedAt: true,
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
        isBlocked: true,
        blockedAt: true,
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
      role?: string;
      phoneVerified?: boolean;
      emailVerified?: boolean;
    } = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined && email !== null) updateData.email = email;
    if (phone !== undefined && phone !== null) updateData.phone = phone;
    if (role !== undefined) updateData.role = serializeRoles(parseRoles(role));
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

/** Արգելափակում/ապաարգելափակում է օգտատիրոջը անվճար ամրագրումից։ */
export async function setUserBlocked(id: number, blocked: boolean) {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        isBlocked: true,
      },
    });

    if (!user) {
      return { success: false, error: 'Օգտատերը չի գտնվել' };
    }

    await prisma.user.update({
      where: { id },
      data: {
        isBlocked: blocked,
        blockedAt: blocked ? new Date() : null,
      },
    });

    // Արգելափակելիս՝ հաղորդագրություն օգտատիրոջ աջակցության չատին
    if (blocked && !user.isBlocked) {
      await notifyUserReservationBlocked(user);
    }

    revalidatePath('/admin/users');
    revalidatePath('/admin/support');

    return { success: true };
  } catch (error: any) {
    console.error('[Set User Blocked] Error:', error);
    return {
      success: false,
      error: 'Օգտատիրոջ կարգավիճակը փոխելիս սխալ է տեղի ունեցել',
    };
  }
}

const RESERVATION_BLOCK_MESSAGE = [
  'Ձեր հաշիվը արգելափակվել է «Ամրագրել, վճարել մուտքի մոտ» հնարավորությունից։',
  '',
  'Պատճառը՝ դուք ամրագրել եք տոմսեր, որոնք պետք է վճարեիք դրամարկղում, սակայն չեք եկել։ Այդ իսկ պատճառով այլևս չեք կարող օգտվել այս հնարավորությունից։',
  '',
  'Դուք դեռ կարող եք գնել տոմսեր օնլայն վճարմամբ։ Եթե կարծում եք, որ սա սխալ է, պատասխանեք այս հաղորդագրությանը։',
].join('\n');

async function notifyUserReservationBlocked(user: {
  id: number;
  name: string | null;
  phone: string;
  email: string | null;
}) {
  try {
    const subject = 'Ամրագրման հնարավորության արգելափակում';
    let request = await prisma.supportRequest.findFirst({
      where: {
        userId: user.id,
        status: { notIn: ['archived'] },
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });

    if (!request) {
      request = await prisma.supportRequest.create({
        data: {
          name: user.name || user.phone || 'Օգտատեր',
          phone: user.phone,
          email: user.email,
          subject,
          message: RESERVATION_BLOCK_MESSAGE,
          userId: user.id,
          status: 'in_progress',
          adminNote: RESERVATION_BLOCK_MESSAGE,
        },
        select: { id: true },
      });
    } else {
      await prisma.supportRequest.update({
        where: { id: request.id },
        data: {
          status: 'in_progress',
          subject,
          message: RESERVATION_BLOCK_MESSAGE,
          adminNote: RESERVATION_BLOCK_MESSAGE,
        },
      });
    }

    await prisma.supportMessage.create({
      data: {
        requestId: request.id,
        senderType: 'staff',
        senderName: 'GoCinema',
        message: RESERVATION_BLOCK_MESSAGE,
      },
    });

    revalidatePath(`/admin/support/${request.id}`);
  } catch (error) {
    // Արգելափակումը չպետք է ձախողվի հաղորդագրության սխալի պատճառով
    console.error('[Notify User Reservation Blocked] Error:', error);
  }
}

/**
 * Վերադարձնում է «ամրագրել են, բայց չեն եկել» (no-show) օգտատերերին՝
 * ըստ չեղարկված դրամարկղ-ամրագրումների (noShow = true) քանակի։
 */
export async function getNoShowReport() {
  try {
    const grouped = await prisma.ticket.groupBy({
      by: ['userId'],
      where: { noShow: true },
      _count: { _all: true },
      _max: { updatedAt: true },
    });

    if (grouped.length === 0) {
      return { success: true, users: [] };
    }

    const userIds = grouped.map((g) => g.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        isBlocked: true,
        blockedAt: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));
    const report = grouped
      .map((g) => {
        const u = userMap.get(g.userId);
        if (!u) return null;
        return {
          ...u,
          noShowCount: g._count._all,
          lastNoShowAt: g._max.updatedAt,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.noShowCount - a.noShowCount);

    return { success: true, users: report };
  } catch (error: any) {
    console.error('[Get No-Show Report] Error:', error);
    return {
      success: false,
      error: 'No-show հաշվետվությունը բեռնելիս սխալ է տեղի ունեցել',
      users: [],
    };
  }
}

/** Մուտք գործած օգտատերը արգելափակված է անվճար ամրագրումից՞ */
export async function getMyReservationBlockStatus() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user
      ? Number((session.user as { id?: string | number }).id)
      : null;

    if (!userId || Number.isNaN(userId)) {
      return { success: true, isBlocked: false, blockedAt: null as string | null };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isBlocked: true, blockedAt: true },
    });

    if (!user || !user.isBlocked) {
      return { success: true, isBlocked: false, blockedAt: null as string | null };
    }

    return {
      success: true,
      isBlocked: true,
      blockedAt: user.blockedAt ? user.blockedAt.toISOString() : null,
    };
  } catch (error) {
    console.error('[getMyReservationBlockStatus] Error:', error);
    return {
      success: false,
      isBlocked: false,
      blockedAt: null as string | null,
      error: 'Սխալ է տեղի ունեցել',
    };
  }
}
