# แผนปรับปรุง Prompt เครื่องมือ AI (Prompt Improvement Plan)

> **ที่มา:** audit prompt ทั้ง 10 เครื่องมือใน `apps/api/src/lib/prompts.ts` + presentation ใน `apps/api/src/lib/presentationPrompts.ts` เทียบกับ Anthropic skill ที่ตรงกันโดยตรง (customer-persona, value-proposition-canvas, competitor-analysis, objection-handler, hook-generator, brand-voice-guide, pitch-deck)
>
> **วิธีทำ:** แก้ prompt ของแต่ละเครื่องมือ **ไปพร้อมกับเฟส dark mode ของหน้านั้น** (ดู map เฟสด้านล่าง) — 1 เฟส = แก้ทั้ง UI + prompt ของเครื่องมือชุดเดียวกัน จบแล้ว test + code-reviewer + ship พร้อมกัน
>
> **หลักการสำคัญ (อย่าลืม):**
> 1. **ทุก prompt แก้แบบ additive เท่านั้น** — เพิ่ม field ใหม่ใน JSON schema + เพิ่ม instruction ห้ามรื้อโครงเดิม (โครงเดิมดีอยู่แล้ว ใช้ SPICE framework + อ้างอิง framework ธุรกิจถูกต้อง ไม่ใช่งานมือใหม่)
> 2. **field ใหม่ทุกตัวต้องมี frontend rendering รองรับ** — `OutputRenderer` ของ project wizard และ tool result page แต่ละตัว ต้องเพิ่ม UI แสดง field ใหม่ ไม่งั้น AI generate มาก็ไม่มีใครเห็น (นี่คือเหตุผลที่ผูกกับเฟส UI — แก้พร้อมกันจะได้ไม่หลุด)
> 3. **ห้ามเพิ่ม token เยอะเกินจำเป็น** — field ใหม่มีต้นทุน (completion tokens ×2 ในสูตรคิดเครดิต) เพิ่มเฉพาะที่ได้ประโยชน์จริงกับ SME ไทย เรียงตาม impact ที่ audit จัดไว้ ไม่เพิ่มทุกข้อ
> 4. **test แบบ generate จริง** — หลังแก้ prompt ต้อง generate ของจริง (เสียเครดิต local) ดูว่า AI ตอบ field ใหม่ถูก format + frontend render ถูก ก่อน ship
> 5. **อัปเดตประมาณการเครดิต** — ถ้า field ใหม่ทำให้ completion tokens โตขึ้นมาก ต้องเช็ค `maxTokensByStep`/`CREDIT_ESTIMATE` ว่ายังพอ + ตัวเลขที่โชว์ user ยังตรง

---

## Map: เฟส UX ↔ prompt ที่แก้พร้อมกัน

| เฟส UX (dark mode) | เครื่องมือในเฟส | prompt export ใน prompts.ts | สถานะ audit |
|---|---|---|---|
| **M** | pain-generator, brand-voice, hook-library | `painGeneratorPrompt`, `brandVoicePrompt`, `hookLibraryPrompt` | brand-voice ✅, hook ✅, pain ⚠️ (ไม่มี skill ตรง — ดู §M.1) |
| **N** | persona-builder, objection-handler, presentation-builder | `personaBuilderPrompt`, `objectionHandlerPrompt`, presentationPrompts.ts | ครบ ✅✅✅ |
| **O** | competitor-analysis, value-proposition-canvas | `competitorAnalysisPrompt`, `valuePropositionCanvasPrompt` | ครบ ✅✅ |
| **P** | jtbd-generator, million-dollar-offer | `jtbdGeneratorPrompt`, `millionDollarOfferPrompt` | ยังไม่ audit (ไม่มี skill ตรง 1:1 — ดู §P.1) |
| **Q** | business-model-canvas | `bmcGeneratorPrompt` | ยังไม่ audit (ไม่มี skill ตรง 1:1 — ดู §Q.1) |

> **หมายเหตุ:** เฟส R เป็นต้นไป (saved, developers, admin, billing, demo, landing) เป็นหน้าที่ไม่มี AI generation ของตัวเอง — ไม่มี prompt ให้แก้ ทำแค่ dark mode ตามแผน §5.1 ปกติ

---

## เฟส M — pain-generator, brand-voice, hook-library — ✅ ทำแล้ว, deploy แล้ว (item [สูง] ของทั้ง 3 เครื่องมือ — [กลาง]/[ต่ำ] ที่เหลือยังไม่ทำ ดูรายละเอียดด้านล่าง)

### M.1 Pain Generator (`painGeneratorPrompt`) — audit เสร็จแล้ว, verdict: solid ranked-list แต่ไม่มี actionable "เริ่มตรงไหนก่อน" + ไม่มี honesty caveat (persona-builder มีแต่ตัวนี้ไม่มี)
เทียบกับ SPICE ที่ prompt เองอ้าง + pattern ความสม่ำเสมอกับเครื่องมืออื่นในกลุ่มเดียวกัน (persona-builder มี `disclaimer`/`validation_methods` อยู่แล้ว — pain-generator ควรมีเหมือนกันเพราะ input ก็เป็น industry-pattern-based ไม่ใช่ real customer data เหมือนกัน):
1. ✅ **[สูง] เพิ่ม `priority_pick`** — ทำแล้ว, deploy แล้ว. ทดสอบ generate จริงยืนยัน: reference pain point #1 พร้อมเหตุผลจริง ("Pain Point เรื่อง 'เวลารอคิว' แก้ได้เร็วที่สุดด้วยระบบสั่งล่วงหน้าผ่าน LINE OA...")
2. ✅ **[สูง] เพิ่ม `validation_note`** — ทำแล้ว, deploy แล้ว. ทดสอบ generate จริงยืนยัน: caveat + วิธี validate ที่เจาะจงจริง ("แนะนำให้สัมภาษณ์ลูกค้า 5-10 คนที่ร้าน หรือทำแบบสอบถาม Google Form...")

### M.2 Brand Voice (`brandVoicePrompt`) — verdict: solid, มีช่องว่างจริง
เรียงตาม impact กับ SME ไทย:
1. ✅ **[สูง] เพิ่ม "หมายถึง / ไม่ได้หมายถึง" ต่อ voice attribute แต่ละตัว** — ทำแล้ว, deploy แล้ว. field `voice_attributes: [{ attribute, means, does_not_mean }]`. ทดสอบ generate จริงยืนยัน: 4 attribute จริงเฉพาะแบรนด์ ไม่ generic
2. **[กลาง] เพิ่มกฎ mechanics การเขียน** — ยังไม่ทำ (ไม่ได้อยู่ใน scope [สูง] รอบนี้)
3. ✅ **[กลาง] เพิ่ม writer's checklist ท้ายผลลัพธ์** — ทำแล้ว, deploy แล้ว. field `self_check_list: string[]`. ทดสอบ generate จริงยืนยัน: 10 ข้อจริงเฉพาะแบรนด์ เช่น "มีคำต้องห้ามอย่าง 'ดีที่สุด' 'ครบวงจร' 'มืออาชีพ' ปนอยู่ไหม"
4. **[ต่ำ] anti-brand contrast** — ยังไม่ทำ
5. **[ต่ำ] TikTok field** — ยังไม่ทำ

### M.3 Hook Library (`hookLibraryPrompt`) — verdict: solid, claim "10 formula + 6 platform + A/B" ตรงกับโค้ดจริง
1. ✅ **[สูง] เพิ่มการจัดอันดับ + เหตุผล** — ทำแล้ว, deploy แล้ว. field `recommended_pick: { index, why, best_platform }`. ทดสอบ generate จริงยืนยัน (4 ครั้ง): highlight headline ที่ถูกต้อง 1 ตัวเสมอ (ไม่เคย 0 หรือมากกว่า 1), `index` บางครั้ง AI ตอบเป็น string ("1"/"0") — `Number(...)` coerce ถูกต้องยืนยันแล้ว
2. **[กลาง] เพิ่ม 2 formula ที่ conversion สูง** — ยังไม่ทำ (ไม่ได้อยู่ใน scope [สูง] รอบนี้)
3. ✅ **[กลาง] guardrail กันตัวเลขมั่ว** — ทำแล้ว, deploy แล้ว. **code-reviewer เจอบั๊กจริงระหว่างทดสอบ**: guardrail เดิมคุมแค่ %/ยอดขาย แต่ AI ยังแต่งรายละเอียดปฏิบัติการที่ไม่มีหลักฐาน (ระยะทาง 800 กม., เวลาเปิด-ปิดเจาะจง, ระยะเวลาคั่ว, จำนวนถ้วยในเรื่องเล่าลูกค้า) เพื่อเติม stat category ที่บังคับต้องมี — ขยาย guardrail ให้ครอบคลุมรายละเอียดปฏิบัติการด้วย + ให้แนวทางตอนไม่มีตัวเลขจริง (ใช้มุมกระบวนการ/ที่มาแทน) re-test ยืนยันว่า AI รายงานความสอดคล้องเองใน `reasoning` field

---

## เฟส N — persona-builder, objection-handler, presentation-builder

### N.1 Persona Builder (`personaBuilderPrompt`) — verdict: solid foundation แต่ output นามธรรมกว่าที่ควร (ช่องว่างเยอะสุดในกลุ่ม) — ✅ ทำแล้ว, deploy แล้ว
1. ✅ **[สูงสุด] เพิ่ม narrative + voice-of-customer quotes** — ทำแล้ว. field `day_in_life`+`sample_quotes`. ทดสอบ generate จริงยืนยัน: narrative เฉพาะ persona จริง ไม่ generic
2. ✅ **[สูง] เพิ่ม Buying Behavior block** — ทำแล้ว. field `buying_behavior: {research_style, decision_speed, objections}`. ทดสอบยืนยัน: research_style/decision_speed/objections เฉพาะเจาะจงจริง (เช่น "เช็ค Google Maps เรตติ้ง", "impulse")
3. **[กลาง] เพิ่ม messaging polarity** — ยังไม่ทำ (ไม่ได้อยู่ใน scope [สูง]/[สูงสุด] รอบนี้)
4. **[กลาง] เพิ่ม Anti-Persona** — ยังไม่ทำ
5. ✅ **[ต่ำ] จำกัดจำนวน persona** — ทำแล้ว (instruction cap 1-3). ทดสอบ generate จริง 2 ครั้งยืนยัน: ได้ 2 persona ทั้งคู่ ไม่เกิน 3

### N.2 Objection Handler (`objectionHandlerPrompt`) — verdict: solid, LAER map ถูก 1:1 — ✅ ทำแล้ว, deploy แล้ว
1. ✅ **[สูง] เพิ่มขั้น "Explore" (คำถามสำรวจก่อนตอบ)** — ทำแล้ว. field `explore_question`. ทดสอบยืนยัน: คำถามจริงเจาะจงต่อ objection (เช่น "ที่ว่าแพง คือเทียบกับร้านทั่วไป หรือไม่แน่ใจว่าคุ้มกับเงินที่จ่ายคะ?")
2. ✅ **[สูง] เพิ่ม response ชั้นที่ 2** — ทำแล้ว. field `second_response` (มี "ถอยอย่างมีศักดิ์ศรี" ฝังในคำอธิบาย field แทนที่จะแยก field ต่างหาก — ประหยัด token). ทดสอบยืนยัน: de-escalation จริง พร้อม de-risk offer
3. ✅ **[กลาง] guidance เรื่อง "hard no"** — ทำแล้ว (ฝังใน second_response's field description แทนแยก field ใหม่ — additive แบบประหยัด token)
4. ✅ **[กลาง] กรณี objection ชี้จุดอ่อนสินค้าจริง** — ทำแล้ว (instruction เพิ่มท้าย prompt, ไม่เพิ่ม schema)

**อัปเดตเพิ่ม (พบระหว่างทดสอบจริง)**: code-reviewer เจอว่า objection-handler's token reserve (`toolMaxTokens` ใน `toolRoutes.ts`) เดิม 16000 ถูกใช้ไป 88% (14104 tokens) จาก field ใหม่ — bump เป็น 20000 แล้ว กัน JSON ถูกตัดกลางตอน AI ตอบ 8 objections เต็มๆ

### N.3 Presentation Builder (`presentationPrompts.ts`) — verdict: ดีที่สุดในกลุ่ม จริง ๆ ลึกกว่า skill เยอะ (claim McKinsey/Roam/Waknell ตรงกับโค้ดจริง)
เพิ่มแค่ guardrail เล็ก ๆ:
1. **[กลาง] เพดานจำนวนคำต่อสไลด์** — skill กฎ "ไม่เกิน 30 คำ/สไลด์ ไม่งั้นแยก 2 สไลด์" ตอนนี้ `key_points`/`bullet_points` ไม่จำกัดความยาว เสี่ยงสไลด์ไทยแน่นตัวอักษร
2. **[กลาง] เพดานจำนวนสไลด์** — `target_slides` อิสระเกินไป เพิ่ม guardrail "เกิน 10-12 คนหลุด"
3. **[กลาง] บังคับ CTA/Ask slide ใน schema** — ตอนนี้แบบ SCQA/Minto มีแค่ใน prose ไม่ใช่ section บังคับ อาจหลุดหาย (แบบ Pop-Up Pitch/5M มีแล้ว)
4. **[ต่ำ] instruction "benefits not features"** บนสไลด์เนื้อหา

---

## เฟส O — competitor-analysis, value-proposition-canvas

### O.1 Competitor Analysis (`competitorAnalysisPrompt`) — verdict: solid, มี white_space ที่ skill ไม่มีด้วยซ้ำ
1. **[สูงสุด] เพิ่ม "recommended response" ต่อคู่แข่งแต่ละราย** — ตอนนี้มีแค่ `recommended_strategy` รวม ไม่มี "จะทำอะไรกับคู่แข่งรายนี้โดยเฉพาะ" → เพิ่ม `response` ใน object คู่แข่งแต่ละตัว
2. **[กลาง] เพิ่ม positioning archetype taxonomy** — Price Leader / Quality Leader / Niche Specialist / Full-Service / Disruptor ต่อคู่แข่ง (ตอนนี้ `positioning` เป็น free text เทียบข้ามรายไม่ได้)
3. **[กลาง] บังคับ threat-level variance** — เพิ่ม instruction กัน AI ให้ "สูง" ทุกราย (skill เตือนตรง ๆ)
4. **[กลาง] เพิ่ม "difficulty to exploit" บน gap** — LOW/MEDIUM/HIGH effort ช่วย SME จัดลำดับ
5. **[ต่ำ] quarterly review nudge** ใน output

### O.2 Value Proposition Canvas (`valuePropositionCanvasPrompt`) — verdict: solid ที่สุด จริง ๆ ลึกกว่า skill (orphans, fit types, taxonomy ครบ)
1. **[สูงสุด] เพิ่ม application guide** — ตอนนี้ `next_steps` ชี้ไป BMC/สัมภาษณ์/A-B test แต่ไม่มี "เอา VP ไปเขียน headline/โฆษณา/support script ยังไง" ซึ่งเป็น use case หลักของ tool การตลาด → เพิ่ม `application_guide: { ad_headlines, landing_copy, ... }`
2. **[สูง] เพิ่ม messaging hierarchy** — ข้อความหลัก 1 + รอง 2-3 + proof points (skill Phase 4.2) เอาไปเขียน copy ต่อได้ทันที → field `messaging_hierarchy`
3. **[กลาง] เตือน multi-segment** — รับ `target_audience` เดียว ทำ canvas เดียว ควรเพิ่ม instruction ให้ flag ถ้า input มีหลาย segment ปน (เช่น "ลูกค้าองค์กร + รายบุคคล")

---

## เฟส P — jtbd-generator, million-dollar-offer

### P.1 JTBD Generator (`jtbdGeneratorPrompt`) — **ยังไม่ audit**
ก่อนเริ่มเฟส P: audit เทียบกับ methodology JTBD (Christensen/Ulwick/Moesta ที่ prompt เองอ้าง) — เช็คว่า output ครบ: job statement format ถูก ("when [situation], I want [motivation], so I can [outcome]"), functional/emotional/social jobs แยกครบ, desired outcomes วัดผลได้ (direction + metric + object), job map (8 ขั้น), competing solutions/hiring-firing criteria แล้วเติม improvement ตรงนี้

### P.2 Million Dollar Offer (`millionDollarOfferPrompt`) — **ยังไม่ audit**
ก่อนเริ่มเฟส P: audit เทียบกับ Hormozi Value Equation (prompt เองอ้าง: dream outcome / perceived likelihood / time delay / effort & sacrifice) + skill ใกล้เคียงที่อาจใช้เทียบหลวม ๆ เช่น `pricing-page-copy`, `revenue-model` — เช็คว่า output ครบ: 7 components, ราคาอัตราส่วน 5:1-10:1, guarantee stack, scarcity/urgency, naming (MAGIC formula ถ้ามี), bonus stack แล้วเติม improvement ตรงนี้

---

## เฟส Q — business-model-canvas

### Q.1 Business Model Canvas (`bmcGeneratorPrompt`) — **ยังไม่ audit**
ก่อนเริ่มเฟส Q: audit เทียบกับ Osterwalder BMC 9 blocks (prompt เองอ้าง) + skill `swot-analysis`/`revenue-model` เทียบหลวม ๆ — เช็คว่า output ครบ: 9 building blocks, ความเชื่อมโยงระหว่าง block (ไม่ใช่แค่ list แยก), key assumptions ที่ต้อง validate, SWOT, revenue/cost structure ที่เป็นตัวเลขจริงไม่ใช่ลอย ๆ แล้วเติม improvement ตรงนี้

---

## checklist ต่อเฟส (ทำทุกครั้งที่แก้ prompt คู่กับ UI)

1. [ ] (ถ้ายังไม่ audit) audit prompt เทียบ skill/methodology ก่อน เติมรายการ improvement ในเอกสารนี้
2. [ ] แก้ prompt แบบ additive — เพิ่ม field ใน JSON schema + instruction เฉพาะข้อ impact สูง (ไม่เอาทุกข้อ)
3. [ ] แก้ `OutputRenderer` / tool result page ให้ render field ใหม่ (พร้อมกับ dark mode ของหน้านั้น)
4. [ ] generate จริง (local, เสียเครดิต) — เช็ค AI ตอบ field ใหม่ถูก format + frontend แสดงถูกทั้ง light/dark
5. [ ] เช็คประมาณการเครดิต — completion tokens โตไหม, `maxTokensByStep`/`CREDIT_ESTIMATE` ยังพอไหม, ตัวเลขที่โชว์ user ยังตรงไหม
6. [ ] code-reviewer subagent (ทั้ง UI + prompt diff)
7. [ ] update เอกสารนี้ (mark ข้อที่ทำ) + `docs/UX_REDESIGN_PLAN.md` §5 + memory file
8. [ ] commit + push + deploy **ทั้ง web worker (UI) และ API worker (prompt)** — prompt อยู่ใน `apps/api` ต้อง deploy API ด้วย ไม่ใช่แค่ web
