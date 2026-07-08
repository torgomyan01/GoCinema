import type { AgentConfig } from './config.js';
import type {
  AgentPrintReceiptBody,
  HdmPrintReceiptRequest,
  HdmReceiptItem,
} from './types.js';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function buildPrintReceiptRequest(
  cfg: AgentConfig,
  body: AgentPrintReceiptBody
): Omit<HdmPrintReceiptRequest, 'seq'> {
  const total = roundMoney(body.total);
  const isCash = body.paymentMethod === 'cash';
  // Spec §4.5.4: useExtPOS=false → ՀԴՄ-ն միացնում է իր ներքին անկանխիկ ծրագիրը
  // useExtPOS=true → արտաքին POS արդեն վճարված է, տերմինալ չի բացվում
  const useExtPOS = isCash
    ? false
    : (body.useExtPOS ?? cfg.hdm.useExtPos);

  const items: HdmReceiptItem[] = body.items.map((item) => {
    const isTicket =
      item.productCode === 'TICKET' || item.unit === 'տոմս';
    const defaultDep = isTicket ? cfg.hdm.depTicket : cfg.hdm.depProduct;
    return {
      dep: item.dep ?? defaultDep,
      qty: roundQty(item.qty ?? 1),
      price: roundMoney(item.price),
      productCode: item.productCode.slice(0, 50),
      productName: item.productName.slice(0, 50),
      adgCode:
        item.adgCode ??
        (isTicket ? cfg.hdm.defaultAdgTicket : cfg.hdm.defaultAdgProduct),
      unit: (item.unit ?? 'հատ').slice(0, 50),
    };
  });

  const eMarks = (body.eMarks ?? []).filter(Boolean);

  const request: Omit<HdmPrintReceiptRequest, 'seq'> = {
    mode: 2,
    items,
    paidAmount: isCash ? total : 0,
    paidAmountCard: isCash ? 0 : total,
    partialAmount: 0,
    prePaymentAmount: 0,
    useExtPOS,
    partnerTin: null,
    eMarks: eMarks.length > 0 ? eMarks : undefined,
  };

  // useExtPOS=false դեպքում կարող ենք նշել վճարային համակարգի կոդը։
  // null → ՀԴՄ սարքում ընտրություն / միակ համակարգ։
  if (!isCash && !useExtPOS && cfg.hdm.paymentSystem != null) {
    request.PaymentSystem = cfg.hdm.paymentSystem;
  } else if (!isCash && !useExtPOS) {
    request.PaymentSystem = null;
  }

  return request;
}

/** Տոմս + ապրանքների միավորված կտրոն */
export function buildTicketSaleReceipt(
  cfg: AgentConfig,
  input: {
    ticketName: string;
    ticketPrice: number;
    ticketAdgCode?: string;
    products: Array<{
      name: string;
      price: number;
      qty: number;
      productCode?: string;
      adgCode?: string;
      eMark?: string | null;
    }>;
    paymentMethod: 'cash' | 'card';
    total: number;
  }
): AgentPrintReceiptBody {
  const items = [
    {
      productCode: 'TICKET',
      productName: input.ticketName.slice(0, 50),
      price: input.ticketPrice,
      qty: 1,
      dep: cfg.hdm.depTicket,
      adgCode: input.ticketAdgCode ?? cfg.hdm.defaultAdgTicket,
      unit: 'տոմս',
    },
    ...input.products.map((p, idx) => ({
      productCode: p.productCode ?? `PROD-${idx + 1}`,
      productName: p.name,
      price: p.price,
      qty: p.qty,
      dep: cfg.hdm.depProduct,
      adgCode: p.adgCode ?? cfg.hdm.defaultAdgProduct,
      unit: 'հատ',
    })),
  ];

  const eMarks = input.products
    .map((p) => p.eMark)
    .filter((code): code is string => Boolean(code?.trim()));

  return {
    paymentMethod: input.paymentMethod,
    total: input.total,
    items,
    eMarks: eMarks.length > 0 ? eMarks : undefined,
  };
}
