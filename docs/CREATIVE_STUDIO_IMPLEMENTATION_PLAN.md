# BusinessAiOs Creative Studio - Implementation Plan

> แผนสร้างระบบสร้างภาพแบบ multi-model พร้อม Reference Workspace, `@mention`, Asset Library, Brand Kit และระบบเครดิต
>
> สถานะเอกสาร: Reviewed Revision 2 - แก้ production-readiness findings แล้ว
> วันที่จัดทำ: 2026-08-01
> รีวิวล่าสุด: 2026-08-01
> ระบบเป้าหมาย: BusinessAiOs บน Cloudflare Workers

---

## 1. เป้าหมาย

สร้าง Creative Studio ภายใน BusinessAiOs ที่ทำให้ผู้ใช้สามารถ:

1. เลือกโมเดลสร้างหรือแก้ไขภาพจาก model catalog กลาง
2. อัปโหลดภาพอ้างอิงหลายภาพและเรียกใช้ด้วย `@mention`
3. กำหนดหน้าที่ของ reference เช่น Subject, Product, Style และ Composition
4. เห็นราคาก่อนสร้าง และถูกหักหรือคืนเครดิตอย่างถูกต้อง
5. ปิดหน้าแล้วกลับมาดูสถานะ งานเดิม และไฟล์ที่สร้างได้
6. เก็บภาพ โลโก้ สี ฟอนต์ และสินค้าไว้ใช้ซ้ำผ่าน Asset Library และ Brand Kit
7. เพิ่ม provider และโมเดลในอนาคตโดยไม่ต้องรื้อ frontend หรือ billing flow

เป้าหมายเชิงผลิตภัณฑ์ของรุ่นแรกคือพิสูจน์วงจรนี้ให้ครบ:

```text
เลือกโมเดล
  -> เพิ่ม Reference
  -> เขียน Prompt ด้วย @mention
  -> ประเมินเครดิต
  -> Reserve เครดิต
  -> ส่ง Generation Job
  -> รับผลแบบ Async
  -> เก็บไฟล์ใน R2
  -> Finalize หรือ Refund เครดิต
  -> ใช้ผลงานซ้ำ
```

---

## 2. ขอบเขต Release แรก

### 2.1 ต้องมีใน Release 1A - Core Image Studio

- Text-to-image
- Image-to-image
- Provider แรกผ่าน provider adapter โดยแนะนำ `fal.ai`
- โมเดลเริ่มต้น 2-3 โมเดล
- Model catalog ที่เปิด ปิด และตั้งราคาได้จาก backend
- Reference image 1-3 ภาพใน UI รุ่นแรก
- Prompt editor พร้อม `@mention` และ autocomplete thumbnail
- Reference roles: Subject, Product, Style, Composition
- Influence levels: Strict, Balanced, Loose
- อัปโหลดด้วย file picker, drag and drop และ paste clipboard
- Crop, orientation normalization, metadata removal และ thumbnail
- Async generation status: queued, processing, completed, failed, cancelled
- Credit estimate, reserve, finalize และ refund แบบ idempotent
- Durable work queue + scheduled reconciler ที่ทำงานได้แม้ผู้ใช้ปิด browser
- Asset Library, Generation History, Favorite, Download, Reuse Prompt และ Use as Reference
- R2 private storage และ URL แบบมีอายุสำหรับ provider/download
- Exact-origin, CSRF protection และ per-user spend/concurrency limits
- fal webhook signature verification แบบบังคับ
- Staging Worker, D1 และ R2 ที่แยกจาก production
- Admin model configuration ขั้นพื้นฐาน
- Feature flag สำหรับเปิดเฉพาะ admin/internal users ก่อน

### 2.2 ต้องมีใน Release 1B - Brand Output

- Brand Kit รุ่นแรก
- Brand colors
- Logo assets
- Product packshots
- Font upload: `.ttf`, `.otf`, `.woff2`
- Font-license confirmation
- Post-composition สำหรับข้อความ โลโก้ ราคา และ CTA
- Export artwork ที่แก้ข้อความได้โดยไม่ generate ภาพใหม่
- Remove background สำหรับ product/logo asset

### 2.3 ยังไม่รวมใน Release แรก

- Video, Voice, Avatar และ Motion Control
- Community Feed
- Academy หรือ Course system
- Model training, LoRA training หรือ custom character model
- Mask editor ระดับ Photoshop
- Pose skeleton editor
- Real-time collaborative editing
- Marketplace สำหรับขาย recipe/template
- Provider failover อัตโนมัติข้าม policy
- การลดหรือ bypass safety policy ของ provider

รายการเหล่านี้อยู่ใน Phase ถัดไปหลัง Core Image Studio มี usage และ unit economics ที่ยืนยันได้แล้ว

---

## 3. สถาปัตยกรรมที่ใช้ต่อจากระบบปัจจุบัน

### 3.1 สิ่งที่มีอยู่แล้วและต้อง reuse

| Layer | ระบบปัจจุบัน | แนวทางใน Creative Studio |
|---|---|---|
| Frontend | SvelteKit 5 + Tailwind | เพิ่ม `/studio` และ component เฉพาะ media |
| API | Hono บน Cloudflare Workers | เพิ่ม `mediaRoutes.ts` แยกจาก `index.ts` |
| Database | Cloudflare D1 | เพิ่ม migration ใหม่โดยไม่แก้ migration เก่า |
| Storage | R2 binding ชื่อ `R2` | ใช้ bucket `businessaios-exports` รุ่นแรก โดยแยก key prefix |
| Auth | Session cookie + `requireAuth` | แก้ exact-origin/CSRF ก่อน แล้วทุก asset/job ตรวจ user ownership |
| Credits | `deductCredits` / `addCredits` + ledger | เพิ่ม media credit hold ที่ idempotent แล้วเชื่อม ledger เดิม |
| API client | `apps/web/src/lib/api.ts` | เพิ่ม typed media API functions |
| Deployment | `businessaios-api` + `businessaios-web` | Deploy API ก่อน Web และเปิดด้วย feature flag |

### 3.2 ภาพรวมระบบใหม่

```text
SvelteKit Creative Studio
        |
        v
Hono Media Routes
  |       |          |          |
  |       |          |          +--> D1: jobs, assets, references, pricing
  |       |          +-------------> R2: inputs, outputs, thumbnails, fonts
  |       +------------------------> D1 Work Queue / Outbox
  |
  +--> Media Credit Hold
  |
  +--> Provider Router
           |
           +--> fal.ai Adapter (Release 1)
           +--> Kie.ai Adapter (future)
           +--> Direct Provider Adapter (future)
                    |
                    v
              Signed Webhook
                    |
                    v
          Verify -> Persist Event -> 2xx
                    |
                    v
          Cron Reconciler / Work Processor
                    |
                    v
      Poll -> Copy output to R2 -> Deliver
                    |
                    v
             Finalize / Refund
```

### 3.3 หลักการออกแบบ

- Frontend ไม่รู้ provider-specific parameter
- Frontend อ่าน capability และ pricing จาก model catalog
- Prompt กลางของ BusinessAiOs ใช้ `@mention`; adapter เป็นผู้แปลงเป็น schema ของโมเดล
- Provider API key อยู่ใน Worker secret เท่านั้น
- R2 เป็น source of truth ของไฟล์ที่ผู้ใช้เป็นเจ้าของ ไม่พึ่ง URL ชั่วคราวของ provider
- ทุก billing transition ต้องทำซ้ำได้โดยไม่หักหรือคืนเครดิตซ้ำ
- Generation job ต้อง recover ได้แม้ Worker request จบ ผู้ใช้ปิดหน้า หรือ webhook มาซ้ำ
- Browser polling มีไว้แสดงสถานะเท่านั้น ไม่ใช่กลไกทำงานเบื้องหลัง
- Webhook ต้อง acknowledge เร็ว; งานหนักทั้งหมดทำผ่าน durable work item
- Cron Trigger รันทุก 1 นาทีและประมวลผล bounded batch; `waitUntil()` ใช้เร่งงานได้แต่ไม่ใช่ durability guarantee
- ราคาผู้ใช้ถูก lock ตอนยืนยัน และห้าม true-up เพิ่มโดยไม่มี consent ใหม่
- ผู้ใช้ถูกคิดเครดิตเมื่อมี output ที่ BusinessAiOs ส่งมอบได้เท่านั้น
- Safety เป็น policy layer ของระบบ ไม่ใช่ control สำหรับ bypass provider

---

## 4. User Flow หลัก

### 4.1 สร้างภาพใหม่

1. ผู้ใช้เปิด `/studio`
2. ระบบโหลด active model catalog และเครดิตคงเหลือ
3. ผู้ใช้เลือกโมเดล
4. UI เปลี่ยน controls ตาม capability ของโมเดล
5. ผู้ใช้เขียน prompt และเลือก output options
6. ระบบเรียก pricing preview ทุกครั้งที่ input สำคัญเปลี่ยน
7. ผู้ใช้กด Generate
8. API ตรวจ auth, policy, model availability และเครดิต
9. API ตรวจ `Idempotency-Key` และ pricing version
10. API สร้าง generation, credit hold และ work item แบบ atomic
11. UI แสดง queued/processing และ polling เป็น fallback
12. Work processor ส่ง job ไป provider และเก็บ provider request ID
13. Webhook ตรวจ signature, persist event แล้วตอบทันที
14. Work processor หรือ scheduled reconciler ตรวจผลและ copy เข้า R2
15. API ตรวจว่า output เปิดได้ก่อน finalize เครดิต
16. ถ้าส่งมอบไม่ได้ภายใน deadline ให้ refund แม้ provider จะคิดเงิน BusinessAiOs แล้ว
17. UI แสดงภาพพร้อม Download, Favorite, Reuse และ Use as Reference

### 4.2 ใช้หลาย reference ด้วย `@mention`

1. ผู้ใช้อัปโหลดหรือเลือก asset จาก Library
2. ระบบสร้าง thumbnail และ mention name เช่น `@product`
3. ผู้ใช้เปลี่ยนชื่อและ role ได้
4. ผู้ใช้พิมพ์ `@` ใน prompt
5. Autocomplete แสดงชื่อ role และ thumbnail
6. ก่อน generate ระบบตรวจว่า mention ทุกตัวอ้าง asset ที่ยังมีอยู่
7. Reference Resolver เรียง asset ตาม `sort_order`
8. Provider adapter แปลง `@product` เป็น syntax/input ที่โมเดลนั้นรองรับ
9. ถ้าโมเดลรองรับภาพน้อยกว่าที่เลือก UI ต้อง block และเสนอให้ลบบางภาพหรือเปลี่ยนโมเดล

ตัวอย่าง prompt กลาง:

```text
นำ @product วางตามตำแหน่งของ @composition
ให้ @subject ถือสินค้า โดยรักษาใบหน้าเดิม
ใช้แสง สี และ mood จาก @style
```

### 4.3 ใช้ Brand Kit

1. ผู้ใช้สร้าง Brand Kit หรือเลือก kit ที่มีอยู่
2. เลือก logo, color palette, font และ product assets
3. Generate ภาพพื้นฐานโดยเว้นพื้นที่ข้อความตาม layout
4. เปิด composition editor
5. วางข้อความจริงด้วย font ที่อัปโหลด
6. วาง logo ต้นฉบับโดยไม่ให้ image model วาดใหม่
7. Export หลาย aspect ratio โดย reuse base image และ editable overlays

---

## 5. Data Model ที่เสนอ

ให้สร้าง migration ใหม่ เช่น `apps/api/migrations/009-creative-studio.sql` และเพิ่มตารางใหม่แบบ additive เท่านั้น

### 5.1 `ai_models`

เก็บ catalog และ config ของโมเดลที่ frontend อ่านได้

| Field | Type | หมายเหตุ |
|---|---|---|
| `id` | TEXT PK | internal stable ID |
| `provider` | TEXT | `fal`, `kie`, `direct` |
| `provider_model_id` | TEXT | endpoint/model key จริง |
| `display_name` | TEXT | ชื่อที่ผู้ใช้เห็น |
| `model_type` | TEXT | `image` รุ่นแรก |
| `operation` | TEXT | `text_to_image`, `image_to_image`, `multi_image_edit` |
| `capabilities_json` | TEXT JSON | references, ratios, resolutions, formats, count limits |
| `pricing_json` | TEXT JSON | credit rules และ provider cost metadata |
| `pricing_version` | TEXT | เปลี่ยนทุกครั้งที่ user-facing price เปลี่ยน |
| `safety_config_json` | TEXT JSON | policy profile ที่ backend ใช้ |
| `adapter_config_json` | TEXT JSON | parameter mapping ที่ไม่ใช่ secret |
| `config_version` | INTEGER | optimistic locking/admin audit |
| `is_active` | INTEGER | เปิดให้ user เลือก |
| `is_maintenance` | INTEGER | แสดงแต่ generate ไม่ได้ |
| `sort_order` | INTEGER | ลำดับใน selector |
| `created_at` | INTEGER | timestamp |
| `updated_at` | INTEGER | timestamp |

ห้ามเก็บ API key หรือ webhook secret ใน JSON columns

ทุก JSON config ต้องผ่าน runtime schema validation ทั้งตอน admin save และตอน catalog load หาก config ไม่ผ่านให้โมเดลเข้า maintenance อัตโนมัติแทนการส่ง invalid request ไป provider

หนึ่ง catalog row แทนหนึ่ง provider model + operation หาก provider model เดียวรองรับหลาย operation ให้มีหลาย row ที่ใช้ display grouping เดียวกัน และมี unique constraint บน `(provider, provider_model_id, operation)`

### 5.2 `media_assets`

เก็บ metadata ของ input, output, logo, font และ thumbnail

| Field | Type | หมายเหตุ |
|---|---|---|
| `id` | TEXT PK | asset ID |
| `user_id` | TEXT FK | owner |
| `generation_id` | TEXT nullable | output จาก job ใด |
| `asset_type` | TEXT | image, product, logo, font, mask, thumbnail |
| `source` | TEXT | upload, generation, derived, import |
| `r2_key` | TEXT | private object key |
| `thumbnail_r2_key` | TEXT nullable | preview key |
| `original_filename` | TEXT nullable | display only |
| `mime_type` | TEXT | MIME ที่ตรวจจาก content |
| `file_size` | INTEGER | bytes |
| `width` / `height` | INTEGER nullable | image dimensions |
| `metadata_json` | TEXT JSON | colors, crop, font metadata, OCR summary |
| `favorite` | INTEGER | favorite state หรือแยก table ภายหลัง |
| `lifecycle_status` | TEXT | active, archived, delete_requested, purge_pending, purged |
| `checksum_sha256` | TEXT nullable | deduplicate และ integrity check |
| `archived_at` | INTEGER nullable | ซ่อนจาก library ปกติ |
| `deleted_at` | INTEGER nullable | เวลาที่ user ขอ delete |
| `purge_after` | INTEGER nullable | เวลาที่ work processor ลบ R2 object ได้ |
| `created_at` / `updated_at` | INTEGER | timestamps |

R2 key convention:

```text
media/{user_id}/inputs/{asset_id}/original
media/{user_id}/inputs/{asset_id}/thumbnail.webp
media/{user_id}/outputs/{generation_id}/{asset_id}.{ext}
media/{user_id}/brand-assets/{asset_id}
media/{user_id}/fonts/{asset_id}.{ext}
```

Asset เชื่อมกับ Brand Kit ผ่าน `brand_assets` เท่านั้น เพื่อไม่ให้มี ownership relation ซ้ำและรองรับ asset เดียวอยู่ได้หลาย kit

### 5.3 `media_generations`

| Field | Type | หมายเหตุ |
|---|---|---|
| `id` | TEXT PK | generation ID |
| `user_id` | TEXT FK | owner |
| `model_id` | TEXT FK | model catalog ID |
| `client_idempotency_key` | TEXT | unique ต่อ user เพื่อกัน double-submit |
| `quote_id` | TEXT FK | pricing quote ที่ user ยืนยัน |
| `current_attempt_id` | TEXT nullable | attempt ปัจจุบัน; provider ID อยู่ที่ attempt เท่านั้น |
| `operation` | TEXT | normalized operation |
| `prompt` | TEXT | prompt กลางที่มี mention |
| `resolved_prompt` | TEXT nullable | prompt หลัง resolver; จำกัดการเปิดเผยใน UI |
| `options_json` | TEXT JSON | ratio, resolution, count, output format |
| `status` | TEXT | queued, submitting, processing, cancel_requested, delivery_pending, completed, failed, cancelled |
| `submission_state` | TEXT | pending, submitted, submission_unknown, acknowledged |
| `delivery_status` | TEXT | pending, ingesting, available, permanently_failed |
| `estimated_credits` | INTEGER | ราคาที่แสดงก่อนกด |
| `final_credits` | INTEGER nullable | ราคาสุดท้าย |
| `pricing_version` | TEXT | version ที่ user ยืนยัน |
| `pricing_snapshot_json` | TEXT JSON | quote ที่ lock ตอน submit |
| `expected_output_count` | INTEGER | จำนวน output ตาม quote |
| `delivered_output_count` | INTEGER | จำนวน output ที่พร้อมอ่านจาก R2 |
| `error_code` | TEXT nullable | normalized error |
| `error_message` | TEXT nullable | ข้อความที่ปลอดภัยต่อผู้ใช้ |
| `next_poll_at` | INTEGER nullable | schedule สำหรับ reconciler |
| `last_polled_at` | INTEGER nullable | poll ล่าสุด |
| `poll_attempts` | INTEGER | จำนวน status sync |
| `lease_until` | INTEGER nullable | กัน worker หลายตัวหยิบ job เดียวกัน |
| `delivery_deadline_at` | INTEGER nullable | deadline ก่อนถือว่าส่งมอบไม่ได้ |
| `cancel_requested_at` | INTEGER nullable | user ขอ cancel เมื่อใด |
| `started_at` / `completed_at` | INTEGER nullable | timings |
| `created_at` / `updated_at` | INTEGER | timestamps |

ต้องมี unique constraint บน `(user_id, client_idempotency_key)` คำขอซ้ำต้องคืน generation เดิมและห้าม reserve เครดิตหรือ submit provider ซ้ำ

### 5.4 `generation_references`

| Field | Type | หมายเหตุ |
|---|---|---|
| `id` | TEXT PK | reference ID |
| `generation_id` | TEXT FK | job |
| `asset_id` | TEXT FK | asset |
| `mention_name` | TEXT | เช่น `product`, ไม่รวม `@` |
| `reference_role` | TEXT | subject, product, style, composition |
| `influence_level` | TEXT | strict, balanced, loose |
| `sort_order` | INTEGER | map กับ provider input order |
| `crop_json` | TEXT nullable | crop ที่ใช้กับ job นี้ |
| `created_at` | INTEGER | timestamp |

ต้องมี unique constraint บน `(generation_id, mention_name)`

### 5.5 `generation_attempts`

เก็บแต่ละ provider call แยกจาก generation เพื่อรองรับ retry/fallback ในอนาคต

| Field | Type | หมายเหตุ |
|---|---|---|
| `id` | TEXT PK | attempt ID |
| `generation_id` | TEXT FK | parent job |
| `provider` | TEXT | provider |
| `provider_model_id` | TEXT | model endpoint |
| `provider_request_id` | TEXT nullable | external request ID |
| `callback_correlation_id` | TEXT | ID ที่ไม่เป็น secret สำหรับ map callback กลับ attempt |
| `status` | TEXT | pending_submit, submitting, submitted, submission_unknown, processing, succeeded, failed |
| `request_summary_json` | TEXT | ไม่มี secret และไม่เก็บ signed URL เต็มอายุยาว |
| `provider_cost_usd` | REAL nullable | unit economics |
| `error_code` | TEXT nullable | normalized provider error |
| `submit_started_at` / `submit_completed_at` | INTEGER nullable | ใช้ตรวจ crash window |
| `created_at` / `updated_at` | INTEGER | timestamps |

### 5.6 `media_credit_holds`

ใช้ generation ID เป็น idempotency boundary สำหรับการเงิน

| Field | Type | หมายเหตุ |
|---|---|---|
| `generation_id` | TEXT PK | ห้ามมี hold ซ้ำ |
| `user_id` | TEXT FK | owner |
| `reserved_credits` | INTEGER | จำนวนที่ reserve |
| `final_credits` | INTEGER nullable | จำนวนที่ finalize |
| `status` | TEXT | reserved, settlement_pending, finalized, refund_pending, refunded |
| `reserve_transaction_id` | TEXT nullable | ledger link |
| `final_transaction_id` | TEXT nullable | ledger link |
| `refund_transaction_id` | TEXT nullable | ledger link |
| `expires_at` | INTEGER | hold ที่หมดอายุต้องถูก reconciled |
| `settlement_reason` | TEXT nullable | delivery/provider/refund audit reason |
| `created_at` / `updated_at` | INTEGER | timestamps |

การ update balance, insert ledger และเปลี่ยน hold state ต้องอยู่ใน D1 transactional batch เดียวกัน ทุก transition ใช้ conditional update เช่น `WHERE status = 'reserved'` เพื่อให้ webhook/retry ที่มาซ้ำไม่ settle ซ้ำ

### 5.7 Brand Kit tables

`brand_kits`:

- `id`, `user_id`, `name`, `description`
- `colors_json`, `rules_json`
- `is_default`, `created_at`, `updated_at`

`brand_assets`:

- `id`, `brand_kit_id`, `asset_id`
- `role`: primary_logo, alternate_logo, font_heading, font_body, product, style_reference
- `settings_json`: placement rules, min size, clear space, default text color

### 5.8 Webhook idempotency

เพิ่ม `provider_webhook_events`:

- `id` เป็น hash ของ provider + request ID + payload hash หรือ provider event ID
- `provider`, `provider_request_id`, `payload_hash`
- `signature_verified`, `processing_status`, `processing_attempts`
- `received_at`, `processed_at`, `last_error`
- unique constraint ที่ป้องกัน event เดิมทำงานซ้ำ

Webhook handler ต้อง persist event แล้วตอบ `2xx` โดยเร็ว ห้าม copy output หรือ render image ภายใน request นี้

### 5.9 `media_work_items`

D1 outbox สำหรับงานที่ต้อง recover ได้โดยไม่พึ่ง browser หรือ `waitUntil()` เพียงอย่างเดียว

| Field | Type | หมายเหตุ |
|---|---|---|
| `id` | TEXT PK | work item ID |
| `generation_id` | TEXT nullable | parent generation |
| `asset_id` | TEXT nullable | parent asset สำหรับ purge/process |
| `work_type` | TEXT | validate_upload, cleanup_upload, submit_generation, reconcile_status, ingest_output, finalize_hold, refund_hold, purge_asset |
| `dedupe_key` | TEXT | unique key ต่อ logical work เพื่อกัน enqueue ซ้ำ |
| `status` | TEXT | pending, leased, completed, failed, dead_letter |
| `available_at` | INTEGER | เวลาที่หยิบงานได้ |
| `lease_until` | INTEGER nullable | lease หมดอายุแล้วหยิบใหม่ได้ |
| `attempts` | INTEGER | retry count |
| `max_attempts` | INTEGER | ก่อนเข้า dead letter |
| `payload_json` | TEXT JSON | IDs/metadata ที่ไม่มี secret URL |
| `last_error` | TEXT nullable | sanitized error |
| `created_at` / `updated_at` | INTEGER | timestamps |

Scheduled handler ต้อง claim งานด้วย conditional update, ใช้ unique `dedupe_key`, exponential backoff + jitter และมี dead-letter state ให้ admin reconcile ได้

### 5.10 `media_pricing_quotes`

เก็บราคาที่ผู้ใช้เห็นและยืนยัน เพื่อไม่ให้ admin price update เปลี่ยนราคากลางคำขอ

| Field | Type | หมายเหตุ |
|---|---|---|
| `id` | TEXT PK | quote ID |
| `user_id` | TEXT FK | owner |
| `model_id` | TEXT FK | model |
| `request_hash` | TEXT | hash ของ operation/options/reference count |
| `pricing_version` | TEXT | version ตอนออก quote |
| `credits` | INTEGER | ราคาที่ lock |
| `pricing_snapshot_json` | TEXT JSON | rule/cost snapshot สำหรับ audit |
| `expires_at` | INTEGER | quote expiry |
| `consumed_generation_id` | TEXT nullable | generation ที่ใช้ quote |
| `created_at` | INTEGER | timestamp |

Quote ใช้ได้กับ request hash เดิมเท่านั้น หากหมดอายุหรือ request เปลี่ยนต้องออก quote ใหม่ การ consume quote และสร้าง generation/hold/work item ต้องอยู่ใน D1 batch เดียวกัน

### 5.11 `media_upload_intents`

รองรับ one-time streaming upload เข้า quarantine โดยไม่เปิด R2 ต่อ browser โดยตรง

| Field | Type | หมายเหตุ |
|---|---|---|
| `id` | TEXT PK | intent ID |
| `user_id` | TEXT FK | owner |
| `asset_id` | TEXT FK | pending asset |
| `token_hash` | TEXT | เก็บ hash ไม่เก็บ raw upload token |
| `expected_mime_type` | TEXT | declared MIME |
| `expected_size` | INTEGER | declared bytes |
| `quarantine_r2_key` | TEXT | server-generated key |
| `status` | TEXT | pending, uploading, uploaded, finalized, rejected, expired |
| `expires_at` | INTEGER | token expiry |
| `consumed_at` | INTEGER nullable | ป้องกัน token reuse |
| `created_at` / `updated_at` | INTEGER | timestamps |

Upload route ต้องเปลี่ยน intent จาก pending เป็น uploading ด้วย conditional update ตรวจ `Content-Length` เมื่อมี stream โดยไม่ buffer และให้ cleanup worker ลบ intent/object ที่หมดอายุ

---

## 6. API Contract ที่เสนอ

ทุก endpoint ยกเว้น provider callback และ one-time upload/provider-content route ต้องใช้ `requireAuth`

Mutation endpoint ที่ใช้ session cookie ต้องผ่าน `requireTrustedOrigin` และ `requireCsrf` เพิ่มเติม ส่วน Bearer/MCP request ไม่ใช้ cookie จึงไม่ต้องใช้ CSRF token แต่ยังต้องผ่าน token scope และ rate limit

Exact browser origins รุ่นแรก:

```text
https://businessaios-web.pskspace.workers.dev
https://businessaios.pages.dev
https://app.businessaios.com (เมื่อเปิด custom domain)
http://localhost:<approved-dev-ports>
```

ห้ามใช้ suffix allowlist เช่น `*.workers.dev`, `*.pages.dev` หรือ `origin.includes('localhost')`

### 6.1 Model catalog และ pricing

```text
GET  /api/media/models
POST /api/media/pricing/preview
```

Pricing preview input:

```json
{
  "model_id": "model-id",
  "operation": "multi_image_edit",
  "options": {
    "resolution": "1K",
    "num_images": 1,
    "aspect_ratio": "1:1"
  },
  "reference_count": 2
}
```

Response ต้องมี `credits`, `currency_note`, `capability_warnings`, `pricing_version`, `quote_id` และ `expires_at`

ตอน submit backend ต้องเทียบ quote/model/options ใหม่ หาก quote หมดอายุหรือราคาสูงขึ้นให้ตอบ `409 price_changed` พร้อม quote ใหม่ และรอ user ยืนยัน ห้ามหักราคาที่สูงกว่าเดิมโดยอัตโนมัติ

### 6.2 Asset API

```text
POST   /api/media/assets/upload-intents
PUT    /api/media/uploads/:intentId
POST   /api/media/assets/:id/finalize-upload
GET    /api/media/assets
GET    /api/media/assets/:id
GET    /api/media/assets/:id/content
GET    /api/media/provider-assets/:id
PATCH  /api/media/assets/:id
DELETE /api/media/assets/:id
POST   /api/media/assets/:id/favorite
POST   /api/media/assets/:id/derive-thumbnail
POST   /api/media/assets/:id/remove-background
```

Release 1 จำกัด image upload เริ่มต้นที่ 10 MB ต่อไฟล์ และใช้ MIME allowlist ไม่เชื่อ file extension

Release 1A เลือกใช้ **Worker streaming gateway + R2 binding** เพื่อไม่เพิ่ม R2 S3 credentials:

1. Authenticated JSON request สร้าง upload intent และ one-time upload token
2. Browser `PUT` binary stream ไป Worker โดยไม่ buffer ทั้งไฟล์
3. Worker stream raw object เข้า `media-quarantine/` prefix
4. Finalize endpoint สร้าง validation work item
5. Work processor ตรวจ magic bytes, dimensions, max megapixels และ metadata
6. ผ่านแล้วจึงย้าย/copy ไป canonical `media/{user_id}/inputs/` path
7. ไม่ผ่านให้ลบ quarantine object และ mark rejected

Provider อ่าน reference ผ่าน HMAC-signed Worker content URL ที่ผูก `asset_id`, `purpose=provider_input` และ expiry สั้น ส่วน user download ใช้ authenticated content endpoint URL import และ direct R2 S3 presigned upload เลื่อนไป Phase หลังสำหรับ video/large assets

### 6.3 Generation API

```text
POST /api/media/generations
GET  /api/media/generations
GET  /api/media/generations/:id
POST /api/media/generations/:id/retry
POST /api/media/generations/:id/cancel
```

`POST /api/media/generations` ต้องรับ `Idempotency-Key` จาก client เพื่อกัน double-click/network retry

Request ต้องส่ง `quote_id` และ `expected_pricing_version` ด้วย คำขอซ้ำด้วย key เดิมต้องคืน generation เดิม หาก key เดิมถูกใช้กับ request body คนละ hash ให้ตอบ `409 idempotency_conflict`

### 6.4 Provider callback

```text
POST /api/media/webhooks/fal?attempt=<callback-correlation-id>
```

`attempt` เป็น opaque correlation ID ที่ไม่ใช่ secret ใช้ map callback กลับ write-ahead attempt ในกรณี provider รับ job แล้ว submit response กลับมาไม่ถึง Worker ความน่าเชื่อถือของ callback ยังคงมาจาก fal signature ไม่ใช่ query parameter

Callback flow:

1. อ่าน raw body ก่อน JSON parse
2. บังคับตรวจ fal ED25519 signature, required headers และ timestamp replay window
3. cache fal JWKS ตาม cache headers แต่ไม่เกิน 24 ชั่วโมง
4. insert webhook event แบบ unique
5. หา attempt ด้วย provider request ID/callback correlation ID
6. สร้าง `ingest_output` หรือ `refund_hold` work item
7. ตอบ `2xx` โดยไม่รอ download/copy/render

ห้ามใช้ secret ใน callback path สำหรับ fal หากเพิ่ม provider ที่ไม่มี signed webhook ต้องทำ provider-specific threat model และใช้ callback credential ที่แยกจาก media URL signing secret

### 6.5 Brand Kit API

```text
GET    /api/brand-kits
POST   /api/brand-kits
GET    /api/brand-kits/:id
PATCH  /api/brand-kits/:id
DELETE /api/brand-kits/:id
POST   /api/brand-kits/:id/assets
DELETE /api/brand-kits/:id/assets/:assetId
POST   /api/media/compositions/render
```

---

## 7. Provider Adapter Contract

สร้าง interface กลาง เช่น:

```typescript
type MediaProviderAdapter = {
  validate(input: NormalizedGenerationInput, model: AiModel): ValidationResult;
  estimate(input: NormalizedGenerationInput, model: AiModel): PriceEstimate;
  submit(input: ResolvedGenerationInput, model: AiModel): Promise<ProviderSubmission>;
  getStatus(requestId: string, model: AiModel): Promise<ProviderStatus>;
  cancel?(requestId: string, model: AiModel): Promise<void>;
  verifyWebhook(rawBody: ArrayBuffer, headers: Headers): Promise<WebhookVerification>;
  parseWebhook(rawBody: ArrayBuffer, headers: Headers): Promise<ProviderEvent>;
};
```

Normalized input ต้องประกอบด้วย:

- prompt
- references พร้อม role, influence และ stable ordering
- output options
- signed input URLs ที่มีอายุสั้น
- internal generation ID
- callback correlation ID ที่ไม่ใช่ secret
- callback URL

Adapter ห้ามรับ user ID, credit balance หรือ business billing rule เพราะเป็นความรับผิดชอบของ service layer

### Reference Resolver

Resolver ต้อง:

1. parse mention tokens จาก prompt
2. validate กับ `generation_references`
3. ตรวจ model capability
4. map mention ไปยัง input index หรือ provider element
5. สร้าง provider-safe prompt
6. เก็บ mapping summary เพื่อ debug โดยไม่เก็บ secret URL
7. ไม่อ้างว่า Strict ทำได้ 100% หาก provider ไม่มี parameter รองรับจริง

หาก provider ไม่รองรับ influence level ให้ adapter แปลงเป็น prompt guidance และ UI ต้องระบุว่าเป็น guidance ไม่ใช่ exact lock

---

## 8. Credit และ Pricing Design

### 8.1 Pricing source of truth

- ราคาที่ผู้ใช้เห็นมาจาก `ai_models.pricing_json`
- ทุก preview สร้าง quote ที่มี `pricing_version`, request hash และ expiry
- ตอนสร้าง job backend คำนวณใหม่เสมอ ไม่เชื่อค่าจาก browser
- เก็บ pricing snapshot และราคาที่ user ยืนยันบน generation
- เก็บ provider cost จริงบน attempt สำหรับคำนวณ margin
- ราคาที่ user ยืนยันเป็นเพดาน ห้าม true-up เพิ่ม หากต้นทุน provider เปลี่ยนให้ platform รับส่วนต่างจนกว่าจะออก pricing version ใหม่

### 8.2 Credit state machine

```text
none -> reserved -> settlement_pending -> finalized
                  -> refund_pending ----> refunded
```

Rules:

- ห้ามสร้าง provider job ก่อน reserve สำเร็จ
- generation หนึ่งรายการมี active hold ได้หนึ่งรายการ
- webhook ซ้ำต้อง finalize ได้ครั้งเดียว
- retry ภายในระบบใช้ hold เดิมและ attempt ใหม่เมื่อยืนยันว่าไม่สร้าง provider charge ซ้ำ
- user กด Retry หลัง terminal failure ต้องสร้าง generation + quote + hold ใหม่ เว้นแต่เป็น delivery retry ของ output เดิม
- cancel ก่อน provider submit ให้ยกเลิก work item และ refund; cancel หลัง submit เป็น best-effort และรอ provider outcome ก่อน settle
- validation failure ก่อน provider submit ให้ refund เต็มจำนวน
- provider failure ให้ refund ตาม pricing policy ที่ประกาศต่อผู้ใช้
- provider สำเร็จแต่ copy/post-processing ล้มเหลวให้ค้าง `delivery_pending` และ retry จนถึง deadline
- finalize เมื่อ output อยู่ใน R2 และ authenticated read check ผ่านแล้วเท่านั้น
- งานหลายภาพ finalize เมื่อ delivered count ครบตาม quote เท่านั้น; Release 1 ใช้ all-or-nothing billing
- ถ้าส่งมอบ output ไม่ได้ภายใน deadline ให้ refund user เต็มจำนวน แม้ provider คิดเงิน BusinessAiOs แล้ว
- hold ที่หมดอายุต้องถูก scheduled reconciler เปลี่ยนเป็น finalize หรือ refund อย่างมีเหตุผลใน audit log

### 8.3 ราคาแนะนำสำหรับ MVP

ก่อนเปิด production ต้องคำนวณต่อโมเดลจาก:

```text
provider_cost_usd
+ payment/FX buffer
+ storage/egress allowance
+ retry/failure allowance
+ gross margin target
= user credit price
```

ใช้ integer credits เท่านั้น และกำหนด minimum charge ต่อ job เพื่อหลีกเลี่ยงเศษเครดิต

---

## 9. Reference Workspace Specification

### 9.1 Reference Tray

แต่ละ thumbnail ต้องแสดง:

- รูป preview
- mention name
- role
- influence level
- remove action
- drag handle
- validation/processing status

Stable dimensions ต้องไม่เปลี่ยนเมื่อชื่อยาวหรือ status เปลี่ยน

### 9.2 Upload paths

- File picker
- Drag and drop
- Paste clipboard
- Select from Asset Library
- Use output from Generation History
- URL import อยู่ Phase หลัง หากยังไม่มี SSRF-safe fetch proxy

### 9.3 Mention editor behavior

- พิมพ์ `@` แล้วเปิด autocomplete
- เลือกด้วย keyboard ได้
- แสดง thumbnail ข้างชื่อ
- ชื่อ mention ใช้ `[a-z0-9_]` ภายใน แม้ display label เป็นภาษาไทยได้
- rename แล้ว update token ใน prompt หลัง user ยืนยัน
- ลบ asset ที่ถูกอ้างต้องแสดง unresolved token ไม่ลบ prompt เงียบ ๆ
- block Generate เมื่อมี unresolved token
- prompt ที่ไม่มี mention ยังส่ง references ได้ แต่ UI ต้องเตือนว่าโมเดลอาจไม่รู้ว่าภาพไหนทำหน้าที่อะไร

### 9.4 Preprocessing

ก่อนเก็บหรือส่ง provider:

- stream raw upload เข้า quarantine ก่อน ห้าม buffer ไฟล์ทั้งก้อนใน Worker memory
- validate magic bytes และ MIME
- normalize orientation
- strip EXIF/GPS
- จำกัด dimensions, max megapixels และ decompression size
- สร้าง thumbnail เป็น WebP
- เก็บ checksum เพื่อช่วย deduplicate upload
- sanitize filename
- reject animated image ใน Release 1 ถ้า model path ไม่รองรับ
- reject SVG เป็น image reference จนกว่าจะมี sanitizer/rasterizer ที่ตรวจแล้ว

### 9.5 Reference Inspector ใน Release 1

- dimensions, file size, aspect ratio
- crop
- dominant colors
- background status
- suggested role/name
- warning เมื่อภาพต่ำกว่า model requirement

OCR, face analysis และ auto-subject segmentation ขั้นสูงเปิดภายหลังเมื่อ privacy/cost ได้ข้อสรุป

Phase 0 ต้องทำ Worker-compatible image-processing spike ให้ผ่านกับภาพ JPEG/PNG/WebP ขนาดสูงสุดจริง วัด peak memory/CPU และเลือก processor ก่อนยืนยัน estimate ของ Phase 2 หาก processor ใช้ memory เกินข้อจำกัด ให้ย้าย transform ไป Cloudflare Images หรือ media-processing service แยก แต่ ownership metadata และ R2 source of truth ยังคงอยู่ใน BusinessAiOs

---

## 10. Brand Kit และ Font Composition

### 10.1 เหตุผลที่ต้อง post-compose

โลโก้และข้อความต้องไม่พึ่ง image model วาดใหม่ เพราะอาจสะกดผิด บิดโลโก้ หรือใช้ฟอนต์ไม่ตรงแบรนด์ ให้ AI สร้าง base image แล้ว BusinessAiOs วางองค์ประกอบจริงทับภายหลัง

### 10.2 Font upload flow

1. ตรวจ extension และ MIME
2. จำกัดขนาดไฟล์
3. ผู้ใช้ยืนยันว่ามีสิทธิ์ใช้งาน font
4. อ่าน font family/style/weight metadata
5. เก็บ private ใน R2
6. สร้าง preview specimen
7. ผูกกับ heading/body role ใน Brand Kit
8. ใช้เฉพาะภายในงานของ owner

### 10.3 Composition document

เก็บ overlay เป็น JSON แยกจาก base image:

```json
{
  "canvas": { "width": 1080, "height": 1080 },
  "base_asset_id": "asset-id",
  "layers": [
    { "type": "text", "text": "Headline", "font_asset_id": "font-id", "x": 80, "y": 80 },
    { "type": "image", "asset_id": "logo-id", "x": 820, "y": 60, "width": 180 }
  ]
}
```

### 10.4 Technical spike ก่อนเลือก renderer

ทดสอบสองทางเลือก:

1. Worker-side render ด้วย WASM-compatible renderer เพื่อให้ export deterministic
2. Browser canvas สำหรับ editor แล้วส่ง composition JSON ไป render ฝั่ง server

เกณฑ์ตัดสิน: ภาษาไทย, custom fonts, high-resolution output, memory usage บน Worker, reproducibility และเวลาประมวลผล

---

## 11. Safety, Privacy และ Security

### 11.1 Content policy

- กำหนด policy profile ต่อโมเดลจาก backend
- ทำ input validation/moderation ตามความเสี่ยงของ use case
- เคารพข้อจำกัดของ provider ทุกตัว
- ไม่เปิด raw control ที่มีไว้ลดหรือ bypass safety
- normalize rejection message และคืนเครดิตตาม policy
- fallback ได้เฉพาะโมเดลที่ capability และ policy เข้ากัน

### 11.2 บุคคล ใบหน้า และแบรนด์

- มี consent acknowledgement เมื่ออัปโหลดใบหน้าบุคคลจริง
- ห้ามสร้าง UI ที่สื่อว่าใช้ใบหน้าคนอื่นได้โดยไม่มีสิทธิ์
- บันทึก consent version/time ใน metadata เมื่อ workflow ต้องใช้
- มีช่องทาง report/delete asset
- Brand assets และ font ต้องมี ownership/license confirmation
- ก่อน generate ครั้งแรกต้องแจ้งชัดว่า prompt/reference จะถูกส่งไป external AI provider เพื่อประมวลผล
- บันทึก policy/privacy notice version ที่ user ยอมรับ และทบทวน provider retention/DPA ก่อนเปิด production

### 11.3 Asset security

- R2 object เป็น private
- Content endpoint ตรวจ owner หรือ signed token อายุสั้น
- Signed URL ต้องผูก asset ID, purpose และ expiry
- Provider input URL ใช้ TTL สั้นที่สุดที่ครอบคลุม queue time และออกใหม่ได้จาก reconciler
- ป้องกัน path traversal โดยสร้าง R2 key ฝั่ง server
- ไม่สะท้อนชื่อไฟล์ user เป็น header โดยไม่ sanitize
- ใช้ `Content-Disposition` ที่ปลอดภัย
- จำกัด rate, upload count และ storage quota ต่อ user
- log asset access แบบไม่บันทึก signed token
- แยก Archive ออกจาก Delete และมี scheduled purge สำหรับ original, thumbnail และ derived assets
- signed URL เป็น bearer token และ revoke ก่อนหมดอายุไม่ได้ จึงห้ามใช้ TTL ยาว

### 11.4 Browser request security

- แก้ CORS allowlist เดิมให้เป็น exact origin set ก่อนเริ่ม media endpoint
- mutation ที่ใช้ session cookie ต้องตรวจ exact `Origin`
- เพิ่ม `GET /api/auth/csrf`; ออก CSRF token แบบ HMAC ที่ผูก session ID + expiry โดยใช้ `CSRF_SIGNING_SECRET`
- mutation ส่ง token ผ่าน `X-CSRF-Token`; backend ตรวจ signature, session binding และ expiry
- multipart/binary upload ต้องใช้ one-time upload token และ exact-origin CORS
- Bearer/MCP request ใช้ token scope แทน cookie/CSRF
- rate limit ต้องมีทั้ง IP, user ID, active-job concurrency และ daily credit-spend ceiling

### 11.5 Webhook security

- fal callback ต้องตรวจ ED25519 signature และ timestamp ทุกครั้ง
- ใช้ raw request body ในการ verify ก่อน parse JSON
- cache JWKS ไม่เกิน provider recommendation
- verify request ID กับ attempt ใน D1
- อย่าเชื่อ output URL จาก webhook โดยไม่ตรวจ scheme, host policy, MIME และ size
- webhook event ต้อง idempotent
- webhook persist event/work item แล้วตอบทันที งานหนักทำโดย work processor

### 11.6 Asset lifecycle

```text
active -> archived -> active
active/archived -> delete_requested -> purge_pending -> purged
```

- Archive ซ่อนจาก picker แต่ไม่ลบไฟล์
- Delete requested ปิดการสร้าง signed URL ใหม่ทันที
- Purge worker ตรวจ generation/reference dependencies ก่อนลบ R2
- เมื่อ purge สำเร็จให้ล้าง R2 keys, sensitive metadata และปรับ storage quota
- เก็บ audit metadata เท่าที่จำเป็นโดยไม่เก็บ prompt/asset content เกิน retention policy

---

## 12. Phase-by-Phase Implementation

## Phase 0 - Provider and Architecture Spike

ระยะเวลา: 3-4 วัน

### Steps

- [ ] แก้ current CORS จาก wildcard/suffix matching เป็น exact origin set
- [ ] เพิ่ม trusted-origin + CSRF middleware และทดสอบกับ session cookie `SameSite=None`
- [ ] สร้าง staging Worker, D1 และ R2 แยกจาก production
- [ ] ยืนยัน provider account และ production API access
- [ ] เลือกโมเดล 2-3 ตัวที่ครอบคลุม text-to-image, single-reference และ multi-reference
- [ ] บันทึก input schema, output schema, queue, webhook, cancel และ pricing ของแต่ละโมเดล
- [ ] ทดสอบ upload/reference ผ่าน server-side API key
- [ ] ทดสอบ webhook บน Worker dev URL
- [ ] วัดเวลาสร้าง ค่าใช้จ่าย และ failure mode อย่างน้อย 3 ครั้งต่อโมเดล
- [ ] สรุป model capability matrix
- [ ] ออกแบบ HMAC-signed Worker content URL และ TTL สำหรับ provider input
- [ ] ยืนยัน Worker streaming gateway + quarantine pipeline สำหรับ Release 1A
- [ ] ทำ image-processing spike: magic bytes, EXIF strip, orientation, thumbnail และ max-megapixel rejection
- [ ] วัด peak Worker memory/CPU ด้วยไฟล์ขนาดสูงสุดและ concurrent requests
- [ ] ทดสอบ fal ED25519 webhook verification จาก raw body + JWKS cache
- [ ] ออกแบบ D1 outbox + Cron Trigger และทดสอบ lease/retry หนึ่งรอบ
- [ ] ตัดสินใจ retention policy และ max upload size
- [ ] กำหนด credit markup รุ่น beta

### Deliverables

- Provider decision record
- Model capability/pricing matrix
- Security hardening tests และ exact-origin list
- Image processor compatibility/memory report
- Staging resource IDs และ deployment config
- ตัวอย่าง sanitized request/response fixtures สำหรับ tests
- รายการ Worker secrets ที่ต้องเพิ่ม

### Exit Criteria

- เรียก generation ผ่าน backend ได้จริงอย่างน้อย 1 โมเดล
- ได้ผลผ่าน async queue/webhook
- คำนวณ cost ต่อ output ได้
- ไม่มี provider key ออกไป browser
- origin ที่ไม่อยู่ exact allowlist ใช้ session API ไม่ได้
- image processor ผ่าน max-size test โดยไม่เกิน Worker limits
- staging แยก data/storage/secrets จาก production

## Phase 1 - Data Foundation and Feature Flag

ระยะเวลา: 2-3 วัน

### Steps

- [ ] สร้าง `009-creative-studio.sql`
- [ ] เพิ่ม tables และ indexes ตาม Section 5
- [ ] เพิ่ม `media_work_items`, leases, hold expiry, pricing snapshot และ persistent idempotency fields
- [ ] เพิ่มทุก table ใหม่ใน migration gate test
- [ ] ทดสอบ migration จาก fresh local database
- [ ] ทดสอบ migration ต่อจาก schema ปัจจุบัน
- [ ] เพิ่ม Bindings: provider secret, media signing secret และ feature flags
- [ ] เพิ่ม `creative_studio` ใน `/api/config`
- [ ] seed model catalog แบบ idempotent
- [ ] validate model/pricing/capability JSON ด้วย runtime schema และ config version
- [ ] สร้าง route module `mediaRoutes.ts`
- [ ] mount route module ใน `index.ts`
- [ ] เพิ่ม Cron Trigger และ scheduled handler shell

### Exit Criteria

- Migration test ผ่าน
- Catalog endpoint คืนเฉพาะ active models
- Feature flag ปิดแล้ว user ทั่วไปเข้าไม่ได้
- request key ซ้ำถูก unique constraint ป้องกันใน database
- work item lease หมดอายุแล้ว worker อื่นหยิบต่อได้
- ไม่มีการแก้ migration เก่าหรือกระทบ existing tools

## Phase 2 - Asset Pipeline and Reference Workspace Backend

ระยะเวลา: 3-4 วัน

### Steps

- [ ] สร้าง upload intent endpoint พร้อม auth, CSRF และ quota
- [ ] สร้าง one-time binary upload route ที่ stream เข้า R2 quarantine
- [ ] validate magic bytes, MIME, size และ dimensions
- [ ] strip metadata และ normalize image
- [ ] สร้าง thumbnail
- [ ] เขียน input/thumbnail ลง R2 ด้วย key convention กลาง
- [ ] บันทึก asset ownership ใน D1
- [ ] สร้าง list/filter/archive/favorite endpoints
- [ ] สร้าง signed media URL service
- [ ] ผูก signed URL กับ asset, purpose, expiry และ short TTL
- [ ] ทดสอบ owner access, cross-user denial และ expired URL
- [ ] สร้าง reference validation และ mention parser
- [ ] สร้าง Reference Resolver พร้อม model capability checks

### Exit Criteria

- ผู้ใช้ A อ่าน/ลบ asset ของผู้ใช้ B ไม่ได้
- ไฟล์ทุกชนิดที่ไม่อยู่ allowlist ถูกปฏิเสธ
- EXIF/GPS ไม่อยู่ใน processed output
- upload ที่ไม่ finalize/ไม่ผ่าน validation ถูก cleanup จาก quarantine
- binary upload ไม่ buffer ทั้งไฟล์ใน Worker memory
- `@mention` ที่หายหรือซ้ำถูกตรวจพบก่อน provider call

## Phase 3 - Provider Router, Async Jobs and Credits

ระยะเวลา: 4-6 วัน

### Steps

- [ ] สร้าง normalized provider types
- [ ] สร้าง provider registry/router
- [ ] implement `fal` adapter รุ่นแรก
- [ ] implement pricing preview service
- [ ] implement media credit hold ด้วย D1 batch
- [ ] สร้าง generation endpoint พร้อม persistent `Idempotency-Key`, request hash และ pricing quote
- [ ] บังคับ per-user active-job limit, request rate และ daily credit-spend ceiling ก่อน reserve
- [ ] reserve เครดิตก่อน submit provider
- [ ] สร้าง generation + hold + submit work item ใน D1 batch เดียวกัน
- [ ] สร้าง generation attempt แบบ write-ahead ก่อน provider call
- [ ] จัดการ `submission_unknown` crash window โดยไม่ auto-submit ซ้ำ
- [ ] implement fal raw-body signature verification และ event deduplication
- [ ] ให้ webhook persist event/work item แล้วตอบภายใน timeout budget
- [ ] implement work processor สำหรับ submit, reconcile, ingest, finalize/refund
- [ ] copy output จาก provider ไป R2 แล้ว authenticated read check
- [ ] finalize/refund แบบ idempotent และ delivery-aware
- [ ] implement scheduled polling/status sync เป็น durable fallback
- [ ] implement hold expiry reconciliation และ dead-letter handling
- [ ] เพิ่ม normalized errors: validation, policy_rejected, provider_failed, timeout, storage_failed
- [ ] เพิ่ม retry rules ที่ไม่ทำให้คิดเครดิตซ้ำผิดพลาด

### Exit Criteria

- double-click ไม่สร้าง job/charge ซ้ำ
- webhook ซ้ำไม่ finalize/refund ซ้ำ
- provider fail ก่อน submit คืนเครดิตเต็ม
- output สำเร็จถูกเก็บใน R2 ก่อน job เป็น completed
- provider สำเร็จแต่ R2 ชั่วคราวล้มเหลวเข้าสู่ `delivery_pending` และ retry ได้
- delivery ล้มเหลวถาวรคืนเครดิต user แม้ platform มี provider cost
- webhook หายยัง recover ได้จาก scheduled reconciler
- Worker crash หลัง provider submit ไม่ทำให้ submit ซ้ำโดยอัตโนมัติ
- restart/ปิด browser ไม่ทำให้ job หาย

## Phase 4 - Creative Studio Frontend

ระยะเวลา: 3-4 วัน

### Steps

- [ ] เพิ่ม route `/studio`
- [ ] เพิ่ม Studio entry ใน desktop/mobile navigation
- [ ] สร้าง Model Selector จาก catalog
- [ ] สร้าง Prompt Editor พร้อม `@mention` autocomplete
- [ ] สร้าง Reference Tray พร้อม role/influence/reorder/remove
- [ ] รองรับ file picker, drag/drop และ paste
- [ ] สร้าง aspect ratio segmented control
- [ ] สร้าง resolution/count controls ตาม capability
- [ ] แสดง credit estimate และ balance ก่อน Generate
- [ ] ส่ง CSRF token, quote ID, pricing version และ idempotency key จาก API client
- [ ] แสดง `409 price_changed` แล้วขอ user ยืนยันราคาใหม่
- [ ] แสดง validation warning และ maintenance state
- [ ] สร้าง queued/submitting/processing/cancel-requested/delivery-pending/completed/failed states
- [ ] ทำ polling ที่หยุดเมื่อ terminal state
- [ ] รองรับ mobile layout และ keyboard navigation
- [ ] เพิ่ม dark mode ตาม convention ของระบบปัจจุบัน

### Exit Criteria

- ผู้ใช้สร้างงานครบ flow ได้โดยไม่เปิด developer tools
- controls ที่โมเดลไม่รองรับไม่แสดงหรือ disabled พร้อมเหตุผล
- prompt อ้าง reference ได้ด้วย keyboard
- ไม่มี layout shift/ข้อความล้นบน mobile และ desktop
- refresh หน้าแล้วกลับมาติดตาม job เดิมได้
- price change ไม่หักเครดิตจน user ยืนยัน quote ใหม่

## Phase 5 - Library and Reuse Workflow

ระยะเวลา: 2-3 วัน

### Steps

- [ ] เพิ่ม `/studio/library`
- [ ] แยก tabs: Generated, Uploads, Products, People, Styles, Logos, Favorites
- [ ] เพิ่ม filters: model, status, date และ asset type
- [ ] เพิ่ม Download, Favorite, Archive
- [ ] เพิ่ม Reuse Prompt
- [ ] เพิ่ม Use as Reference
- [ ] เพิ่ม Retry จาก failed job
- [ ] แยก delivery retry จาก generation ใหม่ให้ผู้ใช้เข้าใจได้
- [ ] เพิ่ม empty/loading/error states
- [ ] ตรวจ pagination และ query limits

### Exit Criteria

- ผู้ใช้ค้นงานเก่าและนำกลับมา generate ต่อได้
- archived assets ไม่ปรากฏใน picker ปกติ
- download ตรวจ ownership ทุกครั้ง
- list API ไม่อ่านข้อมูลทุกแถวโดยไม่มี pagination

## Phase 6 - Admin, Observability and Policy (Release 1A)

ระยะเวลา: 2-3 วัน

### Steps

- [ ] เพิ่ม admin model list/edit/enable/maintenance
- [ ] เพิ่ม pricing version และ margin view ขั้นพื้นฐาน
- [ ] เพิ่ม generation status/error dashboard
- [ ] เพิ่ม provider latency/success-rate logging
- [ ] เพิ่ม manual reconcile action ที่มี admin audit log
- [ ] เพิ่ม policy configuration ที่ไม่เปิด provider secret/raw bypass controls
- [ ] เพิ่ม rate limit แยก upload, generate และ webhook
- [ ] เพิ่ม storage quota และ retention cleanup plan
- [ ] เพิ่ม purge worker และ orphan/quarantine cleanup
- [ ] เพิ่ม alert condition สำหรับ stuck jobs และ abnormal refund rate
- [ ] เพิ่ม alert สำหรับ expired hold, dead-letter work item และ `submission_unknown`

### Exit Criteria

- Admin ปิดโมเดลที่มีปัญหาได้โดยไม่ deploy
- ตรวจ generation ด้วย internal ID ได้ครบ job, attempt, hold และ ledger
- Manual action ทุกครั้งมี audit trail
- ไม่มี secret ใน log หรือ admin API response
- asset purge ปรับ quota และไม่ทิ้ง R2 orphan

## Phase 7 - QA, Rollout and Production Deployment (Release 1A)

ระยะเวลา: 3-4 วัน

### Steps

- [ ] deploy/test บน staging resources ก่อน production ทุกครั้ง
- [ ] รัน API unit/integration tests
- [ ] รัน migration gate
- [ ] รัน web build และตรวจ typecheck baseline ไม่เพิ่ม
- [ ] ทดสอบ E2E desktop/mobile และ light/dark
- [ ] ทดสอบ insufficient credit, duplicate submit, webhook duplicate และ provider timeout
- [ ] ทดสอบ untrusted origin, missing/invalid CSRF และ one-time upload token reuse
- [ ] ทดสอบ webhook signature, stale timestamp และ tampered body
- [ ] ทดสอบ crash หลัง provider submit, lost webhook และ expired work lease
- [ ] ทดสอบ `409 price_changed` และยืนยันว่าไม่มี upward true-up
- [ ] ทดสอบ cross-user asset access
- [ ] ทดสอบ failed generation refund
- [ ] ทดสอบ provider success + R2 failure + delivery retry/refund
- [ ] ทดสอบ archive/delete/purge และ orphan cleanup
- [ ] ทดสอบ R2 output และ download
- [ ] สำรอง/export D1 ก่อน production migration
- [ ] ตั้ง Worker secrets
- [ ] deploy/apply migration บน staging และรัน smoke/E2E
- [ ] deploy production API โดย feature flag ยังปิด
- [ ] apply production migration และ verify schema
- [ ] seed/verify model catalog
- [ ] smoke test ด้วย internal account
- [ ] deploy Web
- [ ] เปิด feature flag เฉพาะ admin/internal beta
- [ ] monitor 24-48 ชั่วโมง
- [ ] เปิดให้ beta users ตามลำดับ

### Exit Criteria

- Smoke test ผ่านทุก critical flow
- ไม่มี duplicate charge/refund
- ไม่มี asset leakage ข้าม user
- success/failure rate และ provider cost ถูกบันทึก
- rollback plan และ maintenance switch ใช้งานได้

## Phase 8 - Brand Kit and Composition (Release 1B)

ระยะเวลา: 7-10 วัน

### Steps

- [ ] สร้าง Brand Kit CRUD
- [ ] เพิ่ม logo/product/style asset roles
- [ ] เพิ่ม color palette editor แบบ swatches
- [ ] เพิ่ม font upload และ license confirmation
- [ ] parse font metadata และสร้าง preview
- [ ] ทำ renderer spike และเลือก production approach
- [ ] สร้าง composition document schema
- [ ] สร้าง text/logo overlay editor รุ่นแรก
- [ ] render/export PNG/JPEG
- [ ] ตรวจภาษาไทย custom font และ high-resolution output
- [ ] เพิ่ม brand constraints เข้า generation prompt อย่างมีโครงสร้าง
- [ ] รัน security, ownership, rendering และ export regression บน staging

### Exit Criteria

- โลโก้ output ใช้ไฟล์ต้นฉบับ ไม่ใช่โลโก้ที่ AI วาดใหม่
- ข้อความสะกดตรงกับ input และใช้ font ที่เลือก
- composition แก้ข้อความแล้ว export ใหม่ได้โดยไม่ generate base image
- font/logo ของผู้ใช้หนึ่งไม่รั่วไปอีกผู้ใช้หนึ่ง
- Release 1A generation/credit flow ไม่ regression

---

## 13. Proposed File Map

### API

```text
apps/api/src/mediaRoutes.ts
apps/api/src/brandKitRoutes.ts
apps/api/src/lib/csrf.ts
apps/api/src/lib/media/types.ts
apps/api/src/lib/media/catalog.ts
apps/api/src/lib/media/pricing.ts
apps/api/src/lib/media/referenceResolver.ts
apps/api/src/lib/media/assets.ts
apps/api/src/lib/media/credits.ts
apps/api/src/lib/media/signedUrls.ts
apps/api/src/lib/media/workItems.ts
apps/api/src/lib/media/reconciler.ts
apps/api/src/lib/media/providers/types.ts
apps/api/src/lib/media/providers/router.ts
apps/api/src/lib/media/providers/fal.ts
apps/api/src/lib/media/webhooks.ts
apps/api/migrations/009-creative-studio.sql
apps/api/test/media-credits.test.ts
apps/api/test/media-references.test.ts
apps/api/test/media-routes.test.ts
apps/api/test/media-work-items.test.ts
apps/api/test/media-webhooks.test.ts
apps/api/test/csrf.test.ts
apps/api/wrangler.toml                 # exact vars, Cron และ env.staging
```

### Web

```text
apps/web/src/routes/studio/+page.svelte
apps/web/src/routes/studio/library/+page.svelte
apps/web/src/routes/studio/brand-kits/+page.svelte
apps/web/src/lib/creative/ModelSelector.svelte
apps/web/src/lib/creative/PromptEditor.svelte
apps/web/src/lib/creative/ReferenceTray.svelte
apps/web/src/lib/creative/ReferenceCard.svelte
apps/web/src/lib/creative/AssetPicker.svelte
apps/web/src/lib/creative/GenerationStatus.svelte
apps/web/src/lib/creative/GenerationGrid.svelte
apps/web/src/lib/creative/CompositionEditor.svelte
apps/web/src/lib/mediaApi.ts
apps/web/src/lib/mediaTypes.ts
```

แยก `mediaApi.ts` ออกจาก `api.ts` เพราะไฟล์ API client ปัจจุบันมีขนาดใหญ่แล้ว และ feature นี้มี type/endpoint จำนวนมาก

---

## 14. Test Plan

### Unit tests

- Pricing rules ทุก combination ที่เปิดใช้
- Pricing quote expiry/version และห้าม upward true-up
- Mention parser และ rename behavior
- Reference ordering และ duplicate mention
- Provider input mapping
- Credit hold state transitions
- Work-item lease, backoff, dead-letter และ recovery
- Webhook event deduplication
- fal signature, stale timestamp และ tampered raw body
- Signed URL expiry และ tamper detection
- MIME/file validation
- exact-origin และ CSRF session binding

### Integration tests

- Migration สร้างทุก table/index
- Generation create + reserve
- Persistent idempotency key conflict/replay
- Failed submit + refund
- Successful webhook + R2 + finalize
- Submission response lost/crash window
- Lost webhook + scheduled reconciliation
- Provider success + R2 failure + delivery retry/refund
- Duplicate request idempotency
- Duplicate webhook idempotency
- Retry หลัง provider failure
- Archive/delete/purge และ quota adjustment
- Ownership enforcement ทุก asset/job endpoint

### Frontend tests

- Capability controls เปลี่ยนตาม model
- `@mention` autocomplete และ unresolved state
- Upload validation
- Insufficient credit state
- Async status transitions
- Refresh/resume job
- Library reuse workflow

### Manual/E2E matrix

| Scenario | Desktop | Mobile | Light | Dark |
|---|---:|---:|---:|---:|
| Text-to-image | Yes | Yes | Yes | Yes |
| Multi-reference | Yes | Yes | Yes | Yes |
| Failed/refund | Yes | Yes | Yes | Yes |
| Library/reuse | Yes | Yes | Yes | Yes |
| Brand composition | Yes | Yes | Yes | Yes |

มาตรฐาน verification ของ repository:

- `apps/api`: tests ต้องผ่านทั้งหมด
- `apps/web`: production build ต้องผ่าน
- ไฟล์ Creative Studio ใหม่/แก้ต้องไม่มี TypeScript/Svelte diagnostic ใหม่ และ error baseline ทั้ง repo ต้องไม่เพิ่ม
- ตรวจด้วย browser จริงว่าภาพโหลด ไม่ blank และ controls ไม่ overlap

---

## 15. Deployment Checklist

### Secrets/variables ที่คาดว่าจะเพิ่ม

```text
FAL_KEY
MEDIA_SIGNING_SECRET
CSRF_SIGNING_SECRET
CREATIVE_STUDIO_ENABLED
CREATIVE_STUDIO_BETA_USER_IDS (optional)
ALLOWED_ORIGIN (exact comma-separated origins only)
```

fal webhook ใช้ ED25519/JWKS verification จึงไม่ใช้ `MEDIA_WEBHOOK_SECRET` หรือ secret ใน URL ส่วน staging ต้องมี secret values แยกจาก production

### Staging resources ที่ต้องสร้าง

```text
Worker: businessaios-api-staging
D1:     businessaios-db-staging
R2:     businessaios-exports-staging
Web:    businessaios-web-staging หรือ preview URL ที่ exact allowlist ไว้
```

เพิ่ม `[env.staging]` ใน Wrangler และห้ามอ้าง production database/bucket IDs staging provider key ต้องมี spending cap และ webhook URL คนละ endpoint/environment

### ลำดับ deploy

1. Export/backup production D1 และยืนยันขั้นตอน restore
2. Apply migration ใน local
3. Deploy API + migration บน staging
4. ตั้ง fal staging webhook และรัน full smoke/E2E
5. ทดสอบ failure drills: lost webhook, expired lease, R2 failure, refund
6. Deploy production API พร้อม feature flag ปิด
7. Apply production migration
8. Verify tables, indexes, Cron Trigger และ model seed
9. ตั้ง fal production webhook URL
10. ทดสอบ production API ด้วย internal account
11. Build และ deploy Web
12. เปิดเฉพาะ admin/internal beta
13. Monitor logs, work queue, dead letters, holds, ledger และ R2 objects
14. ขยาย beta เมื่อผ่านอย่างน้อย 24-48 ชั่วโมงโดยไม่มี unresolved P0/P1

### Rollback

- ปิด `CREATIVE_STUDIO_ENABLED`
- ตั้งทุก model เป็น maintenance
- หยุดรับ generation ใหม่ แต่ยังเปิด status/history/download
- ปล่อย work processor ทำเฉพาะ ingest/refund/purge ที่ปลอดภัย ห้าม submit provider job ใหม่
- ห้ามลบ table หรือ asset ระหว่าง incident
- reconcile job ที่ reserved/processing ค้างก่อนคืนเครดิต
- rollback Web ได้โดยไม่ rollback additive database migration

---

## 16. Definition of Done

Release 1A ถือว่าเสร็จเมื่อ:

- [ ] ผู้ใช้ generate ภาพได้อย่างน้อย 2 โมเดล
- [ ] ผู้ใช้อัปโหลด reference ได้อย่างน้อย 3 ภาพในโมเดลที่รองรับ
- [ ] ผู้ใช้เรียก reference ด้วย `@mention` ได้
- [ ] ระบบตรวจ role, order, unresolved mention และ model limit ได้
- [ ] ราคาที่แสดงตรงกับราคาที่ backend reserve
- [ ] ราคาเพิ่มหลัง preview ต้องขอ user ยืนยันใหม่และไม่มี upward true-up
- [ ] duplicate click/request/webhook ไม่คิดเงินซ้ำ
- [ ] Worker crash หรือ webhook หาย recover ได้ด้วย scheduled reconciler
- [ ] งานล้มเหลวคืนเครดิตตาม policy
- [ ] provider สำเร็จแต่ส่งมอบไฟล์ไม่ได้คืนเครดิต user หลัง delivery deadline
- [ ] output ถูก copy เข้า R2 และเปิดผ่าน ownership-controlled URL
- [ ] ผู้ใช้ refresh/ปิดหน้าแล้วกลับมาติดตามงานได้
- [ ] History, Download, Favorite, Reuse Prompt และ Use as Reference ใช้งานได้
- [ ] Admin เปิด/ปิดโมเดลและ maintenance mode ได้
- [ ] exact-origin, CSRF, fal signature และ replay tests ผ่าน
- [ ] archive/delete/purge lifecycle ทำงานและไม่ทิ้ง R2 orphan
- [ ] staging full-flow ผ่านก่อน production migration/deploy
- [ ] Cross-user access tests ผ่าน
- [ ] Production deploy หลัง feature flag และ smoke test ผ่าน

Release 1B ถือว่าเสร็จเมื่อ:

- [ ] ผู้ใช้สร้าง Brand Kit ได้
- [ ] อัปโหลด logo, product, colors และ font ได้
- [ ] มี license confirmation สำหรับ font/brand asset
- [ ] ระบบวางข้อความจริงด้วย custom font ได้
- [ ] ระบบวาง logo ต้นฉบับโดยไม่ให้ AI วาดใหม่
- [ ] แก้ text overlay และ export ใหม่โดยไม่ generate base image

---

## 17. Metrics หลังเปิด Beta

### Product

- Generation completion rate
- Time to first completed image
- Percentage of jobs using references
- Average references per job
- Reuse Prompt / Use as Reference rate
- Download rate
- 7-day return rate ของ Creative Studio users

### Reliability

- Provider success rate ต่อ model
- p50/p95 generation time
- Webhook delivery delay
- Stuck-job count
- Work-item queue depth, lease expiry และ dead-letter count
- `submission_unknown` count และอายุสูงสุด
- Expired credit-hold count
- Refund rate และ refund reason
- Asset processing failure rate

### Unit economics

- Provider cost ต่อ generation
- Credits charged ต่อ generation
- Gross margin ต่อ model
- Storage ต่อ active user
- Cost ของ failed/retried jobs

---

## 18. Risks และ Cut Lines

| Risk | ผลกระทบ | Mitigation / Cut line |
|---|---|---|
| Multi-reference behavior ต่างกันมาก | UX ไม่สม่ำเสมอ | capability-driven UI และ adapter mapping |
| Provider webhook ไม่เสถียร | job ค้าง | persist event เร็ว + scheduled provider-status reconciliation |
| Worker/webhook หยุดกลางงาน | hold/job ค้าง | D1 outbox + lease + Cron reconciler + dead letter |
| Credit ซ้ำจาก retry | เสียความเชื่อมั่น | persistent idempotency key + conditional hold transition |
| Provider รับ job แต่ response หาย | submit ซ้ำและต้นทุนสองครั้ง | write-ahead attempt + `submission_unknown` + manual/reconciler path |
| Provider URL หมดอายุ | งานเก่าหาย | copy output เข้า R2 ก่อน completed |
| Provider สำเร็จแต่ R2 ล้มเหลว | user จ่ายแต่ไม่มีไฟล์ | delivery pending + retry + refund หลัง deadline |
| Font renderer บน Worker ไม่พร้อม | Release ช้า | ส่ง Brand Kit composition ไป Release 1B |
| Image decode เกิน Worker memory | request ล้ม/กระทบ isolate | quarantine + stream + max megapixels + Phase 0 processor spike |
| Remove background เพิ่ม cost/latency | margin ลด | แสดงราคาแยกและทำ on-demand |
| Asset storage โตเร็ว | ค่าใช้จ่ายเพิ่ม | quota, soft delete และ retention policy |
| Signed URL รั่ว | asset ถูกอ่านจน URL หมดอายุ | purpose-bound signature + short TTL + no token logging |
| Safety policy ต่างกัน | fallback ผิด policy | policy-compatible routing เท่านั้น |
| Scope ใหญ่เกินไป | deploy ไม่ทัน | Release 1A ตัด Brand Kit renderer ออกได้โดยไม่กระทบ core |

Critical cut line คือ **Release 1A ต้องเสร็จก่อน** ส่วน Brand Kit/font composition เป็น Release 1B ที่ต่อบน asset schema เดียวกันได้ โดยไม่บล็อกการเปิด beta ของ generation core

---

## 19. Decisions ที่ต้องยืนยันก่อนเริ่ม Code

มีค่าแนะนำเพื่อให้เริ่มงานได้โดยไม่ค้าง:

| Decision | ค่าแนะนำเริ่มต้น |
|---|---|
| Primary provider | fal.ai |
| Initial models | 1 text-to-image + 1 single-reference + 1 multi-reference |
| Max upload | 10 MB ต่อไฟล์ |
| Max decoded size | กำหนดจาก Phase 0 memory test และบังคับ max megapixels |
| Reference UI limit | 3 ภาพรุ่นแรก แต่ catalog รองรับ limit ต่างกันได้ |
| Upload transport | Worker streaming gateway -> R2 quarantine ใน Release 1A |
| Provider asset URL | HMAC Worker URL แบบ purpose-bound และ short TTL |
| Asset retention | Archive เก็บต่อ; Delete เข้า scheduled purge ตาม retention policy |
| R2 strategy | bucket เดิม แยก `media/` prefix |
| Async durability | D1 work-item outbox + Cron Trigger; `waitUntil` เป็น optimization เท่านั้น |
| Beta rollout | admin/internal ก่อน แล้ว invited users |
| User price | lock ตาม quote; ห้าม upward true-up |
| Credit failure policy | finalize เมื่อ R2 delivery พร้อม; refund หากไม่มี output ส่งมอบได้ |
| Webhook security | fal ED25519 signature + timestamp + JWKS cache |
| Browser security | exact origin + session-bound CSRF token |
| Environments | local -> staging resources -> production |
| Font/Logo | post-composition ใน Release 1B |
| URL import | เลื่อนไปจนมี SSRF-safe proxy |

---

## 20. Estimated Schedule

| Phase | ระยะเวลาโดยประมาณ |
|---|---:|
| Phase 0 - Security/provider/processor spike + staging | 3-4 วัน |
| Phase 1 - Data foundation | 2-3 วัน |
| Phase 2 - Asset/reference backend | 3-4 วัน |
| Phase 3 - Provider/jobs/credits/durable worker | 4-6 วัน |
| Phase 4 - Studio frontend | 3-4 วัน |
| Phase 5 - Library/reuse | 2-3 วัน |
| Phase 6 - Admin/observability | 2-3 วัน |
| Phase 7 - QA/staging/production rollout | 3-4 วัน |
| Phase 8 - Brand Kit/composition | 7-10 วัน |

ประมาณการ:

- Release 1A Core Image Studio internal beta: 22-31 วันทำการ
- Release 1B Brand Kit + Font Composition: เพิ่ม 7-10 วันทำการ
- รวม production-ready โดยประมาณ: 29-41 วันทำการ ขึ้นกับ provider integration, image processor และ renderer spike

ตัวเลขนี้เป็น implementation estimate ไม่รวมเวลารอเปิด provider account, เติมเครดิต provider, review policy หรือการตัดสินใจด้านราคา

---

## 21. Recommended Execution Order

ลำดับที่แนะนำให้เริ่มจริง:

1. แก้ exact-origin/CSRF และสร้าง staging resources
2. ทำ provider, webhook-signature และ image-processor spike ให้ผ่าน
3. Freeze model capability/pricing matrix และ upload strategy
4. ทำ migration, persistent idempotency, work-item outbox และ feature flag
5. ทำ asset ownership/quarantine/R2 pipeline
6. ทำ reference resolver และ provider adapter
7. ทำ credit hold + durable async lifecycle + reconciler ให้ทดสอบผ่านก่อนสร้าง UI เต็ม
8. ทำ Creative Studio UI
9. ทำ Library/reuse/delete-purge lifecycle
10. ผ่าน staging full-flow แล้วเปิด internal beta ของ Release 1A
11. เก็บ latency, delivery failure, refund และ margin data
12. ทำ Brand Kit/font composition เป็น Phase 8 / Release 1B

หลักสำคัญคือไม่เริ่มจากหน้าตาที่คล้าย ZenityX ก่อน job lifecycle และ credit correctness เสร็จ เพราะสองส่วนนี้เป็นฐานของการ deploy และการคิดเงินจริงทั้งหมด

---

## 22. Technical References

- [fal Asynchronous Inference](https://fal.ai/docs/documentation/model-apis/inference/queue) - queue lifecycle, polling, result และ cancellation
- [fal Webhooks](https://fal.ai/docs/documentation/model-apis/inference/webhooks) - delivery retries, timeout, ED25519 signature และ JWKS verification
- [Cloudflare D1 batch API](https://developers.cloudflare.com/d1/worker-api/d1-database/) - transactional batch และ rollback behavior
- [Cloudflare R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) - private bucket access ผ่าน Worker binding
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) - future direct upload/download path ที่ต้องใช้ S3 API credentials
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/) - CPU, memory, request size และ `waitUntil()` constraints
