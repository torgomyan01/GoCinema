/**
 * Dexatel SMS Verify API client.
 *
 * Մենք ինքներս ենք գեներացնում OTP կոդը (պահվում է մեր DB-ում), իսկ Dexatel-ը
 * միայն առաքում է այն SMS-ով՝ Verify API-ի միջոցով։ Ստուգումը կատարվում է մեր
 * կողմից (DB-ում), ոչ թե Dexatel-ի GET endpoint-ով։
 *
 * Փաստաթղթեր՝ https://developers.dexatel.com/docs/verify-api-sms
 */

const DEXATEL_API_URL = 'https://api.dexatel.com/v1/verifications';

/**
 * Հայկական `0XXXXXXXX` ձևաչափը վերածում է Dexatel-ի պահանջած
 * միջազգային ձևաչափի՝ երկրի կոդով, առանց առաջատար 0-ի՝ `374XXXXXXXX`։
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
}

/**
 * SMS template-ի տեսակները՝ ըստ Dexatel dashboard-ի։
 * Ամեն մեկը պետք է պարունակի `{code}` placeholder-ը։
 */
export type SmsTemplate = 'verification' | 'reset' | 'ticket';

function getTemplateId(template: SmsTemplate): string | undefined {
  switch (template) {
    case 'verification':
      return process.env.DEXATEL_TEMPLATE_VERIFICATION;
    case 'reset':
      return process.env.DEXATEL_TEMPLATE_RESET;
    case 'ticket':
      return process.env.DEXATEL_TEMPLATE_TICKET;
    default:
      return undefined;
  }
}

/**
 * Ուղարկում է կոդը SMS-ով Dexatel-ի միջոցով։
 * `code`-ը մեր գեներացրած OTP-ն է (4–8 թվանշան)։
 * `template`-ով ընտրվում է համապատասխան Dexatel template-ը։
 */
export async function sendVerificationSms(
  phone: string,
  code: string,
  template: SmsTemplate = 'verification'
): Promise<SendSmsResult> {
  const apiKey = process.env.DEXATEL_API_KEY;
  const sender = process.env.DEXATEL_SENDER_ID;
  const templateId = getTemplateId(template);

  if (!apiKey || !sender || !templateId) {
    console.error(
      `[SMS] Dexatel-ի կարգավորումները բացակայում են (API key / Sender ID / "${template}" template)`
    );
    return {
      success: false,
      error: 'SMS ծառայությունը կարգավորված չէ',
    };
  }

  const dexatelPhone = toDexatelPhone(phone);

  try {
    const res = await fetch(DEXATEL_API_URL, {
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

    if (res.status === 201 || res.ok) {
      return { success: true };
    }

    let message = `Dexatel error ${res.status}`;
    try {
      const data = await res.json();
      message =
        data?.errors?.[0]?.message ||
        data?.message ||
        data?.error ||
        message;
    } catch {
      // ignore JSON parse errors
    }
    console.error('[SMS] Dexatel send failed:', res.status, message);
    return { success: false, error: 'SMS ուղարկելը ձախողվեց' };
  } catch (err) {
    console.error('[SMS] Dexatel request error:', err);
    return { success: false, error: 'SMS ուղարկելիս սխալ է տեղի ունեցել' };
  }
}
