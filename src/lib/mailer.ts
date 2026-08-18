import { GOCINEMA_LEGAL } from '@/lib/gocinema-legal';

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function mailerMissingMessage(): string {
  return 'Email ուղարկելու համար .env-ում լրացրու RESEND_API_KEY։';
}

function explainResendError(message: string, status: number): string {
  const text = message.trim();
  if (/domain is not verified/i.test(text)) {
    return 'gocinema.am դոմենը Resend-ում հաստատված չէ։ Հաստատիր այն https://resend.com/domains հասցեով, կամ .env-ում գրիր RESEND_FROM՝ արդեն հաստատված դոմենի հասցեով։';
  }
  if (/only send testing emails/i.test(text)) {
    return 'Resend-ի թեստային ռեժիմում նամակը կարող է գնալ միայն քո հաշվի email-ին։';
  }
  if (/API key is invalid/i.test(text)) {
    return 'RESEND_API_KEY-ը սխալ է։';
  }
  if (/suppressed/i.test(text)) {
    return 'Resend-ը այս հասցեն արգելափակել է (suppression list)։ Հանիր այն https://resend.com/emails/suppressions էջից և նորից ուղարկիր։';
  }
  return text || `Resend-ը չուղարկեց նամակը (${status})`;
}

async function resendRequest(path: string, init?: RequestInit) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(mailerMissingMessage());
  }
  return fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
}

async function assertNotSuppressed(recipients: string[]) {
  const response = await resendRequest('/suppressions');
  if (!response.ok) return;
  const payload = (await response.json().catch(() => null)) as {
    data?: Array<{ email?: string }>;
  } | null;
  const blocked = new Set(
    (payload?.data || []).map((row) => row.email?.trim().toLowerCase()).filter(Boolean)
  );
  const hit = recipients.filter((email) => blocked.has(email));
  if (hit.length) {
    throw new Error(
      `Resend-ը չի ուղարկում ${hit.join(', ')} հասցեին, որովհետև այն suppression list-ում է։ Հանիր https://resend.com/emails/suppressions էջից։`
    );
  }
}

export async function sendMail(options: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const recipients = [
    ...new Set(
      options.to.map((email) => email.trim().toLowerCase()).filter(Boolean)
    ),
  ];
  if (recipients.length === 0) {
    throw new Error('Ստացողի email չկա');
  }

  await assertNotSuppressed(recipients);

  const from =
    process.env.RESEND_FROM?.trim() ||
    `GoCinema <${GOCINEMA_LEGAL.email}>`;

  const response = await resendRequest('/emails', {
    method: 'POST',
    body: JSON.stringify({
      from,
      to: recipients,
      reply_to: GOCINEMA_LEGAL.email,
      subject: options.subject,
      html: options.html,
      text: options.text,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    id?: string;
    message?: string;
    error?: { message?: string };
  } | null;

  if (!response.ok) {
    const raw = payload?.message || payload?.error?.message || '';
    throw new Error(explainResendError(raw, response.status));
  }

  if (payload?.id) {
    const sent = await resendRequest(`/emails/${payload.id}`);
    const details = (await sent.json().catch(() => null)) as {
      last_event?: string;
    } | null;
    if (details?.last_event === 'suppressed' || details?.last_event === 'bounced') {
      throw new Error(explainResendError(details.last_event, sent.status));
    }
  }
}
