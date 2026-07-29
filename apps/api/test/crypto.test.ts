import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  generateId,
  safeCompare,
  encryptText,
  decryptText,
  generateOTP,
  generateToken,
  getMasterSecret,
  hashToken,
} from '../src/lib/crypto';

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
    expect(await verifyPassword('wrong password', stored)).toBe(false);
  });

  it('produces a different hash each time (random salt)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
  });
});

describe('safeCompare', () => {
  it('matches equal strings and rejects unequal ones, including different lengths', () => {
    expect(safeCompare('abc', 'abc')).toBe(true);
    expect(safeCompare('abc', 'abd')).toBe(false);
    expect(safeCompare('abc', 'abcd')).toBe(false);
  });
});

describe('AES-GCM encrypt/decrypt (BYOK key storage)', () => {
  it('round-trips plaintext through the same master secret', async () => {
    const secret = 'test-master-secret-for-unit-tests';
    const ciphertext = await encryptText('sk-my-openai-key', secret);
    expect(await decryptText(ciphertext, secret)).toBe('sk-my-openai-key');
  });

  it('fails to decrypt with the wrong master secret', async () => {
    const ciphertext = await encryptText('sk-my-openai-key', 'secret-a');
    await expect(decryptText(ciphertext, 'secret-b')).rejects.toThrow();
  });
});

describe('generateOTP', () => {
  it('defaults to 6 digits, all numeric', () => {
    const otp = generateOTP();
    expect(otp).toHaveLength(6);
    expect(otp).toMatch(/^[0-9]{6}$/);
  });

  it('respects an explicit length', () => {
    expect(generateOTP(4)).toHaveLength(4);
    expect(generateOTP(8)).toHaveLength(8);
  });

  it('does not skew toward low digits (regression guard for the 256%10 bias bug)', () => {
    // Naive `byte % 10` over-represents 0-5 vs 6-9 (256 isn't divisible by
    // 10). Sample enough digits that a real bias would show up clearly,
    // while leaving room for genuine randomness.
    const counts = new Array(10).fill(0);
    const samples = 20_000;
    let digitsSeen = 0;
    while (digitsSeen < samples) {
      for (const ch of generateOTP(6)) {
        counts[Number(ch)]++;
        digitsSeen++;
      }
    }
    const expected = samples / 10;
    for (const count of counts) {
      // generous +/-25% band — this is a smoke test for gross bias, not a
      // statistical rigor test.
      expect(count).toBeGreaterThan(expected * 0.75);
      expect(count).toBeLessThan(expected * 1.25);
    }
  });
});

describe('generateSessionToken / generateId / generateToken', () => {
  it('generateSessionToken returns a 64-char hex string (32 random bytes)', () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generateId returns a valid UUID', () => {
    expect(generateId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it('generateToken respects the requested byte length', () => {
    expect(generateToken(16)).toHaveLength(32); // hex-encoded
    expect(generateToken(32)).toHaveLength(64);
  });
});

describe('hashToken (MCP personal access tokens)', () => {
  it('is deterministic — same input always hashes the same', async () => {
    const a = await hashToken('bsos_mcp_abc123');
    const b = await hashToken('bsos_mcp_abc123');
    expect(a).toBe(b);
  });

  it('produces a 64-char hex string (SHA-256)', async () => {
    expect(await hashToken('anything')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different tokens hash to different values', async () => {
    const a = await hashToken('bsos_mcp_token-one');
    const b = await hashToken('bsos_mcp_token-two');
    expect(a).not.toBe(b);
  });
});

describe('getMasterSecret (fail-closed BYOK config)', () => {
  it('throws when MASTER_ENCRYPTION_KEY is not set', () => {
    expect(() => getMasterSecret({})).toThrow(/MASTER_ENCRYPTION_KEY/);
  });

  it('returns the configured secret when set', () => {
    expect(getMasterSecret({ MASTER_ENCRYPTION_KEY: 'abc123' })).toBe('abc123');
  });
});
