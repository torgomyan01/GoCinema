'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdminRole } from '@/lib/roles';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !isAdminRole(user.role)) {
    return null;
  }
  return user;
}

export async function getNotifications(limit = 30) {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է', notifications: [], unreadCount: 0 };
  }

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({ where: { isRead: false } }),
    ]);

    return { success: true, notifications, unreadCount };
  } catch (error) {
    console.error('[Get Notifications] Error:', error);
    return {
      success: false,
      error: 'Ծանուցումները բեռնելիս սխալ է տեղի ունեցել',
      notifications: [],
      unreadCount: 0,
    };
  }
}

/** Թեթև հարցում՝ polling-ի համար (միայն չկարդացածների քանակ + վերջին ID) */
export async function getNotificationsSummary() {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, unreadCount: 0, latestId: 0 };
  }

  try {
    const [unreadCount, latest] = await Promise.all([
      prisma.notification.count({ where: { isRead: false } }),
      prisma.notification.findFirst({
        orderBy: { id: 'desc' },
        select: { id: true },
      }),
    ]);

    return { success: true, unreadCount, latestId: latest?.id ?? 0 };
  } catch (error) {
    console.error('[Notifications Summary] Error:', error);
    return { success: false, unreadCount: 0, latestId: 0 };
  }
}

export async function markNotificationRead(id: number) {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    revalidatePath('/admin/notifications');
    return { success: true };
  } catch (error) {
    console.error('[Mark Notification Read] Error:', error);
    return { success: false, error: 'Սխալ է տեղի ունեցել' };
  }
}

export async function markAllNotificationsRead() {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    await prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
    revalidatePath('/admin/notifications');
    return { success: true };
  } catch (error) {
    console.error('[Mark All Notifications Read] Error:', error);
    return { success: false, error: 'Սխալ է տեղի ունեցել' };
  }
}

export async function deleteNotification(id: number) {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    await prisma.notification.delete({ where: { id } });
    revalidatePath('/admin/notifications');
    return { success: true };
  } catch (error) {
    console.error('[Delete Notification] Error:', error);
    return { success: false, error: 'Սխալ է տեղի ունեցել' };
  }
}

export async function clearAllNotifications() {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    await prisma.notification.deleteMany({});
    revalidatePath('/admin/notifications');
    return { success: true };
  } catch (error) {
    console.error('[Clear All Notifications] Error:', error);
    return { success: false, error: 'Սխալ է տեղի ունեցել' };
  }
}
