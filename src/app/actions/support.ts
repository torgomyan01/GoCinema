'use server';

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { STAFF_ROLES, isStaffRole } from '@/lib/roles';

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
]);

type SupportStatus = 'new' | 'in_progress' | 'resolved' | 'archived';

function sanitizeFileName(name: string) {
  const ext = path.extname(name).slice(0, 12);
  const base = path
    .basename(name, ext)
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .slice(0, 60);
  return `${base || 'attachment'}${ext}`;
}

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '')
    .trim()
    .replace(/\/$/, '');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json();
    return data?.ok === true;
  } catch (error) {
    console.error('[Support Telegram] Send error:', error);
    return false;
  }
}

async function notifyStaffAboutSupportRequest(requestId: number, latestMessage?: string) {
  const request = await prisma.supportRequest.findUnique({
    where: { id: requestId },
    include: {
      attachments: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      user: {
        select: { id: true, name: true, phone: true },
      },
    },
  });

  if (!request) return;

  const staffUsers = await prisma.user.findMany({
    where: {
      telegramChatId: { not: null },
      OR: STAFF_ROLES.map((role) => ({
        role: { contains: role },
      })),
    },
    select: {
      id: true,
      role: true,
      telegramChatId: true,
    },
  });

  const appUrl = getAppUrl();
  const adminLink = appUrl
    ? `${appUrl}/admin/support/${request.id}`
    : `/admin/support/${request.id}`;
  const text =
    `🆘 <b>Աջակցության նոր հաղորդագրություն</b>\n\n` +
    `#${request.id} — <b>${escapeHtml(request.subject)}</b>\n` +
    `👤 ${escapeHtml(request.name)}\n` +
    `📞 <code>${escapeHtml(request.phone)}</code>\n` +
    `📎 Կցված ֆայլեր՝ ${request.attachments.length}\n\n` +
    `${escapeHtml((latestMessage || request.messages[0]?.message || request.message).slice(0, 220))}${
      (latestMessage || request.messages[0]?.message || request.message).length > 220 ? '…' : ''
    }\n\n` +
    `🔗 <a href="${adminLink}">Բացել ադմինում</a>`;

  await Promise.all(
    staffUsers
      .filter((user) => user.telegramChatId && isStaffRole(user.role))
      .map((user) => sendTelegramMessage(user.telegramChatId as string, text))
  );
}

async function saveAttachments(requestId: number, files: File[]) {
  if (files.length === 0) return;

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'support');
  await mkdir(uploadDir, { recursive: true });

  for (const file of files) {
    if (!file || file.size === 0) continue;
    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new Error('Ֆայլի չափը չի կարող գերազանցել 5MB');
    }
    if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
      throw new Error('Թույլատրվում են միայն նկարներ, PDF կամ text ֆայլեր');
    }

    const safeName = sanitizeFileName(file.name);
    const storedName = `${requestId}-${Date.now()}-${safeName}`;
    const bytes = await file.arrayBuffer();
    await writeFile(path.join(uploadDir, storedName), Buffer.from(bytes));

    await prisma.supportAttachment.create({
      data: {
        requestId,
        fileName: file.name || safeName,
        fileUrl: `/uploads/support/${storedName}`,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      },
    });
  }
}

async function findExistingSupportRequest(userId: number | null, phone: string) {
  if (userId) {
    const byUser = await prisma.supportRequest.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    if (byUser) return byUser;

    if (phone) {
      const guestChat = await prisma.supportRequest.findFirst({
        where: { phone, userId: null },
        orderBy: { updatedAt: 'desc' },
      });
      if (guestChat) {
        return prisma.supportRequest.update({
          where: { id: guestChat.id },
          data: { userId },
        });
      }
    }

    return null;
  }

  if (phone) {
    return prisma.supportRequest.findFirst({
      where: {
        phone,
        userId: null,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  return null;
}

async function appendCustomerMessage(
  requestId: number,
  senderName: string,
  message: string,
  files: File[]
) {
  const request = await prisma.supportRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new Error('Չատը չի գտնվել');
  }

  const chatMessage = await prisma.supportMessage.create({
    data: {
      requestId,
      senderType: 'customer',
      senderName,
      message,
    },
  });

  await saveAttachments(requestId, files.slice(0, 5));

  await prisma.supportRequest.update({
    where: { id: requestId },
    data: {
      message,
      status:
        request.status === 'resolved' || request.status === 'archived'
          ? 'new'
          : request.status,
    },
  });

  await notifyStaffAboutSupportRequest(requestId, message);

  return chatMessage;
}

/** Օգտատիրոջ միակ (կամ վերջին) աջակցության չատը */
export async function getMySupportRequest() {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string } | undefined;
    const userId = sessionUser?.id ? Number(sessionUser.id) : null;

    if (!userId) {
      return { success: true, request: null };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });

    let request = await prisma.supportRequest.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!request && user?.phone) {
      const guestChat = await prisma.supportRequest.findFirst({
        where: { phone: user.phone, userId: null },
        orderBy: { updatedAt: 'desc' },
      });

      if (guestChat) {
        request = await prisma.supportRequest.update({
          where: { id: guestChat.id },
          data: { userId },
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        });
      }
    }

    return { success: true, request };
  } catch (error) {
    console.error('[Get My Support Request] Error:', error);
    return {
      success: false,
      error: 'Աջակցության չատը բեռնելիս սխալ է տեղի ունեցել',
      request: null,
    };
  }
}

export async function createSupportRequest(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as any;
    const userId = sessionUser?.id ? Number(sessionUser.id) : null;

    let name = String(formData.get('name') || '').trim();
    let phone = String(formData.get('phone') || '').replace(/\s/g, '').trim();
    const subject = String(formData.get('subject') || '').trim();
    const message = String(formData.get('message') || '').trim();

    let email: string | null = null;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, phone: true, email: true },
      });
      name = user?.name || sessionUser?.name || user?.phone || 'Օգտատեր';
      phone = user?.phone || sessionUser?.phone || phone;
      email = user?.email || null;
    }

    if (!userId && (!name || !phone)) {
      return {
        success: false,
        error: 'Խնդրում ենք լրացնել անունը և հեռախոսահամարը',
      };
    }
    if (!message) {
      return {
        success: false,
        error: 'Խնդրում ենք գրել հաղորդագրությունը',
      };
    }
    if (!/^0[0-9]{8}$/.test(phone)) {
      return {
        success: false,
        error: 'Մուտքագրեք վավեր հեռախոսահամար (օր. 077123456)',
      };
    }

    const resolvedSubject = subject || 'Աջակցություն';
    const files = formData
      .getAll('attachments')
      .filter((item): item is File => item instanceof File && item.size > 0);

    const existing = await findExistingSupportRequest(userId, phone);
    if (existing) {
      await appendCustomerMessage(existing.id, name, message, files);

      revalidatePath('/admin/support');
      revalidatePath(`/admin/support/${existing.id}`);

      return {
        success: true,
        requestId: existing.id,
        reused: true,
      };
    }

    const request = await prisma.supportRequest.create({
      data: {
        name,
        phone,
        email,
        subject: resolvedSubject,
        message,
        userId,
        status: 'new',
      },
    });

    await prisma.supportMessage.create({
      data: {
        requestId: request.id,
        senderType: 'customer',
        senderName: name,
        message,
      },
    });

    await saveAttachments(request.id, files.slice(0, 5));
    await notifyStaffAboutSupportRequest(request.id, message);

    revalidatePath('/admin/support');

    return { success: true, requestId: request.id, reused: false };
  } catch (error: any) {
    console.error('[Create Support Request] Error:', error);
    return {
      success: false,
      error: error?.message || 'Հարցումը ուղարկելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function getAllSupportRequests(status?: string) {
  try {
    const requests = await prisma.supportRequest.findMany({
      where: status && status !== 'all' ? { status } : undefined,
      include: {
        user: {
          select: { id: true, name: true, phone: true, email: true },
        },
        attachments: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, requests };
  } catch (error) {
    console.error('[Get Support Requests] Error:', error);
    return {
      success: false,
      error: 'Աջակցության հարցումները բեռնելիս սխալ է տեղի ունեցել',
      requests: [],
    };
  }
}

export async function getSupportRequestById(id: number) {
  try {
    const request = await prisma.supportRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, phone: true, email: true },
        },
        attachments: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!request) {
      return { success: false, error: 'Հարցումը չի գտնվել', request: null };
    }

    return { success: true, request };
  } catch (error) {
    console.error('[Get Support Request] Error:', error);
    return {
      success: false,
      error: 'Հարցումը բեռնելիս սխալ է տեղի ունեցել',
      request: null,
    };
  }
}

/** Թեթև endpoint չատի incremental թարմացման համար */
export async function getSupportMessages(requestId: number, afterId = 0) {
  try {
    const messages = await prisma.supportMessage.findMany({
      where: {
        requestId,
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        senderType: true,
        senderName: true,
        message: true,
        createdAt: true,
      },
    });

    const request = await prisma.supportRequest.findUnique({
      where: { id: requestId },
      select: { status: true },
    });

    return {
      success: true,
      messages,
      status: request?.status ?? null,
    };
  } catch (error) {
    console.error('[Get Support Messages] Error:', error);
    return { success: false, messages: [], status: null };
  }
}

export async function addSupportMessage(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as any;
    const requestId = Number(formData.get('requestId'));
    const message = String(formData.get('message') || '').trim();

    if (!Number.isFinite(requestId) || !message) {
      return { success: false, error: 'Հաղորդագրությունը դատարկ է' };
    }

    const request = await prisma.supportRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) {
      return { success: false, error: 'Չատը չի գտնվել' };
    }

    if (sessionUser?.id) {
      const userId = Number(sessionUser.id);
      if (request.userId && request.userId !== userId) {
        return { success: false, error: 'Մուտքն արգելված է' };
      }
    }

    let senderName = request.name;
    if (sessionUser?.id) {
      const userId = Number(sessionUser.id);
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, phone: true },
      });
      senderName = user?.name || user?.phone || senderName;
    }

    const chatMessage = await prisma.supportMessage.create({
      data: {
        requestId,
        senderType: 'customer',
        senderName,
        message,
      },
    });

    const files = formData
      .getAll('attachments')
      .filter((item): item is File => item instanceof File && item.size > 0);
    await saveAttachments(requestId, files.slice(0, 5));

    await prisma.supportRequest.update({
      where: { id: requestId },
      data: {
        status: request.status === 'resolved' || request.status === 'archived' ? 'new' : request.status,
        message,
      },
    });

    await notifyStaffAboutSupportRequest(requestId, message);

    revalidatePath('/admin/support');
    revalidatePath(`/admin/support/${requestId}`);

    return { success: true, message: chatMessage };
  } catch (error: any) {
    console.error('[Add Support Message] Error:', error);
    return {
      success: false,
      error: error?.message || 'Հաղորդագրությունը ուղարկելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function addStaffSupportMessage(data: {
  requestId: number;
  message: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as any;
    if (!sessionUser?.id || !isStaffRole(sessionUser.role)) {
      return { success: false, error: 'Մուտքն արգելված է' };
    }

    const message = data.message.trim();
    if (!data.requestId || !message) {
      return { success: false, error: 'Հաղորդագրությունը դատարկ է' };
    }

    const chatMessage = await prisma.supportMessage.create({
      data: {
        requestId: data.requestId,
        senderType: 'staff',
        senderName: sessionUser.name || 'Աջակցություն',
        message,
      },
    });

    await prisma.supportRequest.update({
      where: { id: data.requestId },
      data: {
        status: 'in_progress',
        adminNote: message,
      },
    });

    revalidatePath('/admin/support');
    revalidatePath(`/admin/support/${data.requestId}`);

    return { success: true, message: chatMessage };
  } catch (error) {
    console.error('[Add Staff Support Message] Error:', error);
    return {
      success: false,
      error: 'Պատասխանը ուղարկելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function updateSupportRequest(data: {
  id: number;
  status?: SupportStatus;
  adminNote?: string | null;
}) {
  try {
    const request = await prisma.supportRequest.update({
      where: { id: data.id },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(typeof data.adminNote !== 'undefined'
          ? { adminNote: data.adminNote }
          : {}),
      },
    });

    revalidatePath('/admin/support');
    revalidatePath(`/admin/support/${data.id}`);

    return { success: true, request };
  } catch (error) {
    console.error('[Update Support Request] Error:', error);
    return {
      success: false,
      error: 'Հարցումը թարմացնելիս սխալ է տեղի ունեցել',
    };
  }
}

