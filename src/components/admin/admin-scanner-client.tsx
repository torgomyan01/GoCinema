'use client';

import { useState, useEffect } from 'react';
import {
  QrCode,
  CheckCircle,
  XCircle,
  Ticket,
  User,
  Calendar,
  Clock,
  MapPin,
  Film,
  ShoppingCart,
  Check,
  X,
  AlertCircle,
  Phone,
  Mail,
  DollarSign,
  CreditCard,
  Plus,
  Maximize2,
  ArrowRight,
  Info,
} from 'lucide-react';
import QRScanner from './qr-scanner';
import TicketCard from './ticket-card';
import {
  getOrderOrTicketByQR,
  markTicketAsUsed,
  markAllTicketsInOrderAsUsed,
} from '@/app/actions/scanner';
import Image from 'next/image';

interface AdminScannerClientProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
  };
}

interface ScannerWindow {
  id: string;
  scannedData: any | null;
  isLoading: boolean;
  error: string | null;
  isMarking: boolean;
  qrCode?: string; // Store the QR code for duplicate detection
  checkedTickets?: Set<string>; // Track which tickets are checked (attended)
  // Map QR code to checked tickets for persistence across page refreshes
  qrCheckedTickets?: Record<string, string[]>; // QR code -> ticket IDs array
}

const STORAGE_KEY = 'admin_scanner_windows';

export default function AdminScannerClient({ user }: AdminScannerClientProps) {
  const [windows, setWindows] = useState<ScannerWindow[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);

  // Load windows from localStorage on mount
  useEffect(() => {
    const savedWindows = localStorage.getItem(STORAGE_KEY);
    if (savedWindows) {
      try {
        const parsed = JSON.parse(savedWindows);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Convert checkedTickets arrays back to Sets
          const restoredWindows = parsed.map((w: any) => ({
            ...w,
            checkedTickets: w.checkedTickets
              ? new Set(w.checkedTickets)
              : new Set(),
            // Restore qrCheckedTickets object (already in correct format)
            qrCheckedTickets: w.qrCheckedTickets || {},
          }));
          setWindows(restoredWindows);
          setActiveWindowId(restoredWindows[0].id);
          return;
        }
      } catch (e) {
        console.error('Error loading scanner windows:', e);
      }
    }
    // Create initial window if none exist
    const initialWindow: ScannerWindow = {
      id: `window-${Date.now()}`,
      scannedData: null,
      isLoading: false,
      error: null,
      isMarking: false,
      checkedTickets: new Set(),
    };
    setWindows([initialWindow]);
    setActiveWindowId(initialWindow.id);
  }, []);

  // Save windows to localStorage whenever they change
  useEffect(() => {
    if (windows.length > 0) {
      // Convert Sets to arrays for JSON serialization
      const serializableWindows = windows.map((w) => ({
        ...w,
        checkedTickets: w.checkedTickets ? Array.from(w.checkedTickets) : [],
        // qrCheckedTickets is already serializable (Record<string, string[]>)
        qrCheckedTickets: w.qrCheckedTickets || {},
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableWindows));
    }
  }, [windows]);

  const createNewWindow = () => {
    const newWindow: ScannerWindow = {
      id: `window-${Date.now()}`,
      scannedData: null,
      isLoading: false,
      error: null,
      isMarking: false,
      checkedTickets: new Set(),
    };
    setWindows([...windows, newWindow]);
    setActiveWindowId(newWindow.id);
  };

  const closeWindow = (windowIdToClose: string) => {
    // Get current state to show confirmation
    const windowToClose = windows.find((w) => w.id === windowIdToClose);
    if (!windowToClose) return;

    const windowIndex = windows.findIndex((w) => w.id === windowIdToClose);
    const confirmMessage = `Դուք ցանկանու՞մ եք փակել "Պատուհան ${windowIndex + 1}"-ը${
      windowToClose.scannedData ? ' (կան սկանավորված տվյալներ)' : ''
    }?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    // Use functional update to ensure we're working with the latest state
    setWindows((prevWindows) => {
      // Filter out ONLY the window we want to close
      const filteredWindows = prevWindows.filter(
        (w) => w.id !== windowIdToClose
      );

      if (filteredWindows.length === 0) {
        // If closing last window, create a new one
        const initialWindow: ScannerWindow = {
          id: `window-${Date.now()}`,
          scannedData: null,
          isLoading: false,
          error: null,
          isMarking: false,
          checkedTickets: new Set(),
        };
        // Update active window after state update
        setTimeout(() => {
          setActiveWindowId(initialWindow.id);
        }, 0);
        return [initialWindow];
      }

      // Update active window if the closed window was active
      // Use the filtered windows array to get the new active window
      if (activeWindowId === windowIdToClose) {
        setTimeout(() => {
          setActiveWindowId(filteredWindows[0].id);
        }, 0);
      }

      return filteredWindows;
    });
  };

  const updateWindow = (windowId: string, updates: Partial<ScannerWindow>) => {
    setWindows(
      windows.map((w) => (w.id === windowId ? { ...w, ...updates } : w))
    );
  };

  const findWindowByQRCode = (qrData: string): ScannerWindow | null => {
    return (
      windows.find(
        (w) =>
          w.qrCode === qrData &&
          w.scannedData !== null &&
          w.id !== activeWindowId
      ) || null
    );
  };

  const handleScanSuccess = async (windowId: string, qrData: string) => {
    // Check if this QR code is already open in another window
    const existingWindow = findWindowByQRCode(qrData);
    if (existingWindow) {
      const windowIndex = windows.findIndex((w) => w.id === existingWindow.id);
      updateWindow(windowId, {
        isLoading: false,
        error: `Այս QR կոդը արդեն բացված է "Պատուհան ${windowIndex + 1}"-ում`,
        scannedData: null,
        qrCode: qrData,
      });
      return;
    }

    // Get the current window to preserve checkedTickets
    const currentWindow = windows.find((w) => w.id === windowId);
    const previousCheckedTickets = currentWindow?.checkedTickets || new Set();

    updateWindow(windowId, {
      isLoading: true,
      error: null,
      scannedData: null,
      qrCode: qrData,
      // Preserve checkedTickets when scanning new QR code
      checkedTickets: previousCheckedTickets,
    });

    try {
      const result = await getOrderOrTicketByQR(qrData);
      if (result.success && result.data) {
        // Restore checkedTickets from current window's qrCheckedTickets object
        const currentWindow = windows.find((w) => w.id === windowId);
        let restoredCheckedTickets = new Set<string>();

        if (currentWindow?.qrCheckedTickets?.[qrData]) {
          restoredCheckedTickets = new Set(
            currentWindow.qrCheckedTickets[qrData]
          );
        }

        updateWindow(windowId, {
          scannedData: {
            type: result.type,
            data: result.data,
          },
          isLoading: false,
          qrCode: qrData,
          checkedTickets:
            restoredCheckedTickets.size > 0
              ? restoredCheckedTickets
              : previousCheckedTickets,
          qrCheckedTickets: currentWindow?.qrCheckedTickets || {},
        });
      } else {
        updateWindow(windowId, {
          error: result.error || 'QR կոդը ստուգելիս սխալ է տեղի ունեցել',
          isLoading: false,
          qrCode: undefined,
        });
      }
    } catch (err) {
      console.error('Error scanning QR:', err);
      updateWindow(windowId, {
        error: 'QR կոդը ստուգելիս սխալ է տեղի ունեցել',
        isLoading: false,
        qrCode: undefined,
      });
    }
  };

  const handleTicketCheckedChange = (
    windowId: string,
    ticketId: string,
    checked: boolean
  ) => {
    setWindows((prevWindows) =>
      prevWindows.map((w) => {
        if (w.id === windowId) {
          const checkedTickets = new Set(w.checkedTickets || []);
          if (checked) {
            checkedTickets.add(ticketId);
          } else {
            checkedTickets.delete(ticketId);
          }

          // Also save checkedTickets per QR code for persistence
          const qrCheckedTickets = w.qrCheckedTickets || {};
          if (w.qrCode) {
            const qrTickets = new Set(qrCheckedTickets[w.qrCode] || []);
            if (checked) {
              qrTickets.add(ticketId);
            } else {
              qrTickets.delete(ticketId);
            }
            qrCheckedTickets[w.qrCode] = Array.from(qrTickets);
          }

          return { ...w, checkedTickets, qrCheckedTickets };
        }
        return w;
      })
    );
  };

  const handleMarkAsUsed = async (windowId: string) => {
    const window = windows.find((w) => w.id === windowId);
    if (!window || !window.scannedData) return;

    updateWindow(windowId, { isMarking: true, error: null });

    try {
      let result;
      if (window.scannedData.type === 'order') {
        result = await markAllTicketsInOrderAsUsed(window.scannedData.data.id);
      } else {
        result = await markTicketAsUsed(window.scannedData.data.id);
      }

      if (result.success) {
        // Reload the data
        const qrData =
          window.scannedData.type === 'order'
            ? `ORDER-${window.scannedData.data.id}`
            : `TICKET-${window.scannedData.data.id}`;
        await handleScanSuccess(windowId, qrData);
        alert(
          result.message || 'Տոմս(եր)ը հաջողությամբ նշվեց(ին) որպես օգտագործված'
        );
      } else {
        updateWindow(windowId, {
          error: result.error || 'Տոմսը նշելիս սխալ է տեղի ունեցել',
          isMarking: false,
        });
      }
    } catch (err) {
      console.error('Error marking ticket as used:', err);
      updateWindow(windowId, {
        error: 'Տոմսը նշելիս սխալ է տեղի ունեցել',
        isMarking: false,
      });
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const weekdays = [
      'կիրակի',
      'երկուշաբթի',
      'երեքշաբթի',
      'չորեքշաբթի',
      'հինգշաբթի',
      'ուրբաթ',
      'շաբաթ',
    ];
    const months = [
      'հունվար',
      'փետրվար',
      'մարտ',
      'ապրիլ',
      'մայիս',
      'հունիս',
      'հուլիս',
      'օգոստոս',
      'սեպտեմբեր',
      'հոկտեմբեր',
      'նոյեմբեր',
      'դեկտեմբեր',
    ];
    return `${weekdays[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('hy-AM', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      reserved: { label: 'Ամրագրված', color: 'bg-yellow-100 text-yellow-800' },
      paid: { label: 'Վճարված', color: 'bg-green-100 text-green-800' },
      used: { label: 'Օգտագործված', color: 'bg-blue-100 text-blue-800' },
      cancelled: { label: 'Չեղարկված', color: 'bg-red-100 text-red-800' },
      pending: { label: 'Սպասվում է', color: 'bg-gray-100 text-gray-800' },
      completed: { label: 'Ավարտված', color: 'bg-green-100 text-green-800' },
    };
    return (
      badges[status] || { label: status, color: 'bg-gray-100 text-gray-800' }
    );
  };

  const formatPhone = (phone: string | null | undefined): string => {
    if (!phone) return 'Չկա';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 9 && cleaned.startsWith('0')) {
      const digits = cleaned.slice(1);
      return `0${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
    }
    return phone;
  };

  const getSeatTypeLabel = (seatType: string): string => {
    const types: Record<string, string> = {
      standard: 'Ստանդարտ',
      vip: 'VIP',
      disabled: 'Հասանելի',
    };
    return types[seatType] || seatType;
  };

  const getPaymentMethodLabel = (method: string): string => {
    const methods: Record<string, string> = {
      card: 'Քարտ',
      bank_transfer: 'Բանկային փոխանցում',
      cash: 'Կանխիկ',
    };
    return methods[method] || method;
  };

  const activeWindow = windows.find((w) => w.id === activeWindowId);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <QrCode className="w-6 h-6 text-purple-600" />
            </div>
            Հաճախորդի մուտք
          </h1>
          <p className="text-gray-600">
            Սկանավորեք հաճախորդի QR կոդը տոմսը ստուգելու և փակելու համար
          </p>
        </div>
        <button
          onClick={createNewWindow}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Նոր Պատուհան
        </button>
      </div>

      {/* Windows Tabs */}
      {windows.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {windows.map((window) => (
            <div
              key={window.id}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all ${
                activeWindowId === window.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setActiveWindowId(window.id)}
            >
              <QrCode className="w-4 h-4" />
              <span className="text-sm font-medium">
                Պատուհան {windows.indexOf(window) + 1}
              </span>
              {window.scannedData && (
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              )}
              {windows.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeWindow(window.id);
                  }}
                  className="ml-1 hover:bg-white/20 rounded p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {activeWindow ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Scanner */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              QR Կոդ Սկանավորում
              {windows.length > 1 && (
                <span className="text-sm text-gray-500 font-normal ml-2">
                  (Պատուհան {windows.indexOf(activeWindow) + 1})
                </span>
              )}
            </h2>
            <QRScanner
              key={activeWindow.id}
              onScanSuccess={(qrData) =>
                handleScanSuccess(activeWindow.id, qrData)
              }
              onError={(err) => updateWindow(activeWindow.id, { error: err })}
            />
            {activeWindow.isLoading && (
              <div className="mt-4 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                <p className="mt-2 text-gray-600">Ստուգվում է...</p>
              </div>
            )}
            {activeWindow.error && (
              <div
                className={`mt-4 p-4 rounded-lg ${
                  activeWindow.error.includes('արդեն բացված է')
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {activeWindow.error.includes('արդեն բացված է') ? (
                    <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p
                      className={
                        activeWindow.error.includes('արդեն բացված է')
                          ? 'text-blue-700'
                          : 'text-red-700'
                      }
                    >
                      {activeWindow.error}
                    </p>
                    {activeWindow.error.includes('արդեն բացված է') &&
                      activeWindow.qrCode && (
                        <button
                          onClick={() => {
                            const existingWindow = windows.find(
                              (w) =>
                                w.qrCode === activeWindow.qrCode &&
                                w.id !== activeWindow.id &&
                                w.scannedData !== null
                            );
                            if (existingWindow) {
                              setActiveWindowId(existingWindow.id);
                              // Clear error from current window
                              updateWindow(activeWindow.id, {
                                error: null,
                                qrCode: undefined,
                              });
                            }
                          }}
                          className="mt-3 flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors text-sm"
                        >
                          <ArrowRight className="w-4 h-4" />
                          Անցնել այդ պատուհանին
                        </button>
                      )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Scanned Data */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Տոմսի/Պատվերի Տեղեկություն
            </h2>
            {!activeWindow.scannedData ? (
              <div className="text-center py-12 text-gray-500">
                <QrCode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Սկանավորեք QR կոդը տեղեկություն ստանալու համար</p>
              </div>
            ) : activeWindow.scannedData.type === 'order' ? (
              <div className="space-y-4">
                {/* Order Info */}
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 text-lg">
                      Պատվեր #{activeWindow.scannedData.data.id}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(activeWindow.scannedData.data.status).color}`}
                    >
                      {
                        getStatusBadge(activeWindow.scannedData.data.status)
                          .label
                      }
                    </span>
                  </div>

                  {/* User Info */}
                  <div className="mb-3 pb-3 border-b border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-purple-600" />
                      <span className="font-medium text-gray-900">
                        {activeWindow.scannedData.data.user?.name ||
                          `Օգտատեր #${activeWindow.scannedData.data.user?.id}`}
                      </span>
                    </div>
                    {activeWindow.scannedData.data.user?.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        {formatPhone(activeWindow.scannedData.data.user.phone)}
                      </div>
                    )}
                    {activeWindow.scannedData.data.user?.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4" />
                        {activeWindow.scannedData.data.user.email}
                      </div>
                    )}
                  </div>

                  {/* Order Summary */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">
                        Ստեղծվել է:{' '}
                        {formatDate(activeWindow.scannedData.data.createdAt)}{' '}
                        {formatTime(activeWindow.scannedData.data.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-purple-200">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-gray-900">
                          Ընդհանուր գումար:
                        </span>
                      </div>
                      <span className="font-bold text-lg text-green-600">
                        {activeWindow.scannedData.data.totalAmount?.toLocaleString(
                          'hy-AM'
                        )}{' '}
                        ֏
                      </span>
                    </div>

                    {/* Calculate totals */}
                    {(() => {
                      const ticketsTotal =
                        activeWindow.scannedData.data.tickets?.reduce(
                          (sum: number, t: any) => sum + (t.price || 0),
                          0
                        ) || 0;
                      const productsTotal =
                        activeWindow.scannedData.data.tickets?.reduce(
                          (sum: number, t: any) => {
                            const ticketProducts =
                              t.orderItems?.reduce(
                                (itemSum: number, item: any) =>
                                  itemSum + item.price * item.quantity,
                                0
                              ) || 0;
                            return sum + ticketProducts;
                          },
                          0
                        ) || 0;

                      return (
                        <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-purple-200">
                          <div className="flex justify-between">
                            <span>
                              Տոմսեր (
                              {activeWindow.scannedData.data.tickets?.length ||
                                0}
                              ):
                            </span>
                            <span>
                              {ticketsTotal.toLocaleString('hy-AM')} ֏
                            </span>
                          </div>
                          {productsTotal > 0 && (
                            <div className="flex justify-between">
                              <span>Արտադրանքներ:</span>
                              <span>
                                {productsTotal.toLocaleString('hy-AM')} ֏
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Tickets */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Ticket className="w-5 h-5" />
                      Տոմսեր ({activeWindow.scannedData.data.tickets.length})
                    </h4>
                    {activeWindow.checkedTickets && (
                      <div className="text-sm text-gray-600 flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          Մուտք գործած:{' '}
                          <span className="font-semibold text-green-600">
                            {activeWindow.checkedTickets.size}
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <XCircle className="w-4 h-4 text-gray-400" />
                          Չի մուտք գործել:{' '}
                          <span className="font-semibold text-gray-600">
                            {activeWindow.scannedData.data.tickets.length -
                              activeWindow.checkedTickets.size}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {activeWindow.scannedData.data.tickets.map(
                      (ticket: any) => (
                        <TicketCard
                          key={ticket.id}
                          ticket={ticket}
                          formatDate={formatDate}
                          formatTime={formatTime}
                          getStatusBadge={getStatusBadge}
                          getSeatTypeLabel={getSeatTypeLabel}
                          onCheckedChange={(ticketId, checked) =>
                            handleTicketCheckedChange(
                              activeWindow.id,
                              ticketId,
                              checked
                            )
                          }
                          isChecked={
                            activeWindow.checkedTickets?.has(ticket.id) || false
                          }
                        />
                      )
                    )}
                  </div>
                </div>

                {/* Action Button */}
                {activeWindow.scannedData.data.tickets.some(
                  (t: any) => t.status === 'paid'
                ) && (
                  <button
                    onClick={() => handleMarkAsUsed(activeWindow.id)}
                    disabled={activeWindow.isMarking}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {activeWindow.isMarking ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Նշվում է...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Նշել բոլոր տոմսերը որպես օգտագործված
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Ticket Info */}
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 text-lg">
                      Տոմս #{activeWindow.scannedData.data.id}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(activeWindow.scannedData.data.status).color}`}
                    >
                      {
                        getStatusBadge(activeWindow.scannedData.data.status)
                          .label
                      }
                    </span>
                  </div>

                  {/* User Info */}
                  <div className="mb-3 pb-3 border-b border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-purple-600" />
                      <span className="font-medium text-gray-900">
                        {activeWindow.scannedData.data.user?.name ||
                          `Օգտատեր #${activeWindow.scannedData.data.user?.id}`}
                      </span>
                    </div>
                    {activeWindow.scannedData.data.user?.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        {formatPhone(activeWindow.scannedData.data.user.phone)}
                      </div>
                    )}
                    {activeWindow.scannedData.data.user?.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4" />
                        {activeWindow.scannedData.data.user.email}
                      </div>
                    )}
                  </div>

                  {/* Ticket Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">
                        Ստեղծվել է:{' '}
                        {formatDate(activeWindow.scannedData.data.createdAt)}{' '}
                        {formatTime(activeWindow.scannedData.data.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-purple-200">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-gray-900">Գին:</span>
                      </div>
                      <span className="font-bold text-lg text-green-600">
                        {activeWindow.scannedData.data.price?.toLocaleString(
                          'hy-AM'
                        )}{' '}
                        ֏
                      </span>
                    </div>
                  </div>
                </div>

                {/* Movie Info */}
                {activeWindow.scannedData.data.screening?.movie && (
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start gap-4">
                      {activeWindow.scannedData.data.screening.movie.image && (
                        <Image
                          src={
                            activeWindow.scannedData.data.screening.movie.image
                          }
                          alt={
                            activeWindow.scannedData.data.screening.movie.title
                          }
                          width={80}
                          height={120}
                          className="rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <Film className="w-4 h-4 text-purple-600" />
                          {activeWindow.scannedData.data.screening.movie.title}
                          {activeWindow.scannedData.data.screening.movie
                            .duration && (
                            <span className="text-xs text-gray-500 font-normal">
                              (
                              {
                                activeWindow.scannedData.data.screening.movie
                                  .duration
                              }{' '}
                              րոպե)
                            </span>
                          )}
                        </h4>
                        <div className="text-sm text-gray-600 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {formatDate(
                              activeWindow.scannedData.data.screening.startTime
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {formatTime(
                              activeWindow.scannedData.data.screening.startTime
                            )}{' '}
                            -{' '}
                            {formatTime(
                              activeWindow.scannedData.data.screening.endTime
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>
                              {activeWindow.scannedData.data.seat?.row}
                              {activeWindow.scannedData.data.seat?.number}
                              {activeWindow.scannedData.data.seat?.seatType &&
                                activeWindow.scannedData.data.seat.seatType !==
                                  'standard' && (
                                  <span className="ml-1 text-xs text-purple-600">
                                    (
                                    {getSeatTypeLabel(
                                      activeWindow.scannedData.data.seat
                                        .seatType
                                    )}
                                    )
                                  </span>
                                )}
                            </span>
                            <span className="text-gray-400">-</span>
                            <span>
                              {
                                activeWindow.scannedData.data.screening.hall
                                  ?.name
                              }
                            </span>
                            {activeWindow.scannedData.data.screening.hall
                              ?.capacity && (
                              <span className="text-xs text-gray-400">
                                (
                                {
                                  activeWindow.scannedData.data.screening.hall
                                    .capacity
                                }{' '}
                                տեղ)
                              </span>
                            )}
                          </div>
                          {activeWindow.scannedData.data.screening
                            .basePrice && (
                            <div className="flex items-center gap-2 text-xs text-gray-500 pt-1 border-t border-gray-100">
                              <span>
                                Հիմնական գին:{' '}
                                {activeWindow.scannedData.data.screening.basePrice.toLocaleString(
                                  'hy-AM'
                                )}{' '}
                                ֏
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Products */}
                {activeWindow.scannedData.data.order?.orderItems &&
                  activeWindow.scannedData.data.order.orderItems.length > 0 && (
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-purple-600" />
                        Արտադրանքներ (
                        {activeWindow.scannedData.data.order.orderItems.length})
                      </h4>
                      <div className="space-y-2 mb-3">
                        {activeWindow.scannedData.data.order.orderItems.map(
                          (item: any) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded"
                            >
                              <div className="flex-1">
                                <span className="text-gray-900 font-medium">
                                  {item.product.name}
                                </span>
                                <span className="text-gray-500 ml-2">
                                  x{item.quantity}
                                </span>
                                {item.product.category && (
                                  <span className="text-xs text-gray-400 ml-2">
                                    ({item.product.category})
                                  </span>
                                )}
                              </div>
                              <span className="text-gray-700 font-medium">
                                {(item.price * item.quantity).toLocaleString(
                                  'hy-AM'
                                )}{' '}
                                ֏
                              </span>
                            </div>
                          )
                        )}
                      </div>
                      <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">
                          Ընդհանուր:
                        </span>
                        <span className="text-lg font-bold text-green-600">
                          {activeWindow.scannedData.data.order.orderItems
                            .reduce(
                              (sum: number, item: any) =>
                                sum + item.price * item.quantity,
                              0
                            )
                            .toLocaleString('hy-AM')}{' '}
                          ֏
                        </span>
                      </div>
                    </div>
                  )}

                {/* Action Button */}
                {activeWindow.scannedData.data.status === 'paid' && (
                  <button
                    onClick={() => handleMarkAsUsed(activeWindow.id)}
                    disabled={activeWindow.isMarking}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {activeWindow.isMarking ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Նշվում է...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Նշել տոմսը որպես օգտագործված
                      </>
                    )}
                  </button>
                )}

                {activeWindow.scannedData.data.status === 'used' && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    <p className="text-blue-700">Տոմսը արդեն օգտագործված է</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
