#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ENDPOINT = 'https://api.minimax.io/v1/image_generation';

function loadEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function safeUrlSummary(url) {
  try {
    const parsed = new URL(url);
    return { protocol: parsed.protocol, host: parsed.host, pathDepth: parsed.pathname.split('/').filter(Boolean).length };
  } catch {
    return { invalid: true };
  }
}

async function inspectImageUrl(url) {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (head.ok) {
      return {
        ok: true,
        status: head.status,
        contentType: head.headers.get('content-type'),
        contentLength: head.headers.get('content-length'),
      };
    }
  } catch {}

  const res = await fetch(url, { headers: { Range: 'bytes=0-31' } });
  return {
    ok: res.ok,
    status: res.status,
    contentType: res.headers.get('content-type'),
    contentLength: res.headers.get('content-length'),
  };
}

async function main() {
  const root = process.cwd();
  const env = { ...loadEnv(path.join(root, '.env.local')), ...process.env };
  const apiKey = env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY is missing from .env.local or process env');
  }

  const payload = {
    model: process.env.MINIMAX_IMAGE_MODEL || 'image-01',
    prompt: process.env.MINIMAX_IMAGE_PROMPT || 'A clean editorial product photo of a compact AI workshop toolkit for SME business owners, warm natural light, realistic, premium but practical, no text',
    aspect_ratio: process.env.MINIMAX_IMAGE_RATIO || '1:1',
    response_format: process.env.MINIMAX_IMAGE_FORMAT || 'url',
    n: Number(process.env.MINIMAX_IMAGE_COUNT || 1),
    prompt_optimizer: true,
  };

  if (process.env.MINIMAX_IMAGE_REFERENCE_URL) {
    payload.subject_reference = [{
      type: process.env.MINIMAX_IMAGE_REFERENCE_TYPE || 'character',
      image_file: process.env.MINIMAX_IMAGE_REFERENCE_URL,
    }];
  }

  const startedAt = Date.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const durationMs = Date.now() - startedAt;
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { parse_error: text.slice(0, 240) };
  }

  const imageUrls = Array.isArray(data?.data?.image_urls) ? data.data.image_urls : [];
  const imageBase64 = Array.isArray(data?.data?.image_base64) ? data.data.image_base64 : [];
  const firstImage = imageUrls[0] ? await inspectImageUrl(imageUrls[0]) : null;

  const sanitized = {
    ok: res.ok,
    httpStatus: res.status,
    durationMs,
    model: payload.model,
    aspectRatio: payload.aspect_ratio,
    subjectReferenceCount: Array.isArray(payload.subject_reference) ? payload.subject_reference.length : 0,
    subjectReferenceType: payload.subject_reference?.[0]?.type || null,
    requestedCount: payload.n,
    returnedUrlCount: imageUrls.length,
    returnedBase64Count: imageBase64.length,
    providerRequestIdPresent: Boolean(data?.id),
    baseResp: data?.base_resp || null,
    firstUrlSummary: imageUrls[0] ? safeUrlSummary(imageUrls[0]) : null,
    firstImage,
  };

  console.log(JSON.stringify(sanitized, null, 2));
  if (!res.ok || (imageUrls.length === 0 && imageBase64.length === 0)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
