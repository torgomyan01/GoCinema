'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export interface CreateFAQData {
  question: string;
  answer: string;
  order?: number;
  isActive?: boolean;
}

export interface UpdateFAQData extends Partial<CreateFAQData> {
  id: number;
}

export async function getFAQs() {
  try {
    const faqs = await prisma.fAQ.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });

    return { success: true, faqs };
  } catch (error: any) {
    console.error('[Get FAQs] Error:', error);
    return {
      success: false,
      error: 'Հաճախակի հարցերը բեռնելիս սխալ է տեղի ունեցել',
      faqs: [],
    };
  }
}

export async function getAllFAQs() {
  try {
    const faqs = await prisma.fAQ.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });

    return { success: true, faqs };
  } catch (error: any) {
    console.error('[Get All FAQs] Error:', error);
    return {
      success: false,
      error: 'Հաճախակի հարցերը բեռնելիս սխալ է տեղի ունեցել',
      faqs: [],
    };
  }
}

export async function getFAQById(id: number) {
  try {
    const faq = await prisma.fAQ.findUnique({
      where: { id },
    });

    if (!faq) {
      return {
        success: false,
        error: 'Հաճախակի հարցը չի գտնվել',
        faq: null,
      };
    }

    return { success: true, faq };
  } catch (error: any) {
    console.error('[Get FAQ By ID] Error:', error);
    return {
      success: false,
      error: 'Հաճախակի հարցը բեռնելիս սխալ է տեղի ունեցել',
      faq: null,
    };
  }
}

export async function createFAQ(data: CreateFAQData) {
  try {
    // Get max order value
    const maxOrder = await prisma.fAQ.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const order = data.order ?? (maxOrder?.order ?? 0) + 1;

    const faq = await prisma.fAQ.create({
      data: {
        question: data.question,
        answer: data.answer,
        order,
        isActive: data.isActive ?? true,
      },
    });

    revalidatePath('/faq');
    revalidatePath('/admin/faq');

    return { success: true, faq };
  } catch (error: any) {
    console.error('[Create FAQ] Error:', error);
    return {
      success: false,
      error: 'Հաճախակի հարցը ստեղծելիս սխալ է տեղի ունեցել',
      faq: null,
    };
  }
}

export async function updateFAQ(data: UpdateFAQData) {
  try {
    const { id, ...updateData } = data;

    const faq = await prisma.fAQ.update({
      where: { id },
      data: updateData,
    });

    revalidatePath('/faq');
    revalidatePath('/admin/faq');

    return { success: true, faq };
  } catch (error: any) {
    console.error('[Update FAQ] Error:', error);
    return {
      success: false,
      error: 'Հաճախակի հարցը թարմացնելիս սխալ է տեղի ունեցել',
      faq: null,
    };
  }
}

export async function deleteFAQ(id: number) {
  try {
    await prisma.fAQ.delete({
      where: { id },
    });

    revalidatePath('/faq');
    revalidatePath('/admin/faq');

    return { success: true };
  } catch (error: any) {
    console.error('[Delete FAQ] Error:', error);
    return {
      success: false,
      error: 'Հաճախակի հարցը ջնջելիս սխալ է տեղի ունեցել',
    };
  }
}
