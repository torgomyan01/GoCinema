'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdminRole } from '@/lib/roles';
import {
  PACKAGE_BUFFER_MS,
  PACKAGE_TYPES,
  packageTypeLabelHy,
  type PackageBookingRow,
} from '@/lib/package-booking';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !isAdminRole(user.role)) {
    return null;
  }
  return user;
}

export interface PackageBookingInput {
  packageType: string;
  customerName: string;
  customerPhone: string;
  guestsCount?: number | null;
  price?: number | null;
  notes?: string | null;
  startTime: string; // ISO
  endTime: string; // ISO
  status?: string;
}

function validateInput(input: PackageBookingInput): string | null {
  if (!input.customerName?.trim()) return 'Հաճախորդի անունը պարտադիր է';
  if (!input.customerPhone?.trim()) return 'Հեռախոսահամարը պարտադիր է';
  if (!input.startTime || !input.endTime)
    return 'Սկզբի և ավարտի ժամերը պարտադիր են';

  const start = new Date(input.startTime);
  const end = new Date(input.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Սխալ ամսաթիվ/ժամ';
  }
  if (end <= start) {
    return 'Ավարտի ժամը պետք է լինի սկզբից ուշ';
  }
  if (!(PACKAGE_TYPES as readonly string[]).includes(input.packageType)) {
    return 'Անհայտ փաթեթի տեսակ';
  }
  return null;
}

/**
 * Ցուցադրությունների բախում փաթեթի պատվերի ժամի հետ (±buffer)։
 * Վերադարձնում է բախվող ցուցադրությունը կամ null։
 */
async function findConflictingScreening(start: Date, end: Date) {
  const bufferedStart = new Date(start.getTime() - PACKAGE_BUFFER_MS);
  const bufferedEnd = new Date(end.getTime() + PACKAGE_BUFFER_MS);

  return prisma.screening.findFirst({
    where: {
      startTime: { lt: bufferedEnd },
      endTime: { gt: bufferedStart },
    },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      movie: { select: { title: true } },
    },
    orderBy: { startTime: 'asc' },
  });
}

/**
 * Այլ ակտիվ (ոչ չեղարկված) փաթեթի պատվերի բախում նույն ժամանակահատվածում (±buffer)։
 */
async function findConflictingPackageBooking(
  start: Date,
  end: Date,
  excludeId?: number
) {
  const bufferedStart = new Date(start.getTime() - PACKAGE_BUFFER_MS);
  const bufferedEnd = new Date(end.getTime() + PACKAGE_BUFFER_MS);

  return prisma.packageBooking.findFirst({
    where: {
      status: { not: 'cancelled' },
      ...(excludeId != null ? { id: { not: excludeId } } : {}),
      startTime: { lt: bufferedEnd },
      endTime: { gt: bufferedStart },
    },
    select: {
      id: true,
      packageType: true,
      customerName: true,
      startTime: true,
      endTime: true,
    },
    orderBy: { startTime: 'asc' },
  });
}

function formatHy(date: Date): string {
  return date.toLocaleString('hy-AM', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function getPackageBookings(params?: {
  from?: string;
  to?: string;
  status?: string;
}): Promise<{
  success: boolean;
  error: string | null;
  bookings: PackageBookingRow[];
}> {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է', bookings: [] };
  }

  try {
    const where: {
      startTime?: { gte?: Date; lte?: Date };
      status?: string;
    } = {};

    if (params?.from || params?.to) {
      where.startTime = {};
      if (params.from) {
        const from = new Date(params.from);
        from.setHours(0, 0, 0, 0);
        where.startTime.gte = from;
      }
      if (params.to) {
        const to = new Date(params.to);
        to.setHours(23, 59, 59, 999);
        where.startTime.lte = to;
      }
    }
    if (params?.status && params.status !== 'all') {
      where.status = params.status;
    }

    const bookings = await prisma.packageBooking.findMany({
      where,
      include: {
        createdBy: { select: { name: true } },
      },
      orderBy: [{ startTime: 'desc' }, { id: 'desc' }],
    });

    return {
      success: true,
      error: null,
      bookings: bookings.map((b) => ({
        id: b.id,
        packageType: b.packageType,
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        guestsCount: b.guestsCount,
        price: b.price,
        notes: b.notes,
        startTime: b.startTime.toISOString(),
        endTime: b.endTime.toISOString(),
        status: b.status,
        createdByName: b.createdBy?.name ?? null,
        createdAt: b.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error('[Get Package Bookings] Error:', error);
    return {
      success: false,
      error: 'Փաթեթի պատվերները բեռնելիս սխալ է տեղի ունեցել',
      bookings: [],
    };
  }
}

export async function createPackageBooking(input: PackageBookingInput) {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  const validationError = validateInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  try {
    const start = new Date(input.startTime);
    const end = new Date(input.endTime);

    // Ցուցադրության բախում — երկկողմանի արգելք
    const screeningConflict = await findConflictingScreening(start, end);
    if (screeningConflict) {
      return {
        success: false,
        error: `Այս ժամին դահլիճում ցուցադրություն կա՝ «${screeningConflict.movie?.title ?? 'Ֆիլմ'}» (${formatHy(screeningConflict.startTime)} – ${formatHy(screeningConflict.endTime)})։ Ընտրեք այլ ժամ։`,
      };
    }

    // Այլ փաթեթի պատվերի բախում
    const bookingConflict = await findConflictingPackageBooking(start, end);
    if (bookingConflict) {
      return {
        success: false,
        error: `Այս ժամին արդեն կա փաթեթի պատվեր՝ ${packageTypeLabelHy(bookingConflict.packageType)} (${bookingConflict.customerName}, ${formatHy(bookingConflict.startTime)} – ${formatHy(bookingConflict.endTime)})։`,
      };
    }

    await prisma.packageBooking.create({
      data: {
        packageType: input.packageType,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone.trim(),
        guestsCount: input.guestsCount ?? null,
        price: input.price ?? null,
        notes: input.notes?.trim() || null,
        startTime: start,
        endTime: end,
        status: input.status === 'pending' ? 'pending' : 'confirmed',
        createdById: admin.id ? Number(admin.id) : null,
      },
    });

    revalidatePath('/admin/packages');
    revalidatePath('/admin/screenings');
    return { success: true, error: null };
  } catch (error) {
    console.error('[Create Package Booking] Error:', error);
    return {
      success: false,
      error: 'Փաթեթի պատվերն ավելացնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function updatePackageBooking(
  id: number,
  input: PackageBookingInput
) {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  const validationError = validateInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  try {
    const existing = await prisma.packageBooking.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: 'Պատվերը չի գտնվել' };
    }

    const start = new Date(input.startTime);
    const end = new Date(input.endTime);
    const nextStatus =
      input.status === 'pending' || input.status === 'cancelled'
        ? input.status
        : 'confirmed';

    // Չեղարկվածի համար բախում չենք ստուգում
    if (nextStatus !== 'cancelled') {
      const screeningConflict = await findConflictingScreening(start, end);
      if (screeningConflict) {
        return {
          success: false,
          error: `Այս ժամին դահլիճում ցուցադրություն կա՝ «${screeningConflict.movie?.title ?? 'Ֆիլմ'}» (${formatHy(screeningConflict.startTime)} – ${formatHy(screeningConflict.endTime)})։ Ընտրեք այլ ժամ։`,
        };
      }

      const bookingConflict = await findConflictingPackageBooking(
        start,
        end,
        id
      );
      if (bookingConflict) {
        return {
          success: false,
          error: `Այս ժամին արդեն կա փաթեթի պատվեր՝ ${packageTypeLabelHy(bookingConflict.packageType)} (${bookingConflict.customerName}, ${formatHy(bookingConflict.startTime)} – ${formatHy(bookingConflict.endTime)})։`,
        };
      }
    }

    await prisma.packageBooking.update({
      where: { id },
      data: {
        packageType: input.packageType,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone.trim(),
        guestsCount: input.guestsCount ?? null,
        price: input.price ?? null,
        notes: input.notes?.trim() || null,
        startTime: start,
        endTime: end,
        status: nextStatus,
      },
    });

    revalidatePath('/admin/packages');
    revalidatePath('/admin/screenings');
    return { success: true, error: null };
  } catch (error) {
    console.error('[Update Package Booking] Error:', error);
    return {
      success: false,
      error: 'Փաթեթի պատվերը թարմացնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function cancelPackageBooking(id: number) {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    await prisma.packageBooking.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    revalidatePath('/admin/packages');
    revalidatePath('/admin/screenings');
    return { success: true, error: null };
  } catch (error) {
    console.error('[Cancel Package Booking] Error:', error);
    return {
      success: false,
      error: 'Փաթեթի պատվերը չեղարկելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function deletePackageBooking(id: number) {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    await prisma.packageBooking.delete({ where: { id } });

    revalidatePath('/admin/packages');
    revalidatePath('/admin/screenings');
    return { success: true, error: null };
  } catch (error) {
    console.error('[Delete Package Booking] Error:', error);
    return {
      success: false,
      error: 'Փաթեթի պատվերը ջնջելիս սխալ է տեղի ունեցել',
    };
  }
}

/**
 * Ցուցադրության ժամի բախում ակտիվ փաթեթի պատվերի հետ (±buffer)։
 * Օգտագործվում է createScreening/updateScreening-ում։
 */
export async function findPackageBookingConflictForScreening(
  startTime: Date,
  endTime: Date
): Promise<string | null> {
  const bufferedStart = new Date(startTime.getTime() - PACKAGE_BUFFER_MS);
  const bufferedEnd = new Date(endTime.getTime() + PACKAGE_BUFFER_MS);

  const conflict = await prisma.packageBooking.findFirst({
    where: {
      status: { not: 'cancelled' },
      startTime: { lt: bufferedEnd },
      endTime: { gt: bufferedStart },
    },
    select: {
      packageType: true,
      customerName: true,
      startTime: true,
      endTime: true,
    },
    orderBy: { startTime: 'asc' },
  });

  if (!conflict) return null;

  return `Այս ժամին դահլիճը զբաղված է փաթեթի պատվերով՝ ${packageTypeLabelHy(conflict.packageType)} (${conflict.customerName}, ${formatHy(conflict.startTime)} – ${formatHy(conflict.endTime)}, ներառյալ ±30ր նախապատրաստում)։`;
}
