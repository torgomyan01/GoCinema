'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock,
  Film,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Printer,
  RotateCcw,
  ShoppingBag,
  Ticket as TicketIcon,
  User,
  X,
  Ban,
  FileBarChart,
  Gift,
  Search,
} from 'lucide-react';
import {
  cancelBoxOfficeTicket,
  createBoxOfficeProductOrder,
  createBoxOfficeTicketOrder,
  getBoxOfficeProducts,
  getBoxOfficeScreenings,
  getBoxOfficeSeatMap,
  getBoxOfficeTicketBySeat,
  lookupBoxOfficeReturnByQr,
  processBoxOfficeProductReturnExchange,
} from '@/app/actions/box-office';
import ProductScanSaleModal from '@/components/admin/product-scan-sale-modal';
import ProductReturnExchangeModal from '@/components/admin/product-return-exchange-modal';
import BoxOfficeDailyReportModal from '@/components/admin/box-office-daily-report-modal';
import PaymentPanel, {
  type PaymentMethod,
} from '@/components/admin/box-office-payment-panel';
import { lookupSaleProductByQr } from '@/app/actions/products';
import { isQuantityOnlyProduct } from '@/lib/product-units';
import {
  buildProductSaleInput,
  checkHdmAgentHealth,
  isHdmAgentEnabled,
} from '@/lib/hdm-agent';
import { submitReturnFiscal, submitSaleFiscal } from '@/lib/fiscal-flow';
import {
  findBonusCustomerByPhone,
  findOrCreateBonusCustomer,
  type BonusCustomer,
} from '@/app/actions/bonus';
import { TIER_LABELS_HY } from '@/lib/bonus-labels';
import {
  birthDateInputMax,
  birthDateInputMin,
} from '@/lib/birth-date';

interface ScreeningListItem {
  id: number;
  startTime: Date | string;
  endTime: Date | string;
  basePrice: number;
  movie: { id: number; title: string; image?: string | null; duration: number };
  hall: { id: number; name: string; capacity: number };
  soldCount: number;
  capacity: number;
}

interface SeatItem {
  id: number;
  row: string;
  number: number;
  seatType: string;
  taken: boolean;
  holdStatus?: string | null;
  holdUntil?: string | null;
  holdRemainingMs?: number | null;
}

interface SeatMap {
  id: number;
  startTime: Date | string;
  endTime: Date | string;
  basePrice: number;
  movie: { id: number; title: string; duration: number };
  hall: { id: number; name: string; capacity: number };
  seats: SeatItem[];
}

interface LastTicketSale {
  orderId: number;
  total: number;
  seatLabels: string;
  movieTitle: string;
}

interface TakenTicketInfo {
  id: number;
  price: number;
  status: string;
  qrCode?: string | null;
  createdAt: Date | string;
  holdUntil?: Date | string | null;
  seat: { id: number; row: string; number: number; seatType: string };
  user?: { name?: string | null; phone?: string | null } | null;
  payment?: { method: string; status: string; amount: number } | null;
  screening: {
    startTime: Date | string;
    movie: { title: string };
    hall: { name: string };
  };
}

interface ProductItem {
  id: number;
  name: string;
  price: number;
  category: string;
  image?: string | null;
  stock: number;
}

const statusLabels: Record<string, string> = {
  reserved: 'Ամրագրված',
  awaiting_payment: 'Սպասում է վճարման',
  paid: 'Վճարված',
  used: 'Օգտագործված',
  cancelled: 'Չեղարկված',
};

function formatHoldCountdown(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return '0:00';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDay(value: Date | string) {
  return new Date(value).toLocaleDateString('hy-AM', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

function formatTime(value: Date | string) {
  return new Date(value).toLocaleTimeString('hy-AM', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dayKey(value: Date | string) {
  const d = new Date(value);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function BoxOfficeClient({
  isAdmin = false,
}: {
  isAdmin?: boolean;
}) {
  const [screenings, setScreenings] = useState<ScreeningListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);
  const [isSeatLoading, setIsSeatLoading] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<SeatItem[]>([]);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payCash, setPayCash] = useState<number | ''>('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [lastSale, setLastSale] = useState<LastTicketSale | null>(null);

  const [takenTicket, setTakenTicket] = useState<TakenTicketInfo | null>(null);
  const [isTakenLoading, setIsTakenLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [takenModalError, setTakenModalError] = useState<string | null>(null);

  const [products, setProducts] = useState<ProductItem[]>([]);

  // Ինքնուրույն ապրանքների վաճառք (առանց տոմսի)
  const [productSaleOpen, setProductSaleOpen] = useState(false);
  const [returnExchangeOpen, setReturnExchangeOpen] = useState(false);
  const [dailyReportOpen, setDailyReportOpen] = useState(false);
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);
  const [lastReturnMessage, setLastReturnMessage] = useState<string | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [lastOrder, setLastOrder] = useState<{
    id: number;
    total: number;
  } | null>(null);
  const [fiscalNotice, setFiscalNotice] = useState<{
    type: 'success' | 'warning';
    message: string;
  } | null>(null);
  const [hdmAgentOnline, setHdmAgentOnline] = useState<boolean | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Բոնուսային հաճախորդ՝ վաճառքի միավորները և պարգևը
  const [bonusPhone, setBonusPhone] = useState('');
  const [bonusBirthDate, setBonusBirthDate] = useState('');
  const [bonusName, setBonusName] = useState('');
  const [bonusCustomer, setBonusCustomer] = useState<BonusCustomer | null>(null);
  const [bonusRewardId, setBonusRewardId] = useState<number | ''>('');
  const [bonusSearching, setBonusSearching] = useState(false);
  const [bonusError, setBonusError] = useState<string | null>(null);
  const [bonusNotice, setBonusNotice] = useState<string | null>(null);

  const attachBonusCustomer = async () => {
    if (bonusSearching) return;
    setBonusSearching(true);
    setBonusError(null);
    setBonusNotice(null);
    const result = await findOrCreateBonusCustomer({
      phone: bonusPhone,
      name: bonusName.trim() || null,
      birthDate: bonusBirthDate.trim() || null,
    });
    setBonusSearching(false);
    if (!result.success || !result.customer) {
      setBonusCustomer(null);
      setBonusError(result.error ?? 'Հաճախորդը չի գտնվել');
      return;
    }
    setBonusCustomer(result.customer);
    setBonusRewardId('');
    setBonusPhone(result.customer.phone);
    setBonusBirthDate(result.customer.birthDate ?? bonusBirthDate);
    setBonusName(result.customer.name ?? bonusName);
    setBonusNotice(
      result.created
        ? 'Նոր օգտատեր գրանցվեց — բոնուսները կգնան այս հաշվին'
        : 'Հաճախորդը գտնվեց — բոնուսները կգնան այս հաշվին'
    );
  };

  const clearBonusCustomer = () => {
    setBonusCustomer(null);
    setBonusRewardId('');
    setBonusPhone('');
    setBonusBirthDate('');
    setBonusName('');
    setBonusError(null);
    setBonusNotice(null);
  };

  /** Վաճառքից հետո՝ թարմացնել մնացորդը և զրոյացնել ընտրված պարգևը։ */
  const refreshBonusAfterSale = async () => {
    setBonusRewardId('');
    if (!bonusCustomer) return;
    const result = await findBonusCustomerByPhone(bonusCustomer.phone);
    if (result.success && result.customer) {
      setBonusCustomer(result.customer);
      setBonusBirthDate(result.customer.birthDate ?? '');
      setBonusName(result.customer.name ?? '');
    }
  };

  // Օնլայն hold-ի հաշվիչի թարմացում (ամեն վայրկյան)
  useEffect(() => {
    if (!seatMap?.seats.some((s) => s.holdStatus === 'awaiting_payment')) {
      return;
    }
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [seatMap]);

  const refreshHdmAgentStatus = async () => {
    if (!isHdmAgentEnabled()) {
      setHdmAgentOnline(null);
      return;
    }
    const online = await checkHdmAgentHealth();
    setHdmAgentOnline(online);
  };

  const loadScreenings = async () => {
    setIsLoading(true);
    setError(null);
    const result = await getBoxOfficeScreenings();
    if (result.success) {
      setScreenings(result.screenings as ScreeningListItem[]);
    } else {
      setError(
        result.error || 'Ցուցադրությունները բեռնելիս սխալ է տեղի ունեցել'
      );
    }
    setIsLoading(false);
  };

  const loadProducts = async () => {
    const result = await getBoxOfficeProducts();
    if (result.success) {
      setProducts(result.products as ProductItem[]);
    }
  };

  useEffect(() => {
    void loadScreenings();
    void loadProducts();
    void refreshHdmAgentStatus();
  }, []);

  const openProductSale = () => {
    setError(null);
    setProductSaleOpen(true);
  };

  const openReturnExchange = () => {
    setError(null);
    setReturnExchangeOpen(true);
  };

  const closeReturnExchange = () => {
    if (isProcessingReturn) return;
    setReturnExchangeOpen(false);
  };

  const closeProductSale = () => {
    if (isCreatingOrder) return;
    setProductSaleOpen(false);
  };

  const openOrderPrint = (orderId: number) => {
    window.open(
      `/admin/box-office/print-order/${orderId}`,
      '_blank',
      'width=420,height=640'
    );
  };

  const handleCreateProductOrder = async (payload: {
    units: string[];
    popcorn: { productId: number; quantity: number }[];
    payment?: { method: PaymentMethod; amountPaid: number };
  }) => {
    if (isCreatingOrder) return;
    if (payload.units.length === 0 && payload.popcorn.length === 0) {
      setError('Ընտրեք առնվազն մեկ ապրանք');
      return;
    }
    setIsCreatingOrder(true);
    setError(null);
    try {
      let customerId = bonusCustomer?.id;
      if (!customerId && bonusPhone.trim()) {
        const attached = await findOrCreateBonusCustomer({
          phone: bonusPhone,
          name: bonusName.trim() || null,
          birthDate: bonusBirthDate.trim() || null,
        });
        if (!attached.success || !attached.customer) {
          setError(attached.error || 'Հեռախոսը կիրառել չհաջողվեց');
          setBonusError(attached.error ?? null);
          return;
        }
        setBonusCustomer(attached.customer);
        setBonusPhone(attached.customer.phone);
        setBonusBirthDate(attached.customer.birthDate ?? bonusBirthDate);
        setBonusName(attached.customer.name ?? bonusName);
        customerId = attached.customer.id;
      }

      const result = await createBoxOfficeProductOrder({
        units: payload.units,
        popcorn: payload.popcorn,
        paymentMethod: payload.payment?.method,
        amountPaid: payload.payment?.amountPaid,
        bonusCustomerId: customerId,
        bonusRewardId: bonusRewardId || undefined,
      });
      if (!result.success || !result.order) {
        setError(result.error || 'Ապրանքների վաճառքը չստացվեց');
        return;
      }
      const order = result.order as {
        id: number;
        orderItems?: Array<{
          quantity: number;
          price: number;
          product: { name: string; category: string };
        }>;
      };
      setLastOrder({ id: order.id, total: result.total ?? 0 });
      openOrderPrint(order.id);

      if (isHdmAgentEnabled() && order.orderItems) {
        const soldCodes =
          (result as { soldUnitQrCodes?: string[] }).soldUnitQrCodes ??
          payload.units;
        const eMarkQueue = [...soldCodes];
        const lines: Array<{
          name: string;
          price: number;
          qty: number;
          eMark?: string | null;
        }> = [];

        for (const item of order.orderItems) {
          for (let i = 0; i < item.quantity; i += 1) {
            const needsEmark = !isQuantityOnlyProduct(item.product.category);
            lines.push({
              name: item.product.name,
              price: item.price,
              qty: 1,
              eMark: needsEmark ? (eMarkQueue.shift() ?? null) : null,
            });
          }
        }

        const notice = await submitSaleFiscal({
          input: buildProductSaleInput({
            paymentMethod: payload.payment?.method ?? 'cash',
            total: result.total ?? 0,
            lines,
          }),
          source: 'box_office',
          orderId: order.id,
        });
        setFiscalNotice(notice);
        void refreshHdmAgentStatus();
      }

      setProductSaleOpen(false);
      void refreshBonusAfterSale();
      void loadProducts();
    } catch (err) {
      console.error('Product order error:', err);
      setError('Ապրանքների վաճառքը չստացվեց');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleReturnExchange = async (payload: {
    returnQrCode: string;
    mode: 'refund' | 'exchange';
    units: string[];
    popcorn: { productId: number; quantity: number }[];
    payment?: { method: PaymentMethod; amountPaid: number };
  }) => {
    if (isProcessingReturn) return;
    setIsProcessingReturn(true);
    setError(null);
    try {
      const result = await processBoxOfficeProductReturnExchange({
        returnQrCode: payload.returnQrCode,
        mode: payload.mode,
        newUnits: payload.units,
        newPopcorn: payload.popcorn,
        paymentMethod: payload.payment?.method,
        amountPaid: payload.payment?.amountPaid,
      });
      if (!result.success) {
        setError(result.error || 'Վերադարձը/փոխանակումը չստացվեց');
        return;
      }
      const successResult = result as {
        message?: string;
        orderId?: number | null;
        soldUnitQrCodes?: string[];
        exchangeSaleLines?: Array<{
          name: string;
          price: number;
          qty: number;
          eMark: string | null;
        }>;
        returnQrCode?: string;
        returnFiscal?: {
          crn: string;
          rseq: number;
          paymentMethod: 'cash' | 'card';
          eMarks: string[];
          amount: number;
        } | null;
        newTotal?: number;
        mode?: 'refund' | 'exchange';
      };
      setLastReturnMessage(
        successResult.message ?? 'Գործարքը հաջողությամբ ավարտվեց'
      );
      setReturnExchangeOpen(false);
      if (successResult.orderId) {
        openOrderPrint(successResult.orderId);
      }

      if (isHdmAgentEnabled()) {
        const notices: string[] = [];

        if (successResult.returnFiscal) {
          const returnNotice = await submitReturnFiscal({
            input: {
              crn: successResult.returnFiscal.crn,
              returnTicketId: successResult.returnFiscal.rseq,
              paymentMethod: successResult.returnFiscal.paymentMethod,
              amount: successResult.returnFiscal.amount,
              eMarks: successResult.returnFiscal.eMarks,
            },
            source: 'box_office',
          });
          notices.push(returnNotice.message);
        }

        if (
          successResult.mode === 'exchange' &&
          successResult.orderId &&
          ((successResult.exchangeSaleLines?.length ?? 0) > 0 ||
            (successResult.soldUnitQrCodes?.length ?? 0) > 0 ||
            payload.units.length > 0 ||
            payload.popcorn.length > 0)
        ) {
          const exchangeLines =
            successResult.exchangeSaleLines &&
            successResult.exchangeSaleLines.length > 0
              ? successResult.exchangeSaleLines
              : [
                  ...(successResult.soldUnitQrCodes ?? payload.units).map(
                    (code) => ({
                      name: 'Ապրանք',
                      price: 0,
                      qty: 1,
                      eMark: code as string | null,
                    })
                  ),
                  ...payload.popcorn.map((p) => {
                    const product = products.find((x) => x.id === p.productId);
                    return {
                      name: product?.name ?? 'Պոպկորն',
                      price: product?.price ?? 0,
                      qty: p.quantity,
                      eMark: null as string | null,
                    };
                  }),
                ];
          const saleNotice = await submitSaleFiscal({
            input: buildProductSaleInput({
              paymentMethod: payload.payment?.method ?? 'cash',
              total: successResult.newTotal ?? 0,
              lines: exchangeLines,
            }),
            source: 'box_office',
            orderId: successResult.orderId,
          });
          notices.push(saleNotice.message);
        }

        if (notices.length > 0) {
          setFiscalNotice({
            type: 'warning',
            message: notices.join(' · '),
          });
          void refreshHdmAgentStatus();
        }
      }

      void loadProducts();
    } catch (err) {
      console.error('Return/exchange error:', err);
      setError('Վերադարձը/փոխանակումը չստացվեց');
    } finally {
      setIsProcessingReturn(false);
    }
  };

  const ticketsTotal = useMemo(() => {
    if (!seatMap || selectedSeats.length === 0) return 0;
    return selectedSeats.reduce((sum, seat) => {
      const price =
        seat.seatType === 'vip'
          ? Math.round(seatMap.basePrice * 1.5)
          : seatMap.basePrice;
      return sum + price;
    }, 0);
  }, [seatMap, selectedSeats]);

  const movies = useMemo(() => {
    const map = new Map<
      number,
      {
        id: number;
        title: string;
        image?: string | null;
        screeningCount: number;
      }
    >();
    for (const s of screenings) {
      const existing = map.get(s.movie.id);
      if (existing) {
        existing.screeningCount += 1;
      } else {
        map.set(s.movie.id, {
          id: s.movie.id,
          title: s.movie.title,
          image: s.movie.image,
          screeningCount: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.title.localeCompare(b.title, 'hy')
    );
  }, [screenings]);

  const selectedMovie = useMemo(() => {
    if (!selectedMovieId) return null;
    return movies.find((m) => m.id === selectedMovieId) ?? null;
  }, [movies, selectedMovieId]);

  const movieScreenings = useMemo(() => {
    if (!selectedMovieId) return [];
    return screenings
      .filter((s) => s.movie.id === selectedMovieId)
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
  }, [screenings, selectedMovieId]);

  const movieDays = useMemo(() => {
    const map = new Map<string, Date | string>();
    for (const s of movieScreenings) {
      const key = dayKey(s.startTime);
      if (!map.has(key)) map.set(key, s.startTime);
    }
    return Array.from(map.entries()).map(([key, date]) => ({ key, date }));
  }, [movieScreenings]);

  useEffect(() => {
    if (!selectedMovieId) {
      setSelectedDay(null);
      return;
    }
    if (
      movieDays.length > 0 &&
      (!selectedDay || !movieDays.some((d) => d.key === selectedDay))
    ) {
      setSelectedDay(movieDays[0].key);
    }
  }, [selectedMovieId, movieDays, selectedDay]);

  const dayScreenings = useMemo(
    () => movieScreenings.filter((s) => dayKey(s.startTime) === selectedDay),
    [movieScreenings, selectedDay]
  );

  const selectMovie = (movieId: number) => {
    setSelectedMovieId(movieId);
    setSeatMap(null);
    setSelectedSeats([]);
    setCheckoutOpen(false);
    setSelectedDay(null);
    setError(null);
  };

  const backToMovies = () => {
    setSelectedMovieId(null);
    setSeatMap(null);
    setSelectedSeats([]);
    setCheckoutOpen(false);
    setSelectedDay(null);
    setError(null);
  };

  const backToScreenings = () => {
    setSeatMap(null);
    setSelectedSeats([]);
    setCheckoutOpen(false);
    setError(null);
  };

  const openSeatMap = async (screeningId: number) => {
    setIsSeatLoading(true);
    setSelectedSeats([]);
    setCheckoutOpen(false);
    setError(null);
    const result = await getBoxOfficeSeatMap(screeningId);
    if (result.success && result.data) {
      setSeatMap(result.data as SeatMap);
    } else {
      setError(result.error || 'Նստատեղերը բեռնելիս սխալ է տեղի ունեցել');
    }
    setIsSeatLoading(false);
  };

  const selectSeat = (seat: SeatItem) => {
    if (seat.taken) {
      void openTakenSeat(seat);
      return;
    }
    setSelectedSeats((prev) => {
      const exists = prev.some((s) => s.id === seat.id);
      if (exists) return prev.filter((s) => s.id !== seat.id);
      return [...prev, seat];
    });
  };

  const openTakenSeat = async (seat: SeatItem) => {
    if (!seatMap) return;
    setIsTakenLoading(true);
    setTakenTicket(null);
    setShowCancelConfirm(false);
    setTakenModalError(null);
    const result = await getBoxOfficeTicketBySeat(seatMap.id, seat.id);
    if (result.success && result.ticket) {
      setTakenTicket(result.ticket as unknown as TakenTicketInfo);
    } else {
      setError(result.error || 'Տոմսը չի գտնվել');
    }
    setIsTakenLoading(false);
  };

  const seatRows = useMemo((): [string, SeatItem[]][] => {
    if (!seatMap) return [];
    const map = new Map<string, SeatItem[]>();
    for (const seat of seatMap.seats) {
      if (!map.has(seat.row)) map.set(seat.row, []);
      map.get(seat.row)!.push(seat);
    }
    const rows = Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
    for (const [, seats] of rows) {
      seats.sort((a, b) => b.number - a.number);
    }
    return rows;
  }, [seatMap]);

  const closeTakenModal = () => {
    setTakenTicket(null);
    setIsTakenLoading(false);
    setShowCancelConfirm(false);
    setTakenModalError(null);
  };

  const handleCancelTicket = async () => {
    if (!takenTicket || !seatMap || isCancelling) return;

    setIsCancelling(true);
    setTakenModalError(null);
    try {
      const result = await cancelBoxOfficeTicket(takenTicket.id);
      if (!result.success) {
        setTakenModalError(
          result.error || 'Տոմսը չեղարկելիս սխալ է տեղի ունեցել'
        );
        return;
      }

      if (isHdmAgentEnabled() && result.returnFiscal) {
        const refundAmount = Number(result.returnFiscal.amount);
        if (Number.isFinite(refundAmount) && refundAmount > 0) {
          const notice = await submitReturnFiscal({
            input: {
              crn: result.returnFiscal.crn,
              returnTicketId: result.returnFiscal.rseq,
              paymentMethod: result.returnFiscal.paymentMethod,
              // Պարտադիր՝ մասնակի վերադարձ միայն այս տոմսի գնով
              amount: refundAmount,
            },
            source: 'box_office',
            ticketId: takenTicket.id,
            orderId: result.orderId ?? null,
          });
          setFiscalNotice(notice);
          void refreshHdmAgentStatus();
        }
      }

      setSeatMap((prev) =>
        prev
          ? {
              ...prev,
              seats: prev.seats.map((s) =>
                s.id === takenTicket.seat.id ? { ...s, taken: false } : s
              ),
            }
          : prev
      );
      closeTakenModal();
      void loadScreenings();
      void loadProducts();
    } catch (err) {
      console.error('Cancel ticket error:', err);
      setTakenModalError('Տոմսը չեղարկելիս սխալ է տեղի ունեցել');
    } finally {
      setIsCancelling(false);
    }
  };

  const canCancelTakenTicket =
    takenTicket &&
    (takenTicket.status === 'paid' ||
      takenTicket.status === 'reserved' ||
      takenTicket.status === 'awaiting_payment');

  const cannotCancelReason =
    takenTicket?.status === 'used'
      ? 'Տոմսն արդեն օգտագործված է (սկանավորված մուտք) և չի կարող չեղարկվել'
      : takenTicket?.status === 'cancelled'
        ? 'Տոմսն արդեն չեղարկված է'
        : null;

  const openPrint = (ticketId: number) => {
    window.open(
      `/admin/box-office/print/${ticketId}`,
      '_blank',
      'width=420,height=640'
    );
  };

  const openSalePrint = (orderId: number) => {
    window.open(
      `/admin/box-office/print-sale/${orderId}`,
      '_blank',
      'width=420,height=640'
    );
  };

  const clearSelection = () => {
    if (isCreating) return;
    setSelectedSeats([]);
    setCheckoutOpen(false);
    setPayCash('');
    setPayMethod('cash');
  };

  const handleCreate = async () => {
    if (!seatMap || selectedSeats.length === 0 || isCreating) return;

    const amountPaid =
      payMethod === 'cash'
        ? payCash === ''
          ? ticketsTotal
          : Number(payCash)
        : ticketsTotal;

    if (payMethod === 'cash' && amountPaid < ticketsTotal) {
      setError('Ստացված գումարը պակաս է ընդհանուրից');
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      // Եթե հեռախոսը լրացված է, բայց դեռ չի կիրառվել — գտնել/ստեղծել մինչև վաճառքը
      let customerId = bonusCustomer?.id;
      let rewardId = bonusRewardId || undefined;
      if (!customerId && bonusPhone.trim()) {
        const attached = await findOrCreateBonusCustomer({
          phone: bonusPhone,
          name: bonusName.trim() || null,
          birthDate: bonusBirthDate.trim() || null,
        });
        if (!attached.success || !attached.customer) {
          setError(attached.error || 'Հեռախոսը կիրառել չհաջողվեց');
          setBonusError(attached.error ?? null);
          return;
        }
        setBonusCustomer(attached.customer);
        setBonusPhone(attached.customer.phone);
        setBonusBirthDate(attached.customer.birthDate ?? bonusBirthDate);
        setBonusName(attached.customer.name ?? bonusName);
        setBonusNotice(
          attached.created
            ? 'Նոր օգտատեր գրանցվեց — բոնուսները կգնան այս հաշվին'
            : 'Հաճախորդը գտնվեց — բոնուսները կգնան այս հաշվին'
        );
        customerId = attached.customer.id;
      }

      const result = await createBoxOfficeTicketOrder({
        screeningId: seatMap.id,
        seatIds: selectedSeats.map((s) => s.id),
        paymentMethod: payMethod,
        amountPaid,
        bonusCustomerId: customerId,
        bonusRewardId: rewardId,
      });
      if (!result.success) {
        setError(result.error || 'Տոմսեր ստեղծելիս սխալ է տեղի ունեցել');
        return;
      }

      const ok = result as {
        orderId: number;
        total: number;
        tickets?: Array<{
          id: number;
          price: number;
          seat: { row: string; number: number; seatType: string };
        }>;
      };
      const orderId = ok.orderId;
      const saleTotal = ok.total ?? ticketsTotal;
      const seatLabels = selectedSeats
        .map((s) => `${s.row}${s.number}`)
        .join(', ');
      setLastSale({
        orderId,
        total: saleTotal,
        seatLabels,
        movieTitle: seatMap.movie.title,
      });
      openSalePrint(orderId);

      if (isHdmAgentEnabled()) {
        // Գները վերցնում ենք սերվերի պատասխանից՝ բոնուսային զեղչը ներառելու համար
        const lines = (ok.tickets ?? []).map((ticket) => ({
          name: `Տոմս · ${seatMap.movie.title} · ${ticket.seat.row}${ticket.seat.number}`,
          price: ticket.price,
          qty: 1,
          isTicket: true as const,
        }));
        const notice = await submitSaleFiscal({
          input: buildProductSaleInput({
            paymentMethod: payMethod,
            total: saleTotal,
            lines,
          }),
          source: 'box_office',
          orderId,
        });
        setFiscalNotice(notice);
        void refreshHdmAgentStatus();
      }

      const selectedIds = new Set(selectedSeats.map((s) => s.id));
      setSeatMap((prev) =>
        prev
          ? {
              ...prev,
              seats: prev.seats.map((s) =>
                selectedIds.has(s.id) ? { ...s, taken: true } : s
              ),
            }
          : prev
      );
      setSelectedSeats([]);
      setCheckoutOpen(false);
      setPayCash('');
      setPayMethod('cash');
      void refreshBonusAfterSale();
      void loadScreenings();
    } catch (err) {
      console.error('Box office create error:', err);
      setError('Տոմսեր ստեղծելիս սխալ է տեղի ունեցել');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-green-100 p-2">
            <Banknote className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Դրամարկղ</h1>
            <p className="text-sm text-gray-600">
              Տոմսերի և ապրանքների վաճառք՝ կանխիկ վճարումով
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {isHdmAgentEnabled() && (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                hdmAgentOnline
                  ? 'bg-emerald-50 text-emerald-700'
                  : hdmAgentOnline === false
                    ? 'bg-amber-50 text-amber-800'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  hdmAgentOnline
                    ? 'bg-emerald-500'
                    : hdmAgentOnline === false
                      ? 'bg-amber-500'
                      : 'bg-gray-400'
                }`}
              />
              {hdmAgentOnline
                ? 'ՀԴՄ agent'
                : hdmAgentOnline === false
                  ? 'ՀԴՄ agent offline'
                  : 'ՀԴՄ agent…'}
            </div>
          )}
          {isAdmin && (
            <button
              onClick={() => setDailyReportOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 shadow-sm transition hover:bg-violet-100"
            >
              <FileBarChart className="h-4 w-4" />
              Օրվա հաշվետվություն
            </button>
          )}
          <button
            onClick={openReturnExchange}
            className="flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100"
          >
            <RotateCcw className="h-4 w-4" />
            Վերադարձ / Փոխանակում
          </button>
          <button
            onClick={openProductSale}
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-400"
          >
            <ShoppingBag className="h-4 w-4" />
            Ապրանքների վաճառք
          </button>
        </div>
      </div>

      {/* Բոնուսային հաճախորդ՝ հեռախոսով գտնել կամ գրանցել */}
      <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-violet-800">
          <Gift className="h-4 w-4" />
          Բոնուսային հաճախորդ — հեռախոսահամարով
        </p>
        <p className="mb-3 text-xs text-violet-700">
          Լրացրեք հեռախոսը՝ վաճառքի բոնուսները հավաքելու համար։ Եթե հաշիվ չկա՝
          կգրանցվի որպես նոր օգտատեր։ Առանց հեռախոսի վաճառքը մնում է անանուն։
        </p>

        {bonusCustomer ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-sm font-semibold text-violet-900">
                  {bonusCustomer.name || 'Անանուն'} · {bonusCustomer.phone}
                  {bonusCustomer.isNew ? (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      ՆՈՐ
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-violet-700">
                  {bonusCustomer.points} միավոր ·{' '}
                  {TIER_LABELS_HY[bonusCustomer.tier] ?? bonusCustomer.tier} ·{' '}
                  {bonusCustomer.visits} այց
                  {bonusCustomer.birthDate
                    ? ` · ծննդ․ ${bonusCustomer.birthDate}`
                    : ''}
                </p>
              </div>
              <select
                value={bonusRewardId}
                onChange={(e) =>
                  setBonusRewardId(e.target.value ? Number(e.target.value) : '')
                }
                className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
              >
                <option value="">Առանց պարգևի</option>
                {bonusCustomer.rewards.map((reward) => (
                  <option
                    key={reward.id}
                    value={reward.id}
                    disabled={!reward.affordable}
                  >
                    {reward.name} — {reward.pointsCost} միավոր
                    {reward.affordable ? '' : ' (չի բավարարում)'}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={clearBonusCustomer}
                className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-100"
              >
                Մաքրել
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400" />
              <input
                value={bonusPhone}
                onChange={(e) => setBonusPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void attachBonusCustomer();
                }}
                placeholder="Հեռախոս 0XX XXX XXX"
                inputMode="numeric"
                className="w-full rounded-lg border border-violet-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-violet-500 focus:outline-none"
              />
            </div>
            <input
              type="date"
              value={bonusBirthDate}
              onChange={(e) => setBonusBirthDate(e.target.value)}
              min={birthDateInputMin()}
              max={birthDateInputMax()}
              title="Ծննդյան ամսաթիվ"
              className="w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
            />
            <input
              value={bonusName}
              onChange={(e) => setBonusName(e.target.value)}
              placeholder="Անուն (ոչ պարտադիր)"
              className="w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void attachBonusCustomer()}
              disabled={bonusSearching || !bonusPhone.trim()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              {bonusSearching ? '…' : 'Կիրառել'}
            </button>
          </div>
        )}

        {bonusError && (
          <p className="mt-2 text-xs font-medium text-rose-600">{bonusError}</p>
        )}
        {bonusNotice && (
          <p className="mt-2 text-xs font-medium text-emerald-700">
            {bonusNotice}
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {fiscalNotice && (
        <div
          className={`mb-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
            fiscalNotice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-amber-200 bg-amber-50'
          }`}
        >
          <div
            className={`flex items-center gap-3 text-sm ${
              fiscalNotice.type === 'success'
                ? 'text-emerald-800'
                : 'text-amber-800'
            }`}
          >
            {fiscalNotice.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0" />
            )}
            <span>{fiscalNotice.message}</span>
          </div>
          <button
            onClick={() => setFiscalNotice(null)}
            className={`text-sm font-semibold ${
              fiscalNotice.type === 'success'
                ? 'text-emerald-700 hover:text-emerald-900'
                : 'text-amber-700 hover:text-amber-900'
            }`}
          >
            Փակել
          </button>
        </div>
      )}

      {lastReturnMessage && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-sky-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{lastReturnMessage}</span>
          </div>
          <button
            onClick={() => setLastReturnMessage(null)}
            className="text-sm font-semibold text-sky-700 hover:text-sky-900"
          >
            Փակել
          </button>
        </div>
      )}

      {lastSale && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-green-200 bg-green-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-green-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>
              Պատվեր #{lastSale.orderId}՝ {lastSale.movieTitle}, տեղեր{' '}
              {lastSale.seatLabels}, {lastSale.total.toLocaleString()} ֏
            </span>
          </div>
          <button
            onClick={() => openSalePrint(lastSale.orderId)}
            className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
          >
            <Printer className="h-4 w-4" />
            Տպել կրկին
          </button>
        </div>
      )}

      {lastOrder && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-amber-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>
              Ապրանքների վաճառք #{lastOrder.id} —{' '}
              {lastOrder.total.toLocaleString()} ֏
            </span>
          </div>
          <button
            onClick={() => openOrderPrint(lastOrder.id)}
            className="flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
          >
            <Printer className="h-4 w-4" />
            Տպել կրկին
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Ձախ՝ ֆիլմ → ցուցադրություն → նստատեղ */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-gray-900">
              <CalendarDays className="h-5 w-5 text-gray-500" />
              Վաճառք
            </h2>
            <button
              onClick={loadScreenings}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              title="Թարմացնել"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {/* Քայլերի ցուցիչ */}
          <div className="mb-4 flex items-center gap-1.5 text-xs">
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${
                !selectedMovieId
                  ? 'bg-green-600 text-white'
                  : 'bg-green-50 text-green-700'
              }`}
            >
              1. Ֆիլմ
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${
                selectedMovieId && !seatMap
                  ? 'bg-green-600 text-white'
                  : selectedMovieId
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              2. Ցուցադրություն
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${
                seatMap
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              3. Նստատեղ
            </span>
          </div>

          {isLoading ? (
            <div className="py-10 text-center text-sm text-gray-500">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
              Բեռնվում է...
            </div>
          ) : screenings.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Առաջիկա ցուցադրություններ չկան
            </div>
          ) : !selectedMovieId ? (
            /* Քայլ 1 — ֆիլմի ընտրություն */
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              <p className="mb-2 text-xs text-gray-500">Ընտրեք ֆիլմը</p>
              {movies.map((movie) => (
                <button
                  key={movie.id}
                  onClick={() => selectMovie(movie.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-3 text-left transition hover:border-green-300 hover:bg-green-50/50"
                >
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {movie.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={movie.image}
                        alt={movie.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <Film className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">
                      {movie.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {movie.screeningCount} ցուցադրություն
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                </button>
              ))}
            </div>
          ) : !seatMap ? (
            /* Քայլ 2 — ցուցադրության ընտրություն */
            <>
              <button
                onClick={backToMovies}
                className="mb-3 flex items-center gap-1 text-xs font-medium text-gray-500 transition hover:text-green-700"
              >
                <ChevronLeft className="h-4 w-4" />
                Վերադառնալ ֆիլմերին
              </button>

              {selectedMovie && (
                <div className="mb-3 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-3">
                  <div className="h-12 w-9 shrink-0 overflow-hidden rounded-lg bg-white">
                    {selectedMovie.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedMovie.image}
                        alt={selectedMovie.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <Film className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <p className="truncate font-semibold text-green-900">
                    {selectedMovie.title}
                  </p>
                </div>
              )}

              {movieDays.length > 1 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {movieDays.map(({ key, date }) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedDay(key);
                        setSeatMap(null);
                        setSelectedSeats([]);
                        setCheckoutOpen(false);
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        selectedDay === key
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {formatDay(date)}
                    </button>
                  ))}
                </div>
              )}

              <p className="mb-2 text-xs text-gray-500">Ընտրեք ցուցադրությունը</p>
              <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                {dayScreenings.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => openSeatMap(s.id)}
                    className="w-full rounded-xl border border-gray-200 p-3 text-left transition hover:border-green-300 hover:bg-green-50/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                        <Clock className="h-4 w-4 text-green-600" />
                        {formatTime(s.startTime)}
                      </span>
                      <span className="text-xs font-medium text-gray-500">
                        {s.hall.name}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                      <span>{formatDay(s.startTime)}</span>
                      <span>
                        {s.soldCount}/{s.capacity} զբաղված ·{' '}
                        {s.basePrice.toLocaleString()} ֏
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Քայլ 3 — ընտրված ցուցադրության ամփոփում */
            <>
              <button
                onClick={backToScreenings}
                className="mb-3 flex items-center gap-1 text-xs font-medium text-gray-500 transition hover:text-green-700"
              >
                <ChevronLeft className="h-4 w-4" />
                Փոխել ցուցադրությունը
              </button>

              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <p className="font-bold text-green-900">{seatMap.movie.title}</p>
                <p className="mt-1 text-sm text-green-800">
                  {formatDay(seatMap.startTime)} · {formatTime(seatMap.startTime)}
                </p>
                <p className="mt-0.5 text-sm text-green-700">{seatMap.hall.name}</p>
                <p className="mt-2 text-xs text-green-600">
                  Ընտրեք նստատեղը աջ կողմից
                </p>
              </div>
            </>
          )}
        </div>

        {/* Աջ՝ նստատեղեր և վաճառք */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          {isSeatLoading ? (
            <div className="flex h-72 items-center justify-center text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : !seatMap ? (
            <div className="flex h-72 flex-col items-center justify-center gap-3 text-gray-400">
              <Film className="h-12 w-12" />
              <p className="text-center text-sm">
                {!selectedMovieId
                  ? 'Նախ ընտրեք ֆիլմը ձախ կողմից'
                  : 'Ընտրեք ցուցադրությունը՝ նստատեղ ընտրելու համար'}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 border-b border-gray-100 pb-3">
                <p className="font-bold text-gray-900">{seatMap.movie.title}</p>
                <p className="text-sm text-gray-500">
                  {formatDay(seatMap.startTime)} ·{' '}
                  {formatTime(seatMap.startTime)} · {seatMap.hall.name}
                </p>
              </div>

              {/* Էկրան և նստատեղեր՝ նույն լայնությամբ */}
              <div className="mx-auto mb-4 w-full max-w-md">
                {/* Էկրան */}
                <div className="mb-6 perspective-near">
                  <div className="h-3 w-full rounded-t-[50%] bg-linear-to-b from-gray-400 to-gray-200 shadow-[0_10px_24px_-8px_rgba(22,163,74,0.55)] transform-[rotateX(-32deg)]" />
                  <p className="mt-2 text-center text-[11px] font-medium uppercase tracking-[0.35em] text-gray-400">
                    Էկրան
                  </p>
                </div>

                {/* Նստատեղեր */}
                <div className="space-y-2">
                  {seatRows.map(([row, seats]) => (
                    <div key={row} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-center text-xs font-semibold text-gray-400">
                        {row}
                      </span>
                      <div className="flex flex-1 flex-wrap justify-center gap-1.5">
                        {seats.map((seat) => {
                          const isSelected = selectedSeats.some(
                            (s) => s.id === seat.id
                          );
                          const isVip = seat.seatType === 'vip';
                          const isAwaitingHold =
                            seat.taken && seat.holdStatus === 'awaiting_payment';
                          const remainingMs =
                            isAwaitingHold && seat.holdUntil
                              ? Math.max(
                                  0,
                                  new Date(seat.holdUntil).getTime() - nowTick
                                )
                              : null;
                          return (
                            <button
                              key={seat.id}
                              onClick={() => selectSeat(seat)}
                              title={
                                isAwaitingHold
                                  ? `${seat.row}${seat.number} — օնլայն վճարում, մնացել է ${formatHoldCountdown(remainingMs)}`
                                  : `${seat.row}${seat.number}${isVip ? ' (VIP)' : ''}${seat.taken ? ' — զբաղված (սեղմեք՝ տոմսը տեսնելու)' : ''}`
                              }
                              className={`flex h-10 w-10 flex-col items-center justify-center rounded-lg text-[11px] font-semibold transition ${
                                isAwaitingHold
                                  ? 'bg-amber-200 text-amber-900 ring-1 ring-amber-400 hover:bg-amber-300'
                                  : seat.taken
                                    ? 'bg-gray-300 text-gray-500 line-through hover:bg-gray-400 hover:text-white'
                                    : isSelected
                                      ? 'scale-110 bg-green-600 text-white shadow-md shadow-green-300 ring-2 ring-green-300'
                                      : isVip
                                        ? 'bg-amber-100 text-amber-700 shadow-sm hover:bg-amber-200'
                                        : 'bg-gray-100 text-gray-700 shadow-sm hover:bg-green-100 hover:text-green-700'
                              }`}
                            >
                              <span>{seat.number}</span>
                              {isAwaitingHold && remainingMs != null && (
                                <span className="text-[8px] font-bold leading-none">
                                  {formatHoldCountdown(remainingMs)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <span className="w-5 shrink-0" aria-hidden />
                    </div>
                  ))}
                </div>
              </div>

              {/* Լեգենդ */}
              <div className="mb-4 flex flex-wrap gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-gray-100" /> Ազատ
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-amber-100" /> VIP
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-green-600" /> Ընտրված
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-gray-200" /> Զբաղված
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-amber-200 ring-1 ring-amber-400" />{' '}
                  Օնլայն վճարում (5ր)
                </span>
              </div>

              <p className="text-center text-xs text-gray-400">
                Ընտրեք մեկ կամ մի քանի ազատ նստատեղ, ապա հաստատեք վաճառքը
              </p>

              {selectedSeats.length > 0 && (
                <div className="mt-4 rounded-xl border border-green-200 bg-green-50/60 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Ընտրված՝ {selectedSeats.length} տեղ
                      </p>
                      <p className="text-xs text-gray-600">
                        {selectedSeats
                          .map((s) => `${s.row}${s.number}`)
                          .join(', ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-700">
                        {ticketsTotal.toLocaleString('hy-AM')} ֏
                      </p>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="text-xs font-medium text-gray-500 hover:text-gray-800"
                      >
                        Մաքրել
                      </button>
                    </div>
                  </div>

                  {!checkoutOpen ? (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setCheckoutOpen(true);
                        setPayCash(ticketsTotal);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-500"
                    >
                      <TicketIcon className="h-4 w-4" />
                      Հաստատել և վճարել
                    </button>
                  ) : (
                    <div className="space-y-3 rounded-xl border border-green-100 bg-white p-3">
                      {/* Բոնուս՝ վաճառքի պահին հեռախոս */}
                      {!bonusCustomer ? (
                        <div className="space-y-2 rounded-lg border border-violet-100 bg-violet-50/80 p-2.5">
                          <p className="text-xs font-semibold text-violet-800">
                            Բոնուսի հեռախոս (ոչ պարտադիր)
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              value={bonusPhone}
                              onChange={(e) => setBonusPhone(e.target.value)}
                              placeholder="0XX XXX XXX"
                              inputMode="numeric"
                              disabled={isCreating || bonusSearching}
                              className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none disabled:opacity-50"
                            />
                            <input
                              type="date"
                              value={bonusBirthDate}
                              onChange={(e) => setBonusBirthDate(e.target.value)}
                              min={birthDateInputMin()}
                              max={birthDateInputMax()}
                              disabled={isCreating || bonusSearching}
                              className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none disabled:opacity-50"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => void attachBonusCustomer()}
                            disabled={
                              isCreating ||
                              bonusSearching ||
                              !bonusPhone.trim()
                            }
                            className="w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                          >
                            {bonusSearching
                              ? 'Գրանցվում է…'
                              : 'Կիրառել հեռախոսը բոնուսի համար'}
                          </button>
                          {bonusError && (
                            <p className="text-xs text-rose-600">{bonusError}</p>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-xs text-violet-800">
                          Բոնուս → {bonusCustomer.name || 'Անանուն'} ·{' '}
                          {bonusCustomer.phone} · {bonusCustomer.points} միավոր
                        </div>
                      )}

                      <PaymentPanel
                        total={ticketsTotal}
                        method={payMethod}
                        setMethod={setPayMethod}
                        cashReceived={payCash}
                        setCashReceived={setPayCash}
                        accent="green"
                        disabled={isCreating}
                      />
                      {error && (
                        <p className="text-sm text-red-600">{error}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={clearSelection}
                          disabled={isCreating}
                          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Չեղարկել
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCreate()}
                          disabled={isCreating}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-500 disabled:opacity-50"
                        >
                          {isCreating ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Ստեղծվում է...
                            </>
                          ) : (
                            <>
                              <Printer className="h-4 w-4" />
                              Վաճառել և տպել
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Ինքնուրույն ապրանքների վաճառքի մոդալ */}
      {productSaleOpen && (
        <ProductScanSaleModal
          products={products}
          mode="standalone"
          isSubmitting={isCreatingOrder}
          error={error}
          lookupUnit={lookupSaleProductByQr}
          onClose={closeProductSale}
          onSubmit={handleCreateProductOrder}
          title="Ապրանքների վաճառք"
          subtitle="Սկանավորեք ապրանքի QR-ը, պոպկորնը՝ ձեռքով"
        />
      )}

      <BoxOfficeDailyReportModal
        open={dailyReportOpen}
        onClose={() => setDailyReportOpen(false)}
      />

      {returnExchangeOpen && (
        <ProductReturnExchangeModal
          products={products}
          isSubmitting={isProcessingReturn}
          error={error}
          lookupReturn={lookupBoxOfficeReturnByQr}
          lookupNewUnit={lookupSaleProductByQr}
          onClose={closeReturnExchange}
          onSubmit={handleReturnExchange}
        />
      )}

      {/* Զբաղված տեղի տոմսի ինֆո */}
      {(takenTicket || isTakenLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={closeTakenModal}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-4">
              <h3 className="flex items-center gap-2 font-bold text-gray-900">
                <TicketIcon className="h-5 w-5 text-green-600" />
                Տոմսի տվյալներ
              </h3>
              <button
                onClick={closeTakenModal}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isTakenLoading || !takenTicket ? (
              <div className="flex h-48 items-center justify-center text-gray-500">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
                {takenModalError && (
                  <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {takenModalError}
                  </div>
                )}

                <div className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Տոմս</span>
                    <span className="font-bold text-gray-900">
                      #{takenTicket.id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Կարգավիճակ</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        takenTicket.status === 'used'
                          ? 'bg-gray-100 text-gray-700'
                          : takenTicket.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : takenTicket.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {statusLabels[takenTicket.status] || takenTicket.status}
                    </span>
                  </div>
                  {takenTicket.status === 'awaiting_payment' &&
                    takenTicket.holdUntil && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        <Clock className="mr-1 inline h-3.5 w-3.5" />
                        Մնացել է{' '}
                        <strong>
                          {formatHoldCountdown(
                            Math.max(
                              0,
                              new Date(takenTicket.holdUntil).getTime() -
                                nowTick
                            )
                          )}
                        </strong>{' '}
                        օնլայն վճարման համար։ Ժամանակը լրանալուց հետո տեղը
                        կբացվի։
                      </div>
                    )}
                  <div className="border-t border-gray-100" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Ֆիլմ</span>
                    <span className="font-semibold text-gray-900">
                      {takenTicket.screening.movie.title}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Ժամ</span>
                    <span className="text-gray-900">
                      {formatDay(takenTicket.screening.startTime)} ·{' '}
                      {formatTime(takenTicket.screening.startTime)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Տեղ</span>
                    <span className="font-semibold text-gray-900">
                      {takenTicket.seat.row}
                      {takenTicket.seat.number}
                      {takenTicket.seat.seatType === 'vip' ? ' (VIP)' : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Գին</span>
                    <span className="font-bold text-gray-900">
                      {takenTicket.price.toLocaleString()} ֏
                    </span>
                  </div>
                  {takenTicket.payment && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Վճարում</span>
                      <span className="text-gray-900">
                        {takenTicket.payment.method === 'cash'
                          ? 'Կանխիկ'
                          : takenTicket.payment.method}
                      </span>
                    </div>
                  )}
                  {takenTicket.user?.name && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Հաճախորդ</span>
                      <span className="flex items-center gap-1.5 text-gray-900">
                        <User className="h-4 w-4 text-gray-400" />
                        {takenTicket.user.name}
                      </span>
                    </div>
                  )}
                </div>

                {showCancelConfirm && canCancelTakenTicket && (
                  <div className="border-t border-red-100 bg-red-50 px-5 py-4">
                    <p className="text-sm text-red-800">
                      Չեղարկե՞լ տոմս #{takenTicket.id} ({takenTicket.seat.row}
                      {takenTicket.seat.number})։ Նստատեղը կրկին ազատ կլինի
                      վաճառքի համար։
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => {
                          setShowCancelConfirm(false);
                          setTakenModalError(null);
                        }}
                        disabled={isCancelling}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Ոչ
                      </button>
                      <button
                        onClick={handleCancelTicket}
                        disabled={isCancelling}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        {isCancelling ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Ban className="h-4 w-4" />
                        )}
                        Այո, չեղարկել
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4">
                  {canCancelTakenTicket && !showCancelConfirm && (
                    <button
                      onClick={() => {
                        setTakenModalError(null);
                        setShowCancelConfirm(true);
                      }}
                      disabled={isCancelling}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      <Ban className="h-4 w-4" />
                      Չեղարկել տոմսը (ազատել նստատեղը)
                    </button>
                  )}

                  {cannotCancelReason && (
                    <p className="text-center text-xs text-gray-500">
                      {cannotCancelReason}
                    </p>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => openPrint(takenTicket.id)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500"
                    >
                      <Printer className="h-4 w-4" />
                      Տպել կրկին
                    </button>
                    <button
                      onClick={closeTakenModal}
                      disabled={isCancelling}
                      className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    >
                      Փակել
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
