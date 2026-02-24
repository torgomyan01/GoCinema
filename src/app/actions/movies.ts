'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export interface CreateMovieData {
  title: string;
  slug?: string;
  image?: string | null;
  duration: number;
  rating: number;
  genre: string;
  releaseDate: Date | string;
  description?: string | null;
  trailerUrl?: string | null;
  isActive?: boolean;
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
              where: {
                status: {
                  in: ['reserved', 'paid', 'used'],
                },
              },
              select: {
                id: true,
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
              where: {
                status: {
                  in: ['reserved', 'paid', 'used'],
                },
              },
              select: {
                id: true,
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
    if (!data.title || !data.duration || !data.rating || !data.genre || !data.releaseDate) {
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

    const movie = await prisma.movie.create({
      data: {
        title: data.title,
        slug,
        image: data.image || null,
        duration: data.duration,
        rating: data.rating,
        genre: data.genre,
        releaseDate: new Date(data.releaseDate),
        description: data.description || null,
        trailerUrl: data.trailerUrl || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
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
    const { id, ...updateData } = data;

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

export async function deleteMovie(id: number) {
  try {
    await prisma.movie.delete({
      where: { id },
    });

    revalidatePath('/admin/movies');
    revalidatePath('/movies');

    return {
      success: true,
      message: 'Ֆիլմը հաջողությամբ ջնջվեց',
    };
  } catch (error: any) {
    console.error('[Delete Movie] Error:', error);
    return {
      success: false,
      error: 'Ֆիլմ ջնջելիս սխալ է տեղի ունեցել',
    };
  }
}
