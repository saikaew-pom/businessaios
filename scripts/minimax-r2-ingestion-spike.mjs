#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ENDPOINT = 'https://api.minimax.io/v1/image_generation';
const BUCKET = process.env.MEDIA_SPIKE_R2_BUCKET || 'businessaios-exports';

function loadEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
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

async function generateImage(apiKey) {
  const payload = {
    model: process.env.MINIMAX_IMAGE_MODEL || 'image-01',
    prompt: process.env.MINIMAX_IMAGE_PROMPT || 'A realistic studio photo of an AI coaching workbook for SME owners beside a laptop, clean desk, warm light, premium practical style, no text',
    aspect_ratio: process.env.MINIMAX_IMAGE_RATIO || '1:1',
    response_format: process.env.MINIMAX_IMAGE_FORMAT || 'url',
    n: 1,
    prompt_optimizer: true,
  };

  const startedAt = Date.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  const data = JSON.parse(text);
  if (!res.ok || data?.base_resp?.status_code) {
    throw new Error(`MiniMax failed: http=${res.status} provider=${data?.base_resp?.status_code}:${data?.base_resp?.status_msg || 'unknown'}`);
  }

  return {
    durationMs: Date.now() - startedAt,
    payload,
    providerRequestIdPresent: Boolean(data?.id),
    baseResp: data?.base_resp || null,
    imageUrl: data?.data?.image_urls?.[0] || null,
    imageBase64: data?.data?.image_base64?.[0] || data?.data?.images?.[0] || null,
  };
}

async function readProviderOutput(generation) {
  if (generation.imageBase64) {
    return Buffer.from(generation.imageBase64, 'base64');
  }
  if (!generation.imageUrl) throw new Error('MiniMax returned no image payload');
  const res = await fetch(generation.imageUrl);
  if (!res.ok) throw new Error(`Provider image fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function inspectImage(bytes) {
  if (bytes.length > 10 * 1024 * 1024) return { ok: false, error: 'too_large', bytes: bytes.length };
  const parsed = parsePng(bytes) || parseJpeg(bytes) || parseWebp(bytes);
  if (!parsed) return { ok: false, error: 'unsupported_type', bytes: bytes.length };
  const megapixels = parsed.width * parsed.height / 1_000_000;
  if (megapixels > 16) return { ok: false, error: 'too_many_pixels', bytes: bytes.length, ...parsed };
  return { ok: true, bytes: bytes.length, megapixels: Number(megapixels.toFixed(4)), ...parsed };
}

function parsePng(bytes) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || !sig.every((v, i) => bytes[i] === v) || ascii(bytes, 12, 16) !== 'IHDR') return null;
  return { kind: 'png', mimeType: 'image/png', extension: 'png', width: u32be(bytes, 16), height: u32be(bytes, 20) };
}

function parseJpeg(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    let marker = bytes[offset + 1];
    while (marker === 0xff) { offset += 1; marker = bytes[offset + 1]; }
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    const length = u16be(bytes, offset);
    if (length < 2 || offset + length > bytes.length) break;
    if (((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) && length >= 7) {
      return { kind: 'jpeg', mimeType: 'image/jpeg', extension: 'jpg', height: u16be(bytes, offset + 3), width: u16be(bytes, offset + 5) };
    }
    offset += length;
  }
  return null;
}

function parseWebp(bytes) {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 12) !== 'WEBP') return null;
  const chunk = ascii(bytes, 12, 16);
  if (chunk === 'VP8X') return { kind: 'webp', mimeType: 'image/webp', extension: 'webp', width: 1 + u24le(bytes, 24), height: 1 + u24le(bytes, 27) };
  if (chunk === 'VP8 ') return { kind: 'webp', mimeType: 'image/webp', extension: 'webp', width: u16le(bytes, 26) & 0x3fff, height: u16le(bytes, 28) & 0x3fff };
  return null;
}

function r2PutGetDelete(localFile, mimeType, extension) {
  const key = `media-spike/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  const objectPath = `${BUCKET}/${key}`;
  const cwd = path.join(process.cwd(), 'apps/api');
  const downloaded = path.join(os.tmpdir(), `businessaios-r2-readback-${crypto.randomUUID()}.${extension}`);

  execFileSync('npx', ['wrangler', 'r2', 'object', 'put', objectPath, '--remote', '--file', localFile, '--content-type', mimeType], { cwd, stdio: 'pipe', encoding: 'utf8' });
  execFileSync('npx', ['wrangler', 'r2', 'object', 'get', objectPath, '--remote', '--file', downloaded], { cwd, stdio: 'pipe', encoding: 'utf8' });
  const readbackBytes = fs.readFileSync(downloaded);
  const readbackInspection = inspectImage(readbackBytes);
  execFileSync('npx', ['wrangler', 'r2', 'object', 'delete', objectPath, '--remote', '--force'], { cwd, stdio: 'pipe', encoding: 'utf8' });
  fs.rmSync(downloaded, { force: true });

  return {
    keyPrefix: key.split('/').slice(0, -1).join('/'),
    extension,
    readbackBytes: readbackBytes.length,
    readbackInspection,
    deleted: true,
  };
}

async function main() {
  const env = { ...loadEnv(path.join(process.cwd(), '.env.local')), ...process.env };
  if (!env.MINIMAX_API_KEY) throw new Error('MINIMAX_API_KEY missing');

  const generation = await generateImage(env.MINIMAX_API_KEY);
  const bytes = await readProviderOutput(generation);
  const inspection = inspectImage(bytes);
  if (!inspection.ok) throw new Error(`Image inspection failed: ${inspection.error}`);

  const file = path.join(os.tmpdir(), `businessaios-minimax-ingest-${crypto.randomUUID()}.${inspection.extension}`);
  fs.writeFileSync(file, bytes);
  const r2 = r2PutGetDelete(file, inspection.mimeType, inspection.extension);
  fs.rmSync(file, { force: true });

  console.log(JSON.stringify({
    ok: true,
    generation: {
      durationMs: generation.durationMs,
      model: generation.payload.model,
      aspectRatio: generation.payload.aspect_ratio,
      responseFormat: generation.payload.response_format,
      providerRequestIdPresent: generation.providerRequestIdPresent,
      baseResp: generation.baseResp,
      urlSummary: generation.imageUrl ? safeUrlSummary(generation.imageUrl) : null,
      base64Present: Boolean(generation.imageBase64),
    },
    inspection,
    r2,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});

function ascii(bytes, start, end) { return String.fromCharCode(...bytes.slice(start, end)); }
function u16be(bytes, offset) { return (bytes[offset] << 8) | bytes[offset + 1]; }
function u32be(bytes, offset) { return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0; }
function u16le(bytes, offset) { return bytes[offset] | (bytes[offset + 1] << 8); }
function u24le(bytes, offset) { return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16); }
