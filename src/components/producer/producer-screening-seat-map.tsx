'use client';

import { useMemo } from 'react';
import type {
  ProducerHallSeat,
  ProducerSeatTicket,
} from '@/app/actions/producer';

function SeatIcon({
  className,
  filled = true,
}: {
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 28 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="12" width="24" height="8" rx="1.5" />
      <path d="M5 12V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
    </svg>
  );
}

function formatAmd(value: number): string {
  return `${Math.round(value).toLocaleString('hy-AM')} ֏`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('hy-AM', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_LABELS: Record<ProducerSeatTicket['status'], string> = {
  reserved: 'Ամրագրված — սպասում է վճարման',
  paid: 'Վճարված — մուտք չի սկանավորվել',
  used: 'Ներկա — սկանավորվել է մուտքի մոտ',
  cancelled: 'Չեղարկված',
};

function seatVisual(
  seat: ProducerHallSeat
): { iconClass: string; filled: boolean } {
  const status = seat.ticket?.status;
  const isVip = seat.seatType === 'vip';

  if (!status || status === 'cancelled') {
    return {
      iconClass: isVip
        ? 'text-amber-200'
        : 'text-gray-200',
      filled: false,
    };
  }
  if (status === 'reserved') {
    return { iconClass: 'text-amber-500', filled: true };
  }
  if (status === 'paid') {
    return { iconClass: 'text-purple-600', filled: true };
  }
  if (status === 'used') {
    return { iconClass: 'text-emerald-600', filled: true };
  }
  return { iconClass: 'text-gray-300', filled: false };
}

function SeatTooltipContent({
  seat,
}: {
  seat: ProducerHallSeat;
}) {
  const ticket = seat.ticket;
  const seatLabel = `${seat.row}${seat.number}`;
  const seatType =
    seat.seatType === 'vip'
      ? 'VIP'
      : seat.seatType === 'disabled'
        ? 'Հատուկ'
        : 'Ստանդարտ';

  if (!ticket || ticket.status === 'cancelled') {
    return (
      <div className="text-left text-xs leading-relaxed">
        <p className="font-bold text-gray-900">Տեղ {seatLabel}</p>
        <p className="text-gray-500">{seatType}</p>
        <p className="mt-1 text-emerald-600 font-medium">Ազատ</p>
      </div>
    );
  }

  return (
    <div className="text-left text-xs leading-relaxed">
      <p className="font-bold text-gray-900">Տեղ {seatLabel}</p>
      <p className="text-gray-500">{seatType}</p>
      <p className="mt-1 font-semibold text-purple-700">
        {STATUS_LABELS[ticket.status]}
      </p>
      <p className="text-gray-700">Գին՝ {formatAmd(ticket.price)}</p>
      <p className="text-gray-500">
        Ամրագրված՝ {formatDateTime(ticket.createdAt)}
      </p>
      {ticket.status === 'reserved' && ticket.holdUntil && (
        <p className="text-amber-700">
          Վճարման ժամկետ՝ {formatDateTime(ticket.holdUntil)}
        </p>
      )}
      {ticket.status === 'paid' && (
        <p className="text-purple-600">
          Վճարվել է՝ {formatDateTime(ticket.updatedAt)}
        </p>
      )}
      {ticket.status === 'used' && (
        <p className="text-emerald-700">
          Մուտքի սկանավորում՝ {formatDateTime(ticket.updatedAt)}
        </p>
      )}
    </div>
  );
}

interface Props {
  hallSeats: ProducerHallSeat[];
}

export default function ProducerScreeningSeatMap({ hallSeats }: Props) {
  const seatsByRow = useMemo(() => {
    const map = new Map<string, ProducerHallSeat[]>();
    for (const seat of hallSeats) {
      const list = map.get(seat.row) ?? [];
      list.push(seat);
      map.set(seat.row, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.number - b.number);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [hallSeats]);

  const occupiedCount = hallSeats.filter(
    (s) =>
      s.ticket &&
      ['reserved', 'paid', 'used'].includes(s.ticket.status)
  ).length;

  if (hallSeats.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-400">
        Դահլիճի նստատեղերի սխեման հասանելի չէ
      </p>
    );
  }

  return (
    <div className="mt-3">
      <p className="mb-3 text-xs text-gray-500">
        Զբաղված՝ {occupiedCount} / {hallSeats.length} · Մկնիկը բերեք աթոռի
        վրա՝ մանրամասները տեսնելու համար
      </p>

      <div className="mx-auto w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        {/* Էկրան */}
        <div className="mb-6">
          <div className="mx-auto h-3 max-w-xs rounded-t-[50%] bg-gradient-to-b from-gray-400 to-gray-200 shadow-md" />
          <p className="mt-2 text-center text-[11px] font-medium uppercase tracking-[0.35em] text-gray-400">
            Էկրան
          </p>
        </div>

        {/* Նստատեղեր */}
        <div className="space-y-1.5 overflow-x-auto">
          {seatsByRow.map(([row, seats]) => (
            <div key={row} className="flex items-center gap-1.5">
              <span className="w-5 shrink-0 text-center text-xs font-semibold text-gray-400">
                {row}
              </span>
              <div className="flex flex-1 flex-wrap justify-center gap-1">
                {seats.map((seat) => {
                  const visual = seatVisual(seat);
                  return (
                    <div
                      key={seat.id}
                      className="group relative"
                      title={
                        seat.ticket
                          ? `${seat.row}${seat.number} — ${STATUS_LABELS[seat.ticket.status]}`
                          : `${seat.row}${seat.number} — Ազատ`
                      }
                    >
                      <div
                        className={`flex h-10 w-9 flex-col items-center justify-end rounded-t-sm rounded-b-md transition sm:h-11 sm:w-10 ${visual.iconClass}`}
                      >
                        <SeatIcon
                          className="h-6 w-6 sm:h-7 sm:w-7"
                          filled={visual.filled}
                        />
                        <span className="text-[9px] font-medium leading-none opacity-80">
                          {seat.number}
                        </span>
                      </div>

                      {/* Tooltip */}
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-3 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                        <SeatTooltipContent seat={seat} />
                        <div className="absolute left-1/2 top-full -translate-x-1/2 border-8 border-transparent border-t-white" />
                      </div>
                    </div>
                  );
                })}
              </div>
              <span className="w-5 shrink-0" aria-hidden />
            </div>
          ))}
        </div>

        {/* Լեգենդ */}
        <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-gray-100 pt-4 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <SeatIcon className="h-4 w-4 text-gray-200" filled={false} />
            Ազատ
          </span>
          <span className="flex items-center gap-1.5">
            <SeatIcon className="h-4 w-4 text-amber-500" />
            Ամրագրված
          </span>
          <span className="flex items-center gap-1.5">
            <SeatIcon className="h-4 w-4 text-purple-600" />
            Վճարված
          </span>
          <span className="flex items-center gap-1.5">
            <SeatIcon className="h-4 w-4 text-emerald-600" />
            Ներկա (սկանավորված)
          </span>
        </div>
      </div>
    </div>
  );
}
