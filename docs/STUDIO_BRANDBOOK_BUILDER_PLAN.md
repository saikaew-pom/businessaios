# Studio / Brandbook Builder Function Plan

> เอกสารสรุปแผนสร้าง Brandbook Builder และ Brand Kit รุ่นใหม่สำหรับ Creative Studio
>
> สถานะเอกสาร: Draft v1 สำหรับเริ่ม implementation
> วันที่จัดทำ: 2026-08-02
> ระบบเป้าหมาย: BusinessAiOs / Creative Studio บน Cloudflare Workers
> Stack ปัจจุบัน: SvelteKit 5, Tailwind, Hono, Cloudflare Workers, D1, R2

---

## 1. Product Vision

Brand Kits ต้องถูกยกระดับจาก "ที่เก็บสีและฟอนต์" เป็น "Machine-readable Brandbook" ที่ AI และเครื่องมือทุกตัวใน BusinessAiOs ใช้ร่วมกันได้

เป้าหมายคือให้ผู้ใช้ที่ไม่ใช่สายการตลาดสามารถสร้าง brandbook ที่ใช้งานจริงได้ โดยกรอกเองให้น้อยที่สุด และให้ AI ช่วยคิด ช่วยเขียน ช่วยถอด style จาก reference และช่วยแนะนำ layout/template ให้เลือก

Brandbook นี้ต้องใช้ต่อได้กับ:

1. Creative Studio image generation
2. Reference image workflow
3. Asset Library
4. Content Calendar
5. Social Publishing
6. Saved Tools / Marketing tools
7. PDF export
8. Future composition/template editor

ระบบต้องรองรับการสร้างเนื้อหา brandbook เป็นภาษาไทยได้ดีตั้งแต่ต้น ไม่ใช่แปลจากอังกฤษแบบแข็ง ๆ และต้องเลือกภาษา PDF export ได้เป็นภาษาไทย, ภาษาอังกฤษ หรือสองภาษา

หลักคิดสำคัญ:

```text
Brand inputs
  -> AI-assisted brandbook draft
  -> User review/edit
  -> Save as Brand Kit
  -> Use across Studio, Calendar, Social, Tools
  -> Export beautiful branded PDF
```

---

## 2. User Problem

ผู้ใช้ SME ส่วนใหญ่ไม่ได้เป็น marketer หรือ designer จึงมักติดปัญหาเหล่านี้:

1. ไม่รู้ว่าควรเขียน brand positioning อย่างไร
2. คิด tone of voice ไม่ออก
3. ไม่รู้ว่า visual identity ต้องกำหนดอะไรบ้าง
4. เลือกสี ฟอนต์ layout ไม่มั่นใจ
5. มี reference ที่ชอบ แต่ไม่รู้จะอธิบาย style เป็นคำพูดอย่างไร
6. มี brandbook หรือ content เดิมอยู่ แต่ไม่อยากกรอกใหม่ทั้งหมด
7. ต้องการ PDF brandbook ที่ดูมืออาชีพและใช้ส่งทีม/agency ได้

ดังนั้นระบบต้องทำให้ผู้ใช้กรอกเองแค่ข้อมูลขั้นต่ำ แล้ว AI ช่วยเติมส่วนที่เหลือ

---

## 3. Minimum Input

ข้อมูลที่ผู้ใช้ต้องกรอกเองควรเหลือแค่:

1. Brand name
2. Business description
3. Logo upload
4. Preferred brandbook language: Thai, English หรือ Bilingual

ข้อมูล optional:

1. Website หรือ social link
2. Existing brandbook PDF
3. ภาพ reference ที่ชอบจากแบรนด์อื่นหรือผลงานเดิม
4. ตัวอย่าง content เดิม
5. Font files
6. Product / people / style assets
7. Existing Brand Voice tool result หรือ project/playbook ที่เคยสร้างไว้

ทุกอย่างหลังจากนั้นควรมี AI ช่วยเสนอ draft ให้ user review

---

## 4. Core User Flows

### 4.1 Create New Brandbook

1. User เปิด `Studio > Brand Kits`
2. กด `Create Brandbook`
3. กรอก brand name
4. กรอก business description
5. Upload logo
6. Optional: upload references / brandbook / fonts
7. กด `Generate Brandbook Draft`
8. AI สร้าง draft แยก section
9. User review/edit/regenerate ราย section
10. User เลือก layout templates
11. User save เป็น Brand Kit
12. User ตั้งเป็น default ได้
13. User export PDF ได้ โดยเลือกภาษาไทย, อังกฤษ หรือสองภาษา

### 4.2 Upload Existing Brandbook

1. User upload PDF/doc/image ที่เป็น brand guideline เดิม
2. ระบบ extract ข้อมูลออกมา
3. ระบบแสดง confidence ต่อ field
4. User review/edit
5. User save เป็น Brand Kit
6. Source file ถูกเก็บเป็น asset และผูกกับ brandbook version

### 4.3 Extract Style From Inspiration Images

1. User upload ภาพ ads/poster/template/social post/website screenshot ที่ชอบ
2. User ระบุ optional note เช่น "ชอบความ premium" หรือ "อยากได้แนวนี้แต่ไม่ลอก"
3. ระบบถอด style direction ออกมา
4. ระบบสร้าง visual identity และ creative rules ที่ใกล้เคียงเชิงแนวทาง
5. ระบบใส่ similarity guardrails ป้องกันการลอก logo, trademark, slogan, mascot หรือ layout เฉพาะ
6. User review/save

ชื่อ feature ที่ควรใช้ใน UI:

```text
Extract Style
```

ไม่ควรใช้คำว่า copy brand เพราะประสบการณ์ควรเป็น "ถอดแนวทาง" ไม่ใช่ "ลอกแบรนด์"

### 4.4 Generate Brandbook From Existing Tool Results

1. User เลือก source จาก Saved Tools เช่น Brand Voice, Persona, JTBD, Value Proposition
2. ระบบรวมข้อมูลเข้ากับ business description
3. AI สร้าง brandbook draft
4. User review/save

### 4.5 Edit Existing Brandbook

1. User เปิด Brand Kit detail
2. แก้ไข section ได้ทั้งหมด
3. Regenerate เฉพาะ section ได้
4. เปลี่ยน font/color/layout ได้
5. Save เป็น current version
6. Future: version history / restore version

### 4.6 Delete / Archive

Brandbook ต้องจัดการ lifecycle ได้:

1. `Archive` ซ่อนจากการใช้งาน แต่ไม่ลบประวัติ
2. `Delete forever` ลบถาวร

ข้อควรระวัง:

1. Generation/composition เก่าห้ามพัง
2. Job เก่าควรอ้างอิง `brand_context_snapshot` หรือ `brandbook_snapshot` ที่ถูก freeze ไว้ตอน generate
3. Delete forever ลบ brand kit record และ brand kit asset links ได้ แต่ไม่ควรลบ media asset ต้นทางอัตโนมัติ เว้นแต่ user เลือกลบ asset แยกเอง

---

## 4.7 Multilingual Brandbook Flow

Brandbook ต้องรองรับภาษาในระดับ product flow:

1. ตอนสร้าง brandbook ให้เลือกภาษาเริ่มต้น: `Thai`, `English`, `Bilingual`
2. ถ้าเลือก `Thai` ระบบต้อง generate ทุก section เป็นภาษาไทยธรรมชาติ เหมาะกับการใช้จริงในตลาดไทย
3. ถ้าเลือก `English` ระบบต้อง generate เป็นภาษาอังกฤษที่พร้อมใช้กับทีม/agency/inter brand
4. ถ้าเลือก `Bilingual` ระบบต้องสร้างข้อมูลคู่ภาษา ไม่ใช่เอา paragraph ไทยและอังกฤษปนใน field เดียว
5. ตอน export PDF ให้เลือกภาษาได้อีกครั้ง: Thai only, English only หรือ Bilingual
6. Bilingual PDF ควรมี layout ที่อ่านง่าย เช่น ไทยก่อน อังกฤษรอง หรือ two-column เฉพาะบาง section
7. Tone of voice, CTA, sample caption และ placeholder copy ต้อง generate ตามภาษาที่เลือก
8. Font matching ต้องเช็คภาษาไทยเสมอ ถ้า brandbook ใช้ Thai หรือ Bilingual

Language options:

```text
th = Thai
en = English
th-en = Bilingual Thai + English
```

ข้อสำคัญ:

1. ห้ามใช้ English-first schema ที่แปลไทยทีหลังแบบหยาบ
2. Thai copy ต้องอ่านเหมือนคนไทยเขียนจริง โดยเฉพาะ headline, CTA, social caption และ PDF section title
3. ระบบต้องเก็บ language preference ใน brandbook เพื่อใช้กับ Creative Studio และ Content Calendar ต่อ
4. User สามารถ regenerate เฉพาะภาษาใดภาษาหนึ่งได้ เช่น "แก้ภาษาไทย แต่คงอังกฤษไว้"

---

## 5. Brandbook Data Model

Brandbook ควรเก็บเป็น structured data ที่ AI และ renderer อ่านได้ ไม่ใช่ text blob เดียว

### 5.1 Brand Identity

ควรมี:

1. Brand name
2. Business description
3. Category / industry
4. Positioning
5. Value proposition
6. Target audience summary
7. Brand personality
8. Brand promise
9. Short tagline
10. Long description

AI smart writing:

1. Suggest positioning
2. Generate value proposition
3. Create tagline options
4. Rewrite as premium
5. Rewrite as friendly
6. Make it simpler

Multilingual fields:

1. Field ที่เป็นข้อความควรรองรับ localized value
2. Thai และ English ต้องเก็บแยกกันเมื่อ brandbook เป็น bilingual
3. Field ที่เป็น taxonomy เช่น `personality` เก็บได้ทั้ง canonical value และ display text ตามภาษา

ตัวอย่าง:

```json
{
  "positioning": {
    "th": "โค้ชสอน AI สำหรับผู้ประกอบการ SME ที่อยากเอา AI ไปใช้ทำงานจริง",
    "en": "AI coaching for SME owners who want practical AI workflows for daily business"
  }
}
```

### 5.2 Logo System

ควรมี:

1. Primary logo
2. Horizontal logo
3. Vertical logo
4. Icon mark
5. Monochrome logo
6. Light/dark usage
7. Clear space rule
8. Minimum size
9. Incorrect usage

Asset roles:

1. `logo_primary`
2. `logo_horizontal`
3. `logo_icon`
4. `logo_mono`
5. `watermark`

### 5.3 Color System

ควรมี:

1. Primary color
2. Secondary colors
3. Accent colors
4. Background colors
5. Text colors
6. Border/divider colors
7. CTA color
8. Semantic colors เช่น success/warning/danger ถ้าจำเป็น

แต่ละสีควรเก็บ:

```json
{
  "role": "primary",
  "name": "Midnight Navy",
  "hex": "#08152f",
  "usage": "main background and premium brand surfaces",
  "contrast_note": "Use with warm gold or white text"
}
```

AI extraction จาก reference:

1. Dominant palette
2. Accent palette
3. Contrast level
4. Warm/cool mood
5. Suggested accessible text pairing

### 5.4 Typography System

ควรมี:

1. Main font
2. Heading font
3. Body font
4. Accent font
5. Fallback font
6. Font weights
7. Thai/English compatibility
8. Usage rules
9. License note

Font sources:

1. Google Fonts
2. Uploaded font file: `.ttf`, `.otf`, `.woff`, `.woff2`
3. System fallback

Google Fonts feasibility:

1. Google Fonts Developer API สามารถใช้ดึง metadata ของ font families, variants และ subsets ได้
2. Google Fonts CSS API ใช้โหลด font ผ่าน stylesheet ได้
3. CSS API v2 รองรับ variable fonts
4. ควร cache font catalog ในระบบเพื่อลด dependency/runtime latency
5. สำหรับ PDF export ควรใช้ font ที่โหลดได้เสถียรหรือ self-host/snapshot ใน R2 เมื่อจำเป็น

Font matching:

เมื่อ user เลือก main font ระบบควรแนะนำ:

1. Heading font
2. Body font
3. Accent font
4. Thai-compatible pairing
5. English-compatible pairing
6. Fallback stack
7. Thai rendering quality
8. English rendering quality
9. Mixed Thai/English headline quality

ตัวอย่าง:

```text
Main: Prompt
Recommended:
- Heading: Prompt SemiBold
- Body: Sarabun
- Accent: Kanit
- Fallback: system-ui, sans-serif
Reason: อ่านไทยดี ดู modern เหมาะกับ SME/education/AI coaching
```

User ต้องเปลี่ยน font ที่ AI match มาให้ได้

Language-specific font rules:

1. Thai brandbook ต้องใช้ font ที่อ่านไทยดีใน PDF และ social creative
2. Bilingual brandbook ต้องมี pair ที่ทำงานได้กับไทยและอังกฤษ
3. ถ้า heading font ภาษาอังกฤษไม่รองรับไทย ให้ระบบแนะนำ Thai companion font
4. PDF export ต้อง fallback อย่างสง่างาม ไม่ให้ตัวอักษรไทยกลายเป็น tofu/missing glyph
5. Template preview ต้องใช้ font ที่รองรับภาษาของ placeholder จริง

### 5.5 Tone of Voice

Source ที่ใช้สร้าง tone of voice:

1. Upload PDF/content เดิม
2. Saved Tool Result: Brand Voice
3. Project/playbook
4. Business description
5. Social post examples

ควรมี:

1. Tone summary
2. Personality dimensions
3. Words to use
4. Words to avoid
5. CTA style
6. Caption style
7. Hashtag style
8. Sample short caption
9. Sample long caption
10. Do/don't examples

Multilingual requirements:

1. Thai tone of voice ต้องเป็นภาษาไทยที่ใช้งานจริง ไม่ใช่แปลตรงตัวจากอังกฤษ
2. English tone of voice ต้องสื่อบุคลิกเดียวกับภาษาไทย แต่ไม่จำเป็นต้องแปลคำต่อคำ
3. Bilingual brandbook ต้องมี sample captions ทั้งสองภาษา
4. Words to use / avoid ต้องแยกตามภาษา
5. CTA style ต้องแยกภาษา เช่น "สมัครเลย" อาจไม่เท่ากับ "Register now" เสมอไป

AI smart writing:

1. Generate tone from business description
2. Extract tone from uploaded PDF/content
3. Make tone warmer
4. Make tone more premium
5. Make tone more direct sales
6. Make tone more educational
7. Generate Thai copy
8. Generate English copy
9. Translate/adapt tone while preserving brand personality

### 5.6 Image / Creative Style

ส่วนนี้ไม่ควรให้ user กรอกเองอย่างเดียว ต้องถอดจาก reference assets ได้

ควรมี:

1. Overall visual mood
2. Lighting style
3. Composition style
4. People style
5. Product style
6. Background style
7. Texture/pattern
8. Graphic elements
9. Icon/illustration style
10. Photography direction
11. Negative style

ตัวอย่าง:

```json
{
  "visual_mood": ["premium", "confident", "professional"],
  "lighting": "warm studio lighting with subtle highlights",
  "composition": "portrait-led with strong headline hierarchy",
  "graphic_elements": ["thin gold border", "diagonal gold line", "dark navy panels"],
  "avoid": ["cheap stock-photo look", "overly busy background", "copying another brand logo"]
}
```

### 5.7 Layout / Template System

Layout ควรมี preset ให้เลือกหลายแบบ ไม่ควรเริ่มจาก canvas ว่าง

จาก reference screenshots ควรเริ่มด้วย template presets:

1. Quote Card
2. Personal Brand Cover
3. Course Launch Poster
4. Webinar Banner
5. Podcast Cover
6. Carousel Cover
7. Carousel Slide
8. Article Cover
9. Product Promo
10. Event Poster
11. Testimonial Card
12. Before/After Card
13. Checklist Card
14. Tips / Number List
15. Announcement
16. Story Intro
17. LINE OA Broadcast
18. LinkedIn Cover
19. LinkedIn Carousel
20. Facebook Ad
21. IG Square Post
22. IG Story 9:16
23. Blog Cover
24. Lead Magnet Cover
25. Offer / Pricing Card

แต่ละ template ต้องเป็น placeholder-driven:

```json
{
  "template_id": "course_launch_poster",
  "name": "Course Launch Poster",
  "aspect_ratios": ["4:5", "1:1", "9:16"],
  "placeholders": [
    "headline",
    "subheadline",
    "course_name",
    "date",
    "time",
    "price",
    "speaker_name",
    "cta",
    "logo",
    "portrait_image"
  ]
}
```

เมื่อกรอก Brand Basics แล้ว ระบบควรใช้ brandbook data ไป generate layout preview หลายแบบให้เลือก

Language-specific layout rules:

1. Thai headlines มักกินพื้นที่แนวนอนต่างจากอังกฤษ ต้องมี text-safe placeholder
2. Template ต้องรู้ว่ารองรับภาษาไทย, อังกฤษ หรือ bilingual
3. Bilingual layout ควรมี placeholder แยก เช่น `{headline_th}` และ `{headline_en}`
4. PDF และ social template ต้องไม่ใช้ font size ที่ทำให้ภาษาไทยล้นกล่อง
5. Template gallery ควร filter ได้ด้วย `Thai copy`, `English copy`, `Bilingual`

### 5.8 Products / People / Assets

Brandbook ควรผูก asset จาก Asset Library ได้

Asset roles:

1. Logo
2. Product
3. People
4. Founder
5. Team
6. Style Reference
7. Template
8. Font
9. Background
10. Icon

ควรมี tag:

1. Products
2. People
3. Styles
4. Logo
5. Template
6. Font

### 5.9 Compliance / Rules

ควรมี:

1. Claims that are allowed
2. Claims to avoid
3. Legal disclaimer
4. License notes
5. Restricted words
6. Sensitive categories
7. Social platform restrictions

### 5.10 AI Prompt Guide

Brandbook ควรสร้าง prompt guide ให้ Creative Studio ใช้ได้

ควรมี:

1. Default image prompt style
2. Default negative prompt
3. Reference usage rules
4. Brand-safe phrasing
5. Layout prompt snippets
6. Platform-specific prompt instructions

---

## 6. AI-Assisted Writing Tools

ทุก field สำคัญควรมี Smart Writing ไม่ใช่ textarea ว่าง

### 6.1 Field-level Actions

ปุ่มที่ควรมีในแต่ละ section:

1. `Suggest`
2. `Rewrite`
3. `Make premium`
4. `Make friendly`
5. `Make concise`
6. `Make more direct`
7. `Generate examples`
8. `Extract from references`
9. `Regenerate section`

### 6.2 Whole-brand Actions

ปุ่มหลัก:

1. `Generate Brandbook Draft`
2. `Improve Brandbook`
3. `Extract From Uploaded Files`
4. `Generate Layout Suggestions`
5. `Generate Font Pairing`
6. `Generate PDF Preview`

### 6.3 Smart Placeholder Writing

สำหรับ layout/template ระบบควรช่วย generate placeholder copy เช่น:

1. Headline options
2. Subheadline
3. CTA
4. Course title
5. Offer line
6. Short social hook
7. Carousel slide title
8. Webinar banner text

User ต้องแก้ได้เองทุก placeholder

---

## 7. Upload / Extraction Sources

ระบบควรรองรับ upload หลายประเภท:

### 7.1 Brandbook Files

1. PDF
2. PNG/JPEG screenshots
3. Future: DOCX/PPTX

Extract:

1. Logo rules
2. Colors
3. Fonts
4. Tone
5. Layout rules
6. Visual examples

### 7.2 Inspiration Images

1. Ads
2. Social posts
3. Posters
4. Carousel examples
5. Website screenshots
6. Competitor visual examples

Extract:

1. Style summary
2. Color mood
3. Typography feel
4. Layout pattern
5. Creative style
6. Do/don't guardrails

### 7.3 Logo Upload

Extract:

1. Primary colors
2. Logo aspect ratio
3. Light/dark suitability
4. Possible clear space
5. Suggested palette extension

### 7.4 Font Upload

Support:

1. `.ttf`
2. `.otf`
3. `.woff`
4. `.woff2`

Require:

1. Font license confirmation
2. License note
3. Source note
4. Role assignment: heading/body/accent

---

## 8. Review Experience

หลัง AI extract/generate ต้องไม่ save ทันที ควรให้ user review ก่อน

Review sections:

1. Brand Summary
2. Logo
3. Colors
4. Typography
5. Tone of Voice
6. Creative Style
7. Layout Templates
8. Assets
9. Do / Don't
10. AI Prompt Guide

แต่ละ field ควรมี:

1. Value
2. Source
3. Confidence
4. Edit button
5. Regenerate button

ตัวอย่าง:

```text
Primary Color
Value: #08152f
Source: extracted from logo + reference images
Confidence: High
```

---

## 9. PDF Export

Brandbook ต้อง download ออกมาเป็น PDF ได้ และต้องดูเป็นมืออาชีพ

ตอน export ต้องเลือกภาษาได้:

1. Thai PDF
2. English PDF
3. Bilingual PDF

### 9.1 PDF Requirements

1. ใช้สีจริงจาก brandbook
2. ใช้ font จริงจาก brandbook เท่าที่ระบบรองรับ
3. ใช้โลโก้จริง
4. มี color chips พร้อม hex
5. มี typography samples
6. มี visual style examples
7. มี layout/template preview
8. มี do/don't examples
9. มี prompt guide สำหรับ AI generation
10. Export แล้วพร้อมส่งทีม/agency/client
11. ภาษาไทยต้อง render ถูกต้องทั้งสระ วรรณยุกต์ การตัดบรรทัด และ fallback font
12. Bilingual PDF ต้องจัดหน้าให้อ่านง่าย ไม่ใช่เอาสองภาษามาต่อกันจนรก

### 9.2 PDF Sections

1. Cover
2. Brand Overview
3. Logo Usage
4. Color System
5. Typography System
6. Tone of Voice
7. Visual Identity
8. Creative Style
9. Layout Templates
10. Social Content Rules
11. Do / Don't
12. Asset Library
13. AI Prompt Guide
14. Version / Source Notes

### 9.3 PDF Styling Rules

PDF renderer ต้องอ่านจาก brandbook:

1. `colors.primary`
2. `colors.accent`
3. `typography.heading`
4. `typography.body`
5. `logo.primary`
6. `layout_style`
7. `language.default`
8. `language.export_mode`

ห้ามใช้ PDF template กลางที่ไม่ reflect brand

### 9.4 PDF Language Modes

Thai only:

1. ใช้ section title ภาษาไทย
2. ใช้ Thai tone/CTA/sample copy
3. ใช้ Thai-compatible font stack

English only:

1. ใช้ section title ภาษาอังกฤษ
2. ใช้ English tone/CTA/sample copy
3. ใช้ English-compatible font stack

Bilingual:

1. Cover แสดงชื่อ brand และ subtitle สองภาษาได้
2. Section สำคัญควรแสดงไทยและอังกฤษคู่กัน
3. ใช้ layout ที่ไม่ทำให้ text แน่นเกินไป
4. ถ้าพื้นที่จำกัด ให้ไทยเป็น primary และอังกฤษเป็น secondary หรือให้ user เลือก primary language
5. Export metadata ต้องระบุว่าเป็น bilingual version

### 9.5 Export Formats

Phase แรก:

1. PDF

Future:

1. HTML share link
2. PNG cover preview
3. ZIP package with logos/fonts/assets
4. Editable brandbook document

---

## 10. Suggested Schema

ระบบปัจจุบันมี `brand_kits` ที่เก็บ:

1. `colors_json`
2. `typography_json`
3. `rules_json`
4. `brand_kit_assets`

Phase แรกสามารถเก็บ brandbook structured data ใน `rules_json.brandbook` ก่อน เพื่อไม่ต้องรื้อ schema ใหญ่ทันที

### 10.1 Brandbook JSON Shape

```json
{
  "schema_version": 1,
  "language": {
    "default": "th",
    "supported": ["th"],
    "pdf_export_default": "th",
    "bilingual_primary": "th"
  },
  "identity": {
    "brand_name": { "th": "", "en": "" },
    "business_description": { "th": "", "en": "" },
    "industry": "",
    "positioning": { "th": "", "en": "" },
    "value_proposition": { "th": "", "en": "" },
    "audience_summary": { "th": "", "en": "" },
    "personality": [],
    "tagline": { "th": "", "en": "" }
  },
  "logo": {
    "primary_asset_id": "",
    "variants": [],
    "usage_rules": [],
    "donts": []
  },
  "colors": [],
  "typography": {
    "main": {},
    "heading": {},
    "body": {},
    "accent": {},
    "fallback_stack": []
  },
  "tone_of_voice": {
    "summary": { "th": "", "en": "" },
    "use_words": { "th": [], "en": [] },
    "avoid_words": { "th": [], "en": [] },
    "cta_style": { "th": "", "en": "" },
    "sample_captions": { "th": [], "en": [] }
  },
  "creative_style": {
    "visual_mood": [],
    "lighting": "",
    "composition": "",
    "people_style": "",
    "product_style": "",
    "background_style": "",
    "graphic_elements": [],
    "avoid": []
  },
  "layouts": {
    "selected_templates": [],
    "placeholder_rules": {},
    "platform_rules": {},
    "localized_placeholders": {
      "th": {},
      "en": {}
    }
  },
  "assets": {
    "logo_asset_ids": [],
    "product_asset_ids": [],
    "people_asset_ids": [],
    "style_reference_asset_ids": [],
    "font_asset_ids": []
  },
  "inspiration": {
    "source_type": "uploaded_images",
    "source_asset_ids": [],
    "style_summary": "",
    "similarity_guardrails": []
  },
  "compliance": {
    "allowed_claims": [],
    "restricted_claims": [],
    "disclaimer": "",
    "license_notes": []
  },
  "ai_prompt_guide": {
    "default_prompt_style": { "th": "", "en": "" },
    "negative_prompt": { "th": "", "en": "" },
    "reference_rules": [],
    "platform_snippets": {}
  },
  "sources": [],
  "review": {
    "status": "draft",
    "reviewed_at": null
  }
}
```

### 10.2 Future Dedicated Tables

เมื่อ feature โตขึ้น ควรแยกตาราง:

1. `brandbook_versions`
2. `brandbook_imports`
3. `brandbook_extraction_jobs`
4. `brandbook_pdf_exports`
5. `font_catalog_cache`
6. `brandbook_template_selections`

แต่ Phase แรกไม่จำเป็นต้องแยกทั้งหมด

---

## 11. API Design

### 11.1 Current APIs

มีแล้ว:

1. `GET /api/brand-kits`
2. `POST /api/brand-kits`
3. `GET /api/brand-kits/:id`
4. `PUT /api/brand-kits/:id`
5. `POST /api/brand-kits/:id/assets`

ควรเพิ่ม:

### 11.2 Brand Kit Lifecycle

```text
DELETE /api/brand-kits/:id
POST /api/brand-kits/:id/archive
POST /api/brand-kits/:id/restore
POST /api/brand-kits/:id/default
```

### 11.3 Brandbook Builder

```text
POST /api/brandbook/drafts
POST /api/brandbook/drafts/:id/extract
POST /api/brandbook/drafts/:id/regenerate-section
POST /api/brandbook/drafts/:id/regenerate-language
POST /api/brandbook/drafts/:id/font-match
POST /api/brandbook/drafts/:id/layout-suggestions
POST /api/brandbook/drafts/:id/save-as-brand-kit
```

Brandbook draft requests must support:

```json
{
  "language": "th",
  "supported_languages": ["th"],
  "bilingual_primary": "th"
}
```

Valid language modes:

1. `th`
2. `en`
3. `th-en`

### 11.4 Brandbook Imports

```text
POST /api/brandbook/imports/upload-intent
POST /api/brandbook/imports/:id/finalize-upload
POST /api/brandbook/imports/:id/extract
```

### 11.5 PDF Export

```text
POST /api/brand-kits/:id/export/pdf
GET /api/brand-kits/:id/exports/:export_id/download
```

PDF export request must support:

```json
{
  "language": "th",
  "bilingual_primary": "th"
}
```

Valid export modes:

1. `th`
2. `en`
3. `th-en`

### 11.6 Font Catalog

```text
GET /api/fonts/catalog
POST /api/fonts/upload-intent
POST /api/fonts/:id/finalize-upload
POST /api/fonts/match
```

---

## 12. Frontend Pages

### 12.1 Brand Kits List

Path:

```text
/studio/brand-kits
```

Needs:

1. Create Brandbook
2. Upload Brandbook
3. Extract Style
4. List kits
5. Set default
6. Edit
7. Export PDF
8. Archive
9. Delete forever

### 12.2 Brandbook Builder

Path:

```text
/studio/brand-kits/new
```

Steps:

1. Basics
2. Upload References
3. AI Draft
4. Review Sections
5. Layout Templates
6. PDF language/default settings
7. Save

Basics step must include:

1. Brand name
2. Business description
3. Logo upload
4. Brandbook language: Thai, English, Bilingual
5. Bilingual primary language when applicable

### 12.3 Brandbook Detail / Edit

Path:

```text
/studio/brand-kits/:id
```

Needs:

1. View brandbook
2. Edit sections
3. Attach assets
4. Upload fonts
5. Select Google Font
6. Font matching
7. Layout selection
8. Export PDF
9. Delete/archive

### 12.4 PDF Preview

Path:

```text
/studio/brand-kits/:id/pdf-preview
```

Needs:

1. Preview cover
2. Preview sections
3. Choose export language: Thai, English, Bilingual
4. Regenerate PDF
5. Download PDF

---

## 13. Layout Preset UX

Layout selection should feel like a template gallery.

Filters:

1. All
2. Online course
3. Restaurant
4. Real estate
5. Finance/investment
6. Health/beauty
7. Personal brand
8. Use brand
9. Thai copy
10. English copy
11. Bilingual

Card fields:

1. Preview image
2. Aspect ratio badge
3. Template name
4. Use case
5. Button: `Use this template`

Template examples:

1. `Personal Brand LinkedIn Cover`
2. `Quote Card 1:1`
3. `Story Intro 9:16`
4. `Article Cover 16:9`
5. `Course Launch Poster 4:5`
6. `LinkedIn Carousel Slide 1`
7. `Podcast Cover Art`
8. `LINE OA Daily Tip`
9. `FB Investment Ad`
10. `Webinar Registration Banner`

When user selects templates, the brandbook stores:

1. template id
2. aspect ratio
3. placeholder set
4. preferred visual style
5. brand color mapping
6. typography mapping

---

## 14. Integration With Creative Studio

Creative Studio should use active/default Brand Kit automatically.

When generating:

1. Pull active brand kit
2. Build brand context snapshot
3. Add brand colors, tone, creative style, layout rules into prompt context
4. Pull default reference assets if relevant
5. Use selected template placeholders if generation starts from a content item
6. Store snapshot with generation

User controls:

1. Choose Brand Kit
2. Toggle "Use Brand Kit"
3. Pick template
4. Pick reference assets
5. Override per generation

---

## 15. Integration With Content Calendar

Content Calendar should use Brand Kit to make posts easier.

Flow:

```text
Content item
  -> Choose platform/format
  -> Select Brand Kit
  -> Suggest layout templates
  -> Generate placeholder copy
  -> Generate creative
  -> Attach output
  -> Review
  -> Schedule / publish
```

Examples:

1. Calendar item is webinar -> suggest Webinar Banner, Story Intro, LinkedIn Cover
2. Calendar item is educational carousel -> suggest Carousel Cover + Carousel Slide
3. Calendar item is course launch -> suggest Course Launch Poster, Offer Card

---

## 16. Security / Safety / Compliance

### 16.1 Upload Safety

1. Validate file type
2. Validate file size
3. Store in R2 private bucket
4. Strip metadata where appropriate
5. Require ownership checks

### 16.2 Brand Inspiration Guardrails

When extracting from other brands:

1. Do not copy logo
2. Do not copy exact slogan
3. Do not copy trademarked character/mascot
4. Do not copy exact layout if distinctive
5. Summarize style direction only
6. Create similarity guardrails

### 16.3 Font License

1. Google Fonts can be selected from catalog
2. Uploaded font requires license confirmation
3. Store license note
4. PDF/export must include font source/license metadata when applicable

---

## 17. Implementation Phases

### Phase B0 - Spec / Schema Alignment

Goals:

1. Finalize brandbook JSON schema
2. Decide storage strategy in `rules_json.brandbook`
3. Add lifecycle fields if needed
4. Add API client types

Deliverables:

1. Brandbook schema type
2. Migration if needed
3. Updated API types

### Phase B1 - Brand Kit Lifecycle

Goals:

1. Delete forever
2. Archive/restore
3. Detail/edit page
4. Set default button

Deliverables:

1. Backend lifecycle endpoints
2. Frontend controls
3. Tests
4. Production deploy

### Phase B2 - Manual Brandbook Editor

Goals:

1. Sections editor
2. Colors editor
3. Typography editor
4. Tone editor
5. Creative style editor
6. Layout template selection
7. Language mode: Thai, English, Bilingual

Deliverables:

1. `/studio/brand-kits/new`
2. `/studio/brand-kits/:id`
3. Save/update flow
4. Localized field editor

### Phase B3 - Asset / Logo / Font Upload

Goals:

1. Upload logo
2. Attach assets from Library
3. Upload fonts
4. Font role assignment
5. License confirmation

Deliverables:

1. Asset role UI
2. Font upload UI
3. Backend font asset support

### Phase B4 - Google Fonts Catalog + Font Matching

Goals:

1. Search/select Google Fonts
2. Cache font catalog
3. AI font matching
4. Thai/English compatibility recommendation

Deliverables:

1. Font selector
2. Font match endpoint
3. Font pairing UI

### Phase B5 - AI Smart Writing

Goals:

1. Generate brandbook draft from basics
2. Regenerate section
3. Field-level rewrite
4. Placeholder copy generation
5. Thai-first generation quality
6. English generation quality
7. Bilingual adaptation without losing brand personality

Deliverables:

1. Draft endpoint
2. Smart writing UI
3. Review cards
4. Language-specific regenerate action

### Phase B6 - Brandbook / Reference Extraction

Goals:

1. Upload brandbook PDF/image
2. Extract structured data
3. Extract style from inspiration images
4. Confidence/source display
5. Similarity guardrails

Deliverables:

1. Upload/import flow
2. Extraction job
3. Review screen

### Phase B7 - Layout Template Gallery

Goals:

1. Template gallery
2. Category filters
3. Placeholder schema
4. Save selected templates into brandbook
5. Generate suggested templates from brand context

Deliverables:

1. Template cards
2. Layout selection UI
3. Placeholder preview

### Phase B8 - PDF Export

Goals:

1. Generate beautiful PDF
2. Use brand colors
3. Use brand fonts
4. Include logo/colors/typography/voice/templates/rules
5. Download PDF
6. Export Thai, English or Bilingual PDFs
7. Verify Thai font rendering and line breaks

Deliverables:

1. PDF renderer
2. Export endpoint
3. Download URL
4. PDF preview
5. Language selector in export flow

### Phase B9 - Creative Studio Integration

Goals:

1. Brand Kit selector in Studio
2. Use default Brand Kit automatically
3. Include brandbook snapshot in generation
4. Use selected templates/placeholders in prompt context

Deliverables:

1. Studio brand selector
2. Prompt context builder
3. Generation snapshot

### Phase B10 - Content Calendar Integration

Goals:

1. Use Brand Kit per content item
2. Suggest templates by content type
3. Generate placeholder copy
4. Create creative from calendar item

Deliverables:

1. Calendar creative handoff
2. Template recommendation
3. Attach output to content item

---

## 18. Acceptance Criteria

### Brandbook Creation

1. User can create brandbook with only brand name, business description and logo
2. AI can generate draft for missing sections
3. User can review and edit before save
4. User can save as Brand Kit
5. User can choose Thai, English or Bilingual language mode
6. Thai brandbook content reads naturally for Thai SME users

### Upload / Extraction

1. User can upload brandbook PDF/image
2. User can upload inspiration images
3. AI extracts visual identity and tone
4. AI shows confidence/source
5. AI adds similarity guardrails

### Fonts

1. User can select Google Font
2. User can upload font file
3. User can assign font roles
4. AI can suggest font matching
5. User can override recommendations
6. Font matching accounts for Thai support when brandbook is Thai or bilingual

### Layouts

1. User can browse template gallery
2. User can filter templates
3. User can select multiple templates
4. Template placeholders are stored in brandbook
5. AI can generate placeholder copy
6. AI can generate Thai placeholders, English placeholders or bilingual placeholders
7. Thai text does not overflow template placeholders

### PDF

1. User can export PDF
2. PDF uses brand colors
3. PDF uses selected font where supported
4. PDF includes logo, colors, typography, tone, creative style, layouts and rules
5. PDF looks professional enough to share
6. User can choose Thai, English or Bilingual PDF
7. Thai PDF renders Thai glyphs, vowels, tone marks and line breaks correctly
8. Bilingual PDF is readable and not visually overcrowded

### Lifecycle

1. User can edit brandbook
2. User can archive brandbook
3. User can delete forever
4. Old generations do not break after delete because snapshots are preserved

---

## 19. Immediate Next Step

Recommended first implementation sequence:

1. Phase B1: Brand Kit lifecycle and detail/edit page
2. Phase B2: Manual Brandbook Editor with structured schema
3. Phase B3: Logo/font/asset upload support
4. Phase B5: AI Smart Writing draft generation
5. Phase B8: PDF export

Reason:

This creates a usable product path quickly:

```text
Create/Edit Brandbook
  -> Save Brand Kit
  -> Export PDF
  -> Use in Creative Studio
```

Then add extraction and advanced template generation after the foundation is stable.

---

## 20. References

Google Fonts official docs used for feasibility:

1. Google Fonts Developer API: https://developers.google.com/fonts/docs/developer_api
2. Google Fonts CSS API: https://developers.google.com/fonts/docs/getting_started
3. Google Fonts CSS API v2 / variable fonts: https://developers.google.com/fonts/docs/css2
