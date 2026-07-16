'use client';

import { useState, useEffect, useMemo } from 'react';
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
  ScanLine,
  Trash2,
} from 'lucide-react';
import { Search, Banknote } from 'lucide-react';
import QRScanner from './qr-scanner';
import TicketCard from './ticket-card';
import ProductScanSaleModal from './product-scan-sale-modal';
import TicketPreOrderScanModal from './ticket-preorder-scan-modal';
import PaymentPanel, { type PaymentMethod } from './box-office-payment-panel';
import { getBoxOfficeProducts } from '@/app/actions/box-office';
import {
  getOrderOrTicketByQR,
  markTicketAsUsed,
  unmarkTicketAsUsed,
  markAllTicketsInOrderAsUsed,
  findReservations,
  payReservationAtCounter,
  addTicketProducts,
  lookupPreOrderProductQrForTicket,
  completeTicketEntry,
  attachTicketPreOrderQrs,
  removeTicketOrderItem,
  confirmTicketEntryFulfillment,
  confirmOrderEntryFulfillment,
  getCustomerTicketsForScanner,
  mergeReservedTicketsIntoOrder,
  type CustomerScannerTicketRow,
} from '@/app/actions/scanner';
import { lookupSaleProductByQr } from '@/app/actions/products';
import { buildProductSaleInput, isHdmAgentEnabled } from '@/lib/hdm-agent';
import { submitSaleFiscal, type FiscalNotice } from '@/lib/fiscal-flow';
import { ticketNeedsQrScan, ticketQrScanProgress } from '@/lib/preorder-entry';
import Image from 'next/image';

interface ScannerFiscalData {
  orderId: number | null;
  ticketId?: number;
  paymentMethod: 'cash' | 'card';
  total: number;
  lines: Array<{
    name: string;
    price: number;
    qty: number;
    eMark?: string | null;
    isTicket?: boolean;
  }>;
  needsFulfillmentConfirm?: boolean;
}

async function fireScannerFiscal(
  fiscal: ScannerFiscalData | null | undefined
): Promise<FiscalNotice | null> {
  if (!fiscal || !isHdmAgentEnabled()) return null;
  if (!fiscal.lines || fiscal.lines.length === 0 || fiscal.total <= 0) {
    return null;
  }
  return submitSaleFiscal({
    input: buildProductSaleInput({
      paymentMethod: fiscal.paymentMethod,
      total: fiscal.total,
      lines: fiscal.lines,
    }),
    source: 'scanner',
    orderId: fiscal.orderId ?? undefined,
    ticketId: fiscal.ticketId ?? undefined,
  });
}

interface ReservationSearchTicket {
  id: number;
  status: string;
  seatLabel: string;
  movieTitle: string | null;
  startTime: string | Date | null;
}

interface ReservationSearchResult {
  orderId: number;
  qrCode: string;
  userName: string | null;
  userPhone: string | null;
  isBlocked: boolean;
  movieTitle: string | null;
  startTime: string | Date | null;
  seatCount: number;
  reservedCount: number;
  paidCount: number;
  usedCount: number;
  totalAmount: number;
  status: string;
  tickets: ReservationSearchTicket[];
}

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

  // Ամրագրումների որոնում (հեռախոս / պատվերի համար)
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ReservationSearchResult[]>(
    []
  );
  const [searchError, setSearchError] = useState<string | null>(null);

  // Դրամարկղ-վճարման վիճակ (ակտիվ պատուհանի համար)
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payCash, setPayCash] = useState<number | ''>('');
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Մուտքի կետում ապրանքների վաճառք
  const [scannerProducts, setScannerProducts] = useState<
    {
      id: number;
      name: string;
      price: number;
      category: string;
      image?: string | null;
      stock: number;
    }[]
  >([]);
  const [productModalTicketId, setProductModalTicketId] = useState<
    number | null
  >(null);
  const [productModalStatus, setProductModalStatus] = useState<string>('paid');
  const [isAddingProducts, setIsAddingProducts] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);

  const [scanModalTicket, setScanModalTicket] = useState<any | null>(null);
  const [isCompletingEntry, setIsCompletingEntry] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [removingOrderItemId, setRemovingOrderItemId] = useState<number | null>(
    null
  );

  const [customerTicketsModalOpen, setCustomerTicketsModalOpen] =
    useState(false);
  const [customerTickets, setCustomerTickets] = useState<
    CustomerScannerTicketRow[]
  >([]);
  const [customerTicketsLoading, setCustomerTicketsLoading] = useState(false);
  const [customerTicketsError, setCustomerTicketsError] = useState<
    string | null
  >(null);
  const [selectedMergeTicketIds, setSelectedMergeTicketIds] = useState<
    Set<number>
  >(new Set());
  const [isMergingTickets, setIsMergingTickets] = useState(false);

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

  // Ակտիվ պատուհանը փոխվելիս զրոյացնում ենք վճարման դաշտերը
  useEffect(() => {
    setPayMethod('cash');
    setPayCash('');
    setPayError(null);
  }, [activeWindowId]);

  useEffect(() => {
    void (async () => {
      const result = await getBoxOfficeProducts();
      if (result.success) {
        setScannerProducts(
          result.products as {
            id: number;
            name: string;
            price: number;
            category: string;
            image?: string | null;
            stock: number;
          }[]
        );
      }
    })();
  }, []);

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      const result = await findReservations(q);
      if (result.success) {
        setSearchResults(result.results as ReservationSearchResult[]);
        if (result.results.length === 0) {
          setSearchError('Պատվերներ չեն գտնվել');
        }
      } else {
        setSearchError(result.error || 'Որոնելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error searching reservations:', err);
      setSearchError('Որոնելիս սխալ է տեղի ունեցել');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (result: ReservationSearchResult) => {
    if (!activeWindowId) return;
    setSearchResults([]);
    setSearchQuery('');
    setSearchError(null);
    handleScanSuccess(activeWindowId, result.qrCode);
  };

  const handlePayReservation = async (windowId: string, total: number) => {
    const win = windows.find((w) => w.id === windowId);
    if (!win || !win.scannedData) return;
    const orderId =
      win.scannedData.type === 'order'
        ? win.scannedData.data.id
        : win.scannedData.data.order?.id;
    if (!orderId) {
      setPayError('Պատվերը չի գտնվել');
      return;
    }

    if (payMethod === 'cash') {
      const received = payCash === '' ? NaN : Number(payCash);
      if (!Number.isFinite(received) || received < total) {
        setPayError('Ստացված կանխիկ գումարը չի կարող պակաս լինել ընդհանուրից');
        return;
      }
    }

    setIsPaying(true);
    setPayError(null);
    try {
      const result = await payReservationAtCounter({
        orderId,
        method: payMethod,
        amountPaid: payMethod === 'cash' ? Number(payCash) : undefined,
      });
      if (result.success) {
        setPayCash('');
        setPayMethod('cash');
        const fiscalNotice = await fireScannerFiscal(
          (result as { fiscal?: ScannerFiscalData | null }).fiscal
        );
        await handleScanSuccess(windowId, `ORDER-${orderId}`);
        alert(
          `${result.message}${
            payMethod === 'cash' && result.change
              ? ` • Մանր՝ ${result.change.toLocaleString()} ֏`
              : ''
          }${fiscalNotice?.message ? `\n${fiscalNotice.message}` : ''}`
        );
      } else {
        setPayError(result.error || 'Վճարումը մշակելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error paying reservation:', err);
      setPayError('Վճարումը մշակելիս սխալ է տեղի ունեցել');
    } finally {
      setIsPaying(false);
    }
  };

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
          isMarking: false,
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

  const openScanModal = (ticket: any) => {
    setEntryError(null);
    setScanModalTicket(ticket);
  };

  const closeScanModal = () => {
    setScanModalTicket(null);
    setEntryError(null);
  };

  const handleRemoveOrderItem = async (orderItem: any, _ticketId: number) => {
    if (!activeWindow?.qrCode) return;

    const label = `${orderItem.product?.name ?? 'Ապրանք'} x${orderItem.quantity}`;
    if (
      !window.confirm(
        `Հեռացնե՞լ «${label}»-ը պատվերից։\nԳումարը կնվազի վճարման ընդհանուրից։`
      )
    ) {
      return;
    }

    setRemovingOrderItemId(orderItem.id);
    try {
      const result = await removeTicketOrderItem(orderItem.id);
      if (result.success) {
        setScanModalTicket((prev: any | null) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            orderItems: (prev.orderItems ?? []).filter(
              (i: { id: number }) => i.id !== orderItem.id
            ),
          };
          return ticketNeedsQrScan(updated) ? updated : null;
        });
        await handleScanSuccess(activeWindow.id, activeWindow.qrCode);
        if (result.message) alert(result.message);
      } else {
        alert(result.error || 'Ապրանքը հեռացնելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error removing order item:', err);
      alert('Ապրանքը հեռացնելիս սխալ է տեղի ունեցել');
    } finally {
      setRemovingOrderItemId(null);
    }
  };

  const runEntryFiscal = async (
    windowId: string,
    fiscal: ScannerFiscalData | null | undefined,
    isOrder: boolean,
    orderOrTicketId: number
  ) => {
    if (!fiscal) return null;

    const notice = await fireScannerFiscal(fiscal);
    if (fiscal.needsFulfillmentConfirm) {
      const shouldConfirm = !isHdmAgentEnabled() || notice?.type === 'success';
      if (shouldConfirm) {
        if (isOrder) {
          await confirmOrderEntryFulfillment(orderOrTicketId);
        } else {
          await confirmTicketEntryFulfillment(orderOrTicketId);
        }
      }
    }
    return notice?.message ?? null;
  };

  const handleAttachReservedQrs = async (
    items: Array<{ orderItemId: number; qrCodes: string[]; quantity: number }>
  ) => {
    if (!scanModalTicket || !activeWindow?.qrCode) return;

    setIsCompletingEntry(true);
    setEntryError(null);
    try {
      const result = await attachTicketPreOrderQrs({
        ticketId: Number(scanModalTicket.id),
        items,
      });

      if (result.success) {
        closeScanModal();
        await handleScanSuccess(activeWindow.id, activeWindow.qrCode);
        alert(result.message || 'QR-ները կցվեցին');
      } else {
        setEntryError(result.error || 'QR-ները կցելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error attaching reserved QRs:', err);
      setEntryError('QR-ները կցելիս սխալ է տեղի ունեցել');
    } finally {
      setIsCompletingEntry(false);
    }
  };

  const handleScanModalComplete = (
    items: Array<{ orderItemId: number; qrCodes: string[]; quantity: number }>
  ) => {
    if (
      scanModalTicket?.status === 'reserved' ||
      scanModalTicket?.status === 'awaiting_payment'
    ) {
      void handleAttachReservedQrs(items);
    } else {
      void handleCompleteTicketEntry(items);
    }
  };

  const handleCompleteTicketEntry = async (
    items: Array<{ orderItemId: number; qrCodes: string[]; quantity: number }>
  ) => {
    if (!scanModalTicket || !activeWindow?.qrCode) return;

    setIsCompletingEntry(true);
    setEntryError(null);
    try {
      const result = await completeTicketEntry({
        ticketId: Number(scanModalTicket.id),
        items,
      });

      if (result.success) {
        const fiscalMessage = await runEntryFiscal(
          activeWindow.id,
          (result as { fiscal?: ScannerFiscalData | null }).fiscal,
          false,
          Number(scanModalTicket.id)
        );
        closeScanModal();
        await handleScanSuccess(activeWindow.id, activeWindow.qrCode);
        alert(
          `${result.message || 'Մուտքը հաստատված է'}${
            fiscalMessage ? `\n${fiscalMessage}` : ''
          }`
        );
      } else {
        setEntryError(result.error || 'Մուտքը հաստատելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error completing ticket entry:', err);
      setEntryError('Մուտքը հաստատելիս սխալ է տեղի ունեցել');
    } finally {
      setIsCompletingEntry(false);
    }
  };

  const handleMarkTicketUsed = async (ticketId: number): Promise<boolean> => {
    const win = activeWindow;
    if (!win || !win.scannedData || !win.qrCode) return false;

    const ticket =
      win.scannedData.type === 'order'
        ? (win.scannedData.data.tickets ?? []).find(
            (t: any) => Number(t.id) === ticketId
          )
        : win.scannedData.data;

    if (!ticket) return false;
    if (ticket.status === 'used') return true;
    if (ticket.status !== 'paid') {
      alert('Տոմսը նախ պետք է վճարվի դրամարկղում');
      return false;
    }

    // Եթե կան չսկանավորված QR ապրանքներ՝ բացում ենք սկան-մոդալը (մուտքն այնտեղ է հաստատվում)
    if (ticketNeedsQrScan(ticket)) {
      openScanModal(ticket);
      return false;
    }

    try {
      const result = await markTicketAsUsed(ticketId);
      if (result.success) {
        const fiscalMessage = await runEntryFiscal(
          win.id,
          (result as { fiscal?: ScannerFiscalData | null }).fiscal,
          false,
          ticketId
        );
        await handleScanSuccess(win.id, win.qrCode);
        if (fiscalMessage) alert(fiscalMessage);
        return true;
      }
      alert(result.error || 'Տոմսը նշելիս սխալ է տեղի ունեցել');
      return false;
    } catch (err) {
      console.error('Error marking ticket as used:', err);
      alert('Տոմսը նշելիս սխալ է տեղի ունեցել');
      return false;
    }
  };

  const handleUnmarkTicketUsed = async (ticketId: number): Promise<boolean> => {
    const win = activeWindow;
    if (!win || !win.scannedData || !win.qrCode) return false;

    const ticket =
      win.scannedData.type === 'order'
        ? (win.scannedData.data.tickets ?? []).find(
            (t: any) => Number(t.id) === ticketId
          )
        : win.scannedData.data;

    if (!ticket) return false;
    if (ticket.status !== 'used') return true;

    try {
      const result = await unmarkTicketAsUsed(ticketId);
      if (result.success) {
        await handleScanSuccess(win.id, win.qrCode);
        return true;
      }
      alert(result.error || 'Տոմսը վերադարձնելիս սխալ է տեղի ունեցել');
      return false;
    } catch (err) {
      console.error('Error unmarking ticket as used:', err);
      alert('Տոմսը վերադարձնելիս սխալ է տեղի ունեցել');
      return false;
    }
  };

  const handleTicketEntryChange = async (
    ticketId: number,
    checked: boolean
  ): Promise<boolean> => {
    if (checked) {
      return handleMarkTicketUsed(ticketId);
    }
    return handleUnmarkTicketUsed(ticketId);
  };

  const handleMarkAsUsed = async (windowId: string) => {
    const window = windows.find((w) => w.id === windowId);
    if (!window || !window.scannedData) return;

    const isOrder = window.scannedData.type === 'order';

    if (!isOrder) {
      const ticket = window.scannedData.data;
      if (ticketNeedsQrScan(ticket)) {
        openScanModal(ticket);
        return;
      }
    } else {
      const pending = (window.scannedData.data.tickets ?? []).filter(
        (t: any) => t.status === 'paid' && ticketNeedsQrScan(t)
      );
      if (pending.length > 0) {
        updateWindow(windowId, {
          error: `Նախ սկանավորեք ապրանքների QR-ները (${pending.length} տոմս)`,
        });
        return;
      }
    }

    updateWindow(windowId, { isMarking: true, error: null });

    try {
      let result;
      if (isOrder) {
        result = await markAllTicketsInOrderAsUsed(window.scannedData.data.id);
      } else {
        result = await markTicketAsUsed(window.scannedData.data.id);
      }

      if (result.success) {
        const fiscalMessage = await runEntryFiscal(
          windowId,
          (result as { fiscal?: ScannerFiscalData | null }).fiscal,
          isOrder,
          window.scannedData.data.id
        );

        const qrData = isOrder
          ? `ORDER-${window.scannedData.data.id}`
          : `TICKET-${window.scannedData.data.id}`;
        await handleScanSuccess(windowId, qrData);
        alert(
          `${result.message || 'Տոմս(եր)ը հաջողությամբ նշվեց(ին) որպես օգտագործված'}${
            fiscalMessage ? `\n${fiscalMessage}` : ''
          }`
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
      awaiting_payment: {
        label: 'Սպասում է վճարման',
        color: 'bg-amber-100 text-amber-800',
      },
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

  const customerPayContext = useMemo(() => {
    if (!activeWindow?.scannedData) return null;
    const { type, data } = activeWindow.scannedData;
    const userId = data.user?.id ?? data.userId ?? null;
    let targetOrderId: number | null = null;
    if (type === 'order') {
      targetOrderId = data.id;
    } else {
      targetOrderId = data.order?.id ?? data.orderId ?? null;
    }
    if (!userId) return null;
    return {
      userId: Number(userId),
      targetOrderId:
        targetOrderId != null && Number.isFinite(Number(targetOrderId))
          ? Number(targetOrderId)
          : null,
    };
  }, [activeWindow?.scannedData]);

  const selectedMergeTotal = useMemo(() => {
    return customerTickets
      .filter((ticket) => selectedMergeTicketIds.has(ticket.id))
      .reduce((sum, ticket) => sum + ticket.price + ticket.productsTotal, 0);
  }, [customerTickets, selectedMergeTicketIds]);

  const productModalTicket = useMemo(() => {
    if (productModalTicketId === null || !activeWindow?.scannedData)
      return null;
    const { type, data } = activeWindow.scannedData;
    if (type === 'order') {
      return (
        data.tickets?.find(
          (t: { id: number }) => t.id === productModalTicketId
        ) ?? null
      );
    }
    if (data.id === productModalTicketId) return data;
    return null;
  }, [productModalTicketId, activeWindow?.scannedData]);

  const openProductModal = (ticketId: number, status: string) => {
    setProductModalStatus(status);
    setProductError(null);
    setProductModalTicketId(ticketId);
  };

  const closeProductModal = () => {
    setProductModalTicketId(null);
    setProductError(null);
  };

  const openCustomerTicketsModal = async () => {
    if (!customerPayContext) return;
    setCustomerTicketsModalOpen(true);
    setCustomerTicketsLoading(true);
    setCustomerTicketsError(null);
    setSelectedMergeTicketIds(new Set());
    try {
      const result = await getCustomerTicketsForScanner({
        userId: customerPayContext.userId,
        targetOrderId: customerPayContext.targetOrderId,
      });
      if (result.success) {
        setCustomerTickets(result.tickets);
      } else {
        setCustomerTicketsError(result.error);
      }
    } catch (err) {
      console.error('Error loading customer tickets:', err);
      setCustomerTicketsError('Տոմսերը բեռնելիս սխալ է տեղի ունեցել');
    } finally {
      setCustomerTicketsLoading(false);
    }
  };

  const closeCustomerTicketsModal = () => {
    setCustomerTicketsModalOpen(false);
    setCustomerTickets([]);
    setCustomerTicketsError(null);
    setSelectedMergeTicketIds(new Set());
  };

  const toggleMergeTicket = (ticketId: number) => {
    setSelectedMergeTicketIds((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) next.delete(ticketId);
      else next.add(ticketId);
      return next;
    });
  };

  const handleMergeTicketsIntoOrder = async () => {
    if (!customerPayContext?.targetOrderId || !activeWindowId) return;
    const ticketIds = Array.from(selectedMergeTicketIds);
    if (ticketIds.length === 0) return;

    setIsMergingTickets(true);
    setCustomerTicketsError(null);
    try {
      const result = await mergeReservedTicketsIntoOrder({
        targetOrderId: customerPayContext.targetOrderId,
        ticketIds,
      });
      if (result.success) {
        closeCustomerTicketsModal();
        await handleScanSuccess(
          activeWindowId,
          `ORDER-${customerPayContext.targetOrderId}`
        );
        alert(result.message || 'Տոմսերը ավելացվեցին պատվերին');
      } else {
        setCustomerTicketsError(result.error);
      }
    } catch (err) {
      console.error('Error merging tickets:', err);
      setCustomerTicketsError('Տոմսերը միավորելիս սխալ է տեղի ունեցել');
    } finally {
      setIsMergingTickets(false);
    }
  };

  const handleSubmitScannerProducts = async (payload: {
    units: string[];
    popcorn: { productId: number; quantity: number }[];
    payment?: { method: PaymentMethod; amountPaid: number };
  }) => {
    if (!productModalTicketId || !activeWindow?.qrCode) return;
    setIsAddingProducts(true);
    setProductError(null);
    try {
      const result = await addTicketProducts({
        ticketId: productModalTicketId,
        units: payload.units,
        popcorn: payload.popcorn,
        paymentMethod: payload.payment?.method,
        amountPaid: payload.payment?.amountPaid,
      });
      if (result.success) {
        const fiscalNotice = await fireScannerFiscal(
          (result as { fiscal?: ScannerFiscalData | null }).fiscal
        );
        closeProductModal();
        await handleScanSuccess(activeWindow.id, activeWindow.qrCode);
        if (fiscalNotice?.message) alert(fiscalNotice.message);
      } else {
        setProductError(result.error || 'Սխալ');
      }
    } catch {
      setProductError('Ապրանքները ավելացնելիս սխալ է տեղի ունեցել');
    } finally {
      setIsAddingProducts(false);
    }
  };

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

            {/* Պատվերների որոնում (առանց QR-ի) */}
            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Պատվերների որոնում (առանց QR)
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearch();
                    }}
                    placeholder="Հեռախոս, անուն կամ պատվերի համար (#)"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-4 py-2.5 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSearching ? '...' : 'Որոնել'}
                </button>
              </div>

              {searchError && (
                <p className="mt-2 text-sm text-gray-500">{searchError}</p>
              )}

              {searchResults.length > 0 && (
                <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
                  {searchResults.map((r) => (
                    <button
                      key={r.orderId}
                      onClick={() => handleSelectResult(r)}
                      className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-gray-900 text-sm">
                          Պատվեր #{r.orderId}
                        </span>
                        <span className="text-sm font-bold text-green-600 shrink-0">
                          {r.totalAmount.toLocaleString('hy-AM')} ֏
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {r.userName || 'Անանուն'}
                        {r.userPhone ? ` • ${formatPhone(r.userPhone)}` : ''}
                        {r.isBlocked && (
                          <span className="ml-1 text-red-600 font-medium">
                            (արգելափակված)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {r.movieTitle || 'ֆիլմ'}
                        {r.startTime
                          ? ` • ${formatDate(r.startTime)} ${formatTime(r.startTime)}`
                          : ''}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {r.tickets.map((ticket) => {
                          const badge = getStatusBadge(ticket.status);
                          return (
                            <span
                              key={ticket.id}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}
                            >
                              {ticket.seatLabel
                                ? `Աթոռ ${ticket.seatLabel}`
                                : `Տոմս #${ticket.id}`}
                              <span className="opacity-80">•</span>
                              {badge.label}
                            </span>
                          );
                        })}
                      </div>
                      {(r.reservedCount > 0 ||
                        r.paidCount > 0 ||
                        r.usedCount > 0) && (
                        <div className="text-xs text-gray-500 mt-1.5">
                          {r.reservedCount > 0 && (
                            <span>{r.reservedCount} չվճարված</span>
                          )}
                          {r.reservedCount > 0 && r.paidCount > 0 && ' • '}
                          {r.paidCount > 0 && (
                            <span>{r.paidCount} վճարված</span>
                          )}
                          {(r.reservedCount > 0 || r.paidCount > 0) &&
                            r.usedCount > 0 &&
                            ' • '}
                          {r.usedCount > 0 && (
                            <span>{r.usedCount} մուտք գործած</span>
                          )}
                          <span> / {r.seatCount} աթոռ</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Տոմսի/Պատվերի Տեղեկություն
              </h2>
              {customerPayContext && (
                <button
                  type="button"
                  onClick={() => void openCustomerTicketsModal()}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors shrink-0"
                >
                  <Ticket className="w-4 h-4" />
                  Հաճախորդի տոմսեր
                </button>
              )}
            </div>
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
                    {(() => {
                      const usedCount =
                        activeWindow.scannedData.data.tickets.filter(
                          (t: any) => t.status === 'used'
                        ).length;
                      const total =
                        activeWindow.scannedData.data.tickets.length;
                      return (
                        <div className="text-sm text-gray-600 flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            Մուտք գործած:{' '}
                            <span className="font-semibold text-green-600">
                              {usedCount}
                            </span>
                          </span>
                          <span className="flex items-center gap-1">
                            <XCircle className="w-4 h-4 text-gray-400" />
                            Չի մուտք գործել:{' '}
                            <span className="font-semibold text-gray-600">
                              {total - usedCount}
                            </span>
                          </span>
                        </div>
                      );
                    })()}
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
                          onCheckedChange={async (ticketId, checked) =>
                            handleTicketEntryChange(Number(ticketId), checked)
                          }
                          isChecked={ticket.status === 'used'}
                          onAddProducts={openProductModal}
                          entryMode
                          onScanPreOrderProducts={openScanModal}
                          onRemoveOrderItem={handleRemoveOrderItem}
                          removingOrderItemId={removingOrderItemId}
                        />
                      )
                    )}
                  </div>
                </div>

                {/* Դրամարկղ-վճարում՝ չվճարված ամրագրման համար */}
                {(() => {
                  const reserved = activeWindow.scannedData.data.tickets.filter(
                    (t: any) =>
                      t.status === 'reserved' ||
                      t.status === 'awaiting_payment'
                  );
                  if (reserved.length === 0) return null;
                  const ticketsTotal = reserved.reduce(
                    (sum: number, t: any) => sum + (t.price || 0),
                    0
                  );
                  // Միայն ամրագրված տոմսերի ապրանքները (վճարվածներինը արդեն վճարված են)
                  const productsTotal = reserved.reduce(
                    (sum: number, t: any) =>
                      sum +
                      (t.orderItems?.reduce(
                        (s: number, item: any) =>
                          s + item.price * item.quantity,
                        0
                      ) || 0),
                    0
                  );
                  const grandTotal = ticketsTotal + productsTotal;
                  return (
                    <div className="rounded-xl border-2 border-amber-200 bg-amber-50/60 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                          <Banknote className="w-5 h-5 text-amber-600" />
                          Վճարում դրամարկղում
                        </h4>
                        <span className="text-lg font-bold text-amber-700">
                          {grandTotal.toLocaleString('hy-AM')} ֏
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {reserved.length} չվճարված տոմս
                        {productsTotal > 0 ? ' + ապրանքներ' : ''}
                      </p>
                      <PaymentPanel
                        total={grandTotal}
                        method={payMethod}
                        setMethod={setPayMethod}
                        cashReceived={payCash}
                        setCashReceived={setPayCash}
                        accent="amber"
                        disabled={isPaying}
                      />
                      {payError && (
                        <p className="text-sm text-red-600">{payError}</p>
                      )}
                      <button
                        onClick={() =>
                          handlePayReservation(activeWindow.id, grandTotal)
                        }
                        disabled={isPaying}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                      >
                        {isPaying ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Մշակվում է...
                          </>
                        ) : (
                          <>
                            <Banknote className="w-5 h-5" />
                            Ստանալ վճարումը (
                            {grandTotal.toLocaleString('hy-AM')} ֏)
                          </>
                        )}
                      </button>
                    </div>
                  );
                })()}

                {/* Ամեն տոմս մուտք է գործում առանձին՝ քարտի վրայի նշման միջոցով */}
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

                {/* Products + QR scan */}
                {(() => {
                  const ticketData = {
                    ...activeWindow.scannedData.data,
                    orderItems:
                      activeWindow.scannedData.data.orderItems ??
                      activeWindow.scannedData.data.order?.orderItems?.filter(
                        (item: { ticketId?: number | null }) =>
                          item.ticketId === activeWindow.scannedData.data.id ||
                          item.ticketId == null
                      ) ??
                      [],
                  };
                  const canAdd =
                    (ticketData.status === 'paid' ||
                      ticketData.status === 'reserved' ||
                      ticketData.status === 'awaiting_payment') &&
                    activeWindow.scannedData.type === 'ticket';
                  const needsScan = ticketNeedsQrScan(ticketData);
                  const progress = ticketQrScanProgress(ticketData);

                  if (ticketData.orderItems.length === 0 && !canAdd)
                    return null;

                  return (
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3 gap-2">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                          <ShoppingCart className="w-5 h-5 text-purple-600" />
                          Ապրանքներ
                        </h4>
                        <div className="flex items-center gap-2">
                          {needsScan && (
                            <button
                              type="button"
                              onClick={() => openScanModal(ticketData)}
                              className="flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700"
                            >
                              <ScanLine className="h-3.5 w-3.5" />
                              Սկանավորել ({progress.done}/{progress.total})
                            </button>
                          )}
                          {canAdd && (
                            <button
                              type="button"
                              onClick={() =>
                                openProductModal(
                                  Number(ticketData.id),
                                  ticketData.status
                                )
                              }
                              className="flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-800"
                            >
                              <Plus className="w-4 h-4" />
                              Ավելացնել
                            </button>
                          )}
                        </div>
                      </div>
                      {ticketData.orderItems.length > 0 ? (
                        <div className="space-y-2">
                          {ticketData.orderItems.map((item: any) => {
                            const canRemove =
                              ticketData.status === 'reserved' ||
                              ticketData.status === 'awaiting_payment';

                            return (
                              <div
                                key={item.id}
                                className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded gap-2"
                              >
                                <span className="text-gray-900 font-medium truncate">
                                  {item.product.name} x{item.quantity}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  {canRemove && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoveOrderItem(
                                          item,
                                          Number(ticketData.id)
                                        )
                                      }
                                      disabled={removingOrderItemId === item.id}
                                      className="rounded-md p-1 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                                      title="Հեռացնել պատվերից"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  <span className="text-gray-700 font-medium">
                                    {(
                                      item.price * item.quantity
                                    ).toLocaleString('hy-AM')}{' '}
                                    ֏
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">Ապրանքներ չկան</p>
                      )}
                    </div>
                  );
                })()}

                {/* Չվճարված ամրագրում՝ ուղղորդում դեպի պատվերը */}
                {(activeWindow.scannedData.data.status === 'reserved' ||
                  activeWindow.scannedData.data.status ===
                    'awaiting_payment') &&
                  activeWindow.scannedData.data.order?.id && (
                    <button
                      onClick={() =>
                        handleScanSuccess(
                          activeWindow.id,
                          `ORDER-${activeWindow.scannedData.data.order.id}`
                        )
                      }
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg"
                    >
                      <Banknote className="w-5 h-5" />
                      Բացել պատվերը վճարման համար
                    </button>
                  )}

                {/* Action Button */}
                {activeWindow.scannedData.data.status === 'paid' && (
                  <>
                    {ticketNeedsQrScan(activeWindow.scannedData.data) ? (
                      <button
                        type="button"
                        onClick={() =>
                          openScanModal(activeWindow.scannedData.data)
                        }
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-violet-700 transition-all shadow-lg"
                      >
                        <ScanLine className="w-5 h-5" />
                        Սկանավորել ապրանքները և մուտք
                      </button>
                    ) : (
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
                            Մուտք
                          </>
                        )}
                      </button>
                    )}
                  </>
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

      {scanModalTicket && (
        <TicketPreOrderScanModal
          ticket={scanModalTicket}
          isSubmitting={isCompletingEntry}
          error={entryError}
          mode={
            scanModalTicket.status === 'reserved' ||
            scanModalTicket.status === 'awaiting_payment'
              ? 'attach'
              : 'entry'
          }
          onClose={closeScanModal}
          lookupScan={(qrCode) =>
            lookupPreOrderProductQrForTicket(Number(scanModalTicket.id), qrCode)
          }
          onComplete={handleScanModalComplete}
        />
      )}

      {productModalTicketId !== null && (
        <ProductScanSaleModal
          products={scannerProducts}
          mode={productModalStatus === 'paid' ? 'ticket-paid' : 'ticket-unpaid'}
          isSubmitting={isAddingProducts}
          error={productError}
          lookupUnit={lookupSaleProductByQr}
          onClose={closeProductModal}
          onSubmit={handleSubmitScannerProducts}
          title="Մուտքի կետ՝ ապրանքներ"
          subtitle={
            productModalTicket
              ? `Տեղ ${productModalTicket.seat?.row ?? ''}${productModalTicket.seat?.number ?? ''}${
                  productModalStatus === 'paid'
                    ? ' — վաճառք և վճարում'
                    : ' — ավելանում է պատվերին, վճարումը միասին'
                }`
              : 'Մուտքի կետ'
          }
        />
      )}

      {customerTicketsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Հաճախորդի բոլոր տոմսերը
                </h3>
                {customerPayContext?.targetOrderId && (
                  <p className="text-sm text-gray-500 mt-1">
                    Ընտրեք չվճարված տոմսերը՝ ավելացնելու պատվեր #
                    {customerPayContext.targetOrderId}-ին և վճարել միասին
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeCustomerTicketsModal}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Փակել"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {customerTicketsLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                  <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : customerTicketsError && customerTickets.length === 0 ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {customerTicketsError}
                </div>
              ) : customerTickets.length === 0 ? (
                <p className="text-center py-12 text-gray-500">
                  Ակտիվ տոմսեր չկան
                </p>
              ) : (
                <div className="space-y-3">
                  {customerTickets.map((ticket) => {
                    const badge = getStatusBadge(ticket.status);
                    const isSelected = selectedMergeTicketIds.has(ticket.id);
                    return (
                      <label
                        key={ticket.id}
                        className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                          ticket.canAdd
                            ? isSelected
                              ? 'border-purple-400 bg-purple-50 cursor-pointer'
                              : 'border-gray-200 hover:border-purple-200 cursor-pointer'
                            : ticket.inTargetOrder
                              ? 'border-purple-200 bg-purple-50/50'
                              : 'border-gray-100 bg-gray-50'
                        }`}
                      >
                        {ticket.canAdd ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleMergeTicket(ticket.id)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                        ) : (
                          <span className="mt-1 w-4" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">
                              {ticket.movieTitle}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}
                            >
                              {badge.label}
                            </span>
                            {ticket.inTargetOrder && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                Այս պատվերում
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(ticket.startTime)}{' '}
                              {formatTime(ticket.startTime)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              Աթոռ {ticket.seatLabel}
                            </span>
                            {ticket.orderId != null && (
                              <span>Պատվեր #{ticket.orderId}</span>
                            )}
                          </div>
                          <div className="mt-2 text-sm font-medium text-gray-900">
                            {(ticket.price + ticket.productsTotal).toLocaleString(
                              'hy-AM'
                            )}{' '}
                            ֏
                            {ticket.productsTotal > 0 && (
                              <span className="text-gray-500 font-normal ml-1">
                                (տոմս {ticket.price.toLocaleString('hy-AM')} +
                                ապրանքներ{' '}
                                {ticket.productsTotal.toLocaleString('hy-AM')})
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-200 space-y-3">
              {customerTicketsError && customerTickets.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {customerTicketsError}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-gray-600">
                  {selectedMergeTicketIds.size > 0 ? (
                    <>
                      Ընտրված՝ {selectedMergeTicketIds.size} տոմս,{' '}
                      <span className="font-semibold text-gray-900">
                        {selectedMergeTotal.toLocaleString('hy-AM')} ֏
                      </span>
                    </>
                  ) : customerPayContext?.targetOrderId ? (
                    'Նշեք տոմսերը, որոնք ավելացնել եք այս պատվերին'
                  ) : (
                    'Միասին վճարման համար բացեք պատվերի QR կոդը'
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeCustomerTicketsModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Փակել
                  </button>
                  {customerPayContext?.targetOrderId && (
                    <button
                      type="button"
                      onClick={() => void handleMergeTicketsIntoOrder()}
                      disabled={
                        isMergingTickets || selectedMergeTicketIds.size === 0
                      }
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isMergingTickets ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Ավելացվում է...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Ավելացնել պատվերին
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {productError && productModalTicketId !== null && (
        <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white shadow-lg">
          {productError}
        </div>
      )}
    </div>
  );
}
