'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminRole } from '@/lib/roles';
import {
  maybeDispatchMondayWeeklyReports,
  sendWeeklyProducerReports,
  type WeeklyReportPeriod,
  type WeeklyReportSendResult,
} from '@/lib/producer-weekly-report';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  return Boolean(user?.id && isAdminRole(user.role));
}

export async function sendProducerWeeklyReportEmail(input: {
  movieId?: number;
  period?: WeeklyReportPeriod;
  from?: string;
  to?: string;
  force?: boolean;
  testTo?: string;
}): Promise<{
  success: boolean;
  error?: string;
  weekLabel: string;
  results: WeeklyReportSendResult[];
}> {
  if (!(await requireAdmin())) {
    return {
      success: false,
      error: 'Մուտքն արգելված է',
      weekLabel: '',
      results: [],
    };
  }

  return sendWeeklyProducerReports({
    movieId: input.movieId,
    period: input.period || (input.testTo && !input.from ? 'current' : 'previous'),
    from: input.from,
    to: input.to,
    force: Boolean(input.force),
    testTo: input.testTo,
  });
}

export async function dispatchMondayWeeklyReports(): Promise<{
  success: boolean;
  error?: string;
  skipped?: boolean;
}> {
  if (!(await requireAdmin())) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }
  const result = await maybeDispatchMondayWeeklyReports();
  return {
    success: result.success,
    error: result.error,
    skipped: result.skipped,
  };
}
