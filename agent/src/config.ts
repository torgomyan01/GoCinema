import './load-env.js';

function required(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(
      `Missing required env: ${name}. Create agent/.env from agent/.env.example`
    );
  }
  return value.trim();
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw?.trim()) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid number for ${name}`);
  }
  return n;
}

function parseHdmPin(raw: string | undefined): string | number | null {
  const value = raw?.trim();
  if (!value || value.toLowerCase() === 'none' || value === '-') {
    return null;
  }
  if (/^\d+$/.test(value)) {
    return Number(value);
  }
  return value;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export interface AgentConfig {
  host: string;
  port: number;
  apiKey: string;
  allowOrigins: string[];
  hdm: {
    host: string;
    port: number;
    password: string;
    cashier: number;
    pin: string | number | null;
    defaultDep: number;
    /** Տոմսերի բաժին (ՀԴՄ dep id) */
    depTicket: number;
    /** Ապրանքների բաժին (ՀԴՄ dep id) */
    depProduct: number;
    defaultAdgTicket: string;
    defaultAdgProduct: string;
    /** true = արտաքին POS արդեն վճարված, false = ՀԴՄ ներքին անկանխիկ */
    useExtPos: boolean;
    /** Վճարային համակարգի կոդ (useExtPOS=false դեպքում), null = ՀԴՄ-ում ընտրություն */
    paymentSystem: number | null;
  };
}

export function loadConfig(): AgentConfig {
  const apiKey = process.env.AGENT_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      '[agent] AGENT_API_KEY is not set — API is open on localhost only (dev mode)'
    );
  }

  const allowOrigins = (
    process.env.AGENT_ALLOW_ORIGIN ??
    'https://gocinema.am,https://www.gocinema.am'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    host: process.env.AGENT_HOST?.trim() || '127.0.0.1',
    port: intEnv('AGENT_PORT', 3100),
    apiKey: apiKey ?? '',
    allowOrigins,
    hdm: {
      host: required('HDM_HOST', process.env.HDM_HOST),
      port: intEnv('HDM_PORT', 5555),
      password: required('HDM_PASSWORD', process.env.HDM_PASSWORD),
      cashier: intEnv('HDM_CASHIER', 1),
      pin: parseHdmPin(process.env.HDM_PIN),
      defaultDep: intEnv('HDM_DEFAULT_DEP', 1),
      depTicket: intEnv(
        'HDM_DEP_TICKET',
        Number(process.env.HDM_DEFAULT_DEP?.trim()) || 1
      ),
      depProduct: intEnv('HDM_DEP_PRODUCT', 2),
      defaultAdgTicket:
        process.env.HDM_DEFAULT_ADG_TICKET?.trim() || '59.14',
      defaultAdgProduct:
        process.env.HDM_DEFAULT_ADG_PRODUCT?.trim() || '47.19',
      // Default false: ՀԴՄ-ն պետք է բացի իր քարտային/անհպում վճարման էկրանը
      useExtPos: boolEnv('HDM_USE_EXT_POS', false),
      paymentSystem: (() => {
        const raw = process.env.HDM_PAYMENT_SYSTEM?.trim();
        if (!raw) return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      })(),
    },
  };
}
