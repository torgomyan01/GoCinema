'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { occupiedTicketWhere } from '@/lib/reservation';
import { releaseExpiredReservations } from '@/app/actions/tickets';

const screeningListInclude = {
  movie: {
    select: {
      id: true,
      title: true,
      slug: true,
      image: true,
      duration: true,
      rating: true,
      ageRating: true,
    },
  },
  hall: {
    select: {
      id: true,
      name: true,
      capacity: true,
    },
  },
  tickets: {
    select: {
      id: true,
      status: true,
    },
  },
} satisfies Prisma.ScreeningInclude;

export type ScreeningListItem = Prisma.ScreeningGetPayload<{
  include: typeof screeningListInclude;
}>;

export type GetScreeningsResult =
  | { success: true; screenings: ScreeningListItem[] }
  | { success: false; error: string; screenings: ScreeningListItem[] };

export interface CreateScreeningData {
  movieId: number;
  hallId?: number; // Optional - will be auto-set to default hall
  startTime: Date | string;
  endTime: Date | string;
  basePrice: number;
}

export interface UpdateScreeningData extends Partial<CreateScreeningData> {
  id: number;
}

// Helper function to get or create the default hall (we have only one hall)
async function getDefaultHall() {
  let hall = await prisma.hall.findFirst({
    orderBy: { id: 'asc' },
  });

  if (!hall) {
    // Create default hall if it doesn't exist
    hall = await prisma.hall.create({
      data: {
        name: 'Գլխավոր դահլիճ',
        capacity: 80,
      },
    });
  }

  return hall.id;
}

export async function getScreenings(
  startDate?: Date,
  endDate?: Date
): Promise<GetScreeningsResult> {
  try {
    const where: Prisma.ScreeningWhereInput = {};

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) {
        where.startTime.gte = startDate;
      }
      if (endDate) {
        where.startTime.lte = endDate;
      }
    }

    const screenings = await prisma.screening.findMany({
      where,
      include: screeningListInclude,
      orderBy: {
        startTime: 'asc',
      },
    });

    return { success: true, screenings };
  } catch (error: any) {
    console.error('[Get Screenings] Error:', error);
    return {
      success: false,
      error: 'Ցուցադրությունները բեռնելիս սխալ է տեղի ունեցել',
      screenings: [],
    };
  }
}

export async function getScreeningById(id: number) {
  try {
    // Legacy hook է. reserved տոմսերը ավտոմատ չեն ազատվում։
    await releaseExpiredReservations(id);

    const screening = await prisma.screening.findUnique({
      where: { id },
      include: {
        movie: true,
        hall: {
          include: {
            seats: {
              orderBy: [{ row: 'asc' }, { number: 'asc' }],
            },
          },
        },
        tickets: {
          where: occupiedTicketWhere(),
          include: {
            seat: {
              select: {
                id: true,
                row: true,
                number: true,
              },
            },
            order: {
              include: {
                orderItems: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!screening) {
      return {
        success: false,
        error: 'Ցուցադրությունը չի գտնվել',
      };
    }

    return { success: true, screening };
  } catch (error: any) {
    console.error('[Get Screening] Error:', error);
    return {
      success: false,
      error: 'Ցուցադրությունը բեռնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function createScreening(data: CreateScreeningData) {
  try {
    // Validation
    if (!data.movieId || !data.startTime || !data.endTime) {
      return {
        success: false,
        error: 'Բոլոր պարտադիր դաշտերը պետք է լրացված լինեն',
      };
    }

    // Auto-set hallId to default hall (we have only one hall)
    const hallId = data.hallId || (await getDefaultHall());

    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    if (endTime <= startTime) {
      return {
        success: false,
        error: 'Ավարտի ժամը պետք է լինի ավելի ուշ, քան սկզբի ժամը',
      };
    }

    // Check for overlapping screenings in the same hall
    const overlapping = await prisma.screening.findFirst({
      where: {
        hallId: hallId,
        OR: [
          {
            startTime: {
              lte: startTime,
            },
            endTime: {
              gte: startTime,
            },
          },
          {
            startTime: {
              lte: endTime,
            },
            endTime: {
              gte: endTime,
            },
          },
          {
            startTime: {
              gte: startTime,
            },
            endTime: {
              lte: endTime,
            },
          },
        ],
      },
    });

    if (overlapping) {
      return {
        success: false,
        error: 'Այս ժամանակահատվածում դահլիճը արդեն զբաղված է',
      };
    }

    const screening = await prisma.screening.create({
      data: {
        movieId: data.movieId,
        hallId: hallId,
        startTime,
        endTime,
        basePrice: data.basePrice || 2000,
      },
      include: {
        movie: {
          select: {
            id: true,
            title: true,
            image: true,
            duration: true,
          },
        },
        hall: {
          select: {
            id: true,
            name: true,
            capacity: true,
          },
        },
      },
    });

    revalidatePath('/admin/screenings');
    revalidatePath('/schedule');

    return {
      success: true,
      screening,
      message: 'Ցուցադրությունը հաջողությամբ ավելացվեց',
    };
  } catch (error: any) {
    console.error('[Create Screening] Error:', error);
    return {
      success: false,
      error: 'Ցուցադրություն ավելացնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function updateScreening(data: UpdateScreeningData) {
  try {
    const { id, ...updateData } = data;

    if (!id) {
      return {
        success: false,
        error: 'Ցուցադրության ID-ն պարտադիր է',
      };
    }

    // Auto-set hallId to default hall if not provided (we have only one hall)
    const hallId = updateData.hallId || (await getDefaultHall());

    // Check for overlapping screenings (excluding current one)
    if (updateData.startTime && updateData.endTime) {
      const startTime = new Date(updateData.startTime);
      const endTime = new Date(updateData.endTime);

      if (endTime <= startTime) {
        return {
          success: false,
          error: 'Ավարտի ժամը պետք է լինի ավելի ուշ, քան սկզբի ժամը',
        };
      }

      const overlapping = await prisma.screening.findFirst({
        where: {
          hallId: hallId,
          id: { not: id },
          OR: [
            {
              startTime: {
                lte: startTime,
              },
              endTime: {
                gte: startTime,
              },
            },
            {
              startTime: {
                lte: endTime,
              },
              endTime: {
                gte: endTime,
              },
            },
            {
              startTime: {
                gte: startTime,
              },
              endTime: {
                lte: endTime,
              },
            },
          ],
        },
      });

      if (overlapping) {
        return {
          success: false,
          error: 'Այս ժամանակահատվածում դահլիճը արդեն զբաղված է',
        };
      }
    }

    const screening = await prisma.screening.update({
      where: { id },
      data: {
        ...updateData,
        hallId: hallId, // Always use default hall
        startTime: updateData.startTime
          ? new Date(updateData.startTime)
          : undefined,
        endTime: updateData.endTime ? new Date(updateData.endTime) : undefined,
      },
      include: {
        movie: {
          select: {
            id: true,
            title: true,
            image: true,
            duration: true,
          },
        },
        hall: {
          select: {
            id: true,
            name: true,
            capacity: true,
          },
        },
      },
    });

    revalidatePath('/admin/screenings');
    revalidatePath('/schedule');

    return {
      success: true,
      screening,
      message: 'Ցուցադրությունը հաջողությամբ թարմացվեց',
    };
  } catch (error: any) {
    console.error('[Update Screening] Error:', error);
    return {
      success: false,
      error: 'Ցուցադրություն թարմացնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function deleteScreening(id: number) {
  try {
    // Check if there are any tickets for this screening
    const ticketsCount = await prisma.ticket.count({
      where: {
        screeningId: id,
        status: {
          not: 'cancelled',
        },
      },
    });

    if (ticketsCount > 0) {
      return {
        success: false,
        error:
          'Այս ցուցադրության համար արդեն գոյություն ունեն տոմսեր: Չի կարելի ջնջել',
      };
    }

    await prisma.screening.delete({
      where: { id },
    });

    revalidatePath('/admin/screenings');
    revalidatePath('/schedule');

    return {
      success: true,
      message: 'Ցուցադրությունը հաջողությամբ ջնջվեց',
    };
  } catch (error: any) {
    console.error('[Delete Screening] Error:', error);
    return {
      success: false,
      error: 'Ցուցադրություն ջնջելիս սխալ է տեղի ունեցել',
    };
  }
}

/** Առաջիկա ցուցադրության ենթակա ֆիլմերը՝ ամենամոտ սեանսի ժամով (հերոյի համար) */
export async function getUpcomingScreeningMovies(limit = 5) {
  try {
    const now = new Date();
    const screenings = await prisma.screening.findMany({
      where: { startTime: { gte: now } },
      include: {
        movie: {
          select: {
            id: true,
            title: true,
            image: true,
            slug: true,
            ageRating: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    const seen = new Set<number>();
    const movies: Array<{
      id: number;
      title: string;
      image: string | null;
      slug: string | null;
      ageRating: string | null;
      nextStart: Date;
    }> = [];

    for (const s of screenings) {
      if (seen.has(s.movieId)) continue;
      seen.add(s.movieId);
      movies.push({
        id: s.movie.id,
        title: s.movie.title,
        image: s.movie.image,
        slug: s.movie.slug,
        ageRating: s.movie.ageRating,
        nextStart: s.startTime,
      });
      if (movies.length >= limit) break;
    }

    return { success: true, movies };
  } catch (error: any) {
    console.error('[Get Upcoming Screening Movies] Error:', error);
    return {
      success: false,
      error: 'Ֆիլմերը բեռնելիս սխալ է տեղի ունեցել',
      movies: [],
    };
  }
}

/** Պատահական առաջիկա ցուցադրություն (հերոյի քարտի համար, ամեն refresh-ում տարբեր) */
export async function getRandomUpcomingScreening() {
  try {
    const now = new Date();
    const screenings = await prisma.screening.findMany({
      where: {
        startTime: { gte: now },
        movie: { isActive: true },
      },
      include: {
        movie: {
          select: {
            id: true,
            title: true,
            image: true,
            slug: true,
            rating: true,
            ageRating: true,
          },
        },
        hall: {
          select: {
            name: true,
            capacity: true,
          },
        },
        tickets: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (screenings.length === 0) {
      return { success: true, screening: null };
    }

    const pick = screenings[Math.floor(Math.random() * screenings.length)];
    const capacity = pick.hall?.capacity ?? 80;
    const booked = pick.tickets.filter(
      (t) => t.status === 'paid' || t.status === 'used'
    ).length;

    return {
      success: true,
      screening: {
        id: pick.id,
        startTime: pick.startTime,
        basePrice: pick.basePrice,
        availableSeats: Math.max(0, capacity - booked),
        movie: pick.movie,
        hall: { name: pick.hall.name },
      },
    };
  } catch (error: unknown) {
    console.error('[Get Random Upcoming Screening] Error:', error);
    return {
      success: false,
      error: 'Ցուցադրություն բեռնելիս սխալ է տեղի ունեցել',
      screening: null,
    };
  }
}

export async function getMovies() {
  try {
    const movies = await prisma.movie.findMany({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        duration: true,
        image: true,
        genre: true,
        rating: true,
        description: true,
      },
      orderBy: {
        title: 'asc',
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

export async function getHalls() {
  try {
    const halls = await prisma.hall.findMany({
      orderBy: {
        name: 'asc',
      },
    });
    return { success: true, halls };
  } catch (error: any) {
    console.error('[Get Halls] Error:', error);
    return {
      success: false,
      error: 'Դահլիճները բեռնելիս սխալ է տեղի ունեցել',
      halls: [],
    };
  }
}
