/**
 * API client for Business Smart OS
 * Uses cookies for auth (HttpOnly)
 */

import { PUBLIC_API_URL } from '$env/static/public';
import { getCsrfToken } from './config';

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
  download_url?: string;
  note: string;
};

export type WaitlistResponse = {
  ok: boolean;
  message?: string;
  error?: string;
  duplicate?: boolean;
};

export type MediaModel = {
  id: string;
  provider: string;
  display_name: string;
  model_type: 'image';
  operation: 'text_to_image' | 'image_to_image';
  capabilities: {
    aspectRatios?: string[];
    outputFormats?: string[];
    maxOutputCount?: number;
    references?: {
      min?: number;
      max?: number;
      roles?: string[];
      providerTypes?: string[];
      disabledProviderTypes?: string[];
    };
  };
  pricing: {
    unit?: string;
    credits_per_output?: number;
    minimum_credits?: number;
    billing_unit?: string;
    release?: string;
  };
  pricing_version: string;
  config_version: number;
  is_maintenance: boolean;
};

export type MediaAsset = {
  id: string;
  asset_type: 'image' | 'product' | 'logo' | 'font' | 'mask' | 'thumbnail' | string;
  source: 'upload' | 'generation' | string;
  original_filename: string | null;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  metadata: Record<string, any>;
  favorite: boolean;
  lifecycle_status: string;
  checksum_sha256: string | null;
  created_at: number;
  updated_at: number;
  provider_url?: string;
};

export type MediaReferenceInput = {
  asset_id: string;
  mention_name: string;
  reference_role?: string;
  influence_level?: 'low' | 'balanced' | 'high' | string;
  sort_order?: number;
};

export type MediaPricingQuote = {
  id: string;
  quote_id?: string;
  model_id: string;
  credits: number;
  currency_note?: string;
  capability_warnings?: string[];
  pricing_version: string;
  request_hash: string;
  expires_at: number;
};

export type MediaGeneration = {
  id: string;
  model_id: string;
  operation: 'text_to_image' | 'image_to_image';
  prompt: string;
  options: Record<string, any>;
  status: 'queued' | 'submitting' | 'processing' | 'delivery_pending' | 'completed' | 'failed' | 'cancel_requested' | 'cancelled' | string;
  submission_state: string;
  delivery_status: string;
  estimated_credits: number;
  final_credits: number | null;
  pricing_version: string;
  expected_output_count: number;
  delivered_output_count: number;
  error_code: string | null;
  error_message: string | null;
  brand_profile_id: string | null;
  brand_snapshot_id: string | null;
  outputs: MediaAsset[];
  created_at: number;
  updated_at: number;
  completed_at: number | null;
};

export type ContentItem = {
  id: string;
  user_id: string;
  project_id: string | null;
  project_name?: string | null;
  source_type: string;
  source_id: string | null;
  source_hash: string | null;
  title: string;
  platform: string;
  format: string;
  pillar: string;
  hook: string;
  caption: string;
  cta: string;
  hashtags: string[];
  visual_suggestion: string;
  expected_engagement: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'scheduled' | 'published' | 'archived' | string;
  scheduled_at: number | null;
  timezone: string | null;
  approved_at: number | null;
  rejected_at: number | null;
  rejection_reason: string | null;
  published_ack_at: number | null;
  manual_publish_url: string | null;
  metadata: Record<string, any>;
  primary_asset_id?: string | null;
  created_at: number;
  updated_at: number;
};

export type BrandKit = {
  id: string;
  project_id: string | null;
  name: string;
  colors: any[];
  typography: Record<string, any>;
  rules: Record<string, any>;
  is_default: boolean;
  lifecycle_status: 'active' | 'archived' | string;
  brandbook_status: 'draft' | 'reviewed' | 'published' | string;
  default_language: 'th' | 'en' | 'th-en' | string;
  asset_count?: number;
  archived_at?: number | null;
  deleted_at?: number | null;
  created_at: number;
  updated_at: number;
};

export type BrandKitAsset = {
  id: string;
  brand_kit_id: string;
  asset_id: string;
  role: string;
  license_confirmed: boolean;
  license_note: string | null;
  metadata: Record<string, any>;
  original_filename?: string | null;
  asset_type?: string;
  mime_type?: string;
  created_at: number;
  updated_at: number;
};

export type SocialAccount = {
  id: string;
  project_id: string | null;
  provider: string;
  provider_account_id: string;
  display_name: string;
  metadata: Record<string, any>;
  scopes: string[];
  connection_status: string;
  created_at: number;
  updated_at: number;
};

// =====================================================
// Helpers
// =====================================================

async function fetchAPI<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = await getCsrfToken();
    if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  }

  const res = await fetch(`${PUBLIC_API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
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
// Creative Studio Media API
// =====================================================

export async function listMediaModels(): Promise<MediaModel[]> {
  const res = await fetchAPI<{ models: MediaModel[] }>('/api/media/models');
  return res.models;
}

export async function previewMediaPricing(input: {
  model_id: string;
  operation?: string;
  options?: Record<string, unknown>;
  reference_count?: number;
}): Promise<MediaPricingQuote> {
  const quote = await fetchAPI<MediaPricingQuote>('/api/media/pricing/preview', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return {
    ...quote,
    id: quote.id || quote.quote_id || '',
  };
}

export async function listMediaAssets(): Promise<MediaAsset[]> {
  const res = await fetchAPI<{ assets: MediaAsset[] }>('/api/media/assets');
  return res.assets;
}

export async function createMediaUploadIntent(file: File, assetType = 'image') {
  return fetchAPI<{
    intent_id: string;
    asset_id: string;
    upload_token: string;
    upload_url: string;
    expires_at: number;
    max_bytes: number;
  }>('/api/media/assets/upload-intents', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      mime_type: mimeTypeForFile(file),
      file_size: file.size,
      asset_type: assetType,
    }),
  });
}

export async function createMediaUploadIntentWithMetadata(file: File, data: {
  filename?: string;
  asset_type?: string;
  tags?: string[];
}) {
  return fetchAPI<{
    intent_id: string;
    asset_id: string;
    upload_token: string;
    upload_url: string;
    expires_at: number;
    max_bytes: number;
  }>('/api/media/assets/upload-intents', {
    method: 'POST',
    body: JSON.stringify({
      filename: data.filename || file.name,
      mime_type: mimeTypeForFile(file),
      file_size: file.size,
      asset_type: data.asset_type || 'image',
      tags: data.tags || [],
    }),
  });
}

export async function finalizeMediaUpload(assetId: string): Promise<MediaAsset> {
  return fetchAPI<MediaAsset>(`/api/media/assets/${assetId}/finalize-upload`, {
    method: 'POST',
  });
}

export async function uploadMediaAsset(file: File, assetType = 'image'): Promise<MediaAsset> {
  const intent = await createMediaUploadIntent(file, assetType);
  return uploadMediaAssetWithIntent(file, intent);
}

export async function uploadMediaAssetWithMetadata(file: File, data: {
  filename?: string;
  asset_type?: string;
  tags?: string[];
}): Promise<MediaAsset> {
  const intent = await createMediaUploadIntentWithMetadata(file, data);
  return uploadMediaAssetWithIntent(file, intent);
}

async function uploadMediaAssetWithIntent(file: File, intent: {
  upload_token: string;
  upload_url: string;
  asset_id: string;
}): Promise<MediaAsset> {
  const headers = new Headers({
    'Content-Type': mimeTypeForFile(file),
    'X-Upload-Token': intent.upload_token,
  });
  const csrfToken = await getCsrfToken();
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken);

  const uploadRes = await fetch(`${PUBLIC_API_URL}${intent.upload_url}`, {
    method: 'PUT',
    credentials: 'include',
    headers,
    body: file,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({ message: `HTTP ${uploadRes.status}` }));
    throw new Error(err.message || err.error || `HTTP ${uploadRes.status}`);
  }

  return finalizeMediaUpload(intent.asset_id);
}

function mimeTypeForFile(file: File) {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.ttf')) return 'font/ttf';
  if (name.endsWith('.otf')) return 'font/otf';
  if (name.endsWith('.woff2')) return 'font/woff2';
  if (name.endsWith('.woff')) return 'font/woff';
  return 'application/octet-stream';
}

export async function validateMediaReferences(input: {
  model_id: string;
  prompt: string;
  references: MediaReferenceInput[];
}) {
  return fetchAPI<{
    model_id: string;
    operation: string;
    prompt_mentions: string[];
    references: MediaReferenceInput[];
    warnings: string[];
  }>('/api/media/references/validate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function createMediaGeneration(input: {
  model_id: string;
  prompt: string;
  options: Record<string, unknown>;
  references: MediaReferenceInput[];
  quote_id: string;
  expected_pricing_version: string;
  brand_profile_id?: string | null;
  creative_request_id?: string | null;
}, idempotencyKey: string) {
  return fetchAPI<{
    generation: MediaGeneration;
    credits_remaining?: number;
    idempotent: boolean;
  }>('/api/media/generations', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
}

export async function listMediaGenerations(): Promise<MediaGeneration[]> {
  const res = await fetchAPI<{ generations: MediaGeneration[] }>('/api/media/generations');
  return res.generations;
}

export async function getMediaGeneration(id: string): Promise<MediaGeneration> {
  const res = await fetchAPI<{ generation: MediaGeneration }>(`/api/media/generations/${id}`);
  return res.generation;
}

export async function cancelMediaGeneration(id: string): Promise<MediaGeneration> {
  const res = await fetchAPI<{ generation: MediaGeneration }>(`/api/media/generations/${id}/cancel`, {
    method: 'POST',
  });
  return res.generation;
}

export async function updateMediaAsset(id: string, data: { original_filename?: string; lifecycle_status?: string; asset_type?: string; tags?: string[] }) {
  return fetchAPI<MediaAsset>(`/api/media/assets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function favoriteMediaAsset(id: string, favorite = true) {
  return fetchAPI<MediaAsset>(`/api/media/assets/${id}/favorite`, {
    method: 'POST',
    body: JSON.stringify({ favorite }),
  });
}

export async function deleteMediaAsset(id: string) {
  return fetchAPI<{ ok: boolean }>(`/api/media/assets/${id}`, { method: 'DELETE' });
}

export function getMediaAssetContentUrl(assetId: string): string {
  return `${PUBLIC_API_URL}/api/media/assets/${assetId}/content`;
}

// =====================================================
// Creative Content Workspace API
// =====================================================

export async function listContentItems(opts: {
  status?: string;
  project_id?: string;
  limit?: number;
  scheduled_from?: number;
  scheduled_to?: number;
} = {}): Promise<ContentItem[]> {
  const params = new URLSearchParams();
  Object.entries(opts).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  const res = await fetchAPI<{ items: ContentItem[] }>(`/api/content-items${qs ? `?${qs}` : ''}`);
  return res.items;
}

export async function getContentItem(id: string): Promise<ContentItem> {
  const res = await fetchAPI<{ item: ContentItem }>(`/api/content-items/${id}`);
  return res.item;
}

export async function materializeStep5ContentItems(projectId: string): Promise<{ materialized: number; items: ContentItem[] }> {
  return fetchAPI(`/api/projects/${projectId}/content-items/materialize-step5`, { method: 'POST' });
}

export async function transitionContentItem(id: string, data: {
  action: 'approve' | 'reject' | 'schedule' | 'reschedule' | 'unschedule' | 'revert_to_draft' | 'manual_publish_ack' | 'archive';
  reason?: string;
  scheduled_at?: number | null;
  timezone?: string;
  manual_publish_url?: string;
}): Promise<ContentItem> {
  const res = await fetchAPI<{ item: ContentItem }>(`/api/content-items/${id}/transition`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.item;
}

export async function updateContentItem(id: string, fields: {
  title?: string;
  platform?: string;
  format?: string;
  pillar?: string;
  hook?: string;
  caption?: string;
  cta?: string;
  visual_suggestion?: string;
  expected_engagement?: string;
  hashtags?: string[];
}): Promise<ContentItem> {
  const res = await fetchAPI<{ item: ContentItem }>(`/api/content-items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
  return res.item;
}

export type RegenerableContentField = 'hook' | 'caption' | 'cta' | 'hashtags' | 'visual_suggestion';

export async function regenerateContentItemField(id: string, data: {
  field: RegenerableContentField;
  context: {
    title?: string;
    platform?: string;
    format?: string;
    pillar?: string;
    hook?: string;
    caption?: string;
    cta?: string;
    hashtags?: string[];
    visual_suggestion?: string;
  };
}): Promise<{ ok: boolean; field: RegenerableContentField; value: string | string[]; credits_remaining: number }> {
  return fetchAPI(`/api/content-items/${id}/regenerate-field`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function attachContentItemAsset(id: string, data: {
  asset_id: string;
  link_role?: string;
  is_primary?: boolean;
}) {
  return fetchAPI<{ ok: boolean; link_id: string }>(`/api/content-items/${id}/assets`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createContentItemCreativeRequest(id: string) {
  return fetchAPI<{ ok: boolean; creative_request_id: string; brief: Record<string, any> }>(`/api/content-items/${id}/creative-requests`, {
    method: 'POST',
  });
}

export async function fulfillCreativeRequest(requestId: string, assetId: string) {
  return fetchAPI<{ ok: boolean; link_id: string; content_item: ContentItem; return_route: string }>(
    `/api/creative-requests/${requestId}/fulfill`,
    { method: 'POST', body: JSON.stringify({ asset_id: assetId }) },
  );
}

// =====================================================
// Brand Kit / Composition API
// =====================================================

export async function listBrandKits(status: 'active' | 'archived' | 'all' = 'active'): Promise<BrandKit[]> {
  const res = await fetchAPI<{ brand_kits: BrandKit[] }>(`/api/brand-kits?status=${encodeURIComponent(status)}`);
  return res.brand_kits;
}

export async function getBrandKit(id: string): Promise<{ brand_kit: BrandKit; assets: BrandKitAsset[] }> {
  return fetchAPI<{ brand_kit: BrandKit; assets: BrandKitAsset[] }>(`/api/brand-kits/${id}`);
}

export async function createBrandKit(data: {
  name: string;
  project_id?: string | null;
  colors?: any[];
  typography?: Record<string, any>;
  rules?: Record<string, any>;
  is_default?: boolean;
  default_language?: string;
  brandbook_status?: string;
}) {
  const res = await fetchAPI<{ brand_kit: BrandKit }>('/api/brand-kits', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.brand_kit;
}

export async function updateBrandKit(id: string, data: Partial<{
  name: string;
  colors: any[];
  typography: Record<string, any>;
  rules: Record<string, any>;
  is_default: boolean;
  default_language: string;
  brandbook_status: string;
}>) {
  const res = await fetchAPI<{ brand_kit: BrandKit }>(`/api/brand-kits/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.brand_kit;
}

export async function setDefaultBrandKit(id: string) {
  const res = await fetchAPI<{ brand_kit: BrandKit }>(`/api/brand-kits/${id}/default`, { method: 'POST' });
  return res.brand_kit;
}

export async function archiveBrandKit(id: string) {
  const res = await fetchAPI<{ brand_kit: BrandKit }>(`/api/brand-kits/${id}/archive`, { method: 'POST' });
  return res.brand_kit;
}

export async function restoreBrandKit(id: string) {
  const res = await fetchAPI<{ brand_kit: BrandKit }>(`/api/brand-kits/${id}/restore`, { method: 'POST' });
  return res.brand_kit;
}

export async function deleteBrandKit(id: string) {
  return fetchAPI<{ ok: boolean }>(`/api/brand-kits/${id}`, { method: 'DELETE' });
}

export async function attachBrandKitAsset(id: string, data: {
  asset_id: string;
  role?: string;
  license_confirmed?: boolean;
  license_note?: string;
  metadata?: Record<string, any>;
}) {
  return fetchAPI<{ ok: boolean; asset_link_id: string }>(`/api/brand-kits/${id}/assets`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function detachBrandKitAsset(id: string, assetLinkId: string) {
  return fetchAPI<{ ok: boolean }>(`/api/brand-kits/${id}/assets/${assetLinkId}`, { method: 'DELETE' });
}

export async function exportBrandKitPdf(id: string, data: { language?: string } = {}) {
  return fetchAPI<{
    ok: boolean;
    export_id: string;
    format: string;
    language: string;
    url: string;
    download_url: string;
  }>(`/api/brand-kits/${id}/export/pdf`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function generateBrandKitSmartWriting(id: string, data: {
  brandbook: Record<string, any>;
  language?: string;
  mode?: string;
}) {
  return fetchAPI<{
    ok: boolean;
    output: Record<string, any>;
    meta: {
      model: string;
      duration_ms: number;
      tokens?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      cost_usd: number;
      credits_used: number;
      credits_remaining: number;
    };
  }>(`/api/brand-kits/${id}/smart-writing`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// =====================================================
// Social Publishing API
// =====================================================

export async function getSocialCapabilities() {
  return fetchAPI<{
    mode: string;
    direct_publishing_ready: boolean;
    providers: Array<{ id: string; label: string; configured: boolean; direct_publish_enabled: boolean; required_scopes: string[]; setup_state: string }>;
    note: string;
  }>('/api/social/capabilities');
}

export async function listSocialAccounts(): Promise<SocialAccount[]> {
  const res = await fetchAPI<{ accounts: SocialAccount[] }>('/api/social/accounts');
  return res.accounts;
}

export async function createManualSocialAccount(data: {
  provider: string;
  display_name: string;
  provider_account_id?: string;
  project_id?: string | null;
}) {
  return fetchAPI<{ ok: boolean }>('/api/social/accounts/manual', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createSocialPublication(data: {
  content_item_id: string;
  social_account_id: string;
  scheduled_at?: number | null;
  timezone?: string;
  idempotency_key?: string;
}) {
  return fetchAPI<{ ok: boolean; status: string; note?: string }>('/api/social/publications', {
    method: 'POST',
    body: JSON.stringify(data),
  });
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
  input?: any;
  output?: any;
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
  updated_at?: number;
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

export async function adminMarkVerified(id: string) {
  return fetchAPI<{ ok: boolean }>(`/api/admin/users/${id}/mark-verified`, { method: 'POST' });
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

export type AdminCreativeModel = {
  id: string;
  provider: string;
  provider_model_id: string;
  display_name: string;
  model_type: string;
  operation: string;
  capabilities: Record<string, any>;
  pricing: Record<string, any>;
  pricing_version: string;
  config_version: number;
  is_active: boolean;
  is_maintenance: boolean;
  sort_order: number;
  created_at: number;
  updated_at: number;
};

export async function adminListCreativeModels() {
  return fetchAPI<{ schema_ready: boolean; models: AdminCreativeModel[] }>('/api/admin/creative/models');
}

export async function adminUpdateCreativeModel(id: string, data: {
  display_name?: string;
  is_active?: boolean;
  is_maintenance?: boolean;
  sort_order?: number;
  pricing?: Record<string, any>;
  capabilities?: Record<string, any>;
}) {
  return fetchAPI<{ ok: boolean }>(`/api/admin/creative/models/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function adminGetCreativeStats() {
  return fetchAPI<{ schema_ready: boolean; stats: any }>('/api/admin/creative/stats');
}

export async function adminGetCreativeGeneration(id: string) {
  return fetchAPI<any>(`/api/admin/creative/generations/${id}`);
}

export async function adminRunCreativeReconcile() {
  return fetchAPI<{ ok: boolean; result: any }>('/api/admin/creative/reconcile', {
    method: 'POST',
  });
}

export type AdminProviderKey = {
  provider: string;
  key_hint: string | null;
  is_active: boolean;
  updated_by: string | null;
  updated_at: number;
};

export async function adminListProviderKeys() {
  return fetchAPI<{ schema_ready: boolean; providers: AdminProviderKey[] }>('/api/admin/creative/providers');
}

export async function adminSetProviderKey(provider: string, apiKey: string) {
  return fetchAPI<{ ok: boolean; key_hint: string }>(`/api/admin/creative/providers/${provider}/key`, {
    method: 'PUT',
    body: JSON.stringify({ api_key: apiKey }),
  });
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
  input_json?: any;
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

export async function autofillPresentationStep(id: string, step: number, input: any) {
  return fetchAPI<{ ok: boolean; step: number; suggestion: any; meta: { credits_used: number; credits_remaining: number } }>(
    `/api/presentation/projects/${id}/autofill/${step}`,
    { method: 'POST', body: JSON.stringify({ input }) }
  );
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

// =====================================================
// Brand Profiles (Creative Studio brand context)
// =====================================================

export type BrandProfile = {
  id: string;
  name: string;
  business_summary: string;
  audience: any[];
  tone_of_voice: any[];
  content_pillars: any[];
  offers: any[];
  rules: Record<string, any>;
  is_default: boolean;
  created_at: number;
  updated_at: number;
};

export async function listBrandProfiles(): Promise<{ profiles: BrandProfile[]; active_profile: BrandProfile | null }> {
  return fetchAPI('/api/brand-profiles');
}

// =====================================================
// Content Series Generator
// =====================================================

export type ContentSeriesTemplate = {
  id: string;
  owner_type: 'admin' | 'user';
  owner_user_id: string | null;
  name: string;
  description: string;
  slots: Array<{ pillar?: string; hook_style?: string; cta_style?: string; notes?: string }>;
  default_platforms: string[];
  is_active: boolean;
  created_at: number;
  updated_at: number;
};

export type ContentSeries = {
  id: string;
  user_id: string;
  project_id: string | null;
  template_id: string | null;
  brand_profile_id: string | null;
  brand_snapshot_id: string | null;
  topic: string;
  requested_count: number;
  cadence_days: number;
  start_date: number | null;
  platforms: string[];
  status: 'queued' | 'generating' | 'completed' | 'partial' | 'failed';
  generated_count: number;
  credits_used: number;
  error_message: string | null;
  created_at: number;
  updated_at: number;
};

export async function listContentSeriesTemplates(): Promise<ContentSeriesTemplate[]> {
  const res = await fetchAPI<{ templates: ContentSeriesTemplate[] }>('/api/content-series/templates');
  return res.templates;
}

export async function createContentSeriesTemplate(data: {
  name: string;
  description?: string;
  slots?: Array<{ pillar?: string; hook_style?: string; cta_style?: string; notes?: string }>;
  default_platforms?: string[];
  owner_type?: 'admin' | 'user';
}): Promise<ContentSeriesTemplate> {
  return fetchAPI('/api/content-series/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteContentSeriesTemplate(id: string) {
  return fetchAPI<{ ok: boolean }>(`/api/content-series/templates/${id}`, { method: 'DELETE' });
}

export async function listContentSeries(limit = 30): Promise<ContentSeries[]> {
  const res = await fetchAPI<{ series: ContentSeries[] }>(`/api/content-series?limit=${limit}`);
  return res.series;
}

export async function getContentSeries(id: string): Promise<{ series: ContentSeries; items: ContentItem[] }> {
  return fetchAPI(`/api/content-series/${id}`);
}

export async function generateContentSeries(data: {
  topic: string;
  requested_count: number;
  cadence_days?: number;
  start_date?: number;
  template_id?: string | null;
  brand_profile_id?: string | null;
  project_id?: string | null;
  platforms?: string[];
}): Promise<{ series: ContentSeries; items: ContentItem[] }> {
  return fetchAPI('/api/content-series', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// =====================================================
// Visual Templates + Composition rendering (Brand Kit Composition)
// =====================================================

export type TemplateLayoutBlock = {
  type: 'headline' | 'subheadline' | 'badge';
  anchor: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  font_size: number;
  font_weight?: 400 | 700;
  color: string;
  max_width_pct?: number;
  text_align?: 'left' | 'center' | 'right';
  background_color?: string;
  card_background?: string;
  card_padding?: number;
  side_bar_only?: boolean;
};

export type TemplateLayout = {
  canvas: { width: number; height: number };
  background?: {
    overlay_gradient?: { direction: string; stops: Array<{ offset: string; color: string }> };
    side_bar?: { width_pct: number; color: string };
  };
  blocks: TemplateLayoutBlock[];
};

export type VisualTemplate = {
  id: string;
  owner_type: 'admin' | 'user';
  owner_user_id: string | null;
  name: string;
  description: string;
  layout: TemplateLayout;
  preview_asset_id: string | null;
  is_active: boolean;
  created_at: number;
  updated_at: number;
};

export async function listVisualTemplates(): Promise<VisualTemplate[]> {
  const res = await fetchAPI<{ templates: VisualTemplate[] }>('/api/visual-templates');
  return res.templates;
}

export async function createVisualTemplate(data: {
  name: string;
  description?: string;
  layout: TemplateLayout;
  owner_type?: 'admin' | 'user';
}): Promise<VisualTemplate> {
  return fetchAPI('/api/visual-templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteVisualTemplate(id: string) {
  return fetchAPI<{ ok: boolean }>(`/api/visual-templates/${id}`, { method: 'DELETE' });
}

export async function renderCompositionFromTemplate(data: {
  base_asset_id: string;
  template_id: string;
  headline?: string;
  subheadline?: string;
  badge?: string;
  content_item_id?: string | null;
  brand_kit_id?: string | null;
  project_id?: string | null;
}): Promise<{ ok: boolean; composition_id: string; asset: MediaAsset }> {
  return fetchAPI('/api/compositions/render', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function generateCompositionCopy(data: {
  brief: string;
  tone?: string;
  platform?: string;
}): Promise<{ ok: boolean; headline: string; subheadline: string; credits_remaining: number }> {
  return fetchAPI('/api/compositions/generate-copy', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
