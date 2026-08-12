/**
 * Շրջհարկի հաշվարկ՝ ՀՀ հարկային օրենսգիրք հոդ. 258 (2025թ.-ից գործող խմբագրություն)։
 *
 * Հաշվարկի հերթականությունը (հոդ. 258 մասեր 1–6)՝
 *   1. հարկ = հարկման բազա × բազային դրույք
 *   2. նվազեցում = փաստաթղթավորված ծախս × նվազեցման դրույք
 *   3. վճարման ենթակա = max(հարկ − նվազեցում, բազա × նվազագույն դրույք)
 *   4. չօգտագործված նվազեցումը փոխանցվում է հաջորդ հաշվետու ժամանակաշրջան
 *      (նույն գործունեության տեսակի շրջանակում)
 *
 * ՀԴՄ դասակարգում (GoCinema agent)՝
 * - տոմսեր → ԱԴԳ 59.14 → «այլ գործունեություն» 10% / 6% / min 4.5%
 * - ապրանքներ → ԱԴԳ 47.x → «առևտրային գործունեություն» 10% / 9.5% / min 1%
 *
 * Սա գնահատական է հաշվապահի ստուգման համար, ոչ վերջնական ՊԵԿ հայտարարագիր։
 */

export type TaxStream = 'tickets' | 'products';

export interface StreamTaxRates {
  baseRate: number;
  deductionRate: number;
  minRate: number;
  adgCode: string;
  labelHy: string;
  activityHy: string;
}

export const TAX_STREAM_RATES: Record<TaxStream, StreamTaxRates> = {
  tickets: {
    baseRate: 0.1,
    deductionRate: 0.06,
    minRate: 0.045,
    adgCode: '59.14',
    labelHy: 'Տոմսեր · այլ գործունեություն',
    activityHy: 'Այլ գործունեություն, ծառայություններ',
  },
  products: {
    baseRate: 0.1,
    deductionRate: 0.095,
    minRate: 0.01,
    adgCode: '47.00',
    labelHy: 'Ապրանքներ · առևտուր',
    activityHy: 'Առևտրային գործունեություն',
  },
};

export interface StreamTaxInput {
  /** Հարկման բազա՝ իրացման շրջանառություն (− վերադարձներ) */
  turnover: number;
  /** Փաստաթղթավորված նվազեցվող ծախս (հաշիվ-ապրանքագրերով) */
  documentedCosts: number;
  /** Նախորդ եռամսյակներից փոխանցված չօգտագործված նվազեցում (հարկի դրամ) */
  carriedInDeduction?: number;
}

export interface StreamTaxResult {
  stream: TaxStream;
  rates: StreamTaxRates;
  turnover: number;
  documentedCosts: number;
  /** բազա × բազային դրույք */
  grossTax: number;
  /** ծախս × նվազեցման դրույք */
  deductionFromCosts: number;
  /** նախորդ ժամանակաշրջաններից փոխանցված */
  carriedInDeduction: number;
  /** ընդհանուր հասանելի նվազեցում */
  availableDeduction: number;
  /** որքան կարելի է առավելագույնը կիրառել (նվազագույն շեմի սահմանափակում) */
  maxUsableDeduction: number;
  /** իրականում կիրառված նվազեցում */
  appliedDeduction: number;
  /** չօգտագործված՝ փոխանցվում է հաջորդ ժամանակաշրջան */
  carriedOutDeduction: number;
  /** նվազագույն շեմ */
  minTax: number;
  /** վճարման ենթակա հարկ */
  taxDue: number;
  effectiveRate: number;
  /** true = նվազեցումը կրճատվել է նվազագույն շեմի պատճառով */
  floorApplied: boolean;
}

function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

/** Հարկային գումարները հայտարարագրվում են ամբողջ դրամով */
function roundDram(value: number): number {
  return Math.round(Number.isFinite(value) ? value : 0);
}

export function calcStreamTurnoverTax(
  stream: TaxStream,
  input: StreamTaxInput
): StreamTaxResult {
  const rates = TAX_STREAM_RATES[stream];
  const turnover = Math.max(0, round2(input.turnover));
  const documentedCosts = Math.max(0, round2(input.documentedCosts));
  const carriedInDeduction = Math.max(0, roundDram(input.carriedInDeduction ?? 0));

  const grossTax = roundDram(turnover * rates.baseRate);
  const minTax = roundDram(turnover * rates.minRate);

  const deductionFromCosts = roundDram(documentedCosts * rates.deductionRate);
  const availableDeduction = deductionFromCosts + carriedInDeduction;

  // Հոդ. 258՝ հարկը չի կարող իջնել նվազագույն շեմից ցածր,
  // ուստի նվազեցումը կիրառվում է միայն այդ չափով։
  const maxUsableDeduction = Math.max(0, grossTax - minTax);
  const appliedDeduction = Math.min(availableDeduction, maxUsableDeduction);
  const carriedOutDeduction = Math.max(0, availableDeduction - appliedDeduction);

  const taxDue = Math.max(minTax, grossTax - appliedDeduction);
  const effectiveRate = turnover > 0 ? taxDue / turnover : 0;

  return {
    stream,
    rates,
    turnover,
    documentedCosts,
    grossTax,
    deductionFromCosts,
    carriedInDeduction,
    availableDeduction,
    maxUsableDeduction,
    appliedDeduction,
    carriedOutDeduction,
    minTax,
    taxDue,
    effectiveRate,
    floorApplied: availableDeduction > appliedDeduction,
  };
}

export interface CombinedTaxResult {
  tickets: StreamTaxResult;
  products: StreamTaxResult;
  totalTurnover: number;
  totalDocumentedCosts: number;
  totalTaxDue: number;
  totalCarriedOutDeduction: number;
}

export function calcCombinedTurnoverTax(input: {
  tickets: StreamTaxInput;
  products: StreamTaxInput;
}): CombinedTaxResult {
  const tickets = calcStreamTurnoverTax('tickets', input.tickets);
  const products = calcStreamTurnoverTax('products', input.products);
  return {
    tickets,
    products,
    totalTurnover: round2(tickets.turnover + products.turnover),
    totalDocumentedCosts: round2(
      tickets.documentedCosts + products.documentedCosts
    ),
    totalTaxDue: roundDram(tickets.taxDue + products.taxDue),
    totalCarriedOutDeduction: roundDram(
      tickets.carriedOutDeduction + products.carriedOutDeduction
    ),
  };
}

/** Գործնական P&L՝ տոմսի պահվող մաս (ոչ հարկային բազա) */
export function calcTicketOperationalSplit(
  ticketTurnover: number,
  producerSharePercent: number
): { producerShare: number; cinemaKeep: number; sharePercent: number } {
  const share = Math.min(100, Math.max(0, producerSharePercent));
  const turnover = Math.max(0, round2(ticketTurnover));
  const producerShare = round2((turnover * share) / 100);
  const cinemaKeep = round2(turnover - producerShare);
  return { producerShare, cinemaKeep, sharePercent: share };
}
