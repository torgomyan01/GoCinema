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
  ScanLine,
  Check,
  Trash2,
} from 'lucide-react';
import { formatPrice } from '@/lib/format';
import { isQuantityOnlyProduct } from '@/lib/product-units';
import {
  getQrOrderItems,
  isTicketQrReady,
  ticketNeedsQrScan,
  ticketQrScanProgress,
} from '@/lib/preorder-entry';

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
  entryMode?: boolean;
  onScanPreOrderProducts?: (ticket: any) => void;
  onRemoveOrderItem?: (orderItem: any, ticketId: number) => void;
  removingOrderItemId?: number | null;
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
  entryMode = false,
  onScanPreOrderProducts,
  onRemoveOrderItem,
  removingOrderItemId = null,
}: TicketCardProps) {
  const statusBadge = getStatusBadge(ticket.status);
  const [checked, setChecked] = useState(isChecked);
  const isUsed = ticket.status === 'used';
  const canAddProducts =
    (ticket.status === 'paid' || ticket.status === 'reserved') &&
    !isUsed &&
    Boolean(onAddProducts);
  const isUnpaid = ticket.status === 'reserved';
  const needsQrScan = entryMode && ticketNeedsQrScan(ticket);
  const qrReady = entryMode && isTicketQrReady(ticket);
  const qrProgress = entryMode ? ticketQrScanProgress(ticket) : null;
  const hasQrProducts = entryMode && getQrOrderItems(ticket).length > 0;

  useEffect(() => {
    setChecked(isChecked);
  }, [isChecked]);

  // Մուտքի ռեժիմում միայն վճարված տոմսը կարելի է նշել որպես մուտք գործած
  const checkboxDisabled = isUsed || (entryMode && ticket.status !== 'paid');

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (checkboxDisabled) return;
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
                disabled={checkboxDisabled}
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
                Գին: {formatPrice(ticket.price ?? 0)} ֏
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
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
              <ShoppingCart className="w-3 h-3" />
              Ապրանքներ
            </div>
            <div className="flex items-center gap-2">
              {needsQrScan && onScanPreOrderProducts && (
                <button
                  type="button"
                  onClick={() => onScanPreOrderProducts(ticket)}
                  className="flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700"
                >
                  <ScanLine className="h-3.5 w-3.5" />
                  Սկանավորել ({qrProgress?.done}/{qrProgress?.total})
                </button>
              )}
              {qrReady && hasQrProducts && (
                <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                  <Check className="h-3.5 w-3.5" />
                  QR պատրաստ
                </span>
              )}
              {canAddProducts && (
                <button
                  type="button"
                  onClick={() => onAddProducts?.(Number(ticket.id), ticket.status)}
                  className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isUnpaid ? 'Ավելացնել' : 'Ավելացնել'}
                </button>
              )}
            </div>
          </div>
          {ticket.orderItems?.length > 0 ? (
            <div className="space-y-1">
              {ticket.orderItems.map((item: any) => {
                const canRemove =
                  entryMode &&
                  ticket.status === 'reserved' &&
                  Boolean(onRemoveOrderItem);

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-sm gap-2"
                  >
                    <span className="text-gray-700 truncate min-w-0">
                      {item.product.name} x{item.quantity}
                      {isQuantityOnlyProduct(item.product?.category ?? '') && (
                        <span className="ml-1 text-[10px] text-gray-400">
                          (առանց QR)
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {canRemove && (
                        <button
                          type="button"
                          onClick={() =>
                            onRemoveOrderItem?.(item, Number(ticket.id))
                          }
                          disabled={removingOrderItemId === item.id}
                          className="rounded-md p-1 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                          title="Հեռացնել պատվերից"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <span className="text-gray-600 font-medium">
                        {formatPrice(item.price * item.quantity)} ֏
                      </span>
                    </div>
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
