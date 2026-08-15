'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdminRole } from '@/lib/roles';

export interface InstagramStoryScreening {
  id: number;
  startTime: string;
  price: number;
}

export interface InstagramStoryMovie {
  id: number;
  title: string;
  slug: string | null;
  image: string | null;
  ageRating: string | null;
  genre: string;
  duration: number;
  description: string | null;
  screenings: InstagramStoryScreening[];
}

export interface SmmPremiere {
  id: number;
  premiereDate: string;
  description: string | null;
  movie: InstagramStoryMovie;
}

export async function getInstagramStoryMovies(): Promise<{
  success: boolean;
  error: string | null;
  movies: InstagramStoryMovie[];
}> {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !isAdminRole(user.role)) {
    return { success: false, error: 'Մուտքն արգելված է', movies: [] };
  }

  const from = new Date();
  from.setHours(0, 0, 0, 0);

  try {
    const movies = await prisma.movie.findMany({
      where: {
        isActive: true,
        screenings: { some: { startTime: { gte: from } } },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        image: true,
        ageRating: true,
        genre: true,
        duration: true,
        description: true,
        screenings: {
          where: { startTime: { gte: from } },
          select: { id: true, startTime: true, basePrice: true },
          orderBy: { startTime: 'asc' },
        },
      },
      orderBy: { title: 'asc' },
    });

    return {
      success: true,
      error: null,
      movies: movies
        .filter((movie) => movie.screenings.length > 0)
        .map((movie) => mapSmmMovie(movie)),
    };
  } catch (error) {
    console.error('[getInstagramStoryMovies]', error);
    return {
      success: false,
      error: 'Ֆիլմերը բեռնելիս սխալ է տեղի ունեցել',
      movies: [],
    };
  }
}

function mapSmmMovie(movie: {
  id: number;
  title: string;
  slug: string | null;
  image: string | null;
  ageRating: string | null;
  genre: string;
  duration: number;
  description: string | null;
  screenings: Array<{ id: number; startTime: Date; basePrice: unknown }>;
}): InstagramStoryMovie {
  return {
    id: movie.id,
    title: movie.title,
    slug: movie.slug,
    image: movie.image,
    ageRating: movie.ageRating,
    genre: movie.genre,
    duration: movie.duration,
    description: movie.description,
    screenings: movie.screenings.map((row) => ({
      id: row.id,
      startTime: row.startTime.toISOString(),
      price: Number(row.basePrice) || 0,
    })),
  };
}

export async function getSmmPremieres(): Promise<{
  success: boolean;
  error: string | null;
  premieres: SmmPremiere[];
}> {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !isAdminRole(user.role)) {
    return { success: false, error: 'Մուտքն արգելված է', premieres: [] };
  }

  const from = new Date();
  from.setHours(0, 0, 0, 0);

  try {
    const premieres = await prisma.premiere.findMany({
      where: {
        isActive: true,
        premiereDate: { gte: from },
      },
      select: {
        id: true,
        premiereDate: true,
        description: true,
        movie: {
          select: {
            id: true,
            title: true,
            slug: true,
            image: true,
            ageRating: true,
            genre: true,
            duration: true,
            description: true,
            isActive: true,
            screenings: {
              where: { startTime: { gte: from } },
              select: { id: true, startTime: true, basePrice: true },
              orderBy: { startTime: 'asc' },
            },
          },
        },
      },
      orderBy: { premiereDate: 'asc' },
    });

    return {
      success: true,
      error: null,
      premieres: premieres
        .filter((row) => row.movie.isActive)
        .map((row) => ({
          id: row.id,
          premiereDate: row.premiereDate.toISOString(),
          description: row.description,
          movie: mapSmmMovie(row.movie),
        })),
    };
  } catch (error) {
    console.error('[getSmmPremieres]', error);
    return {
      success: false,
      error: 'Պրեմիերաները բեռնելիս սխալ է տեղի ունեցել',
      premieres: [],
    };
  }
}
