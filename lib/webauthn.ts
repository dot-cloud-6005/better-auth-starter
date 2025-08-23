// Lightweight WebAuthn helper utilities for base64url ⇄ Buffer conversions
// and normalizing values returned by @simplewebauthn/browser.

export function bufferToBase64url(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < u8.length; i++) str += String.fromCharCode(u8[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64urlToBuffer(base64url: string): Buffer {
  const pad = base64url.length % 4 === 0 ? '' : '='.repeat(4 - (base64url.length % 4));
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return Buffer.from(bytes);
}

// Polyfills (if needed) for Node runtimes where atob/btoa are not present
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof atob === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  global.atob = (b64: string) => Buffer.from(b64, 'base64').toString('binary');
}
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof btoa === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  global.btoa = (bin: string) => Buffer.from(bin, 'binary').toString('base64');
}
