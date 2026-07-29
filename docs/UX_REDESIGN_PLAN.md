# BusinessAiOs — UX Audit & Redesign Plan

> จัดทำโดย: UX/UI specialist (take-over review) · 2026-07-29
> ผู้รับงานต่อ: UI designer specialist → implementation phase
> สถานะ: **plan + wireframe เท่านั้น — ยังไม่แตะโค้ด UI จริง** (implement ในเฟสถัดไป)

---

## 0. วิธีรีวิว & เกณฑ์ (The Test)

รีวิวทั้งระบบที่ live จริง (`businessaios-web.pskspace.workers.dev`) ผ่านสายตา **persona ที่โหดที่สุด**:

> **"เด็ก ป.6 ที่อยากเปิดธุรกิจ ใช้เองโดยไม่มีใครสอน"**

เกณฑ์ผ่าน = เด็กคนนี้ต้อง (1) เข้าใจว่านี่คืออะไรใน 5 วินาที, (2) รู้ว่าต้องกดปุ่มไหนก่อน โดยไม่ต้องเดา, (3) ทำจนได้ผลลัพธ์ชิ้นแรกโดยไม่หลง, (4) ไม่เจอศัพท์ที่ไม่เข้าใจจนต้องหยุด

surface ที่รีวิว: Landing → Register → Dashboard → Wizard 7 ขั้น → Billing → Tools → Profile → Admin → Mobile

**บทสรุป 1 บรรทัด:** ระบบ *ทำงานได้* และมีของเยอะมาก แต่ **พูดภาษาของนักการตลาด MBA ไม่ใช่ภาษาของ SME มือใหม่** — เด็ก ป.6 จะตกที่ "ต้องเลือกอะไรก่อน" ตั้งแต่หน้า dashboard และเจอศัพท์อังกฤษ/jargon จนหยุดกลางทาง ปัญหาใหญ่สุดไม่ใช่ความสวย แต่คือ **information architecture + ภาษา + การไม่มี onboarding**

---

## 1. ประเด็นที่เจอ (จัดตาม severity)

### 🔴 P0 — บล็อกไม่ให้ผู้ใช้มือใหม่ไปต่อได้

**P0-1 · ไม่มี onboarding เลย + 4 จุดเริ่มต้นแข่งกันบน Dashboard**
หลัง register เด็กเด้งเข้า dashboard ทันที เจอ 4 CTA พร้อมกัน: `+ โปรเจกต์ใหม่`, `⚡ เครื่องมือ AI`, banner สีน้ำเงิน `เครื่องมือ AI แยกต่างหาก`, และการ์ด `Strategic Tools` — **ไม่มีอะไรบอกว่า "เริ่มตรงนี้"** เด็กไม่รู้ความต่างระหว่าง "โปรเจกต์" กับ "เครื่องมือ" → หยุดคิดตั้งแต่ก้าวแรก
*ผลกระทบ:* drop-off สูงสุดอยู่ตรงนี้ · *แก้:* first-run onboarding + เลือก "เริ่มต้นทางเดียว" ที่ชัด (ดู §2.2)

**P0-2 · Landing page โฆษณาสิ่งที่ระบบไม่มีจริง (ทำลายความเชื่อใจ)**
- โฆษณา "AI 4 ตัว: **GPT-4o, Claude, Gemini, Llama** เลือกตามงบ" → ระบบจริงใช้ **MiniMax M3 ตัวเดียว**
- โฆษณา "**BYOK** ใช้ API key ตัวเอง จ่ายตรง provider ไม่มี markup" → ไม่ใช่ default (มีเป็น feature ซ่อน)
- ราคา Landing = **Free 0 / Pro 499 / Team 1,999 บาท ต่อเดือน (subscription)**
  ราคา Billing จริง = **Starter ฿99 / Popular ฿249 / Pro ฿399 (credit แบบซื้อครั้งเดียว, PromptPay)**
  → **คนละโมเดลราคากันคนละเรื่อง** คนที่สมัครเพราะ "Pro 499 ได้ GPT-4o" จะงงเมื่อเข้า billing เจอราคาคนละชุด ไม่มีให้เลือกโมเดล
*ผลกระทบ:* trust พังทันทีที่ user จ่ายเงิน · *แก้:* เขียน landing ใหม่ให้ตรงระบบจริง (§2.1)

**P0-3 · Admin console จัดการ 1,000 users ไม่ได้จริง**
- `adminListUsers` ดึงแค่ `LIMIT 200` + **ไม่มี search / filter / pagination** → พอมี user เกิน 200 คน แอดมิน *มองไม่เห็น* ที่เหลือ และหา user รายคนไม่ได้เลย
- **ไม่มีเครื่องมือ "ช่วย user"** ตามที่ตั้งเป้า: เปิดดู project/generation ของ user ไม่ได้, resend verification email ไม่ได้, reset password ให้ไม่ได้, ดู activity log รายคนไม่ได้, ไม่มี "view as user"
- เปลี่ยน role เป็น admin ได้ทันทีจาก dropdown **ไม่มี confirm** (อันตราย)
*ผลกระทบ:* บล็อกเป้า 1,000 active users ปี 2027 โดยตรง · *แก้:* redesign admin เป็น operations console (§2.6)

### 🟠 P1 — ทำให้สับสน/หลง แต่ยังพอไปต่อได้

**P1-1 · ภาษาปนกันมั่ว + ศัพท์ที่มือใหม่ไม่รู้จัก**
- Wizard: ชื่อ step เป็น **อังกฤษล้วน** ("Business DNA", "Customer Persona", "Customer Journey", "Positioning", "KPI Dashboard") แต่ field ข้างในเป็นไทย → เด็กอ่าน tab ไม่ออก
- ศัพท์ที่ไม่แปล/ไม่มีคำอธิบาย: **"Pain Point", "Business DNA", "Persona", "Brand Voice", "JTBD", "VPC", "BYOK", "Strategic Tools", "tool chain"** — เด็ก ป.6 (และ SME ส่วนใหญ่) ไม่รู้จัก
- Dashboard subtitle เขียน "สร้าง **Marketing System** ด้วย AI" — คำว่า Marketing System ยังนามธรรมเกินไป
*แก้:* บังคับ locale ไทยเป็น default + แปล/อธิบายศัพท์ทุกจุด + ใส่ tooltip "นี่คืออะไร" (§2.3)

**P1-2 · Tools page พูดภาษา MBA**
คำอธิบายเครื่องมือเต็มไปด้วย framework ศัพท์สูง: *"framework จาก McKinsey, Dan Roam, Phil Waknell"*, *"Value Equation + 7 Components + MAGIC naming"*, *"SCQA / 5M / Pop-Up"*, *"LAER + Reframing"* — เด็กไม่มีทางรู้ว่าเครื่องมือแต่ละตัว *ช่วยอะไรฉันได้* · *แก้:* เขียนใหม่เป็น "ช่วยคุณ___" ภาษาคน (§2.4)

**P1-3 · Mobile header พัง**
บนจอมือถือ (375px) header ล้น — "ออกจากระบบ" กับ email หลุดขอบจอ (logout กดไม่ได้), "เติมเงิน" ตัดขึ้นบรรทัดใหม่, **ไม่มี hamburger menu** · *แก้:* mobile nav ใหม่ (bottom tab bar หรือ hamburger) (§2.5)

**P1-4 · "+ โปรเจกต์ใหม่" เปิดฟอร์ม inline ที่ท้ายหน้า (ต่ำกว่าจอ)**
กดปุ่มมุมขวาบน แต่ฟอร์มไปโผล่ล่างสุดใต้ fold — เด็กกดแล้ว "เอ๊ะ ไม่มีอะไรเกิดขึ้น" เพราะไม่เห็นว่าฟอร์มโผล่ที่ไหน · *แก้:* modal หรือหน้า dedicated + auto-scroll/focus

### 🟡 P2 — ความสม่ำเสมอ/ความน่าเชื่อถือของงานดีไซน์

- **P2-1 · ไอคอนไม่เป็นระบบ:** landing ใช้ `⚡` ซ้ำทุก feature (6 อันเหมือนกันหมด), tools ใช้ emoji สุ่ม (ไมค์ 🎤, เพชร 💎, โล่ 🛡️, เบ็ดตกปลา 🎣, กราฟ 📊) — ดูไม่โปร ควรใช้ icon set เดียวกันทั้งระบบ
- **P2-2 · badge "NEW" ติดทุกการ์ด** → ถ้าทุกอย่าง NEW ก็ไม่มีอะไร NEW (คำเตือนหมดความหมาย)
- **P2-3 · ตัวเลข credit ขัดกันเอง:** สมัครใหม่ระบบให้ "100 credits" (แสดงบน UI) แต่หน้า billing เขียน "Free tier = 200 credits" — เป็นบั๊กจริงที่ user เห็น (backend log signup bonus 200 แต่ user row ตั้ง 100)
- **P2-4 · sticky header ทับ content** เวลา scroll (เห็น header ลอยมากลางหน้า) — visual bug
- **P2-5 · design token จำกัด:** มีสีหลักสีเดียว (electric blue) + neutral scale กระโดด (dark 200 → 900 ไม่มีตรงกลาง), ไม่มี semantic color (success/warning/danger) เป็นระบบ, ไม่มี dark mode — ทำให้ redesign ขาด vocabulary
- **P2-6 · error ใช้ `alert()`** ทั้งระบบ (admin, tools) — ดูเก่า, ไม่ inline
- **P2-7 · a11y:** ปุ่มเลือก "kind" ตอนสร้างโปรเจกต์ไม่มี label (accessibility tree อ่านไม่ออก), การ์ด/ปุ่มหลายจุดพึ่ง emoji แทนข้อความ

### ✅ ของที่ทำได้ดีอยู่แล้ว (เก็บไว้)
- **Billing page** — การ์ดราคาสะอาด, ต่อ credit ชัด, badge ประหยัด %, ขั้นตอน PromptPay 1-2-3 (หน้าที่ดีที่สุดในระบบ)
- Register form สั้น กระชับ ขอแค่ที่จำเป็น
- Profile page ครบ (avatar, credit history, เปลี่ยนรหัส, 2FA)
- Wizard มี progress ชัด ("STEP 1 OF 7") + placeholder ยกตัวอย่างจริง ("เช่น ก๋วยเตี๋ยวบ้านหมู")
- Palette electric-blue + Noto Sans Thai อ่านง่าย เป็นฐานที่ต่อยอดได้

---

## 2. แผน Redesign (ส่งต่อ UI Designer)

### หลักการออกแบบ 5 ข้อ (Design Principles)
1. **ภาษาคน ไม่ใช่ภาษาเอเจนซี** — ทุกคำที่ user เห็นต้องเป็นสิ่งที่แม่ค้าตลาดนัดเข้าใจ ศัพท์เทคนิคซ่อนไว้ใต้ "(ดูเพิ่ม)"
2. **ทางเดียวที่ชัด (One obvious next step)** — ทุกหน้ามี CTA หลัก *หนึ่งเดียว* ที่เด่นสุด ที่เหลือเป็นรอง
3. **สอนระหว่างทาง (Teach in context)** — อธิบายศัพท์ตรงจุดที่เจอ ด้วยตัวอย่าง ไม่ใช่หน้าช่วยเหลือแยก
4. **มือถือมาก่อน (Mobile-first)** — ผู้ใช้ไทย 1,000 คนส่วนใหญ่มาจากมือถือ
5. **จริงใจเรื่องราคา/AI** — บอกตรงๆ ว่าใช้ AI อะไร ราคาเท่าไร ไม่ over-promise

### 2.1 Landing Page
- เขียน hero ใหม่ให้ตรงระบบ: ไม่พูด "AI 4 ตัว/BYOK" ถ้าไม่ใช่ default — พูดสิ่งที่ทำได้จริง: *"ตอบไม่กี่คำถาม ได้แผนการตลาดครบชุด พร้อมใช้"*
- ราคาบน landing = ชุดเดียวกับ billing (Starter/Popular/Pro credit packages) + อธิบาย "credit คืออะไร" ("1 ครั้งที่ AI ช่วยคิด ≈ กี่ credit")
- แทน `⚡` ซ้ำๆ ด้วย icon set เดียวกัน (แนะนำ Lucide/Phosphor) 1 ไอคอน/1 feature
- เพิ่ม "ผลลัพธ์หน้าตาเป็นยังไง" — โชว์ตัวอย่าง Brand Card/Content Calendar จริง (visual proof) แทนการบรรยาย

### 2.2 Onboarding + Dashboard (แก้ P0-1)
- **First-run flow (3 จอ):** หลัง verify email → (1) "คุณอยากทำอะไรวันนี้?" เลือก 1 ใน 2 การ์ดใหญ่: **"สร้างแผนธุรกิจครบชุด (45 นาที)"** vs **"ลองเครื่องมือเดี่ยวเร็วๆ (5 นาที)"** → (2) ถ้าเลือกครบชุด พาเข้า wizard เลย; ถ้าเลือกเดี่ยว โชว์ 3 เครื่องมือยอดฮิต → (3) tooltip ชี้ที่ credit + ปุ่ม
- **Dashboard ใหม่:** ตัดจาก 4 CTA เหลือ **1 primary** ("+ สร้างแผนใหม่") + ส่วน "เครื่องมือเดี่ยว" เป็น section รอง ไม่ใช่ banner แข่ง · ยุบ "Strategic Tools" + "เครื่องมือ AI แยกต่างหาก" ที่ซ้ำซ้อนให้เหลืออันเดียว
- Empty state พูดชวน: *"ยังไม่มีแผน — มาสร้างแผนแรกกัน กดปุ่มสีน้ำเงินด้านบน"* + ลูกศรชี้

### 2.3 Wizard 7 ขั้น (แก้ P1-1)
- ชื่อ step เป็น **ไทย + เลข + ไอคอน**: 1️⃣ ตัวตนธุรกิจ · 2️⃣ ลูกค้าของเรา · 3️⃣ เส้นทางลูกค้า · 4️⃣ จุดขาย · 5️⃣ ปฏิทินคอนเทนต์ · 6️⃣ ขั้นตอนทำงาน · 7️⃣ วัดผล (KPI) — เก็บชื่ออังกฤษไว้เป็น subtitle เล็กๆ ได้
- แต่ละ field ที่มีศัพท์ ใส่ helper 1 บรรทัด + ตัวอย่าง: *"Pain Point = ปัญหาที่ลูกค้าเจอ เช่น 'หาของกินสายที่เปิดดึกไม่ได้'"*
- Step bar ที่ล้นจอ (7 ขั้นตัด "KPI D...") → บนมือถือทำเป็น dot/progress + ชื่อ step ปัจจุบันเท่านั้น
- ปุ่ม "✨ Generate" ต้องบอกล่วงหน้าว่า **ใช้กี่ credit** ("ใช้ ~3 credit") ก่อนกด

### 2.4 Tools (แก้ P1-2)
- ชื่อเครื่องมือ + คำอธิบายเป็น "ช่วยคุณ___" ภาษาคน:
  *Million Dollar Offer → "ออกแบบข้อเสนอที่ลูกค้าปฏิเสธยาก"* (ซ่อน "Value Equation/MAGIC" ใต้ "ดูหลักการ")
  *Objection Handler → "เตรียมคำตอบเวลาลูกค้าต่อรอง/ลังเล"*
  *Hook Library → "หาประโยคเปิดที่คนหยุดอ่าน"*
- ตัด badge "NEW" ออกจากทุกอัน (เก็บไว้ติดเฉพาะของใหม่จริง)
- icon set เดียว, จัดหมวด (คิดกลยุทธ์ / เขียนคอนเทนต์ / ขาย) แทนกองรวม

### 2.5 Mobile (แก้ P1-3)
- **Bottom tab bar** (มือถือ): หน้าแรก / เครื่องมือ / เครดิต / โปรไฟล์ — เข้าถึงด้วยนิ้วโป้ง
- ย้าย logout + email เข้าไปในหน้า Profile/เมนู ไม่ให้ล้น header
- ทุกปุ่มหลัก ≥ 44px, แตะง่าย

### 2.6 Admin → "Operations Console" (แก้ P0-3, รองรับ 1,000 users + ช่วย user)
โครงใหม่ 4 โซน:
1. **Overview** — การ์ดสถิติ + กราฟ signups รายวัน + funnel (สมัคร → verify → สร้างแผน → จ่ายเงิน) + ต้นทุน AI เทียบรายได้
2. **Users (ตัวหลัก)** — ตาราง + **search (email/ชื่อ) + filter (role, verified, มี/ไม่มี credit, active ล่าสุด) + pagination/infinite scroll** (ต้องแก้ API ให้รับ `?q=&page=&filter=` แทน LIMIT 200 ตายตัว) · แต่ละแถวกด → **User Detail**
3. **User Detail (ของใหม่ — หัวใจของ "ช่วย user")** — ดูโปรไฟล์, credit + ประวัติ transaction, project/generation ทั้งหมดของ user, ปุ่ม: เติม/หัก credit (มี confirm), **resend verification email**, **ส่งลิงก์ reset password**, **"ดูในมุมของ user" (impersonate อ่านอย่างเดียว)**, note ภายในทีม
4. **Support/Email** — outbox + สถานะส่ง (มีอยู่แล้ว ต่อยอด)
- เพิ่ม confirm dialog ทุก action ที่ย้อนไม่ได้ (เปลี่ยน role, หัก credit) · แทน `alert()` ด้วย toast/inline

### 2.7 MCP Server (ของใหม่ที่ต้องมี — ให้ Claude Code users ต่อเข้าระบบ)
เป้าหมาย: คนที่ใช้ Claude Code / Claude Desktop เรียกใช้ความสามารถของ BusinessAiOs ผ่าน MCP ได้ (เหมือนที่โปรเจกต์นี้ต่อ Carta/Supermetrics ฯลฯ)
- **Auth:** ออก **Personal Access Token / MCP key** ต่อ user (หน้า Profile → "เชื่อมต่อ Claude Code" → generate token + คู่มือ config) — reuse ระบบ BYOK/credit เดิม (เรียกผ่าน MCP ก็หัก credit เดียวกัน)
- **Tools ที่ expose (เฟสแรก):** `create_project`, `generate_step`, `run_tool` (10 เครื่องมือ), `list_projects`, `get_export`, `check_credits` — map ตรงกับ REST endpoints ที่มีอยู่แล้ว
- **UX ที่ต้องออกแบบ:** หน้า "Developers / MCP" (การ์ดคัดลอก config JSON สำหรับ `claude mcp add`, สถานะ token, usage/credit ที่ใช้ผ่าน MCP, ปุ่ม revoke) + ทำให้ค้นเจอจาก nav
- อ้างอิงแนวทาง studio.zenityx.com (reference ที่ user ให้) สำหรับ look & feel ของ developer surface
- *หมายเหตุ:* เป็น requirement ใหม่ ไม่มีในระบบปัจจุบันเลย — ต้องออกแบบทั้ง token model + UI + เขียน MCP server (เฟส implement)

### 2.8 Design System (ยกระดับ token — แก้ P2-5)
ให้ designer นิยาม:
- **สีหลัก** electric-blue (เก็บ) + **neutral scale เต็ม** (50→900 ไม่กระโดด) + **semantic** success/warning/danger/info เป็นระบบ
- **Dark mode** (ตั้งแต่ต้น ไม่ retrofit)
- **Type scale** ไทย/อังกฤษคู่ (Noto Sans Thai + Inter) — กำหนด line-height ที่พอดีกับสระบน/ล่างของไทย
- **Icon set เดียว** (Lucide หรือ Phosphor) แทน emoji ทั้งระบบ
- **Component library:** button (primary/secondary/ghost/danger), input+helper+error, card, modal, toast, table, tabs, badge, empty-state, credit-pill, step-indicator — ทำเป็น Svelte component reuse ได้ (ตอน implement)

---

## 3. ลำดับงานเฟส Implement (proposal — รอ user เคาะ)

| เฟส | สิ่งที่ทำ | เหตุผลจัดลำดับ |
|---|---|---|
| **A. Design System + Onboarding + Dashboard** | token, component library, first-run flow, dashboard 1-CTA | ฐานของทุกหน้า + แก้ drop-off จุดใหญ่สุด (P0-1) |
| **B. ภาษา + Landing + Wizard + Tools** | locale ไทย default, แปลศัพท์, เขียน copy ใหม่, mobile nav | แก้ P0-2/P1-1/P1-2/P1-3 — เนื้อหาที่ user เห็นบ่อยสุด |
| **C. Admin Operations Console** | search/filter/pagination + User Detail + ช่วย-user tools (+ แก้ API) | ปลดล็อกเป้า 1,000 users (P0-3) |
| **D. MCP Server + Developer surface** | token model, MCP server, หน้า Developers | requirement ใหม่ ต่อยอดหลังฐานนิ่ง |

---

## 4. Wireframe / Mockup

ดูไฟล์ mockup แบบ interactive (ส่งแยกเป็น artifact) — ครอบคลุมจอสำคัญ: Dashboard ใหม่ (1-CTA), First-run onboarding, Wizard step (ไทย), Tools (ภาษาคน), Admin Operations Console + User Detail, และหน้า Developers/MCP

---

## 5. Implementation status (อัปเดตทุกครั้งที่เฟสเสร็จ)

User สั่งลุยเป็นเฟส ๆ แบบ auto ไม่ตามลำดับที่เสนอไว้ใน §3 เป๊ะ (ข้าม B ไปทำ C/D ก่อน) — ตารางนี้คือของจริงที่ทำไปแล้ว ไม่ใช่แผนที่เสนอ

| เฟส | สถานะ | รายละเอียด |
|---|---|---|
| **A. Design System + Onboarding + Dashboard** | 🟡 บางส่วน | Dashboard consolidation เสร็จ (1 primary CTA, true-first-time empty state ชี้ไปเครื่องมือเดี่ยว 3 ตัว, gradient banner/StrategicToolsWidget โชว์เฉพาะ returning user) — commit `32a06c3`. **ยังไม่ทำ**: design token ชุดเต็ม (neutral scale, semantic colors, dark mode) ใน `tailwind.config.js`/`app.css` |
| **B. ภาษา + Landing + Wizard + Tools** | 🔴 ยังไม่เริ่ม | wizard step names/jargon helper text ไทย, mobile bottom-nav — ยังไม่ได้แตะ (คำแปล AI→ระบบอัจฉริยะ + brand rename ทำไปแล้วในรอบ rebrand ก่อนหน้า แยกจาก Phase B นี้) |
| **C. Admin Operations Console** | ✅ เสร็จ | Backend: search/role/verified filter + real pagination บน `GET /api/admin/users` (`apps/api/src/adminRoutes.ts`), `GET /api/admin/users/:id` (profile+credit history+projects+activity+admin_actions), resend-verification/send-password-reset/notes actions, funnel+signups-by-day บน `/api/admin/stats`. Frontend: `apps/web/src/routes/admin/+page.svelte` สร้างใหม่ทั้งหน้า (Overview/Users/Emails tabs + User Detail modal). Code-reviewer เจอ 2 bug จริง (credit-deduction failure ที่รายงาน false success, missing-existence-check ทำ 500 แทน 404) — แก้และ verify แล้วทั้งคู่ |
| **D. MCP Server + Developer surface** | ✅ เสร็จ | `apps/api/src/mcpRoutes.ts` ใหม่ — JSON-RPC `/mcp` endpoint (initialize/tools-list/tools-call), token model ใหม่ (`mcp_tokens` table, migration `008-mcp-tokens.sql`, hash เก็บไม่เก็บ raw token), 6 tools (`list_projects`/`create_project`/`generate_step`/`run_tool`/`get_export`/`check_credits`) dispatch ผ่าน REST handler เดิมด้วย internal short-lived session แทนการเขียน credit/AI logic ซ้ำ. หน้า `/developers` ใหม่ (สร้าง/revoke token, copy `claude mcp add` command + JSON config). Verified live ทั้ง 6 tools ผ่าน wrangler dev จริง รวมถึง run_tool ที่เรียก MiniMax จริงและหักเครดิตจริง |

**ยังไม่ทำในทุกเฟส**: component library (button/input/modal/toast แบบ reusable), icon set เดียวแทน emoji ทั้งระบบ, Turnstile เปิดใช้งานจริง (ปิดไว้ตั้งใจ — ดู STATUS.md)

> เอกสารนี้เป็น **แผน/บรีฟ** สำหรับ designer + เฟส implement — ยังไม่มีการแก้โค้ด UI จริงในรอบนี้
