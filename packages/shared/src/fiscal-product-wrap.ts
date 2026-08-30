import { createPrivateKey, createPublicKey, publicEncrypt, randomBytes, createCipheriv, constants } from 'crypto';

export type FiscalWrapBlob = {
  ek: string;
  iv: string;
  ct: string;
};

/** Derive SPKI PEM public key from product private PEM — ONLY product pubkey export. */
export function fiscalProductPublicKeyPem(privateKeyPem: string): string {
  const key = createPrivateKey(privateKeyPem);
  return createPublicKey(key).export({ type: 'spki', format: 'pem' }).toString();
}

/**
 * Wrap product private PEM for a device public key.
 * MUST match Agent signer.WrapProductPEM (RSA-OAEP-SHA256 + AES-256-GCM, base64 JSON).
 * ONLY cloud wrap path.
 */
export function wrapFiscalProductPem(devicePublicKeyPem: string, productPrivateKeyPem: string): string {
  const aesKey = randomBytes(32);
  const ek = publicEncrypt(
    {
      key: devicePublicKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    aesKey,
  );
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  const enc = Buffer.concat([cipher.update(productPrivateKeyPem, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ct = Buffer.concat([enc, tag]);
  const blob: FiscalWrapBlob = {
    ek: ek.toString('base64'),
    iv: iv.toString('base64'),
    ct: ct.toString('base64'),
  };
  return Buffer.from(JSON.stringify(blob), 'utf8').toString('base64');
}

/** Load product private key A from process env — ONLY secret read path. */
export function loadFiscalProductPrivateKeyPem(): string | null {
  const pem = process.env.FISCAL_PRODUCT_PRIVATE_KEY_PEM?.trim();
  if (!pem) return null;
  // Allow \n escapes in env single-line form.
  return pem.includes('-----BEGIN') ? pem.replace(/\\n/g, '\n') : null;
}
