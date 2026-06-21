'use client';

import { useEffect, useState } from 'react';
import { motion, type Transition } from 'framer-motion';
import {
  ArrowRight,
  Calendar,
  Clapperboard,
  Clock,
  MapPin,
  Play,
  Star,
  Ticket,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import {
  getScreenings,
  type ScreeningListItem,
} from '@/app/actions/screenings';
import { SITE_URL } from '@/utils/consts';
import { ageRatingClasses } from '@/lib/age-rating';

interface HeroTicket {
  id: number | null;
  startTime: Date | string;
  basePrice: number;
  availableSeats: number;
  isMock: boolean;
  movie: {
    title: string;
    image: string | null;
    slug: string | null;
    rating: number;
    ageRating: string | null;
  };
  hall: {
    name: string;
  };
}

const AM_MONTHS_SHORT = [
  'հնվ',
  'փտվ',
  'մրտ',
  'ապր',
  'մյս',
  'հնս',
  'հլս',
  'օգս',
  'սեպ',
  'հոկ',
  'նոյ',
  'դեկ',
];

const MOCK_TICKET: HeroTicket = {
  id: null,
  startTime: new Date(new Date().setHours(20, 30, 0, 0)),
  basePrice: 2500,
  availableSeats: 42,
  isMock: true,
  movie: {
    title: 'GoCinema Hall',
    image: '/images/hero-background.png',
    slug: null,
    rating: 0,
    ageRating: null,
  },
  hall: {
    name: '99 Սուերմարկետ 2 հարկ',
  },
};

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatShowtime(value: Date | string) {
  const d = new Date(value);
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (isToday) return `Այսօր · ${time}`;
  return `${pad2(d.getDate())} ${AM_MONTHS_SHORT[d.getMonth()]} · ${time}`;
}

function getAvailableSeats(
  capacity: number,
  tickets: Array<{ status: string }> = []
) {
  const booked = tickets.filter(
    (t) => t.status === 'paid' || t.status === 'used'
  ).length;
  return Math.max(0, capacity - booked);
}

function mapScreeningToTicket(screening: ScreeningListItem): HeroTicket {
  return {
    id: screening.id,
    startTime: screening.startTime,
    basePrice: screening.basePrice,
    availableSeats: getAvailableSeats(
      screening.hall?.capacity ?? 42,
      screening.tickets
    ),
    isMock: false,
    movie: {
      title: screening.movie?.title?.trim() || 'Անհայտ ֆիլմ',
      image: screening.movie?.image ?? null,
      slug: screening.movie?.slug ?? null,
      rating: screening.movie?.rating ?? 0,
      ageRating: screening.movie?.ageRating ?? null,
    },
    hall: {
      name: screening.hall?.name || 'GoCinema Hall',
    },
  };
}

const fadeUp = (
  delay = 0
): {
  initial: { opacity: number; y: number };
  animate: { opacity: number; y: number };
  transition: Transition;
} => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: 'easeOut' },
});

const TRUST_ITEMS = [
  { value: '42', label: 'Հարմարավետ տեղ' },
  { value: '8K', label: 'Պատկեր' },
  { value: 'QR', label: 'Անցումային տոմս' },
];

function HeroTicketCard({
  ticket,
  compact = false,
}: {
  ticket: HeroTicket;
  compact?: boolean;
}) {
  const hasSeats = ticket.availableSeats > 0;
  const bookingHref = ticket.isMock
    ? SITE_URL.SCHEDULE
    : hasSeats
      ? SITE_URL.BOOKING(ticket.id!)
      : SITE_URL.SCHEDULE;

  return (
    <div
      className={`relative overflow-hidden rounded-[1.5rem] border border-white/15 bg-neutral-950/85 shadow-2xl shadow-red-950/40 backdrop-blur-xl sm:rounded-[2.3rem] ${
        compact ? 'p-4 sm:p-5' : 'p-6'
      }`}
    >
      <div
        className={`flex items-start justify-between gap-3 ${compact ? 'mb-4' : 'mb-5'}`}
      >
        <div className="min-w-0">
          <p
            className={`font-bold uppercase tracking-[0.2em] text-red-400 ${
              compact ? 'text-xs sm:text-sm' : 'text-sm tracking-[0.25em]'
            }`}
          >
            {ticket.isMock ? 'Այսօր' : 'Մոտակա սեանս'}
          </p>
          <h3
            className={`mt-1 line-clamp-2 font-black leading-tight text-white ${
              compact ? 'text-xl sm:text-2xl' : 'text-2xl'
            }`}
          >
            {ticket.movie.title}
          </h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div
            className={`rounded-xl bg-red-600 ${compact ? 'p-2.5 sm:p-3' : 'rounded-2xl p-3'}`}
          >
            <Clapperboard
              className={compact ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-6 w-6'}
            />
          </div>
          {ticket.movie.ageRating && (
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-bold ${ageRatingClasses(
                ticket.movie.ageRating
              )}`}
            >
              {ticket.movie.ageRating}
            </span>
          )}
        </div>
      </div>

      <div
        className={`overflow-hidden rounded-3xl bg-neutral-900 ${compact ? 'mb-4' : 'mb-5'}`}
      >
        <Image
          src={ticket.movie.image || '/images/hero-background.png'}
          alt={ticket.movie.title}
          width={520}
          height={320}
          className={`w-full object-cover opacity-90 ${compact ? 'h-40 sm:h-48' : 'h-56'}`}
        />
      </div>

      <div
        className={`space-y-3 rounded-3xl border border-white/10 bg-white/[0.04] ${
          compact ? 'p-4' : 'p-5'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          {ticket.movie.rating > 0 ? (
            <div className="flex items-center gap-1.5 text-yellow-400">
              <Star className="h-4 w-4 fill-current" />
              <span className="text-sm font-bold text-white">
                {ticket.movie.rating.toFixed(1)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-yellow-400">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} className="h-4 w-4 fill-current" />
              ))}
            </div>
          )}
          <span
            className={`rounded-full px-3 py-1 text-sm font-bold ${
              hasSeats
                ? 'bg-green-500/15 text-green-300'
                : 'bg-red-500/15 text-red-300'
            }`}
          >
            {hasSeats ? 'Տեղեր կան' : 'Վաճառված'}
          </span>
        </div>

        <div
          className={`grid gap-3 text-sm text-neutral-300 ${
            compact
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2'
          }`}
        >
          <div className="flex items-center gap-2 rounded-2xl bg-black/30 p-3">
            <Clock className="h-4 w-4 shrink-0 text-red-400" />
            <span className="truncate">{formatShowtime(ticket.startTime)}</span>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-black/30 p-3">
            <MapPin className="h-4 w-4 shrink-0 text-red-400" />
            <span className="truncate">{ticket.hall.name}</span>
          </div>
        </div>

        <div className="text-center text-sm font-bold text-red-400">
          {ticket.basePrice.toLocaleString('hy-AM')} ֏
        </div>

        <Link
          href={bookingHref}
          className={`flex items-center justify-center gap-2 rounded-2xl bg-white font-black text-neutral-950 transition hover:bg-red-50 ${
            compact ? 'px-4 py-3 text-sm sm:text-base' : 'mt-2 px-5 py-3'
          }`}
        >
          <Ticket className="h-5 w-5" />
          {ticket.isMock || !hasSeats ? 'Ժամանակացույց' : 'Ամրագրել տեղ'}
        </Link>
      </div>
    </div>
  );
}

export default function HeroSection() {
  const [ticket, setTicket] = useState<HeroTicket>(MOCK_TICKET);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await getScreenings();
        if (!result.success || !result.screenings?.length) return;

        const now = new Date();
        const screenings = result.screenings;
        let pool = screenings.filter((s) => new Date(s.endTime) >= now);

        if (pool.length === 0) {
          pool = [...screenings].sort(
            (a, b) =>
              new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
          );
        }

        const pick = pool[Math.floor(Math.random() * pool.length)];
        setTicket(mapScreeningToTicket(pick));
      } catch (err) {
        console.error('[Hero] screenings load error:', err);
      }
    };

    load();
  }, []);

  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[#050505] text-white">
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero-background.png"
          alt="GoCinema"
          fill
          priority
          quality={90}
          className="object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_22%,rgba(220,38,38,0.34),transparent_28%),linear-gradient(180deg,#050505_0%,rgba(5,5,5,0.88)_55%,rgba(5,5,5,0.75)_100%)] lg:bg-[radial-gradient(circle_at_72%_22%,rgba(220,38,38,0.34),transparent_28%),linear-gradient(90deg,#050505_0%,rgba(5,5,5,0.92)_43%,rgba(5,5,5,0.65)_100%)]" />
        <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:48px_48px] sm:[background-size:72px_72px]" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#050505] to-transparent sm:h-40" />
      </div>

      <div className="relative z-20 container mx-auto grid min-h-[100svh] items-center gap-8 px-4 pb-10 pt-24 sm:gap-10 sm:pb-14 sm:pt-28 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-16 lg:pt-32">
        <div>
          <motion.h1
            className="mb-4 max-w-4xl text-[2.35rem] font-black leading-[0.92] tracking-[-0.04em] sm:mb-6 sm:text-5xl sm:leading-[0.9] sm:tracking-[-0.05em] md:text-6xl lg:text-8xl xl:text-[80px]"
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.18, ease: 'easeOut' }}
          >
            Կինոն այստեղ <span className="text-red-500">կենդանանում է</span>
          </motion.h1>

          <motion.p
            className="mb-7 max-w-2xl text-base leading-relaxed text-neutral-300 sm:mb-9 sm:text-lg md:text-2xl"
            {...fadeUp(0.35)}
          >
            Ընտրեք ֆիլմը, ամրագրեք տեղը և ստացեք QR տոմսը ձեր հեռախոսում։
            GoCinema-ը ստեղծված է արագ, գեղեցիկ և հարմարավետ կինոփորձի համար։
          </motion.p>

          <motion.div
            className="mb-8 flex flex-col gap-3 sm:mb-10 sm:flex-row sm:gap-4"
            {...fadeUp(0.5)}
          >
            <Link
              href={SITE_URL.MOVIES}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-red-600 px-6 py-3.5 text-base font-black text-white shadow-2xl shadow-red-950/50 transition hover:bg-red-500 sm:w-auto sm:gap-3 sm:px-8 sm:py-4 sm:text-lg"
            >
              <Play className="h-5 w-5 fill-current" />
              Դիտել ֆիլմերը
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
            </Link>
            <Link
              href={SITE_URL.SCHEDULE}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/8 px-6 py-3.5 text-base font-black text-white backdrop-blur transition hover:bg-white/14 sm:w-auto sm:gap-3 sm:px-8 sm:py-4 sm:text-lg"
            >
              <Calendar className="h-5 w-5" />
              Այսօրվա սեանսները
            </Link>
          </motion.div>

          <motion.div
            className="grid max-w-xl grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur sm:rounded-3xl"
            {...fadeUp(0.65)}
          >
            {TRUST_ITEMS.map((item) => (
              <div key={item.label} className="px-2 py-3 sm:px-4 sm:py-4">
                <div className="text-lg font-black text-white sm:text-2xl">
                  {item.value}
                </div>
                <div className="mt-0.5 text-[10px] leading-tight text-neutral-400 sm:mt-1 sm:text-xs">
                  {item.label}
                </div>
              </div>
            ))}
          </motion.div>

          {/* Mobile ticket mock */}
          <motion.div
            className="mt-6 lg:hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.75, ease: 'easeOut' }}
          >
            <HeroTicketCard ticket={ticket} compact />
          </motion.div>
        </div>

        {/* Desktop ticket mock */}
        <motion.div
          initial={{ opacity: 0, x: 40, rotate: 2 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          transition={{ duration: 0.85, delay: 0.35, ease: 'easeOut' }}
          className="relative hidden lg:block"
        >
          <div className="absolute -left-10 top-10 h-80 w-56 rotate-[-10deg] rounded-[2rem] border border-white/10 bg-gradient-to-b from-neutral-800 to-neutral-950 p-4 opacity-80 shadow-2xl">
            <div className="h-full rounded-[1.4rem] bg-[radial-gradient(circle_at_50%_20%,rgba(239,68,68,0.55),transparent_35%),linear-gradient(160deg,#1f1f1f,#050505)]" />
          </div>
          <div className="absolute -right-6 top-24 h-80 w-56 rotate-[9deg] rounded-[2rem] border border-white/10 bg-gradient-to-b from-neutral-800 to-neutral-950 p-4 opacity-80 shadow-2xl">
            <div className="h-full rounded-[1.4rem] bg-[radial-gradient(circle_at_50%_20%,rgba(234,179,8,0.45),transparent_35%),linear-gradient(160deg,#1f1f1f,#050505)]" />
          </div>

          <div className="relative mx-auto max-w-md">
            <HeroTicketCard ticket={ticket} />
          </div>
        </motion.div>
      </div>

      <div className="relative z-20 border-y border-white/10 bg-red-950/20 backdrop-blur">
        <div className="container mx-auto overflow-x-auto px-4 py-3 sm:py-4">
          <div className="flex min-w-max items-center justify-center gap-x-6 gap-y-2 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400 sm:flex-wrap sm:gap-x-10 sm:text-sm sm:tracking-[0.16em]">
            {[
              'Premiere',
              'Dolby',
              'Online Ticket',
              'Cinema Bar',
              'QR Pass',
            ].map((text) => (
              <span
                key={text}
                className="flex shrink-0 items-center gap-2 sm:gap-3"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                {text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
