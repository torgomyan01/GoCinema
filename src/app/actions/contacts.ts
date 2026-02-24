'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export interface CreateContactData {
  name: string;
  email?: string | null;
  phone?: string | null;
  subject: string;
  message: string;
  userId?: number | null;
}

export interface UpdateContactData {
  id: number;
  status?: 'new' | 'read' | 'replied' | 'archived';
}

export async function createContact(data: CreateContactData) {
  try {
    const contact = await prisma.contact.create({
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        subject: data.subject,
        message: data.message,
        userId: data.userId || null,
        status: 'new',
      },
    });

    revalidatePath('/admin/contacts');

    return { success: true, contact };
  } catch (error: any) {
    console.error('[Create Contact] Error:', error);
    return {
      success: false,
      error: 'Հաղորդագրությունը ուղարկելիս սխալ է տեղի ունեցել',
      contact: null,
    };
  }
}

export async function getAllContacts(status?: string) {
  try {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const contacts = await prisma.contact.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, contacts };
  } catch (error: any) {
    console.error('[Get All Contacts] Error:', error);
    return {
      success: false,
      error: 'Հաղորդագրությունները բեռնելիս սխալ է տեղի ունեցել',
      contacts: [],
    };
  }
}

export async function getContactById(id: number) {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!contact) {
      return {
        success: false,
        error: 'Հաղորդագրությունը չի գտնվել',
        contact: null,
      };
    }

    return { success: true, contact };
  } catch (error: any) {
    console.error('[Get Contact By ID] Error:', error);
    return {
      success: false,
      error: 'Հաղորդագրությունը բեռնելիս սխալ է տեղի ունեցել',
      contact: null,
    };
  }
}

export async function updateContactStatus(data: UpdateContactData) {
  try {
    const contact = await prisma.contact.update({
      where: { id: data.id },
      data: {
        status: data.status,
      },
    });

    revalidatePath('/admin/contacts');

    return { success: true, contact };
  } catch (error: any) {
    console.error('[Update Contact Status] Error:', error);
    return {
      success: false,
      error: 'Հաղորդագրության կարգավիճակը թարմացնելիս սխալ է տեղի ունեցել',
      contact: null,
    };
  }
}

export async function deleteContact(id: number) {
  try {
    await prisma.contact.delete({
      where: { id },
    });

    revalidatePath('/admin/contacts');

    return { success: true };
  } catch (error: any) {
    console.error('[Delete Contact] Error:', error);
    return {
      success: false,
      error: 'Հաղորդագրությունը ջնջելիս սխալ է տեղի ունեցել',
    };
  }
}
