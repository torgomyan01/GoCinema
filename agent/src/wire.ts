export const HDM_MAGIC = Buffer.from([0xd5, 0x80, 0xd4, 0xb4, 0xd5, 0x84]);
export const PROTOCOL_VERSION = Buffer.from([0x00, 0x05]);
export const RESPONSE_HEADER_LEN = 11;
export const RESPONSE_CODE_OK = 200;

export enum OperationCode {
  ListOpsAndDeps = 1,
  OperatorLogin = 2,
  OperatorLogout = 3,
  PrintReceipt = 4,
  PrintLastReceipt = 5,
  PrintReturnReceipt = 6,
  SetupHeaderFooter = 7,
  SetupHeaderLogo = 8,
  PrintFiscalReport = 9,
  GetReturnableReceipt = 10,
  CashInOut = 11,
  DateTime = 12,
  ReceiptSample = 13,
  HdmTimeSync = 14,
  PaymentSystemsList = 15,
  SingleEmark = 16,
}

export interface ResponseHeader {
  protocolVersion: [number, number];
  softwareVersion: [number, number, number];
  code: number;
  payloadLen: number;
}

export function encodeRequest(op: OperationCode, payload: Buffer): Buffer {
  const len = payload.length;
  if (len > 0xffff) {
    throw new Error('HDM payload exceeds 65535 bytes');
  }
  const header = Buffer.alloc(12);
  HDM_MAGIC.copy(header, 0);
  PROTOCOL_VERSION.copy(header, 6);
  header.writeUInt8(op, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16BE(len, 10);
  return Buffer.concat([header, payload]);
}

export function decodeResponseHeader(buf: Buffer): ResponseHeader {
  if (buf.length < RESPONSE_HEADER_LEN) {
    throw new Error('HDM response header too short');
  }
  return {
    protocolVersion: [buf[0], buf[1]],
    softwareVersion: [buf[2], buf[3], buf[4]],
    code: buf.readUInt16BE(5),
    payloadLen: buf.readUInt16BE(7),
  };
}
