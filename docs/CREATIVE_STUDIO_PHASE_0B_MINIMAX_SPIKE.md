# Creative Studio Phase 0B - MiniMax Provider Spike

Date: 2026-08-01  
Status: Passed first backend provider call  
Provider: MiniMax  
Initial image model: `image-01`

## Decision

Use MiniMax image generation as the first Phase 0B provider spike, because the project already has MiniMax credentials and text-generation integration. The Phase 0B spike is provider validation only; Phase 1-3 still need the durable Creative Studio foundation before exposing this to users.

Official references:

- Text to Image: https://platform.minimax.io/docs/api-reference/image-generation-t2i
- Image to Image: https://platform.minimax.io/docs/api-reference/image-generation-i2i
- Pay-as-you-go Pricing: https://platform.minimax.io/docs/guides/pricing-paygo

## API Shape

Endpoint:

```text
POST https://api.minimax.io/v1/image_generation
```

Authentication:

```text
Authorization: Bearer <MINIMAX_API_KEY>
```

Text-to-image request shape:

```json
{
  "model": "image-01",
  "prompt": "A clean product photo...",
  "aspect_ratio": "1:1",
  "response_format": "url",
  "n": 1,
  "prompt_optimizer": true
}
```

Image-to-image subject-reference request shape:

```json
{
  "model": "image-01",
  "prompt": "A girl looking into the distance from a library window",
  "aspect_ratio": "16:9",
  "subject_reference": [
    {
      "type": "character",
      "image_file": "https://example.com/reference.jpg"
    }
  ],
  "n": 1
}
```

## Initial Capability Matrix

| Internal ID | Provider model | Operation | References | Output | Notes |
|---|---|---|---|---|---|
| `minimax-image-01-t2i` | `image-01` | `text_to_image` | none | `url` or `base64` | Good first text-to-image model |
| `minimax-image-01-i2i-subject` | `image-01` | `image_to_image` | one subject reference | `url` or `base64` | Provider-level reference is `subject_reference` with `character` or `product` |

Known aspect ratios from docs/examples:

```text
1:1, 16:9, 4:3, 3:2, 2:3, 3:4, 9:16, 21:9
```

## Local Spike Results

### Text-to-image

Command:

```bash
node scripts/minimax-image-spike.mjs
```

Sanitized result:

```json
{
  "ok": true,
  "httpStatus": 200,
  "durationMs": 25012,
  "model": "image-01",
  "aspectRatio": "1:1",
  "requestedCount": 1,
  "returnedUrlCount": 1,
  "returnedBase64Count": 0,
  "providerRequestIdPresent": true,
  "baseResp": {
    "status_code": 0,
    "status_msg": "success"
  },
  "firstUrlSummary": {
    "protocol": "http:",
    "host": "hailuo-image-algeng-data-us.oss-us-east-1.aliyuncs.com",
    "pathDepth": 1
  },
  "firstImage": {
    "ok": true,
    "status": 206,
    "contentType": "image/jpeg",
    "contentLength": "32"
  }
}
```

### Image-to-image subject reference

Command shape:

```bash
MINIMAX_IMAGE_REFERENCE_URL="<public-reference-url>" \
MINIMAX_IMAGE_REFERENCE_TYPE="character" \
node scripts/minimax-image-spike.mjs
```

Sanitized result:

```json
{
  "ok": true,
  "httpStatus": 200,
  "durationMs": 25763,
  "model": "image-01",
  "aspectRatio": "16:9",
  "subjectReferenceCount": 1,
  "subjectReferenceType": "character",
  "requestedCount": 1,
  "returnedUrlCount": 1,
  "returnedBase64Count": 0,
  "providerRequestIdPresent": true,
  "baseResp": {
    "status_code": 0,
    "status_msg": "success"
  },
  "firstUrlSummary": {
    "protocol": "http:",
    "host": "hailuo-image-algeng-data-us.oss-us-east-1.aliyuncs.com",
    "pathDepth": 1
  },
  "firstImage": {
    "ok": true,
    "status": 206,
    "contentType": "image/jpeg",
    "contentLength": "32"
  }
}
```

### Text-to-image base64 response

Command shape:

```bash
MINIMAX_IMAGE_FORMAT="base64" node scripts/minimax-image-spike.mjs
```

Sanitized result:

```json
{
  "ok": true,
  "httpStatus": 200,
  "durationMs": 23764,
  "model": "image-01",
  "aspectRatio": "1:1",
  "subjectReferenceCount": 0,
  "subjectReferenceType": null,
  "requestedCount": 1,
  "returnedUrlCount": 0,
  "returnedBase64Count": 1,
  "providerRequestIdPresent": true,
  "baseResp": {
    "status_code": 0,
    "status_msg": "success"
  },
  "firstUrlSummary": null,
  "firstImage": null
}
```

## Findings

- Backend-only provider call works with the existing `MINIMAX_API_KEY`.
- The `.env.local` file does not include `MINIMAX_GROUP_ID`, but image generation does not require the existing chat-completion `GroupId` query shape.
- First text-to-image call returned one provider URL in roughly 25 seconds.
- First subject-reference image-to-image call returned one provider URL in roughly 25.8 seconds.
- `response_format=base64` returned one base64 image in roughly 23.8 seconds and avoids provider URL fetch, but increases Worker response/body memory pressure.
- Current official MiniMax pay-as-you-go docs list `image-01` at **$0.0035 per image**.
- Output URL used `http` and a provider-controlled Aliyun OSS host, so Release 1A must copy provider output into private R2 before marking delivery available.
- First output was JPEG. Phase 2/3 should still treat provider content type as untrusted until fetched, sniffed, and stored.
- `response_format=base64` works and remains useful as a fallback candidate if provider URL ingestion fails or if HTTPS-only fetching becomes a hard policy. It should still be memory-tested before becoming the default.

## Beta Pricing Starting Point

Given the current provider cost of $0.0035 per output image, a conservative beta quote can start at:

| Output count | Provider cost | Suggested beta user credits | Notes |
|---:|---:|---:|---|
| 1 | $0.0035 | 2 credits | Keeps margin for R2, failed delivery refunds, support, and retries |
| 2 | $0.0070 | 4 credits | Linear per delivered image |
| 4 | $0.0140 | 8 credits | Batch quote can aggregate, but hold/finalize remains per generation |

This is a starting quote only. Freeze final credit pricing after 3+ latency/failure/cost samples and after deciding whether URL-ingest or base64-ingest is the default delivery path.

## Adapter Files Added

- `apps/api/src/lib/minimaxImage.ts`
- `apps/api/test/minimaxImage.test.ts`
- `apps/api/src/lib/mediaImage.ts`
- `apps/api/test/mediaImage.test.ts`
- `scripts/minimax-image-spike.mjs`
- `scripts/minimax-r2-ingestion-spike.mjs`
- `scripts/minimax-failure-spike.mjs`

## R2 Ingestion Spike

Goal:

```text
MiniMax output -> fetch/decode -> magic-byte + dimensions inspection -> R2 put -> R2 get/readback -> inspect again -> cleanup
```

### URL response ingestion

Command:

```bash
node scripts/minimax-r2-ingestion-spike.mjs
```

Sanitized result:

```json
{
  "ok": true,
  "generation": {
    "durationMs": 22750,
    "model": "image-01",
    "aspectRatio": "1:1",
    "responseFormat": "url",
    "providerRequestIdPresent": true,
    "baseResp": {
      "status_code": 0,
      "status_msg": "success"
    },
    "urlSummary": {
      "protocol": "http:",
      "host": "hailuo-image-algeng-data-us.oss-us-east-1.aliyuncs.com",
      "pathDepth": 1
    },
    "base64Present": false
  },
  "inspection": {
    "ok": true,
    "bytes": 206780,
    "megapixels": 1.0486,
    "kind": "jpeg",
    "mimeType": "image/jpeg",
    "extension": "jpg",
    "height": 1024,
    "width": 1024
  },
  "r2": {
    "keyPrefix": "media-spike/2026-08-01",
    "extension": "jpg",
    "readbackBytes": 206780,
    "deleted": true
  }
}
```

### Base64 response ingestion

Command:

```bash
MINIMAX_IMAGE_FORMAT=base64 node scripts/minimax-r2-ingestion-spike.mjs
```

Sanitized result:

```json
{
  "ok": true,
  "generation": {
    "durationMs": 24667,
    "model": "image-01",
    "aspectRatio": "1:1",
    "responseFormat": "base64",
    "providerRequestIdPresent": true,
    "baseResp": {
      "status_code": 0,
      "status_msg": "success"
    },
    "urlSummary": null,
    "base64Present": true
  },
  "inspection": {
    "ok": true,
    "bytes": 220128,
    "megapixels": 1.0486,
    "kind": "jpeg",
    "mimeType": "image/jpeg",
    "extension": "jpg",
    "height": 1024,
    "width": 1024
  },
  "r2": {
    "keyPrefix": "media-spike/2026-08-01",
    "extension": "jpg",
    "readbackBytes": 220128,
    "deleted": true
  }
}
```

### Ingestion Findings

- URL ingest and base64 ingest both work against the current R2 bucket.
- Both paths returned JPEG `1024x1024` outputs at about `1.05MP`.
- R2 put/get/readback inspection matched original bytes and dimensions.
- Spike objects were deleted after readback; no durable user asset rows were created.
- URL path requires Worker/backend fetch from a provider `http` URL. This should not be user-facing and should be copied into R2 before delivery.
- Base64 path avoids provider URL fetch but moves image bytes through the MiniMax JSON response, so memory and response-size limits must be measured with larger images and `n > 1`.
- Worker-compatible first-pass inspection can verify magic bytes, MIME family, dimensions, size, and max megapixels for JPEG/PNG/WebP without decoding the full image.
- EXIF strip, orientation normalization, and thumbnail generation are not solved by this first-pass inspector; they still need a processor decision.

## Product Reference Reality Check

Command:

```bash
MINIMAX_IMAGE_REFERENCE_TYPE=product MINIMAX_IMAGE_REFERENCE_URL=<public product jpg> node scripts/minimax-image-spike.mjs
```

Sanitized result:

```json
{
  "ok": true,
  "httpStatus": 200,
  "durationMs": 937,
  "model": "image-01",
  "aspectRatio": "1:1",
  "subjectReferenceCount": 1,
  "subjectReferenceType": "product",
  "requestedCount": 1,
  "returnedUrlCount": 0,
  "returnedBase64Count": 0,
  "providerRequestIdPresent": true,
  "baseResp": {
    "status_code": 2013,
    "status_msg": "invalid params, subject_reference must be character"
  }
}
```

Finding:

- The live MiniMax `image-01` API rejected `subject_reference.type=product` even though the public docs currently describe product reference support.
- Release 1A must expose MiniMax subject reference as **character reference only** until a later provider/model confirms product reference support.
- Product photo/reference workflows should remain in the UX plan, but the model catalog must mark product reference disabled for MiniMax `image-01`.

## Provider Failure Mode Spike

Command:

```bash
node scripts/minimax-failure-spike.mjs
```

Sanitized result:

```json
{
  "ok": true,
  "endpoint": "api.minimax.io",
  "timeoutMs": 45000,
  "cases": [
    {
      "name": "invalid_model",
      "httpStatus": 200,
      "baseResp": {
        "status_code": 2013,
        "status_msg": "invalid params, unsupported model"
      },
      "outputCounts": { "urlCount": 0, "base64Count": 0, "legacyImageCount": 0 }
    },
    {
      "name": "invalid_aspect_ratio",
      "httpStatus": 200,
      "baseResp": {
        "status_code": 2013,
        "status_msg": "invalid params, aspect_ratio must be one of the documented ratios"
      },
      "outputCounts": { "urlCount": 0, "base64Count": 0, "legacyImageCount": 0 }
    },
    {
      "name": "count_above_documented_limit",
      "httpStatus": 200,
      "baseResp": {
        "status_code": 2013,
        "status_msg": "invalid params, n must be between 1 and 9"
      },
      "outputCounts": { "urlCount": 0, "base64Count": 0, "legacyImageCount": 0 }
    },
    {
      "name": "non_image_subject_reference",
      "httpStatus": 200,
      "baseResp": {
        "status_code": 2013,
        "status_msg": "invalid params, subject_reference must be character"
      },
      "outputCounts": { "urlCount": 0, "base64Count": 0, "legacyImageCount": 0 }
    }
  ]
}
```

Failure-handling decision:

- Do not treat HTTP 200 as success for MiniMax image generation.
- A job is provider-successful only when `base_resp.status_code` is `0` or absent and at least one output URL/base64 image exists.
- Provider validation failures before output delivery must not finalize credits.
- In Release 1A, map `2013` to a user-safe validation message and mark the generation as `failed_provider_validation`.

## Staging Resources

Created and wired in `apps/api/wrangler.toml`:

```text
Worker: businessaios-api-staging
D1:     businessaios-db-staging
R2:     businessaios-exports-staging
```

Staging D1 ID:

```text
5a895ec0-3a30-494c-b478-e8f84496303a
```

Applied current API migrations to staging D1 through `008-mcp-tokens.sql`.

Staging still needs separate secret values before any staging Worker route uses auth, email, payments, or MiniMax in deployed runtime.

Staging deploy smoke:

```text
URL:        https://businessaios-api-staging.pskspace.workers.dev
Version ID: 59ad179e-133a-4528-92d6-3a34b752f857
Smoke:      GET /api/config -> 200
Flags:      creative_studio=false, brand_context=false
```

## Image Processor Decision

Release 1A should split image handling into two layers:

1. Worker first-pass inspection now: max bytes, JPEG/PNG/WebP magic bytes, dimensions, and max megapixels.
2. Dedicated processor later: EXIF/GPS strip, orientation normalization, thumbnail generation, and richer image transformations.

Decision:

- Keep the Worker-compatible inspector for upload/provider-output gatekeeping because it is cheap and avoids full image decode.
- Do not implement EXIF strip/orientation/thumbnail with ad hoc byte editing inside the primary API Worker.
- Before broad user uploads, add either Cloudflare Images/Transformations or a separate media-processing Worker/service. The primary API should continue to own asset metadata, quarantine status, R2 keys, and user ownership checks.
- For internal Release 1A beta, provider outputs can pass through first-pass inspection and private R2 ingestion; user-uploaded reference images should remain size/type constrained and marked `processing_required` until the processor path is added.

## Open Questions For Phase 0B Completion

- Confirm whether MiniMax has any non-obvious resolution/count multiplier beyond the public per-image pay-as-you-go price.
- Run larger batch tests with `n > 1` to measure Worker memory and response-size pressure.
- Add unsafe prompt and unreachable-reference tests if the provider documents safety-specific error codes.
- Decide whether Release 1A defaults to `url` response then backend ingests, or uses `base64` for smaller single-output jobs.
- Confirm whether production Worker can fetch MiniMax returned `http` URLs inside deployed Worker runtime, not only from local Node.
- Add staging secrets before any route is exposed to users.
- Validate product-reference capability again if MiniMax changes live API behavior or if a second provider is added.

## Next Implementation Step

Continue Phase 0B with:

1. staging secret setup
2. deployed Worker fetch/R2 smoke against staging resources
3. model catalog migration and provider adapter service wiring
4. upload intent/quarantine endpoint
5. credit quote/hold/finalize flow
