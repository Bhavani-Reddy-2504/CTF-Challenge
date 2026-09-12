/**
 * TLS Certificate Utilities
 *
 * Handles loading TLS certificates from disk (production) or
 * generating a self-signed certificate on-the-fly (development/test).
 *
 * Zero external dependencies — uses only Node.js built-in modules.
 */

import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface TlsCredentials {
  cert: string;
  key: string;
  /** True when using a self-signed certificate (dev/test only). */
  isSelfSigned: boolean;
}

/**
 * Common locations where openssl.exe can be found on Windows,
 * even when it's not on the system PATH.
 */
const WINDOWS_OPENSSL_CANDIDATES = [
  'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
  'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe',
  'C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe',
  'C:\\Program Files\\OpenSSL\\bin\\openssl.exe',
  'C:\\OpenSSL-Win64\\bin\\openssl.exe',
];

/**
 * Finds the openssl executable: tries PATH first, then common Windows locations.
 */
function findOpenssl(): string | null {
  try {
    const cmd = process.platform === 'win32' ? 'where openssl' : 'which openssl';
    const result = execSync(cmd, { stdio: 'pipe', timeout: 3000 }).toString().trim().split('\n')[0].trim();
    if (result) return result;
  } catch {
    // Not on PATH
  }

  if (process.platform === 'win32') {
    for (const candidate of WINDOWS_OPENSSL_CANDIDATES) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return null;
}

/**
 * Loads TLS credentials from paths in env vars, or auto-generates a self-signed cert.
 *
 * Env vars:
 *   TLS_CERT_PATH  — path to PEM certificate file
 *   TLS_KEY_PATH   — path to PEM private key file
 *
 * @throws Error in production when TLS_CERT_PATH / TLS_KEY_PATH are missing.
 */
export async function loadOrGenerateTlsCert(environment: string): Promise<TlsCredentials> {
  const certPath = process.env.TLS_CERT_PATH;
  const keyPath = process.env.TLS_KEY_PATH;

  if (environment === 'production') {
    if (!certPath || !keyPath) {
      console.warn('[WARNING] TLS_CERT_PATH or TLS_KEY_PATH not set in production. Falling back to plain HTTP. Ensure you are running behind a reverse proxy that terminates TLS (like Render, AWS ALB, etc).');
      return null as any;
    }
    const cert = fs.readFileSync(certPath, 'utf-8');
    const key = fs.readFileSync(keyPath, 'utf-8');
    return { cert, key, isSelfSigned: false };
  }

  if (certPath && keyPath) {
    try {
      const cert = fs.readFileSync(certPath, 'utf-8');
      const key = fs.readFileSync(keyPath, 'utf-8');
      return { cert, key, isSelfSigned: false };
    } catch (err) {
      throw new Error(
        `Failed to load TLS cert from TLS_CERT_PATH="${certPath}" / TLS_KEY_PATH="${keyPath}": ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  return generateSelfSignedCert();
}

/** Tries openssl CLI first; falls back to pure-Node if unavailable. */
function generateSelfSignedCert(): TlsCredentials {
  const opensslPath = findOpenssl();
  if (opensslPath) {
    try {
      return generateViaOpenssl(opensslPath);
    } catch {
      // fall through
    }
  }
  return generateViaPureNode();
}

/** Generates a self-signed cert using the openssl CLI binary. */
function generateViaOpenssl(opensslExe: string): TlsCredentials {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stratacore-tls-'));
  const keyFile = path.join(tmpDir, 'server.key');
  const certFile = path.join(tmpDir, 'server.crt');

  execSync(
    `"${opensslExe}" req -x509 -newkey rsa:2048 -keyout "${keyFile}" -out "${certFile}" -days 365 -nodes -subj "/CN=localhost/O=StrataCoreDev/C=US"`,
    { stdio: 'pipe', timeout: 20000 }
  );

  const key = fs.readFileSync(keyFile, 'utf-8');
  const cert = fs.readFileSync(certFile, 'utf-8');

  try { fs.unlinkSync(keyFile); fs.unlinkSync(certFile); fs.rmdirSync(tmpDir); } catch { /* non-critical */ }

  return { cert, key, isSelfSigned: true };
}

/**
 * Pure Node.js self-signed certificate generator.
 * Generates a valid RSA-2048 key pair and a minimal X.509 DER/PEM certificate
 * that Node's TLS stack accepts (browser will show "not secure" warning — expected in dev).
 */
function generateViaPureNode(): TlsCredentials {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const spkiDer = publicKey as unknown as Buffer;
  const certDer = buildMinimalX509(spkiDer);
  const b64 = certDer.toString('base64');
  const lines = b64.match(/.{1,64}/g)?.join('\n') ?? b64;
  const certPem = `-----BEGIN CERTIFICATE-----\n${lines}\n-----END CERTIFICATE-----\n`;

  return { cert: certPem, key: privateKey as unknown as string, isSelfSigned: true };
}

// ── Minimal X.509 v1 DER encoder ────────────────────────────────────────────

function buildMinimalX509(spkiDer: Buffer): Buffer {
  // sha256WithRSAEncryption: 1.2.840.113549.1.1.11
  const sigAlgOid = Buffer.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b]);
  const sigAlg = derSeq(buf(oid(sigAlgOid), nullTag()));

  const serial = Buffer.from([0x02, 0x01, 0x01]); // INTEGER 1

  const now = new Date();
  const expire = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const validity = derSeq(buf(utcTime(now), utcTime(expire)));

  // commonName OID: 2.5.4.3
  const cnOid = Buffer.from([0x55, 0x04, 0x03]);
  const cnAttr = derSeq(buf(oid(cnOid), utf8s('localhost')));
  const name = derSeq(derSet(cnAttr));

  // SPKI is already a valid DER SEQUENCE from generateKeyPairSync
  const tbs = derSeq(buf(serial, sigAlg, name, validity, name, spkiDer));

  // Signature: random bytes (not cryptographically verified in self-signed dev certs)
  const sigBytes = crypto.randomBytes(256);

  return derSeq(buf(tbs, sigAlg, bitStr(sigBytes)));
}

// ── DER helpers ───────────────────────────────────────────────────────────────
function buf(...bufs: Buffer[]): Buffer { return Buffer.concat(bufs); }

function derLen(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n]);
  if (n < 0x100) return Buffer.from([0x81, n]);
  return Buffer.from([0x82, (n >> 8) & 0xff, n & 0xff]);
}

function tlv(tag: number, content: Buffer): Buffer {
  return buf(Buffer.from([tag]), derLen(content.length), content);
}

function derSeq(c: Buffer): Buffer { return tlv(0x30, c); }
function derSet(c: Buffer): Buffer { return tlv(0x31, c); }
function oid(b: Buffer): Buffer    { return tlv(0x06, b); }
function nullTag(): Buffer         { return Buffer.from([0x05, 0x00]); }
function utf8s(s: string): Buffer  { return tlv(0x0c, Buffer.from(s, 'utf8')); }
function bitStr(d: Buffer): Buffer { return tlv(0x03, buf(Buffer.from([0x00]), d)); }

function utcTime(d: Date): Buffer {
  const p = (n: number): string => String(n).padStart(2, '0');
  const yy = String(d.getUTCFullYear()).slice(-2);
  const s = yy + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) +
            p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + 'Z';
  return tlv(0x17, Buffer.from(s, 'ascii'));
}
