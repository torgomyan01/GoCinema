import net from 'node:net';
import {
  decryptJson,
  derivePasswordKey,
  decodeSessionKey,
  encryptJson,
} from './crypto.js';
import type { AgentConfig } from './config.js';
import {
  OperationCode,
  RESPONSE_CODE_OK,
  decodeResponseHeader,
  encodeRequest,
} from './wire.js';
import type {
  HdmEmarkCheckRequest,
  HdmEmarkCheckResponse,
  HdmErrorBody,
  HdmLoginResponse,
  HdmOperatorsResponse,
  HdmPrintReceiptRequest,
  HdmPrintReceiptResponse,
  HdmReturnReceiptRequest,
  HdmReturnReceiptResponse,
} from './types.js';

/** Spec §4.10 */
const HDM_ERROR_MESSAGES: Record<number, string> = {
  101: 'Գաղտնաբառով կոդավորման սխալ',
  102: 'Սեսիայի բանալիով կոդավորման սխալ',
  103: 'Գլխագրի ֆորմատի սխալ',
  104: 'Հարցման հերթական համարի սխալ',
  105: 'JSON ֆորմատավորման սխալ',
  111: 'Օպերատորի գաղտնաբառի (PIN) սխալ — ստուգեք HDM_PIN-ը agent/.env-ում',
  112: 'Այդպիսի օպերատոր չկա — ստուգեք HDM_CASHIER-ը',
  113: 'Օպերատորը ակտիվ չէ',
  121: 'Սխալ օգտվող',
  151: 'Այդպիսի բաժին գոյություն չունի',
  152: 'Մուծված գումարը ընդհանուր գումարից պակաս է',
  400: 'Հարցման սխալ',
  402: 'Սխալ արձանագրության տարբերակ',
  403: 'Չարտոնագրված միացում — ՀԴՄ Auto system IP-ն պետք է լինի այս PC-ի IP-ն',
  404: 'Սխալ գործողության կոդ',
  500: 'ՀԴՄ ներքին սխալ',
};

function hdmErrorMessage(code: number, fallback?: string): string {
  return (
    HDM_ERROR_MESSAGES[code] ||
    fallback ||
    `HDM error ${code}`
  );
}

export class HdmProtocolError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly body?: unknown
  ) {
    super(message);
    this.name = 'HdmProtocolError';
  }
}

/** Accumulates TCP chunks and allows exact-length reads without dropping leftovers. */
class SocketReader {
  private buffer = Buffer.alloc(0);
  private waiters: Array<{
    length: number;
    resolve: (buf: Buffer) => void;
    reject: (err: Error) => void;
  }> = [];
  private closed = false;

  constructor(private readonly socket: net.Socket) {
    socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.flush();
    });
    socket.on('error', (err) => this.failAll(err));
    socket.on('close', () => {
      this.closed = true;
      this.failAll(new Error('HDM socket closed before full response'));
    });
  }

  readExact(length: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      if (this.closed) {
        reject(new Error('HDM socket closed before full response'));
        return;
      }
      this.waiters.push({ length, resolve, reject });
      this.flush();
    });
  }

  private flush() {
    while (this.waiters.length > 0) {
      const next = this.waiters[0];
      if (this.buffer.length < next.length) return;
      const out = this.buffer.subarray(0, next.length);
      this.buffer = this.buffer.subarray(next.length);
      this.waiters.shift();
      next.resolve(out);
    }
  }

  private failAll(err: Error) {
    const pending = this.waiters.splice(0);
    for (const w of pending) w.reject(err);
  }
}

export class HdmClient {
  private passwordKey: Buffer;
  private sessionKey: Buffer | null = null;
  private seq = 1;

  constructor(private readonly cfg: AgentConfig['hdm']) {
    this.passwordKey = derivePasswordKey(cfg.password);
  }

  private nextSeq(): number {
    const current = this.seq;
    this.seq += 1;
    return current;
  }

  private async withSocket<T>(
    fn: (reader: SocketReader, socket: net.Socket) => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let connected = false;
      const target = `${this.cfg.host}:${this.cfg.port}`;
      const socket = net.createConnection(
        { host: this.cfg.host, port: this.cfg.port },
        () => {
          connected = true;
          const reader = new SocketReader(socket);
          fn(reader, socket).then(resolve, reject).finally(() => {
            socket.destroy();
          });
        }
      );
      socket.setTimeout(15_000, () => {
        const err = connected
          ? new Error(
              `HDM no response from ${target}. Check: integration mode ON, correct port/password, and HDM "Auto system IP" = this PC IP (not 127.0.0.1)`
            )
          : new Error(
              `HDM connection timeout to ${target}. Check IP/port and that HDM is on the same Wi‑Fi/LAN`
            );
        socket.destroy(err);
      });
      socket.on('error', (err) => {
        reject(new Error(`HDM socket error (${target}): ${err.message}`));
      });
    });
  }

  private async sendOperation(
    reader: SocketReader,
    socket: net.Socket,
    op: OperationCode,
    body: unknown,
    key: Buffer
  ): Promise<{ headerCode: number; body: unknown }> {
    const payload = encryptJson(body, key);
    const frame = encodeRequest(op, payload);
    socket.write(frame);

    const headerBuf = await reader.readExact(11);
    const header = decodeResponseHeader(headerBuf);
    const responsePayload = await reader.readExact(header.payloadLen);

    // ՀԴՄ-ը որոշ գործողությունների համար (օր. eMark check) կարող է
    // վերադարձնել 200 դատարկ body-ով — սա հաջողություն է։
    if (header.payloadLen === 0) {
      if (header.code !== RESPONSE_CODE_OK) {
        throw new HdmProtocolError(hdmErrorMessage(header.code), header.code);
      }
      return { headerCode: header.code, body: {} };
    }

    let decoded: unknown = {};
    try {
      decoded = decryptJson(responsePayload, key);
    } catch (decryptErr) {
      // Որոշ պատասխաններ կարող են գալ չկոդավորված JSON
      try {
        const asText = responsePayload.toString('utf8').trim();
        if (asText.startsWith('{') || asText.startsWith('[')) {
          decoded = JSON.parse(asText);
        } else {
          throw decryptErr;
        }
      } catch {
        console.error('[HDM] decrypt failed', {
          op,
          code: header.code,
          payloadLen: header.payloadLen,
          payloadHex: responsePayload.subarray(0, 32).toString('hex'),
          error:
            decryptErr instanceof Error ? decryptErr.message : String(decryptErr),
        });
        if (header.code !== RESPONSE_CODE_OK) {
          throw new HdmProtocolError(
            hdmErrorMessage(header.code),
            header.code
          );
        }
        throw new HdmProtocolError(
          `HDM response decrypt failed (code ${header.code}, len ${header.payloadLen})`,
          header.code
        );
      }
    }

    if (header.code !== RESPONSE_CODE_OK) {
      const errBody = decoded as HdmErrorBody;
      const msg = hdmErrorMessage(
        header.code,
        errBody?.error || errBody?.message
      );
      throw new HdmProtocolError(msg, header.code, decoded);
    }

    return { headerCode: header.code, body: decoded };
  }

  async listOperators(): Promise<HdmOperatorsResponse> {
    return this.withSocket(async (reader, socket) => {
      const { body } = await this.sendOperation(
        reader,
        socket,
        OperationCode.ListOpsAndDeps,
        { password: this.cfg.password },
        this.passwordKey
      );
      return body as HdmOperatorsResponse;
    });
  }

  async login(): Promise<void> {
    // Spec requires password + cashier + pin. Empty PIN is sent as "" —
    // if HDM rejects with 111, set the real operator PIN in agent/.env.
    const pin =
      this.cfg.pin == null ? '' : String(this.cfg.pin);

    const result = await this.withSocket(async (reader, socket) => {
      return this.sendOperation(
        reader,
        socket,
        OperationCode.OperatorLogin,
        {
          password: this.cfg.password,
          cashier: this.cfg.cashier,
          pin,
        },
        this.passwordKey
      );
    });

    const login = result.body as HdmLoginResponse;
    if (!login?.key) {
      throw new HdmProtocolError('HDM login response missing session key');
    }
    this.sessionKey = decodeSessionKey(login.key);
    this.seq = 1;
  }

  private async ensureSession(): Promise<Buffer> {
    if (!this.sessionKey) {
      await this.login();
    }
    return this.sessionKey!;
  }

  async logout(): Promise<void> {
    if (!this.sessionKey) return;
    const key = this.sessionKey;
    try {
      await this.withSocket(async (reader, socket) => {
        await this.sendOperation(
          reader,
          socket,
          OperationCode.OperatorLogout,
          { seq: this.nextSeq() },
          key
        );
      });
    } finally {
      this.sessionKey = null;
    }
  }

  async printReceipt(
    request: Omit<HdmPrintReceiptRequest, 'seq'>
  ): Promise<HdmPrintReceiptResponse> {
    const key = await this.ensureSession();
    const body = { ...request, seq: this.nextSeq() };

    try {
      const result = await this.withSocket(async (reader, socket) => {
        return this.sendOperation(
          reader,
          socket,
          OperationCode.PrintReceipt,
          body,
          key
        );
      });
      return result.body as HdmPrintReceiptResponse;
    } catch (err) {
      if (err instanceof HdmProtocolError && err.code === 102) {
        this.sessionKey = null;
        const key2 = await this.ensureSession();
        const retry = await this.withSocket(async (reader, socket) => {
          return this.sendOperation(
            reader,
            socket,
            OperationCode.PrintReceipt,
            { ...request, seq: this.nextSeq() },
            key2
          );
        });
        return retry.body as HdmPrintReceiptResponse;
      }
      throw err;
    }
  }

  async printReturnReceipt(
    request: Omit<HdmReturnReceiptRequest, 'seq'>
  ): Promise<HdmReturnReceiptResponse> {
    const key = await this.ensureSession();

    const send = (sessionKey: Buffer) =>
      this.withSocket(async (reader, socket) => {
        return this.sendOperation(
          reader,
          socket,
          OperationCode.PrintReturnReceipt,
          { ...request, seq: this.nextSeq() },
          sessionKey
        );
      });

    try {
      const result = await send(key);
      return result.body as HdmReturnReceiptResponse;
    } catch (err) {
      if (err instanceof HdmProtocolError && err.code === 102) {
        this.sessionKey = null;
        const key2 = await this.ensureSession();
        const retry = await send(key2);
        return retry.body as HdmReturnReceiptResponse;
      }
      throw err;
    }
  }

  async checkEmark(eMark: string): Promise<HdmEmarkCheckResponse> {
    const key = await this.ensureSession();
    const request = {
      seq: this.nextSeq(),
      eMark,
    } satisfies HdmEmarkCheckRequest;

    console.log('\n========== HDM CHECK EMARK ==========');
    console.log('[to HDM]', JSON.stringify(request, null, 2));

    try {
      const result = await this.withSocket(async (reader, socket) => {
        return this.sendOperation(
          reader,
          socket,
          OperationCode.SingleEmark,
          request,
          key
        );
      });
      console.log('[HDM response]', JSON.stringify(result.body, null, 2));
      console.log('=====================================\n');
      return {
        ok: true,
        ...(result.body as HdmEmarkCheckResponse),
      };
    } catch (err) {
      if (err instanceof HdmProtocolError && err.code === 102) {
        this.sessionKey = null;
        const key2 = await this.ensureSession();
        const retry = await this.withSocket(async (reader, socket) => {
          return this.sendOperation(
            reader,
            socket,
            OperationCode.SingleEmark,
            { seq: this.nextSeq(), eMark } satisfies HdmEmarkCheckRequest,
            key2
          );
        });
        console.log('[HDM response retry]', JSON.stringify(retry.body, null, 2));
        console.log('=====================================\n');
        return {
          ok: true,
          ...(retry.body as HdmEmarkCheckResponse),
        };
      }
      console.error('[HDM check-emark error]', err);
      console.log('=====================================\n');
      throw err;
    }
  }

  async ping(): Promise<{ operators: number; loggedIn: boolean }> {
    const ops = await this.listOperators();
    return {
      operators: ops.c?.length ?? 0,
      loggedIn: Boolean(this.sessionKey),
    };
  }

  async diagnose(): Promise<{
    target: string;
    tcpConnected: boolean;
    protocolResponded: boolean;
    operators?: number;
    error?: string;
  }> {
    const target = `${this.cfg.host}:${this.cfg.port}`;
    try {
      const ops = await this.listOperators();
      return {
        target,
        tcpConnected: true,
        protocolResponded: true,
        operators: ops.c?.length ?? 0,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        target,
        tcpConnected: message.includes('no response') || message.includes('decrypt'),
        protocolResponded: false,
        error: message,
      };
    }
  }
}
