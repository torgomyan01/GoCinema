import http from 'node:http';
import type { AgentConfig } from './config.js';
import { HdmClient, HdmProtocolError } from './hdm-client.js';
import { buildPrintReceiptRequest } from './receipt-builder.js';
import type {
  AgentPrintReceiptBody,
  AgentPrintReceiptResult,
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
  allowOrigins: string[]
): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-Key',
    'Access-Control-Max-Age': '86400',
  };
  if (!origin) return headers;
  if (allowOrigins.includes('*') || allowOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
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
    const cors = corsHeaders(origin, config.allowOrigins);

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
