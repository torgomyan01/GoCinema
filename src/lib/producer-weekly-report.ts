import { prisma } from '@/lib/prisma';
import { isMailConfigured, mailerMissingMessage, sendMail } from '@/lib/mailer';
import { getYerevanCalendarWeek, getYerevanDayRange } from '@/lib/format';
import {
  getDueProducerReportPeriod,
  normalizeReportFrequency,
} from '@/lib/producer-report-frequency';
import {
  weeklyReportHtml,
  weeklyReportSubject,
  weeklyReportText,
  type WeeklyReportScreening,
} from '@/lib/producer-weekly-report-email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type WeeklyReportPeriod = 'previous' | 'current';

export type WeeklyReportSendResult = {
  movieId: number;
  movieTitle: string;
  status: 'sent' | 'skipped' | 'failed';
  recipients: string[];
  reason?: string;
};

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() || '';
  if (!email || !EMAIL_RE.test(email)) return null;
  return email;
}

function dateOnlyUtcNoon(key: string): Date {
  return new Date(`${key}T12:00:00.000Z`);
}

function collectEmails(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.map(normalizeEmail).filter((email): email is string => Boolean(email))
    ),
  ];
}

async function loadMovieTargets(movieId?: number) {
  return prisma.movie.findMany({
    where: movieId
      ? { id: movieId }
      : {
          OR: [{ companies: { some: { email: { not: null } } } }],
        },
    select: {
      id: true,
      title: true,
      reportFrequency: true,
      companies: { select: { id: true, email: true, name: true } },
      producers: { select: { email: true } },
      licenseContract: {
        select: {
          number: true,
          royaltyPercent: true,
          premiereDate: true,
          companyId: true,
          companyEmail: true,
          companyName: true,
          company: { select: { id: true, email: true, name: true } },
        },
      },
    },
  });
}

function recipientsForMovie(
  movie: Awaited<ReturnType<typeof loadMovieTargets>>[number]
) {
  return collectEmails(movie.companies.map((company) => company.email));
}

function shouldSendForPeriod(
  movie: Awaited<ReturnType<typeof loadMovieTargets>>[number],
  periodEnd: Date,
  hasScreenings: boolean
): string | null {
  const premiere = movie.licenseContract?.premiereDate;
  if (premiere && premiere.getTime() > periodEnd.getTime()) {
    return 'Պրեմիերան այս ժամանակահատվածից հետո է';
  }
  if (movie.licenseContract) return null;
  if (hasScreenings) return null;
  return 'Այս ժամանակահատվածում ցուցադրություն չկա';
}

export async function sendWeeklyProducerReports(options: {
  movieId?: number;
  period?: WeeklyReportPeriod;
  from?: string;
  to?: string;
  force?: boolean;
  testTo?: string;
  /** Եթե true՝ հաշվի է առնում ֆիլմի reportFrequency-ն և due ստուգումը */
  respectFrequency?: boolean;
}): Promise<{
  success: boolean;
  error?: string;
  weekLabel: string;
  results: WeeklyReportSendResult[];
}> {
  if (!isMailConfigured()) {
    return {
      success: false,
      error: mailerMissingMessage(),
      weekLabel: '',
      results: [],
    };
  }

  const isTest = Boolean(options.testTo);
  const testRecipient = normalizeEmail(options.testTo);
  if (options.testTo && !testRecipient) {
    return {
      success: false,
      error: 'Թեստային email-ը սխալ է',
      weekLabel: '',
      results: [],
    };
  }

  const movies = await loadMovieTargets(options.movieId);
  if (options.movieId && movies.length === 0) {
    return {
      success: false,
      error: 'Ֆիլմը չի գտնվել',
      weekLabel: '',
      results: [],
    };
  }

  const results: WeeklyReportSendResult[] = [];
  let weekLabel = '';

  for (const movie of movies) {
    const useFrequency =
      Boolean(options.respectFrequency) && !options.from && !options.to && !isTest;

    let range =
      options.from && options.to
        ? getYerevanDayRange(options.from, options.to)
        : null;

    if (!range && useFrequency) {
      const due = getDueProducerReportPeriod(movie.reportFrequency);
      if (!due.due && !options.force) {
        results.push({
          movieId: movie.id,
          movieTitle: movie.title,
          status: 'skipped',
          recipients: recipientsForMovie(movie),
          reason: `Այսօր ${normalizeReportFrequency(movie.reportFrequency)} հաշվետվություն չի պահանջվում`,
        });
        continue;
      }
      range = due;
    }

    if (!range) {
      range = getYerevanCalendarWeek(
        new Date(),
        options.period || 'previous'
      );
    }

    weekLabel = `${range.startKey} – ${range.endKey}`;
    const weekStartDate = dateOnlyUtcNoon(range.startKey);
    const weekEndDate = dateOnlyUtcNoon(range.endKey);

    const producerRecipients = recipientsForMovie(movie);
    const recipients = testRecipient ? [testRecipient] : producerRecipients;
    if (recipients.length === 0) {
      results.push({
        movieId: movie.id,
        movieTitle: movie.title,
        status: 'skipped',
        recipients,
        reason: 'Ֆիլմին կցված ընկերության email չկա',
      });
      continue;
    }

    if (!isTest) {
      const premiereSkip = shouldSendForPeriod(movie, range.end, true);
      if (premiereSkip === 'Պրեմիերան այս ժամանակահատվածից հետո է') {
        results.push({
          movieId: movie.id,
          movieTitle: movie.title,
          status: 'skipped',
          recipients,
          reason: premiereSkip,
        });
        continue;
      }
    }

    const screenings = await prisma.screening.findMany({
      where: {
        movieId: movie.id,
        startTime: { gte: range.start, lte: range.end },
      },
      orderBy: { startTime: 'asc' },
      select: {
        startTime: true,
        hall: { select: { name: true } },
        tickets: {
          where: { status: { in: ['paid', 'used'] } },
          select: { price: true },
        },
      },
    });

    if (!isTest) {
      const skipReason = shouldSendForPeriod(
        movie,
        range.end,
        screenings.length > 0
      );
      if (skipReason) {
        results.push({
          movieId: movie.id,
          movieTitle: movie.title,
          status: 'skipped',
          recipients,
          reason: skipReason,
        });
        continue;
      }

      const existing = await prisma.producerWeeklyReport.findUnique({
        where: {
          movieId_weekStart: { movieId: movie.id, weekStart: weekStartDate },
        },
      });
      if (existing?.status === 'sent' && !options.force) {
        results.push({
          movieId: movie.id,
          movieTitle: movie.title,
          status: 'skipped',
          recipients,
          reason: 'Այս ժամանակահատվածի հաշվետվությունն արդեն ուղարկված է',
        });
        continue;
      }
    }

    const reportScreenings: WeeklyReportScreening[] = screenings.map(
      (screening) => ({
        startTime: screening.startTime,
        hallName: screening.hall?.name || '—',
        ticketsSold: screening.tickets.length,
        revenue: Math.round(
          screening.tickets.reduce((sum, ticket) => sum + ticket.price, 0)
        ),
      })
    );
    const ticketsSold = reportScreenings.reduce(
      (sum, row) => sum + row.ticketsSold,
      0
    );
    const revenue = reportScreenings.reduce((sum, row) => sum + row.revenue, 0);
    const royaltyPercent = movie.licenseContract?.royaltyPercent ?? 50;
    const royaltyAmount = Math.round((revenue * royaltyPercent) / 100);
    const companyId =
      movie.licenseContract?.companyId ?? movie.companies[0]?.id ?? null;
    const companyName =
      movie.licenseContract?.companyName ||
      movie.licenseContract?.company?.name ||
      movie.companies[0]?.name ||
      null;

    const payload = {
      movieTitle: movie.title,
      companyName,
      contractNumber: movie.licenseContract?.number || null,
      weekStart: range.start,
      weekEnd: range.end,
      screenings: reportScreenings,
      screeningsCount: reportScreenings.length,
      ticketsSold,
      revenue,
      royaltyPercent,
      royaltyAmount,
    };

    try {
      await sendMail({
        to: recipients,
        subject: weeklyReportSubject(payload, isTest),
        html: weeklyReportHtml(payload),
        text: weeklyReportText(payload),
      });

      if (!isTest) {
        await prisma.producerWeeklyReport.upsert({
          where: {
            movieId_weekStart: { movieId: movie.id, weekStart: weekStartDate },
          },
          create: {
            movieId: movie.id,
            companyId,
            weekStart: weekStartDate,
            weekEnd: weekEndDate,
            recipients: JSON.stringify(recipients),
            screeningsCount: payload.screeningsCount,
            ticketsSold,
            revenue,
            royaltyPercent,
            royaltyAmount,
            status: 'sent',
            error: null,
            sentAt: new Date(),
          },
          update: {
            companyId,
            weekEnd: weekEndDate,
            recipients: JSON.stringify(recipients),
            screeningsCount: payload.screeningsCount,
            ticketsSold,
            revenue,
            royaltyPercent,
            royaltyAmount,
            status: 'sent',
            error: null,
            sentAt: new Date(),
          },
        });
      }

      results.push({
        movieId: movie.id,
        movieTitle: movie.title,
        status: 'sent',
        recipients,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Չհաջողվեց ուղարկել նամակը';
      if (!isTest) {
        await prisma.producerWeeklyReport.upsert({
          where: {
            movieId_weekStart: { movieId: movie.id, weekStart: weekStartDate },
          },
          create: {
            movieId: movie.id,
            companyId,
            weekStart: weekStartDate,
            weekEnd: weekEndDate,
            recipients: JSON.stringify(recipients),
            screeningsCount: payload.screeningsCount,
            ticketsSold,
            revenue,
            royaltyPercent,
            royaltyAmount,
            status: 'failed',
            error: message,
          },
          update: {
            companyId,
            weekEnd: weekEndDate,
            recipients: JSON.stringify(recipients),
            screeningsCount: payload.screeningsCount,
            ticketsSold,
            revenue,
            royaltyPercent,
            royaltyAmount,
            status: 'failed',
            error: message,
          },
        });
      }
      results.push({
        movieId: movie.id,
        movieTitle: movie.title,
        status: 'failed',
        recipients,
        reason: message,
      });
    }
  }

  const failed = results.filter((row) => row.status === 'failed');
  return {
    success: failed.length === 0,
    error:
      failed.length === 0
        ? undefined
        : [...new Set(failed.map((row) => row.reason).filter(Boolean))].join(
            ' · '
          ) || 'Որոշ հաշվետվություններ չուղարկվեցին',
    weekLabel,
    results,
  };
}

/**
 * Ամեն օր (ադմին մուտք)՝ ամեն ֆիլմի համար ստուգում է՝ արդյոք
 * իր reportFrequency-ով ժամանակահատվածի հաշվետվությունն ուղարկված է։
 */
export async function maybeDispatchDueProducerReports(): Promise<{
  success: boolean;
  error?: string;
  weekLabel: string;
  results: WeeklyReportSendResult[];
  skipped?: boolean;
}> {
  return sendWeeklyProducerReports({
    respectFrequency: true,
    force: false,
  });
}

/** @deprecated օգտագործիր maybeDispatchDueProducerReports */
export async function maybeDispatchMondayWeeklyReports() {
  return maybeDispatchDueProducerReports();
}
