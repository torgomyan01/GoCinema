/**
 * Dexatel SMS Verify API client.
 *
 * OTP-ը գեներացվում և ստուգվում է մեր DB-ում։ Dexatel-ը միայն առաքում է SMS։
 * Docs: https://developers.dexatel.com/docs/verify-api-sms
 *
 * `DEXATEL_SENDER_ID` կարող է լինել sender UUID
 * (օր. 3a622ecd-51ce-44af-88e0-213638f952c3) կամ name (`GoCinema`)։
 * API `sender` դաշտին ուղարկում ենք alphanumeric name-ը՝ հեռախոսում
 * ճիշտ «GoCinema» երևալու համար։ UUID-ն ուղիղ տալիս է սխալ from։
 */

const DEXATEL_API_BASE = 'https://api.dexatel.com/v1';
const DEXATEL_VERIFY_URL = `${DEXATEL_API_BASE}/verifications`;

/** Cache resolved alphanumeric sender name for this process. */
let resolvedSenderName: string | null = null;

/**
 * Հայկական `0XXXXXXXX` → Dexatel `374XXXXXXXX`
 * (docs՝ միայն թվեր, country code-ով, առանց + / բացատների)։
 */
export function toDexatelPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('374')) return digits;
  if (digits.startsWith('0')) return `374${digits.slice(1)}`;
  return `374${digits}`;
}

interface SendSmsResult {
  success: boolean;
  error?: string;
  code?: string;
}

export type SmsTemplate = 'verification' | 'reset' | 'ticket';

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function getTemplateId(template: SmsTemplate): string | undefined {
  switch (template) {
    case 'verification':
      return env('DEXATEL_TEMPLATE_VERIFICATION');
    case 'reset':
      return env('DEXATEL_TEMPLATE_RESET');
    case 'ticket':
      return env('DEXATEL_TEMPLATE_TICKET');
    default:
      return undefined;
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function resolveSenderName(
  apiKey: string,
  configured: string
): Promise<string | null> {
  const value = configured.trim();
  if (!value) return null;
  if (!isUuid(value)) return value;
  if (resolvedSenderName) return resolvedSenderName;

  try {
    const res = await fetch(`${DEXATEL_API_BASE}/senders/${value}`, {
      headers: { 'X-Dexatel-Key': apiKey },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('[SMS] Failed to resolve sender UUID:', res.status);
      return null;
    }
    const body = await res.json();
    const name =
      (body?.data?.code as string | undefined) ||
      (body?.data?.name as string | undefined);
    if (name) {
      resolvedSenderName = name;
      console.info(`[SMS] Resolved sender UUID → "${name}"`);
      return name;
    }
  } catch (err) {
    console.error('[SMS] Sender resolve error:', err);
  }
  return null;
}

function mapDexatelError(code: string | undefined, message: string): string {
  switch (code) {
    case '1504':
    case '1505':
      return 'SMS ուղարկողի անունը (Sender ID) սխալ է կարգավորված';
    case '1523':
      return 'Հեռախոսահամարը անվավեր է SMS ուղարկելու համար';
    case '1530':
      return 'Այս համարն արգելափակված է SMS ուղարկելու համար';
    case '1531':
      return 'Այս երկիր ուղարկումը ժամանակավորապես անհասանելի է։ Փորձեք մի փոքր ուշ։';
    case '1524':
      return 'SMS ծառայությունը դեռ ակտիվացված չէ';
    case '1525':
      return 'SMS սահմանաչափը սպառվել է։ Փորձեք ավելի ուշ։';
    case 'delivery_failed':
      return 'SMS առաքումը ձախողվեց օպերատորի կողմից։ Փորձեք կրկին կամ այլ համար։';
    default:
      return message
        ? `SMS ուղարկելը ձախողվեց (${message})`
        : 'SMS ուղարկելը ձախողվեց';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Կարճ ստուգում՝ եթե օպերատորը միանգամից մերժում է, օգտատիրոջը չենք ասում «ուղարկվեց»։
 * Եթե դեռ enroute/sent է՝ համարում ենք հաջող (առաքումը կարող է տևել վայրկյաններ)։
 */
async function confirmMessageAccepted(
  apiKey: string,
  messageId: string
): Promise<{ ok: boolean; status?: string; details?: string }> {
  for (let i = 0; i < 3; i++) {
    await sleep(1200);
    try {
      const res = await fetch(`${DEXATEL_API_BASE}/messages/${messageId}`, {
        headers: { 'X-Dexatel-Key': apiKey },
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const body = await res.json();
      const data = body?.data ?? body;
      const status = String(data?.status || '');
      const details = String(data?.status_details || '');

      if (
        status === 'failed' ||
        status === 'rejected' ||
        status === 'expired'
      ) {
        return { ok: false, status, details };
      }
      if (
        status === 'delivered' ||
        status === 'sent' ||
        status === 'enroute' ||
        status === 'read'
      ) {
        // sent/enroute — ընդունված է route-ին; delivered դեռ կարող է գալ ավելի ուշ
        if (status === 'sent' || status === 'delivered' || status === 'read') {
          return { ok: true, status, details };
        }
        // enroute — շարունակել poll, վերջում optimistic ok
      }
    } catch {
      // ignore transient errors
    }
  }
  return { ok: true };
}

/**
 * Ուղարկում է կոդը SMS-ով Dexatel Verify API-ով։
 */
export async function sendVerificationSms(
  phone: string,
  code: string,
  template: SmsTemplate = 'verification'
): Promise<SendSmsResult> {
  const apiKey = env('DEXATEL_API_KEY');
  const configuredSender = env('DEXATEL_SENDER_ID');
  const templateId = getTemplateId(template);

  if (!apiKey || !configuredSender || !templateId) {
    console.error(
      `[SMS] Dexatel-ի կարգավորումները բացակայում են (API key / Sender ID / "${template}" template)`
    );
    return {
      success: false,
      error: 'SMS ծառայությունը կարգավորված չէ',
    };
  }

  const sender = await resolveSenderName(apiKey, configuredSender);
  if (!sender) {
    console.error(
      '[SMS] Cannot resolve sender name from DEXATEL_SENDER_ID. Use GoCinema'
    );
    return {
      success: false,
      error: 'SMS ուղարկողի անունը (Sender ID) սխալ է կարգավորված',
      code: '1504',
    };
  }

  const dexatelPhone = toDexatelPhone(phone);

  try {
    const res = await fetch(DEXATEL_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dexatel-Key': apiKey,
      },
      body: JSON.stringify({
        data: {
          channel: 'SMS',
          sender,
          phone: dexatelPhone,
          template: templateId,
          code,
        },
      }),
    });

    let body: Record<string, unknown> | null = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (res.status === 201 || res.ok) {
      const data = (body?.data as Record<string, unknown> | undefined) ?? body;
      const messageId =
        (data?.message_id as string | undefined) ||
        (body?.message_id as string | undefined);

      if (messageId) {
        const delivery = await confirmMessageAccepted(apiKey, messageId);
        if (!delivery.ok) {
          console.error(
            '[SMS] Delivery failed after accept:',
            delivery.status,
            delivery.details,
            `| to=${dexatelPhone} sender=${sender}`
          );
          return {
            success: false,
            error: mapDexatelError('delivery_failed', delivery.details || ''),
            code: 'delivery_failed',
          };
        }
      }

      return { success: true };
    }

    const first = (
      body?.errors as
        | Array<{ message?: string; code?: string | number }>
        | undefined
    )?.[0];
    const apiMessage =
      first?.message ||
      (body?.message as string | undefined) ||
      (body?.error as string | undefined) ||
      `Dexatel error ${res.status}`;
    const apiCode =
      first?.code != null
        ? String(first.code)
        : body?.code != null
          ? String(body.code)
          : undefined;

    console.error(
      '[SMS] Dexatel send failed:',
      res.status,
      apiCode ?? '-',
      apiMessage,
      `| to=${dexatelPhone} sender=${sender} template=${template}`
    );

    return {
      success: false,
      error: mapDexatelError(apiCode, apiMessage),
      code: apiCode,
    };
  } catch (err) {
    console.error('[SMS] Dexatel request error:', err);
    return { success: false, error: 'SMS ուղարկելիս սխալ է տեղի ունեցել' };
  }
}
