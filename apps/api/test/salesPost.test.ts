/**
 * Sales Post (Content Playbook Upgrade Plan ขั้นที่ 5) — HTTP-route-driven
 * tests against the real D1 shim + migrations, same pattern as
 * contentSeries.test.ts. Covers: fact-only block inclusion (skip, don't
 * invent), the complaint-index split between the "ปัญหา" and
 * "เคยลองวิธีอื่นไม่เวิร์ก" blocks, request-body type/length validation, and
 * the reserve→generate→persist credit flow including all three refund paths
 * (AI parse failure, degenerate output, and a DB persist failure after the
 * true-up has already run).
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/index';
import {
  buildSalesPostPrompt,
  resolveIncludedBlocks,
  validateSalesPostInput,
  MAX_SALES_POST_FACT_CHARS,
  type SalesPostInput,
} from '../src/lib/creative/salesPost';
import { makeD1Shim } from './helpers/d1-shim';

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

function applyMigrations(db: DatabaseSync) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (const file of files) db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf-8'));
}

function makeEnv() {
  const db = new DatabaseSync(':memory:');
  applyMigrations(db);
  const userColumns = (db.prepare('PRAGMA table_info(users)').all() as any[]).map((c) => c.name);
  if (!userColumns.includes('credits')) db.exec('ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 100');
  if (!userColumns.includes('role')) db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
  db.exec(`
    INSERT INTO users (id, email, password_hash, name, plan, role, credits, created_at, updated_at)
    VALUES ('u1', 'u1@test.com', 'x', 'User One', 'free', 'user', 100, 0, 0);
    INSERT INTO users (id, email, password_hash, name, plan, role, credits, created_at, updated_at)
    VALUES ('u2', 'u2@test.com', 'x', 'User Two', 'free', 'user', 3, 0, 0);
    INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ('session-u1', 'u1', ${Date.now() + 60_000}, 0);
    INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ('session-u2', 'u2', ${Date.now() + 60_000}, 0);
  `);
  return {
    db,
    env: {
      DB: makeD1Shim(db),
      ALLOWED_ORIGIN: 'http://localhost:5173',
      RESEND_FROM_EMAIL: 'test@example.com',
      NOTIFY_EMAIL: 'test@example.com',
      MINIMAX_MODEL: 'MiniMax-M3',
      MINIMAX_API_KEY: 'test-key',
      MINIMAX_GROUP_ID: 'test-group',
      MASTER_ENCRYPTION_KEY: 'test-master-encryption-key',
      API_URL: 'https://api.test',
      CREATIVE_STUDIO_ENABLED: 'true',
      CREATIVE_EMBEDDED_ENABLED: 'true',
      BRAND_CONTEXT_ENABLED: 'true',
      CONTENT_SERIES_ENABLED: 'true',
    } as any,
  };
}

function mockMinimaxContent(contentObj: unknown, usage = { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 }) {
  return vi.fn(async () => new Response(JSON.stringify({
    id: 'gen-1',
    choices: [{ message: { role: 'assistant', content: JSON.stringify(contentObj) }, finish_reason: 'stop' }],
    usage,
  }), { status: 200 }));
}

function mockMinimaxRaw(content: string, usage = { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 }) {
  return vi.fn(async () => new Response(JSON.stringify({
    id: 'gen-1',
    choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage,
  }), { status: 200 }));
}

const GOOD_SALES_POST = {
  hook: 'หยุด! ก่อนซื้อกาแฟถุงต่อไป อ่านนี่ก่อน',
  caption: 'เคยไหมที่ชงกาแฟเองแล้วรสชาติไม่เหมือนร้าน ลองเมล็ดกาแฟคั่วสดของเราดูสิ คั่วใหม่ทุกสัปดาห์ รับรองว่าหอมกว่าที่เคยลองมา สั่งวันนี้ได้เลย',
  cta: 'ทักแชทสั่งเลย',
  hashtags: ['#กาแฟ', '#คั่วสด'],
  visual_suggestion: 'ถุงกาแฟคั่วสดวางบนโต๊ะไม้ แสงธรรมชาติ',
};

describe('Sales Post (ขั้นที่ 5)', () => {
  let ctx: ReturnType<typeof makeEnv>;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function postSalesPost(bodyObj: Record<string, unknown>, session = 'session-u1') {
    return app.request('/api/content-series/sales-post', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj),
    }, ctx.env);
  }

  describe('feature gate', () => {
    it('404s when the flag is off', async () => {
      const db = new DatabaseSync(':memory:');
      applyMigrations(db);
      db.exec(`
        ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 100;
        INSERT INTO users (id, email, password_hash, name, plan, credits, created_at, updated_at)
        VALUES ('u1', 'u1@test.com', 'x', 'User One', 'free', 100, 0, 0);
        INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ('session-u1', 'u1', ${Date.now() + 60_000}, 0);
      `);
      const env = { DB: makeD1Shim(db), CONTENT_SERIES_ENABLED: 'false' } as any;
      const res = await app.request('/api/content-series/sales-post', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'x' }),
      }, env);
      expect(res.status).toBe(404);
    });
  });

  describe('request validation (before spending credits)', () => {
    beforeEach(() => { ctx = makeEnv(); });

    it('rejects a missing topic', async () => {
      const res = await postSalesPost({});
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'validation_error', errors: ['topic_required'] });
    });

    it('400s a non-string optional fact field instead of crashing inside .trim() with a raw 500', async () => {
      // Regression test for the exact gap this route had: `body.price` was
      // cast `as string` without a runtime check, so `body.price?.trim()`
      // threw a TypeError ("body.price.trim is not a function") for any
      // non-string value, which Hono's global error handler turned into an
      // opaque `internal_error` 500 instead of a clean, actionable 400.
      const before = (ctx.db.prepare("SELECT credits FROM users WHERE id = 'u1'").get() as any).credits;
      const res = await postSalesPost({ topic: 'กาแฟคั่วสด', price: 100 });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'validation_error', errors: ['price_must_be_string'] });
      const after = (ctx.db.prepare("SELECT credits FROM users WHERE id = 'u1'").get() as any).credits;
      expect(after).toBe(before);
    });

    it('400s a non-string platform instead of crashing inside .toLowerCase()', async () => {
      const res = await postSalesPost({ topic: 'กาแฟคั่วสด', platform: ['facebook'] });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'validation_error', errors: ['platform_must_be_string'] });
    });

    it('400s a non-string project_id instead of exploding inside the DB driver', async () => {
      const res = await postSalesPost({ topic: 'กาแฟคั่วสด', project_id: { evil: 1 } });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'validation_error', errors: ['project_id_must_be_string'] });
    });

    it('caps each optional fact field so it cannot blow the prompt token budget unbounded', async () => {
      const tooLong = 'x'.repeat(MAX_SALES_POST_FACT_CHARS + 1);
      const res = await postSalesPost({ topic: 'กาแฟคั่วสด', promo: tooLong });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'validation_error', errors: ['promo_too_long'] });

      const fine = 'x'.repeat(MAX_SALES_POST_FACT_CHARS);
      globalThis.fetch = mockMinimaxContent(GOOD_SALES_POST) as any;
      const ok = await postSalesPost({ topic: 'กาแฟคั่วสด', promo: fine });
      expect(ok.status).toBe(201);
    });

    it('rejects an unknown or another user\'s project before spending any credits', async () => {
      ctx.db.exec(`INSERT INTO projects (id, user_id, name, current_step, status, created_at, updated_at)
        VALUES ('p2', 'u2', 'Someone elses', 1, 'draft', 0, 0);`);
      const before = (ctx.db.prepare("SELECT credits FROM users WHERE id = 'u1'").get() as any).credits;
      const res = await postSalesPost({ topic: 'x', project_id: 'p2' });
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ error: 'project_not_found' });
      const after = (ctx.db.prepare("SELECT credits FROM users WHERE id = 'u1'").get() as any).credits;
      expect(after).toBe(before);
    });

    it('rejects generation for a user with insufficient credits without calling the AI', async () => {
      const fetchSpy = mockMinimaxContent(GOOD_SALES_POST);
      globalThis.fetch = fetchSpy as any;
      const res = await postSalesPost({ topic: 'กาแฟคั่วสด' }, 'session-u2'); // u2 has 3 credits
      expect(res.status).toBe(402);
      expect(fetchSpy).not.toHaveBeenCalled();
      const user = ctx.db.prepare("SELECT credits FROM users WHERE id = 'u2'").get() as any;
      expect(user.credits).toBe(3);
    });
  });

  describe('success path', () => {
    beforeEach(() => { ctx = makeEnv(); });

    it('creates a single content_items row with source_type sales_post and no series_id, charging real usage', async () => {
      globalThis.fetch = mockMinimaxContent(GOOD_SALES_POST) as any;
      const res = await postSalesPost({ topic: 'กาแฟคั่วสด', price: '฿199', channel: 'LINE @coffee' });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.item.source_type).toBe('sales_post');
      expect(body.item.series_id).toBeNull();
      expect(body.item.caption).toBe(GOOD_SALES_POST.caption);
      expect(body.item.hashtags).toEqual(GOOD_SALES_POST.hashtags);
      expect(body.item.metadata.sales_post).toBe(true);
      expect(body.item.metadata.included_blocks).toContain('ราคา');
      expect(body.item.metadata.included_blocks).not.toContain('การันตี');
      expect(body.credits_used).toBe(1); // calculateCredits({100,200}) = 1

      const row = ctx.db.prepare("SELECT credits FROM users WHERE id = 'u1'").get() as any;
      expect(row.credits).toBe(99);

      const stored = ctx.db.prepare("SELECT COUNT(*) as n FROM content_items WHERE source_type = 'sales_post'").get() as any;
      expect(stored.n).toBe(1);
    });
  });

  describe('refund paths', () => {
    beforeEach(() => { ctx = makeEnv(); });

    it('Bug A: fully refunds the reservation when the model response has no parseable JSON', async () => {
      globalThis.fetch = mockMinimaxRaw('this is not json at all, sorry') as any;
      const before = (ctx.db.prepare("SELECT credits FROM users WHERE id = 'u1'").get() as any).credits;
      const res = await postSalesPost({ topic: 'กาแฟคั่วสด' });
      expect(res.status).toBe(500);
      expect((await res.json() as any).error).toBe('ai_error');
      const after = (ctx.db.prepare("SELECT credits FROM users WHERE id = 'u1'").get() as any).credits;
      expect(after).toBe(before); // fully refunded, not left deducted
      const items = ctx.db.prepare("SELECT COUNT(*) as n FROM content_items").get() as any;
      expect(items.n).toBe(0);
    });

    it('Bug B: refunds and rejects a degenerate present-but-useless caption', async () => {
      globalThis.fetch = mockMinimaxContent({ ...GOOD_SALES_POST, caption: '...' }) as any;
      const before = (ctx.db.prepare("SELECT credits FROM users WHERE id = 'u1'").get() as any).credits;
      const res = await postSalesPost({ topic: 'กาแฟคั่วสด' });
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({ error: 'ai_error', message: 'สร้างโพสต์ไม่สำเร็จ ลองอีกครั้ง' });
      const after = (ctx.db.prepare("SELECT credits FROM users WHERE id = 'u1'").get() as any).credits;
      expect(after).toBe(before);
    });

    it('accepts a real caption right at/above the 30-char floor', async () => {
      // A minimal but genuine one-clause Thai caption just over the floor —
      // proves the guard does not reject legitimate short-but-real copy.
      const shortButReal = 'ลองเมล็ดกาแฟคั่วสดของเราวันนี้เลยนะคะ'; // > 30 chars
      expect(shortButReal.trim().length).toBeGreaterThanOrEqual(30);
      globalThis.fetch = mockMinimaxContent({ ...GOOD_SALES_POST, caption: shortButReal }) as any;
      const res = await postSalesPost({ topic: 'กาแฟคั่วสด' });
      expect(res.status).toBe(201);
    });

    it('refunds the net amount charged when persisting the generated item fails after the true-up', async () => {
      // Simulate a DB failure specifically on the content_items INSERT, which
      // happens AFTER credits have already been reserved and trued-up. Before
      // the fix, this path was not wrapped in a try/catch, so the thrown
      // error would escape to the global handler with credits deducted and
      // no row ever written.
      globalThis.fetch = mockMinimaxContent(GOOD_SALES_POST) as any;
      const realDb = ctx.env.DB;
      ctx.env = {
        ...ctx.env,
        DB: {
          prepare(sql: string) {
            if (sql.includes('INSERT INTO content_items')) {
              throw new Error('simulated D1 failure');
            }
            return realDb.prepare(sql);
          },
        },
      } as any;

      const before = (ctx.db.prepare("SELECT credits FROM users WHERE id = 'u1'").get() as any).credits;
      const res = await postSalesPost({ topic: 'กาแฟคั่วสด' });
      expect(res.status).toBe(500);
      expect((await res.json() as any).error).toBe('db_error');
      const after = (ctx.db.prepare("SELECT credits FROM users WHERE id = 'u1'").get() as any).credits;
      expect(after).toBe(before); // fully refunded despite the persist failure
      const items = ctx.db.prepare("SELECT COUNT(*) as n FROM content_items").get() as any;
      expect(items.n).toBe(0);
    });
  });
});

describe('salesPost.ts — fact-only pre-fill (skip, never invent)', () => {
  const BASE: SalesPostInput = { topic: 'กาแฟคั่วสด' };

  it('resolveIncludedBlocks includes only the always-blocks when no optional fact is supplied', () => {
    const included = resolveIncludedBlocks(BASE);
    const labels = included.map((b) => b.label);
    expect(labels).toEqual([
      'Hook', 'ปัญหา', 'ขยายปัญหา', 'แนะนำทางแก้', 'วิธีใช้งาน/รายละเอียด',
      'จุดต่าง', 'ภาพหลังใช้', 'เคยลองวิธีอื่นไม่เวิร์ก', 'ช่องทาง/CTA', 'PS',
    ]);
    // None of the fact-gated blocks are here — nothing to invent facts for.
    expect(labels).not.toContain('ราคา');
    expect(labels).not.toContain('ข้อเสนอ/โปรโมชั่น');
    expect(labels).not.toContain('การันตี');
    expect(labels).not.toContain('หลักฐาน/รีวิว');
  });

  it('includes a fact block only when that specific field has a real, non-empty value', () => {
    expect(resolveIncludedBlocks({ ...BASE, price: '' }).map((b) => b.label)).not.toContain('ราคา');
    expect(resolveIncludedBlocks({ ...BASE, price: '   ' }).map((b) => b.label)).not.toContain('ราคา');
    expect(resolveIncludedBlocks({ ...BASE, price: '฿199' }).map((b) => b.label)).toContain('ราคา');
    expect(resolveIncludedBlocks({ ...BASE, guarantee: 'คืนเงิน 7 วัน' }).map((b) => b.label)).toContain('การันตี');
  });

  it('promo gates BOTH the offer block and the "decide now" block off the same field', () => {
    const noPromo = resolveIncludedBlocks(BASE).map((b) => b.label);
    expect(noPromo).not.toContain('ข้อเสนอ/โปรโมชั่น');
    expect(noPromo).not.toContain('เหตุผลให้ตัดสินใจตอนนี้');
    const withPromo = resolveIncludedBlocks({ ...BASE, promo: 'ลด 20%' }).map((b) => b.label);
    expect(withPromo).toContain('ข้อเสนอ/โปรโมชั่น');
    expect(withPromo).toContain('เหตุผลให้ตัดสินใจตอนนี้');
  });

  it('channel does not gate block presence, only the CTA wording — falls back to a generic "ทักแชท" CTA', () => {
    const withoutChannel = buildSalesPostPrompt({ input: BASE, platform: 'facebook', brandContextBlock: 'ไม่มีข้อมูลแบรนด์' });
    expect(withoutChannel.user).toContain('ทักแชท');
    expect(resolveIncludedBlocks(BASE).map((b) => b.label)).toContain('ช่องทาง/CTA');

    const withChannel = buildSalesPostPrompt({
      input: { ...BASE, channel: 'LINE @coffee' }, platform: 'facebook', brandContextBlock: 'ไม่มีข้อมูลแบรนด์',
    });
    expect(withChannel.user).toContain('LINE @coffee');
  });

  it('never lets a supplied fact reach the prompt unlabeled as "must match exactly"', () => {
    const { system } = buildSalesPostPrompt({ input: BASE, platform: 'facebook', brandContextBlock: 'x' });
    expect(system).toContain('ต้องตรงกับที่ให้มาเป๊ะ');
    expect(system).toContain('ห้ามแต่งข้อเท็จจริงที่ไม่ได้ให้มาเพิ่มเองเด็ดขาด');
  });

  it('also forbids the fabrication categories most likely for a SALES post specifically: superlative claims, ingredients, health/efficacy claims, delivery-time promises', () => {
    const { system } = buildSalesPostPrompt({ input: BASE, platform: 'facebook', brandContextBlock: 'x' });
    expect(system).toContain('ขายดีอันดับ 1');
    expect(system).toContain('ลดน้ำหนัก');
    expect(system).toContain('ปลอดภัย 100%');
  });

  it('forbids naming a competitor for the "tried before" objection block, framing it as a method instead', () => {
    const included = resolveIncludedBlocks(BASE);
    const objectionBlock = included.find((b) => b.label === 'เคยลองวิธีอื่นไม่เวิร์ก')!;
    expect(objectionBlock.instruction).toContain('ห้ามเอ่ยชื่อร้าน/แบรนด์คู่แข่งเด็ดขาด');
    expect(objectionBlock.instruction).toContain('วิธีการทั่วไป');
  });

  describe('complaint-index disambiguation between "ปัญหา" and "เคยลองวิธีอื่นไม่เวิร์ก"', () => {
    it('assigns a DIFFERENT complaint to each block when persona complaints are available', () => {
      const complaints = ['ชงกาแฟเองแล้วรสชาติไม่เหมือนร้าน', 'เคยซื้อเมล็ดกาแฟถุงอื่นแต่ไม่หอม', 'หาที่ซื้อกาแฟคั่วสดใกล้บ้านไม่เจอ'];
      const { user } = buildSalesPostPrompt({
        input: BASE, platform: 'facebook', brandContextBlock: 'x', personaComplaints: complaints,
      });
      expect(user).toContain(complaints[0]);
      expect(user).toContain(complaints[1]);

      // The two block lines must reference different complaints, not the same one twice.
      const problemLine = user.split('\n').find((l) => l.includes('. ปัญหา:'))!;
      const objectionLine = user.split('\n').find((l) => l.includes('. เคยลองวิธีอื่นไม่เวิร์ก:'))!;
      expect(problemLine).toContain(complaints[0]);
      expect(problemLine).not.toContain(complaints[1]);
      expect(objectionLine).toContain(complaints[1]);
      expect(objectionLine).not.toContain(complaints[0]);
    });

    it('falls back to generic wording (no crash, no duplication instruction) when no persona is available', () => {
      const { user } = buildSalesPostPrompt({ input: BASE, platform: 'facebook', brandContextBlock: 'ไม่มีข้อมูลแบรนด์' });
      const problemLine = user.split('\n').find((l) => l.includes('. ปัญหา:'))!;
      const objectionLine = user.split('\n').find((l) => l.includes('. เคยลองวิธีอื่นไม่เวิร์ก:'))!;
      expect(problemLine).toBeTruthy();
      expect(objectionLine).toBeTruthy();
      expect(objectionLine).toContain('ห้ามเอ่ยชื่อร้าน/แบรนด์คู่แข่งเด็ดขาด');
    });
  });
});

describe('validateSalesPostInput', () => {
  it('requires a non-empty string topic', () => {
    expect(validateSalesPostInput({}).errors).toContain('topic_required');
    expect(validateSalesPostInput({ topic: '   ' }).errors).toContain('topic_required');
    expect(validateSalesPostInput({ topic: 42 }).errors).toContain('topic_required');
    expect(validateSalesPostInput({ topic: 'ok' }).ok).toBe(true);
  });

  it('flags non-string optional facts instead of letting them crash a later .trim()', () => {
    expect(validateSalesPostInput({ topic: 'ok', price: 100 }).errors).toContain('price_must_be_string');
    expect(validateSalesPostInput({ topic: 'ok', promo: ['x'] }).errors).toContain('promo_must_be_string');
    expect(validateSalesPostInput({ topic: 'ok', guarantee: {} }).errors).toContain('guarantee_must_be_string');
    expect(validateSalesPostInput({ topic: 'ok', channel: null }).ok).toBe(true); // null is fine, treated as absent
  });

  it('caps optional fact field length', () => {
    const tooLong = 'x'.repeat(MAX_SALES_POST_FACT_CHARS + 1);
    expect(validateSalesPostInput({ topic: 'ok', social_proof: tooLong }).errors).toContain('social_proof_too_long');
    expect(validateSalesPostInput({ topic: 'ok', social_proof: 'x'.repeat(MAX_SALES_POST_FACT_CHARS) }).ok).toBe(true);
  });
});
