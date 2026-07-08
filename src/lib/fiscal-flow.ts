'use client';

import {
  isHdmAgentEnabled,
  printHdmReceipt,
  printHdmReturn,
  type HdmPrintReceiptInput,
  type HdmReturnReceiptInput,
} from '@/lib/hdm-agent';
import {
  recordFiscalReceipt,
  type FiscalSource,
} from '@/app/actions/fiscal';

export interface FiscalNotice {
  type: 'success' | 'warning';
  message: string;
}

export { isHdmAgentEnabled };

/**
 * Վաճառքի ֆիսկալ հոսք՝ ՀԴՄ agent-ին կտրոն տպել և արդյունքը (հաջողված/ձախողված)
 * պահել բազայում։ Ձախողման դեպքում պահվում է հարցումը՝ հետագա վերատպման համար։
 */
export async function submitSaleFiscal(params: {
  input: HdmPrintReceiptInput;
  source: FiscalSource;
  ticketId?: number | null;
  orderId?: number | null;
}): Promise<FiscalNotice> {
  const { input, source, ticketId, orderId } = params;

  try {
    const res = await printHdmReceipt(input);

    if (res.ok && res.fiscal) {
      await recordFiscalReceipt({
        operation: 'sale',
        source,
        paymentMethod: input.paymentMethod,
        status: 'printed',
        ticketId: ticketId ?? null,
        orderId: orderId ?? null,
        fiscal: res.fiscal,
        requestPayload: input,
      });
      return {
        type: 'success',
        message: `Ֆիսկալ կտրոն տպված է · № ${res.fiscal.fiscal}`,
      };
    }

    await recordFiscalReceipt({
      operation: 'sale',
      source,
      paymentMethod: input.paymentMethod,
      status: 'failed',
      ticketId: ticketId ?? null,
      orderId: orderId ?? null,
      error: res.error ?? null,
      code: res.code ?? null,
      requestPayload: input,
    });
    return {
      type: 'warning',
      message: `${res.error ?? 'Ֆիսկալ կտրոնը չտպվեց'} — պահվեց, կարող եք վերատպել /admin/fiscal-ում`,
    };
  } catch {
    return {
      type: 'warning',
      message: 'Ֆիսկալ կտրոնի սխալ (ՀԴՄ agent)',
    };
  }
}

/**
 * Վերադարձի ֆիսկալ հոսք՝ ՀԴՄ վերադարձի կտրոն սկզբնական վաճառքի հղումով,
 * ապա պահել բազայում։
 */
export async function submitReturnFiscal(params: {
  input: HdmReturnReceiptInput;
  source: FiscalSource;
  ticketId?: number | null;
  orderId?: number | null;
}): Promise<FiscalNotice> {
  const { input, source, ticketId, orderId } = params;

  try {
    const res = await printHdmReturn(input);

    if (res.ok && res.fiscal) {
      await recordFiscalReceipt({
        operation: 'return',
        source,
        paymentMethod: input.paymentMethod,
        status: 'printed',
        ticketId: ticketId ?? null,
        orderId: orderId ?? null,
        fiscal: res.fiscal,
        requestPayload: input,
      });
      return {
        type: 'success',
        message: `Վերադարձի ֆիսկալ կտրոն տպված է · № ${res.fiscal.fiscal}`,
      };
    }

    await recordFiscalReceipt({
      operation: 'return',
      source,
      paymentMethod: input.paymentMethod,
      status: 'failed',
      ticketId: ticketId ?? null,
      orderId: orderId ?? null,
      error: res.error ?? null,
      code: res.code ?? null,
      requestPayload: input,
    });
    return {
      type: 'warning',
      message: `${res.error ?? 'Վերադարձի կտրոնը չտպվեց'} — պահվեց, կարող եք վերատպել /admin/fiscal-ում`,
    };
  } catch {
    return {
      type: 'warning',
      message: 'Վերադարձի ֆիսկալ կտրոնի սխալ (ՀԴՄ agent)',
    };
  }
}
