#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ENDPOINT = 'https://api.minimax.io/v1/image_generation';
const REQUEST_TIMEOUT_MS = Number(process.env.MINIMAX_FAILURE_TIMEOUT_MS || 45000);

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

function countOutputs(data) {
  return {
    urlCount: Array.isArray(data?.data?.image_urls) ? data.data.image_urls.length : 0,
    base64Count: Array.isArray(data?.data?.image_base64) ? data.data.image_base64.length : 0,
    legacyImageCount: Array.isArray(data?.data?.images) ? data.data.images.length : 0,
  };
}

function isExpectedFailure(httpStatus, data, outputCounts) {
  const providerStatus = data?.base_resp?.status_code;
  const outputCount = outputCounts.urlCount + outputCounts.base64Count + outputCounts.legacyImageCount;
  return httpStatus < 200 || httpStatus >= 300 || (providerStatus && providerStatus !== 0) || outputCount === 0;
}

async function runCase(apiKey, testCase) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(testCase.payload),
      signal: controller.signal,
    });
    const raw = await res.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { parse_error: raw.slice(0, 180) };
    }

    const outputCounts = countOutputs(data);
    return {
      name: testCase.name,
      ok: isExpectedFailure(res.status, data, outputCounts),
      httpStatus: res.status,
      durationMs: Date.now() - startedAt,
      baseResp: data?.base_resp || null,
      providerRequestIdPresent: Boolean(data?.id),
      outputCounts,
    };
  } catch (error) {
    return {
      name: testCase.name,
      ok: true,
      transportFailure: true,
      durationMs: Date.now() - startedAt,
      error: error.name === 'AbortError' ? 'request_timeout' : error.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const env = { ...loadEnv(path.join(process.cwd(), '.env.local')), ...process.env };
  if (!env.MINIMAX_API_KEY) throw new Error('MINIMAX_API_KEY missing');

  const basePayload = {
    model: 'image-01',
    prompt: 'A simple product photo of a small AI workshop notebook on a clean desk, no text',
    aspect_ratio: '1:1',
    response_format: 'url',
    n: 1,
    prompt_optimizer: false,
  };

  const cases = [
    {
      name: 'invalid_model',
      payload: { ...basePayload, model: 'not-a-real-minimax-image-model' },
    },
    {
      name: 'invalid_aspect_ratio',
      payload: { ...basePayload, aspect_ratio: '99:99' },
    },
    {
      name: 'count_above_documented_limit',
      payload: { ...basePayload, n: 10 },
    },
    {
      name: 'non_image_subject_reference',
      payload: {
        ...basePayload,
        subject_reference: [{ type: 'product', image_file: 'https://example.com/' }],
      },
    },
  ];

  const results = [];
  for (const testCase of cases) {
    results.push(await runCase(env.MINIMAX_API_KEY, testCase));
  }

  const summary = {
    ok: results.every((result) => result.ok),
    endpoint: new URL(ENDPOINT).host,
    timeoutMs: REQUEST_TIMEOUT_MS,
    cases: results,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
