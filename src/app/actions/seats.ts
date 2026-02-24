'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export interface CreateSeatData {
  hallId: number;
  row: string;
  number: number;
  seatType?: 'standard' | 'vip' | 'disabled';
}

export interface UpdateSeatData {
  id: number;
  row?: string;
  number?: number;
  seatType?: 'standard' | 'vip' | 'disabled';
}

export interface BulkCreateSeatsData {
  hallId: number;
  rows: string[];
  seatsPerRow: number;
  seatType?: 'standard' | 'vip' | 'disabled';
}

// Helper function to get default hall (we have only one hall)
async function getDefaultHall() {
  let hall = await prisma.hall.findFirst();
  if (!hall) {
    hall = await prisma.hall.create({
      data: {
        name: 'Գլխավոր դահլիճ',
        capacity: 80,
      },
    });
  }
  return hall.id;
}

export async function getSeats(hallId?: number) {
  try {
    const targetHallId = hallId || (await getDefaultHall());

    const seats = await prisma.seat.findMany({
      where: {
        hallId: targetHallId,
      },
      orderBy: [
        { row: 'asc' },
        { number: 'asc' },
      ],
      include: {
        hall: {
          select: {
            id: true,
            name: true,
            capacity: true,
          },
        },
      },
    });

    return { success: true, seats };
  } catch (error: any) {
    console.error('[Get Seats] Error:', error);
    return {
      success: false,
      error: 'Նստատեղերը բեռնելիս սխալ է տեղի ունեցել',
      seats: [],
    };
  }
}

export async function getSeatById(id: number) {
  try {
    const seat = await prisma.seat.findUnique({
      where: { id },
      include: {
        hall: true,
      },
    });

    if (!seat) {
      return {
        success: false,
        error: 'Նստատեղը չի գտնվել',
      };
    }

    return { success: true, seat };
  } catch (error: any) {
    console.error('[Get Seat] Error:', error);
    return {
      success: false,
      error: 'Նստատեղը բեռնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function createSeat(data: CreateSeatData) {
  try {
    // Validation
    if (!data.hallId || !data.row || !data.number) {
      return {
        success: false,
        error: 'Բոլոր պարտադիր դաշտերը պետք է լրացված լինեն',
      };
    }

    // Auto-set hallId to default hall if not provided
    const hallId = data.hallId || (await getDefaultHall());

    // Check if seat already exists
    const existingSeat = await prisma.seat.findUnique({
      where: {
        hallId_row_number: {
          hallId,
          row: data.row,
          number: data.number,
        },
      },
    });

    if (existingSeat) {
      return {
        success: false,
        error: `Նստատեղ ${data.row}${data.number} արդեն գոյություն ունի`,
      };
    }

    const seat = await prisma.seat.create({
      data: {
        hallId,
        row: data.row,
        number: data.number,
        seatType: data.seatType || 'standard',
      },
      include: {
        hall: {
          select: {
            id: true,
            name: true,
            capacity: true,
          },
        },
      },
    });

    // Update hall capacity
    const seatCount = await prisma.seat.count({
      where: { hallId },
    });
    await prisma.hall.update({
      where: { id: hallId },
      data: { capacity: seatCount },
    });

    revalidatePath('/admin/seats');
    revalidatePath('/booking');

    return {
      success: true,
      seat,
      message: 'Նստատեղը հաջողությամբ ավելացվեց',
    };
  } catch (error: any) {
    console.error('[Create Seat] Error:', error);
    return {
      success: false,
      error: 'Նստատեղ ավելացնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function bulkCreateSeats(data: BulkCreateSeatsData) {
  try {
    const hallId = data.hallId || (await getDefaultHall());

    const seatsToCreate = [];
    for (const row of data.rows) {
      for (let num = 1; num <= data.seatsPerRow; num++) {
        // Check if seat already exists
        const existing = await prisma.seat.findUnique({
          where: {
            hallId_row_number: {
              hallId,
              row,
              number: num,
            },
          },
        });

        if (!existing) {
          seatsToCreate.push({
            hallId,
            row,
            number: num,
            seatType: data.seatType || 'standard',
          });
        }
      }
    }

    if (seatsToCreate.length === 0) {
      return {
        success: false,
        error: 'Բոլոր նստատեղերը արդեն գոյություն ունեն',
      };
    }

    await prisma.seat.createMany({
      data: seatsToCreate,
      skipDuplicates: true,
    });

    // Update hall capacity
    const seatCount = await prisma.seat.count({
      where: { hallId },
    });
    await prisma.hall.update({
      where: { id: hallId },
      data: { capacity: seatCount },
    });

    revalidatePath('/admin/seats');
    revalidatePath('/booking');

    return {
      success: true,
      message: `${seatsToCreate.length} նստատեղ հաջողությամբ ավելացվեց`,
    };
  } catch (error: any) {
    console.error('[Bulk Create Seats] Error:', error);
    return {
      success: false,
      error: 'Նստատեղեր ավելացնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function updateSeat(data: UpdateSeatData) {
  try {
    if (!data.id) {
      return {
        success: false,
        error: 'Նստատեղի ID-ն պարտադիր է',
      };
    }

    const existingSeat = await prisma.seat.findUnique({
      where: { id: data.id },
    });

    if (!existingSeat) {
      return {
        success: false,
        error: 'Նստատեղը չի գտնվել',
      };
    }

    // If row or number is being changed, check for conflicts
    if (data.row || data.number) {
      const newRow = data.row || existingSeat.row;
      const newNumber = data.number || existingSeat.number;

      const conflictingSeat = await prisma.seat.findUnique({
        where: {
          hallId_row_number: {
            hallId: existingSeat.hallId,
            row: newRow,
            number: newNumber,
          },
        },
      });

      if (conflictingSeat && conflictingSeat.id !== data.id) {
        return {
          success: false,
          error: `Նստատեղ ${newRow}${newNumber} արդեն գոյություն ունի`,
        };
      }
    }

    const seat = await prisma.seat.update({
      where: { id: data.id },
      data: {
        ...(data.row && { row: data.row }),
        ...(data.number && { number: data.number }),
        ...(data.seatType && { seatType: data.seatType }),
      },
      include: {
        hall: {
          select: {
            id: true,
            name: true,
            capacity: true,
          },
        },
      },
    });

    revalidatePath('/admin/seats');
    revalidatePath('/booking');

    return {
      success: true,
      seat,
      message: 'Նստատեղը հաջողությամբ թարմացվեց',
    };
  } catch (error: any) {
    console.error('[Update Seat] Error:', error);
    return {
      success: false,
      error: 'Նստատեղ թարմացնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function deleteSeat(id: number) {
  try {
    const seat = await prisma.seat.findUnique({
      where: { id },
      include: {
        tickets: true,
      },
    });

    if (!seat) {
      return {
        success: false,
        error: 'Նստատեղը չի գտնվել',
      };
    }

    // Check if seat has active tickets
    const activeTickets = seat.tickets.filter(
      (ticket) => ticket.status !== 'cancelled'
    );

    if (activeTickets.length > 0) {
      return {
        success: false,
        error: 'Նստատեղը չի կարող ջնջվել, քանի որ ունի ակտիվ տոմսեր',
      };
    }

    const hallId = seat.hallId;

    await prisma.seat.delete({
      where: { id },
    });

    // Update hall capacity
    const seatCount = await prisma.seat.count({
      where: { hallId },
    });
    await prisma.hall.update({
      where: { id: hallId },
      data: { capacity: seatCount },
    });

    revalidatePath('/admin/seats');
    revalidatePath('/booking');

    return {
      success: true,
      message: 'Նստատեղը հաջողությամբ ջնջվեց',
    };
  } catch (error: any) {
    console.error('[Delete Seat] Error:', error);
    return {
      success: false,
      error: 'Նստատեղ ջնջելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function deleteAllSeats(hallId?: number) {
  try {
    const targetHallId = hallId || (await getDefaultHall());

    // Check if there are any active tickets
    const seats = await prisma.seat.findMany({
      where: { hallId: targetHallId },
      include: {
        tickets: {
          where: {
            status: {
              in: ['reserved', 'paid', 'used'],
            },
          },
        },
      },
    });

    const seatsWithActiveTickets = seats.filter(
      (seat) => seat.tickets.length > 0
    );

    if (seatsWithActiveTickets.length > 0) {
      return {
        success: false,
        error: 'Որոշ նստատեղեր ունեն ակտիվ տոմսեր և չեն կարող ջնջվել',
      };
    }

    await prisma.seat.deleteMany({
      where: { hallId: targetHallId },
    });

    await prisma.hall.update({
      where: { id: targetHallId },
      data: { capacity: 0 },
    });

    revalidatePath('/admin/seats');
    revalidatePath('/booking');

    return {
      success: true,
      message: 'Բոլոր նստատեղերը հաջողությամբ ջնջվեցին',
    };
  } catch (error: any) {
    console.error('[Delete All Seats] Error:', error);
    return {
      success: false,
      error: 'Նստատեղեր ջնջելիս սխալ է տեղի ունեցել',
    };
  }
}
