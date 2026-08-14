import { isDeductibleCostType } from '@/lib/accounting';

/** ՊԵԿ շրջհարկի հայտարարագիր (form WC)՝ ամբողջ դրամ, վերև կլորացում */
export function ceilAmd(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.ceil(n - 1e-9);
}

export const PEK_QUARTER_CODE: Record<1 | 2 | 3 | 4, 21 | 22 | 23 | 24> = {
  1: 21,
  2: 22,
  3: 23,
  4: 24,
};

export const PEK_ACTIVITY_TICKETS = {
  section: 'J',
  segment1: '5',
  segment2: '9',
  group: '1',
  class: '4',
  subclass: '0',
  code: '59.14.0',
} as const;

export const PEK_ACTIVITY_PRODUCTS = {
  section: 'G',
  segment1: '4',
  segment2: '7',
  group: '1',
  class: '9',
  subclass: '0',
  code: '47.19.0',
} as const;

export type PekCostBucket = 'goods' | 'directOther' | 'shared' | 'excluded';

export function pekCostBucket(
  costType: string,
  deductible: boolean
): PekCostBucket {
  if (!deductible || !isDeductibleCostType(costType)) return 'excluded';
  if (costType === 'goods') return 'goods';
  if (costType === 'service') return 'directOther';
  return 'shared';
}

export interface PekCostAllocation {
  field_5_4_1: number;
  field_5_4_2: number;
  field_9_4_1: number;
  field_9_4_2: number;
  productsDocumented: number;
  ticketsDocumented: number;
}

/**
 * 5.4.1 = ապրանքի սկզբնական արժեք (goods)
 * 9.4.1 = այլ գործունեության ուղղակի ծախս (service / արտադրող)
 * 5.4.2 + 9.4.2 = իրացման և վարչական՝ ըստ շրջանառության տեսակարար կշռի
 */
export function allocatePekCosts(input: {
  ticketsTurnover: number;
  productsTurnover: number;
  goodsCost: number;
  directOtherCost: number;
  sharedSellingAdmin: number;
}): PekCostAllocation {
  const ticketsT = Math.max(0, input.ticketsTurnover);
  const productsT = Math.max(0, input.productsTurnover);
  const total = ticketsT + productsT;
  const goods = Math.max(0, input.goodsCost);
  const direct = Math.max(0, input.directOtherCost);
  const shared = Math.max(0, input.sharedSellingAdmin);

  let productsAdmin = 0;
  let ticketsAdmin = 0;
  if (shared > 0) {
    if (total <= 0) {
      ticketsAdmin = shared;
    } else {
      productsAdmin = (shared * productsT) / total;
      ticketsAdmin = shared - productsAdmin;
    }
  }

  return {
    field_5_4_1: goods,
    field_5_4_2: productsAdmin,
    field_9_4_1: direct,
    field_9_4_2: ticketsAdmin,
    productsDocumented: goods + productsAdmin,
    ticketsDocumented: direct + ticketsAdmin,
  };
}

export function activityWeights(
  ticketsTurnover: number,
  productsTurnover: number
): { tickets: number; products: number } {
  const t = Math.max(0, ticketsTurnover);
  const p = Math.max(0, productsTurnover);
  const total = t + p;
  if (total <= 0) return { tickets: 100, products: 0 };
  const ticketsW = Math.round((t / total) * 100);
  if (ticketsW >= 100) return { tickets: 100, products: 0 };
  if (ticketsW <= 0) return { tickets: 0, products: 100 };
  return { tickets: ticketsW, products: 100 - ticketsW };
}

function activityRow(
  index: number,
  activity: typeof PEK_ACTIVITY_TICKETS | typeof PEK_ACTIVITY_PRODUCTS,
  weight: number
): string {
  return [
    `                    <ActivityRow Index="${index}">`,
    `                        <Section>${activity.section}</Section>`,
    `                        <Segment1>${activity.segment1}</Segment1>`,
    `                        <Segment2>${activity.segment2}</Segment2>`,
    `                        <Group>${activity.group}</Group>`,
    `                        <Class>${activity.class}</Class>`,
    `                        <Subclass>${activity.subclass}</Subclass>`,
    `                        <Weight>${weight}</Weight>`,
    `                    </ActivityRow>`,
  ].join('\n');
}

export interface PekXmlInput {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  field_5_1: number;
  field_5_4_1: number;
  field_5_4_2: number;
  field_5_7: number;
  field_9_1: number;
  field_9_4_1: number;
  field_9_4_2: number;
  field_9_7: number;
}

export function buildPekXml(input: PekXmlInput): string {
  const quarterCode = PEK_QUARTER_CODE[input.quarter];
  const field_5_1 = ceilAmd(input.field_5_1);
  const field_5_4_1 = ceilAmd(input.field_5_4_1);
  const field_5_7 = ceilAmd(input.field_5_7);
  const field_9_1 = ceilAmd(input.field_9_1);
  const field_9_4_1 = ceilAmd(input.field_9_4_1);
  const field_9_7 = ceilAmd(input.field_9_7);

  const sharedPool = ceilAmd(input.field_5_4_2 + input.field_9_4_2);
  const turnoverTotal = field_5_1 + field_9_1;
  let field_5_4_2 = 0;
  let field_9_4_2 = 0;
  if (sharedPool > 0 && turnoverTotal > 0) {
    field_5_4_2 = Math.round((sharedPool * field_5_1) / turnoverTotal);
    if (field_5_4_2 > sharedPool) field_5_4_2 = sharedPool;
    field_9_4_2 = sharedPool - field_5_4_2;
  } else if (sharedPool > 0) {
    field_9_4_2 = sharedPool;
  }

  const weights = activityWeights(field_9_1, field_5_1);
  const rows: string[] = [];
  let index = 1;
  if (weights.tickets > 0) {
    rows.push(activityRow(index, PEK_ACTIVITY_TICKETS, weights.tickets));
    index += 1;
  }
  if (weights.products > 0) {
    rows.push(activityRow(index, PEK_ACTIVITY_PRODUCTS, weights.products));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<SignedData Version="1.0">
    <Data>
        <Declaration Version="1.0" Id="wc">
            <Body>
                <Fields>
                    <taxYear>${input.year}</taxYear>
                    <quarter>${quarterCode}</quarter>
                    <Field_5_1>${field_5_1}</Field_5_1>
                    <Field_5_4_1>${field_5_4_1}</Field_5_4_1>
                    <Field_5_4_2>${field_5_4_2}</Field_5_4_2>
                    <Field_5_7>${field_5_7}</Field_5_7>
                    <Field_6_1>0</Field_6_1>
                    <Field_6_4_1>0</Field_6_4_1>
                    <Field_6_4_2>0</Field_6_4_2>
                    <Field_6_7>0</Field_6_7>
                    <Field_7_1>0</Field_7_1>
                    <Field_7_4_1>0</Field_7_4_1>
                    <Field_7_4_2>0</Field_7_4_2>
                    <Field_7_7>0</Field_7_7>
                    <Field_8_1>0</Field_8_1>
                    <Field_8_4>0</Field_8_4>
                    <Field_9_1>${field_9_1}</Field_9_1>
                    <Field_9_4_1>${field_9_4_1}</Field_9_4_1>
                    <Field_9_4_2>${field_9_4_2}</Field_9_4_2>
                    <Field_9_7>${field_9_7}</Field_9_7>
                    <Field_12>0</Field_12>
                    <Field_13>0</Field_13>
                    <Field_15>0</Field_15>
                    <Field_18>0</Field_18>
                    <Field_19>0</Field_19>
                    <Field_20>0</Field_20>
                    <Field_23>0</Field_23>
                    <Field_24>0</Field_24>
                    <Field_25>0</Field_25>
                    <Field_26>0</Field_26>
                </Fields>

                <ActivityTable>
${rows.join('\n')}
                </ActivityTable>

            </Body>
        </Declaration>
    </Data>
</SignedData>
`;
}

export function pekXmlFilename(year: number, quarter: number): string {
  return `WC_${year}_Q${quarter}.xml`;
}
