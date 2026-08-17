'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { occupiedTicketWhere } from '@/lib/reservation';

export interface CreateMovieData {
  title: string;
  slug?: string;
  image?: string | null;
  duration: number;
  rating?: number;
  ageRating?: string | null;
  genre: string;
  releaseDate: Date | string;
  description?: string | null;
  trailerUrl?: string | null;
  contractUrl?: string | null;
  contractName?: string | null;
  isActive?: boolean;
  producerIds?: number[];
  companyIds?: number[];
}

export interface UpdateMovieData extends Partial<CreateMovieData> {
  id: number;
}

export async function getMovies() {
  try {
    const movies = await prisma.movie.findMany({
      orderBy: {
        releaseDate: 'desc',
      },
      include: {
        producers: {
          select: { id: true, name: true, phone: true },
        },
        companies: {
          select: { id: true, name: true, tin: true },
        },
      },
    });
    return { success: true, movies };
  } catch (error: any) {
    console.error('[Get Movies] Error:', error);
    return {
      success: false,
      error: 'Ֆիլմերը բեռնելիս սխալ է տեղի ունեցել',
      movies: [],
    };
  }
}

/** Գործընկեր ընկերություններ՝ ֆիլմին կցելու համար */
export async function getMovieCompanies() {
  try {
    const companies = await prisma.company.findMany({
      select: { id: true, name: true, tin: true, isActive: true },
      orderBy: { name: 'asc' },
    });
    return { success: true, companies };
  } catch (error: any) {
    console.error('[Get Movie Companies] Error:', error);
    return {
      success: false,
      error: 'Ընկերությունները բեռնելիս սխալ է տեղի ունեցել',
      companies: [],
    };
  }
}
export async function getProducerUsers() {
  try {
    const users = await prisma.user.findMany({
      where: { role: { contains: 'producer' } },
      select: { id: true, name: true, phone: true, email: true },
      orderBy: { name: 'asc' },
    });
    return { success: true, users };
  } catch (error: any) {
    console.error('[Get Producer Users] Error:', error);
    return {
      success: false,
      error: 'Ֆիլմարտադրողներին բեռնելիս սխալ է տեղի ունեցել',
      users: [],
    };
  }
}

export async function getMovieById(id: number) {
  try {
    const movie = await prisma.movie.findUnique({
      where: { id },
      include: {
        screenings: {
          where: {
            startTime: {
              gte: new Date(), // Only upcoming screenings
            },
          },
          include: {
            hall: {
              select: {
                id: true,
                name: true,
                capacity: true,
              },
            },
            tickets: {
              where: occupiedTicketWhere(),
              select: {
                id: true,
                status: true,
                holdUntil: true,
              },
            },
          },
          orderBy: {
            startTime: 'asc',
          },
        },
      },
    });
    if (!movie) {
      return {
        success: false,
        error: 'Ֆիլմը չի գտնվել',
      };
    }
    return { success: true, movie };
  } catch (error: any) {
    console.error('[Get Movie] Error:', error);
    return {
      success: false,
      error: 'Ֆիլմը բեռնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function getMovieBySlug(slug: string) {
  try {
    const movie = await prisma.movie.findUnique({
      where: { slug },
      include: {
        screenings: {
          where: {
            startTime: {
              gte: new Date(), // Only upcoming screenings
            },
          },
          include: {
            hall: {
              select: {
                id: true,
                name: true,
                capacity: true,
              },
            },
            tickets: {
              where: occupiedTicketWhere(),
              select: {
                id: true,
                status: true,
                holdUntil: true,
              },
            },
          },
          orderBy: {
            startTime: 'asc',
          },
        },
      },
    });
    if (!movie) {
      return {
        success: false,
        error: 'Ֆիլմը չի գտնվել',
      };
    }
    return { success: true, movie };
  } catch (error: any) {
    console.error('[Get Movie By Slug] Error:', error);
    return {
      success: false,
      error: 'Ֆիլմը բեռնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function createMovie(data: CreateMovieData) {
  try {
    // Validation
    if (!data.title || !data.duration || !data.genre || !data.releaseDate) {
      return {
        success: false,
        error: 'Բոլոր պարտադիր դաշտերը պետք է լրացված լինեն',
      };
    }

    // Generate slug if not provided
    const slug =
      data.slug ||
      data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    // Check if slug already exists
    const existingMovie = await prisma.movie.findFirst({
      where: { slug },
    });

    if (existingMovie) {
      return {
        success: false,
        error: 'Այս slug-ով ֆիլմ արդեն գոյություն ունի',
      };
    }

    const producerIds = (data.producerIds ?? []).filter((id) => id > 0);
    const companyIds = (data.companyIds ?? []).filter((id) => id > 0);
    const movie = await prisma.movie.create({
      data: {
        title: data.title,
        slug,
        image: data.image || null,
        duration: data.duration,
        rating: data.rating ?? 0,
        ageRating: data.ageRating || null,
        genre: data.genre,
        releaseDate: new Date(data.releaseDate),
        description: data.description || null,
        trailerUrl: data.trailerUrl || null,
        contractUrl: data.contractUrl || null,
        contractName: data.contractName || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        ...(producerIds.length > 0 && {
          producers: { connect: producerIds.map((id) => ({ id })) },
        }),
        ...(companyIds.length > 0 && {
          companies: { connect: companyIds.map((id) => ({ id })) },
        }),
      },
      include: {
        producers: { select: { id: true, name: true, phone: true } },
        companies: { select: { id: true, name: true, tin: true } },
      },
    });

    revalidatePath('/admin/movies');
    revalidatePath('/movies');

    return {
      success: true,
      movie,
      message: 'Ֆիլմը հաջողությամբ ավելացվեց',
    };
  } catch (error: any) {
    console.error('[Create Movie] Error:', error);
    return {
      success: false,
      error: 'Ֆիլմ ավելացնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function updateMovie(data: UpdateMovieData) {
  try {
    const { id, producerIds, companyIds, ...updateData } = data;

    // Validation
    if (!id) {
      return {
        success: false,
        error: 'Ֆիլմի ID-ն պարտադիր է',
      };
    }

    // Generate slug if title is being updated
    if (updateData.title && !updateData.slug) {
      updateData.slug = updateData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Check if slug already exists (excluding current movie)
    if (updateData.slug) {
      const existingMovie = await prisma.movie.findFirst({
        where: {
          slug: updateData.slug,
          NOT: { id },
        },
      });

      if (existingMovie) {
        return {
          success: false,
          error: 'Այս slug-ով ֆիլմ արդեն գոյություն ունի',
        };
      }
    }

    const movie = await prisma.movie.update({
      where: { id },
      data: {
        ...updateData,
        releaseDate: updateData.releaseDate
          ? new Date(updateData.releaseDate)
          : undefined,
        // producerIds=undefined → կապը չենք փոխում; [] → ջնջում ենք բոլորը
        ...(producerIds !== undefined && {
          producers: {
            set: producerIds
              .filter((pid) => pid > 0)
              .map((pid) => ({ id: pid })),
          },
        }),
        ...(companyIds !== undefined && {
          companies: {
            set: companyIds
              .filter((cid) => cid > 0)
              .map((cid) => ({ id: cid })),
          },
        }),
      },
      include: {
        producers: { select: { id: true, name: true, phone: true } },
        companies: { select: { id: true, name: true, tin: true } },
      },
    });

    revalidatePath('/admin/movies');
    revalidatePath('/movies');

    return {
      success: true,
      movie,
      message: 'Ֆիլմը հաջողությամբ թարմացվեց',
    };
  } catch (error: any) {
    console.error('[Update Movie] Error:', error);
    return {
      success: false,
      error: 'Ֆիլմ թարմացնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function archiveMovie(id: number) {
  try {
    const movie = await prisma.movie.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!movie) {
      return { success: false, error: 'Ֆիլմը չի գտնվել' };
    }

    if (movie.isActive === false) {
      return { success: true, message: 'Ֆիլմն արդեն արխիվացված է' };
    }

    await prisma.movie.update({
      where: { id },
      data: { isActive: false },
    });

    revalidatePath('/admin/movies');
    revalidatePath('/movies');
    revalidatePath('/schedule');
    revalidatePath('/admin/payments');

    return {
      success: true,
      message: 'Ֆիլմը արխիվացվեց — այլևս չի երևա կայքում',
    };
  } catch (error: any) {
    console.error('[Archive Movie] Error:', error);
    return {
      success: false,
      error: 'Ֆիլմ արխիվացնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function restoreMovie(id: number) {
  try {
    const movie = await prisma.movie.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!movie) {
      return { success: false, error: 'Ֆիլմը չի գտնվել' };
    }

    await prisma.movie.update({
      where: { id },
      data: { isActive: true },
    });

    revalidatePath('/admin/movies');
    revalidatePath('/movies');
    revalidatePath('/schedule');

    return {
      success: true,
      message: 'Ֆիլմը վերականգնվեց — կրկին երևում է կայքում',
    };
  } catch (error: any) {
    console.error('[Restore Movie] Error:', error);
    return {
      success: false,
      error: 'Ֆիլմ վերականգնելիս սխալ է տեղի ունեցել',
    };
  }
}

/** @deprecated Օգտագործեք archiveMovie — ֆիլմերը չեն ջնջվում, միայն արխիվացվում */
export async function deleteMovie(id: number) {
  return archiveMovie(id);
}
