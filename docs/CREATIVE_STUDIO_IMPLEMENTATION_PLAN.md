# BusinessAiOs Creative Studio - Implementation Plan

> แผนสร้าง Creative Studio และ Marketing Workspace ที่เชื่อมไอเดีย, คอนเทนต์, ภาพ, การอนุมัติ, ปฏิทิน และ Asset Library เข้าด้วยกัน พร้อม Reference Workspace, `@mention`, Brand Context และระบบเครดิต
>
> สถานะเอกสาร: Revision 12 - Phase 5-10 core/scaffold **deployed to PRODUCTION** (businessaios-api/businessaios-web), ไม่ใช่แค่ staging ตาม revision ก่อนหน้า Phase 7 (QA/security testing) ยังไม่ได้ทำตาม checklist ด้านล่างแม้ deploy ไปแล้ว
> วันที่จัดทำ: 2026-08-01
> รีวิวล่าสุด: 2026-08-02 (แก้ไข 2026-08-02 หลังตรวจสอบสถานะจริง)
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
8. ทำให้คอนเทนต์หนึ่งชิ้นเดินทางต่อได้ตั้งแต่ไอเดีย/เทรนด์ ไปจนถึง review, schedule, publish และค้นกลับมาใช้ซ้ำได้
9. ใช้ Brand Context เดียวกันโดยอัตโนมัติในทุกการเขียนและทุก generation โดยผู้ใช้ยังแก้เป็นรายงานได้

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

เป้าหมาย UX ที่ต่อจาก generation core คือ Marketing Workspace ไม่ใช่หน้า Studio ที่แยกขาดจากงานการตลาด:

```text
Idea / Trend / Tool output
  -> Content item (draft)
  -> Creative brief + Brand Context
  -> Generate / attach asset
  -> Review / approval
  -> Schedule / publish
  -> Works Library + reuse
```

ผู้ใช้ต้องเริ่มจากจุดใดก็ได้ใน flow นี้ และกลับมายัง item เดิมได้โดยไม่สูญเสีย brief, asset, เครดิต หรือสถานะงาน

---

## 2. ขอบเขต Release แรก

### 2.1 ต้องมีใน Release 1A - Core Image Studio

- Text-to-image
- Image-to-image
- Provider แรกผ่าน provider adapter โดยเริ่มจาก MiniMax `image-01`; รุ่นแรกเปิด text-to-image และ character-reference เท่านั้น เพราะ live API ยัง reject `subject_reference.type=product`; `fal.ai` เก็บเป็น secondary/future provider หากต้องการ queue/webhook-native, product-reference หรือ multi-reference model ภายหลัง
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
- Provider callback/webhook verification แบบบังคับเมื่อ provider มี webhook; สำหรับ MiniMax `image-01` spike แรกเป็น synchronous response แล้วต้อง ingest output เข้า R2 ก่อนส่งมอบ
- Staging Worker, D1 และ R2 ที่แยกจาก production
- Admin model configuration ขั้นพื้นฐาน
- Feature flag สำหรับเปิดเฉพาะ admin/internal users ก่อน
- Brand Context Lite: ชื่อแบรนด์, business summary, audience, tone of voice, content pillars, offer/product facts และ default reference assets
- Brand selector และ credit balance ที่เห็นได้จาก Studio และ navigation หลัก โดย backend เป็น source of truth

### 2.2 ต้องมีใน Release 1B - Marketing Workspace และ Cross-tool Creative Integration

- Creative Context contract กลางสำหรับทุกเครื่องมือ
- Embedded Creative Composer ที่เปิดจากเครื่องมือเดิมโดยไม่เริ่มจากหน้าว่าง
- Full Studio handoff พร้อม return context กลับเครื่องมือต้นทาง
- Normalize Content Calendar จาก JSON array เป็น `content_items` ที่มี stable ID
- ปุ่ม Create Creative ต่อ content item
- Prefill hook, caption, CTA, visual suggestion, platform และ format
- ดึง Brand Kit/reference assets ของ project อัตโนมัติเมื่อมี
- Attach generation/output กลับ content item
- Asset version, primary asset, reuse และ open-in-studio
- Batch Generate หลาย content items พร้อม aggregate quote
- คิดเครดิตและ refund แยกต่อ generation แม้เริ่มจาก batch เดียวกัน
- Generic `creative_requests` และ `asset_links` สำหรับต่อ Hook Library, Offer และ Presentation ภายหลัง
- Content lifecycle ที่ชัดเจน: draft, pending_review, approved, scheduled, published, archived
- Marketing Workspace shell: dashboard, approval inbox และ works library ที่อ่าน state เดียวกัน
- Dashboard action queue: งานรอตรวจ, งานที่กำลัง generate, ช่องว่างในปฏิทิน และทางลัดสร้างงานจากไอเดีย
- Trend/Idea-to-Content adapter รุ่นแรก: รับไอเดียหรือผลจากเครื่องมือที่มีอยู่เป็น Creative Context โดยไม่ต้องสร้าง trend crawler ใหม่ใน release นี้
- Transition แบบ audit-able ระหว่าง review, schedule และ publish; ไม่มีงานถูก publish โดยข้าม approval policy

### 2.3 ต้องมีใน Release 1C - Brand Output

- Brand Kit รุ่นแรก
- Brand colors
- Logo assets
- Product packshots
- Font upload: `.ttf`, `.otf`, `.woff2`
- Font-license confirmation
- Post-composition สำหรับข้อความ โลโก้ ราคา และ CTA
- Export artwork ที่แก้ข้อความได้โดยไม่ generate ภาพใหม่
- Remove background สำหรับ product/logo asset

### 2.4 ยังไม่รวมใน Release แรก

- Video, Voice, Avatar และ Motion Control
- Community Feed
- Academy หรือ Course system
- Model training, LoRA training หรือ custom character model
- Mask editor ระดับ Photoshop
- Pose skeleton editor
- Real-time collaborative editing
- Marketplace สำหรับขาย recipe/template
- Cross-tool integration ครบทุกเครื่องมือในครั้งเดียว; Release 1B เปิด Content Calendar ก่อน
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
           +--> MiniMax Image Adapter (Release 1A spike)
           +--> fal.ai Adapter (future/secondary)
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

### 4.4 สร้าง Creative จากเครื่องมืออื่น

1. ผู้ใช้ทำงานอยู่ใน Content Calendar, Hook Library, Offer หรือ Presentation
2. กด `Create Creative` ที่ output item ต้นทาง
3. Backend resolve source เป็น structured Creative Context
4. Embedded Composer เปิดพร้อม brief, copy, channel, format, Brand Kit และ references ที่ prefill แล้ว
5. ผู้ใช้แก้เฉพาะสิ่งที่ต้องการและเห็นราคาก่อน generate
6. Generation ใช้ lifecycle/credit flow เดียวกับ Full Studio
7. Output ถูก attach กลับ source item พร้อม version และ primary state
8. ผู้ใช้เลือก `Edit in Studio` เพื่อควบคุม reference/model/options เพิ่มเติม
9. Full Studio เก็บ `return context` และมี action กลับไป source item เดิม
10. Asset เดียวกันยังปรากฏใน Asset Library โดยไม่ duplicate R2 object

หลัก UX คือผู้ใช้ไม่ควรรู้สึกว่าถูกส่งไปเริ่มงานใหม่ในอีกเครื่องมือหนึ่ง แต่ควรรู้สึกว่า BusinessAiOs เข้าใจ output ที่กำลังดูอยู่และเตรียมงานสร้างสื่อขั้นถัดไปให้แล้ว

### 4.5 Marketing Workspace และ Content Lifecycle

Marketing Workspace ต้องใช้ `content_items` เป็นศูนย์กลาง ไม่ให้ Calendar, Approval และ Works Library เก็บสถานะคนละชุด หรือ derive จาก UI ชั่วคราว

```text
idea_ready -> draft -> creative_pending -> pending_review
                                      -> approved -> scheduled -> published
draft / creative_ready / pending_review / approved / scheduled -> archived
```

Rules:

1. `creative_pending` และ `creative_ready` เป็นสถานะงานสื่อ ไม่ใช่การอนุมัติโพสต์; item ที่มีภาพพร้อมแต่ยังไม่ตรวจต้องอยู่ `pending_review`
2. การกด approve, reject, schedule, unschedule และ mark published ต้องเป็น server-side transition ที่ตรวจ owner/role และบันทึก actor/time/reason
3. การเจนภาพล้มเหลวไม่ต้องทำลาย copy หรือกำหนดการเดิม; กลับเป็น state ที่ retry ได้พร้อม error ล่าสุด
4. Calendar card, Inbox และ Works Library อ่าน record เดียวกันและ refresh สถานะ generation แบบไม่ทำให้ layout shift
5. Publish integration ใน release แรกอาจเป็น manual/export acknowledgement ได้ แต่ห้ามแสดงว่าโพสต์สำเร็จจน provider/social platform ยืนยันผล
6. Dashboard เป็น action queue ไม่ใช่หน้ารายงาน: ต้องพาผู้ใช้ไปยัง item ที่ต้องตัดสินใจหรือสร้างต่อได้ในหนึ่ง action

องค์ประกอบหน้าหลักรุ่นแรก:

- **Today/Action queue**: pending review, generation ที่ต้องตาม, scheduled item ถัดไป และ empty slots ในปฏิทิน
- **Create entry**: สร้างจากไอเดีย, content item, Calendar และเครื่องมืออื่น โดยมี return route เสมอ
- **Approval inbox**: filter ตามสถานะ, เปิด preview copy + primary asset, approve/reject/edit/schedule
- **Works Library**: ค้นรวม draft, scheduled, published และ media แต่ไม่ duplicate R2 object หรือแยก asset history จาก content item
- **Brand/Credit surface**: แสดง brand ที่ active และ credit balance; เปลี่ยน brand ต้องส่งผลเฉพาะ request ใหม่ ไม่ rewrite งานเก่าเงียบ ๆ

---

## 5. Data Model ที่เสนอ

แบ่ง migration ตาม release และเพิ่มแบบ additive เท่านั้น ห้ามแก้ migration ที่ deploy แล้ว:

```text
009-creative-studio-core.sql       - Release 1A core media/catalog/jobs/credits/uploads + Brand Context Lite
010-cross-tool-creative.sql        - Release 1B content_items/creative_batches/creative_requests/asset_links
011-brand-kit-compositions.sql     - Release 1C brand kits/assets/compositions
```

### 5.1 `ai_models`

เก็บ catalog และ config ของโมเดลที่ frontend อ่านได้

| Field | Type | หมายเหตุ |
|---|---|---|
| `id` | TEXT PK | internal stable ID |
| `provider` | TEXT | `minimax`, `fal`, `kie`, `direct` |
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
| `creative_request_id` | TEXT nullable | embedded/full-studio request ต้นทาง |
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

### 5.7 Brand Context Lite (migration 009)

Brand Context Lite เป็น structured context สำหรับ content/generation ไม่ใช่ composition engine และต้องพร้อมก่อน Embedded Composer เพื่อให้การ prefill มีความหมาย

`brand_profiles`:

- `id`, `user_id`, `name`, `business_summary`, `audience_json`
- `tone_of_voice_json`, `content_pillars_json`, `offers_json`, `rules_json`
- `default_reference_asset_ids_json`, `is_default`, `created_at`, `updated_at`

Rules:

- เก็บ facts, rules และ default references แบบมีโครงสร้าง; ห้ามเก็บ prompt ยาวก้อนเดียวเป็น source of truth
- generation และ creative request เก็บ immutable brand snapshot/version ที่ใช้จริง เพื่อให้แก้ Brand Context วันนี้ไม่เปลี่ยนงานที่เคยสร้างแล้ว
- user เลือก active profile ได้ใน Studio/Marketing Workspace; source adapter ใช้ default profile เฉพาะเมื่อ source ไม่มี profile ที่ระบุไว้
- ข้อมูล font, logo placement, overlay layers และ renderable template ยังอยู่ Release 1C

### 5.8 Brand Kit tables (migration 011)

`brand_kits`:

- `id`, `user_id`, `name`, `description`
- `colors_json`, `rules_json`
- `is_default`, `created_at`, `updated_at`

`brand_assets`:

- `id`, `brand_kit_id`, `asset_id`
- `role`: primary_logo, alternate_logo, font_heading, font_body, product, style_reference
- `settings_json`: placement rules, min size, clear space, default text color

`media_compositions`:

- `id`, `user_id`, `brand_kit_id`, `base_asset_id`
- `canvas_json`, `layers_json`, `version_number`
- `rendered_asset_id`, `created_at`, `updated_at`

### 5.9 Webhook idempotency

เพิ่ม `provider_webhook_events`:

- `id` เป็น hash ของ provider + request ID + payload hash หรือ provider event ID
- `provider`, `provider_request_id`, `payload_hash`
- `signature_verified`, `processing_status`, `processing_attempts`
- `received_at`, `processed_at`, `last_error`
- unique constraint ที่ป้องกัน event เดิมทำงานซ้ำ

Webhook handler ต้อง persist event แล้วตอบ `2xx` โดยเร็ว ห้าม copy output หรือ render image ภายใน request นี้

### 5.10 `media_work_items`

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

### 5.11 `media_pricing_quotes`

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

### 5.12 `media_upload_intents`

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

### 5.13 `content_items`

Content Calendar ปัจจุบันอยู่ใน `projects.step_data.step5.output.calendar` เป็น JSON array และไม่มี stable database ID ต่อ post Release 1B ต้อง materialize เป็น entity ก่อนจึงจะ attach asset/version ได้อย่างปลอดภัย

| Field | Type | หมายเหตุ |
|---|---|---|
| `id` | TEXT PK | server-generated stable ID; ห้ามให้ AI สร้าง ID |
| `user_id` | TEXT FK | owner |
| `project_id` | TEXT FK | playbook project |
| `source_generation_id` | TEXT nullable | wizard generation ต้นทาง |
| `day_number` | INTEGER nullable | day จาก calendar output |
| `scheduled_date` | TEXT nullable | ISO date |
| `pillar` | TEXT nullable | awareness, education, social_proof, conversion |
| `platform` | TEXT | instagram, facebook, tiktok, line, etc. |
| `format` | TEXT | post, carousel, story, reel, video, broadcast |
| `hook` | TEXT nullable | source copy |
| `caption` | TEXT nullable | source copy |
| `cta` | TEXT nullable | source CTA |
| `hashtags_json` | TEXT JSON | hashtags |
| `visual_suggestion` | TEXT nullable | creative direction จาก Step 5 |
| `status` | TEXT | draft, creative_pending, creative_ready, pending_review, approved, scheduled, published, archived |
| `approval_state` | TEXT | none, pending, approved, rejected; แยกเหตุผลการตัดสินใจจาก delivery state |
| `approved_at` / `approved_by` | INTEGER / TEXT nullable | audit ของ approval ล่าสุด |
| `scheduled_at` / `published_at` | INTEGER nullable | เวลา operational ที่ server ควบคุม |
| `publish_provider_ref` | TEXT nullable | social platform/provider ID เมื่อมี integration จริง |
| `source_item_hash` | TEXT | ใช้ reconcile เมื่อ Step 5 regenerate |
| `created_at` / `updated_at` | INTEGER | timestamps |

หลัง Step 5 generate สำเร็จ backend ต้อง upsert `content_items` โดยใช้ source lineage/hash และ preserve stable ID เมื่อ item เดิมยัง match ได้ หาก regenerate แล้วหา match ไม่ได้ให้สร้าง item ใหม่และ archive item เก่า ห้ามลบ asset link เดิมเงียบ ๆ

Source-of-truth rules หลัง Release 1B:

- `projects.step_data.step5.output.calendar` เป็น immutable generation snapshot/backward-compatible fallback
- `content_items` เป็น operational source of truth สำหรับ edit, status, asset attach และ scheduling
- Content Calendar UI และ export ต้องอ่าน `content_items` ก่อน และ fallback ไป JSON snapshot เฉพาะ project ที่ยังไม่ materialize
- Server เป็นผู้ใส่ `content_item_id` ใน calendar response/storage หลัง AI generate; ห้ามให้ model สร้าง ID
- Regeneration matching priority: existing `content_item_id` -> scheduled date/day + platform + format -> source hash; unmatched old items เข้า archived
- User edit เปลี่ยน `content_items` แต่ไม่แก้ประวัติ generation snapshot

### 5.14 `creative_requests`

เก็บ structured brief ระหว่างเครื่องมือต้นทาง, Embedded Composer และ Full Studio

| Field | Type | หมายเหตุ |
|---|---|---|
| `id` | TEXT PK | creative request ID |
| `user_id` | TEXT FK | owner |
| `batch_id` | TEXT nullable | parent batch |
| `project_id` | TEXT nullable | owning project |
| `source_type` | TEXT | content_item, tool_save, presentation_slide, project_step |
| `source_id` | TEXT | stable source entity ID |
| `source_snapshot_json` | TEXT JSON | immutable copy ของ source ตอนสร้าง request |
| `brief_json` | TEXT JSON | normalized Creative Context |
| `brand_kit_id` | TEXT nullable | selected kit |
| `status` | TEXT | draft, quoted, generating, completed, cancelled |
| `return_route` | TEXT nullable | internal route template ที่ผ่าน allowlist |
| `created_at` / `updated_at` | INTEGER | timestamps |

`source_snapshot_json` ทำให้ generation reproducible แม้ caption/offer ต้นทางถูกแก้ภายหลัง ส่วน `return_route` รับเฉพาะ internal route pattern ที่ระบบสร้างเอง ห้ามรับ arbitrary URL เพื่อป้องกัน open redirect

### 5.14 `asset_links`

Generic relation ระหว่าง media asset กับ output จากเครื่องมืออื่น ห้ามเพิ่ม `image_url` กระจายในทุก source table

| Field | Type | หมายเหตุ |
|---|---|---|
| `id` | TEXT PK | link ID |
| `user_id` | TEXT FK | denormalized owner สำหรับ authorization/query |
| `asset_id` | TEXT FK | media asset |
| `source_type` | TEXT | content_item, tool_save, presentation_slide, project_step |
| `source_id` | TEXT | stable source ID |
| `creative_request_id` | TEXT nullable | request ที่สร้าง link |
| `relation_type` | TEXT | primary, variation, reference, thumbnail, background |
| `slot` | TEXT nullable | เช่น feed_image, slide_hero, carousel_1 |
| `version_number` | INTEGER | version ต่อ source/slot |
| `is_primary` | INTEGER | primary asset ของ source/slot |
| `created_at` | INTEGER | timestamp |

ต้องบังคับ ownership chain `source -> user`, `asset -> user` และ `creative_request -> user` ก่อน attach/detach ทุกครั้ง การตั้ง primary ใหม่ต้อง clear primary เดิมใน D1 batch เดียวกัน

### 5.15 ความสัมพันธ์กับ `step_assets`

`step_assets` เดิมยังใช้สำหรับ notes, text files และ linked context ระดับ project step ตามเดิม ไม่ใช้เก็บ generated media เพราะไม่มี item-level source, version, primary slot หรือ media lifecycle ให้ใช้:

- `step_assets`: input context สำหรับ wizard generation
- `content_items`: normalized Content Calendar posts
- `creative_requests`: structured handoff ไป Creative Studio
- `asset_links`: output relation กลับ source item
- `media_assets`: binary asset source of truth ใน R2

### 5.16 `creative_batches`

เก็บ batch orchestration ระดับ UX เท่านั้น child generation แต่ละตัวมี quote, idempotency key และ credit hold ของตัวเอง

| Field | Type | หมายเหตุ |
|---|---|---|
| `id` | TEXT PK | batch ID |
| `user_id` | TEXT FK | owner |
| `project_id` | TEXT nullable | project ต้นทาง |
| `client_idempotency_key` | TEXT | unique ต่อ user |
| `status` | TEXT | draft, quoted, running, partially_completed, completed, failed, cancelled |
| `item_count` | INTEGER | จำนวน child requests |
| `quoted_credits` | INTEGER | ผลรวม quote เพื่อแสดง/confirm |
| `completed_count` / `failed_count` | INTEGER | progress summary |
| `created_at` / `updated_at` | INTEGER | timestamps |

Batch status เป็น summary ที่คำนวณจาก child requests/generations ห้ามใช้ batch row เป็น financial source of truth

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

## 12. Cross-tool Creative Integration

### 12.1 Product principle

Creative Studio เป็น shared creative engine ไม่ใช่ destination แยกเพียงอย่างเดียว เครื่องมืออื่นต้องส่ง structured context เข้ามาและรับ asset link กลับไป โดยไม่ประกอบ provider prompt หรือเรียก provider เอง

มี UX สองระดับ:

1. **Embedded Creative Composer** - side panel บน desktop และ full-screen sheet บน mobile สำหรับ preview brief, references, model/preset, quote และ Generate
2. **Full Creative Studio** - route `/studio/requests/:creativeRequestId` สำหรับ multi-reference, model/options ขั้นสูง, history และ composition พร้อม action กลับ source

ห้ามฝัง Full Studio ทั้งหน้าไว้ใน card ของเครื่องมือเดิม และห้ามเปิด Studio ว่างโดยทิ้ง context ที่มีอยู่แล้ว

### 12.2 Creative Context contract

ทุก source adapter แปลง output ของตัวเองเป็น contract กลาง:

```typescript
type CreativeContext = {
  source: {
    type: 'content_item' | 'tool_save' | 'presentation_slide' | 'project_step' | 'idea';
    id: string;
    projectId?: string;
    returnRoute: string;
  };
  objective: string;
  audience?: string;
  channel?: string;
  placement?: string;
  outputPreset?: string;
  copy: {
    headline?: string;
    body?: string;
    cta?: string;
    hashtags?: string[];
  };
  visualDirection?: string;
  brandProfileId?: string;
  brandKitId?: string;
  referenceAssetIds: string[];
  constraints: string[];
  recommendedModelId?: string;
};
```

Rules:

- Source adapter อ่านเฉพาะข้อมูลที่ user เป็นเจ้าของ
- Resolver สร้าง immutable source snapshot ก่อนเปิด composer
- Frontend แก้ draft context ได้โดยไม่แก้ source จน user กด Apply กลับ
- Provider adapter รับ normalized generation input จาก Creative Studio เท่านั้น
- `returnRoute` สร้างจาก allowlisted route templates ไม่รับ URL จาก user
- Source เปลี่ยนหลังเปิด composer ต้องแสดง stale-context warning แต่ไม่เปลี่ยน brief เงียบ ๆ
- Resolver ต้อง merge Brand Context Lite แบบมีลำดับชัดเจน: source-specific facts/constraints -> selected profile -> user draft overrides; ห้าม merge prompt string แบบมองย้อนกลับไม่ได้
- `brandKitId` ใช้กับ composition/output rules ใน Release 1C; Release 1A/1B ใช้ `brandProfileId` และ snapshot เป็นหลัก

### 12.3 Content Calendar integration รุ่นแรก

Content Calendar เป็น integration แรกเพราะมี `hook`, `caption`, `cta`, `platform`, `format` และ `visual_suggestion` อยู่แล้ว

ต่อ content item ให้เพิ่ม:

- Create Creative
- Asset status: none, queued, processing, delivery pending, ready, failed
- Primary creative thumbnail
- Variations count
- Open in Studio
- Replace primary
- Download

Prefill rules ตัวอย่าง:

```text
Instagram post/carousel -> 4:5 default
Instagram story/reel    -> 9:16 default
Facebook post           -> 1:1 or 4:5
TikTok video concept    -> 9:16 image/storyboard preset ใน image-only release
LINE broadcast          -> 1:1 default

hook              -> headline
caption           -> body copy/context
cta               -> CTA overlay suggestion
visual_suggestion -> visual direction
platform/format   -> output preset
project context   -> audience/brand constraints
```

หาก format เป็น video/reel ใน Release 1 ให้สร้าง cover/storyboard image และระบุ capability ชัดเจน ห้ามทำให้ผู้ใช้เข้าใจว่าได้ video แล้ว

### 12.3.1 Review, schedule และ publish workflow

หลัง Content Calendar materialize แล้ว `content_items` ต้องเป็น workflow record ไม่ใช่เพียงข้อมูลที่ render calendar:

1. item ที่สร้างจาก Calendar, idea/trend หรือ tool output เริ่มเป็น `draft`
2. ผู้ใช้สร้างภาพจาก Embedded Composer; ระหว่างงานอยู่ `creative_pending` และงานสำเร็จที่มี asset พร้อมอยู่ `creative_ready`
3. action `Send to review` เปลี่ยนเป็น `pending_review`; Inbox แสดง copy, primary asset, source และ schedule ที่มีอยู่
4. `Approve` เปลี่ยนเป็น `approved`; `Reject` ต้องเก็บ optional reason และกลับไป `draft` หรือ `creative_ready` ตามว่าต้องแก้ copy หรือ media
5. `Schedule` ต้องทำได้เฉพาะ item ที่ผ่าน policy approval แล้ว และบันทึก timezone/user-selected time อย่างชัดเจน
6. `Published` ต้องมาจาก publish connector confirmation ในอนาคต หรือ explicit manual acknowledgement ที่ UI แยกจาก auto-publish ชัดเจน
7. ทุก transition ต้อง append audit event; client ส่ง desired action ไม่ส่ง status arbitrary string

Release 1B ไม่ต้องทำ social OAuth/publisher connector เพื่อเปิด Marketing Workspace แต่ต้องออกแบบ `publish_provider_ref` และ audit event ให้รองรับโดยไม่เปลี่ยน state model ในภายหลัง

### 12.3.2 Marketing Workspace shell

Routes ที่เพิ่มใน Release 1B ต้อง reuse `content_items` และ Creative Context:

- `/dashboard`: action queue, next scheduled content, pending reviews, active generations และ create entry จากไอเดีย
- `/inbox`: review queue ตาม status พร้อม batch approve/reject เฉพาะเมื่อ permissions อนุญาต
- `/works`: searchable content-centric history โดยเปิด item เดิมใน Calendar หรือ Studio ได้ และแยก media-only Asset Library ไว้ใต้ `/studio/library`

Dashboard ต้อง render empty states ที่พาไป action ที่สั้นที่สุด: ไม่มี Brand Context -> สร้าง Brand Context, ไม่มี content -> เริ่มจาก idea, มี draft -> เปิด review/creative ต่อ ไม่สร้าง dashboard card ซ้อนใน card

### 12.4 Batch generation

ผู้ใช้เลือกหลาย content items แล้วกด Batch Create Creative ได้ โดยระบบต้อง:

1. Resolve Creative Context แยกต่อ item
2. แสดง aggregate quote และ breakdown ต่อ item
3. ขอ confirm ครั้งเดียว
4. สร้าง generation/idempotency key/hold แยกต่อ item
5. จำกัด concurrency ตาม user/plan
6. แสดง progress ราย item
7. refund เฉพาะ generation ที่ล้มเหลว
8. รองรับ retry เฉพาะรายการโดยไม่รัน batch ทั้งหมดซ้ำ

Batch เป็น orchestration ฝั่ง BusinessAiOs ไม่ใช่ provider request ก้อนเดียว เพื่อให้ settlement และ recovery แยกกันได้

### 12.5 API เพิ่มเติม

```text
GET  /api/projects/:projectId/content-items
POST /api/projects/:projectId/content-items/sync
PATCH /api/content-items/:id

POST  /api/creative-requests/from-source
GET   /api/creative-requests/:id
PATCH /api/creative-requests/:id
POST  /api/creative-requests/batch-from-sources

GET    /api/sources/:sourceType/:sourceId/assets
POST   /api/media/assets/:assetId/links
PATCH  /api/media/assets/:assetId/links/:linkId
DELETE /api/media/assets/:assetId/links/:linkId
```

`POST /api/media/generations` รับ `creative_request_id` เพิ่ม และ backend ต้องตรวจว่า request, source, project, references และ Brand Kit เป็นของ user เดียวกัน

`sourceType` ต้องผ่าน enum allowlist และ route handler แยก resolver ต่อ source type ห้ามนำชื่อ table/column จาก URL ไปประกอบ SQL โดยตรง

### 12.6 Tool rollout order

| ลำดับ | Source | Creative output ที่เหมาะสม |
|---|---|---|
| 1 | Content Calendar | feed image, carousel cover, story, reel cover/storyboard |
| 2 | Hook Library | visual variations ต่อ hook |
| 3 | Million Dollar Offer | offer ad, promotion banner, price/CTA composition |
| 4 | Presentation Builder | slide hero, section visual, background asset |
| 5 | Persona Builder | persona moodboard, lifestyle scene |
| 6 | JTBD / Value Proposition | before-after, outcome visual, benefit infographic |
| 7 | Brand Voice / Competitor Analysis | visual direction และ differentiated concept board |
| 8 | Objection Handler | FAQ card และ objection-response carousel |

Release 1B implement เฉพาะ Content Calendar แต่ source adapter/asset-link contract ต้องพร้อมให้ลำดับถัดไปเพิ่มโดยไม่เปลี่ยน generation/credit core

### 12.7 Embedded UX acceptance criteria

- Composer เปิดด้วยข้อมูลที่ prefill แล้ว ไม่ใช่ prompt ว่าง
- ผู้ใช้เห็นว่าจะ attach ผลลัพธ์กลับ item ใด
- ราคาปรากฏก่อน generate ทั้ง single และ batch
- ปิด composer แล้ว job ยังทำงานและสถานะแสดงบน source item
- กด Open in Studio แล้ว context/reference/version ครบ
- กดกลับจาก Studio แล้วกลับ source item เดิม ไม่ใช่แค่หน้า project บนสุด
- Output หนึ่งไฟล์อยู่ใน R2 ครั้งเดียว แม้ link หลาย source
- Source item แสดง primary + variations โดยไม่ทำให้ calendar card ขยาย/ยุบระหว่าง status change

---

## 13. Phase-by-Phase Implementation

## Phase 0 - Provider and Architecture Spike

ระยะเวลา: 3-4 วัน

### Steps

- [x] แก้ current CORS จาก wildcard/suffix matching เป็น exact origin set
- [x] เพิ่ม trusted-origin + CSRF middleware และทดสอบกับ session cookie `SameSite=Lax`
- [x] สร้าง staging Worker, D1 และ R2 แยกจาก production
- [x] ยืนยัน provider account และ production API access สำหรับ MiniMax image API ผ่าน backend call
- [ ] เลือกโมเดล 2-3 ตัวที่ครอบคลุม text-to-image, single-reference และ multi-reference
- [x] บันทึก input/output schema เบื้องต้นของ MiniMax `image-01` สำหรับ text-to-image และ subject-reference image-to-image
- [x] บันทึก queue, webhook/callback, cancel และ pricing ของ MiniMax `image-01`; sync response, ไม่มี webhook/cancel ใน spike แรก, ราคาเริ่มจาก $0.0035/image
- [ ] ทดสอบ upload/reference ผ่าน server-side API key
- [ ] ทดสอบ webhook บน Worker dev URL
- [x] วัดเวลาสร้าง ค่าใช้จ่าย และ failure mode อย่างน้อย 3 ครั้งสำหรับ MiniMax `image-01`
- [x] สรุป model capability matrix เบื้องต้นสำหรับ MiniMax `image-01`
- [ ] ออกแบบ HMAC-signed Worker content URL และ TTL สำหรับ provider input
- [x] ทดสอบ provider output ingestion เข้า R2 ด้วย URL response และ base64 response พร้อม readback/delete cleanup
- [ ] ยืนยัน Worker streaming gateway + quarantine pipeline สำหรับ Release 1A
- [ ] ทำ image-processing spike: magic bytes, EXIF strip, orientation, thumbnail และ max-megapixel rejection
  - [x] magic bytes, MIME family, dimensions และ max-megapixel inspection สำหรับ JPEG/PNG/WebP
  - [x] EXIF strip, orientation normalization และ thumbnail generation processor decision
- [ ] วัด peak Worker memory/CPU ด้วยไฟล์ขนาดสูงสุดและ concurrent requests
- [ ] ทดสอบ provider webhook/callback security หากใช้ provider ที่มี webhook; MiniMax `image-01` spike แรกเป็น sync response จึงต้องเพิ่ม R2 ingestion/reconciler เป็น durability layer
- [ ] ออกแบบ D1 outbox + Cron Trigger และทดสอบ lease/retry หนึ่งรอบ
- [ ] ตัดสินใจ retention policy และ max upload size
- [x] กำหนด credit markup รุ่น beta

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

## Phase 1 - Data Foundation, Brand Context Lite and Feature Flag

ระยะเวลา: 2-3 วัน

### Steps

- [x] สร้าง `009-creative-studio-core.sql`
- [x] เพิ่ม tables และ indexes ตาม Section 5 สำหรับ Release 1A core
- [x] เพิ่ม `media_work_items`, leases, hold expiry, pricing snapshot และ persistent idempotency fields
- [x] เพิ่ม `brand_profiles` และ schema validation สำหรับ business facts, audience, tone, pillars, offers, rules และ default reference assets
- [x] สร้าง Brand Context snapshot/version service เพื่อใช้กับ generation และ creative request
- [x] เพิ่มทุก table ใหม่ใน migration gate test
- [x] ทดสอบ migration จาก fresh local database
- [x] ทดสอบ migration ต่อจาก schema ปัจจุบันบน staging D1
- [x] เพิ่ม Bindings: provider secret, media signing secret และ feature flags
- [x] เพิ่ม `creative_studio` ใน `/api/config`
- [x] seed model catalog แบบ idempotent
- [x] validate model/pricing/capability JSON ด้วย runtime schema และ config version
- [x] สร้าง route module `mediaRoutes.ts`
- [x] mount route module ใน `index.ts`
- [x] เพิ่ม Cron Trigger และ scheduled handler shell
- [x] เพิ่ม `BRAND_CONTEXT_ENABLED` feature flag และ active-brand selection endpoint

### Exit Criteria

- Migration test ผ่าน
- Catalog endpoint คืนเฉพาะ active models
- Feature flag ปิดแล้ว user ทั่วไปเข้าไม่ได้
- request key ซ้ำถูก unique constraint ป้องกันใน database
- work item lease หมดอายุแล้ว worker อื่นหยิบต่อได้
- Brand Context ที่เปลี่ยนภายหลังไม่แก้ snapshot ของ generation/request เก่า
- ไม่มีการแก้ migration เก่าหรือกระทบ existing tools

### Phase 1 Implementation Status

Implemented files:

- `apps/api/migrations/009-creative-studio-core.sql`
- `apps/api/src/mediaRoutes.ts`
- `apps/api/src/lib/media/catalog.ts`
- `apps/api/src/lib/media/workItems.ts`
- `apps/api/src/lib/creative/brandContext.ts`
- `apps/api/test/mediaFoundation.test.ts`

Staging:

```text
API:        https://businessaios-api-staging.pskspace.workers.dev
Version ID: c3d2d369-f319-4d9f-9a6f-c4fa5d84fae7
D1:         businessaios-db-staging
R2:         businessaios-exports-staging
Cron:       */1 * * * *
Flags:      creative_studio=false, brand_context=false
```

Smoke results:

- `GET /api/config` -> 200
- `GET /api/media/models` without auth -> 401
- Staging D1 contains `ai_models`, `media_generations`, `brand_profiles`, and `media_work_items`

## Phase 2 - Asset Pipeline and Reference Workspace Backend

ระยะเวลา: 3-4 วัน

### Steps

- [x] สร้าง upload intent endpoint พร้อม auth, CSRF และ quota
- [x] สร้าง one-time binary upload route ที่ stream เข้า R2 quarantine
- [x] validate magic bytes, MIME, size และ dimensions
- [ ] strip metadata และ normalize image - ยัง deferred (EXIF strip/orientation ยังไม่ทำ)
- [x] สร้าง thumbnail (2026-08-02) — ใช้ `@cf-wasm/photon` (WASM, decode/resize/encode จริง ไม่ใช่ Cloudflare Images) ผ่าน `POST /api/media/assets/:id/derive-thumbnail`; เก็บที่ `media/{user_id}/thumbnails/{asset_id}.webp` เดียวกันทุก asset type
- [x] เขียน input ลง R2 ด้วย key convention กลาง; thumbnail key ใช้ path แยก (ดูข้างบน)
- [x] บันทึก asset ownership ใน D1
- [x] สร้าง basic list/detail/archive/favorite endpoints; advanced filters ยังทำใน Library UI phase
- [x] สร้าง signed media URL service
- [x] ผูก signed URL กับ asset, purpose, expiry และ short TTL
- [x] ทดสอบ owner access, cross-user denial และ expired URL
- [x] สร้าง reference validation และ mention parser
- [x] สร้าง Reference Resolver พร้อม model capability checks

### Exit Criteria

- ผู้ใช้ A อ่าน/ลบ asset ของผู้ใช้ B ไม่ได้
- ไฟล์ทุกชนิดที่ไม่อยู่ allowlist ถูกปฏิเสธ
- EXIF/GPS ไม่อยู่ใน processed output
- upload ที่ไม่ finalize/ไม่ผ่าน validation ถูก cleanup จาก quarantine
- binary upload ไม่ buffer ทั้งไฟล์ใน Worker memory
- `@mention` ที่หายหรือซ้ำถูกตรวจพบก่อน provider call

### Phase 2 Implementation Status

Implemented files:

- `apps/api/src/lib/media/assets.ts`
- `apps/api/src/lib/media/signedUrls.ts`
- `apps/api/src/lib/media/referenceResolver.ts`
- `apps/api/src/mediaRoutes.ts`
- `apps/api/test/mediaFoundation.test.ts`

Implemented endpoints:

```text
POST   /api/media/references/validate
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
POST   /api/media/assets/:id/derive-thumbnail      -> real implementation (2026-08-02), @cf-wasm/photon
POST   /api/media/assets/:id/remove-background     -> real implementation (2026-08-02), fal-ai/imageutils/rembg
                                                       via platform provider key (503 fal_not_configured if unset)
```

Staging:

```text
API:        https://businessaios-api-staging.pskspace.workers.dev
Version ID: 9e5ed84d-dc10-49e9-ac81-cc18c15e05af
Flags:      creative_studio=false, brand_context=false
Smoke:      GET /api/config -> 200; GET /api/media/references/validate -> 404 feature_disabled
```

Security/behavior covered by tests:

- upload intent validates MIME and file size before issuing one-time token
- upload token cannot be reused
- binary upload route streams request body to R2 quarantine using `Content-Length`
- finalize reads quarantine object, validates JPEG/PNG/WebP magic bytes, dimensions, MIME, max bytes, and max megapixels
- invalid media is rejected and quarantine object is deleted
- finalized upload is copied to canonical `media/{user_id}/inputs/{asset_id}/original.{ext}` key
- asset content requires owner session
- provider asset URL requires HMAC signature, purpose, and unexpired timestamp
- reference validation catches duplicate names, missing `@mention`, cross-user/inactive assets, and model reference-count limits

## Phase 3 - Provider Router, Async Jobs and Credits

ระยะเวลา: 4-6 วัน

### Steps

- [x] สร้าง normalized provider types
- [x] สร้าง provider registry/router
- [x] implement `fal` adapter รุ่นแรก (2026-08-02) — sync `fal.run` call pattern (image_size/num_images/image_url mapping), เปิดใช้งานทันทีที่แอดมินวาง API key ผ่าน `/admin/creative` (ไม่ใช่ Worker secret) `ai_models` seed เป็น `is_maintenance=1` จนกว่าจะตั้งค่า key จริง — **ยังไม่ได้ทดสอบกับ live fal API จริง เพราะยังไม่มี key ให้ทดสอบ**; ยังไม่ implement webhook/async path ของ fal (ยังใช้ sync request/response เหมือน MiniMax) ดู test ใน `apps/api/test/mediaFoundation.test.ts` describe block "fal.ai provider"
- [x] implement pricing preview service
- [x] implement media credit hold ด้วย D1-backed reserve/finalize/refund
- [x] สร้าง generation endpoint พร้อม persistent `Idempotency-Key`, request hash และ pricing quote
- [x] บังคับ per-user active-job limit, request rate และ daily credit-spend ceiling ก่อน reserve
- [x] reserve เครดิตก่อน submit provider
- [x] สร้าง generation + hold + submit work item
- [x] สร้าง generation attempt แบบ write-ahead ก่อน provider call
- [x] จัดการ `submission_unknown` crash window โดย write-ahead attempt + submission_state; processor ไม่ auto-submit completed/failed terminal jobs ซ้ำ
- [ ] implement fal raw-body signature verification และ event deduplication - deferred จนเปิด fal provider
- [x] ให้ sync provider result persist attempt/work item; webhook event table พร้อมสำหรับ provider ต่อไป
- [x] implement work processor สำหรับ submit, ingest, finalize/refund
- [x] copy output จาก provider ไป R2 แล้ว authenticated read check
- [x] finalize/refund แบบ idempotent และ delivery-aware
- [x] implement scheduled polling/status sync เป็น durable fallback ผ่าน Cron work processor shell
- [x] implement hold expiry/dead-letter foundation ผ่าน work item lease, retry และ dead_letter
- [x] เพิ่ม normalized errors: validation, policy_rejected, provider_failed, timeout, storage_failed
- [x] เพิ่ม retry rules ที่ไม่ทำให้คิดเครดิตซ้ำผิดพลาด; failed provider retry ต้องสร้าง quote/generation ใหม่ ส่วน delivery retry ใช้ work item เดิม

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

### Phase 3 Implementation Status

Implemented files:

- `apps/api/src/lib/media/providers/types.ts`
- `apps/api/src/lib/media/providers/minimax.ts`
- `apps/api/src/lib/media/providers/router.ts`
- `apps/api/src/lib/media/credits.ts`
- `apps/api/src/lib/media/generations.ts`
- `apps/api/src/lib/media/processor.ts`
- `apps/api/src/mediaRoutes.ts`
- `apps/api/test/mediaFoundation.test.ts`

Implemented endpoints:

```text
POST /api/media/generations
GET  /api/media/generations
GET  /api/media/generations/:id
POST /api/media/generations/:id/cancel
POST /api/media/generations/:id/retry
```

Staging:

```text
API:        https://businessaios-api-staging.pskspace.workers.dev
Version ID: 946cbcec-a18e-47f9-852d-0c61f00355e3
Flags:      creative_studio=false, brand_context=false
Smoke:      GET /api/config -> 200; GET /api/media/generations -> 404 feature_disabled
```

Security/behavior covered by tests:

- quote hash must match submit options/reference count
- duplicate `Idempotency-Key` with same body returns existing generation
- duplicate `Idempotency-Key` with different body is blocked
- provider attempt is created before submit
- provider success is not completed until output is ingested to R2 and readback succeeds
- successful delivery finalizes media credit hold
- provider validation/failure refunds reserved credits
- generation outputs are stored as `media_assets` linked to `generation_id`

## Phase 4 - Creative Studio Frontend

ระยะเวลา: 3-4 วัน

สถานะ 2026-08-01:

```text
Web staging: https://businessaios-web-staging.pskspace.workers.dev/studio
Version ID:   3d20e2b5-07d6-4e85-909c-f96de7e4edf3
Build:        SvelteKit build ผ่านโดยชี้ PUBLIC_API_URL ไป API staging
Smoke:        GET /studio -> 200
API config:   creative_studio=true, brand_context=true
```

หมายเหตุ: staging เปิด feature flags แล้วสำหรับ internal test; production ยังควรเปิดแบบ controlled rollout เท่านั้น

### Steps

- [x] เพิ่ม route `/studio`
- [x] เพิ่ม Studio entry ใน desktop/mobile navigation
- [ ] เพิ่ม active Brand Context selector และแสดง credit balance จาก API โดยไม่ cache เป็น source of truth
- [x] สร้าง Model Selector จาก catalog
- [x] สร้าง Prompt Editor พร้อม manual `@mention` insertion จาก Asset Library
- [x] สร้าง Reference Tray พร้อม role/remove
- [x] รองรับ file picker แบบ multi-upload ผ่าน Worker upload gateway
- [x] สร้าง aspect ratio control จาก capability
- [x] สร้าง count controls ตาม capability
- [x] แสดง credit estimate ก่อน Generate
- [x] ส่ง CSRF token, quote ID, pricing version และ idempotency key จาก API client
- [x] แสดง `409 price_changed` เป็นข้อความให้ประเมินราคาใหม่
- [x] แสดง validation warning และ feature-disabled state
- [x] สร้าง queued/submitting/processing/cancel-requested/delivery-pending/completed/failed states
- [x] ทำ polling ที่หยุดเมื่อ terminal state
- [x] รองรับ responsive mobile layout และ dark mode ตาม convention ของระบบปัจจุบัน
- [x] เพิ่ม `@mention` autocomplete ด้วย keyboard (2026-08-02) — live dropdown ตอนพิมพ์ `@`, ArrowUp/Down/Enter/Tab/Escape; ยังไม่ได้ทดสอบจริงในเบราว์เซอร์กับ session ที่ login แล้ว (ตรวจด้วย script จำลอง logic ล้วนๆ แทน) — ควร manual test อีกรอบหลัง login จริง
- [x] เพิ่ม reference reorder UI (2026-08-02) — ปุ่ม ▲▼ ต่อการ์ด reference, ยังไม่ทำ influence-level UI (strict/balanced/loose ยังเลือกไม่ได้จาก UI)
- [x] เพิ่ม drag/drop และ paste upload (2026-08-02) — วาง/ลากไฟล์เข้า dropzone เดิม, paste รูปจาก clipboard ได้ทั้งหน้า
- [ ] แสดง credit balance สดบน Studio จาก `/api/me/credits`
- [ ] เพิ่ม maintenance state รายโมเดลเมื่อ catalog ส่ง `is_maintenance`
- [ ] ทำ Playwright E2E ด้วย authenticated staging account หลังเปิด feature flag

### Exit Criteria

- ผู้ใช้สร้างงานครบ flow ได้โดยไม่เปิด developer tools - pending เปิด feature flag แล้วรัน staging E2E
- controls ที่โมเดลไม่รองรับไม่แสดงหรือ disabled พร้อมเหตุผล
- prompt อ้าง reference ได้ด้วย keyboard - pending autocomplete/reorder pass
- ไม่มี layout shift/ข้อความล้นบน mobile และ desktop
- refresh หน้าแล้วกลับมาติดตาม job เดิมได้
- price change ไม่หักเครดิตจน user ยืนยัน quote ใหม่
- การเลือก Brand Context เปลี่ยนเฉพาะ request ใหม่และผู้ใช้เห็น profile ที่จะถูกใช้ก่อน Generate - pending Brand Context selector

## Phase 5 - Library and Reuse Workflow

ระยะเวลา: 2-3 วัน

### Steps

- [x] เพิ่ม `/studio/library`
- [x] แยก tabs: Generated, Uploads, Products, People, Styles, Logos, Favorites
- [x] เพิ่ม filters: model, status, date และ asset type
- [x] เพิ่ม Download, Favorite, Archive
- [x] เพิ่ม Reuse Prompt
- [x] เพิ่ม Use as Reference
- [x] เพิ่ม Retry จาก failed job
- [ ] แยก delivery retry จาก generation ใหม่ให้ผู้ใช้เข้าใจได้
- [x] เพิ่ม empty/loading/error states
- [ ] ตรวจ pagination และ query limits

### Exit Criteria

- ผู้ใช้ค้นงานเก่าและนำกลับมา generate ต่อได้
- archived assets ไม่ปรากฏใน picker ปกติ
- download ตรวจ ownership ทุกครั้ง
- list API ไม่อ่านข้อมูลทุกแถวโดยไม่มี pagination

## Phase 6 - Admin, Observability and Policy (Release 1A)

ระยะเวลา: 2-3 วัน

### Steps

- [x] เพิ่ม admin model list/edit/enable/maintenance
- [x] เพิ่ม pricing version และ margin view ขั้นพื้นฐาน
- [x] เพิ่ม generation status/error dashboard
- [x] เพิ่ม provider attempt/status logging view
- [x] เพิ่ม manual reconcile action ที่มี admin audit log
- [x] เพิ่ม policy configuration ที่ไม่เปิด provider secret/raw bypass controls
- [x] เพิ่ม rate limit แยก upload, generate (2026-08-02) — `categoryRateLimit()` ใน `middleware.ts`, bucket แยกจาก flat limit เดิม; webhook ยังไม่มี route จริง (fal ยัง sync, ไม่มี webhook) จึงยังไม่ wire แยก — พร้อมใช้ทันทีที่เพิ่ม route
- [x] เพิ่ม storage quota และ retention cleanup plan (2026-08-02) — `lib/media/quota.ts`, ops-configurable ผ่าน `MEDIA_STORAGE_QUOTA_MB`, default 1000MB/user, บังคับที่ `finalizeUploadedAsset`; archive ตั้ง `purge_after` = 30 วันอัตโนมัติ
- [x] เพิ่ม purge worker และ orphan/quarantine cleanup (2026-08-02) — `lib/media/purge.ts`, sweep ทุก 1 นาทีผ่าน cron เดิม: ลบ R2 ของ archived asset ที่พ้น retention และของ upload intent ที่หมดอายุไม่เคย finalize
- [x] เพิ่ม alert สำหรับ stuck jobs, dead-letter work item และ expired delivery deadline (2026-08-02) — `lib/media/reconciler.ts`: refund + mark failed อัตโนมัติสำหรับ generation ที่พ้น `delivery_deadline_at`, ส่งอีเมลแจ้ง `NOTIFY_EMAIL` เมื่อพบ dead-letter (throttle 1 ครั้ง/ชม. ผ่าน `rate_limits` table เดิม) — ยังไม่มี alert แยกสำหรับ "abnormal refund rate" โดยเฉพาะ (ยังเป็นงานที่เหลือ)

### Exit Criteria

- Admin ปิดโมเดลที่มีปัญหาได้โดยไม่ deploy
- ตรวจ generation ด้วย internal ID ได้ครบ job, attempt, hold และ ledger
- Manual action ทุกครั้งมี audit trail
- ไม่มี secret ใน log หรือ admin API response
- asset purge ปรับ quota และไม่ทิ้ง R2 orphan

## Phase 7 - QA, Rollout and Production Deployment (Release 1A)

ระยะเวลา: 3-4 วัน

### Steps

- [x] deploy/test บน staging resources ก่อน production ทุกครั้ง
- [x] รัน API unit/integration tests
- [x] รัน migration gate
- [x] รัน web build และตรวจ typecheck baseline ไม่เพิ่ม
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
- [x] deploy/apply migration บน staging และรัน smoke
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

## Phase 8 - Marketing Workspace และ Content Calendar Creative Integration (Release 1B)

ระยะเวลา: 7-10 วัน

### Steps

- [x] สร้าง `010-cross-tool-creative.sql` สำหรับ `content_items`, `creative_batches`, `creative_requests`, `asset_links` และ indexes
- [x] เพิ่ม `CREATIVE_EMBEDDED_ENABLED` และ beta gating แยกจาก Core Studio
- [x] เพิ่ม ownership/unique constraints และ migration gate tests
- [x] สร้าง Content Calendar materializer หลัง Step 5 generation
- [ ] ทำ lazy/backfill job สำหรับ project เดิมที่มี `step5.output.calendar`
- [x] กำหนด matching/hash strategy เพื่อ preserve stable item ID เมื่อ regenerate
- [ ] แยก Content Calendar renderer ออกจาก generic `OutputRenderer`
- [ ] เปลี่ยน Content Calendar UI/export ให้อ่าน `content_items` ก่อนและ fallback JSON snapshot
- [x] เพิ่ม lifecycle state, transition guard, approval audit event และ server-side action endpoints สำหรับ review/schedule/publish acknowledgement
- [x] สร้าง source adapter ที่ map hook/caption/CTA/visual suggestion/platform/format เป็น Creative Context
- [ ] สร้าง Idea/Trend-to-Content adapter ที่รับ source metadata, proposed angles และ return route โดยไม่ผูกกับ trend crawler ใหม่
- [ ] สร้าง `EmbeddedCreativeComposer.svelte`
- [x] เพิ่ม Create Creative, status, thumbnail และ Open in Studio ต่อ content item
- [ ] เพิ่ม return-to-source behavior ที่ scroll/focus กลับ item เดิม
- [x] เพิ่ม attach/set-primary asset APIs
- [ ] เพิ่ม batch selection, aggregate quote, confirm และ per-item progress/refund
- [x] สร้าง `/dashboard`, `/inbox` และ `/works` โดยอ่าน `content_items`/asset links ชุดเดียวกัน
- [ ] เพิ่ม action queue: pending review, active generation, next scheduled และ calendar empty slot
- [x] เพิ่ม review preview, approve/reject reason, schedule และ manual-publish acknowledgement ที่ audit ได้
- [ ] ทำ active Brand Context prefill ใน Calendar, Idea entry และ Composer พร้อม snapshot ต่อ request
- [x] ออกแบบ service interface/publish audit สำหรับ social connector ในอนาคต แต่ยังไม่เชื่อม OAuth หรือ auto-publish ใน release นี้
- [ ] ทดสอบ regenerate calendar โดยไม่ทำ asset links หาย
- [ ] ทดสอบ ownership chain และ cross-project/cross-user denial
- [ ] รัน full integration บน staging ก่อนเปิด beta

### Exit Criteria

- Content item ทุกตัวมี stable server-generated ID
- Existing project ที่มี Step 5 output ถูก materialize โดยไม่ต้อง regenerate
- Composer เปิดพร้อม brief/copy/preset ที่ prefill แล้ว
- Dashboard, Inbox, Calendar และ Works อ่าน content lifecycle record เดียวกันโดยไม่สร้าง status แยก
- item ที่ยังไม่ approve ไม่สามารถถูก scheduled/published ผ่าน API ได้ เว้นแต่ workspace policy อนุญาตและมี audit reason
- Single และ batch generation attach output กลับ item ถูกต้อง
- Batch failure คืนเครดิตและ retry แยก item ได้
- Open in Studio และ return กลับ content item เดิมได้
- Calendar regenerate ไม่ลบหรือย้าย asset link ผิด item
- `step_assets` behavior เดิมไม่ regression
- Idea/Trend entry เปิด Composer พร้อม source snapshot และกลับมาที่ content item ใหม่ได้

## Phase 9 - Brand Kit and Composition (Release 1C)

ระยะเวลา: 7-10 วัน

### Steps

- [x] สร้าง `011-brand-kit-compositions.sql`
- [x] เพิ่ม `BRAND_COMPOSITION_ENABLED` แยกจาก generation core
- [x] สร้าง Brand Kit CRUD
- [x] เพิ่ม logo/product/style asset roles
- [x] เพิ่ม color palette editor แบบ swatches
- [ ] เพิ่ม font upload และ license confirmation
- [ ] parse font metadata และสร้าง preview
- [ ] ทำ renderer spike และเลือก production approach
- [x] สร้าง composition document schema
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

## Phase 10 - Direct Publishing Connectors (Post-1C)

ระยะเวลา: 10-16 วันสำหรับ Meta รุ่นแรก; TikTok และ LINE ประเมินแยกหลังผ่าน partner/app review

### Product boundary

Direct publishing คือการส่ง content item ที่ผ่าน approval ไปยัง account ที่ผู้ใช้เชื่อมด้วย OAuth แล้ว และรอผลยืนยันจาก platform ก่อน mark ว่า `published` ไม่ใช่การ copy caption ไป clipboard หรือเปิด share URL

เริ่มจาก **Instagram Professional + Facebook Page** เพราะตรงกับ output ภาพของ Release 1A-1C มากที่สุด จากนั้นจึงเพิ่ม TikTok Direct Post สำหรับ photo/video และ LINE Official Account Messaging สำหรับการส่งข้อความถึง audience ของ OA โดย LINE ไม่ใช่ feed post แบบ Instagram/Facebook

### Data model และ state machine

เพิ่ม migration additive ใหม่ `012-social-publishing.sql`:

- `social_accounts`: user/project owner, provider, provider account/page ID, display metadata, encrypted refresh/access token, scopes, token expiry, connection status, last verification time
- `social_publications`: content_item ID, social_account ID, platform-specific payload snapshot, idempotency key, scheduled time/timezone, status, remote post ID/URL, error code, retry count, timestamps
- `social_publish_events`: provider webhook/poll event payload hash, verification state, normalized outcome และ audit linkage

หนึ่ง `content_item` มี publication ได้หลายรายการ เช่น Instagram สำเร็จแต่ Facebook ล้มเหลว จึงห้ามใช้ `content_items.status = 'published'` เพียงตัวเดียวเป็น source of truth ของทุก channel

```text
approved -> scheduled -> publishing -> published
                       -> publish_failed -> retry_scheduled
                       -> needs_reauth
```

สถานะรวมของ content item derive จาก publication ที่ผู้ใช้เลือกเท่านั้น และต้องแสดงผลราย account/channel อย่างชัดเจน

### Steps

- [x] สร้าง provider-agnostic capability catalog และ manual publication scaffold
- [ ] สร้าง OAuth connect/callback/disconnect flow ที่ state/PKCE/redirect allowlist ปลอดภัย
- [ ] encrypt token ก่อนเก็บ D1 ด้วย versioned encryption key ใน Worker secret หรือ managed secret store; ห้ามส่ง token กลับ browser/log
- [ ] เก็บ scopes, expiry และ health check; token หมดอายุเปลี่ยน `needs_reauth` โดยไม่ retry แบบสุ่มเสี่ยง
- [ ] เพิ่ม publish destination selector ใน review/schedule flow พร้อม preview format, caption, hashtags, visibility และ user confirmation ตาม platform policy
- [x] เพิ่ม `social_publications` scaffold แยกต่อ destination พร้อม idempotency key และ immutable payload snapshot
- [ ] ขยาย durable D1 work-item/Cron processor ให้ claim `submit_social_publish`, `poll_social_publish`, `refresh_social_token` และ `reconcile_social_publish`
- [ ] สร้าง purpose-bound media delivery URL สำหรับ platform fetch/upload; ไม่เปิด R2 public และตั้ง TTL ให้พอสำหรับ platform pull/retry
- [ ] implement Meta adapter: connect Facebook Page + Instagram Professional account, media container/upload, publish, remote result reconciliation และ permission/app-review handling
- [ ] implement TikTok adapter เฉพาะหลัง app ได้ scope/audit ที่จำเป็น: query creator info, explicit creator consent, initialize Direct Post, upload/pull media และ poll/webhook final status
- [ ] implement LINE OA adapter เป็น Messaging campaign flow แยกจาก feed post: audience selection, push/broadcast/narrowcast, message validation, quota และ delivery reporting
- [ ] normalize platform errors เป็น `validation_failed`, `token_expired`, `permission_denied`, `remote_processing`, `remote_rejected`, `rate_limited`, `unknown_outcome`
- [ ] เพิ่ม retry เฉพาะ error ที่ safe และใช้ idempotency key/provider reference เพื่อกัน post ซ้ำ
- [ ] เพิ่ม audit log สำหรับ connect, disconnect, schedule, cancel, submit, retry, remote result และ manual resolution
- [ ] ทำ app-review submission, privacy policy/data deletion callback, security review และ production-domain verification ก่อนเปิด public beta

### Exit Criteria

- ผู้ใช้เชื่อม/ตัดการเชื่อมต่อ account ของตัวเองได้โดยไม่เห็น token ดิบ
- content ที่ยังไม่ approved ไม่สามารถสร้าง direct publish job ได้
- schedule เดียวส่งได้หลาย channel และติดตามผลแยกกันได้
- worker crash, callback ซ้ำ หรือ timeout ไม่ทำให้ post ซ้ำ
- platform success เท่านั้นที่ทำให้ publication เป็น `published`; unknown outcome ต้อง reconcile ก่อน retry
- asset ที่ platform ดึงได้จำกัด purpose/TTL และไม่กลายเป็น public R2 object
- Meta ผ่าน app review/permission ที่จำเป็นก่อนเปิดกับ external users
- TikTok external posting เปิดเมื่อผ่าน API audit เท่านั้น; ก่อนนั้นใช้ Upload-to-draft หรือ export ตาม policy
- LINE flow แสดงชัดว่าเป็น OA message campaign พร้อม audience/quota ไม่ใช่ social feed post

---

## 14. Proposed File Map

### API

```text
apps/api/src/mediaRoutes.ts
apps/api/src/brandKitRoutes.ts
apps/api/src/creativeRequestRoutes.ts
apps/api/src/contentItemRoutes.ts
apps/api/src/socialPublishRoutes.ts
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
apps/api/src/lib/creative/types.ts
apps/api/src/lib/creative/contextResolver.ts
apps/api/src/lib/creative/sourceAdapters/contentItem.ts
apps/api/src/lib/creative/assetLinks.ts
apps/api/src/lib/creative/batchOrchestrator.ts
apps/api/src/lib/social/types.ts
apps/api/src/lib/social/router.ts
apps/api/src/lib/social/tokenVault.ts
apps/api/src/lib/social/meta.ts
apps/api/src/lib/social/tiktok.ts
apps/api/src/lib/social/line.ts
apps/api/migrations/009-creative-studio-core.sql
apps/api/migrations/010-cross-tool-creative.sql
apps/api/migrations/011-brand-kit-compositions.sql
apps/api/migrations/012-social-publishing.sql
apps/api/test/media-credits.test.ts
apps/api/test/media-references.test.ts
apps/api/test/media-routes.test.ts
apps/api/test/media-work-items.test.ts
apps/api/test/media-webhooks.test.ts
apps/api/test/csrf.test.ts
apps/api/test/creative-context.test.ts
apps/api/test/content-items.test.ts
apps/api/test/asset-links.test.ts
apps/api/test/creative-batches.test.ts
apps/api/test/social-publishing.test.ts
apps/api/wrangler.toml                 # exact vars, Cron และ env.staging
```

### Web

```text
apps/web/src/routes/studio/+page.svelte
apps/web/src/routes/studio/requests/[id]/+page.svelte
apps/web/src/routes/studio/library/+page.svelte
apps/web/src/routes/studio/brand-kits/+page.svelte
apps/web/src/routes/dashboard/+page.svelte
apps/web/src/routes/inbox/+page.svelte
apps/web/src/routes/works/+page.svelte
apps/web/src/lib/creative/ModelSelector.svelte
apps/web/src/lib/creative/PromptEditor.svelte
apps/web/src/lib/creative/ReferenceTray.svelte
apps/web/src/lib/creative/ReferenceCard.svelte
apps/web/src/lib/creative/AssetPicker.svelte
apps/web/src/lib/creative/GenerationStatus.svelte
apps/web/src/lib/creative/GenerationGrid.svelte
apps/web/src/lib/creative/CompositionEditor.svelte
apps/web/src/lib/creative/EmbeddedCreativeComposer.svelte
apps/web/src/lib/creative/CreativeSourceStatus.svelte
apps/web/src/lib/ContentCalendarRenderer.svelte
apps/web/src/lib/content/ContentActionQueue.svelte
apps/web/src/lib/content/ReviewInbox.svelte
apps/web/src/lib/content/ContentLifecycleBadge.svelte
apps/web/src/lib/social/SocialAccountConnect.svelte
apps/web/src/lib/social/PublishDestinationPicker.svelte
apps/web/src/lib/social/PublicationStatus.svelte
apps/web/src/lib/mediaApi.ts
apps/web/src/lib/mediaTypes.ts
```

แยก `mediaApi.ts` ออกจาก `api.ts` เพราะไฟล์ API client ปัจจุบันมีขนาดใหญ่แล้ว และ feature นี้มี type/endpoint จำนวนมาก

---

## 15. Test Plan

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
- Creative Context mapping ต่อ platform/format
- Content item matching/hash และ stable-ID preservation
- Asset-link primary/version transition
- Content lifecycle transition guard, policy override และ audit event
- Brand Context merge precedence, snapshot/version และ default-reference resolution
- Per-destination publishing idempotency, retry classification และ aggregate content status

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
- Existing Step 5 JSON materialization/backfill
- Calendar regenerate แล้ว preserve/archive item และ asset links ถูกต้อง
- Creative request source snapshot และ stale-context detection
- Single/batch attach, per-item settlement และ partial batch failure
- Cross-user/cross-project source-to-asset attach denial
- Reject/schedule/publish transition ที่ข้าม approval policy
- OAuth callback state/PKCE, encrypted token persistence, expired-token และ disconnect
- Platform callback/poll reconciliation, remote unknown outcome และ duplicate publish prevention

### Frontend tests

- Capability controls เปลี่ยนตาม model
- `@mention` autocomplete และ unresolved state
- Upload validation
- Insufficient credit state
- Async status transitions
- Refresh/resume job
- Library reuse workflow
- Embedded Composer prefill/open/close/resume
- Return-to-source route และ focus item เดิม
- Content item status/primary thumbnail/variations
- Batch quote/progress/retry ราย item
- Dashboard action queue และ Inbox/Calendar/Works state consistency
- Brand Context selection/prefill และไม่มี silent mutation ของงานเก่า
- Connect account, schedule per destination, re-auth และ partial multi-channel publish state

### Manual/E2E matrix

| Scenario | Desktop | Mobile | Light | Dark |
|---|---:|---:|---:|---:|
| Text-to-image | Yes | Yes | Yes | Yes |
| Multi-reference | Yes | Yes | Yes | Yes |
| Failed/refund | Yes | Yes | Yes | Yes |
| Library/reuse | Yes | Yes | Yes | Yes |
| Content Calendar embedded composer | Yes | Yes | Yes | Yes |
| Batch creative generation | Yes | Yes | Yes | Yes |
| Open Studio / return to source | Yes | Yes | Yes | Yes |
| Brand composition | Yes | Yes | Yes | Yes |

มาตรฐาน verification ของ repository:

- `apps/api`: tests ต้องผ่านทั้งหมด
- `apps/web`: production build ต้องผ่าน
- ไฟล์ Creative Studio ใหม่/แก้ต้องไม่มี TypeScript/Svelte diagnostic ใหม่ และ error baseline ทั้ง repo ต้องไม่เพิ่ม
- ตรวจด้วย browser จริงว่าภาพโหลด ไม่ blank และ controls ไม่ overlap

---

## 16. Deployment Checklist

### Secrets/variables ที่คาดว่าจะเพิ่ม

```text
MEDIA_SIGNING_SECRET
CSRF_SIGNING_SECRET
CREATIVE_STUDIO_ENABLED
CREATIVE_EMBEDDED_ENABLED
BRAND_CONTEXT_ENABLED
BRAND_COMPOSITION_ENABLED
SOCIAL_PUBLISHING_ENABLED
SOCIAL_TOKEN_ENCRYPTION_KEY_VERSION
META_APP_ID
META_APP_SECRET
TIKTOK_CLIENT_KEY
TIKTOK_CLIENT_SECRET
LINE_CHANNEL_SECRET (continued below)
```

หมายเหตุ 2026-08-02: fal.ai ไม่ใช้ `FAL_KEY` เป็น Worker secret อีกต่อไป — ระบบมีตาราง `platform_provider_keys` (migration `015-platform-provider-keys.sql`) ให้แอดมินวาง API key ผ่านหน้า `/admin/creative` โดยตรง (เก็บเข้ารหัสด้วย `MASTER_ENCRYPTION_KEY`) แล้วใช้งานได้ทันทีโดยไม่ต้อง deploy ใหม่ — ดู `apps/api/src/lib/media/providerKeys.ts`

```text
LINE_CHANNEL_SECRET
LINE_CHANNEL_ACCESS_TOKEN
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

สถานะ Phase 0B: สร้าง `businessaios-db-staging` แล้วด้วย D1 ID `5a895ec0-3a30-494c-b478-e8f84496303a`, สร้าง `businessaios-exports-staging` แล้ว และ deploy staging Worker สำเร็จที่ `https://businessaios-api-staging.pskspace.workers.dev`

สถานะ Phase 5-10 ล่าสุด 2026-08-02:

- Apply staging migrations ถึง `012-social-publishing.sql` แล้ว
- API staging deployed: `https://businessaios-api-staging.pskspace.workers.dev`, Version ID `dc6d5742-38ac-4994-b47b-ada4dc9910e2`
- Web staging deployed: `https://businessaios-web-staging.pskspace.workers.dev`, Version ID `3d20e2b5-07d6-4e85-909c-f96de7e4edf3`
- Staging feature flags เปิดแล้ว: `CREATIVE_STUDIO_ENABLED`, `BRAND_CONTEXT_ENABLED`, `CREATIVE_EMBEDDED_ENABLED`, `BRAND_COMPOSITION_ENABLED`, `SOCIAL_PUBLISHING_ENABLED`
- Smoke ผ่าน: `GET /api/config`, `GET /studio`, `GET /inbox`, `GET /settings/social`
- Direct publishing ยังเป็น scaffold/manual workflow; OAuth, provider adapters และ app review ยังไม่เปิดใช้งานจริง

สถานะจริง 2026-08-02 (ตรวจสอบและแก้ไขโดย Claude หลังพบว่าเอกสารรุ่นก่อนหน้าไม่ตรงกับของจริง):

- **Migration 009-014 ทั้งหมด apply บน production D1 แล้ว** (ไม่ใช่แค่ staging) — ยืนยันจาก `wrangler d1 migrations list businessaios-db --remote` และตรวจตาราง `ai_models`, `media_generations`, `content_items`, `brand_kits`, `social_accounts` มีอยู่จริงใน production
- **API และ Web deploy ขึ้น production แล้ว** ที่ `businessaios-api.pskspace.workers.dev` และ `businessaios-web.pskspace.workers.dev` — `/studio`, `/inbox` ตอบ 200 จริงบน production, **ไม่มี beta-user gating** (`CREATIVE_STUDIO_BETA_USER_IDS` ไม่ได้ใช้ในโค้ดเลย) แปลว่า user ที่ล็อกอินทุกคนเข้าถึงได้ ไม่ใช่แค่ admin/internal ตามที่ Phase 7 ตั้งใจ
- Production feature flags ปัจจุบัน (แก้ไข 2026-08-02): `CREATIVE_STUDIO_ENABLED=true`, `BRAND_CONTEXT_ENABLED=true`, `CREATIVE_EMBEDDED_ENABLED=true`, **`BRAND_COMPOSITION_ENABLED=false`, `SOCIAL_PUBLISHING_ENABLED=false`, `CONTENT_SERIES_ENABLED=false`** (ปิดสามตัวหลังนี้เพราะ Phase 9 font/renderer, Phase 10 OAuth และ Content Series Generator (ดูหัวข้อใหม่ด้านล่าง) ยังไม่ผ่าน QA จริง — ปิดที่ backend middleware จริง ไม่ใช่แค่ซ่อน UI: `/api/brand-kits*`, `/api/compositions*`, `/api/social/*`, `/api/content-series*` ตอบ `404 feature_disabled` ทั้งหมดตอนนี้)
- Staging ยังเปิดทุก flag ไว้เหมือนเดิมสำหรับทดสอบภายใน
- **Phase 7 (QA/Security) ส่วนใหญ่ยังไม่ได้ทำ** ตาม checklist ด้านบน แม้ระบบจะ deploy ขึ้น production ไปแล้วก็ตาม — งานที่เหลือค้างอยู่จริง ไม่ใช่แค่เอกสารพิมพ์ผิด

#### สรุปงานค้างแบบเข้าใจง่าย (ไม่เทคนิค)

**1. QA/Security ที่ยังไม่ทำ (Phase 7)** — คือการทดสอบว่าระบบจะไม่พังหรือถูกโกงในสถานการณ์แปลกๆ เช่น:

- คนนึงเห็น/ลบรูปของอีกคนได้ไหม (ควรตอบ: ไม่ได้)
- มีคนปลอมข้อความหลอกระบบว่า "งานเสร็จแล้ว" ทั้งที่ไม่ได้สร้างจริง แล้วได้ของฟรีไหม
- กดปุ่ม "สร้างภาพ" รัวๆ หลายที จะโดนหักเครดิตซ้ำกี่รอบไหม
- ถ้าราคาขึ้นกลางทาง ระบบจะหักเกินที่ user เห็นตอนกดยืนยันไหม
- ถ้าสร้างภาพไม่สำเร็จภายในเวลาที่กำหนด เครดิตจะคืนให้ user จริงไหม

พวกนี้คือ "เทสความปลอดภัย/เงิน" ที่ยังไม่มีใครลองยิงจริงเลย ทั้งที่ตอนนี้เปิดให้ user ทุกคนใช้ฟีเจอร์นี้อยู่แล้ว — ความเสี่ยงคือถ้ามีบั๊กจริงในเคสพวกนี้ อาจมีคนโกงเครดิตหรือเห็นข้อมูลคนอื่นได้โดยเราไม่รู้ตัว

**2. Brand Kit (font/composition) — ที่ปิดไปแล้ว** — ของที่ตั้งใจทำคือ: อัปโหลดโลโก้/สี/ฟอนต์ของแบรนด์ตัวเอง แล้วเอาไปแปะข้อความ ราคา หรือโลโก้ลงบนรูปที่ AI สร้าง โดยใช้โลโก้ไฟล์จริง ไม่ให้ AI วาดโลโก้ใหม่เอง (เพราะ AI วาดโลโก้มักเพี้ยน) ตอนนี้ส่วน "อัปโหลดฟอนต์" กับ "เครื่องมือวางข้อความ/โลโก้ลงรูป" ยังไม่มีเลยสักตัว มีแค่หน้าตา CRUD (สร้าง/แก้/ลบ Brand Kit) เฉยๆ เลยปิดไว้ก่อนเพราะของยังไม่ครบ

**3. Social publishing OAuth — ที่ปิดไปแล้ว** — ของที่ตั้งใจทำคือ: กดปุ่มเดียวในระบบแล้วโพสต์ลง Facebook/Instagram/TikTok/LINE ได้เลย ตอนนี้มีแค่ "ที่เก็บข้อมูล" ว่าจะโพสต์อะไร ไปช่องไหน แต่ยังไม่ได้ต่อสายจริงกับ Facebook/TikTok/LINE เลยสักตัว เหมือนมีปลั๊กเสียบรอไว้แต่สายไฟยังไม่ได้ต่อ — ถ้าเปิดตอนนี้ user กดโพสต์ จะไม่มีอะไรเกิดขึ้นจริงบนโซเชียลมีเดีย

### Content Series Generator (เพิ่มใหม่ 2026-08-02, นอกแผน Phase เดิม)

ฟีเจอร์ใหม่ที่เพิ่มนอกเหนือจาก Phase 1-10 เดิม — แรงบันดาลใจจากการดูคู่แข่ง (Hero AI Engine) ที่ gen content ได้ทีละชิ้นเท่านั้น ไม่รองรับการ gen เป็นชุดจากหัวข้อเดียว

- **ทำอะไร**: ใส่หัวข้อเดียว (เช่น "เปิดร้านกาแฟใหม่ย่านทองหล่อ") + จำนวน content ที่ต้องการ (1-7 ชิ้น ต่อรอบ — เพดานที่วัดจริงจาก MiniMax-M3, มากกว่านี้ JSON จะถูกตัดกลางคัน) + ความถี่โพสต์ → ระบบเรียก MiniMax ครั้งเดียวสร้าง content ครบชุด มุมมองต่างกัน (awareness/education/social_proof/conversion) ไม่ซ้ำกัน แล้ววางลง `content_items` พร้อม `scheduled_at` ตาม cadence โดยอัตโนมัติ
- **Template**: ผู้ใช้เลือก template กำหนด slot rotation (ลำดับมุมมอง/สไตล์ hook/สไตล์ CTA) และผูก Brand Book/Profile เข้ามาได้ — template แบ่งเป็นของ user เอง (private) กับของ admin (global, `owner_user_id IS NULL`, ทุก user เห็นหมด) แยกด้วยคอลัมน์ `owner_type`
- **Schema**: migration `016-content-series.sql` เพิ่ม `content_series_templates`, `content_series`, และคอลัมน์ `series_id`/`series_slot_index` บน `content_items` เดิม (ไม่แตะ `creative_batches`/`creative_requests` ที่มีอยู่แล้วแต่ยังไม่ได้ใช้งานจริง — เป็นแนวคิดคนละอันกัน)
- **เครดิต**: reserve-then-reconcile pattern เดียวกับ wizard เดิม — จองเครดิตประมาณการก่อนเรียก AI แล้วคืนส่วนต่าง/เก็บเพิ่มตามการใช้จริงหลังเรียกเสร็จ, refund เต็มจำนวนถ้า AI call ล้มเหลว
- **สถานะ**: build + test เสร็จแล้ว (`apps/api/test/contentSeries.test.ts`, 12 tests ผ่านหมด รวม migration gate test), ตรวจสอบ manual ผ่าน local dev แล้ว (gen จริงผ่าน MiniMax, credit true-up ถูกต้อง, template visibility split ถูกต้อง) — **ยังไม่เปิด production** (`CONTENT_SERIES_ENABLED=false`) ตามหลักการเดียวกับ Brand Composition/Social Publishing คือฟีเจอร์ใหม่ต้องผ่าน QA/ใช้งานจริงบน staging ก่อน จึงเปิด production; เปิดไว้แล้วบน staging (`CONTENT_SERIES_ENABLED=true`)
- **ยังไม่ทำ**: หน้า admin สำหรับจัดการ global template แบบเฉพาะ (ตอนนี้ admin สร้าง/แก้/ลบ template กลางผ่านหน้า `/studio/series` เดียวกับ user ปกติ โดยเช็ค role ฝั่ง backend — ยังไม่มี dashboard แยกสำหรับดู usage/stats ของ series), การเชื่อมต่อ direct publish ไปโซเชียลจริง (รอ Phase 10)

### Migration rollout ต่อ release

```text
Release 1A -> 009-creative-studio-core.sql
Release 1B -> 010-cross-tool-creative.sql + content-item backfill/materialization
Release 1C -> 011-brand-kit-compositions.sql
Post-1C  -> 012-social-publishing.sql + OAuth credentials/app-review approval
```

แต่ละ migration ต้องผ่าน local + staging migration gate และ smoke test แยก ห้ามรวมการแก้ migration เก่าหรือแก้ไฟล์ migration ที่ production บันทึกว่า applied แล้ว

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
- ปิด `CREATIVE_EMBEDDED_ENABLED` แยกได้โดยให้ Content Calendar กลับไป render/read เดิมโดยไม่ลบ `content_items` หรือ `asset_links`
- ปิด `BRAND_CONTEXT_ENABLED` ได้โดยใช้ explicit empty profile; ห้ามลบ snapshot ที่งานเก่าอ้างถึง
- ปิด `BRAND_COMPOSITION_ENABLED` แยกจาก generation core
- ปิด `SOCIAL_PUBLISHING_ENABLED` เพื่อหยุด submit งานใหม่ แต่คง polling/reconciliation สำหรับงานที่ provider รับไปแล้ว
- ตั้งทุก model เป็น maintenance
- หยุดรับ generation ใหม่ แต่ยังเปิด status/history/download
- ปล่อย work processor ทำเฉพาะ ingest/refund/purge ที่ปลอดภัย ห้าม submit provider job ใหม่
- ห้ามลบ table หรือ asset ระหว่าง incident
- reconcile job ที่ reserved/processing ค้างก่อนคืนเครดิต
- rollback Web ได้โดยไม่ rollback additive database migration

---

## 17. Definition of Done

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
- [ ] Brand Context Lite ถูกใช้ใน generation ใหม่และมี immutable snapshot ที่ตรวจสอบได้
- [ ] Admin เปิด/ปิดโมเดลและ maintenance mode ได้
- [ ] exact-origin, CSRF, fal signature และ replay tests ผ่าน
- [ ] archive/delete/purge lifecycle ทำงานและไม่ทิ้ง R2 orphan
- [ ] staging full-flow ผ่านก่อน production migration/deploy
- [ ] Cross-user access tests ผ่าน
- [ ] Production deploy หลัง feature flag และ smoke test ผ่าน

Release 1B ถือว่าเสร็จเมื่อ:

- [ ] Existing Content Calendar output ถูก materialize เป็น stable `content_items`
- [ ] แต่ละ content item เปิด Embedded Composer พร้อม prefilled context ได้
- [ ] Dashboard, Inbox, Calendar และ Works แสดง `content_items` เดียวกันอย่างสอดคล้อง
- [ ] Approval/schedule/publish acknowledgement เปลี่ยนผ่าน server-side transition พร้อม audit event
- [ ] Single generation attach output กลับ item พร้อม primary/version ถูกต้อง
- [ ] Batch แสดง aggregate quote แต่ reserve/finalize/refund แยกต่อ item
- [ ] Job ทำต่อได้หลังปิด composer และ source item แสดงสถานะล่าสุด
- [ ] Open in Studio และ return ไป content item เดิมได้
- [ ] Calendar regenerate ไม่ทำ asset links หายหรือย้ายผิด item
- [ ] Cross-user/cross-project attach ถูกปฏิเสธ
- [ ] Contract พร้อมเพิ่ม Hook/Offer/Presentation source adapter โดยไม่เปลี่ยน media core

Release 1C ถือว่าเสร็จเมื่อ:

- [ ] ผู้ใช้สร้าง Brand Kit ได้
- [ ] อัปโหลด logo, product, colors และ font ได้
- [ ] มี license confirmation สำหรับ font/brand asset
- [ ] ระบบวางข้อความจริงด้วย custom font ได้
- [ ] ระบบวาง logo ต้นฉบับโดยไม่ให้ AI วาดใหม่
- [ ] แก้ text overlay และ export ใหม่โดยไม่ generate base image

Phase 10 ถือว่าเสร็จเมื่อ:

- [ ] เชื่อม Meta account ผ่าน OAuth และเลือก Instagram Professional/Facebook Page ที่มีสิทธิ์ได้
- [ ] งาน scheduled สร้าง publication แยก per destination และ reconcile ผลจริงได้
- [ ] callback/poll ซ้ำหรือ worker retry ไม่ทำให้ post ซ้ำ
- [ ] token หมดอายุหยุดงานเป็น `needs_reauth` พร้อม action ที่ปลอดภัย
- [ ] direct publish เปิดเฉพาะ platform/app permission ที่ผ่าน review แล้ว

---

## 18. Metrics หลังเปิด Beta

### Product

- Generation completion rate
- Time to first completed image
- Percentage of jobs using references
- Average references per job
- Reuse Prompt / Use as Reference rate
- Download rate
- Embedded Composer open-to-generate conversion
- Percentage of content items ที่มี attached creative
- Batch generation completion/partial-failure rate
- Open in Studio และ return-to-source completion rate
- 7-day return rate ของ Creative Studio users
- Approval-to-schedule rate และ median time to approval
- Scheduled-to-published success rate แยก per platform
- Direct-publish adoption, re-auth rate และ manual-resolution rate

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

## 19. Risks และ Cut Lines

| Risk | ผลกระทบ | Mitigation / Cut line |
|---|---|---|
| Multi-reference behavior ต่างกันมาก | UX ไม่สม่ำเสมอ | capability-driven UI และ adapter mapping |
| Provider webhook ไม่เสถียร | job ค้าง | persist event เร็ว + scheduled provider-status reconciliation |
| Worker/webhook หยุดกลางงาน | hold/job ค้าง | D1 outbox + lease + Cron reconciler + dead letter |
| Credit ซ้ำจาก retry | เสียความเชื่อมั่น | persistent idempotency key + conditional hold transition |
| Provider รับ job แต่ response หาย | submit ซ้ำและต้นทุนสองครั้ง | write-ahead attempt + `submission_unknown` + manual/reconciler path |
| Provider URL หมดอายุ | งานเก่าหาย | copy output เข้า R2 ก่อน completed |
| Provider สำเร็จแต่ R2 ล้มเหลว | user จ่ายแต่ไม่มีไฟล์ | delivery pending + retry + refund หลัง deadline |
| Content Calendar JSON ไม่มี stable ID | asset ผูกผิด post หลัง regenerate | materialize content_items + hash reconciliation + archive unmatched |
| Batch ถูกทำเป็น provider call ก้อนเดียว | refund/retry แยกรายการไม่ได้ | orchestrate แยก generation/hold ต่อ item |
| Polymorphic asset link ข้าม owner | asset leakage | validate source/asset/request ownership chain ทุก mutation |
| สถานะ Dashboard/Calendar/Inbox แยกกัน | ผู้ใช้ทำงานผิด item หรือ publish ผิด | ใช้ `content_items` และ transition service เดียว; ห้ามมี client-derived status เป็น source of truth |
| Brand rules เปลี่ยนงานเก่าเงียบ ๆ | audit/reuse ผิดและผู้ใช้สับสน | เก็บ immutable profile snapshot/version ต่อ creative request/generation |
| Auto-publish ก่อน approval | brand/reputational risk | Release 1B เป็น workflow + manual acknowledgement; direct publish ต้องผ่าน policy gate และ remote confirmation |
| OAuth token รั่วหรือหมดอายุ | publish ไม่ได้/บัญชีเสี่ยง | token vault encryption, short-lived access token, re-auth state, secret rotation และไม่ log token |
| Platform timeout แล้วผลไม่ชัด | retry ซ้ำจนโพสต์ซ้ำ | per-destination idempotency, remote reference, poll/webhook reconcile และ manual resolution |
| TikTok/Meta app review ไม่ผ่านหรือใช้เวลานาน | เปิด external direct post ไม่ได้ | ส่ง review ตั้งแต่ spike; release manual/export และ Meta-first โดยไม่ block core |
| Font renderer บน Worker ไม่พร้อม | Release ช้า | ส่ง Brand Kit composition ไป Release 1C |
| Image decode เกิน Worker memory | request ล้ม/กระทบ isolate | quarantine + stream + max megapixels + Phase 0 processor spike |
| Remove background เพิ่ม cost/latency | margin ลด | แสดงราคาแยกและทำ on-demand |
| Asset storage โตเร็ว | ค่าใช้จ่ายเพิ่ม | quota, soft delete และ retention policy |
| Signed URL รั่ว | asset ถูกอ่านจน URL หมดอายุ | purpose-bound signature + short TTL + no token logging |
| Safety policy ต่างกัน | fallback ผิด policy | policy-compatible routing เท่านั้น |
| Scope ใหญ่เกินไป | deploy ไม่ทัน | Release 1A ตัด Brand Kit renderer ออกได้โดยไม่กระทบ core |

Critical cut line คือ **Release 1A Core Studio + Brand Context Lite ต้องเสร็จก่อน** จากนั้น Release 1B เปิด Marketing Workspace และ Content Calendar integration โดยยังไม่ทำ social auto-publish ส่วน Brand Kit/font composition อยู่ Release 1C และ direct publishing อยู่ Phase 10 หลัง core workflow เสถียร จึงไม่บล็อก beta ของ generation, review หรือ Calendar

---

## 20. Decisions ที่ต้องยืนยันก่อนเริ่ม Code

มีค่าแนะนำเพื่อให้เริ่มงานได้โดยไม่ค้าง:

| Decision | ค่าแนะนำเริ่มต้น |
|---|---|
| Primary provider | MiniMax `image-01` สำหรับ Phase 0B/Release 1A spike; `fal.ai` เป็น secondary/future option |
| Initial models | MiniMax `image-01` text-to-image + character-reference image-to-image; product-reference และ multi-reference ต้องหา provider/adapter เพิ่ม |
| Max upload | 10 MB ต่อไฟล์ |
| Max decoded size | เริ่ม reject ที่ 16MP ใน first-pass inspector แล้ววัด memory เพิ่มด้วย max-file/concurrent tests |
| Reference UI limit | UI รองรับหลายภาพได้ แต่ MiniMax `image-01` adapter เปิดใช้ reference เดียวแบบ character ก่อน |
| Upload transport | Worker streaming gateway -> R2 quarantine ใน Release 1A |
| Provider asset URL | HMAC Worker URL แบบ purpose-bound และ short TTL |
| Asset retention | Archive เก็บต่อ; Delete เข้า scheduled purge ตาม retention policy |
| R2 strategy | production ใช้ bucket เดิมแยก `media/` prefix; staging ใช้ `businessaios-exports-staging` |
| Async durability | D1 work-item outbox + Cron Trigger; `waitUntil` เป็น optimization เท่านั้น |
| Beta rollout | admin/internal ก่อน แล้ว invited users |
| User price | lock ตาม quote; ห้าม upward true-up; MiniMax `image-01` beta starting point 2 credits/output จาก provider cost $0.0035/image |
| Credit failure policy | finalize เมื่อ R2 delivery พร้อม; refund หากไม่มี output ส่งมอบได้ |
| Webhook security | Provider-specific; MiniMax `image-01` sync response ไม่มี webhook ใน spike แรก, หากเพิ่ม fal ใช้ ED25519 signature + timestamp + JWKS cache |
| Browser security | exact origin + session-bound CSRF token |
| Environments | local -> `businessaios-api-staging` + `businessaios-db-staging` + `businessaios-exports-staging` -> production |
| Brand context รุ่นแรก | structured Brand Context Lite + immutable snapshot; composition/rendering อยู่ Release 1C |
| First embedded integration | Content Calendar |
| Marketing Workspace รุ่นแรก | dashboard action queue + approval inbox + content-centric works library; ไม่ทำ social auto-publish |
| Approval policy | schedule/publish ผ่าน server-side transition และ audit event เท่านั้น |
| Direct publish order | Meta (Instagram Professional/Facebook Page) ก่อน; TikTok หลัง audit; LINE เป็น OA messaging flow แยก |
| Existing Step 5 storage | materialize JSON output เป็น stable `content_items`; ไม่ overload `step_assets` |
| Cross-tool relation | generic `creative_requests` + `asset_links` |
| Batch billing | aggregate quote แต่ generation/hold/refund แยกต่อ item |
| Font/Logo | post-composition ใน Release 1C |
| URL import | เลื่อนไปจนมี SSRF-safe proxy |

---

## 21. Estimated Schedule

| Phase | ระยะเวลาโดยประมาณ |
|---|---:|
| Phase 0 - Security/provider/processor spike + staging | 3-4 วัน |
| Phase 1 - Data foundation + Brand Context Lite | 3-4 วัน |
| Phase 2 - Asset/reference backend | 3-4 วัน |
| Phase 3 - Provider/jobs/credits/durable worker | 4-6 วัน |
| Phase 4 - Studio frontend | 3-4 วัน |
| Phase 5 - Library/reuse | 2-3 วัน |
| Phase 6 - Admin/observability | 2-3 วัน |
| Phase 7 - QA/staging/production rollout | 3-4 วัน |
| Phase 8 - Marketing Workspace + Content Calendar creative integration | 7-10 วัน |
| Phase 9 - Brand Kit/composition | 7-10 วัน |
| Phase 10 - Meta direct publishing | 10-16 วัน + app-review lead time |

ประมาณการ:

- Release 1A Core Image Studio + Brand Context Lite internal beta: 23-33 วันทำการ
- Release 1B Marketing Workspace + Content Calendar Integration: เพิ่ม 7-10 วันทำการ
- Release 1C Brand Kit + Font Composition: เพิ่ม 7-10 วันทำการ
- Phase 10 Meta direct publishing: เพิ่ม 10-16 วันทำการ ไม่รวม lead time ของ Meta app review
- รวมถึง Release 1C โดยประมาณ: 37-53 วันทำการ ขึ้นกับ provider integration, content-item backfill, review workflow, image processor และ renderer spike

ตัวเลขนี้เป็น implementation estimate ไม่รวมเวลารอเปิด provider account, เติมเครดิต provider, review policy หรือการตัดสินใจด้านราคา

---

## 22. Recommended Execution Order

ลำดับที่แนะนำให้เริ่มจริง:

1. ตั้ง staging secrets ให้แยกจาก production
2. ทำ HMAC content URL, upload quarantine และ deployed Worker/R2 smoke บน staging
3. Freeze model capability/pricing matrix และ upload strategy
4. ทำ migration, Brand Context Lite, persistent idempotency, work-item outbox และ feature flag
5. ทำ asset ownership/quarantine/R2 pipeline
6. ทำ reference resolver และ provider adapter
7. ทำ credit hold + durable async lifecycle + reconciler ให้ทดสอบผ่านก่อนสร้าง UI เต็ม
8. ทำ Creative Studio UI พร้อม active Brand Context และ credit surface
9. ทำ Library/reuse/delete-purge lifecycle
10. ผ่าน staging full-flow แล้วเปิด internal beta ของ Release 1A
11. เก็บ latency, delivery failure, refund และ margin data
12. ทำ Content Calendar materialization + lifecycle transition service + Embedded Composer เป็น Phase 8 / Release 1B
13. ทำ Dashboard action queue, Approval Inbox และ Works Library จาก `content_items` เดียวกัน
14. เก็บ embedded-to-generate, attach, review-to-schedule และ batch metrics
15. ทำ Brand Kit/font composition เป็น Phase 9 / Release 1C
16. ทำ Meta direct publishing เป็น Phase 10 เมื่อ review workflow เสถียรและ app-review ผ่าน
17. หลัง Phase 10 ค่อยเพิ่ม Hook Library/Million Dollar Offer adapters, TikTok และ LINE ตาม metrics โดยไม่แก้ media core

หลักสำคัญคือไม่เริ่มจากหน้าตาที่คล้าย ZenityX ก่อน job lifecycle และ credit correctness เสร็จ เพราะสองส่วนนี้เป็นฐานของการ deploy และการคิดเงินจริงทั้งหมด

---

## 23. Technical References

- [fal Asynchronous Inference](https://fal.ai/docs/documentation/model-apis/inference/queue) - queue lifecycle, polling, result และ cancellation
- [fal Webhooks](https://fal.ai/docs/documentation/model-apis/inference/webhooks) - delivery retries, timeout, ED25519 signature และ JWKS verification
- [MiniMax Text to Image](https://platform.minimax.io/docs/api-reference/image-generation-t2i) - `image-01` text-to-image endpoint, request schema และ response formats
- [MiniMax Image to Image](https://platform.minimax.io/docs/api-reference/image-generation-i2i) - `subject_reference` สำหรับ character/product reference
- [Cloudflare D1 batch API](https://developers.cloudflare.com/d1/worker-api/d1-database/) - transactional batch และ rollback behavior
- [Cloudflare R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) - private bucket access ผ่าน Worker binding
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) - future direct upload/download path ที่ต้องใช้ S3 API credentials
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/) - CPU, memory, request size และ `waitUntil()` constraints
- [Meta Instagram Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/) - professional-account publishing flow และ app permissions
- [Meta Pages API Posts](https://developers.facebook.com/docs/pages-api/posts/) - Facebook Page publishing capabilities
- [TikTok Direct Post](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post) - creator authorization, upload/pull media, publish ID และ status reconciliation
- [TikTok Content Sharing Guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines/) - app audit, visibility และ posting caps
- [LINE Messaging API](https://developers.line.biz/en/docs/messaging-api/sending-messages/) - OA push/broadcast/narrowcast message model
