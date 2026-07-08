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
  const useExtPOS =
    body.useExtPOS ?? (body.paymentMethod === 'card' ? cfg.hdm.useExtPos : false);

  const items: HdmReceiptItem[] = body.items.map((item) => ({
    dep: item.dep ?? cfg.hdm.defaultDep,
    qty: roundQty(item.qty ?? 1),
    price: roundMoney(item.price),
    productCode: item.productCode.slice(0, 50),
    productName: item.productName.slice(0, 50),
    adgCode: item.adgCode ?? cfg.hdm.defaultAdgProduct,
    unit: (item.unit ?? 'հատ').slice(0, 50),
  }));

  const eMarks = (body.eMarks ?? []).filter(Boolean);

  return {
    mode: 2,
    items,
    paidAmount: isCash ? total : 0,
    paidAmountCard: isCash ? 0 : total,
    partialAmount: 0,
    prePaymentAmount: 0,
    useExtPOS: !isCash && useExtPOS,
    partnerTin: null,
    eMarks: eMarks.length > 0 ? eMarks : undefined,
  };
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
      adgCode: input.ticketAdgCode ?? cfg.hdm.defaultAdgTicket,
      unit: 'տոմս',
    },
    ...input.products.map((p, idx) => ({
      productCode: p.productCode ?? `PROD-${idx + 1}`,
      productName: p.name,
      price: p.price,
      qty: p.qty,
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
