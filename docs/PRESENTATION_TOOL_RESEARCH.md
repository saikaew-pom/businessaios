# Presentation Tool — Deep Research & Design Plan

**Source:** `/Users/psk/Downloads/Productive Presentation with Ai/` (4-day course by อ.กุลเชษฐ์ เล็กประยูร, Bangkok University)
**Date:** 2026-07-26
**Author:** Mavis
**Status:** Awaiting user review and approval

---

## TL;DR — What I learned

The course is **a complete product operating manual** for building a "Presentation Tool" — almost 1-to-1 with what a user needs to do end-to-end:

| User need (what course teaches) | Maps to our tool feature |
|---|---|
| Analyze audience (5Q + Communication Style) | **Step 1: Audience Profile** |
| Design Before/After (ATR by Phil Waknell) | **Step 2: Audience Transformation Map** |
| Pick storytelling framework (SCQA+Minto / 5M / Pop-Up) | **Step 3: Outline Engine** (3 frameworks) |
| Decide what's Must-Have / Maybe / Kill-It | **Step 4: Content Triage** |
| Choose slide type per page (Flat / Story / Visual) | **Step 5: Slide Blueprint** |
| Add Gestalt / Data viz / charts | **Step 6: Visual Treatment** |
| Less is More — 5 layout patterns | **Step 7: Polish Rules** |
| Generate speaker script per slide | **Step 8: Script Notes** |
| Export to PDF / PPTX / Markdown outline | **Step 9: Multi-format Export** |

**Recommendation: Build a single multi-step "AI Presentation Builder" tool that walks the user from raw content → audience analysis → slide outline → visual blueprint → exportable presentation. NOT 4 separate tools.**

The 4 days map naturally to **3 distinct modes** the user picks at step 1:
- **Informative** (default — for status reports, training, briefings) → uses SCQA + Minto
- **Persuasive** (for pitches, ideas, decisions) → uses 5M Mission Flow
- **Story** (for TED-Talk style, public speaking) → uses Pop-Up Pitch

---

## 1. The Great Presentation Framework (Day 1 — Mindset & Skills)

The course's north star. Every presentation has 3 dimensions:

```
                    The Great Presentation
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   TARGETING             DELIVER              VISUAL
   (สื่อสารคนถูกกลุ่ม)   (เล่าเรื่องเก่ง)    (มีสื่อที่เห็นภาพ)
   • Key Message ชัด     • Structure &      • มีตัวตน ภาษากาย
   • เหมาะกับผู้ฟัง        Content            • Visual aid ที่ช่วย
                        • Authenticity &     ให้คนเห็นภาพตาม
                          Connection
```

**Insight for our tool:** We can't help with "Deliver" (real-life speaking). But we CAN help with:
- **Targeting** → Step 1 audience analysis
- **Structure** → Step 3 outline engine
- **Visual** → Step 5-7 visual treatment + layout

The course explicitly says "พลาดที่ Targeting / Deliver / Visual" — meaning most presentations fail at these. We're solving Targeting + Visual fully, and Structure (which is the bridge to Deliver).

---

## 2. Audience Analysis — 3 Layers

### 2.1 Communication Styles (Mark Murphy / Leadership IQ)

4 styles in 2x2 matrix:
- **Analytical** (Unemotional + Linear) — "ตัวเลขนี้ได้มาจากไหน?"
- **Intuitive** (Unemotional + Freeform) — "แล้วรูปรวมจะได้อะไร?"
- **Functional** (Emotional + Linear) — "Process มีอะไรบ้าง? ใช้เวลาเท่าไหร่?"
- **Personal** (Emotional + Freeform) — "พวกเขารู้สึกอย่างไร?"

Each style has 4 typical questions/objections. We can encode these as **handling tips** that the AI weaves into the outline.

### 2.2 The 5 Questions to analyze any audience

1. เขาเป็นใครใน Presentation? (Who are they in this presentation?)
2. เขาอยากเห็นและได้ยินอะไร? (What do they want to see/hear?)
3. สิ่งที่จูงใจเขาได้คืออะไร? (What motivates them? — idea, opportunity, connection, growth, money, health, etc.)
4. เขาน่าจะกังวลอะไรบ้าง? (What concerns them? — clarity, time, money, quality, risk, etc.)
5. หลังฟังอยากให้เขาเปลี่ยนไปอย่างไร? (What transformation do you want?)

### 2.3 Audience Transformation Roadmap (ATR) by Phil Waknell

A 4-column canvas. **This is the heart of the tool's "audience-first" design.**

|            | KNOW | BELIEVE | FEEL | DO |
|------------|------|---------|------|-----|
| **BEFORE** | ผู้ฟังรู้อะไรแล้วบ้าง | เชื่อ/คิดอย่างไรกับเรื่องนี้ | รู้สึกอย่างไร | ทำอะไรอยู่ต่อเรื่องนี้ |
| **AFTER**  | ต้องรู้เรื่องอะไร | อยากให้เชื่ออะไร | อยากให้รู้สึกอะไร | อยากให้ทำอะไร |

> "Don't inform, transform! ไม่ใช่นำเสนอเพื่อให้ข้อมูล แต่เพื่อสร้างการเปลี่ยนแปลงของผู้ฟัง"

The middle band (the gap between Before and After) **is the content you need to present**. This is pure gold for our tool — it gives the AI a clear "what to include" framework.

**Implementation idea:** Step 2 of our tool = guided ATR canvas → user fills in 4 cells Before, 4 cells After → AI computes the gap and uses it as content brief for Step 3.

---

## 3. 3 Storytelling Frameworks (the core of outline generation)

The course teaches **3 narrative structures**, each suited for a different purpose. Our tool should let the user pick one, and the AI follows its structure strictly.

### 3.1 SCQA + Minto Pyramid
- **For:** Informative presentations (status reports, training, briefings)
- **Structure:** S (Situation) → C (Complication) → Q (Question) → A (Answer) → Minto Pyramid (Key Message + 2-4 Supporting Arguments + Data/Facts under each)
- **Inspiration:** Barbara Minto (McKinsey)
- **Best for:** สไลด์ Report, สไลด์ที่เน้นการอธิบาย, brief executives
- **Example from course:** Dell losing market share → 3 strategies to fight back

### 3.2 5M Mission Flow
- **For:** Persuasive presentations (pitches, ideas, public speaking, idea-sharing)
- **Structure:** Message → Matter → Momentum → Mindshift → Move
- **Each M's role + audience emotion:**
  | M | Role | Audience emotion |
  |---|------|------------------|
  | **Message** | จุดประกาย "เรื่องนี้สำคัญ" | สนใจ / ตั้งใจฟัง |
  | **Matter** | เข้าใจเหตุผลและภาพรวม | เห็นภาพ / เชื่อมโยง |
  | **Momentum** | รู้สึกถึงแรงขับและความจำเป็น | ตื่นตัว / ต้องเปลี่ยน |
  | **Mindshift** | เกิดความสงสัยหรือจุดประกายความคิด | เห็นต่าง / เปิดใจ |
  | **Move** | ปลุกให้คิดต่อหรือลงมือ | ตกผลึก / อยากเริ่มทำ |
- **Best for:** Pitch, Sales, Public Speaking, Idea Sharing

### 3.3 Pop-Up Pitch (by Dan Roam)
- **For:** Story-driven pitches, public pitches
- **Structure:** 10 fixed slides
  1. Title Page — รู้หัวข้อชัดเจน
  2. Common Ground — เชื่อใจเป็นทีมเดียวกัน
  3. Coming Problem — ตกใจและตื่นตัว
  4. Emotional Win — โล่งใจ มีความหวัง
  5. False Hope — ถูกดึงสติด้วยความจริง
  6. Audacious Reality — ใช้ความกล้า
  7. We Can Do This — ตื่นเต้นที่เจอทางออก, ทำได้จริง
  8. Call to Action — ไปด้วยกัน
  9. Early Benefits — อยากได้รางวัล เชื่อใจทีม
  10. The Long Win — ทะเยอทะยาน รู้สึกดี
- **Inspiration:** Dan Roam's "The Pop-Up Pitch" (used by Uber's first pitch)
- **Best for:** Ted Talk style, public pitches

**Insight:** The 3 frameworks are mutually exclusive in their "rules of order." If user picks SCQA, we don't insert 5M's "Move" CTA. The tool needs to know the structure and respect it.

---

## 4. Content Triage — Must Have / Maybe / Kill It

A practical rule from the course: **before designing slides, classify every content item.**

- **Must Have:** If removed, decision becomes impossible or story loses weight. MUST be on the slide.
- **Maybe:** Important but secondary. Can go in speaker notes or appendix.
- **Kill It:** Confuses the audience or doesn't help the decision.

> "การจัดกลุ่มนี้ ไม่ได้แปลว่าข้อมูลไม่สำคัญ แต่คือการเลือกสิ่งที่ 'ควรอยู่บนสไลด์หลัก' เท่านั้น"

**Implementation:** This is **gold for a Triage step** in our tool. User pastes raw content → AI suggests classification (Must/Maybe/Kill with reasoning) → user confirms/edits → AI uses Must + Maybe to build outline, Kill items dropped.

---

## 5. 3P Impact Flow (Day 2 — Slide Design)

The course's slide design system:

```
                3P Impact Flow
                       │
       ┌───────────────┼───────────────┐
       │               │               │
   PURPOSE            PLOT           POLISH
   (the Message)   (the Story)    (the Slide)
   ข้อมูลไหนต้องเด่น  วิธีวางโครง    สอนสูตร Layout
                    สไลด์และสคริปต์  สร้างชุดสไลด์ไม่ตาย
                    ให้ Flow
```

### 5.1 The 3 Slide Types (Purpose dimension)

- **Flat** — เน้นข้อความ, เหมาะกับสรุปท้าย / ภาคผนวก / Report slides
- **Story** — Title แบบสรุปความ + สถิติ/กราฟ/ไอคอน/ภาพประกอบ เหมาะกับทุกแบบ
- **Visual** — เน้นภาพ/อินโฟกราฟิก, text น้อยมาก, สร้างความรู้สึก, เหมาะกับ Pitch/Persuasive

### 5.2 The 5 Layout Patterns (Polish dimension — "Less is More")

5 เทคนิค "น้อยแต่มาก" ที่ scan ได้ใน 5-7 วินาที:
1. **Layout patterns** — มีชุดสไลด์ไม้ตาย (สร้าง pattern ใช้ประจำ) เช่น 4-quadrant, 3-column icons, chart+text, full-bleed image
2. **Alignment + spacing** — Gestalt principles
3. **Color hierarchy** — ใช้สี 1 เด่น + 1 รอง + neutral
4. **One idea per slide** — สไลด์ 1 หน้า 1 ประเด็น
5. **Remove before adding** — ตัดก่อนเพิ่ม

**Implementation:** Our tool can offer 5 layout templates per slide (modern flat, story-driven, visual-led, comparison, quote) — based on the "1 page 1 idea" rule.

---

## 6. Data Visualization (Day 3)

Key takeaways for the tool:

### 6.1 Gestalt Principles
8 visual encodings: Length & Width, Orientation, Symmetry, Similarity, Enclosure, Position, Color, Continuity.

### 6.2 The "แบ่ง/แข่ง/โต" framework (Composition/Comparison/Change)

This is the user's mental shortcut for picking a chart:

| Mental goal | Chart families | When to use |
|-------------|---------------|-------------|
| **แบ่ง (Composition)** | Pie, Stacked Bar, Treemap, Sankey | <5 items → Pie; >5 items → Treemap/Stacked |
| **แข่ง (Comparison)** | Grouped Bar, Clustered Bar, Bullet, Heatmap | Sort, highlight, show value differences; for "vs target" use line not bar |
| **โต (Change)** | Line, Area, Dot Plot, Slope Graph | For trends across time |

**Implementation:** When user pastes a data table, AI detects "แบ่ง/แข่ง/โต" intent (or asks) → recommends chart type → uses shadcn/recharts/echarts to render.

### 6.3 The "ตะโกน" (scream) principle
For each chart: which bar/slice do you want the audience to NOTICE? That's the "hero" data point. Make it pop with color/position/size.

---

## 7. AI Video Production (Day 4) — OPTIONAL EXTENSION

Day 4 covers AI video creation. It's a **separate workflow** that goes BEYOND slide presentations. We can defer this to a future tool.

**However, the prompt engineering structures (Who/How/What/Where/When/Why + Quality/Model/Face/Costume/Pose/Background/Lighting) are useful for generating slide hero images.** When a slide needs a "Visual" type with a generated image, our tool can use these structured prompts internally.

---

## 8. The Prompts the Course Actually Teaches

Reviewing the prompt docx files, the course teaches users to use AI to:
1. **SCQA outline** → "เขียน Outline ฉบับเต็มในรูปแบบ Document สำหรับนำไปสร้าง Presentation 10 หน้า"
2. **5M outline** → Same, with 5M framework
3. **Content triage** → "คัดเนื้อหาเพื่อทำสไลด์หลัก" with Must/Maybe/Kill
4. **Slide outline** → "แปลงเป็นตาราง Slide Outline (Slide# / Title / Body / Media Suggestion)"
5. **Data viz replication** → "Replicate the exact visual structure of [reference chart] using my data"
6. **Image prompt** → Quality/Model/Face/Costume/Pose/Background/Lighting structure

**This is the exact AI workflow we should encode into the tool.** The user shouldn't need to know these prompts — they fill a form, and the backend does the prompt engineering.

---

## 9. Tool Design Plan

### 9.1 Product Positioning

**Tool name candidates (in Thai, B2B context):**
- "Slide Builder AI" / "สร้างสไลด์อัจฉริยะ"
- "Presentation Architect" / "สถาปนิกการนำเสนอ"

**Tagline:** "From raw content to presentation in 9 guided steps — using frameworks from McKinsey, Dan Roam, and Phil Waknell."

**Differentiator:** Every other AI slide tool (Gamma, Beautiful.ai, Tome) gives you a deck. We give you a **structured decision** about who you're talking to, what they need to believe, and the right framework — then build the deck.

### 9.2 Architecture: Single multi-step wizard (RECOMMENDED)

A 9-step flow. Each step is one AI generation (with credits charged per step).

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Quick Brief                                              │
│  • Title (free text)                                              │
│  • Objective (Informative | Persuasive | Story) ← picks framework│
│  • Slide count target (5-25)                                      │
│  • Time available (minutes)                                       │
│  → AI: extract key topics, suggest framework                     │
├─────────────────────────────────────────────────────────────────┤
│  STEP 2: Audience Profile (uses BusinessContextFields preset)   │
│  • Industry + Audience from presets                               │
│  • Communication Style (multi: Analytical/Intuitive/Functional   │
│    /Personal)                                                     │
│  • Audience Concern (multi: clarity/time/money/quality/risk/...)  │
│  → AI: build audience persona card                               │
├─────────────────────────────────────────────────────────────────┤
│  STEP 3: Audience Transformation Roadmap (ATR)                   │
│  • 4×2 grid: Know / Believe / Feel / Do × Before / After         │
│  • User fills in (or AI proposes from Step 1+2)                   │
│  → AI: compute the "gap" = the content you need to present       │
├─────────────────────────────────────────────────────────────────┤
│  STEP 4: Source Content Upload                                    │
│  • Paste text / upload file (PDF, DOCX, MD)                      │
│  • Or write free-form notes                                       │
│  • Max 50,000 chars (per step_asset)                              │
│  → AI: extract candidate content items                            │
├─────────────────────────────────────────────────────────────────┤
│  STEP 5: Content Triage (Must/Maybe/Kill)                         │
│  • AI proposes classification with reasoning                       │
│  • User can move items between buckets                            │
│  • Linked: pulls from prior Brand Voice / Pain / Persona projects│
│  → AI: finalize the "content pool" for slide design              │
├─────────────────────────────────────────────────────────────────┤
│  STEP 6: Story Outline (uses framework from Step 1)              │
│  • IF Informative → SCQA + Minto Pyramid structure                │
│  • IF Persuasive → 5M Mission Flow                                │
│  • IF Story → Pop-Up Pitch (10 fixed slides)                     │
│  → AI: full outline with section labels, slide titles, key       │
│     messages, supporting data                                     │
├─────────────────────────────────────────────────────────────────┤
│  STEP 7: Slide Blueprint (per slide)                              │
│  • For each slide: pick type (Flat/Story/Visual)                  │
│  • For Visual slides: pick layout pattern (5 options)             │
│  • For data slides: pick chart type (แบ่ง/แข่ง/โต) + format     │
│  • Add media suggestion (icon, image prompt, chart spec)          │
│  → AI: final slide-by-slide blueprint                             │
├─────────────────────────────────────────────────────────────────┤
│  STEP 8: Speaker Notes                                            │
│  • Per slide: 30-60 sec script + transition line                  │
│  • Addresses the chosen communication style's concerns            │
│  → AI: write notes that handle audience objections                │
├─────────────────────────────────────────────────────────────────┤
│  STEP 9: Generate & Export                                        │
│  • HTML preview (browser print → PDF)                              │
│  • PPTX (using template structure)                                │
│  • Markdown outline                                                │
│  • JSON (for integration)                                          │
│  • Speaker notes only (.md)                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 9.3 Database schema (new tables)

Following the existing pattern (`generations`, `tool_runs`, `step_assets`):

```sql
-- Each presentation project
CREATE TABLE presentation_projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT,         -- 'informative' | 'persuasive' | 'story'
  target_slides INTEGER DEFAULT 10,
  time_minutes INTEGER,
  status TEXT DEFAULT 'draft',  -- draft | generating | ready
  outline_json TEXT,      -- Step 6 output
  blueprint_json TEXT,    -- Step 7 output
  notes_json TEXT,        -- Step 8 output
  selected_theme TEXT,    -- color theme / template
  created_at INTEGER,
  updated_at INTEGER
);

-- One row per step within a project
CREATE TABLE presentation_steps (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,  -- 1-9
  input_json TEXT,
  output_json TEXT,
  status TEXT,
  credits_used INTEGER DEFAULT 0,
  created_at INTEGER,
  UNIQUE(project_id, step_number)
);
```

(Steps 1-8 each save their own row. Step 9 reads from steps 6+7+8 to build the final output.)

### 9.4 Reuse existing infrastructure

- **BusinessContextFields** — already built, use for Step 2
- **presets/** — extend with new presentation-specific presets:
  - `presentationObjectives.ts` — informative/persuasive/story (with sub-types)
  - `communicationStyles.ts` — analytical/intuitive/functional/personal
  - `audienceConcerns.ts` — clarity/time/money/quality/risk/reputation/people
  - `slideTypes.ts` — flat/story/visual
  - `layoutPatterns.ts` — 5 patterns from Day 2
  - `chartTypes.ts` — แบ่ง/แข่ง/โต + specific chart families
- **Multi-format export** — already works (HTML/MD/JSON/CSV/DOC), extend for PPTX
- **Step assets** — already supports notes + files + project links → user can attach the source PDF in Step 4
- **Project links** — allow linking Brand Voice / Pain Points / Persona projects into the Content Triage step
- **Credit system** — 1 credit per step generation (8 steps × 1 credit = 8 credits for a full build)

### 9.5 New things we need to build

1. **Step 3 ATR canvas UI** — 4×2 grid, edit-in-place, AI-proposed values
2. **Step 4 file upload** — accept .pdf/.docx/.md/.txt, extract text server-side
3. **Step 5 triage UI** — 3-column drag-and-drop (or simpler: card with "Keep/Maybe/Kill" buttons)
4. **Step 6 framework-specific prompt** — 3 different system prompts (SCQA vs 5M vs Pop-Up) — code-switches on `objective` field
5. **Step 7 visual editor** — light, no full drag-drop; just a "Slide 1: type, layout, content, media" form
6. **Step 8 notes generation** — uses audience concerns from Step 2 to address likely objections
7. **Step 9 PDF/PPTX export** — PPTX requires a new library (PptxGenJS runs in browser; we can pre-render in browser or generate on server)
8. **Tool entry on `/tools` page** — same UX as the 3 existing tools

### 9.6 The 3 System Prompts (the secret sauce)

This is the most important deliverable. Each framework needs its own carefully-tuned prompt that:

**Prompt A: SCQA + Minto (Informative)**
- Reads: user's content + ATR + audience style
- Produces: 1 Situation slide, 1-2 Complication slides, 1 Question slide, 1 Answer slide, then 3-5 Minto pyramid slides with supporting data, then optional Summary/CTA

**Prompt B: 5M Mission Flow (Persuasive)**
- Reads: user's content + ATR + audience style + concerns
- Produces: 1 Message slide, 1-2 Matter slides, 1-2 Momentum slides, 1 Mindshift slide, 1 Move (CTA) slide — each with emotional tone matched to the M's role

**Prompt C: Pop-Up Pitch (Story)**
- Reads: user's content + ATR
- Produces: exactly 10 slides in fixed order with Dan Roam's slide names

I can write all 3 prompts in Thai + English. Each is ~500-800 tokens.

### 9.7 Credits pricing (proposal)

- Step 1 (Quick Brief) — free (just config)
- Step 2 (Audience) — 1 credit
- Step 3 (ATR) — 1 credit
- Step 4 (Source upload) — free (no AI)
- Step 5 (Triage) — 1 credit
- Step 6 (Outline) — 2 credits (longer generation)
- Step 7 (Blueprint) — 2 credits (longer generation)
- Step 8 (Notes) — 1 credit
- Step 9 (Export) — free (no AI)

**Total per full presentation: 8 credits** (vs ~$0.008 in M3 cost — healthy margin)

---

## 10. Phased Build Plan

### Phase 1 — MVP (1-2 days)
- [ ] New tool page `/tools/presentation-builder`
- [ ] Steps 1-3 (Quick Brief, Audience, ATR) with BusinessContextFields
- [ ] Save as `presentation_projects` table
- [ ] Dashboard integration (kind: 'presentation')

### Phase 2 — Core AI (2-3 days)
- [ ] Step 4 file upload + text extraction
- [ ] Step 5 triage AI (system prompt + UI)
- [ ] Step 6 outline generation (3 framework prompts)
- [ ] Step 7 slide blueprint
- [ ] Step 8 speaker notes
- [ ] End-to-end test with real example

### Phase 3 — Export (1 day)
- [ ] Step 9 HTML preview (already have export pipeline)
- [ ] Markdown outline export
- [ ] PPTX export (PptxGenJS in browser)
- [ ] Speaker notes .md

### Phase 4 — Polish (1 day)
- [ ] Link to Brand Voice / Pain / Persona projects
- [ ] Theme/color presets
- [ ] Re-edit any step (re-runs only that step)
- [ ] "Save as template" — for users who want to reuse structures

---

## 11. Open Questions (need user input)

1. **Should we build all 9 steps, or MVP first (Steps 1-3 + 6 + 9) then iterate?**
   - My recommendation: MVP first. Steps 1-3 set up the data; Step 6 is the magic; Step 9 ships value. Steps 4-5-7-8 are polish that can be added.

2. **Should the tool be 1 multi-step wizard (my plan) or 3 separate tools (Audience Analyzer, Outline Builder, Slide Visualizer)?**
   - My recommendation: 1 multi-step tool. The data flows through each step — splitting would require glue code.

3. **PPTX export — client-side (PptxGenJS in browser) or server-side?**
   - My recommendation: client-side first, server-side only if needed. Browser can do it via JSZip.

4. **Color theme / template system — minimal (3-5 themes) or rich (15+)?**
   - My recommendation: 5 to start. Can expand later.

5. **Should we expose the underlying system prompts to advanced users?**
   - My recommendation: not in MVP. The form IS the prompt. Power users can edit Step 6 output and re-run.

6. **How to handle the "data viz" use case — does the tool need a "paste a table" feature that picks chart type?**
   - My recommendation: include in Step 7. If user pastes CSV/table in Step 4, AI auto-detects and proposes chart.

---

## 12. What I deliberately EXCLUDED

- **AI Video (Day 4)** — separate workflow, different use case. Future tool.
- **Live speaking/delivery training (Day 1 mindset)** — we can never replace this with software.
- **Image generation integration (Day 4 image prompts)** — we can use the structured prompt internally to generate hero images via our own image tool, but this is a separate workflow.
- **Realtime collaboration** — out of scope for v1.

---

## 13. Why this works as a BusinessAiOs tool

- **Reuses everything we've built** — presets, exports, BYOK, credits, step assets
- **Natural extension** — the 3 existing tools (Brand Voice, Pain Points, Persona) feed INTO this tool via project_links
- **Fits Thai market** — the course is taught in Thai by a Thai university professor; Thai SMBs/SMEs need exactly this
- **Scarce alternative** — Gamma, Beautiful.ai, Tome are all "deck generators" with no audience-first design
- **Proven frameworks** — every framework is cited (McKinsey, Dan Roam, Phil Waknell, Mark Murphy) — instant credibility
- **AI handles the boring parts** — user spends time on thinking (ATR, Triage), AI spends time on writing (outline, notes, slide content)

---

## Next step

User reviews this plan. If approved, I'll start building Phase 1 (MVP) immediately.

If changes needed, please tell me:
- Add/remove steps
- Different framework
- Different pricing
- Different scope
