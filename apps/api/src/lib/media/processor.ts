import { generateId } from '../crypto';
import { inspectImageBytes } from '../mediaImage';
import type { Bindings } from '../types';
import { canonicalJson, getModelById } from './catalog';
import { finalizeMediaHold, refundMediaHold } from './credits';
import { getAssetById, type MediaAssetRow } from './assets';
import { getGenerationById, markGenerationCompleted, markGenerationFailed, type MediaGenerationRow } from './generations';
import { buildSignedMediaQuery, signMediaAssetUrl } from './signedUrls';
import { claimMediaWorkItems, completeMediaWorkItem, failMediaWorkItem, type MediaWorkItemRow } from './workItems';
import { getMediaProvider } from './providers/router';
import type { ProviderGenerationResult, ResolvedProviderReference } from './providers/types';

export async function runMediaProcessor(env: Bindings, now = Date.now()) {
  const claimed = await claimMediaWorkItems(env, { limit: 10, leaseMs: 60_000 }, now);
  const results = [];
  for (const item of claimed) {
    try {
      if (item.work_type === 'submit_generation') {
        results.push(await processSubmitGeneration(env, item, now));
      } else if (item.work_type === 'ingest_output') {
        results.push(await processIngestOutput(env, item, now));
      } else {
        await completeMediaWorkItem(env, item.id, now);
        results.push({ id: item.id, skipped: item.work_type });
      }
    } catch (error: any) {
      await failMediaWorkItem(env, item.id, error?.message || String(error), now);
      results.push({ id: item.id, error: error?.message || String(error) });
    }
  }
  return { claimed: claimed.length, results };
}

async function processSubmitGeneration(env: Bindings, item: MediaWorkItemRow, now: number) {
  const generationId = item.generation_id || parsePayload(item).generation_id;
  if (!generationId) throw new Error('generation_id_missing');

  const generation = await getGenerationById(env, generationId);
  if (!generation) {
    await completeMediaWorkItem(env, item.id, now);
    return { id: item.id, completed: 'generation_missing' };
  }
  if (['completed', 'failed', 'cancelled'].includes(generation.status)) {
    await completeMediaWorkItem(env, item.id, now);
    return { id: item.id, completed: 'terminal_generation' };
  }
  if (generation.status === 'cancel_requested' && generation.submission_state === 'pending') {
    // Refund before marking failed — see the comment in reconciler.ts's
    // refundExpiredGenerations for why this order matters: refundMediaHold
    // is idempotent, but once markGenerationFailed lands the generation is
    // terminal and a retried work item would short-circuit at the terminal
    // status check above without ever refunding.
    await refundMediaHold(env, generation.id, 'cancelled_before_submit', now);
    await markGenerationFailed(env, generation.id, 'cancelled_before_submit', 'Generation was cancelled before provider submission.', now);
    await completeMediaWorkItem(env, item.id, now);
    return { id: item.id, completed: 'cancelled_before_submit' };
  }

  const model = await getModelById(env, generation.model_id);
  if (!model) throw new Error('model_not_found');
  const attemptId = generateId();
  const callbackCorrelationId = generateId();
  await env.DB.prepare(`
    INSERT INTO generation_attempts (
      id, generation_id, provider, provider_model_id, callback_correlation_id,
      status, request_summary_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'pending_submit', '{}', ?, ?)
  `).bind(attemptId, generation.id, model.provider, model.provider_model_id, callbackCorrelationId, now, now).run();
  await env.DB.prepare(`
    UPDATE media_generations
    SET current_attempt_id = ?, status = 'submitting', submission_state = 'submission_unknown',
        started_at = COALESCE(started_at, ?), updated_at = ?
    WHERE id = ?
  `).bind(attemptId, now, now, generation.id).run();

  const provider = await getMediaProvider(env, model.provider);
  const providerInput = {
    generation_id: generation.id,
    model,
    prompt: generation.prompt,
    options: parseJson(generation.options_json, {}),
    references: await resolveProviderReferences(env, generation),
  };

  await env.DB.prepare(`
    UPDATE generation_attempts SET status = 'submitting', submit_started_at = ?, request_summary_json = ?, updated_at = ?
    WHERE id = ?
  `).bind(now, canonicalJson({
    generation_id: generation.id,
    model_id: model.id,
    operation: model.operation,
    reference_count: providerInput.references.length,
  }), now, attemptId).run();

  let result: ProviderGenerationResult;
  try {
    result = await provider.submit(providerInput);
  } catch (error: any) {
    await env.DB.prepare(`
      UPDATE generation_attempts
      SET status = 'failed', error_code = ?, submit_completed_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(normalizeErrorCode(error?.message || 'provider_failed'), now, now, attemptId).run();
    // Refund before marking failed — same crash-safety reasoning as above.
    await refundMediaHold(env, generation.id, 'provider_failed', now);
    await markGenerationFailed(env, generation.id, normalizeErrorCode(error?.message || 'provider_failed'), safeError(error), now);
    await completeMediaWorkItem(env, item.id, now);
    return { id: item.id, failed: 'provider_failed' };
  }

  await env.DB.prepare(`
    UPDATE generation_attempts
    SET status = 'succeeded', provider_request_id = ?, provider_cost_usd = ?,
        request_summary_json = ?, submit_completed_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    result.provider_request_id,
    result.provider_cost_usd,
    canonicalJson({
      ...result.raw_summary,
      image_url_count: result.image_urls.length,
      image_base64_count: result.image_base64.length,
    }),
    now,
    now,
    attemptId,
  ).run();
  await env.DB.prepare(`
    UPDATE media_generations
    SET status = 'processing', submission_state = 'submitted', updated_at = ?
    WHERE id = ?
  `).bind(now, generation.id).run();

  try {
    const delivered = await ingestProviderOutputs(env, generation, result, now);
    await markGenerationCompleted(env, generation.id, delivered, generation.estimated_credits, now);
    await finalizeMediaHold(env, generation.id, generation.estimated_credits, 'delivery_available', now);
    await completeMediaWorkItem(env, item.id, now);
    return { id: item.id, delivered };
  } catch (error: any) {
    await env.DB.prepare(`
      UPDATE media_generations
      SET status = 'delivery_pending', delivery_status = 'ingesting',
          error_code = 'storage_failed', error_message = ?, updated_at = ?
      WHERE id = ?
    `).bind(safeError(error), now, generation.id).run();
    await env.DB.prepare(`
      INSERT INTO media_work_items (
        id, generation_id, work_type, dedupe_key, status, available_at,
        attempts, max_attempts, payload_json, created_at, updated_at
      )
      VALUES (?, ?, 'ingest_output', ?, 'pending', ?, 0, 3, ?, ?, ?)
      ON CONFLICT(dedupe_key) DO UPDATE SET available_at = excluded.available_at, updated_at = excluded.updated_at
    `).bind(
      generateId(),
      generation.id,
      `ingest_output:${attemptId}`,
      now + 15_000,
      canonicalJson({ generation_id: generation.id, attempt_id: attemptId, result }),
      now,
      now,
    ).run();
    await completeMediaWorkItem(env, item.id, now);
    return { id: item.id, delivery_pending: true };
  }
}

async function processIngestOutput(env: Bindings, item: MediaWorkItemRow, now: number) {
  const payload = parsePayload(item);
  const generation = await getGenerationById(env, payload.generation_id);
  if (!generation) throw new Error('generation_not_found');
  const delivered = await ingestProviderOutputs(env, generation, payload.result as ProviderGenerationResult, now);
  await markGenerationCompleted(env, generation.id, delivered, generation.estimated_credits, now);
  await finalizeMediaHold(env, generation.id, generation.estimated_credits, 'delivery_available_after_retry', now);
  await completeMediaWorkItem(env, item.id, now);
  return { id: item.id, delivered };
}

async function resolveProviderReferences(env: Bindings, generation: MediaGenerationRow): Promise<ResolvedProviderReference[]> {
  const result = await env.DB.prepare(`
    SELECT asset_id, mention_name, reference_role, sort_order
    FROM generation_references
    WHERE generation_id = ?
    ORDER BY sort_order ASC
  `).bind(generation.id).all<{ asset_id: string; mention_name: string; reference_role: string; sort_order: number }>();

  const origin = getApiOrigin(env);
  const references: ResolvedProviderReference[] = [];
  for (const row of result.results || []) {
    const asset = await getAssetById(env, row.asset_id);
    if (!asset || asset.lifecycle_status !== 'active') throw new Error('reference_asset_not_available');
    const expiresAt = Date.now() + 10 * 60_000;
    const signature = await signMediaAssetUrl(env, {
      assetId: asset.id,
      userId: asset.user_id,
      purpose: 'provider_input',
      expiresAt,
    });
    references.push({
      asset_id: asset.id,
      mention_name: row.mention_name,
      reference_role: row.reference_role,
      provider_url: `${origin}/api/media/provider-assets/${asset.id}?${buildSignedMediaQuery({
        purpose: 'provider_input',
        expiresAt,
        signature,
      })}`,
    });
  }
  return references;
}

async function ingestProviderOutputs(
  env: Bindings,
  generation: MediaGenerationRow,
  result: ProviderGenerationResult,
  now: number,
) {
  const outputs = [
    ...result.image_urls.map((url) => ({ kind: 'url' as const, value: url })),
    ...result.image_base64.map((value) => ({ kind: 'base64' as const, value })),
  ];
  if (!outputs.length) throw new Error('provider_empty_output');

  let delivered = 0;
  for (const output of outputs) {
    const bytes = output.kind === 'url' ? await fetchProviderBytes(env, output.value) : base64ToBytes(output.value);
    const inspection = inspectImageBytes(bytes);
    if (!inspection.ok) throw new Error(`output_inspection_failed:${inspection.error}`);

    const assetId = generateId();
    const r2Key = `media/${generation.user_id}/outputs/${generation.id}/${assetId}.${inspection.extension}`;
    await env.R2.put(r2Key, bytes, {
      httpMetadata: { contentType: inspection.mimeType },
      customMetadata: {
        user_id: generation.user_id,
        generation_id: generation.id,
        provider: result.provider,
      },
    });
    const readback = await env.R2.get(r2Key);
    if (!readback) throw new Error('r2_readback_failed');

    await env.DB.prepare(`
      INSERT INTO media_assets (
        id, user_id, generation_id, asset_type, source, r2_key,
        original_filename, mime_type, file_size, width, height,
        metadata_json, lifecycle_status, created_at, updated_at
      )
      VALUES (?, ?, ?, 'image', 'generation', ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).bind(
      assetId,
      generation.user_id,
      generation.id,
      r2Key,
      `generation-${delivered + 1}.${inspection.extension}`,
      inspection.mimeType,
      inspection.bytes,
      inspection.width,
      inspection.height,
      canonicalJson({
        provider: result.provider,
        provider_request_id: result.provider_request_id,
        inspection: {
          kind: inspection.kind,
          megapixels: inspection.megapixels,
          processor: 'worker_first_pass_only',
        },
      }),
      now,
      now,
    ).run();
    delivered += 1;
  }
  return delivered;
}

async function fetchProviderBytes(env: Bindings, url: string) {
  const fetchImpl: typeof fetch = (env as any).__MEDIA_PROVIDER_FETCH || fetch;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`provider_output_fetch_failed:${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getApiOrigin(env: Pick<Bindings, 'API_URL' | 'WEB_URL'>) {
  return (env.API_URL || env.WEB_URL || 'http://localhost:8787').replace(/\/$/, '');
}

function parsePayload(item: Pick<MediaWorkItemRow, 'payload_json'>) {
  try {
    return JSON.parse(item.payload_json || '{}');
  } catch {
    return {};
  }
}

function parseJson(value: string, fallback: unknown) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeErrorCode(message: string) {
  if (message.includes('not_configured')) return 'provider_not_configured';
  if (message.includes('policy')) return 'policy_rejected';
  if (message.includes('validation') || message.includes('unsupported') || message.includes('out_of_range')) return 'validation';
  if (message.includes('timeout')) return 'timeout';
  return 'provider_failed';
}

function safeError(error: any) {
  return String(error?.message || error || 'unknown_error').replace(/https?:\/\/\S+/g, '[url]').slice(0, 300);
}
