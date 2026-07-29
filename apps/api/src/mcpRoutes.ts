/**
 * MCP server (Phase D) — lets Claude Code / Claude Desktop / any MCP client
 * drive Business Smart OS on a user's behalf: create/list projects, generate
 * steps, run the 10 standalone tools, export, and check credits.
 *
 * Two auth models share this file:
 *  - Token management endpoints (`/api/mcp/tokens`) use the normal session
 *    cookie (`requireAuth`) — a logged-in user manages their own tokens.
 *  - The MCP JSON-RPC endpoint (`/mcp`) uses a personal access token in
 *    `Authorization: Bearer <token>`, looked up by hash in `mcp_tokens`.
 *    There is no session/SSE state kept between calls — every request is
 *    authenticated and dispatched independently (MCP's "stateless
 *    Streamable HTTP" mode), which fits a Workers request/response model
 *    far better than a long-lived connection would.
 *
 * Every MCP tool call is dispatched to the EXISTING REST handler
 * (`app.request(...)`) rather than re-implementing project/credit/AI logic
 * a second time — the credit-reservation and email-verification-gate logic
 * in those handlers is exactly the kind of copy-pasted block that already
 * caused real bugs this session (see docs/AUDIT.md), so a third copy here
 * would just be a third place for it to drift. To call through
 * `requireAuth` (which only reads a session, not an MCP token) we mint a
 * short-lived (60s) internal session row for the resolved user, use it as
 * the Bearer token for the internal call, then delete it immediately.
 */
import type { Hono } from 'hono';
import { requireAuth } from './lib/middleware';
import { generateId, generateToken, generateSessionToken, hashToken } from './lib/crypto';
import type { Bindings, Variables } from './lib/types';

const TOOL_SLUGS = [
  'pain-generator', 'brand-voice', 'persona-builder', 'competitor-analysis',
  'jtbd-generator', 'value-proposition-canvas', 'business-model-canvas',
  'million-dollar-offer', 'objection-handler', 'hook-library',
] as const;

const MCP_TOOLS = [
  {
    name: 'list_projects',
    description: "List the caller's business plans (projects). Each project is a 7-step marketing playbook, or a single-purpose plan (brand_voice/pain_points/persona).",
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['playbook', 'brand_voice', 'pain_points', 'persona'], description: 'Filter by project kind' },
        status: { type: 'string', enum: ['draft', 'completed', 'archived'], description: 'Filter by status' },
      },
    },
  },
  {
    name: 'create_project',
    description: 'Create a new business plan (project). Returns the created project, including its id — needed for generate_step and get_export.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', description: 'Project / business name' },
        industry: { type: 'string' },
        kind: { type: 'string', enum: ['playbook', 'brand_voice', 'pain_points', 'persona'], default: 'playbook' },
      },
    },
  },
  {
    name: 'generate_step',
    description: 'Generate one of the 7 steps of a business plan with the AI engine (spends credits).',
    inputSchema: {
      type: 'object',
      required: ['project_id', 'step', 'input'],
      properties: {
        project_id: { type: 'string' },
        step: { type: 'integer', minimum: 1, maximum: 7 },
        input: { type: 'object', description: 'Step-specific input fields (varies by project kind and step number)' },
      },
    },
  },
  {
    name: 'run_tool',
    description: 'Run one of the 10 standalone strategy tools (pain generator, brand voice, persona builder, competitor analysis, JTBD, value proposition canvas, business model canvas, million dollar offer, objection handler, hook library). Spends credits.',
    inputSchema: {
      type: 'object',
      required: ['tool_name', 'input'],
      properties: {
        tool_name: { type: 'string', enum: [...TOOL_SLUGS] },
        input: { type: 'object', description: 'business_name, business_type, industry, plus tool-specific fields' },
      },
    },
  },
  {
    name: 'get_export',
    description: 'Export a project to a downloadable file and return its URL.',
    inputSchema: {
      type: 'object',
      required: ['project_id'],
      properties: {
        project_id: { type: 'string' },
        format: { type: 'string', enum: ['html', 'md', 'json', 'csv', 'doc'], default: 'html' },
      },
    },
  },
  {
    name: 'check_credits',
    description: "Check the caller's remaining credit balance and recent credit history.",
    inputSchema: { type: 'object', properties: {} },
  },
] as const;

type JsonRpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: any };

function rpcResult(id: string | number | null | undefined, result: any) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}
function rpcError(id: string | number | null | undefined, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

async function authenticateMcpToken(env: Bindings, authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const raw = authHeader.slice(7).trim();
  if (!raw) return null;
  const hash = await hashToken(raw);
  const row = await env.DB.prepare(
    "SELECT id, user_id FROM mcp_tokens WHERE token_hash = ? AND is_active = 1"
  ).bind(hash).first<{ id: string; user_id: string }>();
  if (!row) return null;
  // Best-effort — a failed usage-timestamp update must never block the actual call.
  env.DB.prepare('UPDATE mcp_tokens SET last_used_at = ? WHERE id = ?').bind(Date.now(), row.id).run().catch(() => {});
  return row.user_id;
}

/**
 * Dispatch to an existing REST handler in-process, as the given user, via a
 * short-lived internal session.
 *
 * `clientIp` forwards the *original* MCP caller's `cf-connecting-ip` onto the
 * internal request. Without this, the synthetic Request built by
 * `app.request()` never carries a `cf-connecting-ip` header — that header is
 * only ever stamped by Cloudflare's edge onto requests that actually arrive
 * over the wire, not onto in-process sub-requests. Several downstream
 * handlers (`/api/tools/:tool_name`, `/api/projects/:id/generate/:step`) run
 * `rateLimit`, which buckets purely on `cf-connecting-ip` and falls back to
 * the literal string `'unknown'` when it's absent. Without forwarding,
 * *every* MCP-driven generate/run_tool call — from every user, for every
 * project — would collide into that single shared `'unknown'` bucket
 * (capped at 30 req/min system-wide), instead of each caller getting their
 * own per-IP allowance like a direct REST caller does. That turns a per-IP
 * rate limit into an accidental global one an MCP user could exhaust to
 * lock out every other MCP user. Forwarding restores one bucket per real
 * client IP, matching direct REST behavior.
 */
async function callInternal(
  app: Hono<{ Bindings: Bindings; Variables: Variables }>,
  env: Bindings,
  userId: string,
  path: string,
  init: RequestInit = {},
  clientIp?: string | null
): Promise<{ status: number; json: any }> {
  const tempToken = generateSessionToken();
  const expiresAt = Date.now() + 60_000; // 60s — long enough for one internal call, short enough to bound the blast radius if cleanup below is skipped
  await env.DB.prepare(`
    INSERT INTO sessions (id, user_id, expires_at, created_at, user_agent, ip)
    VALUES (?, ?, ?, ?, 'mcp-internal', 'internal')
  `).bind(tempToken, userId, expiresAt, Date.now()).run();

  try {
    const res = await app.request(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tempToken}`,
        ...(clientIp ? { 'cf-connecting-ip': clientIp } : {}),
        ...(init.headers || {}),
      },
    }, env);
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  } finally {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(tempToken).run().catch(() => {});
  }
}

async function callTool(
  app: Hono<{ Bindings: Bindings; Variables: Variables }>,
  env: Bindings,
  userId: string,
  name: string,
  args: any,
  clientIp?: string | null
): Promise<{ status: number; json: any }> {
  args = args || {};
  switch (name) {
    case 'list_projects': {
      const params = new URLSearchParams();
      if (args.kind) params.set('kind', args.kind);
      if (args.status) params.set('status', args.status);
      const qs = params.toString();
      return callInternal(app, env, userId, `/api/projects${qs ? '?' + qs : ''}`, {}, clientIp);
    }
    case 'create_project':
      return callInternal(app, env, userId, '/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: args.name, industry: args.industry, kind: args.kind }),
      }, clientIp);
    case 'generate_step': {
      if (!args.project_id || !args.step) {
        return { status: 400, json: { error: 'missing_fields', message: 'project_id and step are required' } };
      }
      return callInternal(app, env, userId, `/api/projects/${args.project_id}/generate/${args.step}`, {
        method: 'POST',
        body: JSON.stringify({ input: args.input || {} }),
      }, clientIp);
    }
    case 'run_tool': {
      if (!TOOL_SLUGS.includes(args.tool_name)) {
        return { status: 400, json: { error: 'unknown_tool', message: `tool_name must be one of: ${TOOL_SLUGS.join(', ')}` } };
      }
      return callInternal(app, env, userId, `/api/tools/${args.tool_name}`, {
        method: 'POST',
        body: JSON.stringify({ input: args.input || {} }),
      }, clientIp);
    }
    case 'get_export': {
      if (!args.project_id) {
        return { status: 400, json: { error: 'missing_fields', message: 'project_id is required' } };
      }
      return callInternal(app, env, userId, `/api/projects/${args.project_id}/export`, {
        method: 'POST',
        body: JSON.stringify({ format: args.format || 'html' }),
      }, clientIp);
    }
    case 'check_credits':
      return callInternal(app, env, userId, '/api/me/credits', {}, clientIp);
    default:
      return { status: 400, json: { error: 'unknown_tool', message: `Unknown tool: ${name}` } };
  }
}

export function createMcpRoutes(app: Hono<{ Bindings: Bindings; Variables: Variables }>) {

// =====================================================
// Token management (session-auth — a user manages their own tokens)
// =====================================================

app.get('/api/mcp/tokens', requireAuth, async (c) => {
  const user = c.get('user')!;
  const rows = await c.env.DB.prepare(`
    SELECT id, token_hint, label, is_active, last_used_at, created_at
    FROM mcp_tokens WHERE user_id = ? ORDER BY created_at DESC
  `).bind(user.id).all();
  return c.json({ tokens: rows.results || [] });
});

app.post('/api/mcp/tokens', requireAuth, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<{ label?: string }>().catch(() => ({} as { label?: string }));

  const raw = `bsos_mcp_${generateToken(32)}`;
  const hash = await hashToken(raw);
  const id = generateId();
  const hint = raw.slice(-4);

  await c.env.DB.prepare(`
    INSERT INTO mcp_tokens (id, user_id, token_hash, token_hint, label, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).bind(id, user.id, hash, hint, body.label || null, Date.now()).run();

  // The raw token is returned exactly once — only its hash is ever stored.
  return c.json({ ok: true, id, token: raw, token_hint: hint });
});

app.delete('/api/mcp/tokens/:id', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  await c.env.DB.prepare(
    'UPDATE mcp_tokens SET is_active = 0, revoked_at = ? WHERE id = ? AND user_id = ?'
  ).bind(Date.now(), id, user.id).run();
  return c.json({ ok: true });
});

// =====================================================
// MCP protocol endpoint (token-auth — no session/cookie involved)
// =====================================================

app.post('/mcp', async (c) => {
  const userId = await authenticateMcpToken(c.env, c.req.header('Authorization') || null);

  let body: JsonRpcRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json(rpcError(null, -32700, 'Parse error'), 400);
  }

  const { id, method, params } = body;
  const isNotification = id === undefined;

  if (!userId) {
    if (isNotification) return c.body(null, 202);
    c.header('WWW-Authenticate', 'Bearer');
    return c.json(rpcError(id, -32001, 'Unauthorized — invalid or missing MCP token'), 401);
  }

  if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
    return c.body(null, 202);
  }

  if (method === 'initialize') {
    return c.json(rpcResult(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'business-smart-os', version: '1.0.0' },
    }));
  }

  if (method === 'ping') {
    return c.json(rpcResult(id, {}));
  }

  if (method === 'tools/list') {
    return c.json(rpcResult(id, { tools: MCP_TOOLS }));
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const clientIp = c.req.header('cf-connecting-ip');
    const { status, json } = await callTool(app, c.env, userId, toolName, params?.arguments, clientIp);
    const isError = status < 200 || status >= 300;
    // get_export returns a relative URL (the web frontend prepends its own
    // known API origin) — an MCP caller has no equivalent, so resolve it
    // against this request's own origin before handing it back.
    if (toolName === 'get_export' && !isError && typeof json.download_url === 'string') {
      const origin = new URL(c.req.url).origin;
      json.download_url = `${origin}${json.download_url}`;
      json.url = `${origin}${json.url}`;
    }
    return c.json(rpcResult(id, {
      content: [{ type: 'text', text: JSON.stringify(json) }],
      isError,
    }));
  }

  if (isNotification) return c.body(null, 202);
  return c.json(rpcError(id, -32601, `Method not found: ${method}`));
});

}
