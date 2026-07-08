import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';

const KEY_LEN = 24;
const BLOCK_SIZE = 8;

export function derivePasswordKey(password: string): Buffer {
  const digest = createHash('sha256').update(password, 'utf8').digest();
  return digest.subarray(0, KEY_LEN);
}

export function decodeSessionKey(base64Key: string): Buffer {
  const decoded = Buffer.from(base64Key, 'base64');
  if (decoded.length !== KEY_LEN) {
    throw new Error(`HDM session key must be ${KEY_LEN} bytes`);
  }
  return decoded;
}

export function encrypt3des(plaintext: Buffer, key: Buffer): Buffer {
  if (key.length !== KEY_LEN) {
    throw new Error(`3DES key must be ${KEY_LEN} bytes`);
  }
  const cipher = createCipheriv('des-ede3', key, null);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(plaintext), cipher.final()]);
}

export function decrypt3des(ciphertext: Buffer, key: Buffer): Buffer {
  if (key.length !== KEY_LEN) {
    throw new Error(`3DES key must be ${KEY_LEN} bytes`);
  }
  if (ciphertext.length === 0) {
    return Buffer.alloc(0);
  }
  if (ciphertext.length % BLOCK_SIZE !== 0) {
    throw new Error('HDM ciphertext length must be a multiple of 8');
  }
  const decipher = createDecipheriv('des-ede3', key, null);
  decipher.setAutoPadding(true);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encryptJson(obj: unknown, key: Buffer): Buffer {
  const json = JSON.stringify(obj);
  return encrypt3des(Buffer.from(json, 'utf8'), key);
}

export function decryptJson<T = unknown>(ciphertext: Buffer, key: Buffer): T {
  if (!ciphertext.length) {
    return {} as T;
  }
  const plaintext = decrypt3des(ciphertext, key);
  const text = plaintext.toString('utf8').replace(/\0+$/g, '').trim();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}
