/**
 * Migration gate test.
 *
 * Applies every migration file in apps/api/migrations/ against a fresh
 * in-memory SQLite database, in the SAME ORDER `wrangler d1 migrations
 * apply` uses on a brand-new database — a NATURAL sort of filenames
 * (numeric-aware), NOT a plain lexicographic string sort. This matters a
 * lot: plain `.sort()` puts "0003_mvp_clean.sql" *before* "001-v2.sql"
 * (since '0' < '1' at the 3rd character), which is NOT what
 * `wrangler d1 migrations apply` actually does — verified empirically
 * against real `wrangler d1 migrations list` output, which applies
 * 0001_init.sql, then 001-v2.sql, then 002-..., THEN 0003_mvp_clean.sql.
 * Getting this wrong would make this test give false confidence.
 *
 * This exists because `0003_mvp_clean.sql` drops and recreates `users`/
 * `projects`/etc. without the columns/tables that `001-v2.sql` and
 * `002-context-and-links.sql` add. See docs/AUDIT.md for the full incident.
 *
 * Two levels of guarantee, tested separately, because they're genuinely
 * different claims:
 *   1. Auto-applied migrations alone (`wrangler d1 migrations apply`) —
 *      fixes `api_keys`/`tool_runs` (006/007, safe `CREATE TABLE IF NOT
 *      EXISTS`), but users/projects columns are a KNOWN, documented gap
 *      (see manual-repairs/manual-repair-fresh-env.sql's header for why
 *      that repair isn't auto-applied: it uses ALTER TABLE ADD COLUMN,
 *      which would error on production where those columns already exist
 *      from a different real historical apply order).
 *   2. The full documented fresh-environment setup procedure — auto
 *      migrations, THEN the manual repair script — which IS expected to
 *      produce a fully correct schema, and is what STATUS.md/AUDIT.md tell
 *      anyone standing up a new environment to do.
 *
 * Deliberately does NOT test against production — production's migrations
 * were applied by hand over time in a different real order, which is a
 * separate, already-documented risk (see docs/AUDIT.md).
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');
const MANUAL_REPAIR_FILE = join(__dirname, '..', 'manual-repairs', 'manual-repair-fresh-env.sql');

function naturalSort(files: string[]): string[] {
  return [...files].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function applyMigrations(db: DatabaseSync) {
  const files = naturalSort(readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')));
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf-8'));
  }
}

function columnNames(db: DatabaseSync, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as any[]).map((c) => c.name as string);
}

function tableExists(db: DatabaseSync, table: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`)
    .get(table);
  return !!row;
}

const REQUIRED_TABLES = [
  'users', 'sessions', 'projects', 'generations', 'exports', 'api_keys',
  'tool_runs', 'tool_saves', 'tool_save_exports', 'email_verifications',
  'otp_codes', 'credit_transactions', 'rate_limits', 'step_assets',
  'project_links', 'admin_actions', 'email_outbox', 'mcp_tokens',
  'ai_models', 'media_assets', 'media_generations', 'generation_references',
  'generation_attempts', 'media_credit_holds', 'brand_profiles',
  'brand_profile_selections', 'brand_context_snapshots',
  'provider_webhook_events', 'media_work_items', 'media_pricing_quotes',
  'media_upload_intents', 'brandbook_exports', 'platform_provider_keys',
  'content_themes', 'content_topics',
];

describe('auto-applied migrations alone (`wrangler d1 migrations apply`)', () => {
  let db: DatabaseSync;

  beforeAll(() => {
    db = new DatabaseSync(':memory:');
    applyMigrations(db);
  });

  it('creates every table the API code depends on', () => {
    for (const table of REQUIRED_TABLES) {
      expect(tableExists(db, table), `expected table "${table}" to exist`).toBe(true);
    }
  });

  it('api_keys and tool_runs are usable, not just present in name (006/007 regression guard)', () => {
    // A real INSERT, not just a schema-presence check — this is what
    // actually broke in production before 006/007 existed (missing table
    // showed up as a runtime 500 on first write, not at migration-apply time).
    db.exec(`INSERT OR IGNORE INTO users (id, email, password_hash, plan, created_at, updated_at)
             VALUES ('u1', 'u1@test.com', 'x', 'free', 0, 0)`);
    expect(() =>
      db.exec(`INSERT INTO api_keys (id, user_id, provider, encrypted_key, created_at)
               VALUES ('k1', 'u1', 'openai', 'ciphertext', 0)`)
    ).not.toThrow();
    expect(() =>
      db.exec(`INSERT INTO tool_runs (id, user_id, tool_name, created_at)
               VALUES ('t1', 'u1', 'pain_generator', 0)`)
    ).not.toThrow();
  });

  it('mcp_tokens is usable (008 — MCP personal access tokens)', () => {
    db.exec(`INSERT OR IGNORE INTO users (id, email, password_hash, plan, created_at, updated_at)
             VALUES ('u1', 'u1@test.com', 'x', 'free', 0, 0)`);
    expect(() =>
      db.exec(`INSERT INTO mcp_tokens (id, user_id, token_hash, token_hint, created_at)
               VALUES ('mt1', 'u1', 'deadbeef', 'ab12', 0)`)
    ).not.toThrow();
  });

  it('creative studio core tables are usable (009 — media foundation)', () => {
    db.exec(`INSERT OR IGNORE INTO users (id, email, password_hash, plan, created_at, updated_at)
             VALUES ('u-media', 'media@test.com', 'x', 'free', 0, 0)`);
    expect(() =>
      db.exec(`
        INSERT INTO ai_models (
          id, provider, provider_model_id, display_name, model_type, operation,
          capabilities_json, pricing_json, pricing_version, created_at, updated_at
        )
        VALUES (
          'model-1', 'minimax', 'image-01', 'MiniMax Image', 'image', 'text_to_image',
          '{"aspectRatios":["1:1"],"outputFormats":["url"],"maxOutputCount":1}',
          '{"credits_per_output":2}', 'v1', 0, 0
        );
        INSERT INTO media_pricing_quotes (
          id, user_id, model_id, request_hash, pricing_version, credits,
          pricing_snapshot_json, expires_at, created_at
        )
        VALUES ('quote-1', 'u-media', 'model-1', 'hash', 'v1', 2, '{}', 100, 0);
        INSERT INTO brand_profiles (
          id, user_id, name, business_summary, audience_json, tone_of_voice_json,
          content_pillars_json, offers_json, rules_json, default_reference_asset_ids_json,
          created_at, updated_at
        )
        VALUES ('brand-1', 'u-media', 'Brand', '', '[]', '[]', '[]', '[]', '{}', '[]', 0, 0);
        INSERT INTO media_work_items (
          id, work_type, dedupe_key, available_at, payload_json, created_at, updated_at
        )
        VALUES ('work-1', 'submit_generation', 'submit:generation-1', 0, '{}', 0, 0);
      `)
    ).not.toThrow();
  });

  it('platform_provider_keys is usable (015 — admin-managed platform provider keys)', () => {
    expect(() =>
      db.exec(`
        INSERT INTO platform_provider_keys (
          provider, encrypted_key, key_hint, is_active, updated_by, created_at, updated_at
        )
        VALUES ('fal', 'salt.iv.ciphertext', '••••1234', 1, 'admin-1', 0, 0);
      `)
    ).not.toThrow();
    // provider is the primary key — re-configuring the same provider must
    // upsert, not create a duplicate row (this is what the admin "paste a new
    // key" flow relies on via ON CONFLICT(provider) DO UPDATE).
    expect(() =>
      db.exec(`
        INSERT INTO platform_provider_keys (
          provider, encrypted_key, key_hint, is_active, updated_by, created_at, updated_at
        )
        VALUES ('fal', 'salt2.iv2.ciphertext2', '••••5678', 1, 'admin-1', 0, 0)
        ON CONFLICT(provider) DO UPDATE SET
          encrypted_key = excluded.encrypted_key, key_hint = excluded.key_hint, updated_at = excluded.updated_at;
      `)
    ).not.toThrow();
    const rows = db.prepare('SELECT key_hint FROM platform_provider_keys WHERE provider = ?').all('fal') as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].key_hint).toBe('••••5678');
  });

  it('brand_profiles.persona_json/voice_samples_json are usable (020 — brand bootstrap persona)', () => {
    expect(columnNames(db, 'brand_profiles')).toContain('persona_json');
    expect(columnNames(db, 'brand_profiles')).toContain('voice_samples_json');

    db.exec(`INSERT OR IGNORE INTO users (id, email, password_hash, plan, created_at, updated_at)
             VALUES ('u-persona', 'persona@test.com', 'x', 'free', 0, 0)`);
    const persona = JSON.stringify({
      name: 'พี่หมู', age: '35', job: 'พนักงานออฟฟิศ',
      daily_life: 'ตื่นเช้าไปทำงาน กลับบ้านค่ำ ไม่ค่อยมีเวลาทำอาหารเอง',
      complaints: ['หาของกินสายที่เปิดดึกไม่ได้', 'กลัวอ้วนแต่ก็อยากกินอร่อย', 'สั่งเดลิเวอรี่แพงทุกวันไม่ไหว'],
    });
    const voiceSamples = JSON.stringify(['โพสต์เก่าที่เคยขายดี ตัวอย่างที่ 1']);
    expect(() =>
      db.exec(`
        INSERT INTO brand_profiles (
          id, user_id, name, business_summary, audience_json, tone_of_voice_json,
          content_pillars_json, offers_json, rules_json, default_reference_asset_ids_json,
          persona_json, voice_samples_json, created_at, updated_at
        )
        VALUES (
          'brand-persona-1', 'u-persona', 'Brand', '', '[]', '[]', '[]', '[]', '{}', '[]',
          '${persona}', '${voiceSamples}', 0, 0
        );
      `)
    ).not.toThrow();

    const row = db.prepare('SELECT persona_json, voice_samples_json FROM brand_profiles WHERE id = ?')
      .get('brand-persona-1') as any;
    expect(JSON.parse(row.persona_json).complaints).toHaveLength(3);
    expect(JSON.parse(row.voice_samples_json)).toEqual(['โพสต์เก่าที่เคยขายดี ตัวอย่างที่ 1']);
  });

  it('brand_profiles created before 020 (NULL persona_json/voice_samples_json) remain valid', () => {
    db.exec(`INSERT OR IGNORE INTO users (id, email, password_hash, plan, created_at, updated_at)
             VALUES ('u-legacy', 'legacy@test.com', 'x', 'free', 0, 0)`);
    expect(() =>
      db.exec(`
        INSERT INTO brand_profiles (
          id, user_id, name, business_summary, audience_json, tone_of_voice_json,
          content_pillars_json, offers_json, rules_json, default_reference_asset_ids_json,
          created_at, updated_at
        )
        VALUES ('brand-legacy-1', 'u-legacy', 'Brand', '', '[]', '[]', '[]', '[]', '{}', '[]', 0, 0);
      `)
    ).not.toThrow();
    const row = db.prepare('SELECT persona_json, voice_samples_json FROM brand_profiles WHERE id = ?')
      .get('brand-legacy-1') as any;
    expect(row.persona_json).toBeNull();
    expect(row.voice_samples_json).toBeNull();
  });

  it('content_themes and content_topics are usable, with a real theme→topic→series FK chain (021 — Topic Picker)', () => {
    db.exec(`INSERT OR IGNORE INTO users (id, email, password_hash, plan, created_at, updated_at)
             VALUES ('u-topic', 'topic@test.com', 'x', 'free', 0, 0)`);
    db.exec(`
      INSERT INTO brand_profiles (
        id, user_id, name, business_summary, audience_json, tone_of_voice_json,
        content_pillars_json, offers_json, rules_json, default_reference_asset_ids_json,
        created_at, updated_at
      )
      VALUES ('brand-topic-1', 'u-topic', 'Brand', '', '[]', '[]', '[]', '[]', '{}', '[]', 0, 0);
    `);

    expect(() =>
      db.exec(`
        INSERT INTO content_themes (id, user_id, brand_profile_id, name, reason, status, created_at, updated_at)
        VALUES ('theme-1', 'u-topic', 'brand-topic-1', 'ของกินยามดึก', 'กลุ่มลูกค้าหลักทำงานดึก', 'confirmed', 0, 0);
      `)
    ).not.toThrow();

    expect(() =>
      db.exec(`
        INSERT INTO content_topics (id, user_id, theme_id, title, content_type, seasonal_event, status, created_at, updated_at)
        VALUES ('topic-1', 'u-topic', 'theme-1', 'แกงถุงส่งดึกไม่ต้องออกจากบ้าน', 'lifestyle', NULL, 'suggested', 0, 0);
      `)
    ).not.toThrow();

    // Selecting a topic links it to the series it produced — exercise the
    // full chain a real "tap to generate" flow would create.
    db.exec(`
      INSERT INTO content_series (id, user_id, brand_profile_id, topic, requested_count, cadence_days, platforms_json, status, created_at, updated_at)
      VALUES ('series-1', 'u-topic', 'brand-topic-1', 'แกงถุงส่งดึกไม่ต้องออกจากบ้าน', 1, 1, '[]', 'completed', 0, 0);
    `);
    expect(() =>
      db.exec(`UPDATE content_topics SET status = 'used', used_series_id = 'series-1', updated_at = 0 WHERE id = 'topic-1';`)
    ).not.toThrow();

    const topic = db.prepare('SELECT status, used_series_id FROM content_topics WHERE id = ?').get('topic-1') as any;
    expect(topic.status).toBe('used');
    expect(topic.used_series_id).toBe('series-1');
  });

  it('KNOWN GAP: users/projects columns from 001-v2/002 are wiped by 0003_mvp_clean on a fresh apply', () => {
    // This is intentionally documenting a real, currently-unfixed-by-
    // automation gap, not asserting desired behavior. If this ever starts
    // failing (i.e. the columns ARE present), that's good news — update
    // this test and manual-repairs/manual-repair-fresh-env.sql's header.
    expect(columnNames(db, 'users')).not.toContain('first_name');
    expect(columnNames(db, 'projects')).not.toContain('kind');
  });
});

describe('full documented fresh-environment setup (migrations + manual-repairs/manual-repair-fresh-env.sql)', () => {
  let db: DatabaseSync;

  beforeAll(() => {
    db = new DatabaseSync(':memory:');
    applyMigrations(db);
    db.exec(readFileSync(MANUAL_REPAIR_FILE, 'utf-8'));
  });

  it('users has every column the API reads/writes', () => {
    const cols = columnNames(db, 'users');
    for (const col of [
      'id', 'email', 'password_hash', 'name', 'first_name', 'last_name',
      'phone', 'avatar_url', 'role', 'email_verified', 'email_verified_at',
      'two_factor_enabled', 'credits', 'totp_secret', 'plan', 'locale',
    ]) {
      expect(cols, `expected users.${col} to exist`).toContain(col);
    }
  });

  it('projects has the `kind` column (drives per-tool project filtering)', () => {
    expect(columnNames(db, 'projects')).toContain('kind');
  });

  it('still has every required table', () => {
    for (const table of REQUIRED_TABLES) {
      expect(tableExists(db, table), `expected table "${table}" to exist`).toBe(true);
    }
  });
});
