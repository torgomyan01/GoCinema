import { prisma } from '@/lib/prisma';

export type NotificationType =
  | 'online_ticket'
  | 'online_product'
  | 'box_office'
  | 'cancellation'
  | 'support'
  | 'contact';

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

/**
 * Ստեղծում է ադմինի ծանուցում։
 * Երբեք չի throw անում — ծանուցման ձախողումը չպետք է կոտրի հիմնական հոսքը
 * (վճարում, պատվեր, չեղարկում և այլն)։
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link ?? null,
      },
    });
  } catch (error) {
    console.error('[Notification] create failed:', error);
  }
}

const AMD = '\u058F'; // ֏

export function formatAmd(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-US')} ${AMD}`;
}
