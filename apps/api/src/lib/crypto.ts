/**
 * Crypto utilities — password hashing, session tokens, etc.
 * Uses Web Crypto API (available in Cloudflare Workers)
 */

/**
 * Hash a password using PBKDF2
 * Returns: "salt:hash" (base64)
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return `${btoa(String.fromCharCode(...salt))}:${btoa(String.fromCharCode(...new Uint8Array(hash)))}`;
}

/**
 * Verify a password against a stored hash
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(':');
  if (!saltB64 || !hashB64) return false;

  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const expected = Uint8Array.from(atob(hashB64), c => c.charCodeAt(0));

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const actual = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      keyMaterial,
      256
    )
  );

  // Constant-time compare
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual[i] ^ expected[i];
  }
  return diff === 0;
}

/**
 * Generate a random session token
 */
export function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a UUID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Constant-time string compare
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// =====================================================
// AES-GCM encryption for BYOK (API keys)
// =====================================================

/**
 * Derive a 32-byte key from a master secret using SHA-256
 * Master secret should be set as env.MASTER_ENCRYPTION_KEY (32+ chars)
 */
async function deriveKey(masterSecret: string, salt: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(masterSecret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt plaintext using AES-GCM
 * Format: base64(salt).base64(iv).base64(ciphertext)
 */
export async function encryptText(plaintext: string, masterSecret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(masterSecret, btoa(String.fromCharCode(...salt)));

  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );

  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  const saltB64 = btoa(String.fromCharCode(...salt));
  const ivB64 = btoa(String.fromCharCode(...iv));
  return `${saltB64}.${ivB64}.${ctB64}`;
}

/**
 * Decrypt ciphertext encrypted with encryptText
 */
export async function decryptText(payload: string, masterSecret: string): Promise<string> {
  const [saltB64, ivB64, ctB64] = payload.split('.');
  if (!saltB64 || !ivB64 || !ctB64) throw new Error('Invalid encrypted payload');

  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0));

  const key = await deriveKey(masterSecret, btoa(String.fromCharCode(...salt)));

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Generate a 6-digit OTP code.
 * Rejection-samples bytes >= 250 so each digit is uniform 0-9 (256 isn't
 * evenly divisible by 10 — naive `byte % 10` skews toward 0-5).
 */
export function generateOTP(length = 6): string {
  let result = '';
  while (result.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length - result.length));
    for (const b of bytes) {
      if (b < 250) result += (b % 10).toString();
    }
  }
  return result;
}

/**
 * Generate a URL-safe token (for email verification)
 */
export function generateToken(length = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * One-way hash for bearer tokens (e.g. MCP personal access tokens) that are
 * copy-pasted into external config files — unlike session cookies, these
 * leave the browser's HttpOnly/SameSite protections, so only a hash is
 * stored; the raw token is shown once at creation and never persisted.
 * No salt needed: the input is already a 256-bit random token, not a
 * low-entropy password, so a rainbow-table isn't a realistic threat.
 */
export async function hashToken(token: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(token));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get the effective master secret from env.
 * Fails closed: throws if env.MASTER_ENCRYPTION_KEY is not set, rather than
 * silently falling back to a secret hardcoded in source (which would let
 * anyone with repo access decrypt every user's stored BYOK API keys).
 * Set via `wrangler secret put MASTER_ENCRYPTION_KEY` in production, or in
 * `.dev.vars` for local dev.
 */
export function getMasterSecret(env: { MASTER_ENCRYPTION_KEY?: string }): string {
  if (!env.MASTER_ENCRYPTION_KEY) {
    throw new Error('MASTER_ENCRYPTION_KEY is not set — cannot encrypt/decrypt BYOK keys');
  }
  return env.MASTER_ENCRYPTION_KEY;
}
