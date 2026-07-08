import http from 'node:http';
import type { AgentConfig } from './config.js';
import { HdmClient, HdmProtocolError } from './hdm-client.js';
import { buildPrintReceiptRequest } from './receipt-builder.js';
import type {
  AgentPrintReceiptBody,
  AgentPrintReceiptResult,
  AgentReturnReceiptBody,
  AgentReturnReceiptResult,
  AgentResult,
} from './types.js';

function json(
  res: http.ServerResponse,
  status: number,
  body: unknown,
  cors: Record<string, string>
) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...cors,
  });
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function corsHeaders(
  origin: string | undefined,
  allowOrigins: string[],
  req?: http.IncomingMessage
): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Agent-Key, Access-Control-Request-Private-Network',
    'Access-Control-Max-Age': '86400',
  };

  // Chrome Private Network Access: HTTPS public site → localhost agent
  const pna =
    req?.headers['access-control-request-private-network'] === 'true' ||
    Boolean(origin?.startsWith('https://'));
  if (pna) {
    headers['Access-Control-Allow-Private-Network'] = 'true';
  }

  if (!origin) return headers;
  if (allowOrigins.includes('*') || allowOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin, Access-Control-Request-Private-Network';
  }
  return headers;
}

function isAuthorized(req: http.IncomingMessage, apiKey: string): boolean {
  if (!apiKey) return true;
  const auth = req.headers.authorization ?? '';
  if (auth === `Bearer ${apiKey}`) return true;
  const headerKey = req.headers['x-agent-key'];
  return typeof headerKey === 'string' && headerKey === apiKey;
}

export function createServer(config: AgentConfig): http.Server {
  const hdm = new HdmClient(config.hdm);

  return http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const cors = corsHeaders(origin, config.allowOrigins, req);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      res.end();
      return;
    }

    const pathname = (req.url ?? '/').split('?')[0];

    try {
      if (req.method === 'GET' && pathname === '/health') {
        json(
          res,
          200,
          {
            ok: true,
            service: 'gocinema-hdm-agent',
            hdm: { host: config.hdm.host, port: config.hdm.port },
          },
          cors
        );
        return;
      }

      if (!isAuthorized(req, config.apiKey)) {
        json(res, 401, { ok: false, error: 'Unauthorized' }, cors);
        return;
      }

      if (req.method === 'GET' && pathname === '/v1/diagnose') {
        const diagnose = await hdm.diagnose();
        json(res, 200, { ok: diagnose.protocolResponded, ...diagnose }, cors);
        return;
      }

      if (req.method === 'GET' && pathname === '/v1/status') {
        const status = await hdm.ping();
        json(res, 200, { ok: true, ...status }, cors);
        return;
      }

      if (req.method === 'POST' && pathname === '/v1/login') {
        await hdm.login();
        json(res, 200, { ok: true, message: 'HDM session opened' }, cors);
        return;
      }

      if (req.method === 'POST' && pathname === '/v1/logout') {
        await hdm.logout();
        json(res, 200, { ok: true, message: 'HDM session closed' }, cors);
        return;
      }

      if (req.method === 'GET' && pathname === '/v1/operators') {
        const operators = await hdm.listOperators();
        json(res, 200, { ok: true, operators }, cors);
        return;
      }

      if (req.method === 'POST' && pathname === '/v1/check-emark') {
        const raw = await readBody(req);
        const parsed = JSON.parse(raw || '{}') as { eMark?: string };
        if (!parsed.eMark?.trim()) {
          json(res, 400, { ok: false, error: 'eMark is required' }, cors);
          return;
        }
        const result = await hdm.checkEmark(parsed.eMark.trim());
        json(res, 200, { ok: true, result }, cors);
        return;
      }

      if (req.method === 'POST' && pathname === '/v1/print-receipt') {
        const raw = await readBody(req);
        const body = JSON.parse(raw || '{}') as AgentPrintReceiptBody;

        if (!body.paymentMethod || !Array.isArray(body.items)) {
          json(
            res,
            400,
            { ok: false, error: 'paymentMethod and items are required' },
            cors
          );
          return;
        }
        if (!Number.isFinite(body.total) || body.total <= 0) {
          json(res, 400, { ok: false, error: 'Invalid total' }, cors);
          return;
        }
        if (body.items.length === 0) {
          json(res, 400, { ok: false, error: 'items cannot be empty' }, cors);
          return;
        }

        const hdmRequest = buildPrintReceiptRequest(config, body);
        const fiscal = await hdm.printReceipt(hdmRequest);
        const result: AgentPrintReceiptResult = { ok: true, fiscal };
        json(res, 200, result, cors);
        return;
      }

      if (req.method === 'POST' && pathname === '/v1/return-receipt') {
        const raw = await readBody(req);
        const body = JSON.parse(raw || '{}') as AgentReturnReceiptBody;

        if (!body.crn?.trim() || !Number.isFinite(body.returnTicketId)) {
          json(
            res,
            400,
            { ok: false, error: 'crn and returnTicketId are required' },
            cors
          );
          return;
        }

        const isCash = body.paymentMethod !== 'card';
        const isPartial =
          Number.isFinite(body.amount) && (body.amount as number) > 0;
        const fiscal = await hdm.printReturnReceipt({
          crn: body.crn.trim(),
          returnTicketId: Math.trunc(body.returnTicketId),
          ...(isPartial
            ? {
                cashAmountForReturn: isCash ? (body.amount as number) : 0,
                cardAmountForReturn: isCash ? 0 : (body.amount as number),
                prePaymentAmountForReturn: 0,
              }
            : {}),
          ...(body.eMarks && body.eMarks.length > 0
            ? { eMarks: body.eMarks }
            : {}),
          ...(body.returnItemList && body.returnItemList.length > 0
            ? { returnItemList: body.returnItemList }
            : {}),
        });
        const result: AgentReturnReceiptResult = { ok: true, fiscal };
        json(res, 200, result, cors);
        return;
      }

      json(res, 404, { ok: false, error: 'Not found' }, cors);
    } catch (err) {
      if (err instanceof HdmProtocolError) {
        const payload: AgentResult<never> = {
          ok: false,
          error: err.message,
          code: err.code,
          details: err.body,
        };
        json(res, 502, payload, cors);
        return;
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[agent] request error:', err);
      json(res, 500, { ok: false, error: message }, cors);
    }
  });
}
