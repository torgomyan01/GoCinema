'use client';

import { useState, useEffect } from 'react';
import {
  Film,
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  ShoppingCart,
  Plus,
} from 'lucide-react';

interface TicketCardProps {
  ticket: any;
  formatDate: (date: Date | string) => string;
  formatTime: (date: Date | string) => string;
  getStatusBadge: (status: string) => { label: string; color: string };
  getSeatTypeLabel: (seatType: string) => string;
  onCheckedChange?: (ticketId: string, checked: boolean) => void;
  isChecked?: boolean;
  onAddProducts?: (ticketId: number, status: string) => void;
  orderStatus?: string;
}

function getProductItemBadge(item: {
  fulfilledAt?: string | Date | null;
}) {
  if (item.fulfilledAt) {
    return {
      label: 'Տրված է',
      className: 'bg-green-100 text-green-800',
    };
  }
  return {
    label: 'Գնել է · Վճարված է',
    className: 'bg-blue-100 text-blue-800',
  };
}

export default function TicketCard({
  ticket,
  formatDate,
  formatTime,
  getStatusBadge,
  getSeatTypeLabel,
  onCheckedChange,
  isChecked = false,
  onAddProducts,
}: TicketCardProps) {
  const statusBadge = getStatusBadge(ticket.status);
  const [checked, setChecked] = useState(isChecked);
  const isUsed = ticket.status === 'used';
  const canAddProducts =
    (ticket.status === 'paid' || ticket.status === 'reserved') &&
    !isUsed &&
    Boolean(onAddProducts);
  const isUnpaid = ticket.status === 'reserved';

  useEffect(() => {
    setChecked(isChecked);
  }, [isChecked]);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isUsed) return;
    const newChecked = e.target.checked;
    setChecked(newChecked);
    if (onCheckedChange) {
      onCheckedChange(ticket.id, newChecked);
    }
  };

  return (
    <div className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={checked || isUsed}
                onChange={handleCheckboxChange}
                disabled={isUsed}
                className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
              />
              <span className="ml-2 text-sm text-gray-600">
                {isUsed ? 'Մուտք է գործել' : checked ? 'Մուտք է գործել' : 'Չի մուտք գործել'}
              </span>
            </label>
          </div>
          <div className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Film className="w-4 h-4 text-purple-600" />
            {ticket.screening?.movie?.title || 'Անհայտ ֆիլմ'}
            {ticket.screening?.movie?.duration && (
              <span className="text-xs text-gray-500 font-normal">
                ({ticket.screening.movie.duration} րոպե)
              </span>
            )}
          </div>
          <div className="text-sm text-gray-600 space-y-1.5">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {formatDate(ticket.screening?.startTime)}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {formatTime(ticket.screening?.startTime)} -{' '}
              {formatTime(ticket.screening?.endTime)}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>
                {ticket.seat?.row}
                {ticket.seat?.number}
                {ticket.seat?.seatType &&
                  ticket.seat.seatType !== 'standard' && (
                    <span className="ml-1 text-xs text-purple-600">
                      ({getSeatTypeLabel(ticket.seat.seatType)})
                    </span>
                  )}
              </span>
              <span className="text-gray-400">-</span>
              <span>{ticket.screening?.hall?.name}</span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="font-medium text-gray-900">
                Գին: {ticket.price?.toLocaleString('hy-AM')} ֏
              </span>
            </div>
          </div>
        </div>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}
        >
          {statusBadge.label}
        </span>
      </div>

      {(ticket.orderItems?.length > 0 || canAddProducts) && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
              <ShoppingCart className="w-3 h-3" />
              Ապրանքներ:
            </div>
            {canAddProducts && (
              <button
                type="button"
                onClick={() => onAddProducts?.(Number(ticket.id), ticket.status)}
                className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {isUnpaid ? 'Սկանավորել ապրանք' : 'Ավելացնել'}
              </button>
            )}
          </div>
          {ticket.orderItems?.length > 0 ? (
            <div className="space-y-1.5">
              {ticket.orderItems.map((item: any) => {
                const badge = getProductItemBadge(item);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-sm gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-gray-700 truncate">
                        {item.product.name} x{item.quantity}
                      </span>
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <span className="text-gray-600 font-medium shrink-0">
                      {(item.price * item.quantity).toLocaleString('hy-AM')} ֏
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Ապրանքներ չկան</p>
          )}
        </div>
      )}
    </div>
  );
}
