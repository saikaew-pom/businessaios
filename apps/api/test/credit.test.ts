import { DatabaseSync } from 'node:sqlite';
import { describe, it, expect, beforeEach } from 'vitest';
import { makeD1Shim } from './helpers/d1-shim';
import {
  calculateCredits,
  getCredits,
  deductCredits,
  addCredits,
  hasEnoughCredits,
  creditsToUsd,
} from '../src/lib/credit';

describe('calculateCredits (pure cost math)', () => {
  it('charges 1 credit per 1K input tokens, 2 per 1K output tokens, rounded up', () => {
    expect(calculateCredits({ prompt_tokens: 1000, completion_tokens: 1000 })).toBe(3);
    expect(calculateCredits({ prompt_tokens: 500, completion_tokens: 0 })).toBe(1); // ceil(0.5) -> min 1
  });

  it('always charges at least 1 credit, even for near-zero usage', () => {
    expect(calculateCredits({ prompt_tokens: 1, completion_tokens: 0 })).toBe(1);
  });

  it('has no usage at all -> 1 credit (matches the minimum-charge-per-call comment)', () => {
    expect(calculateCredits(undefined)).toBe(1);
  });
});

describe('creditsToUsd', () => {
  it('converts at the documented 1 credit = $0.001 rate', () => {
    expect(creditsToUsd(1000)).toBeCloseTo(1.0);
    expect(creditsToUsd(1)).toBeCloseTo(0.001);
  });
});

describe('deductCredits / addCredits against a real (in-memory) database', () => {
  let db: DatabaseSync;
  let env: any;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, credits INTEGER, updated_at INTEGER);
      CREATE TABLE credit_transactions (
        id TEXT PRIMARY KEY, user_id TEXT, delta INTEGER, reason TEXT,
        reference_id TEXT, balance_after INTEGER, note TEXT, created_by TEXT,
        created_at INTEGER
      );
      INSERT INTO users (id, credits, updated_at) VALUES ('u1', 100, 0);
    `);
    env = { DB: makeD1Shim(db) };
  });

  it('getCredits reads the current balance', async () => {
    expect(await getCredits(env, 'u1')).toBe(100);
  });

  it('hasEnoughCredits reports ok/balance correctly on both sides of the threshold', async () => {
    expect(await hasEnoughCredits(env, 'u1', 50)).toMatchObject({ ok: true, balance: 100 });
    expect(await hasEnoughCredits(env, 'u1', 150)).toMatchObject({ ok: false, balance: 100 });
  });

  it('deducts atomically and records a transaction row', async () => {
    const result = await deductCredits(env, 'u1', 30, 'generation_reserve', 'gen-1');
    expect(result).toMatchObject({ ok: true, balance: 70 });
    expect(await getCredits(env, 'u1')).toBe(70);

    const tx = (env.DB.prepare('SELECT * FROM credit_transactions WHERE user_id = ?').bind('u1').all()).results;
    expect(tx).toHaveLength(1);
    expect(tx[0]).toMatchObject({ delta: -30, reason: 'generation_reserve', reference_id: 'gen-1', balance_after: 70 });
  });

  it('refuses to deduct more than the current balance (the H2 fix depends on this)', async () => {
    const result = await deductCredits(env, 'u1', 200, 'generation_reserve', 'gen-2');
    expect(result).toMatchObject({ ok: false, error: 'insufficient_credits', balance: 100 });
    // Balance must be untouched on refusal.
    expect(await getCredits(env, 'u1')).toBe(100);
  });

  it('a second deduct that would overdraw an already-reduced balance is rejected (guards the reserve-then-reconcile pattern)', async () => {
    const first = await deductCredits(env, 'u1', 80, 'generation_reserve', 'gen-a');
    expect(first).toMatchObject({ ok: true, balance: 20 });

    // A second, independent reservation for more than what's left must fail
    // — this is exactly the atomic check-and-deduct that stops two
    // concurrent requests from both passing a balance check and
    // double-spending (see apps/api/src/index.ts generate handler).
    const second = await deductCredits(env, 'u1', 50, 'generation_reserve', 'gen-b');
    expect(second).toMatchObject({ ok: false, error: 'insufficient_credits', balance: 20 });
  });

  it('addCredits (refund/true-up) increases balance and logs the transaction', async () => {
    await deductCredits(env, 'u1', 40, 'generation_reserve', 'gen-3');
    const refund = await addCredits(env, 'u1', 15, 'generation_refund', { referenceId: 'gen-3', note: 'reserved more than actual usage' });
    expect(refund).toMatchObject({ ok: true, balance: 75 }); // 100 - 40 + 15
    expect(await getCredits(env, 'u1')).toBe(75);
  });
});
