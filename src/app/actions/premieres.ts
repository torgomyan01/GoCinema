'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export interface CreatePremiereData {
  movieId: number;
  premiereDate: Date;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdatePremiereData extends Partial<CreatePremiereData> {
  id: number;
}

export async function getPremieres() {
  try {
    const premieres = await prisma.premiere.findMany({
      where: {
        isActive: true,
        premiereDate: {
          gte: new Date(), // Only future premieres
        },
      },
      include: {
        movie: true,
      },
      orderBy: { premiereDate: 'asc' },
    });

    return { success: true, premieres };
  } catch (error: any) {
    console.error('[Get Premieres] Error:', error);
    return {
      success: false,
      error: 'Պրեմիերաները բեռնելիս սխալ է տեղի ունեցել',
      premieres: [],
    };
  }
}

export async function getAllPremieres() {
  try {
    const premieres = await prisma.premiere.findMany({
      include: {
        movie: true,
      },
      orderBy: { premiereDate: 'desc' },
    });

    return { success: true, premieres };
  } catch (error: any) {
    console.error('[Get All Premieres] Error:', error);
    return {
      success: false,
      error: 'Պրեմիերաները բեռնելիս սխալ է տեղի ունեցել',
      premieres: [],
    };
  }
}

export async function getPremiereById(id: number) {
  try {
    const premiere = await prisma.premiere.findUnique({
      where: { id },
      include: {
        movie: true,
      },
    });

    if (!premiere) {
      return {
        success: false,
        error: 'Պրեմիերան չի գտնվել',
        premiere: null,
      };
    }

    return { success: true, premiere };
  } catch (error: any) {
    console.error('[Get Premiere By ID] Error:', error);
    return {
      success: false,
      error: 'Պրեմիերան բեռնելիս սխալ է տեղի ունեցել',
      premiere: null,
    };
  }
}

export async function createPremiere(data: CreatePremiereData) {
  try {
    // Check if movie exists
    const movie = await prisma.movie.findUnique({
      where: { id: data.movieId },
    });

    if (!movie) {
      return {
        success: false,
        error: 'Ֆիլմը չի գտնվել',
        premiere: null,
      };
    }

    const premiere = await prisma.premiere.create({
      data: {
        movieId: data.movieId,
        premiereDate: data.premiereDate,
        description: data.description || null,
        isActive: data.isActive ?? true,
      },
      include: {
        movie: true,
      },
    });

    revalidatePath('/movies/premiere');
    revalidatePath('/admin/premieres');

    return { success: true, premiere };
  } catch (error: any) {
    console.error('[Create Premiere] Error:', error);
    return {
      success: false,
      error: 'Պրեմիերան ստեղծելիս սխալ է տեղի ունեցել',
      premiere: null,
    };
  }
}

export async function updatePremiere(data: UpdatePremiereData) {
  try {
    const { id, ...updateData } = data;

    const premiere = await prisma.premiere.update({
      where: { id },
      data: updateData,
      include: {
        movie: true,
      },
    });

    revalidatePath('/movies/premiere');
    revalidatePath('/admin/premieres');

    return { success: true, premiere };
  } catch (error: any) {
    console.error('[Update Premiere] Error:', error);
    return {
      success: false,
      error: 'Պրեմիերան թարմացնելիս սխալ է տեղի ունեցել',
      premiere: null,
    };
  }
}

export async function deletePremiere(id: number) {
  try {
    await prisma.premiere.delete({
      where: { id },
    });

    revalidatePath('/movies/premiere');
    revalidatePath('/admin/premieres');

    return { success: true };
  } catch (error: any) {
    console.error('[Delete Premiere] Error:', error);
    return {
      success: false,
      error: 'Պրեմիերան ջնջելիս սխալ է տեղի ունեցել',
    };
  }
}
