/**
 * Presentation Builder — money-safety and race-condition regression tests
 * for the Stage A bug fixes: reserve-then-reconcile credits (was: deduct
 * AFTER the AI call with no reservation and no check of whether the
 * deduction even succeeded), and a natural-key upsert for
 * `presentation_steps` (was: `INSERT OR REPLACE` with a fresh random id on
 * every call, which orphaned a racing request's later UPDATE).
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/index';
import { createCsrfToken } from '../src/lib/middleware';
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
  if (!userColumns.includes('email_verified')) db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 1');
  db.exec(`
    INSERT INTO users (id, email, password_hash, name, plan, role, email_verified, credits, created_at, updated_at)
    VALUES ('u1', 'u1@test.com', 'x', 'User One', 'free', 'user', 1, 100, 0, 0);
    INSERT INTO users (id, email, password_hash, name, plan, role, email_verified, credits, created_at, updated_at)
    VALUES ('u2', 'u2@test.com', 'x', 'User Two', 'free', 'user', 1, 3, 0, 0);
    INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ('session-u1', 'u1', ${Date.now() + 60_000}, 0);
    INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ('session-u2', 'u2', ${Date.now() + 60_000}, 0);
  `);
  return {
    db,
    env: {
      DB: makeD1Shim(db),
      MINIMAX_API_KEY: 'test-key',
      MINIMAX_GROUP_ID: 'test-group',
      MINIMAX_MODEL: 'MiniMax-M3',
      ALLOWED_ORIGIN: 'http://localhost:5173',
      API_URL: 'https://api.test',
    } as any,
  };
}

async function authHeadersFor(env: any, sessionId: string) {
  return { Cookie: `session=${sessionId}`, 'X-CSRF-Token': await createCsrfToken(env, sessionId) };
}

async function createProject(env: any, cookie: Record<string, string>) {
  const res = await app.request('/api/presentation/projects', {
    method: 'POST',
    headers: { ...cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'ทดสอบ', objective: 'informative' }),
  }, env);
  const body = await res.json() as any;
  return body.project.id as string;
}

function mockMinimaxSuccess(promptTokens: number, completionTokens: number, output: unknown) {
  return vi.fn(async () => new Response(JSON.stringify({
    id: 'gen-1',
    choices: [{ message: { role: 'assistant', content: JSON.stringify(output) }, finish_reason: 'stop' }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
  }), { status: 200 }));
}

describe('Presentation Builder — generate step money-safety', () => {
  let ctx: ReturnType<typeof makeEnv>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => { ctx = makeEnv(); });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('charges real usage (not the fixed per-step estimate) and refunds the unused reservation', async () => {
    // Step 2 costs a flat 1 credit in STEP_CREDIT_COSTS, but the real
    // reservation is based on estimated prompt/completion size, which is
    // much larger than 1 credit's worth — a real generation should end up
    // charging far less than the reservation, proving the true-up refund
    // actually ran instead of just keeping the whole reservation.
    globalThis.fetch = mockMinimaxSuccess(50, 50, { persona_card: {}, handling_strategy: {}, concerns_responses: {} }) as any;
    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u1')));
    const before = ctx.db.prepare("SELECT credits FROM users WHERE id='u1'").get() as any;

    const res = await app.request(`/api/presentation/projects/${projectId}/generate/2`, {
      method: 'POST',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { audience_role: 'ผู้บริหาร' } }),
    }, ctx.env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;

    const after = ctx.db.prepare("SELECT credits FROM users WHERE id='u1'").get() as any;
    // calculateCredits({prompt:50, completion:50}) = ceil(0.05 + 0.1) = 1
    expect(before.credits - after.credits).toBe(1);
    expect(body.meta.credits_used).toBe(1);
    expect(body.meta.credits_remaining).toBe(after.credits);
  });

  it('refunds the full reservation when the AI call fails', async () => {
    globalThis.fetch = vi.fn(async () => new Response('boom', { status: 500 })) as any;
    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u1')));
    const before = ctx.db.prepare("SELECT credits FROM users WHERE id='u1'").get() as any;

    const res = await app.request(`/api/presentation/projects/${projectId}/generate/2`, {
      method: 'POST',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {} }),
    }, ctx.env);
    expect(res.status).toBe(500);

    const after = ctx.db.prepare("SELECT credits FROM users WHERE id='u1'").get() as any;
    expect(after.credits).toBe(before.credits); // fully refunded, no net charge

    const step = ctx.db.prepare("SELECT status FROM presentation_steps WHERE project_id=? AND step_number=2").get(projectId) as any;
    expect(step.status).toBe('error');
  });

  it('retries once when the AI returns unparseable content, and succeeds using the second attempt', async () => {
    // First call: "content" isn't valid JSON at all (no fence, no braces to
    // salvage) — real production report was exactly this shape, MiniMax
    // returning prose despite jsonMode being requested.
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'gen-1',
        choices: [{ message: { role: 'assistant', content: 'ขอโทษค่ะ ไม่สามารถสร้างได้ในตอนนี้' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 40, completion_tokens: 20, total_tokens: 60 },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'gen-2',
        choices: [{ message: { role: 'assistant', content: JSON.stringify({ persona_card: {}, handling_strategy: {}, concerns_responses: {} }) }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 40, completion_tokens: 60, total_tokens: 100 },
      }), { status: 200 }));
    globalThis.fetch = fetchSpy as any;

    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u1')));
    const before = ctx.db.prepare("SELECT credits FROM users WHERE id='u1'").get() as any;

    const res = await app.request(`/api/presentation/projects/${projectId}/generate/2`, {
      method: 'POST',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {} }),
    }, ctx.env);
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const body = await res.json() as any;
    expect(body.output).toEqual({ persona_card: {}, handling_strategy: {}, concerns_responses: {} });
    // Billed for BOTH attempts' real usage (40+20 wasted + 40+60 successful),
    // not just the successful one — both calls cost real MiniMax API spend.
    expect(body.meta.tokens).toEqual({ prompt_tokens: 80, completion_tokens: 80, total_tokens: 160 });

    const after = ctx.db.prepare("SELECT credits FROM users WHERE id='u1'").get() as any;
    expect(before.credits - after.credits).toBe(body.meta.credits_used);

    const step = ctx.db.prepare("SELECT status FROM presentation_steps WHERE project_id=? AND step_number=2").get(projectId) as any;
    expect(step.status).toBe('done');
  });

  it('gives up and refunds in full when both attempts return unparseable content', async () => {
    const badResponse = () => new Response(JSON.stringify({
      id: 'gen-x',
      choices: [{ message: { role: 'assistant', content: 'not json at all' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 },
    }), { status: 200 });
    const fetchSpy = vi.fn(async () => badResponse());
    globalThis.fetch = fetchSpy as any;

    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u1')));
    const before = ctx.db.prepare("SELECT credits FROM users WHERE id='u1'").get() as any;

    const res = await app.request(`/api/presentation/projects/${projectId}/generate/2`, {
      method: 'POST',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {} }),
    }, ctx.env);
    expect(res.status).toBe(500);
    expect(fetchSpy).toHaveBeenCalledTimes(2); // both attempts exhausted before giving up

    const body = await res.json() as any;
    expect(body.error).toBe('parse_error');

    const after = ctx.db.prepare("SELECT credits FROM users WHERE id='u1'").get() as any;
    expect(after.credits).toBe(before.credits); // fully refunded, no net charge for either wasted attempt

    const step = ctx.db.prepare("SELECT status, error FROM presentation_steps WHERE project_id=? AND step_number=2").get(projectId) as any;
    expect(step.status).toBe('error');
    expect(step.error).toContain('after 2 attempts');
  });

  it('rejects generation for a user without enough credits for the reservation, before touching the DB', async () => {
    const fetchSpy = mockMinimaxSuccess(50, 50, {});
    globalThis.fetch = fetchSpy as any;
    // u2 has 3 credits; step 6/7 have a large maxTokens budget so the
    // reservation estimate should exceed that easily.
    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u2')));
    const res = await app.request(`/api/presentation/projects/${projectId}/generate/6`, {
      method: 'POST',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u2')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {} }),
    }, ctx.env);
    expect(res.status).toBe(402);
    expect(fetchSpy).not.toHaveBeenCalled();

    const after = ctx.db.prepare("SELECT credits FROM users WHERE id='u2'").get() as any;
    expect(after.credits).toBe(3); // untouched

    const step = ctx.db.prepare("SELECT COUNT(*) as n FROM presentation_steps WHERE project_id=? AND step_number=6").get(projectId) as any;
    expect(step.n).toBe(0); // no row created for a rejected reservation
  });

  it('reuses the same step row id across regenerations instead of orphaning it via INSERT OR REPLACE', async () => {
    globalThis.fetch = mockMinimaxSuccess(50, 50, { persona_card: {}, handling_strategy: {}, concerns_responses: {} }) as any;
    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u1')));

    await app.request(`/api/presentation/projects/${projectId}/generate/2`, {
      method: 'POST',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {} }),
    }, ctx.env);
    const firstRow = ctx.db.prepare("SELECT id FROM presentation_steps WHERE project_id=? AND step_number=2").get(projectId) as any;

    await app.request(`/api/presentation/projects/${projectId}/generate/2`, {
      method: 'POST',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {} }),
    }, ctx.env);
    const secondRow = ctx.db.prepare("SELECT id FROM presentation_steps WHERE project_id=? AND step_number=2").get(projectId) as any;

    expect(secondRow.id).toBe(firstRow.id);
    const rowCount = ctx.db.prepare("SELECT COUNT(*) as n FROM presentation_steps WHERE project_id=? AND step_number=2").get(projectId) as any;
    expect(rowCount.n).toBe(1);
  });

  it('rejects a concurrent second generate call for the same step while the first is still in-flight', async () => {
    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u1')));
    // Simulate an in-progress generation by pre-seeding a 'generating' row
    // updated just now (well within the 120s recovery window).
    ctx.db.exec(`
      INSERT INTO presentation_steps (id, project_id, step_number, input_json, status, created_at, updated_at)
      VALUES ('step-inflight', '${projectId}', 2, '{}', 'generating', ${Date.now()}, ${Date.now()})
    `);

    const fetchSpy = mockMinimaxSuccess(50, 50, {});
    globalThis.fetch = fetchSpy as any;
    const res = await app.request(`/api/presentation/projects/${projectId}/generate/2`, {
      method: 'POST',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {} }),
    }, ctx.env);
    expect(res.status).toBe(409);
    expect(fetchSpy).not.toHaveBeenCalled();

    const after = ctx.db.prepare("SELECT credits FROM users WHERE id='u1'").get() as any;
    expect(after.credits).toBe(100); // net zero — reservation is refunded immediately on losing the claim
  });

  it('the atomic claim statement rejects a second racing claim even when NEITHER request has written yet (true concurrency, not just a pre-existing row)', async () => {
    // The previous test proves the guard works once a 'generating' row is
    // already visible. That alone doesn't prove the fix is race-safe: the
    // original bug (and an earlier version of this fix, using a separate
    // `SELECT existing row` + `INSERT ... ON CONFLICT` as two round trips)
    // was that TWO requests could both read "no active generation" before
    // either one's write commits, so both would proceed, both reserve
    // credits, and whichever's completion UPDATE ran first got silently
    // orphaned (0 rows affected) by the other's INSERT ON CONFLICT keeping
    // its own row id. Driving that via real HTTP concurrency (Promise.all
    // of two `app.request` calls) is not reliable in this single-threaded
    // Node test harness — the two request coroutines don't interleave at
    // the exact instruction boundary needed on every run, because the
    // handler makes many other DB/CSRF-related await hops first that can
    // absorb the race non-deterministically. So this test instead exercises
    // the actual atomic claim statement directly, exactly as
    // presentationRoutes.ts issues it, run twice back-to-back for a step
    // that has NO existing row (i.e. simulating that both requests decided
    // to insert fresh) — this is the precise SQL-level property the fix
    // depends on, and it's what makes the HTTP-level race impossible
    // regardless of how the two requests happen to interleave in
    // production (where D1's real network round trips make that
    // interleaving easy to hit).
    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u1')));
    const claimSql = `
      INSERT INTO presentation_steps
        (id, project_id, step_number, input_json, status, framework_variant, custom_system_prompt, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'generating', ?, ?, ?, ?)
      ON CONFLICT(project_id, step_number) DO UPDATE SET
        input_json = excluded.input_json,
        status = 'generating',
        framework_variant = excluded.framework_variant,
        custom_system_prompt = excluded.custom_system_prompt,
        updated_at = excluded.updated_at
      WHERE presentation_steps.status != 'generating' OR presentation_steps.updated_at < ?
    `;
    const now = Date.now();
    const staleThreshold = now - 120_000;

    const claimA = ctx.db.prepare(claimSql).run(
      'step-race-A', projectId, 2, '{"note":"A"}', 'scqa_minto', null, now, now, staleThreshold
    ) as any;
    const claimB = ctx.db.prepare(claimSql).run(
      'step-race-B', projectId, 2, '{"note":"B"}', 'scqa_minto', null, now, now, staleThreshold
    ) as any;

    expect(claimA.changes).toBe(1); // first claim wins
    expect(claimB.changes).toBe(0); // second claim is rejected atomically — never both win

    const row = ctx.db.prepare("SELECT id, status FROM presentation_steps WHERE project_id=? AND step_number=2").get(projectId) as any;
    expect(row.id).toBe('step-race-A'); // the row the loser (B) would still be
    // referencing if it (wrongly) assumed its own id — confirming the class
    // of bug this test guards against: a losing claimant's local id must
    // never be used for its later completion UPDATE.
  });

  it('recovers from a stale/crashed generating row older than the recovery window', async () => {
    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u1')));
    ctx.db.exec(`
      INSERT INTO presentation_steps (id, project_id, step_number, input_json, status, created_at, updated_at)
      VALUES ('step-stale', '${projectId}', 2, '{}', 'generating', ${Date.now() - 200_000}, ${Date.now() - 200_000})
    `);

    globalThis.fetch = mockMinimaxSuccess(50, 50, { persona_card: {}, handling_strategy: {}, concerns_responses: {} }) as any;
    const res = await app.request(`/api/presentation/projects/${projectId}/generate/2`, {
      method: 'POST',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {} }),
    }, ctx.env);
    expect(res.status).toBe(200);

    const row = ctx.db.prepare("SELECT id, status FROM presentation_steps WHERE project_id=? AND step_number=2").get(projectId) as any;
    expect(row.id).toBe('step-stale'); // reused, not orphaned
    expect(row.status).toBe('done');
  });
});

describe('Presentation Builder — Stage B: editable objective + framework_variant', () => {
  let ctx: ReturnType<typeof makeEnv>;
  beforeEach(() => { ctx = makeEnv(); });

  it('persists framework_variant at project creation, derived from objective', async () => {
    const res = await app.request('/api/presentation/projects', {
      method: 'POST',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Story project', objective: 'story' }),
    }, ctx.env);
    const body = await res.json() as any;
    expect(body.project.framework_variant).toBe('popup_pitch');

    const row = ctx.db.prepare('SELECT framework_variant FROM presentation_projects WHERE id = ?').get(body.project.id) as any;
    expect(row.framework_variant).toBe('popup_pitch');
  });

  it('lets a user edit objective after creation, keeping framework_variant in sync', async () => {
    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u1'))); // created as 'informative'
    const before = ctx.db.prepare('SELECT objective, framework_variant FROM presentation_projects WHERE id = ?').get(projectId) as any;
    expect(before).toEqual({ objective: 'informative', framework_variant: 'scqa_minto' });

    const res = await app.request(`/api/presentation/projects/${projectId}`, {
      method: 'PUT',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ objective: 'persuasive' }),
    }, ctx.env);
    expect(res.status).toBe(200);

    const after = ctx.db.prepare('SELECT objective, framework_variant FROM presentation_projects WHERE id = ?').get(projectId) as any;
    expect(after).toEqual({ objective: 'persuasive', framework_variant: '5m_mission' });
  });

  it('rejects an invalid objective value on update', async () => {
    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u1')));
    const res = await app.request(`/api/presentation/projects/${projectId}`, {
      method: 'PUT',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ objective: 'not_a_real_objective' }),
    }, ctx.env);
    expect(res.status).toBe(400);

    const row = ctx.db.prepare('SELECT objective FROM presentation_projects WHERE id = ?').get(projectId) as any;
    expect(row.objective).toBe('informative'); // untouched
  });

  it('a subsequent generate call picks up the newly-edited objective/framework_variant', async () => {
    globalThis.fetch = mockMinimaxSuccess(50, 50, { persona_card: {}, handling_strategy: {}, concerns_responses: {} }) as any;
    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u1')));
    await app.request(`/api/presentation/projects/${projectId}`, {
      method: 'PUT',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ objective: 'story' }),
    }, ctx.env);

    await app.request(`/api/presentation/projects/${projectId}/generate/2`, {
      method: 'POST',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {} }),
    }, ctx.env);

    const step = ctx.db.prepare("SELECT framework_variant FROM presentation_steps WHERE project_id=? AND step_number=2").get(projectId) as any;
    expect(step.framework_variant).toBe('popup_pitch');
  });

  it('an objective edit after Step 1 has already run propagates to a Step 1 resubmit AND later steps (regression: a stale cached framework_variant inside step 1s own output_json must not outrank the freshly-edited project column)', async () => {
    // This is the realistic edit scenario: Step 1 has already been generated
    // once (so `presentation_steps` already has a 'done' row for step 1,
    // exactly what makes `hasLaterSteps` true on the frontend and surfaces
    // the "changing objective will change the framework" warning in the
    // first place). Editing objective and resubmitting Step 1 — the actual
    // flow Step1Brief.svelte drives (PUT then POST /generate/1, in that
    // order) — must make the NEW framework_variant win, not silently keep
    // re-persisting the OLD one forever.
    globalThis.fetch = mockMinimaxSuccess(50, 50, { persona_card: {}, handling_strategy: {}, concerns_responses: {} }) as any;
    const headers = { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' };
    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u1'))); // created as 'informative'

    // Step 1's first-ever save (no AI — matches the real "save input" path).
    await app.request(`/api/presentation/projects/${projectId}/generate/1`, {
      method: 'POST', headers,
      body: JSON.stringify({ input: { title: 'ทดสอบ', objective: 'informative', target_slides: 10, time_minutes: 15, color_theme: 'business_blue', language: 'th' } }),
    }, ctx.env);
    // Generate step 2 too, so a 'done' row exists downstream of step 1.
    await app.request(`/api/presentation/projects/${projectId}/generate/2`, {
      method: 'POST', headers, body: JSON.stringify({ input: {} }),
    }, ctx.env);

    // Edit objective: 'informative' (scqa_minto) -> 'story' (popup_pitch).
    await app.request(`/api/presentation/projects/${projectId}`, {
      method: 'PUT', headers, body: JSON.stringify({ objective: 'story' }),
    }, ctx.env);
    // Resubmit Step 1 exactly like Step1Brief's onGenerate payload — includes
    // the new objective, but (correctly) no framework_variant of its own.
    await app.request(`/api/presentation/projects/${projectId}/generate/1`, {
      method: 'POST', headers,
      body: JSON.stringify({ input: { title: 'ทดสอบ', objective: 'story', target_slides: 10, time_minutes: 15, color_theme: 'business_blue', language: 'th' } }),
    }, ctx.env);

    const step1 = ctx.db.prepare("SELECT output_json FROM presentation_steps WHERE project_id=? AND step_number=1").get(projectId) as any;
    expect(JSON.parse(step1.output_json).framework_variant).toBe('popup_pitch');

    // Regenerating Step 2 afterwards must also pick up the new framework —
    // not the stale value step 1 would otherwise have kept re-persisting.
    await app.request(`/api/presentation/projects/${projectId}/generate/2`, {
      method: 'POST', headers, body: JSON.stringify({ input: {} }),
    }, ctx.env);
    const step2 = ctx.db.prepare("SELECT framework_variant FROM presentation_steps WHERE project_id=? AND step_number=2").get(projectId) as any;
    expect(step2.framework_variant).toBe('popup_pitch');
  });
});

describe('Migration 018 — framework_variant backfill for pre-existing rows', () => {
  it('backfills framework_variant on rows that predate the column, derived from their existing objective', () => {
    // Apply every migration EXCEPT 018, insert a row the way it would have
    // looked before this migration existed, then apply 018 alone and check
    // the backfill UPDATE actually reaches it — proving the migration is
    // safe to run against a real production database with existing rows,
    // not just a fresh schema that never had the gap in the first place.
    const db = new DatabaseSync(':memory:');
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql') && file !== '018-presentation-framework-variant.sql')
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const file of files) db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf-8'));

    db.exec(`
      INSERT INTO users (id, email, password_hash, name, plan, created_at, updated_at)
      VALUES ('u1', 'u1@test.com', 'x', 'User One', 'free', 0, 0);
      INSERT INTO presentation_projects (id, user_id, title, objective, target_slides, time_minutes, language, color_theme, status, current_step, created_at, updated_at)
      VALUES ('legacy-1', 'u1', 'Legacy story project', 'story', 10, 15, 'th', 'business_blue', 'draft', 1, 0, 0);
      INSERT INTO presentation_projects (id, user_id, title, objective, target_slides, time_minutes, language, color_theme, status, current_step, created_at, updated_at)
      VALUES ('legacy-2', 'u1', 'Legacy informative project', 'informative', 10, 15, 'th', 'business_blue', 'draft', 1, 0, 0);
    `);

    db.exec(readFileSync(join(MIGRATIONS_DIR, '018-presentation-framework-variant.sql'), 'utf-8'));

    const rows = db.prepare('SELECT id, objective, framework_variant FROM presentation_projects ORDER BY id').all() as any[];
    expect(rows).toEqual([
      { id: 'legacy-1', objective: 'story', framework_variant: 'popup_pitch' },
      { id: 'legacy-2', objective: 'informative', framework_variant: 'scqa_minto' },
    ]);
  });
});

describe('Presentation Builder — Stage C: autofill', () => {
  let ctx: ReturnType<typeof makeEnv>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => { ctx = makeEnv(); });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('rejects an out-of-range step (autofill only covers 1-3)', async () => {
    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u1')));
    const res = await app.request(`/api/presentation/projects/${projectId}/autofill/6`, {
      method: 'POST',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {} }),
    }, ctx.env);
    expect(res.status).toBe(400);
  });

  it('returns a suggestion without writing to presentation_steps (advisory only)', async () => {
    globalThis.fetch = mockMinimaxSuccess(30, 40, {
      objective: 'informative', description: 'สรุปผลงาน Q3', target_slides: 12, time_minutes: 20,
    }) as any;
    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u1')));

    const res = await app.request(`/api/presentation/projects/${projectId}/autofill/1`, {
      method: 'POST',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { title: 'สรุปผลงานไตรมาส 3' } }),
    }, ctx.env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.suggestion.description).toBe('สรุปผลงาน Q3');
    expect(body.suggestion.target_slides).toBe(12);

    const stepRow = ctx.db.prepare("SELECT COUNT(*) as n FROM presentation_steps WHERE project_id=? AND step_number=1").get(projectId) as any;
    expect(stepRow.n).toBe(0); // advisory only — nothing persisted
  });

  it('strips any hallucinated communication_style/concern id before returning the suggestion', async () => {
    globalThis.fetch = mockMinimaxSuccess(30, 40, {
      audience_role: 'CMO', business_context: 'SaaS',
      communication_styles: ['analytical', 'made_up_style'],
      audience_concerns: ['time', 'not_a_real_concern'],
    }) as any;
    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u1')));

    const res = await app.request(`/api/presentation/projects/${projectId}/autofill/2`, {
      method: 'POST',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {} }),
    }, ctx.env);
    const body = await res.json() as any;
    expect(body.suggestion.communication_styles).toEqual(['analytical']);
    expect(body.suggestion.audience_concerns).toEqual(['time']);
  });

  it('reserves credits before calling the AI and refunds in full on failure', async () => {
    globalThis.fetch = vi.fn(async () => new Response('boom', { status: 500 })) as any;
    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u1')));
    const before = ctx.db.prepare("SELECT credits FROM users WHERE id='u1'").get() as any;

    const res = await app.request(`/api/presentation/projects/${projectId}/autofill/1`, {
      method: 'POST',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { title: 'x' } }),
    }, ctx.env);
    expect(res.status).toBe(500);

    const after = ctx.db.prepare("SELECT credits FROM users WHERE id='u1'").get() as any;
    expect(after.credits).toBe(before.credits);
  });

  it('retries Step 3 autofill when the AI returns the wrong shape (flat instead of {summary, before, after})', async () => {
    // Real production report: MiniMax returned a flat {know, believe, feel,
    // do} for Step 3's ATR autofill instead of the requested
    // {summary, before:{...}, after:{...}} — syntactically valid JSON, so it
    // wasn't a parse_error, but the frontend's `if (s.before)` guards then
    // silently populated nothing while credits were still charged.
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'gen-1',
        choices: [{ message: { role: 'assistant', content: JSON.stringify({ know: 'a', believe: 'b', feel: 'c', do: 'd' }) }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 30, completion_tokens: 20, total_tokens: 50 },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'gen-2',
        choices: [{ message: { role: 'assistant', content: JSON.stringify({
          summary: 'สรุป', before: { know: 'a', believe: 'b', feel: 'c', do: 'd' }, after: { know: 'a2', believe: 'b2', feel: 'c2', do: 'd2' },
        }) }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 30, completion_tokens: 60, total_tokens: 90 },
      }), { status: 200 }));
    globalThis.fetch = fetchSpy as any;

    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u1')));
    const res = await app.request(`/api/presentation/projects/${projectId}/autofill/3`, {
      method: 'POST',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {} }),
    }, ctx.env);
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const body = await res.json() as any;
    expect(body.suggestion.summary).toBe('สรุป');
    expect(body.suggestion.before).toEqual({ know: 'a', believe: 'b', feel: 'c', do: 'd' });
    expect(body.suggestion.after).toEqual({ know: 'a2', believe: 'b2', feel: 'c2', do: 'd2' });
  });

  it('gives up and refunds in full when Step 3 autofill returns the wrong shape on both attempts', async () => {
    const flatShape = () => new Response(JSON.stringify({
      id: 'gen-x',
      choices: [{ message: { role: 'assistant', content: JSON.stringify({ know: 'a', believe: 'b', feel: 'c', do: 'd' }) }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 30, completion_tokens: 20, total_tokens: 50 },
    }), { status: 200 });
    const fetchSpy = vi.fn(async () => flatShape());
    globalThis.fetch = fetchSpy as any;

    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u1')));
    const before = ctx.db.prepare("SELECT credits FROM users WHERE id='u1'").get() as any;

    const res = await app.request(`/api/presentation/projects/${projectId}/autofill/3`, {
      method: 'POST',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {} }),
    }, ctx.env);
    expect(res.status).toBe(500);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const body = await res.json() as any;
    expect(body.error).toBe('parse_error');

    const after = ctx.db.prepare("SELECT credits FROM users WHERE id='u1'").get() as any;
    expect(after.credits).toBe(before.credits); // fully refunded
  });

  it('rejects when the user lacks enough credits for the reservation, without calling the AI', async () => {
    const fetchSpy = mockMinimaxSuccess(30, 40, {});
    globalThis.fetch = fetchSpy as any;
    const projectId = await createProject(ctx.env, (await authHeadersFor(ctx.env, 'session-u2'))); // u2 has 3 credits
    const res = await app.request(`/api/presentation/projects/${projectId}/autofill/1`, {
      method: 'POST',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u2')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { title: 'x'.repeat(5000) } }), // inflate estimate past 3 credits
    }, ctx.env);
    expect(res.status).toBe(402);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Presentation Builder — PUT step ownership check', () => {
  let ctx: ReturnType<typeof makeEnv>;
  beforeEach(() => { ctx = makeEnv(); });

  it('rejects writing step data to a project owned by a different user', async () => {
    const projectId = await createProject(ctx.env, await authHeadersFor(ctx.env, 'session-u1'));
    const res = await app.request(`/api/presentation/projects/${projectId}/step/7`, {
      method: 'PUT',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u2')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ output: { slides: [{ slide_number: 1, title: 'hijacked' }] } }),
    }, ctx.env);
    expect(res.status).toBe(404);

    const row = ctx.db.prepare('SELECT output_json FROM presentation_steps WHERE project_id = ? AND step_number = 7').get(projectId) as any;
    expect(row).toBeUndefined();
  });

  it('allows the owning user to write step data', async () => {
    const projectId = await createProject(ctx.env, await authHeadersFor(ctx.env, 'session-u1'));
    const res = await app.request(`/api/presentation/projects/${projectId}/step/7`, {
      method: 'PUT',
      headers: { ...(await authHeadersFor(ctx.env, 'session-u1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ output: { slides: [{ slide_number: 1, title: 'ok' }] } }),
    }, ctx.env);
    expect(res.status).toBe(200);
    const row = ctx.db.prepare('SELECT output_json FROM presentation_steps WHERE project_id = ? AND step_number = 7').get(projectId) as any;
    expect(JSON.parse(row.output_json).slides[0].title).toBe('ok');
  });
});

describe('Presentation Builder — GET project includes input_json for input-only steps', () => {
  let ctx: ReturnType<typeof makeEnv>;
  beforeEach(() => { ctx = makeEnv(); });

  it('returns input_json in the steps array, not just output_json', async () => {
    // Step 4 (Source Content) never gets an AI-generated output_json — its
    // data lives entirely in input_json. The frontend's getStepData() falls
    // back to input_json when output_json is null (see the comment on the
    // GET route), so if this SELECT ever drops input_json again, Step 4's
    // saved source content (and Step 1's description/target_slides) would
    // silently vanish on reload with no error — exactly the production bug
    // this test guards against (Step 5 showed "0 source items" for a
    // project that really did have saved source text).
    const headers = await authHeadersFor(ctx.env, 'session-u1');
    const projectId = await createProject(ctx.env, headers);

    await app.request(`/api/presentation/projects/${projectId}/step/4`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { source_text: 'สวัสดี', source_items: [{ title: 'Source 1', content: 'สวัสดี' }] } }),
    }, ctx.env);

    const res = await app.request(`/api/presentation/projects/${projectId}`, {
      method: 'GET',
      headers,
    }, ctx.env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const step4 = body.steps.find((s: any) => s.step_number === 4);
    expect(step4.input_json).toBeTruthy();
    expect(JSON.parse(step4.input_json).source_items).toHaveLength(1);
  });
});
