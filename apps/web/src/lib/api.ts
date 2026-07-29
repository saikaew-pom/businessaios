/**
 * API client for Business Smart OS
 * Uses cookies for auth (HttpOnly)
 */

import { PUBLIC_API_URL } from '$env/static/public';

// =====================================================
// Types
// =====================================================

export type User = {
  id: string;
  email: string;
  name: string | null;
  plan: 'free' | 'pro' | 'team';
};

export type Project = {
  id: string;
  name: string;
  industry?: string | null;
  current_step: number;
  status: 'draft' | 'completed' | 'archived';
  kind?: 'playbook' | 'brand_voice' | 'pain_points' | 'persona';
  created_at: number;
  updated_at: number;
};

export type ProjectWithData = Project & {
  step_data: Record<string, any>;
  locale?: string;
};

export type GenerationResult = {
  ok: boolean;
  step: number;
  output: any;
  meta: {
    model: string;
    duration_ms: number;
    tokens?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    cost_usd: number;
  };
};

export type ExportResult = {
  ok: boolean;
  export_id: string;
  format: string;
  url: string;
  note: string;
};

export type WaitlistResponse = {
  ok: boolean;
  message?: string;
  error?: string;
  duplicate?: boolean;
};

// =====================================================
// Helpers
// =====================================================

async function fetchAPI<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${PUBLIC_API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(err.message || err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// =====================================================
// Waitlist (legacy — for landing page)
// =====================================================

export async function joinWaitlist(data: {
  email: string;
  name?: string;
  source?: string;
  locale: string;
  referrer?: string;
}): Promise<WaitlistResponse> {
  const res = await fetch(`${PUBLIC_API_URL}/api/waitlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// =====================================================
// Auth
// =====================================================

export async function register(email: string, password: string, opts?: { first_name?: string; last_name?: string; name?: string; turnstile_token?: string }) {
  return fetchAPI<{ ok: boolean; user: User }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, ...opts }),
  });
}

export async function login(email: string, password: string, otp?: string, turnstile_token?: string): Promise<{ ok: boolean; require_otp?: boolean; message?: string; user?: User }> {
  return fetchAPI('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, otp, turnstile_token }),
  });
}

export async function logout() {
  return fetchAPI<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}

export async function getMe(): Promise<User | null> {
  try {
    const res = await fetchAPI<{ user: User }>('/api/auth/me');
    return res.user;
  } catch {
    return null;
  }
}

// =====================================================
// Projects
// =====================================================

export async function listProjects(opts: { kind?: string; status?: string } = {}): Promise<Project[]> {
  const params = new URLSearchParams();
  if (opts.kind) params.set('kind', opts.kind);
  if (opts.status) params.set('status', opts.status);
  const qs = params.toString();
  const res = await fetchAPI<{ projects: Project[] }>(`/api/projects${qs ? '?' + qs : ''}`);
  return res.projects;
}

export async function createProject(name: string, industry?: string, kind?: string) {
  return fetchAPI<{ ok: boolean; project: Project }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name, industry, kind }),
  });
}

export async function getProject(id: string): Promise<ProjectWithData> {
  const res = await fetchAPI<{ project: ProjectWithData }>(`/api/projects/${id}`);
  return res.project;
}

export async function updateProject(id: string, data: Partial<{
  name: string;
  industry: string;
  step_data: any;
  current_step: number;
  status: string;
}>) {
  return fetchAPI<{ ok: boolean }>(`/api/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: string, hard: boolean = false) {
  const qs = hard ? '?hard=1' : '';
  return fetchAPI<{ ok: boolean; hard?: boolean }>(`/api/projects/${id}${qs}`, { method: 'DELETE' });
}

export async function restoreProject(id: string) {
  return fetchAPI<{ ok: boolean }>(`/api/projects/${id}/restore`, { method: 'POST' });
}

export async function resetProject(id: string) {
  return fetchAPI<{ ok: boolean }>(`/api/projects/${id}/reset`, { method: 'POST' });
}

// =====================================================
// Generation
// =====================================================

export async function generateStep(
  projectId: string,
  step: number,
  input: any
): Promise<GenerationResult> {
  return fetchAPI<GenerationResult>(`/api/projects/${projectId}/generate/${step}`, {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
}

// =====================================================
// Export
// =====================================================

export async function exportProject(projectId: string): Promise<ExportResult> {
  return fetchAPI<ExportResult>(`/api/projects/${projectId}/export`, { method: 'POST' });
}

export function getExportUrl(exportId: string): string {
  return `${PUBLIC_API_URL}/api/exports/${exportId}`;
}

// =====================================================
// Standalone Tools
// =====================================================

export type ToolResult<T = any> = {
  ok: boolean;
  tool: string;
  output: T;
  meta: {
    model: string;
    duration_ms: number;
    tokens?: any;
    cost_usd: number;
  };
};

export async function runPainGenerator(input: {
  business_name: string;
  business_type: string;
  industry: string;
  target_audience?: string;
}): Promise<ToolResult> {
  return fetchAPI<ToolResult>(`/api/tools/pain-generator`, {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
}

export async function runBrandVoice(input: {
  business_name: string;
  business_type: string;
  industry: string;
  target_audience: string;
  brand_personality?: string;
  tone_keywords?: string;
  dos?: string;
  donts?: string;
}): Promise<ToolResult> {
  return fetchAPI<ToolResult>(`/api/tools/brand-voice`, {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
}

export async function runPersonaBuilder(input: {
  business_name: string;
  business_type: string;
  industry: string;
  location?: string;
  target_age?: string;
  target_job?: string;
  target_income?: string;
  differentiation?: string;
  pain_points?: string;
  context?: string;
}): Promise<ToolResult> {
  return fetchAPI<ToolResult>(`/api/tools/persona-builder`, {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
}

export async function runCompetitorAnalysis(input: {
  business_name: string;
  business_type: string;
  industry: string;
  location?: string;
  target_audience?: string;
  differentiation?: string;
  price_range?: string;
  competitor_mode?: 'manual' | 'auto_find';
  competitor_1?: string;
  competitor_2?: string;
  competitor_3?: string;
  competitor_4?: string;
  competitor_5?: string;
  focus_areas?: string[];
  user_notes?: string;
}): Promise<ToolResult> {
  return fetchAPI<ToolResult>(`/api/tools/competitor-analysis`, {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
}

export async function runJtbdGenerator(input: {
  business_name: string;
  business_type: string;
  industry: string;
  location?: string;
  target_audience?: string;
  differentiation?: string;
  price_range?: string;
  customer_age?: string;
  customer_job?: string;
  customer_income?: string;
  core_problem?: string;
  current_solutions?: string;
  trigger_event?: string;
  known_objections?: string;
  user_notes?: string;
}): Promise<ToolResult> {
  return fetchAPI<ToolResult>(`/api/tools/jtbd-generator`, {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
}

export async function runValuePropositionCanvas(input: {
  business_name: string;
  business_type: string;
  industry: string;
  location?: string;
  target_audience?: string;
  differentiation?: string;
  price_range?: string;
  customer_age?: string;
  customer_job?: string;
  customer_income?: string;
  product_description: string;
  product_features?: string;
  main_problem?: string;
  current_solutions?: string;
  desired_outcome?: string;
  jtbd_context?: string;
  user_notes?: string;
}): Promise<ToolResult> {
  return fetchAPI<ToolResult>(`/api/tools/value-proposition-canvas`, {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
}

export async function runBusinessModelCanvas(input: {
  business_name: string;
  business_type: string;
  industry: string;
  location?: string;
  target_audience?: string;
  differentiation?: string;
  price_range?: string;
  product_description: string;
  product_features?: string;
  revenue_model?: string;
  geographic_scope?: string;
  distribution_model?: string;
  current_stage?: string;
  cost_focus?: string;
  revenue_target?: string;
  team_size?: string;
  vpc_context?: string;
  jtbd_context?: string;
  competitor_context?: string;
  user_notes?: string;
}): Promise<ToolResult> {
  return fetchAPI<ToolResult>(`/api/tools/business-model-canvas`, {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
}

export async function runMillionDollarOffer(input: {
  business_name: string;
  business_type: string;
  industry: string;
  location?: string;
  target_audience?: string;
  differentiation?: string;
  price_range?: string;
  product_description: string;
  product_features?: string;
  offer_type?: string;
  current_price?: string;
  delivery_method?: string;
  current_guarantee?: string;
  dream_outcome_hint?: string;
  biggest_objection?: string;
  current_result_time?: string;
  vpc_context?: string;
  jtbd_context?: string;
  competitor_context?: string;
  user_notes?: string;
}): Promise<ToolResult> {
  return fetchAPI<ToolResult>(`/api/tools/million-dollar-offer`, {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
}

export async function runObjectionHandler(input: {
  business_name: string;
  business_type: string;
  industry: string;
  location?: string;
  target_audience?: string;
  differentiation?: string;
  price_range?: string;
  product_description: string;
  product_features?: string;
  sales_channel?: string;
  known_objection?: string;
  price_position?: string;
  offer_context?: string;
  competitor_context?: string;
  persona_context?: string;
  user_notes?: string;
}): Promise<ToolResult> {
  return fetchAPI<ToolResult>(`/api/tools/objection-handler`, {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
}

export async function runHookLibrary(input: {
  business_name: string;
  business_type: string;
  industry: string;
  location?: string;
  target_audience?: string;
  differentiation?: string;
  price_range?: string;
  product_description: string;
  product_features?: string;
  primary_platform?: string;
  brand_voice?: string;
  campaign_goal?: string;
  top_hook_style?: string;
  offer_context?: string;
  persona_context?: string;
  user_notes?: string;
}): Promise<ToolResult> {
  return fetchAPI<ToolResult>(`/api/tools/hook-library`, {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
}

// =====================================================
// Tool Save / Library
// =====================================================

export type ToolSave = {
  id: string;
  tool_type: 'pain_generator' | 'brand_voice' | 'persona_builder' | 'competitor_analysis' | 'jtbd_generator' | 'value_proposition_canvas' | 'business_model_canvas' | 'million_dollar_offer' | 'objection_handler' | 'hook_library';
  title: string;
  archived: 0 | 1;
  created_at: number;
  updated_at: number;
};

export async function saveToolRun(tool_type: string, input: any, output: any, title?: string) {
  return fetchAPI<{ ok: boolean; id: string }>('/api/tools/save', {
    method: 'POST',
    body: JSON.stringify({ tool_type, input, output, title }),
  });
}

export async function updateToolRun(id: string, data: { title?: string; archived?: boolean; input?: any; output?: any }) {
  return fetchAPI<{ ok: boolean }>(`/api/tools/saved/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function listSavedTools(opts: { archived?: boolean; tool_type?: string } = {}): Promise<ToolSave[]> {
  const params = new URLSearchParams();
  if (opts.archived) params.set('archived', '1');
  if (opts.tool_type) params.set('tool_type', opts.tool_type);
  const res = await fetchAPI<{ saves: ToolSave[] }>(`/api/tools/saved?${params}`);
  return res.saves;
}

export async function getSavedTool(id: string) {
  const res = await fetchAPI<{ save: any }>(`/api/tools/saved/${id}`);
  return res.save;
}

export async function updateSavedTool(id: string, data: { title?: string; archived?: boolean }) {
  return fetchAPI<{ ok: boolean }>(`/api/tools/saved/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteSavedTool(id: string) {
  return fetchAPI<{ ok: boolean }>(`/api/tools/saved/${id}`, { method: 'DELETE' });
}

export async function exportSavedTool(id: string, format: 'md' | 'json' | 'pdf') {
  return fetchAPI<ExportResult>(`/api/tools/saved/${id}/export`, {
    method: 'POST',
    body: JSON.stringify({ format }),
  });
}

// =====================================================
// Profile (v2)
// =====================================================

export type FullUser = {
  id: string;
  email: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  plan: string;
  role: string | null;
  email_verified: 0 | 1;
  two_factor_enabled: 0 | 1;
  credits: number;
  created_at: number;
};

export async function getMeFull(): Promise<FullUser | null> {
  try {
    const res = await fetchAPI<{ user: FullUser }>('/api/auth/me');
    return res.user;
  } catch {
    return null;
  }
}

export async function updateProfile(data: {
  first_name?: string;
  last_name?: string;
  phone?: string;
  name?: string;
}) {
  return fetchAPI<{ ok: boolean }>('/api/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function uploadAvatar(data_url: string) {
  return fetchAPI<{ ok: boolean; avatar_url: string }>('/api/me/avatar', {
    method: 'POST',
    body: JSON.stringify({ data_url }),
  });
}

export async function changePassword(old_password: string, new_password: string) {
  return fetchAPI<{ ok: boolean; message: string }>('/api/me/change-password', {
    method: 'POST',
    body: JSON.stringify({ old_password, new_password }),
  });
}

export async function getCredits() {
  return fetchAPI<{ ok: boolean; balance: number; history: any[] }>('/api/me/credits');
}

export async function toggle2FA(enabled: boolean) {
  return fetchAPI<{ ok: boolean; two_factor_enabled: boolean }>('/api/me/2fa/toggle', {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

// =====================================================
// Email verification + password reset
// =====================================================

export async function sendVerification() {
  return fetchAPI<{ ok: boolean }>('/api/auth/send-verification', { method: 'POST' });
}

export async function verifyEmail(token: string) {
  return fetchAPI<{ ok: boolean }>('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function requestPasswordReset(email: string) {
  return fetchAPI<{ ok: boolean; message: string }>('/api/auth/request-reset', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(email: string, otp: string, new_password: string) {
  return fetchAPI<{ ok: boolean; message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, otp, new_password }),
  });
}

// =====================================================
// BYOK — API Keys
// =====================================================

export type ApiKey = {
  id: string;
  provider: string;
  key_hint: string;
  label: string | null;
  is_active: 0 | 1;
  last_used_at: number | null;
  created_at: number;
};

export async function listApiKeys() {
  return fetchAPI<{ keys: ApiKey[] }>('/api/keys');
}

export async function addApiKey(provider: string, api_key: string, label?: string) {
  return fetchAPI<{ ok: boolean; key: ApiKey }>('/api/keys', {
    method: 'POST',
    body: JSON.stringify({ provider, api_key, label }),
  });
}

export async function updateApiKey(id: string, data: { api_key?: string; label?: string; is_active?: boolean }) {
  return fetchAPI<{ ok: boolean }>(`/api/keys/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteApiKey(id: string) {
  return fetchAPI<{ ok: boolean }>(`/api/keys/${id}`, { method: 'DELETE' });
}

// =====================================================
// Admin
// =====================================================

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  plan: string;
  credits: number;
  email_verified: 0 | 1;
  two_factor_enabled: 0 | 1;
  created_at: number;
};

export type AdminUserListResult = { users: AdminUser[]; total: number; page: number; pageSize: number };

export async function adminListUsers(opts: { q?: string; role?: string; verified?: '0' | '1'; page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  if (opts.role) params.set('role', opts.role);
  if (opts.verified !== undefined) params.set('verified', opts.verified);
  if (opts.page) params.set('page', String(opts.page));
  if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
  const qs = params.toString();
  return fetchAPI<AdminUserListResult>(`/api/admin/users${qs ? '?' + qs : ''}`);
}

export type AdminUserDetail = {
  user: AdminUser & { phone: string | null; avatar_url: string | null; email_verified_at: number | null; locale: string | null; updated_at: number };
  credit_transactions: Array<{ id: string; delta: number; reason: string; reference_id: string | null; balance_after: number | null; note: string | null; created_by: string | null; created_at: number }>;
  projects: Array<{ id: string; name: string; industry: string | null; kind: string | null; status: string; current_step: number; created_at: number; updated_at: number }>;
  tool_runs: Array<{ id: string; tool_name: string; cost_usd: number | null; created_at: number }>;
  generations_summary: { count: number; cost_usd: number };
  payments: Array<{ id: string; package_id: string; credits: number; amount_satang: number; status: string; created_at: number }>;
  admin_actions: Array<{ id: string; action: string; details: string; created_at: number; admin_email: string | null }>;
};

export async function adminGetUserDetail(id: string) {
  return fetchAPI<AdminUserDetail>(`/api/admin/users/${id}`);
}

export async function adminUpdateUser(id: string, data: { role?: string; plan?: string; credits?: number }) {
  return fetchAPI<{ ok: boolean }>(`/api/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function adminChangeCredits(id: string, delta: number, reason: string, note?: string) {
  return fetchAPI<{ ok: boolean; balance: number }>(`/api/admin/users/${id}/credits`, {
    method: 'POST',
    body: JSON.stringify({ delta, reason, note }),
  });
}

export async function adminResendVerification(id: string) {
  return fetchAPI<{ ok: boolean }>(`/api/admin/users/${id}/resend-verification`, { method: 'POST' });
}

export async function adminSendPasswordReset(id: string) {
  return fetchAPI<{ ok: boolean }>(`/api/admin/users/${id}/send-password-reset`, { method: 'POST' });
}

export async function adminAddNote(id: string, text: string) {
  return fetchAPI<{ ok: boolean }>(`/api/admin/users/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function adminGetStats() {
  return fetchAPI<{ ok: boolean; stats: any }>('/api/admin/stats');
}

export async function adminListEmails() {
  return fetchAPI<{ emails: any[] }>('/api/admin/emails');
}

// =====================================================
// MCP (Developers — connect Claude Code / Claude Desktop)
// =====================================================

export type McpToken = {
  id: string;
  token_hint: string;
  label: string | null;
  is_active: 0 | 1;
  last_used_at: number | null;
  created_at: number;
};

export function getMcpServerUrl(): string {
  return `${PUBLIC_API_URL}/mcp`;
}

export async function mcpListTokens() {
  return fetchAPI<{ tokens: McpToken[] }>('/api/mcp/tokens');
}

export async function mcpCreateToken(label?: string) {
  return fetchAPI<{ ok: boolean; id: string; token: string; token_hint: string }>('/api/mcp/tokens', {
    method: 'POST',
    body: JSON.stringify({ label }),
  });
}

export async function mcpRevokeToken(id: string) {
  return fetchAPI<{ ok: boolean }>(`/api/mcp/tokens/${id}`, { method: 'DELETE' });
}

// =====================================================
// Export (multi-format)
// =====================================================

export type ExportFormat = 'html' | 'md' | 'json' | 'csv' | 'doc';

export async function exportProjectFormatted(projectId: string, format: ExportFormat) {
  return fetchAPI<ExportResult>(`/api/projects/${projectId}/export`, {
    method: 'POST',
    body: JSON.stringify({ format }),
  });
}

// =====================================================
// Step Assets (notes + files + links)
// =====================================================

export type StepAsset = {
  id: string;
  kind: 'note' | 'file' | 'link';
  title: string | null;
  content: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  source: string | null;
  source_id: string | null;
  source_meta: any;
  created_at: number;
  updated_at: number;
};

export type ProjectLink = {
  id: string;
  target_kind: 'project' | 'tool_save';
  target_id: string;
  link_purpose: string | null;
  step_number: number;
  created_at: number;
  target?: any;
};

export async function listStepAssets(projectId: string, stepNumber: number) {
  return fetchAPI<{ assets: StepAsset[] }>(`/api/projects/${projectId}/steps/${stepNumber}/assets`);
}

export async function addStepAsset(projectId: string, stepNumber: number, data: {
  kind: 'note' | 'file' | 'link';
  title?: string;
  content?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  source?: string;
  source_id?: string;
  source_meta?: any;
}) {
  return fetchAPI<{ ok: boolean; id: string }>(`/api/projects/${projectId}/steps/${stepNumber}/assets`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateStepAsset(projectId: string, stepNumber: number, assetId: string, data: { title?: string; content?: string }) {
  return fetchAPI<{ ok: boolean }>(`/api/projects/${projectId}/steps/${stepNumber}/assets/${assetId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteStepAsset(projectId: string, stepNumber: number, assetId: string) {
  return fetchAPI<{ ok: boolean }>(`/api/projects/${projectId}/steps/${stepNumber}/assets/${assetId}`, {
    method: 'DELETE',
  });
}

export async function uploadTextFile(projectId: string, stepNumber: number, data: {
  title?: string;
  file_name: string;
  content: string;
  mime_type?: string;
}) {
  return fetchAPI<{ ok: boolean; id: string; size: number }>(`/api/projects/${projectId}/steps/${stepNumber}/upload-text`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listProjectLinks(projectId: string) {
  return fetchAPI<{ links: ProjectLink[] }>(`/api/projects/${projectId}/links`);
}

export async function addProjectLink(projectId: string, data: {
  target_kind: 'project' | 'tool_save';
  target_id: string;
  link_purpose?: string;
  step_number?: number;
}) {
  return fetchAPI<{ ok: boolean; link_id: string }>(`/api/projects/${projectId}/links`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteProjectLink(projectId: string, linkId: string) {
  return fetchAPI<{ ok: boolean }>(`/api/projects/${projectId}/links/${linkId}`, {
    method: 'DELETE',
  });
}

// =====================================================
// Tool → Project promotion
// =====================================================

export async function promoteToolToProject(toolSaveId: string, targetKind: 'playbook' | 'native' = 'playbook') {
  return fetchAPI<{ ok: boolean; project_id: string; kind: string; target_kind: string; steps_imported: string[] }>(`/api/tools/saved/${toolSaveId}/promote`, {
    method: 'POST',
    body: JSON.stringify({ target_kind: targetKind }),
  });
}

// =====================================================
// Presentation Tool API
// =====================================================

export type PresentationProject = {
  id: string;
  title: string;
  objective: 'informative' | 'persuasive' | 'story';
  target_slides: number;
  time_minutes: number;
  color_theme: string;
  status: 'draft' | 'completed' | 'archived';
  current_step: number;
  framework_variant?: string;
  steps_completed?: number;
  created_at: number;
  updated_at: number;
};

export type PresentationStep = {
  step_number: number;
  status: 'pending' | 'generating' | 'done' | 'error';
  framework_variant?: string;
  output_json?: any;
  custom_system_prompt?: string;
  updated_at: number;
};

export type PresentationGenerateResult = {
  ok: boolean;
  step: number;
  output: any;
  meta: {
    duration_ms: number;
    tokens?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    cost_usd: number;
    credits_used: number;
    credits_remaining: number;
  };
};

export async function getPresentationPresets() {
  return fetchAPI<{
    color_themes: any[];
    objectives: any[];
    communication_styles: any[];
    audience_concerns: any[];
    slide_types: any[];
    layout_patterns: any[];
    chart_types: any[];
    step_names: Record<number, string>;
    step_credit_costs: Record<number, number>;
  }>('/api/presentation/presets');
}

export async function listPresentationProjects(status: string = 'draft') {
  return fetchAPI<{ projects: PresentationProject[] }>(`/api/presentation/projects?status=${status}`);
}

export async function getPresentationProject(id: string) {
  return fetchAPI<{ project: any; steps: PresentationStep[] }>(`/api/presentation/projects/${id}`);
}

export async function createPresentationProject(data: {
  title: string;
  objective: 'informative' | 'persuasive' | 'story';
  target_slides?: number;
  time_minutes?: number;
  language?: 'th' | 'en';
  color_theme?: string;
}) {
  return fetchAPI<{ ok: boolean; project: any }>('/api/presentation/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePresentationProject(id: string, data: any) {
  return fetchAPI<{ ok: boolean }>(`/api/presentation/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deletePresentationProject(id: string) {
  return fetchAPI<{ ok: boolean }>(`/api/presentation/projects/${id}`, {
    method: 'DELETE',
  });
}

export async function generatePresentationStep(id: string, step: number, input: any, customSystemPrompt?: string) {
  return fetchAPI<PresentationGenerateResult>(`/api/presentation/projects/${id}/generate/${step}`, {
    method: 'POST',
    body: JSON.stringify({ input, custom_system_prompt: customSystemPrompt }),
  });
}

export async function savePresentationStepInput(id: string, step: number, data: { input?: any; output?: any; custom_system_prompt?: string }) {
  return fetchAPI<{ ok: boolean }>(`/api/presentation/projects/${id}/step/${step}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function exportPresentation(id: string, format: 'html' | 'md' | 'json' | 'csv' | 'pptx' | 'gsheet') {
  return fetchAPI<{ ok: boolean; export_id: string; format: string; url: string; size: number; note: string }>(
    `/api/presentation/projects/${id}/export`,
    {
      method: 'POST',
      body: JSON.stringify({ format }),
    }
  );
}

// =====================================================
// Payments (Stripe PromptPay)
// =====================================================

export type CreditPackage = {
  id: string;
  name: string;
  tagline: string;
  credits: number;
  price_thb: number;
  price_satang: number;
  per_credit_thb: number;
  best_for: string;
  popular?: boolean;
  save_pct?: number;
  stripe_lookup_key: string;
};

export type CreateIntentResult = {
  mode: 'live' | 'mock';
  package: CreditPackage;
  payment_intent_id: string;
  client_secret: string;
  next_action?: any;
  message?: string;
};

export type PaymentHistoryItem = {
  id: string;
  package_id: string;
  credits: number;
  amount_satang: number;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  created_at: number;
};

export async function listPackages(): Promise<{ packages: CreditPackage[]; signup_bonus: number; currency: string }> {
  return fetchAPI('/api/payments/packages');
}

export async function createTopupIntent(packageId: string): Promise<CreateIntentResult> {
  return fetchAPI<CreateIntentResult>('/api/payments/create-intent', {
    method: 'POST',
    body: JSON.stringify({ package_id: packageId }),
  });
}

export async function getPaymentStatus(paymentIntentId: string): Promise<{ status: string; credits_added?: number; package_id?: string }> {
  return fetchAPI(`/api/payments/status/${paymentIntentId}`);
}

export async function getPaymentHistory(): Promise<{ payments: PaymentHistoryItem[] }> {
  return fetchAPI('/api/payments/history');
}

export async function devMockSuccess(packageId: string): Promise<{ success: boolean; credits_added: number; new_balance: number }> {
  return fetchAPI('/api/payments/dev-mock-success', {
    method: 'POST',
    body: JSON.stringify({ package_id: packageId }),
  });
}
