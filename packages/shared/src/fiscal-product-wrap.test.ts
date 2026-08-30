import assert from 'node:assert/strict';
import { generateKeyPairSync, privateDecrypt, createDecipheriv, constants } from 'crypto';
import { describe, it } from 'node:test';
import {
  fiscalProductPublicKeyPem,
  loadFiscalProductPrivateKeyPem,
  wrapFiscalProductPem,
} from './fiscal-product-wrap';

describe('fiscal-product-wrap', () => {
  it('wraps product PEM so device private key can unwrap (Go-compatible blob)', () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    });
    const productPem = `-----BEGIN PRIVATE KEY-----\nTEST_PRODUCT_KEY_BYTES_FOR_WRAP_ONLY\n-----END PRIVATE KEY-----\n`;
    const wrapped = wrapFiscalProductPem(publicKey, productPem);
    const raw = Buffer.from(wrapped, 'base64');
    const blob = JSON.parse(raw.toString('utf8')) as { ek: string; iv: string; ct: string };
    const aesKey = privateDecrypt(
      {
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(blob.ek, 'base64'),
    );
    const iv = Buffer.from(blob.iv, 'base64');
    const ctFull = Buffer.from(blob.ct, 'base64');
    const tag = ctFull.subarray(ctFull.length - 16);
    const data = ctFull.subarray(0, ctFull.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', aesKey, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    assert.equal(plain, productPem);
  });

  it('exports product public key from private PEM env shape', () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 1024,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const pub = fiscalProductPublicKeyPem(privateKey);
    assert.match(pub, /BEGIN PUBLIC KEY/);
  });

  it('loadFiscalProductPrivateKeyPem reads env with escaped newlines', () => {
    const prev = process.env.FISCAL_PRODUCT_PRIVATE_KEY_PEM;
    process.env.FISCAL_PRODUCT_PRIVATE_KEY_PEM =
      '-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----';
    try {
      const pem = loadFiscalProductPrivateKeyPem();
      assert.ok(pem?.includes('\nABC\n'));
    } finally {
      if (prev === undefined) delete process.env.FISCAL_PRODUCT_PRIVATE_KEY_PEM;
      else process.env.FISCAL_PRODUCT_PRIVATE_KEY_PEM = prev;
    }
  });
});
