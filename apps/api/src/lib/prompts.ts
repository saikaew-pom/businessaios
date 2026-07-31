/**
 * 7 Prompt templates for the wizard
 * Each function takes user input + returns the AI prompt
 */

export type StepInput = Record<string, any>;

export type PromptTemplate = {
  step: number;
  name: string;
  buildPrompt: (input: StepInput) => { system: string; user: string };
  parseOutput: (raw: string) => any;
};

// =====================================================
// Step 1: Business DNA → Brand Card
// =====================================================
const step1: PromptTemplate = {
  step: 1,
  name: 'Business DNA',
  buildPrompt: (input) => ({
    system: `คุณคือ Marketing Strategist ที่มีประสบการณ์ 20 ปีในการสร้าง Brand Card ให้ SME ไทย
เข้าใจ pain point คนไทย ตลาดไทย และ platform ไทย (Facebook, LINE, TikTok)
เขียนแบบชัด กระชับ ไม่เยอะ ใช้ภาษาที่ ป.6 อ่านเข้าใจ

⚠️ สำคัญ: ตอบเป็น JSON object เดียวเท่านั้น ห้ามมี markdown code fence ห้ามมีข้อความอธิบายก่อน/หลัง
⚠️ JSON ต้อง valid — ใช้ double quote, ห้ามมี trailing comma`,
    user: `# ข้อมูลธุรกิจ
- ชื่อ: ${input.business_name}
- ประเภท: ${input.business_type}
- อุตสาหกรรม: ${input.industry}
- ที่ตั้ง: ${input.location}

# ลูกค้า
- อายุ: ${input.customer_age}
- อาชีพ: ${input.customer_job}
- รายได้: ${input.customer_income}

# Pain Points
1. ${input.pain_point_1}
2. ${input.pain_point_2}
3. ${input.pain_point_3}

# คู่แข่ง
- ${input.competitor_1}
- ${input.competitor_2}
- ${input.competitor_3}

# อื่นๆ
- จุดต่าง: ${input.differentiation}
- ราคา: ${input.price_range}
- เป้า 3 เดือน: ${input.goal}

${input.user_notes ? `# โน้ต/บริบทเพิ่มเติมจากผู้ใช้
${input.user_notes}
` : ''}${input.uploaded_files?.length ? `# ไฟล์ที่อัปโหลด
${input.uploaded_files.map((f: any) => `- ${f.name} (${f.mime || 'unknown'})`).join('\n')}
` : ''}
# Output JSON Schema
{
  "positioning": "ประโยคเดียว: ใคร + ทำอะไร + ให้ใคร + ต่างจากใคร",
  "uvp": "Unique Value Proposition",
  "target_audience": "คำอธิบายลูกค้า 2-3 ประโยค",
  "voice_tone": "สไตล์การสื่อสาร",
  "anti_positioning": "ลูกค้าที่ไม่ใช่ target",
  "reasoning": "เหตุผลสั้นๆ 1-2 ประโยค"
}

ข้อจำกัด: ห้ามใช้ "ดีที่สุด", "ครบวงจร", "มืออาชีพ" แต่ละข้อไม่เกิน 2-3 ประโยค`,
  }),
  parseOutput: (raw) => raw,
};

// =====================================================
// Step 2: Customer Persona
// =====================================================
const step2: PromptTemplate = {
  step: 2,
  name: 'Customer Persona',
  buildPrompt: (input) => ({
    system: `คุณคือ Customer Research Specialist ที่เชี่ยวชาญการวิเคราะห์ persona จากข้อมูลจริง
เข้าใจ SME ไทย พฤติกรรมคนไทย และ platform สังคมออนไลน์ไทย
ไม่เดา — ใช้แต่ข้อมูลจริงที่ user ให้

⚠️ สำคัญ: ตอบเป็น JSON object เดียวเท่านั้น ห้ามมี markdown code fence ห้ามมีข้อความอธิบายก่อน/หลัง
⚠️ JSON ต้อง valid — ใช้ double quote, ห้ามมี trailing comma`,
    user: `# ธุรกิจ
- ชื่อ: ${input.business_name}
- อุตสาหกรรม: ${input.industry}
- Brand Card: ${JSON.stringify(input.brand_card || {})}

${input.brand_voice ? `# Brand Voice (จาก tool/โปรเจกต์ที่ดึงมาใช้)
${JSON.stringify(input.brand_voice, null, 2)}
` : ''}${input.pain_points ? `# Pain Points (จาก tool/โปรเจกต์ที่ดึงมาใช้)
${JSON.stringify(input.pain_points, null, 2)}
` : ''}
# Raw Data (รีวิว/ข้อความจากลูกค้าจริง)
${input.reviews_text}

${input.user_notes ? `# โน้ต/บริบทเพิ่มเติมจากผู้ใช้
${input.user_notes}
` : ''}${input.uploaded_files?.length ? `# ไฟล์ที่อัปโหลด
${input.uploaded_files.map((f: any) => `- ${f.name} (${f.mime || 'unknown'})`).join('\n')}
` : ''}
# Output JSON Schema
{
  "personas": [
    {
      "name": "ชื่อ persona (เช่น 'พี่หมู - พนักงานออฟฟิศสายสุขภาพ')",
      "demographics": {"age": "", "job": "", "income": "", "location": "", "family": ""},
      "psychographics": {"values": "", "interests": "", "fears": "", "aspirations": ""},
      "pain_points": ["...", "..."],
      "preferred_channels": ["Instagram", "Facebook", "LINE"],
      "key_quotes": ["quote จริง 1", "quote จริง 2"],
      "motivators": ["..."],
      "objections": ["..."],
      "best_offer": "...",
      "size_estimate": "55% ของลูกค้า"
    }
  ],
  "insights": ["insight 1", "insight 2"]
}

key_quotes ต้องเป็น quote จริงจาก raw data (ห้ามแต่ง)`,
  }),
  parseOutput: (raw) => raw,
};

// =====================================================
// Step 3: Customer Journey
// =====================================================
const step3: PromptTemplate = {
  step: 3,
  name: 'Customer Journey',
  buildPrompt: (input) => ({
    system: `คุณคือ Customer Experience Designer ที่ออกแบบ customer journey ให้ SME ไทย
เข้าใจ touchpoint ออนไลน์และออฟไลน์ของคนไทย

⚠️ สำคัญ: ตอบเป็น JSON object เดียวเท่านั้น ห้ามมี markdown code fence ห้ามมีข้อความอธิบายก่อน/หลัง
⚠️ JSON ต้อง valid — ใช้ double quote, ห้ามมี trailing comma`,
    user: `# ธุรกิจ
- ชื่อ: ${input.business_name}
- Conversion goal: ${input.goal}
- ราคาเฉลี่ย: ${input.product_price}

# Personas (จาก Step 2)
${JSON.stringify(input.personas || {})}

${input.user_notes ? `# โน้ต/บริบทเพิ่มเติมจากผู้ใช้
${input.user_notes}
` : ''}${input.uploaded_files?.length ? `# ไฟล์ที่อัปโหลด
${input.uploaded_files.map((f: any) => `- ${f.name} (${f.mime || 'unknown'})`).join('\n')}
` : ''}
# Output JSON Schema
{
  "journey": [
    {
      "stage": "awareness",
      "stage_name_th": "รู้จักครั้งแรก",
      "touchpoints": ["Instagram", "LINE ad", "Google"],
      "emotions": {
        "primary": "อยากรู้",
        "secondary": "สงสัย",
        "pain": "...",
        "quote": "..."
      },
      "key_message": "...",
      "kpi": "impressions, reach, CTR",
      "content_types": ["Reels", "Carousel"]
    }
  ],
  "pain_points": [{"stage": "decision", "pain": "...", "solution": "..."}],
  "emotion_curve": {
    "description": "...",
    "data": [
      {"stage": "awareness", "emotion_score": 3, "label": "curious"},
      {"stage": "consideration", "emotion_score": 4, "label": "interested"},
      {"stage": "decision", "emotion_score": 2, "label": "hesitant"},
      {"stage": "action", "emotion_score": 5, "label": "excited"},
      {"stage": "loyalty", "emotion_score": 6, "label": "delighted"}
    ]
  },
  "opportunities": ["...", "..."]
}

emotions.quote ต้องเป็นภาษาที่คนไทยพูดจริงๆ`,
  }),
  parseOutput: (raw) => raw,
};

// =====================================================
// Step 4: Positioning
// =====================================================
const step4: PromptTemplate = {
  step: 4,
  name: 'Positioning',
  buildPrompt: (input) => ({
    system: `คุณคือ Brand Strategist ที่เชี่ยวชาญ Positioning
ช่วย SME ไทยหา "ตำแหน่ง" ในใจลูกค้า
เขียน positioning statement ที่ใช้ได้จริง ไม่ใช่แค่สวยหรู

⚠️ สำคัญ: ตอบเป็น JSON object เดียวเท่านั้น ห้ามมี markdown code fence ห้ามมีข้อความอธิบายก่อน/หลัง
⚠️ JSON ต้อง valid — ใช้ double quote, ห้ามมี trailing comma`,
    user: `# Brand Card
${JSON.stringify(input.brand_card || {})}

# Personas
${JSON.stringify(input.personas || {})}

# คู่แข่ง + positioning เขา
1. ${input.competitor_1}
2. ${input.competitor_2}
3. ${input.competitor_3}

# Constraints
- ตำแหน่งราคา: ${input.price_position}
- เป้าหมาย: ${input.goal}

${input.user_notes ? `# โน้ต/บริบทเพิ่มเติมจากผู้ใช้
${input.user_notes}
` : ''}${input.uploaded_files?.length ? `# ไฟล์ที่อัปโหลด
${input.uploaded_files.map((f: any) => `- ${f.name} (${f.mime || 'unknown'})`).join('\n')}
` : ''}
# Output JSON Schema
{
  "positioning_statement": "ประโยคเต็ม 2-3 ประโยค",
  "positioning_one_liner": "1 ประโยค",
  "uvp_bullets": ["...", "...", "..."],
  "tagline_options": ["...", "...", "..."],
  "competitive_frame": {
    "vs_competitor_1": "เรา X / เขา Y",
    "vs_competitor_2": "เรา X / เขา Y",
    "vs_competitor_3": "เรา X / เขา Y"
  },
  "proof_points": ["...", "..."],
  "elevator_pitch": "30 วินาที"
}

ห้ามใช้ "ดีที่สุด", "ครบวงจร", "มืออาชีพ"`,
  }),
  parseOutput: (raw) => raw,
};

// =====================================================
// Step 5: Content Calendar
// =====================================================
const step5: PromptTemplate = {
  step: 5,
  name: 'Content Calendar',
  buildPrompt: (input) => ({
    system: `คุณคือ Content Strategist ที่เขียน content ให้ SME ไทย
เข้าใจ platform ไทย, ภาษาไทย, คนไทย
caption กระชับ ไม่เกิน 4-5 บรรทัด
hook ทำให้คนหยุด scroll

⚠️ สำคัญมาก: ตอบเป็น JSON object เดียวเท่านั้น ห้ามมี markdown code fence ห้ามมีข้อความอธิบายก่อน/หลัง
⚠️ ต้องมี 30 items ใน array "calendar" เท่านั้น
⚠️ JSON ต้อง valid — ใช้ double quote, ห้ามมี trailing comma`,
    user: `# Brand
${JSON.stringify(input.brand_card || {})}

# Personas (ย่อ)
${JSON.stringify((input.personas || {}).personas ? input.personas.personas.slice(0, 2) : input.personas || {})}

# Positioning
${JSON.stringify(input.positioning || {})}

# Channels
${input.channels || 'Facebook, Instagram, LINE'}

# Cadence
โพสต์ ${input.posts_per_week || 5} ชิ้น/สัปดาห์ × 4 สัปดาห์ = 20-30 ชิ้น/เดือน

${input.user_notes ? `# โน้ต/บริบทเพิ่มเติมจากผู้ใช้
${input.user_notes}
` : ''}${input.uploaded_files?.length ? `# ไฟล์ที่อัปโหลด
${input.uploaded_files.map((f: any) => `- ${f.name} (${f.mime || 'unknown'})`).join('\n')}
` : ''}
# Output JSON Schema
{
  "calendar": [
    {
      "day": 1,
      "pillar": "awareness | education | social_proof | conversion",
      "platform": "facebook | instagram | line | tiktok",
      "format": "reel | image | carousel | story | post",
      "hook": "ประโยค hook 1 บรรทัด หยุด scroll ได้",
      "caption": "caption 3-5 บรรทัด ภาษาไทย",
      "cta": "กดลิงก์ / ทักแชท / แชร์ / บันทึก",
      "hashtags": ["#tag1", "#tag2", "#tag3"],
      "visual_suggestion": "คำอธิบายภาพ 1 บรรทัด",
      "expected_engagement": "high | medium | low"
    }
  ]
}

⚠️ สร้าง 20-30 items ใน calendar (เริ่ม day ที่ 1)
⚠️ กระจาย pillar: ~25% awareness / ~35% education / ~25% social_proof / ~15% conversion
⚠️ hashtag ไม่เกิน 5 ตัว ต่อ item
⚠️ ทุก field ต้องมี ไม่เว้นว่าง
⚠️ JSON valid — ไม่มี comment, ไม่มี trailing comma`,
  }),
  parseOutput: (raw) => raw,
};

// =====================================================
// Step 6: Marketing Workflow
// =====================================================
const step6: PromptTemplate = {
  step: 6,
  name: 'Marketing Workflow',
  buildPrompt: (input) => ({
    system: `คุณคือ Marketing Operations Specialist
ออกแบบ workflow ที่ใช้ AI ช่วยงานเดิม ไม่ใช่เพิ่มงาน
ประหยัดเวลา ≥ 50% คุณภาพไม่ตก
ตอบเป็น JSON เท่านั้น`,
    user: `# Brand
${JSON.stringify(input.brand_card || {})}

# Positioning
${JSON.stringify(input.positioning || {})}

# Current Work
${input.current_work}

# Team
- ขนาดทีม: ${input.team_size} คน
- งบ AI tools: ${input.budget} บาท/เดือน
- เครื่องมือที่มี: ${input.tools_available}

${input.user_notes ? `# โน้ต/บริบทเพิ่มเติมจากผู้ใช้
${input.user_notes}
` : ''}${input.uploaded_files?.length ? `# ไฟล์ที่อัปโหลด
${input.uploaded_files.map((f: any) => `- ${f.name} (${f.mime || 'unknown'})`).join('\n')}
` : ''}
# Output JSON Schema
{
  "workflows": [
    {
      "id": "wf-1",
      "name": "...",
      "type": "content",
      "time_before": "6 ชม./เดือน",
      "time_after": "1 ชม./เดือน",
      "time_saved_pct": 83,
      "tools_used": ["ChatGPT Plus", "Canva Pro"],
      "tools_cost_monthly": 750,
      "steps": [
        {"step": 1, "action": "...", "duration": "10 นาที", "output": "..."}
      ],
      "frequency": "ทุกเดือน",
      "kpi": "Reach, Engagement",
      "pitfalls": ["..."]
    }
  ],
  "voice_guide": {
    "tone": "Friendly + Knowledgeable",
    "do": ["...", "...", "..."],
    "dont": ["...", "...", "..."],
    "sample_phrases": ["...", "...", "..."]
  }
}

ต้องมี 3 workflows
time_saved_pct ≥ 50% ทุกตัว`,
  }),
  parseOutput: (raw) => raw,
};

// =====================================================
// Step 7: KPI Dashboard
// =====================================================
const step7: PromptTemplate = {
  step: 7,
  name: 'KPI Dashboard',
  buildPrompt: (input) => ({
    system: `คุณคือ Growth Marketing Analyst
ออกแบบ KPI dashboard ให้ SME ไทย
5 KPIs เท่านั้น (ไม่มากกว่า)
actionable + measurable + realistic
ตอบเป็น JSON เท่านั้น`,
    user: `# Business
- Brand: ${JSON.stringify(input.brand_card || {})}
- Positioning: ${JSON.stringify(input.positioning || {})}
- Type: ${input.business_type}
- Monthly revenue: ${input.monthly_revenue} บาท

# Goals
- 30 วัน: ${input.goal_30}
- 90 วัน: ${input.goal_90}

# Current Metrics
${JSON.stringify(input.current_metrics || {})}

${input.user_notes ? `# โน้ต/บริบทเพิ่มเติมจากผู้ใช้
${input.user_notes}
` : ''}${input.uploaded_files?.length ? `# ไฟล์ที่อัปโหลด
${input.uploaded_files.map((f: any) => `- ${f.name} (${f.mime || 'unknown'})`).join('\n')}
` : ''}
# Output JSON Schema
{
  "kpis": [
    {
      "id": "kpi-1",
      "name": "Lead ใหม่ต่อสัปดาห์",
      "category": "leading",
      "current": 5,
      "target_30d": 15,
      "target_90d": 30,
      "unit": "คน",
      "how_to_measure": "...",
      "tool": "Google Sheet",
      "frequency": "ทุกวันจันทร์",
      "owner": "Marketing",
      "action_if_below": "...",
      "why_this_matters": "..."
    }
  ],
  "action_plan_30d": {
    "week_1": {"theme": "Foundation", "tasks": ["..."], "outcome": "..."},
    "week_2": {"theme": "Awareness Push", "tasks": ["..."], "outcome": "..."},
    "week_3": {"theme": "Conversion", "tasks": ["..."], "outcome": "..."},
    "week_4": {"theme": "Optimize", "tasks": ["..."], "outcome": "..."}
  },
  "dashboard_template": {
    "tool": "Google Sheet",
    "tabs": [
      {"name": "Daily KPIs", "columns": ["Date", "Lead", "Revenue", "Notes"]}
    ]
  },
  "review_ritual": {
    "daily": "9:00 เช็ค LINE",
    "weekly": "จันทร์ 9:00 review",
    "monthly": "วันที่ 1 ของเดือน"
  }
}

target realistic (1.5-3x current ไม่ใช่ 10x)`,
  }),
  parseOutput: (raw) => raw,
};

export const PROMPT_TEMPLATES: Record<number, PromptTemplate> = {
  1: step1,
  2: step2,
  3: step3,
  4: step4,
  5: step5,
  6: step6,
  7: step7,
};

export const STEPS = [1, 2, 3, 4, 5, 6, 7];

// =====================================================
// Standalone Tools — SPICE framework
// =====================================================

/**
 * Pain Point Generator (SPICE framework)
 * S - Situation: กลุ่มเป้าหมายของธุรกิจคือใคร หมวดสินค้า/บริการอะไร
 * P - Persona: สวมบทบาทเป็นนักวิเคราะห์ Unmet Need
 * I - Instruction: วิเคราะห์ลูกค้ากลุ่มนี้ Pain Point อะไรที่ยังแก้ไม่ตรงจุด
 * C - Criteria: เรียง Pain Point ที่เป็นปัญหาหลักหรือรุนแรงแรงจากมากไปน้อย และจัดลำดับความถี่
 * E - Example: อยากได้ Pain Point ที่ใหญ่พอจะเป็นโอกาสทางธุรกิจ
 */
export const painGeneratorPrompt: PromptTemplate = {
  step: 0,
  name: 'Pain Point Generator',
  buildPrompt: (input) => ({
    system: `คุณคือ Customer Research Specialist ที่เชี่ยวชาญการหา Pain Point และ Unmet Need
ใช้ SPICE Framework:
- Situation: ระบุกลุ่มเป้าหมาย หมวดสินค้า/บริการ
- Persona: สวมบทบาทเป็นนักวิเคราะห์ Unmet Need
- Instruction: วิเคราะห์ Pain Point ที่ลูกค้ากลุ่มนี้เจอ
- Criteria: เรียงตามความรุนแรง/ความถี่
- Example: Pain Point ต้องใหญ่พอเป็นโอกาสธุรกิจ

⚠️ ตอบเป็น JSON object เดียวเท่านั้น ไม่มี markdown ไม่มีข้อความอธิบายก่อน/หลัง
⚠️ JSON ต้อง valid`,
    user: `# ธุรกิจ
- ชื่อ: ${input.business_name}
- ประเภท: ${input.business_type}
- อุตสาหกรรม: ${input.industry}
- กลุ่มเป้าหมาย: ${input.target_audience || 'ลูกค้าทั่วไป'}

# Situation (S)
กลุ่มเป้าหมายของ ${input.business_name} คือ ${input.target_audience || 'ลูกค้าทั่วไป'} ในหมวด${input.industry}

# Persona (P)
สวมบทบาทเป็นนักวิเคราะห์ Unmet Need ที่มีประสบการณ์ 15 ปี

# Instruction (I)
วิเคราะห์ Pain Point และ Unmet Need ของลูกค้ากลุ่มนี้ — ปัญหาที่ยังแก้ไม่ตรงจุด

# Criteria (C)
เรียง Pain Point ตามความรุนแรง ความถี่ และขนาดของตลาด

# Example (E)
Pain Point ต้องใหญ่พอที่จะเป็นโอกาสทางธุรกิจ ไม่ใช่แค่ปัญหาเล็กๆ

${input.user_notes ? `# โน้ต/บริบทเพิ่มเติมจากผู้ใช้
${input.user_notes}
` : ''}${input.uploaded_files?.length ? `# ไฟล์ที่อัปโหลด
${input.uploaded_files.map((f: any) => `- ${f.name} (${f.mime || 'unknown'})`).join('\n')}
` : ''}
# Output JSON Schema
{
  "summary": "สรุปสั้นๆ 1-2 ประโยค",
  "persona_insight": "วิเคราะห์กลุ่มเป้าหมาย 2-3 ประโยค",
  "pain_points": [
    {
      "rank": 1,
      "title": "ชื่อ Pain Point สั้นๆ",
      "description": "อธิบาย 2-3 ประโยค ว่าเจ็บปวดแค่ไหน",
      "severity": "high | medium | low",
      "frequency": "daily | weekly | monthly | rarely",
      "market_size": "ใหญ่/กลาง/เล็ก และเหตุผล",
      "current_solutions": ["วิธีที่ลูกค้าแก้ตอนนี้"],
      "why_existing_fails": "ทำไมถึงยังไม่ตรงจุด",
      "your_opportunity": "โอกาสที่ธุรกิจคุณทำได้"
    }
  ],
  "quick_wins": ["Pain Point ที่แก้ได้เร็วที่สุด"],
  "moonshots": ["Pain Point ที่ต้องใช้เวลาแต่ payoff สูง"],
  "priority_pick": {
    "rank": 1,
    "why": "1-2 ประโยค อธิบายว่าทำไมควรเริ่มแก้ pain point นี้ก่อน (ชั่งน้ำหนักความรุนแรง/ความถี่/ความยากในการแก้)"
  },
  "validation_note": "1 ประโยค เตือนว่านี่คือการวิเคราะห์จาก pattern อุตสาหกรรม ไม่ใช่จากสัมภาษณ์ลูกค้าจริง แนะนำวิธี validate เร็วๆ ก่อนลงทุนแก้ (เช่น ถามลูกค้าจริง 5-10 คน)"
}

ตอบ JSON เท่านั้น`,
  }),
  parseOutput: (raw) => raw,
};

/**
 * Brand Voice Generator (SPICE framework)
 */
export const brandVoicePrompt: PromptTemplate = {
  step: 0,
  name: 'Brand Voice Generator',
  buildPrompt: (input) => ({
    system: `คุณคือ Brand Strategist ที่เชี่ยวชาญการสร้าง Brand Voice & Tone
ใช้ SPICE Framework:
- Situation: ธุรกิจ อุตสาหกรรม กลุ่มเป้าหมาย
- Persona: สวมบทบาทเป็นนักเขียนแบรนด์มืออาชีพ
- Instruction: สร้าง Brand Voice ที่สะท้อนตัวตนและตรงใจลูกค้า
- Criteria: เสียงต้องจำง่าย ต่างจากคู่แข่ง ใช้ได้จริง
- Example: ใช้ตัวอย่างประโยคจริงให้ลูกค้าเห็นภาพ

⚠️ ตอบเป็น JSON object เดียวเท่านั้น ไม่มี markdown ไม่มีข้อความอธิบายก่อน/หลัง`,
    user: `# ธุรกิจ
- ชื่อ: ${input.business_name}
- ประเภท: ${input.business_type}
- อุตสาหกรรม: ${input.industry}
- กลุ่มเป้าหมาย: ${input.target_audience}
${input.brand_personality ? `- บุคลิกแบรนด์ที่อยาก: ${input.brand_personality}` : ''}
${input.tone_keywords ? `- Tone keywords: ${input.tone_keywords}` : ''}
${input.dos ? `- สิ่งที่อยากทำ: ${input.dos}` : ''}
${input.donts ? `- สิ่งที่ไม่อยากทำ: ${input.donts}` : ''}

# Situation (S)
${input.business_name} เป็นธุรกิจ${input.business_type} ในอุตสาหกรรม${input.industry} คุยกับ${input.target_audience}

# Persona (P)
สวมบทบาทเป็นนักเขียนแบรนด์มืออาชีพ 20 ปี

# Instruction (I)
สร้าง Brand Voice ที่:
- ตรงกับบุคลิกแบรนด์
- โดนใจกลุ่มเป้าหมาย
- ต่างจากคู่แข่ง
- ใช้ได้จริงทุกแพลตฟอร์ม (Facebook, LINE, IG, TikTok)

# Criteria (C)
- เสียงต้องจำได้ทันที
- ไม่ใช้คำว่า "ดีที่สุด" "ครบวงจร" "มืออาชีพ"
- เป็นภาษาที่ ป.6 อ่านเข้าใจ

# Example (E)
ยกตัวอย่างประโยคที่ใช้ได้จริง อย่างน้อย 5 ประโยค

${input.user_notes ? `# โน้ต/บริบทเพิ่มเติมจากผู้ใช้
${input.user_notes}
` : ''}${input.uploaded_files?.length ? `# ไฟล์ที่อัปโหลด
${input.uploaded_files.map((f: any) => `- ${f.name} (${f.mime || 'unknown'})`).join('\n')}
` : ''}
# Output JSON Schema
{
  "voice_summary": "สรุป Brand Voice 1-2 ประโยค",
  "personality_archetype": "เช่น The Mentor / The Friend / The Rebel / The Sage",
  "tone": "เช่น พูดตรง + อบอุ่น",
  "voice_dimensions": {
    "formal_casual": "1-10 (1=เป็นทางการมาก, 10=สบายๆ)",
    "serious_playful": "1-10",
    "factual_emotional": "1-10",
    "formal_concise": "1-10 (1=เยอะ, 10=สั้นกระชับ)"
  },
  "voice_attributes": [
    {
      "attribute": "ชื่อ voice attribute เช่น 'อบอุ่น'",
      "means": "อธิบายว่า 'อบอุ่น' ของแบรนด์นี้แปลว่าอะไรจริงๆ ในทางปฏิบัติ",
      "does_not_mean": "สิ่งที่มักเข้าใจผิด — 'อบอุ่น' ไม่ได้แปลว่าอะไร (เช่น ไม่ใช่พูดจาเยิ่นเย้อ/ไม่จริงจัง)"
    }
  ],
  "do_list": ["สิ่งที่ควรทำ 5-7 ข้อ"],
  "dont_list": ["สิ่งที่ไม่ควรทำ 5-7 ข้อ"],
  "vocabulary": {
    "use_words": ["คำที่ใช้บ่อย 8-10 คำ"],
    "avoid_words": ["คำที่ห้ามใช้ 5-7 คำ"]
  },
  "sample_phrases": {
    "greeting": ["ตัวอย่างประโยคทักทาย"],
    "explaining": ["ตัวอย่างประโยคอธิบาย"],
    "selling": ["ตัวอย่างประโยคขาย"],
    "supporting": ["ตัวอย่างประโยค support ลูกค้า"],
    "apology": ["ตัวอย่างประโยคขอโทษ"]
  },
  "content_examples": {
    "facebook_post": "ตัวอย่างโพสต์ Facebook 1 ชิ้น",
    "instagram_caption": "ตัวอย่างแคปชั่น IG 1 ชิ้น",
    "line_message": "ตัวอย่างข้อความ LINE 1 ชิ้น"
  },
  "self_check_list": ["8-10 ข้อ ให้คนเขียน content ใช้ตรวจสอบตัวเองก่อนโพสต์ ว่าประโยคที่เขียนตรงกับ brand voice นี้ไหม"]
}

⚠️ voice_attributes ต้องมีอย่างน้อย 3 attribute พร้อม means/does_not_mean ที่ชัดเจน ไม่ใช่แค่คำคุณศัพท์ลอยๆ`,
  }),
  parseOutput: (raw) => raw,
};

/**
 * Persona Builder (for businesses without reviews)
 * Helps build personas from scratch using industry/target info
 */
export const personaBuilderPrompt: PromptTemplate = {
  step: 0,
  name: 'Persona Builder',
  buildPrompt: (input) => ({
    system: `คุณคือ Customer Research Specialist ที่เชี่ยวชาญการสร้าง Persona จากข้อมูลสมมติฐาน
สำหรับธุรกิจใหม่ที่ยังไม่มีรีวิว/ข้อมูลลูกค้า
ใช้ความรู้เรื่องอุตสาหกรรม พฤติกรรมผู้บริโภค และ platform สังคมออนไลน์ไทย

⚠️ ตอบเป็น JSON object เดียวเท่านั้น ไม่มี markdown ไม่มีข้อความอธิบายก่อน/หลัง
⚠️ ระบุชัดเจนว่าเป็น "สมมติฐาน" ไม่ใช่ข้อมูลจริง`,
    user: `# ธุรกิจ
- ชื่อ: ${input.business_name}
- ประเภท: ${input.business_type}
- อุตสาหกรรม: ${input.industry}
- ที่ตั้ง: ${input.location}
${input.target_age ? '- อายุลูกค้าเป้าหมาย: ' + input.target_age : ''}
${input.target_job ? '- อาชีพลูกค้า: ' + input.target_job : ''}
${input.target_income ? '- รายได้: ' + input.target_income : ''}
${input.differentiation ? '- จุดต่าง: ' + input.differentiation : ''}
${input.pain_points ? '- Pain Points ที่คิดว่า: ' + input.pain_points : ''}
${input.context ? '- บริบทเพิ่มเติม: ' + input.context : ''}

⚠️ หมายเหตุ: ธุรกิจนี้ยังใหม่ ไม่มีรีวิว/ข้อมูลลูกค้าจริง — ใช้การวิเคราะห์จากอุตสาหกรรมและสมมติฐานที่สมเหตุสมผล

${input.user_notes ? `# โน้ต/บริบทเพิ่มเติมจากผู้ใช้
${input.user_notes}
` : ''}${input.uploaded_files?.length ? `# ไฟล์ที่อัปโหลด
${input.uploaded_files.map((f: any) => `- ${f.name} (${f.mime || 'unknown'})`).join('\n')}
` : ''}
# Output JSON Schema
{
  "disclaimer": "ข้อมูลนี้เป็นสมมติฐานจากการวิเคราะห์อุตสาหกรรม ควร validate ด้วยข้อมูลจริงเมื่อมีรีวิว/สัมภาษณ์ลูกค้า",
  "personas": [
    {
      "name": "ชื่อ persona จำง่าย (เช่น 'พี่นัท - คนทำงานออฟฟิศสายสุขภาพ')",
      "tag": "สั้นๆ 3-5 คำ",
      "demographics": {
        "age": "ช่วงอายุ",
        "job": "อาชีพ",
        "income": "รายได้",
        "location": "ที่อยู่/ย่าน",
        "family": "สถานะครอบครัว"
      },
      "psychographics": {
        "values": "ค่านิยมที่ยึดถือ",
        "interests": "งานอดิเรก/ความสนใจ",
        "fears": "สิ่งที่กลัว/กังวล",
        "aspirations": "สิ่งที่ใฝ่ฝัน"
      },
      "pain_points": [
        "ปัญหา/ความเจ็บปวดที่ persona นี้เจอ (สมมติฐานจากอุตสาหกรรม)"
      ],
      "needs": [
        "ความต้องการที่ persona นี้อยากได้"
      ],
      "day_in_life": "เล่าสถานการณ์สั้นๆ 2-3 ประโยค ว่าวันหนึ่งของ persona นี้เป็นยังไง (ก่อนเจอปัญหา/ตอนเจอปัญหา/ตอนมองหาทางแก้)",
      "sample_quotes": ["คำพูดจริง 2-3 ประโยคที่ persona นี้น่าจะพูด เช่น บ่นเรื่อง pain point หรือชมตอนได้สิ่งที่ต้องการ"],
      "preferred_channels": ["Facebook", "Instagram", "LINE", "TikTok", "YouTube"],
      "best_message": "ข้อความที่จะ resonate กับ persona นี้",
      "best_offer": "ข้อเสนอที่ตรงใจ",
      "buying_behavior": {
        "research_style": "วิธีหาข้อมูลก่อนซื้อ (เช่น หา Google รีวิว / ถามเพื่อน / ดูโซเชียล)",
        "decision_speed": "impulse (ตัดสินใจเร็ว) | considered (คิดนาน เทียบหลายเจ้า)",
        "objections": ["เหตุผลที่ persona นี้อาจลังเลไม่ซื้อ 2-3 ข้อ"]
      },
      "size_estimate": "55% ของลูกค้า (สมมติฐาน)",
      "validation_methods": [
        "วิธีที่จะไป validate persona นี้ด้วยข้อมูลจริง (สัมภาษณ์/แบบสอบถาม/ดูรีวิวคู่แข่ง)"
      ]
    }
  ],
  "how_to_validate": [
    "วิธี collect ข้อมูลจริงจากลูกค้าเพื่อ update persona นี้ (3-5 วิธี)"
  ]
}

⚠️ สร้าง 1-2 persona เท่านั้น (สูงสุด 3) — ไม่ต้องสร้างเยอะ เพื่อไม่ให้ user ตัดสินใจไม่ถูกว่าจะโฟกัสใคร`,
  }),
  parseOutput: (raw) => raw,
};

/**
 * Competitor Analysis (SPICE framework)
 * ใช้วิเคราะห์ตลาด + หา white space ที่ธุรกิจชนะได้
 */
export const competitorAnalysisPrompt: PromptTemplate = {
  step: 0,
  name: 'Competitor Analysis',
  buildPrompt: (input) => ({
    system: `คุณคือ Competitive Intelligence Analyst ที่เชี่ยวชาญการวิเคราะห์คู่แข่งในตลาด SME ไทย
ใช้ SPICE Framework:
- Situation: ธุรกิจ อุตสาหกรรม กลุ่มเป้าหมาย
- Persona: สวมบทบาทนักวิเคราะห์กลยุทธ์การแข่งขัน
- Instruction: วิเคราะห์คู่แข่ง + หา white space
- Criteria: actionable + grounded + realistic (อ้างอิงจากบริบทที่ user ให้)
- Example: ยกตัวอย่างวิธีชนะจริง

⚠️ ตอบเป็น JSON object เดียวเท่านั้น ไม่มี markdown ไม่มีข้อความอธิบายก่อน/หลัง
⚠️ ตอบตามข้อมูลที่ user ให้ — ถ้า user ระบุชื่อคู่แข่งมาให้ วิเคราะห์ตามนั้น
⚠️ ถ้าเลือก competitor_mode = "auto_find" ให้ AI เดาคู่แข่งที่น่าจะเป็นในตลาดจากบริบท (3-5 เจ้า) และระบุชัดว่า "เป็นการประมาณการณ์"
⚠️ ใช้ภาษาไทย ป.6 อ่านเข้าใจ`,
    user: `# ธุรกิจของฉัน
- ชื่อ: ${input.business_name}
- ประเภท: ${input.business_type}
- อุตสาหกรรม: ${input.industry}
- ที่ตั้ง: ${input.location || 'ไม่ระบุ'}
- กลุ่มเป้าหมาย: ${input.target_audience || 'ลูกค้าทั่วไป'}
- จุดต่าง: ${input.differentiation || 'ยังไม่ระบุ'}
- ราคา: ${input.price_range || 'ยังไม่ระบุ'}

# Mode
${input.competitor_mode === 'auto_find' ? '🤖 AUTO-FIND: ให้ AI เดาคู่แข่ง 3-5 เจ้า ที่น่าจะอยู่ในตลาดนี้ (ระบุชัดว่าเป็นการประมาณการณ์)' : '✍️ MANUAL: วิเคราะห์คู่แข่งที่ user ระบุมาเท่านั้น'}

# คู่แข่งที่ระบุ
${input.competitor_1 ? `1. ${input.competitor_1}` : '1. (ไม่ระบุ)'}
${input.competitor_2 ? `2. ${input.competitor_2}` : '2. (ไม่ระบุ)'}
${input.competitor_3 ? `3. ${input.competitor_3}` : '3. (ไม่ระบุ)'}
${input.competitor_4 ? `4. ${input.competitor_4}` : '4. (ไม่ระบุ)'}
${input.competitor_5 ? `5. ${input.competitor_5}` : '5. (ไม่ระบุ)'}

# Focus areas ที่สนใจเป็นพิเศษ
${input.focus_areas?.length ? input.focus_areas.join(', ') : 'ทั้งหมด (pricing, positioning, product, marketing, distribution)'}

# Situation (S)
${input.business_name} เป็นธุรกิจ${input.business_type} ในอุตสาหกรรม${input.industry} ${input.location ? 'ที่ ' + input.location : ''} แข่งกับ${input.competitor_mode === 'auto_find' ? 'คู่แข่งที่ AI จะประมาณการณ์' : 'คู่แข่งที่ user ระบุ'}

# Persona (P)
สวมบทบาทเป็น Competitive Intelligence Analyst ที่มีประสบการณ์ 15 ปีในตลาด SME ไทย

# Instruction (I)
วิเคราะห์:
1. คู่แข่งแต่ละเจ้า — positioning, จุดแข็ง, จุดอ่อน, threat level
2. Market gaps — ช่องว่างที่คู่แข่งทำไม่ดี + โอกาสที่ธุรกิจเราเข้าไปได้
3. White space — ตำแหน่งที่เราควรยึด ที่ไม่ทับกับใคร
4. แผนรุก — ทำอะไรก่อน-หลัง เพื่อชนะ

# Criteria (C)
- Actionable — user เอาไปทำต่อได้เลย
- Grounded — อ้างอิงจากบริบทที่ user ให้
- Realistic — ไม่เพ้อฝัน ไม่ใช้คำว่า "ดีที่สุด"

# Example (E)
- ถ้าเจอ gap เรื่อง "คู่แข่งทุกเจ้าแพง" → opportunity = "เราเป็น affordable option"
- ถ้าคู่แข่งขายออนไลน์อย่างเดียว → opportunity = "เรามีหน้าร้านให้สัมผัส"

${input.user_notes ? `# โน้ต/บริบทเพิ่มเติมจากผู้ใช้
${input.user_notes}
` : ''}${input.uploaded_files?.length ? `# ไฟล์ที่อัปโหลด
${input.uploaded_files.map((f: any) => `- ${f.name} (${f.mime || 'unknown'})`).join('\n')}
` : ''}
# Output JSON Schema
{
  "summary": "ภาพรวมตลาด 2-3 บรรทัด",
  "market_dynamics": "ลักษณะตลาด — fragmented/consolidated, ใครครอง, แนวโน้ม 1-2 ประโยค",
  ${input.competitor_mode === 'auto_find' ? '"is_estimated": true,\n  "estimation_note": "คู่แข่งเหล่านี้เป็นการประมาณการณ์จากบริบทธุรกิจ ควรไปตรวจสอบข้อมูลจริงอีกครั้ง",' : '"is_estimated": false,'}
  "competitors": [
    {
      "name": "ชื่อคู่แข่ง",
      "tagline": "สโลแกน/ข้อความที่ใช้ขายตัวเอง",
      "positioning": "เขา position ตัวเองว่าอะไร (1 ประโยค)",
      "price_range": "฿ / ฿฿ / ฿฿฿ หรือช่วงราคา",
      "strengths": ["จุดแข็ง 1", "จุดแข็ง 2", "จุดแข็ง 3"],
      "weaknesses": ["จุดอ่อน 1", "จุดอ่อน 2", "จุดอ่อน 3"],
      "marketing_channels": ["Facebook", "LINE OA", "หน้าร้าน"],
      "content_style": "วิดีโอสั้น / เล่าเรื่อง / โปรโมชั่น / รีวิว",
      "threat_level": "high | medium | low",
      "why_threat": "ทำไมถึงเป็นภัยคุกคาม",
      "response": "จะทำอะไรกับคู่แข่งรายนี้โดยเฉพาะ (1-2 ประโยค เจาะจงรายนี้ ไม่ใช่ strategy รวม)"
    }
  ],
  "market_gaps": [
    {
      "gap": "ช่องว่างที่เจอ (1 ประโยค)",
      "evidence": "หลักฐานว่ามี gap นี้จริง (จากการวิเคราะห์)",
      "opportunity_size": "big | medium | small",
      "your_advantage": "ทำไมเราเข้าไปเล่นได้"
    }
  ],
  "white_space": {
    "positioning": "เราควร position ตัวเองว่า... (1 ประโยค)",
    "uvp": "Unique Value Proposition — เราต่างจากคู่แข่งยังไง (1-2 ประโยค)",
    "anti_positioning": "ลูกค้าที่เราไม่ต้องการ (1 ประโยค)",
    "key_message": "ข้อความหลักที่ใช้สื่อสาร"
  },
  "recommended_strategy": {
    "now": "ทำอะไรด่วนที่สุด 1 อย่าง",
    "next_30_days": ["action 1", "action 2", "action 3"],
    "next_90_days": ["action 1", "action 2"],
    "avoid": "สิ่งที่ไม่ควรทำ (เพราะอะไร)"
  },
  "reasoning": "เหตุผลเชิงกลยุทธ์ 1-2 ประโยค"
}

⚠️ ตอบ JSON เท่านั้น
⚠️ แต่ละ competitor ต้องมี strengths 3 ข้อ + weaknesses 3 ข้อ + threat_level
⚠️ market_gaps ต้องมี 3-5 ข้อ
⚠️ ใช้ภาษาที่ actionable ไม่ใช่ทฤษฎี
⚠️ threat_level ห้ามให้ "high" ทุกเจ้า — ต้องมีความหลากหลายจริงตามข้อมูล (คู่แข่งบางเจ้าอาจแค่ medium/low) ไม่ใช่ default ไปทาง high เพื่อความปลอดภัย`,
  }),
  parseOutput: (raw) => raw,
};

/**
 * Job-to-be-Done (JTBD) Generator
 * Frameworks: Christensen + Moesta (Forces of Progress) + Ulwick (ODI outcomes)
 * Designed to feed into Value Proposition Canvas (next tool)
 */
export const jtbdGeneratorPrompt: PromptTemplate = {
  step: 0,
  name: 'JTBD Generator',
  buildPrompt: (input) => ({
    system: `คุณคือ JTBD Strategist ที่เชี่ยวชาญ Jobs-to-be-Done Theory
ใช้ 4 frameworks ผสมกัน:
1. **Christensen + Moesta** — Job statement = Situation + Motivation + Outcome + Forces of Progress (Push/Pull/Anxiety/Habit)
2. **Bob Moesta Timeline** — 5 stages: First Thought → Passive Looking → Active Looking → Deciding → First Use
3. **Tony Ulwick (ODI)** — Desired Outcomes = [Direction] + [Unit] + [Object]; scored on Importance × Satisfaction
4. **Ulwick Job Map** — แยก job ใหญ่ออกเป็น 8 ขั้นตอนการทำงานจริง: Define → Locate → Prepare → Confirm → Execute → Monitor → Modify → Conclude

หลักการ:
- ลูกค้าไม่ได้ "ซื้อ" product — **"จ้าง"** product เพื่อทำ progress ในชีวิต
- Job = 3 มิติ: **Functional** (งานจริง), **Emotional** (อยากรู้สึกยังไง), **Social** (อยากให้คนอื่นเห็นว่ายังไง)
- ลูกค้า "ไล่ออก" (fire) solution เดิม แล้ว "จ้าง" (hire) solution ใหม่ เพราะ criteria ที่ชัดเจน — ต้องขุดหาว่า criteria นั้นคืออะไร
- ตอบ JSON เท่านั้น ห้ามมี markdown
- ใช้ภาษาไทย ป.6 อ่านเข้าใจ — เขียน grounded อ้างอิงจากบริบทที่ user ให้
- ทุก insight ต้อง actionable (เอาไปทำต่อได้) ไม่ใช่ทฤษฎีลอย ๆ`,
    user: `# ธุรกิจ
- ชื่อ: ${input.business_name}
- ประเภท: ${input.business_type}
- อุตสาหกรรม: ${input.industry}
- ที่ตั้ง: ${input.location || 'ไม่ระบุ'}
- กลุ่มเป้าหมาย: ${input.target_audience || 'ลูกค้าทั่วไป'}
- จุดต่าง: ${input.differentiation || 'ยังไม่ระบุ'}
- ช่วงราคา: ${input.price_range || 'ยังไม่ระบุ'}

# Customer Context (จาก user)
- อายุลูกค้า: ${input.customer_age || 'ไม่ระบุ'}
- อาชีพ: ${input.customer_job || 'ไม่ระบุ'}
- รายได้: ${input.customer_income || 'ไม่ระบุ'}

# Pain (ที่ user ระบุ)
${input.core_problem || 'ไม่ระบุ — ให้ AI วิเคราะห์จากบริบท'}

# Current Solutions (ที่ลูกค้าใช้อยู่)
${input.current_solutions || 'ไม่ระบุ'}

# Trigger Event (อะไรทำให้ลูกค้าเริ่มมองหาทางออก)
${input.trigger_event || 'ไม่ระบุ'}

# Known Objections / Fears
${input.known_objections || 'ไม่ระบุ'}

# Situation (S)
${input.business_name} เป็นธุรกิจ${input.business_type} ในอุตสาหกรรม${input.industry} ${input.location ? 'ที่ ' + input.location : ''} คุยกับ${input.target_audience || 'ลูกค้าทั่วไป'}

# Persona (P)
สวมบทบาทเป็น JTBD Strategist + Customer Researcher ที่มีประสบการณ์ 15 ปี
อ้างอิง: Clayton Christensen (HBS) + Bob Moesta (Re-Wired Group) + Tony Ulwick (Strategyn)

# Instruction (I)
วิเคราะห์ JTBD แบบครบทุกมิติ:
1. **Primary Job** — Job statement (Situation + Motivation + Outcome) + 3 มิติ
2. **Related Jobs** — งานอื่น ๆ ที่ลูกค้าพยายามทำ (3-5 jobs)
3. **Customer Decision Timeline** — 5 stages พร้อม marketing opportunity ในแต่ละ stage
4. **Forces of Progress** — 4 forces (push/pull/anxiety/habit) + verdict
5. **Desired Outcomes** — 5-8 outcomes พร้อม importance × satisfaction score
6. **Triggers** — 3-5 events ที่ทำให้ลูกค้าเริ่มมองหา
7. **Job Map** — แตก primary job เป็น 8 ขั้นตอนการทำงาน (Define/Locate/Prepare/Confirm/Execute/Monitor/Modify/Conclude)
8. **Hiring & Firing Criteria** — ลูกค้า "ไล่ออก" solution เดิมเพราะอะไร + "จ้าง" solution ใหม่เพราะ criteria อะไร (อ้างอิง current_solutions/known_objections ที่ user ให้)
9. **Deep Research Insights** — 3-5 key insights + validation methods

# Criteria (C)
- Job statement format: "When [situation], I want to [motivation], so I can [expected outcome]"
- Outcome format: "[Direction] + [Unit] + [Object]" (เช่น "ลดเวลา + นาที + ในการหาข้อมูล")
- Importance + Satisfaction score 1-10 (ไม่ใช่ 1-5 เพราะให้ละเอียดขึ้น)
- ทุก insight ต้อง grounded (อ้างอิงจากบริบทที่ user ให้)

# Example (E)
- Functional job: "หาข้อมูลสินค้าก่อนซื้อ" (เน้น task)
- Emotional job: "รู้สึกมั่นใจว่าเลือกถูก" (เน้น feeling)
- Social job: "เพื่อนเห็นแล้วชอบ" (เน้น perception)
- Force example: "Push = ของเก่าพังบ่อย, Pull = ของใหม่ดีไซน์สวย, Anxiety = กลัวแพง, Habit = ซื้อที่เดิมมาตลอด"

${input.user_notes ? `# โน้ต/บริบทเพิ่มเติมจากผู้ใช้
${input.user_notes}
` : ''}${input.uploaded_files?.length ? `# ไฟล์ที่อัปโหลด
${input.uploaded_files.map((f: any) => `- ${f.name} (${f.mime || 'unknown'})`).join('\n')}
` : ''}
# Output JSON Schema
{
  "summary": "ภาพรวม JTBD 2-3 ประโยค",
  
  "core_question": "What progress is the customer trying to make?",
  "answer_to_core_question": "ตอบคำถามนี้ใน 1-2 ประโยค grounded",
  
  "primary_job": {
    "job_statement": "When [situation], I want to [motivation], so I can [expected outcome]",
    "situation": "...",
    "motivation": "...",
    "expected_outcome": "...",
    "job_verb_format": "verb + object + clarifier (Ulwick format)",
    "dimensions": {
      "functional": "งานจริงที่ลูกค้าพยายามทำ (functional job)",
      "emotional": "อยากรู้สึกยังไง (emotional job)",
      "social": "อยากให้คนอื่นเห็นว่ายังไง (social job)"
    }
  },
  
  "related_jobs": [
    {
      "job": "งานอื่นที่ลูกค้าพยายามทำ",
      "context": "ในสถานการณ์ไหน",
      "importance": "high | medium | low",
      "satisfaction_current": "high | medium | low",
      "opportunity": "โอกาสที่ธุรกิจเราเข้าไปช่วยได้"
    }
  ],
  
  "customer_decision_timeline": [
    {
      "stage": "first_thought | passive_looking | active_looking | deciding | first_use",
      "stage_name_th": "ชื่อขั้นตอนภาษาไทย",
      "customer_thinks": "ลูกค้าคิดอะไร",
      "customer_feels": "ลูกค้ารู้สึกยังไง",
      "customer_does": "ลูกค้าทำอะไร",
      "what_they_need": "ลูกค้าต้องการอะไร",
      "marketing_opportunity": "เราเข้าไปช่วงนี้ได้ยังไง (message/channel/CTA)"
    }
  ],
  
  "forces_of_progress": {
    "push": [
      {"force": "ความเจ็บปวดของ status quo ที่ดันลูกค้าให้มองหาของใหม่", "intensity": "high | medium | low", "evidence": "..."}
    ],
    "pull": [
      {"force": "เสน่ห์ของทางออกใหม่ที่ดึงดูด", "intensity": "high | medium | low", "evidence": "..."}
    ],
    "anxiety": [
      {"force": "ความกลัว/ความไม่แน่ใจเกี่ยวกับของใหม่", "intensity": "high | medium | low", "evidence": "..."}
    ],
    "habit": [
      {"force": "comfort ของวิถีเดิม/ของเดิมที่ใช้อยู่", "intensity": "high | medium | low", "evidence": "..."}
    ],
    "verdict": "Push + Pull > Anxiety + Habit หรือไม่? ลูกค้าจะเปลี่ยนได้ยาก/ง่าย เพราะอะไร?",
    "switch_likelihood": "high | medium | low"
  },
  
  "desired_outcomes": [
    {
      "outcome": "ลดเวลา + นาที + ในการหาข้อมูลก่อนซื้อ",
      "category": "speed | cost | quality | risk | emotion | social",
      "importance": 1-10,
      "satisfaction_current": 1-10,
      "opportunity_score": 1-10,
      "why": "ทำไม score นี้ถึงเป็นอย่างนี้"
    }
  ],
  
  "triggers": [
    {
      "event": "เหตุการณ์ที่ทำให้ลูกค้าเริ่มมองหาทางออก",
      "type": "internal | external | social",
      "frequency": "common | occasional | rare",
      "emotional_state": "ลูกค้ารู้สึกยังไงตอนเกิด trigger"
    }
  ],

  "job_map": [
    {"step": "define", "customer_action": "ลูกค้านิยามว่าต้องการทำอะไรให้สำเร็จ", "opportunity": "เราช่วยขั้นนี้ได้ยังไง"},
    {"step": "locate", "customer_action": "...", "opportunity": "..."},
    {"step": "prepare", "customer_action": "...", "opportunity": "..."},
    {"step": "confirm", "customer_action": "...", "opportunity": "..."},
    {"step": "execute", "customer_action": "...", "opportunity": "..."},
    {"step": "monitor", "customer_action": "...", "opportunity": "..."},
    {"step": "modify", "customer_action": "...", "opportunity": "..."},
    {"step": "conclude", "customer_action": "...", "opportunity": "..."}
  ],

  "hiring_firing_criteria": {
    "fired_because": "ทำไมลูกค้าถึงเลิกใช้/ไม่พอใจ solution เดิม (อ้างอิง current_solutions)",
    "hired_because": "criteria ที่ทำให้ลูกค้าเลือก solution ใหม่ (จับต้องได้ ไม่ใช่ทั่วไป)",
    "switch_moment": "เหตุการณ์/ความคิดที่เป็นจุดเปลี่ยนใจจริง ๆ"
  },

  "deep_research_insights": {
    "methodology": "Christensen JTBD + Moesta Forces of Progress + Ulwick ODI",
    "key_insights": [
      "Insight 1 — เห็นอะไรที่ลึก/ไม่ค่อยมีใครเห็น",
      "Insight 2 — ...",
      "Insight 3 — ..."
    ],
    "what_most_brands_get_wrong": "...",
    "validation_methods": [
      "JTBD timeline interview (10 recent buyers, Bob Moesta method)",
      "Outcome importance × satisfaction survey (200+)",
      "Observe struggling moments in real usage"
    ]
  },
  
  "next_steps": [
    "→ Value Proposition Canvas: แมป Pains + Gains → Products/Services + Pain Relievers + Gain Creators",
    "→ Business Model Canvas: ออกแบบ 9 building blocks (Customer Segments, Channels, Revenue Streams, ...)",
    "→ Customer Survey: วัด importance × satisfaction เพื่อ validate outcomes"
  ],
  
  "reasoning": "เหตุผลเชิงกลยุทธ์ 1-2 ประโยค — ทำไม JTBD นี้สำคัญ"
}

⚠️ ตอบ JSON เท่านั้น — กระชับ ไม่ต้องยาว
⚠️ primary_job.dimensions ต้องครบ 3 มิติ (สั้นๆ)
⚠️ customer_decision_timeline ต้องมี 5 stages (each field ≤ 80 ตัวอักษร)
⚠️ forces_of_progress ต้องครบ 4 forces + verdict (each force ≤ 60 ตัวอักษร, ใส่ intensity เป็น high/medium/low)
⚠️ desired_outcomes 3-5 ข้อ พร้อม score 1-10
⚠️ related_jobs 2-3 ข้อ
⚠️ triggers 2-3 ข้อ
⚠️ job_map ต้องครบทั้ง 8 ขั้นตอน (each field ≤ 60 ตัวอักษร — สั้นมาก)
⚠️ hiring_firing_criteria ต้อง grounded จาก current_solutions/known_objections ที่ user ให้ (ไม่ใช่ generic)
⚠️ deep_research_insights.key_insights 2-3 ข้อ
⚠️ next_steps 1-2 ข้อ`,
  }),
  parseOutput: (raw) => raw,
};

/**
 * Value Proposition Canvas (VPC) Generator
 * Framework: Osterwalder + Pigneur (2014) — Value Proposition Design
 * Bridges JTBD → VPC → BMC
 */
export const valuePropositionCanvasPrompt: PromptTemplate = {
  step: 0,
  name: 'Value Proposition Canvas',
  buildPrompt: (input) => ({
    system: `คุณคือ Value Proposition Designer ที่เชี่ยวชาญการออกแบบ Value Proposition
ใช้ Value Proposition Canvas (Osterwalder + Pigneur, 2014) — หนังสือ "Value Proposition Design"

หลักการ:
- **2 ฝั่ง:** Customer Profile (Jobs + Pains + Gains) ↔ Value Map (Products/Services + Pain Relievers + Gain Creators)
- **"FIT"** = top pains ถูก relievers + top gains ถูก creators
- **3 Types of Fit (ลำดับ):** Problem-Solution Fit → Product-Market Fit → Business Model Fit
- VPC นี้ focus Problem-Solution Fit
- Pain Taxonomy: Undesired outcomes / Obstacles / Risks
- Gain Taxonomy: Required → Expected → Desired → Unexpected (delighters)
- Pain Reliever Patterns: saves time/money, feel better, fix solution, reduce difficulty, social acceptance, eliminate risk, peace of mind, prevent mistakes, lower barrier
- Gain Creator Patterns: create savings, functional utility, social gain, positive emotions, cost reduction

⚠️ ตอบ JSON เท่านั้น ห้ามมี markdown
⚠️ ใช้ภาษาไทย ป.6 อ่านเข้าใจ
⚠️ grounded ในบริบทที่ user ให้ ไม่ใช่ทฤษฎีลอย ๆ
⚠️ ranked — pain/gain ต้องมี intensity/relevance + frequency
⚠️ fit analysis ต้องชัด: matched + uncovered + orphans`,
    user: `# ธุรกิจ
- ชื่อ: ${input.business_name}
- ประเภท: ${input.business_type}
- อุตสาหกรรม: ${input.industry}
- ที่ตั้ง: ${input.location || 'ไม่ระบุ'}
- กลุ่มเป้าหมาย: ${input.target_audience || 'ลูกค้าทั่วไป'}
- จุดต่าง: ${input.differentiation || 'ยังไม่ระบุ'}
- ช่วงราคา: ${input.price_range || 'ยังไม่ระบุ'}

# Customer Profile Context
- อายุลูกค้า: ${input.customer_age || 'ไม่ระบุ'}
- อาชีพ: ${input.customer_job || 'ไม่ระบุ'}
- รายได้: ${input.customer_income || 'ไม่ระบุ'}

# Product / Service (สำหรับ Value Map)
${input.product_description}

${input.product_features ? `# Features / จุดเด่น
${input.product_features}` : ''}

# Customer Context (สำหรับ Customer Profile)
- Main Problem: ${input.main_problem || 'ไม่ระบุ — ให้ AI วิเคราะห์จากบริบท'}
- Current Solutions: ${input.current_solutions || 'ไม่ระบุ'}
- Desired Outcome: ${input.desired_outcome || 'ไม่ระระบุ'}

${input.jtbd_context ? `# JTBD Context (จาก JTBD Generator ที่รันก่อน)
${input.jtbd_context}` : ''}

# Situation (S)
${input.business_name} เป็นธุรกิจ${input.business_type} ในอุตสาหกรรม${input.industry} ${input.location ? 'ที่ ' + input.location : ''}
Product/Service: ${input.product_description}

# Persona (P)
สวมบทบาทเป็น Value Proposition Designer + Business Strategist ที่มีประสบการณ์ 15 ปี
อ้างอิง: Alexander Osterwalder + Yves Pigneur (Strategyzer)

# Instruction (I)
ออกแบบ Value Proposition Canvas ครบทั้ง 2 ฝั่ง + Fit Analysis:
1. **Customer Profile** — Jobs (3-5) + Pains (3-5 ranked) + Gains (3-5 ranked)
2. **Value Map** — Products/Services (3-5) + Pain Relievers (3-5) + Gain Creators (3-5)
3. **Fit Analysis** — matched + uncovered + orphans
4. **Value Proposition Statement** — 1 ประโยคที่กระชับ

# Criteria (C)
- Pain ต้อง rank ตาม intensity (extreme/high/medium/low) + frequency
- Gain ต้อง rank ตาม relevance (essential/high/medium/low) + category (required/expected/desired/unexpected)
- Pain Reliever ต้องอ้างอิง pattern (saves_time/feel_better/...) และ addresses_pain ที่ชัดเจน
- Gain Creator ต้องอ้างอิง pattern และ addresses_gain ที่ชัดเจน
- Fit analysis ต้อง match ทุก pain ที่ intensity >= medium และทุก gain ที่ relevance >= high
- Uncovered = pain/gain ที่ยังไม่มี reliever/creator
- Orphans = reliever/creator ที่ไม่ตรงกับ pain/gain ใดๆ (over-engineering)

# Example (E)
- Pain: "กินขนมแล้วรู้สึกผิดเพราะน้ำตาลสูง" [intensity=high, frequency=often, category=undesired_outcome]
- Pain Reliever: "ใช้หญ้าหวานแทนน้ำตาล แคลอรี่ 0" [pattern=fix_solution, addresses_pain=above, strength=strong]
- Gain: "กินขนมแล้วรู้สึกดี ไม่ผิด" [category=desired, relevance=high]
- Gain Creator: "สูตร low-sugar ที่อร่อยเหมือนขนมปกติ" [pattern=exceed_expectations, addresses_gain=above, strength=strong]

${input.user_notes ? `# โน้ตเพิ่มเติม
${input.user_notes}
` : ''}${input.uploaded_files?.length ? `# ไฟล์ที่อัปโหลด
${input.uploaded_files.map((f: any) => `- ${f.name} (${f.mime || 'unknown'})`).join('\n')}
` : ''}
# Output JSON Schema
{
  "summary": "ภาพรวม VPC 1-2 ประโยค",
  
  "customer_segment": {
    "name": "ชื่อ customer segment",
    "description": "กลุ่มเป้าหมายนี้คือใคร (1-2 ประโยค)"
  },
  
  "customer_profile": {
    "jobs": [
      {
        "job": "...",
        "type": "functional | social | emotional",
        "importance": "essential | important | nice_to_have",
        "context": "งานนี้เกิดในสถานการณ์ไหน"
      }
    ],
    "pains": [
      {
        "pain": "...",
        "category": "undesired_outcome | obstacle | risk",
        "intensity": "extreme | high | medium | low",
        "frequency": "constant | often | sometimes | rare"
      }
    ],
    "gains": [
      {
        "gain": "...",
        "category": "required | expected | desired | unexpected",
        "relevance": "essential | high | medium | low"
      }
    ]
  },
  
  "value_map": {
    "products_services": [
      {
        "name": "...",
        "type": "physical | intangible | digital | service",
        "description": "อธิบายสั้น ๆ"
      }
    ],
    "pain_relievers": [
      {
        "reliever": "วิธีที่เราแก้ pain นี้",
        "addresses_pain": "อ้างอิง pain ที่แก้",
        "pattern": "saves_time | saves_money | feel_better | fix_solution | reduce_difficulty | social_acceptance | eliminate_risk | peace_of_mind | prevent_mistakes | lower_barrier",
        "intensity": "strong | medium | weak"
      }
    ],
    "gain_creators": [
      {
        "creator": "วิธีที่เราสร้าง gain นี้",
        "addresses_gain": "อ้างอิง gain ที่ตอบ",
        "pattern": "save_money | save_time | improve_quality | exceed_expectations | social_gain | reduce_risk | emotional_boost | simplify",
        "strength": "strong | medium | weak"
      }
    ]
  },
  
  "fit_analysis": {
    "overall_fit_score": 1-10,
    "fit_verdict": "Strong Fit | Partial Fit | Weak Fit | No Fit",
    "matched_pains": [
      {"pain": "...", "reliever": "...", "strength": "strong | medium | weak"}
    ],
    "matched_gains": [
      {"gain": "...", "creator": "...", "strength": "strong | medium | weak"}
    ],
    "uncovered_pains": [
      {"pain": "...", "intensity": "...", "recommendation": "ต้องทำอะไรเพิ่มเพื่อ cover pain นี้"}
    ],
    "uncovered_gains": [
      {"gain": "...", "relevance": "...", "recommendation": "..."}
    ],
    "orphans": [
      "Pain reliever ที่ไม่ตรงกับ pain ใด ๆ (over-engineering)",
      "Gain creator ที่ไม่ตรงกับ gain ใด ๆ (vanity feature)"
    ]
  },
  
  "value_proposition_statement": "เราช่วย [customer segment] ที่ต้องการ [top jobs] โดย [products/services] ที่ [pain relievers + gain creators] — ไม่เหมือน [alternatives/competitors] เพราะ [unique advantage]",

  "elevator_pitch": "30 วินาที version",

  "messaging_hierarchy": {
    "primary_message": "ข้อความหลัก 1 ข้อความ — ใช้เป็น headline โฆษณา/หน้าแรกเว็บ",
    "supporting_messages": ["ข้อความรอง 2-3 ข้อ ขยายความ primary message"],
    "proof_points": ["หลักฐาน/เหตุผลที่ทำให้เชื่อ 2-3 ข้อ"]
  },

  "application_guide": {
    "ad_headlines": ["ตัวอย่าง headline โฆษณา 2-3 อัน ที่เอา VP ไปใช้ได้ทันที"],
    "landing_page_copy": "ตัวอย่างข้อความหน้า landing page สั้นๆ 2-3 ประโยค",
    "sales_talking_points": ["ประเด็นที่ทีมขายใช้พูดกับลูกค้า 2-3 ข้อ"]
  },

  "what_most_brands_get_wrong": "...",
  
  "validation_methods": [
    "Show VPC to 5 customers — do they resonate?",
    "Survey on pain intensity + gain relevance",
    "A/B test messaging based on top pain"
  ],
  
  "next_steps": [
    "→ Business Model Canvas: ออกแบบ 9 building blocks โดยใช้ VPC นี้เป็นแกน",
    "→ Customer interview: validate top 3 pains + top 3 gains (5-10 คน)",
    "→ A/B test messaging: ทดสอบ value proposition statement"
  ],
  
  "reasoning": "เหตุผลเชิงกลยุทธ์ 1-2 ประโยค"
}

⚠️ ตอบ JSON เท่านั้น — กระชับ ไม่ต้องยาว
⚠️ customer_profile.jobs/pains/gains 3-5 ข้อ พร้อม rank
⚠️ value_map.pain_relievers/gain_creators 3-5 ข้อ พร้อม pattern + addresses
⚠️ fit_analysis ต้องครบ: overall_score, verdict, matched_pains, matched_gains, uncovered_pains, uncovered_gains, orphans
⚠️ next_steps 1-2 ข้อ
⚠️ value_proposition_statement 1 ประโยคเดียว — clear + concrete
⚠️ ถ้าข้อมูลลูกค้าที่ user ให้ดูเหมือนมีหลาย segment ปนกัน (เช่น "ลูกค้าองค์กร + ลูกค้ารายบุคคล") ให้เลือกโฟกัส segment เดียวที่ตรงกับ context ส่วนใหญ่ และระบุใน customer_segment.description ว่าเลือกโฟกัส segment ไหนและทำไม`,
  }),
  parseOutput: (raw) => raw,
};

/**
 * Business Model Canvas (BMC) Generator
 * Framework: Alexander Osterwalder + Yves Pigneur (2010) — Business Model Generation
 * Final piece of strategic chain: JTBD → VPC → BMC
 *
 * 9 Building Blocks across 3 areas:
 * - Desirability: Customer Segments + Value Propositions
 * - Feasibility: Channels + Customer Relationships + Key Activities + Key Resources + Key Partnerships
 * - Viability: Revenue Streams + Cost Structure
 */
export const bmcGeneratorPrompt: PromptTemplate = {
  step: 0,
  name: 'Business Model Canvas',
  buildPrompt: (input) => ({
    system: `คุณคือ Business Model Strategist ที่เชี่ยวชาญการออกแบบ Business Model
ใช้ Business Model Canvas (Osterwalder + Pigneur, 2010) — หนังสือ "Business Model Generation"

หลักการ:
- **9 Building Blocks** แบ่งเป็น 3 areas:
  • **Desirability** (ลูกค้าอยากได้ไหม): Customer Segments + Value Propositions
  • **Feasibility** (ทำได้จริงไหม): Channels + Customer Relationships + Key Activities + Key Resources + Key Partnerships
  • **Viability** (ทำเงินได้ไหม): Revenue Streams + Cost Structure
- **แนะนำลำดับการออกแบบ:** CS → VP → Channels → CR → Revenue → KR → KA → KP → Cost
- **VPC = "plug-in zoom" ของ CS + VP blocks** — ถ้ามี VPC context ให้ใช้เป็นแกน
- **9 blocks ต้องเชื่อมกันเป็นระบบเดียว ไม่ใช่ 9 list แยกกัน** — Revenue Streams ต้องระบุว่ามาจาก segment ไหน, Key Resources/Activities/Partnerships ต้องสนับสนุน Value Proposition ไหน (ไม่ใช่ list ลอย ๆ ที่ไม่รู้ว่าเกี่ยวกับอะไร)
- **Business Model Patterns:** Long Tail, Multi-sided Platform, Free, Open, Freemium, Subscription, Razor & Blade, etc.
- **Key Assumption Test:** ทุก business model มี 2-3 สมมติฐานสำคัญที่ต้อง validate
- **3 Types of Fit:** Problem-Solution (VPC) → Product-Market → Business Model (BMC นี้)
- **Cost vs Value Driven:** Cost-driven (focus ลดต้นทุน) vs Value-driven (focus premium)

⚠️ ตอบ JSON เท่านั้น ห้ามมี markdown
⚠️ ใช้ภาษาไทย ป.6 อ่านเข้าใจ
⚠️ grounded ในบริบทที่ user ให้ ไม่ใช่ทฤษฎีลอย ๆ
⚠️ concise — แต่ละ field ≤ 80 ตัวอักษร ยกเว้น arrays
⚠️ arrays: 3-5 ข้อ (ถ้าไม่จำเป็นต้องเยอะ)
⚠️ importance ranking: critical/important/supporting
⚠️ realistic — ไม่ over-engineering ไม่ underestimate`,
    user: `# ธุรกิจ
- ชื่อ: ${input.business_name}
- ประเภท: ${input.business_type}
- อุตสาหกรรม: ${input.industry}
- ที่ตั้ง: ${input.location || 'ไม่ระบุ'}
- กลุ่มเป้าหมาย: ${input.target_audience || 'ลูกค้าทั่วไป'}
- จุดต่าง: ${input.differentiation || 'ยังไม่ระบุ'}
- ช่วงราคา: ${input.price_range || 'ยังไม่ระบุ'}

# Product / Service
${input.product_description}

${input.product_features ? `# Features
${input.product_features}` : ''}

# Business Context
- Revenue Model: ${input.revenue_model || 'ไม่ระบุ (ให้ AI วิเคราะห์จากบริบท)'}
- Geographic Scope: ${input.geographic_scope || 'ไม่ระบุ'}
- Distribution Model: ${input.distribution_model || 'ไม่ระบุ'}
- Current Stage: ${input.current_stage || 'ไม่ระบุ'}

# Financial Focus
${input.cost_focus ? `- ลงทุนหนักที่สุดเรื่อง: ${input.cost_focus}` : ''}
${input.revenue_target ? `- เป้ารายได้: ${input.revenue_target}` : ''}
${input.team_size ? `- ทีมงาน: ${input.team_size}` : ''}

${input.vpc_context ? `# VPC Context (จาก Value Proposition Canvas)
${input.vpc_context}` : ''}

${input.jtbd_context ? `# JTBD Context (จาก JTBD Generator)
${input.jtbd_context}` : ''}

${input.competitor_context ? `# Competitor Context (จาก Competitor Analysis)
${input.competitor_context}` : ''}

# Situation (S)
${input.business_name} เป็นธุรกิจ${input.business_type} ในอุตสาหกรรม${input.industry} ${input.location ? 'ที่ ' + input.location : ''}
Product: ${input.product_description}

# Persona (P)
สวมบทบาทเป็น Business Model Strategist + Entrepreneur-in-Residence
อ้างอิง: Alexander Osterwalder + Yves Pigneur (Strategyzer), Ash Maurya (Lean Canvas), Steve Blank

# Instruction (I)
ออกแบบ Business Model Canvas ครบ 9 Building Blocks + Business Model Pattern + Key Assumptions + SWOT:
1. **Customer Segments (CS)** — 3-5 segments (primary + secondary)
2. **Value Propositions (VP)** — 3-5 ที่ตรงกับแต่ละ segment
3. **Channels (CH)** — 5 phases (awareness/evaluation/purchase/delivery/after-sales) 3-5 channels
4. **Customer Relationships (CR)** — 3-5 types per segment
5. **Revenue Streams (R$)** — 3-5 streams with pricing
6. **Key Resources (KR)** — 3-5 critical resources
7. **Key Activities (KA)** — 3-5 activities
8. **Key Partnerships (KP)** — 3-5 partnerships
9. **Cost Structure (C$)** — major costs + model
10. **Business Model Pattern** — identify pattern
11. **SWOT Summary** — 2-3 items per quadrant
12. **Key Assumptions** — 3-5 ที่ต้อง validate
13. **Next Steps** — 1-2 actions

# Criteria (C)
- แต่ละ block ต้อง realistic กับ context (อุตสาหกรรม, scale, revenue model)
- ไม่ over-engineering (3-5 items/block พอ ไม่ใช่ 10)
- importance: critical (ถ้าขาด = business ตาย) / important (ส่งผลมาก) / supporting (ดีมี)
- Revenue Streams ต้อง realistic pricing (ไม่ใช่ "ตั้งราคาสูง")
- Cost Structure ต้อง balance กับ Revenue (ถ้า revenue ต่ำ cost ก็ต้องต่ำ)
- Key Assumptions ต้อง testable (มีวิธี validate)
- Business Model Pattern ต้อง identify ได้จริง (เช่น Franchise, Subscription, Marketplace)

# Example (E)
- Customer Segments: "คนใต้ในกรุงเทพ 28-50 ปี ทำงานออฟฟิศ รายได้ 25-80k" [priority=primary]
- Value Proposition: "ขนมใต้แท้รสชาติบ้านเกิด ในบรรจุภัณฑ์ premium ส่งตรงถึงบ้าน" [for_segment=primary]
- Channel: "Facebook/Instagram ads → landing page → LINE OA" [phase=awareness, type=owned]
- Revenue: "ขายปลีกชิ้นละ 50-200 บาท + กล่องของขวัญ 500-1500 บาท" [type=asset_usage, pricing=fixed]
- Cost: "วัตถุดิบ 35% + ค่าเช่าหน้าร้าน 15% + ค่าขนส่ง 8% + การตลาด 12% + เงินเดือน 25% + overhead 5%" [model=value-driven]
- Business Model Pattern: "Multi-channel Retail (offline + online)"

${input.user_notes ? `# โน้ตเพิ่มเติม
${input.user_notes}
` : ''}${input.uploaded_files?.length ? `# ไฟล์ที่อัปโหลด
${input.uploaded_files.map((f: any) => `- ${f.name} (${f.mime || 'unknown'})`).join('\n')}
` : ''}
# Output JSON Schema
{
  "summary": "ภาพรวม Business Model 2-3 ประโยค",
  "executive_insight": "Insight เชิงกลยุทธ์ 1 ประโยค (เช่น โมเดลนี้ make sense เพราะ...)",
  "model_coherence": "1-2 ประโยคที่เล่าว่า segment หลัก → VP → revenue stream → resource/activity ที่ต้องมี เชื่อมกันเป็นเหตุเป็นผลยังไง (ไม่ใช่แค่สรุป แต่โชว์ logic chain)",

  "customer_segments": [
    {
      "name": "ชื่อ segment (เช่น คนใต้ในกรุงเทพ)",
      "description": "กลุ่มนี้คือใคร 1 ประโยค",
      "priority": "primary | secondary | tertiary",
      "size_estimate": "small | medium | large",
      "key_characteristic": "ลักษณะสำคัญ 1 ข้อ"
    }
  ],
  
  "value_propositions": [
    {
      "vp_title": "ชื่อ VP สั้น ๆ",
      "for_segment": "ตรงกับ segment ไหน",
      "vp_statement": "เราช่วย [X] ทำ [Y] ได้ [Z]",
      "problem_solved": "ปัญหาที่แก้",
      "key_benefit": "ประโยชน์หลัก",
      "differentiator": "ต่างจากคู่แข่งยังไง"
    }
  ],
  
  "channels": [
    {
      "phase": "awareness | evaluation | purchase | delivery | after-sales",
      "channel_name": "ชื่อช่องทาง (เช่น Instagram ads, หน้าร้าน, LINE OA)",
      "type": "owned | partner | free",
      "effectiveness": "high | medium | low",
      "notes": "รายละเอียดสั้น ๆ"
    }
  ],
  
  "customer_relationships": [
    {
      "segment": "ตรงกับ segment ไหน",
      "type": "personal | automated | self-service | community | co-creation",
      "motivation": "acquisition | retention | upselling | advocacy",
      "intensity": "high | medium | low",
      "example": "ตัวอย่าง 1 ประโยค"
    }
  ],
  
  "revenue_streams": [
    {
      "type": "asset_usage | usage_fee | subscription | lending | licensing | brokerage | advertising | fixed | dynamic",
      "description": "รายได้ประเภทนี้คืออะไร",
      "for_segment": "มาจาก customer segment ไหน",
      "pricing_model": "fixed | dynamic | negotiable",
      "price_range": "ช่วงราคา",
      "estimated_share": "ประมาณ % ของรายได้รวม"
    }
  ],

  "key_resources": [
    {
      "type": "physical | intellectual | human | financial",
      "description": "ทรัพยากรนี้คืออะไร",
      "supports_vp": "สนับสนุน value proposition ไหน (ชื่อ vp_title)",
      "importance": "critical | important | supporting"
    }
  ],

  "key_activities": [
    {
      "type": "production | problem_solving | platform | network",
      "description": "กิจกรรมนี้คืออะไร",
      "supports_vp": "สนับสนุน value proposition ไหน (ชื่อ vp_title)",
      "importance": "critical | important | supporting"
    }
  ],

  "key_partnerships": [
    {
      "type": "strategic_alliance | joint_venture | buyer_supplier | franchise | competitor_coop",
      "partner_type": "ประเภท partner (เช่น supplier, platform, distributor)",
      "motivation": "optimization | risk_reduction | resource_acquisition",
      "supports_vp": "สนับสนุน value proposition ไหน (ชื่อ vp_title)",
      "value_exchange": "เราได้อะไร เขาได้อะไร"
    }
  ],
  
  "cost_structure": {
    "model": "cost-driven | value-driven | hybrid",
    "major_fixed_costs": [
      {"category": "fixed", "description": "ต้นทุนคงที่ 1", "estimated_share": "high | medium | low"}
    ],
    "major_variable_costs": [
      {"category": "variable", "description": "ต้นทุนผันแปร 1", "estimated_share": "high | medium | low"}
    ],
    "economies_of_scale": true | false,
    "economies_of_scope": true | false,
    "estimated_margin_profile": "low (<10%) | medium (10-30%) | high (>30%)"
  },
  
  "business_model_pattern": "identified pattern (เช่น Multi-channel Retail, Subscription Box, Marketplace, Franchise, Razor & Blade)",
  
  "swot_summary": {
    "strengths": ["จุดแข็ง 1", "จุดแข็ง 2"],
    "weaknesses": ["จุดอ่อน 1", "จุดอ่อน 2"],
    "opportunities": ["โอกาส 1", "โอกาส 2"],
    "threats": ["ภัยคุกคาม 1", "ภัยคุกคาม 2"]
  },
  
  "key_assumptions": [
    {
      "assumption": "สมมติฐานสำคัญ (เช่น CAC < 200 บาท, retention > 40% ที่ 6 เดือน)",
      "risk_level": "high | medium | low",
      "how_to_test": "วิธี validate"
    }
  ],
  
  "validation_questions": [
    "คำถามที่ต้องตอบก่อน scale (เช่น unit economics จริงเป็นยังไง?)"
  ],
  
  "next_steps": [
    "→ ทำ Pilot/MVP 30 วัน validate key assumption",
    "→ สร้าง Financial Model: Revenue projection 12 เดือน"
  ],
  
  "reasoning": "เหตุผลเชิงกลยุทธ์ 1-2 ประโยค"
}

⚠️ ตอบ JSON เท่านั้น — กระชับ
⚠️ แต่ละ array 3-5 ข้อ (ไม่มากกว่า)
⚠️ description ≤ 80 ตัวอักษร
⚠️ importance + priority + intensity ต้องใส่ทุกตัว
⚠️ key_assumptions ต้อง testable — มี how_to_test
⚠️ swot 2-3 ข้อต่อ quadrant
⚠️ business_model_pattern 1 คำที่ identify ได้
⚠️ revenue_streams.for_segment ต้องตรงกับชื่อ segment ใน customer_segments จริง เลือกมาแค่ 1 ชื่อเท่านั้น (ห้ามใส่หลายชื่อคั่นด้วยจุลภาค — ถ้ารายได้มาจากหลาย segment ให้เลือก segment หลักที่สุด และไม่ใช่คำใหม่ที่ไม่มีในรายการ)
⚠️ key_resources/key_activities/key_partnerships.supports_vp ต้องตรงกับ vp_title ใน value_propositions จริง`,
  }),
  parseOutput: (raw) => raw,
};

/**
 * Million Dollar Offer Tool
 * Framework: Value Equation + 7 Components + Trim & Stack + MAGIC naming
 * Use case: Engineer a high-value, low-friction offer that customers feel foolish refusing
 *
 * Core concepts (avoiding trademark terms):
 * - Value Equation: Value = (Dream Outcome × Perceived Likelihood) / (Time Delay × Effort & Sacrifice)
 * - 4 Value Levers: maximize top 2 (outcome + likelihood), minimize bottom 2 (time + effort)
 * - Value Stack: Core Offer + Bonuses (each addressing a specific obstacle)
 * - Trim & Stack: cut high-cost-low-value, keep high-value-low-cost
 * - Pricing: 5:1 to 10:1 value-to-price ratio
 * - Guarantee: unconditional / conditional / performance / anti-guarantee (risk reversal)
 * - Scarcity & Urgency: real limits (cohorts, seats, deadlines) + real urgency
 * - MAGIC naming: Magnet + Avatar + Goal + Interval + Container
 */
export const millionDollarOfferPrompt: PromptTemplate = {
  step: 0,
  name: 'Million Dollar Offer',
  buildPrompt: (input) => ({
    system: `คุณคือ Offer Strategist ที่เชี่ยวชาญการออกแบบ Offer ระดับพรีเมียม
ใช้หลักการสร้าง "Unbeatable Offer" — Offer ที่ลูกค้ารู้สึกว่าปฏิเสธไม่ลง

หลักการ:
- **Value Equation (4 levers):** Value = (Dream Outcome × Perceived Likelihood) / (Time Delay × Effort & Sacrifice)
  - เพิ่มตัวเศษ (Dream Outcome + Perceived Likelihood) — ผลลัพธ์ที่ชัด + ความมั่นใจว่าจะสำเร็จ
  - ลดตัวส่วน (Time Delay + Effort) — เวลาน้อย + ความยากน้อย
- **7 Components ของ Offer ที่แพ้ไม่ได้:**
  1. **Dream Outcome** — เป้าหมายที่ลูกค้าฝันถึง (vivid, specific, owned by buyer)
  2. **Value Stack** — Core Offer + Bonuses (แต่ละ bonus แก้ pain/ลด friction 1 ข้อ)
  3. **Trim & Stack** — ตัด high-cost-low-value ออก + เก็บ high-value-low-cost ไว้
  4. **Pricing** — perceived value 5-10x ของราคาจริง (10:1 ถึง 5:1 ratio)
  5. **Guarantee Stack** — ย้าย risk จากลูกค้าไปหาเรา ด้วย guarantee หลัก + guarantee เสริม (stacked) เพื่อทุบ objection คนละมุม (unconditional / conditional / performance / anti-guarantee)
  6. **Scarcity & Urgency** — limit จริง (ที่นั่ง, cohort, deadline) ไม่ใช่หลอก
  7. **Name (MAGIC)** — Magnet + Avatar + Goal + Interval + Container
- **Bonus types:** Effort-reducing / Result-accelerating / Success-boosting / Time-limited / Surprise
- **Delivery Cube:** 1-on-1 / small group / one-to-many × DIY / DWY / DFY × medium × format
- **Trim & Stack matrix:** drop high-cost-low-value + low-cost-low-value, keep high-value-low-cost
- **Anti-pattern ที่ต้องหลีก:** "vague dream outcome", "thin guarantee", "fake scarcity", "no bonuses", "low value-to-price ratio"

⚠️ ตอบ JSON เท่านั้น ห้ามมี markdown
⚠️ ใช้ภาษาไทย ป.6 อ่านเข้าใจ
⚠️ grounded ในบริบทที่ user ให้ ไม่ใช่ทฤษฎีลอย ๆ
⚠️ concise — แต่ละ field ≤ 80 ตัวอักษร ยกเว้น arrays
⚠️ arrays: 3-5 ข้อ (ถ้าไม่จำเป็นต้องเยอะ)
⚠️ realistic pricing — ไม่ over-price ไม่ under-price
⚠️ guarantee ต้อง bold แต่ ethical (ไม่ทำให้เราเจ๊ง)
⚠️ scarcity/urgency ต้อง ethical และจริง (ไม่หลอกลูกค้า)`,
    user: `# ธุรกิจ
- ชื่อ: ${input.business_name}
- ประเภท: ${input.business_type}
- อุตสาหกรรม: ${input.industry}
- ที่ตั้ง: ${input.location || 'ไม่ระบุ'}
- กลุ่มเป้าหมาย: ${input.target_audience || 'ลูกค้าทั่วไป'}
- จุดต่าง: ${input.differentiation || 'ยังไม่ระบุ'}
- ช่วงราคา: ${input.price_range || 'ยังไม่ระบุ'}

# Product / Service (ปัจจุบัน)
${input.product_description}

${input.product_features ? `# Features
${input.product_features}` : ''}

# Offer Context
- Offer Type: ${input.offer_type || 'ไม่ระบุ (ให้ AI วิเคราะห์จากบริบท)'}
- Current Price: ${input.current_price || 'ยังไม่มีราคา'}
- Delivery Method: ${input.delivery_method || 'ไม่ระบุ'}
- Guarantee (ถ้ามี): ${input.current_guarantee || 'ยังไม่มี'}

# Customer Insight
${input.dream_outcome_hint ? `- Dream Outcome (ความฝันลูกค้า): ${input.dream_outcome_hint}` : ''}
${input.biggest_objection ? `- Biggest Objection: ${input.biggest_objection}` : ''}
${input.current_result_time ? `- เวลาเห็นผลปัจจุบัน: ${input.current_result_time}` : ''}

${input.vpc_context ? `# VPC Context (จาก Value Proposition Canvas)
${input.vpc_context}` : ''}

${input.competitor_context ? `# Competitor Context
${input.competitor_context}` : ''}

${input.jtbd_context ? `# JTBD Context
${input.jtbd_context}` : ''}

# Situation (S)
${input.business_name} เป็นธุรกิจ${input.business_type} ในอุตสาหกรรม${input.industry} ${input.location ? 'ที่ ' + input.location : ''}
ต้องการออกแบบ Offer ที่ทำให้ลูกค้ารู้สึก foolish to refuse

# Persona (P)
สวมบทบาทเป็น Offer Strategist + Business Coach ที่มีประสบการณ์ 15 ปี
อ้างอิง: Value Equation framework, Value Stack principles, Risk Reversal science

# Instruction (I)
ออกแบบ Million Dollar Offer ครบ 7 components:
1. **Value Equation Audit** — score 1-10 ทั้ง 4 levers + identify binding constraint
2. **Starving Crowd** — ตลาดที่หิวโหย + มีเงิน
3. **Dream Outcome** — ผลลัพธ์ที่ลูกค้าฝันถึง (vivid + specific)
4. **Obstacles & Solutions** — 3-5 obstacles ที่ลูกค้าเจอ + solution แก้แต่ละข้อ
5. **Value Stack** — Core Offer + 3-5 Bonuses พร้อม value ของแต่ละชิ้น
6. **Pricing** — recommended price + payment options + value-to-price ratio (5:1 ถึง 10:1)
7. **Guarantee Stack** — guarantee หลัก (type + name + terms) + guarantee เสริม 1 ข้อที่ทุบ objection คนละมุม (ถ้าเหมาะสมกับธุรกิจ)
8. **Scarcity & Urgency** — type + details + ethical check
9. **MAGIC Name** — Magnet + Avatar + Goal + Interval + Container
10. **What Makes It Unbeatable** — 1-2 ประโยค
11. **Next Steps** — 1-2 actions

# Criteria (C)
- Value Equation scores realistic (1-10) — ไม่ inflate
- Dream Outcome เป็น "ผลที่ลูกค้าได้" ไม่ใช่ "สิ่งที่เราทำ"
- Obstacles เป็น friction จริง ๆ ไม่ใช่ objection ลอย ๆ
- Value Stack: total perceived value 5-10x ของ recommended price
- Bonuses แต่ละตัวแก้ obstacle ที่ระบุชัด
- Pricing: ราคาที่ลูกค้าเป้าหมายจ่ายได้ ไม่ใช่ราคาที่ "อยากขาย"
- Guarantee Stack: guarantee หลัก bold แต่ไม่ทำให้เจ๊ง + guarantee เสริม (ถ้ามี) ต้องคนละมุมกับตัวหลัก (เช่น หลัก=ผลลัพธ์, เสริม=ความเร็ว/บริการ) ไม่ใช่พูดซ้ำเรื่องเดิม
- Scarcity/Urgency: ethical + real (ไม่ fake countdown)
- MAGIC Name: catchy + memorable + บอก avatar + outcome

# Example (E)
- Dream Outcome: "ได้กินขนมใต้แท้รสชาติเหมือนอยู่บ้าน ในกล่อง premium ส่งตรงถึงคอนโด ใน 24 ชม."
- Obstacle: "กลัวขนมไม่สด", Solution: "ส่งฟรี ภายใน 24 ชม. จากโรงงาน" (delivery cube: DFY + physical)
- Bonus: "คูปองส่วนลด 20% สำหรับซื้อครั้งถัดไป" (addresses obstacle: ไม่อยากลองแล้วแพง)
- Pricing: perceived value 2,000 บาท (core 1,000 + bonuses 1,000) → recommended 499 บาท → ratio 4:1
- Guarantee: "ไม่สด = คืนเงิน 100% ไม่ต้องส่งคืน" (unconditional, removes purchase risk)
- Name (MAGIC): "กล่องขนมใต้ส่งด่วน 24 ชม." (Magnet: กล่องขนมใต้, Avatar: คนกรุงเทพ, Goal: ส่งด่วน, Interval: 24 ชม., Container: กล่อง)

${input.user_notes ? `# โน้ตเพิ่มเติม
${input.user_notes}
` : ''}${input.uploaded_files?.length ? `# ไฟล์ที่อัปโหลด
${input.uploaded_files.map((f: any) => `- ${f.name} (${f.mime || 'unknown'})`).join('\n')}
` : ''}
# Output JSON Schema
{
  "summary": "ภาพรวม Offer 2-3 ประโยค",
  
  "value_equation_audit": {
    "dream_outcome": {"score": 1-10, "current_state": "...", "improvement": "..."},
    "perceived_likelihood": {"score": 1-10, "current_state": "...", "improvement": "..."},
    "time_delay": {"score": 1-10, "current_state": "...", "improvement": "..."},
    "effort_sacrifice": {"score": 1-10, "current_state": "...", "improvement": "..."},
    "binding_constraint": "ตัวที่ score ต่ำสุด + ทำให้ value ต่ำ",
    "total_value_score": 1-10
  },
  
  "starving_crowd": {
    "who": "ใครคือตลาดที่หิวโหย + มีเงิน",
    "pain_level": 1-10,
    "purchasing_power": 1-10,
    "targetability": 1-10,
    "growth_potential": 1-10,
    "why_starving": "เหตุผลที่ตลาดนี้พร้อมจ่าย"
  },
  
  "dream_outcome": {
    "specific_description": "ผลลัพธ์ที่ชัดเจน (1 ประโยค)",
    "by_when": "ภายในกี่วัน/สัปดาห์/เดือน",
    "sensory_detail": "ลูกค้าจะรู้สึก/เห็น/ได้ยินอะไร (1-2 ประโยค)",
    "owns": "ใครเป็นเจ้าของผลลัพธ์นี้ (ลูกค้า ไม่ใช่เรา)"
  },
  
  "obstacles_and_solutions": [
    {
      "obstacle": "สิ่งที่ขัดขวางลูกค้า (1 ประโยค)",
      "value_lever": "dream_outcome | likelihood | time | effort",
      "solution": "วิธีแก้ (1 ประโยค)",
      "delivery_vehicle": "1on1 | small_group | ondemand | dfy | diy | dwy | digital | physical",
      "perceived_value": "฿XXXX"
    }
  ],
  
  "value_stack": [
    {
      "name": "ชื่อ component (มี benefit ในชื่อ)",
      "description": "อธิบายสั้น ๆ",
      "perceived_value": "฿XXXX",
      "cost_to_deliver": "high | medium | low",
      "addresses_obstacle": "obstacle ไหนที่แก้",
      "is_core": true | false
    }
  ],
  
  "trim_stack_summary": {
    "dropped_high_cost_low_value": ["..."],
    "kept_high_value_low_cost": ["..."],
    "total_perceived_value": "฿XXXX"
  },
  
  "pricing": {
    "recommended_price": "฿XXXX",
    "value_to_price_ratio": "X:1",
    "anchor_price": "฿XXXX (ถ้ามี - ราคาที่เคยขายหรือราคาเปรียบเทียบ)",
    "payment_options": [
      {"structure": "1-time | 2-pay | 3-pay | 6-pay | 12-pay", "amount": "฿XXXX", "monthly_equivalent": "฿XXXX"}
    ],
    "pricing_rationale": "เหตุผลที่ราคานี้ make sense"
  },
  
  "guarantee": {
    "type": "unconditional | conditional | performance | anti_guarantee",
    "name": "ชื่อ Guarantee (catchy)",
    "terms": "เงื่อนไข 1-2 ประโยค",
    "duration": "กี่วัน/เดือน",
    "risk_to_us": "ความเสี่ยงที่เรารับ",
    "why_it_works": "ทำไม guarantee นี้ถึงลด perceived risk"
  },

  "secondary_guarantee": {
    "applicable": true | false,
    "type": "unconditional | conditional | performance | anti_guarantee",
    "name": "ชื่อ guarantee เสริม (catchy)",
    "terms": "เงื่อนไข 1 ประโยค — ต้องคนละมุมกับ guarantee หลัก",
    "why_it_stacks": "ทำไม guarantee นี้เสริม (ไม่ซ้ำ) กับตัวหลัก"
  },

  "scarcity_urgency": {
    "scarcity_type": "cohort | seats | deadline | seasonal | bonus_limited | none",
    "scarcity_details": "รายละเอียด (1-2 ประโยค)",
    "urgency_type": "rolling | seasonal | promotional | exploding | none",
    "urgency_details": "รายละเอียด (1-2 ประโยค)",
    "is_ethical": true | false,
    "ethical_note": "ทำไม scarcity/urgency นี้จริง"
  },
  
  "offer_name": {
    "magnet": "คำดึงดูด (e.g., กล่อง, โปรแกรม, ระบบ)",
    "avatar": "กลุ่มเป้าหมาย",
    "goal": "ผลลัพธ์ที่ลูกค้าได้",
    "interval": "ระยะเวลา (e.g., 24 ชม., 7 วัน, 90 วัน)",
    "container": "รูปแบบ (e.g., bootcamp, sprint, workshop, system)",
    "full_name": "ชื่อ Offer เต็ม (รวม MAGIC 5 elements)",
    "alternatives": ["ชื่อทางเลือก 1", "ชื่อทางเลือก 2"]
  },
  
  "what_makes_it_unbeatable": "1-2 ประโยค ทำไม offer นี้ลูกค้าปฏิเสธไม่ลง",
  
  "next_steps": [
    "→ ...",
    "→ ..."
  ],
  
  "reasoning": "เหตุผลเชิงกลยุทธ์ 1-2 ประโยค"
}

⚠️ ตอบ JSON เท่านั้น — กระชับ
⚠️ value_equation_audit scores 1-10 ต้อง realistic (1-3 = ต่ำ, 4-6 = กลาง, 7-10 = สูง)
⚠️ dream_outcome.specific_description 1 ประโยคที่ชัดเจน
⚠️ obstacles_and_solutions 3-5 ข้อ พร้อม value_lever
⚠️ value_stack 3-5 ข้อ (1 core + 2-4 bonuses) พร้อม perceived_value
⚠️ value-to-price ratio ต้องอยู่ในช่วง 5:1 ถึง 10:1 (ตาม Value Equation ที่อ้างถึงข้างต้น — ห้ามต่ำกว่า 5:1)
⚠️ guarantee name + terms 1-2 ประโยค
⚠️ secondary_guarantee.applicable = false ถ้าธุรกิจไม่เหมาะกับ guarantee ซ้อน (อย่าฝืนใส่ guarantee ปลอม ๆ)
⚠️ offer_name.full_name ใช้ MAGIC 5 elements
⚠️ what_makes_it_unbeatable 1-2 ประโยค`,
  }),
  parseOutput: (raw) => raw,
};

/**
 * Objection Handler Tool
 * Framework: 7 Objection Categories + LAER Framework (Listen-Acknowledge-Explore-Respond) + Reframing
 * For sales conversations, landing pages, and customer support
 */
export const objectionHandlerPrompt: PromptTemplate = {
  step: 0,
  name: 'Objection Handler',
  buildPrompt: (input) => ({
    system: `คุณคือ Sales Objection Specialist ที่เชี่ยวชาญการจัดการข้อโต้แย้งของลูกค้า
ใช้หลักการ Objection Handling สำหรับธุรกิจไทย

หลักการ:
- **7 Objection Categories ที่ต้อง cover:**
  1. **Price** (แพงไป / ไม่มีงบ / มีที่ถูกกว่า)
  2. **Trust** (ไม่เคยใช้ / กลัวโกง / ไม่มีรีวิว)
  3. **Need** (ไม่จำเป็น / มีอยู่แล้ว / ใช้ของเก่า)
  4. **Time** (ไม่มีเวลา / ยุ่งอยู่ / ไว้ก่อน)
  5. **Authority** (ต้องถามหัวหน้า / ต้องปรึกษาเมีย / ต้องขออนุมัติ)
  6. **Comparison** (เทียบกับคู่แข่ง / เห็น X ทำแบบนี้ดีกว่า)
  7. **Risk Aversion** (กลัวล้มเหลว / กลัวเสียเงิน / กลัวเสียเวลา)
- **LAER Framework** (Listen-Acknowledge-Explore-Respond):
  - L: Listen — รับฟังจบก่อน อย่าโต้
  - A: Acknowledge — ยอมรับว่าข้อกังวลสมเหตุสมผล
  - E: Explore — ถามเจาะลึกเพื่อเข้าใจ root cause
  - R: Respond — ตอบด้วยหลักฐาน/เปลี่ยนมุมมอง/เสนอทางเลือก
- **Reframing Strategies:**
  - Reframe to Value (ราคา vs คุณค่า)
  - Reframe to Cost of Inaction (ไม่ทำ = เสียมากกว่า)
  - Reframe to Comparison (เทียบกับทางเลือกอื่น)
  - Reframe to Risk Reversal (guarantee ลดความเสี่ยง)
  - Reframe to Identity (คนแบบไหนใช้สินค้านี้)
  - Reframe to Time (เวลา = เงิน)
- **Bridge to Close:** หลังจัดการ objection แล้ว ต้อง bridge ไปขั้นต่อไป (ไม่ใช่จบแค่นั้น)
- **Empathy First:** ทุก response ต้องเริ่มด้วยการยอมรับ + ความเข้าใจ ไม่ใช่โต้ทันที
- **Evidence-based:** ตอบด้วยตัวเลข รีวิว case study ไม่ใช่แค่ "ดีจริง"

⚠️ ตอบ JSON เท่านั้น ห้ามมี markdown
⚠️ ใช้ภาษาไทย ป.6 อ่านเข้าใจ
⚠️ grounded ในบริบทธุรกิจจริง ไม่ใช่ generic
⚠️ concise — แต่ละ field ≤ 80 ตัวอักษร ยกเว้น response_script ≤ 150 ตัวอักษร
⚠️ objections 5-8 ข้อ ครอบคลุมหลาย category
⚠️ response_script เป็นบทพูดจริง ไม่ใช่คำแนะนำ
⚠️ empathy + reframe + evidence ในทุก response`,
    user: `# ธุรกิจ
- ชื่อ: ${input.business_name}
- ประเภท: ${input.business_type}
- อุตสาหกรรม: ${input.industry}
- ที่ตั้ง: ${input.location || 'ไม่ระบุ'}
- กลุ่มเป้าหมาย: ${input.target_audience || 'ลูกค้าทั่วไป'}
- จุดต่าง: ${input.differentiation || 'ยังไม่ระบุ'}
- ช่วงราคา: ${input.price_range || 'ยังไม่ระบุ'}

# Product / Service
${input.product_description}

${input.product_features ? `# Features
${input.product_features}` : ''}

# Sales Context
- Sales Channel: ${input.sales_channel || 'ไม่ระบุ (DM, โทร, หน้าร้าน, เว็บ)'}
- Top Objection (ถ้ามี): ${input.known_objection || 'ไม่ระบุ'}
- Price Position: ${input.price_position || 'ไม่ระบุ (premium/mid/budget)'}

${input.offer_context ? `# Offer Context (จาก Million Dollar Offer)
${input.offer_context}` : ''}

${input.competitor_context ? `# Competitor Context
${input.competitor_context}` : ''}

${input.persona_context ? `# Persona Context
${input.persona_context}` : ''}

# Situation (S)
${input.business_name} เป็นธุรกิจ${input.business_type} ในอุตสาหกรรม${input.industry}
Product: ${input.product_description}
ลูกค้า: ${input.target_audience}

# Persona (P)
สวมบทบาทเป็น Sales Objection Specialist + Customer Success Lead
อ้างอิง: 7 Objection Categories, LAER framework, Reframing techniques

# Instruction (I)
สร้าง Objection Handler Playbook ครบ:
1. **Summary** — ภาพรวม 1-2 ประโยค
2. **Objections (5-8 ข้อ)** — แต่ละข้อมี:
   - objection (สิ่งที่ลูกค้าพูด)
   - category (price/trust/need/time/authority/comparison/risk)
   - what_customer_says (ประโยคตรงๆ)
   - why_they_say_it (root cause analysis)
   - reframe_strategy (เทคนิคที่ใช้)
   - response_script (บทพูดตอบจริง 2-3 ประโยค)
   - evidence_to_provide (ตัวเลข/รีวิว/case study)
   - bridge_to_close (transition ไปขั้นต่อไป)
3. **Common Patterns** — 2-3 patterns ที่เจอบ่อย
4. **Do / Don't** — 3-4 ข้อแต่ละฝั่ง
5. **FAQ Top 5** — คำถามจริง + คำตอบ
6. **Next Steps** — 1-2 actions

# Criteria (C)
- Objections realistic — เป็นสิ่งที่ลูกค้า${input.target_audience || 'target นี้'}จะพูดจริง
- Response scripts เป็นบทพูดธรรมชาติ (ไม่ฟังดูเป็น sales pitch)
- Empathy first ในทุก response (ไม่โต้ทันที)
- Evidence-based (ตัวเลข, รีวิว, case study)
- Bridge to close ที่ smooth (ไม่ aggressive)
- ไม่ใช้ manipulative tactics (ไม่กดดัน, ไม่หลอก)
- ครอบคลุม ≥ 4 categories (price, trust, need, time, comparison, etc.)

# Example (E)
- Objection: "แพงไป มีที่อื่นถูกกว่า"
  - Category: price
  - What customer says: "ขนมกล่องละ 500 เอง ที่อื่น 200 ก็มี"
  - Why: เทียบราคาอย่างเดียว ไม่ได้เทียบคุณค่า + ไม่รู้จักความต่าง
  - Reframe: Reframe to Value (ราคา vs คุณค่า)
  - Response: "เข้าใจเลยค่ะ ที่อื่นถูกกว่าก็มีจริง ๆ แต่ที่นี่เราใช้สูตรโบราณจากคุณยาย + ส่งภายใน 24 ชม. + ถ้าไม่สดเปลี่ยนกล่องฟรีทันที ลูกค้าบอกว่าคุ้มกว่าเพราะกินแล้วเหมือนอยู่บ้าน (มีรีวิว 2,000+ คน)"
  - Evidence: "ลูกค้า 80% กลับมาซื้อซ้ำใน 3 เดือน, NPS 9.2/10"
  - Bridge: "ลองสั่งกล่องเล็ก 199 บาท ทดลองก่อนก็ได้นะคะ เห็นความต่างด้วยตัวเอง"

${input.user_notes ? `# โน้ตเพิ่มเติม
${input.user_notes}
` : ''}
# Output JSON Schema
{
  "summary": "ภาพรวม 1-2 ประโยค",
  
  "objection_categories_covered": ["price", "trust", "need", "time", "comparison"],
  
  "objections": [
    {
      "objection": "หัวข้อ objection (1 ประโยค)",
      "category": "price | trust | need | time | authority | comparison | risk",
      "what_customer_says": "ประโยคตรงที่ลูกค้าพูด",
      "why_they_say_it": "root cause analysis",
      "explore_question": "คำถามสำรวจก่อนตอบ (Explore step ของ LAER) — ถามเจาะให้รู้ปัญหาจริงก่อนยิงคำตอบสำเร็จรูป เช่น 'ที่ว่าแพง คือแพงรวมๆ หรือไม่แน่ใจว่าคุ้มไหมคะ?'",
      "reframe_strategy": "เทคนิคที่ใช้ (Reframe to Value / Cost of Inaction / Comparison / Risk Reversal / Identity / Time)",
      "response_script": "บทพูดตอบ 2-3 ประโยค (≤ 150 ตัวอักษร)",
      "evidence_to_provide": ["ตัวเลข/รีวิว/case study 1", "ตัวเลข/รีวิว/case study 2"],
      "bridge_to_close": "ประโยค transition ไปขั้นต่อไป",
      "second_response": "ถ้าลูกค้าโต้กลับอีกรอบหลัง response แรก จะตอบยังไง (บทพูดสั้นๆ) — ถ้าโต้กลับเป็นรอบที่ 2 แล้วยังไม่โอเค ให้ถอยอย่างมีศักดิ์ศรี ไม่ดันต่อ"
    }
  ],
  
  "common_patterns": [
    "Pattern 1 — ลูกค้าจะถาม X ก่อน Y เสมอ"
  ],
  
  "do_dont": {
    "do": ["ทำ 1", "ทำ 2", "ทำ 3"],
    "dont": ["อย่าทำ 1", "อย่าทำ 2", "อย่าทำ 3"]
  },
  
  "faq_top_5": [
    {"q": "คำถาม 1", "a": "คำตอบ 1"}
  ],
  
  "next_steps": [
    "→ ...",
    "→ ..."
  ],
  
  "reasoning": "เหตุผลเชิงกลยุทธ์ 1-2 ประโยค"
}

⚠️ ตอบ JSON เท่านั้น
⚠️ objections 5-8 ข้อ ครอบคลุม ≥ 4 categories
⚠️ response_script 2-3 ประโยค ≤ 150 ตัวอักษร
⚠️ empathy first ในทุก response (เริ่มด้วย "เข้าใจเลย" / "ใช่ค่ะ" ไม่ใช่โต้)
⚠️ evidence ต้องเป็นตัวเลข/รีวิว/case study ที่ grounded
⚠️ bridge_to_close ต้อง smooth (ลองทดลอง / ปรึกษาเพิ่ม / สั่งเล็ก ๆ)
⚠️ do 3-4 ข้อ, dont 3-4 ข้อ
⚠️ faq_top_5: 5 คำถาม
⚠️ กระชับ field เพื่อไม่ให้ output ยาวเกิน — แต่ละ array ใช้แค่จำนวนที่จำเป็น
⚠️ ถ้า objection ชี้จุดอ่อนสินค้าจริง (ไม่ใช่ความเข้าใจผิด) — ห้ามแต่งหลักฐานกดดัน ให้ยอมรับจุดอ่อนตรงๆ ใน response_script แล้วพลิกไปจุดแข็งจริงแทน`,
  }),
  parseOutput: (raw) => raw,
};

/**
 * Hook Library / Headlines Tool
 * Framework: 10 Hook Formulas + Platform-specific adaptation + A/B testing
 * For social media, ads, landing pages, email subjects
 */
export const hookLibraryPrompt: PromptTemplate = {
  step: 0,
  name: 'Hook Library',
  buildPrompt: (input) => ({
    system: `คุณคือ Hook & Headline Specialist ที่เชี่ยวชาญการเขียน Hook ดึงดูดความสนใจ
ใช้หลักการเขียน hook ที่ทำให้คนหยุด scroll และคลิก

หลักการ:
- **10 Hook Formulas:**
  1. **Curiosity** - "สิ่งที่คุณไม่เคยรู้เกี่ยวกับ X..."
  2. **Pain Point** - "เบื่อไหมกับ X? อ่านนี่"
  3. **Story** - "เมื่อวานลูกค้าโทรมาบอกฉันว่า..."
  4. **Stat / Number** - "87% ของ X ทำพลาด..."
  5. **Question** - "คุณรู้ไหมว่าทำไม X ถึง Y?"
  6. **Contrarian** - "อย่าทำ X แบบนี้ (ผิด)"
  7. **Listicle** - "5 วิธีทำ X ให้ Y"
  8. **Pattern Interrupt** - "หยุด! X ไม่ใช่แบบที่คุณคิด"
  9. **Big Promise** - "วิธีทำ X ใน 7 วัน (ไม่เคยเห็นที่ไหนมาก่อน)"
  10. **Identity** - "ถ้าคุณเป็น X คุณต้องอ่านนี่"
- **Platform considerations:**
  - **Facebook:** ยาวได้ 1-2 บรรทัด, ใช้ emotion ได้มาก
  - **Instagram:** สั้น กระชับ, ใช้ emoji ได้, เน้น visual
  - **YouTube:** ความยาวได้เยอะ, ตั้งคำถาม + เปิดเผย promise
  - **TikTok:** สั้นมาก, ตรง + ตลก + pattern interrupt
  - **Email subject:** ≤ 60 ตัวอักษร, urgency + curiosity
  - **Landing page headline:** ≤ 10 คำ, benefit + audience
- **Headline formulas:**
  - How to [achieve result] without [pain]
  - The [adjective] guide to [topic]
  - [Number] [things] that [outcome]
  - Why [audience] are [doing X]
  - [Achieve outcome] in [timeframe]
- **A/B testing:** สร้าง 2-3 variants ต่อ campaign
- **Anti-pattern:** clickbait หลอก, fear mongering, all caps, generic

⚠️ ตอบ JSON เท่านั้น ห้ามมี markdown
⚠️ ใช้ภาษาไทย ป.6 อ่านเข้าใจ
⚠️ grounded ในบริบทธุรกิจจริง ไม่ generic
⚠️ concise — hook 1-2 บรรทัด ไม่เกิน 150 ตัวอักษร
⚠️ แต่ละ category มี 3-5 hook examples
⚠️ platform_specific: 3-4 hooks per platform
⚠️ headlines_5: 5 variants สำหรับ A/B test
⚠️ concrete + specific (ไม่ generic เช่น "ดีที่สุด" โดยไม่มี context)
⚠️ ห้ามแต่งตัวเลข/สถิติ/รายละเอียดที่ไม่มีในข้อมูลจริงเด็ดขาด — ครอบคลุมทั้ง % ลูกค้าพอใจ, ยอดขาย, จำนวนรีวิว และรายละเอียดเชิงปฏิบัติการ เช่น ระยะทาง, เวลาเปิด-ปิดร้าน, นาทีที่ใช้ทำ/คั่ว/ผลิต, จำนวนลูกค้าในเรื่องเล่า — ถ้า input ไม่ได้ระบุตัวเลขเหล่านี้มา ห้ามเดาขึ้นมาเองแม้จะฟังดูสมจริง ให้ใช้คำเชิงคุณภาพแทน (เช่น "สดใหม่ทุกวัน" แทนการระบุเวลาที่แต่งขึ้น) ⚠️ หมวด stat/number: ถ้า input ไม่มีตัวเลขจริงให้ใช้ ให้เปลี่ยนไปใช้มุมที่ไม่ต้องพึ่งตัวเลขแทน (เช่น กระบวนการ/ที่มา/ความแตกต่าง) แต่ยังคงต้องมีครบ 10 categories`,
    user: `# ธุรกิจ
- ชื่อ: ${input.business_name}
- ประเภท: ${input.business_type}
- อุตสาหกรรม: ${input.industry}
- ที่ตั้ง: ${input.location || 'ไม่ระบุ'}
- กลุ่มเป้าหมาย: ${input.target_audience || 'ลูกค้าทั่วไป'}
- จุดต่าง: ${input.differentiation || 'ยังไม่ระบุ'}
- ช่วงราคา: ${input.price_range || 'ยังไม่ระบุ'}

# Product / Service
${input.product_description}

${input.product_features ? `# Features
${input.product_features}` : ''}

# Marketing Context
- Primary Platform: ${input.primary_platform || 'ไม่ระบุ (FB/IG/YT/TikTok/Email/Landing)'}
- Brand Voice: ${input.brand_voice || 'เป็นกันเอง อบอุ่น เข้าถึงง่าย'}
- Campaign Goal: ${input.campaign_goal || 'awareness / engagement / conversion'}
- Top Hook Style: ${input.top_hook_style || 'ไม่ระบุ (curiosity/story/stat/etc.)'}

${input.offer_context ? `# Offer Context (จาก Million Dollar Offer)
${input.offer_context}` : ''}

${input.persona_context ? `# Persona Context
${input.persona_context}` : ''}

# Situation (S)
${input.business_name} ต้องการ Hook Library สำหรับใช้ทำ marketing content
Target: ${input.target_audience}

# Persona (P)
สวมบ�บาทเป็น Senior Copywriter + Content Strategist ที่มีประสบการณ์ 10 ปี
อ้างอิง: Joseph Sugarman, Gary Halbert, Clayton Makepeace, Eugene Schwartz

# Instruction (I)
สร้าง Hook Library ครบ:
1. **Summary** — ภาพรวม 1-2 ประโยค
2. **Brand Voice Summary** — 1 ประโยคสรุปเสียงของแบรนด์
3. **Hook Categories (10 categories)** — แต่ละ category มี 3-5 hook examples
4. **Platform-Specific Hooks** — 3-4 hooks per platform
5. **Headlines 5** — 5 variants สำหรับ A/B test
6. **A/B Testing Tips** — 3-4 เทคนิค
7. **Next Steps** — 1-2 actions

# Criteria (C)
- Hooks concrete + specific (อ้างอิง benefit จริงของธุรกิจ)
- ไม่ clickbait หลอก
- ไม่ all caps หรือ excessive emoji
- เหมาะกับ target audience (${input.target_audience || 'ลูกค้าทั่วไป'})
- Platform-specific: ความยาว + tone เหมาะกับแต่ละแพลตฟอร์ม
- A/B variants: แต่ละ headline ต่างกันชัดเจน (ทดสอบ angle ต่าง ๆ)

# Example (E)
- Hook (Curiosity): "ขนมใต้ 5 อย่างนี้ คนกรุงเทพ 90% ไม่เคยกินของจริง"
- Hook (Story): "เมื่อวานลูกค้ากรุงเทพโทรมาบอกฉันว่า 'กินแล้วร้องไห้เลย เหมือนกลับบ้าน'"
- Hook (Stat): "ขนมใต้ 48 SKU ของเรา ขายดี 5 อันดับแรกคือ 3 อย่างที่คนกรุงเทพไม่เคยรู้จัก"
- Hook (Identity): "ถ้าคุณเป็นคนใต้ที่อยู่กรุงเทพ คุณต้องลองกล่องนี้"
- Hook (Pain): "เบื่อขนมกรุงเทพรสเดิม ๆ ใช่ไหม? ลองของใต้ของจริงสิ"

${input.user_notes ? `# โน้ตเพิ่มเติม
${input.user_notes}
` : ''}
# Output JSON Schema
{
  "summary": "ภาพรวม 1-2 ประโยค",
  "brand_voice_summary": "เสียงของแบรนด์ 1 ประโยค",
  
  "hook_categories": [
    {
      "name": "curiosity | pain | story | stat | question | contrarian | listicle | pattern_interrupt | big_promise | identity",
      "thai_label": "ชื่อภาษาไทย",
      "description": "เมื่อไหร่ใช้ + เหมาะกับอะไร",
      "examples": [
        {
          "hook": "1-2 บรรทัด ไม่เกิน 150 ตัวอักษร",
          "why_works": "ทำไม hook นี้ดึงดูด",
          "best_for": "FB | IG | YT | TikTok | Email | Landing | All",
          "cta": "อ่านต่อ / ดูเลย / สั่งเลย"
        }
      ]
    }
  ],
  
  "platform_specific": {
    "facebook": ["3-4 hook เหมาะกับ FB"],
    "instagram": ["3-4 hook เหมาะกับ IG"],
    "youtube": ["3-4 hook เหมาะกับ YouTube"],
    "tiktok": ["3-4 hook เหมาะกับ TikTok"],
    "email": ["3-4 subject lines"],
    "landing_page": ["3-4 hook เหมาะกับ landing page"]
  },
  
  "headlines_5": [
    "headline 1",
    "headline 2",
    "headline 3",
    "headline 4",
    "headline 5"
  ],

  "recommended_pick": {
    "index": "0-4 — index ของ headline ใน headlines_5 ที่ควรใช้ก่อน",
    "why": "1-2 ประโยค อธิบายว่าทำไม headline นี้ควรใช้ก่อนตัวอื่น",
    "best_platform": "FB | IG | YT | TikTok | Email | Landing"
  },

  "ab_testing_tips": [
    "เทคนิค 1",
    "เทคนิค 2",
    "เทคนิค 3",
    "เทคนิค 4"
  ],
  
  "next_steps": [
    "→ ...",
    "→ ..."
  ],
  
  "reasoning": "1-2 ประโยค"
}

⚠️ ตอบ JSON เท่านั้น — กระชับ
⚠️ hook_categories: 10 categories, แต่ละ category มี 3-5 examples
⚠️ platform_specific: 3-4 hooks per platform (6 platforms)
⚠️ headlines_5: 5 variants สำหรับ A/B test
⚠️ ab_testing_tips: 3-4 เทคนิค
⚠️ hook ≤ 150 ตัวอักษร
⚠️ ไม่ clickbait หลอก, ไม่ all caps
⚠️ concrete + grounded ในธุรกิจจริง`,
  }),
  parseOutput: (raw) => raw,
};
