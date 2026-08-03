/**
 * Presentation Tool — 9 Step Prompt Templates
 * Each step builds on previous steps' outputs.
 * Step 6 has 3 variants (SCQA, 5M, Pop-Up) chosen by objective
 */

import { COMMUNICATION_STYLES, AUDIENCE_CONCERNS, FRAMEWORK_NAMES, frameworkVariantForObjective } from './presentationPresets';

export type PresentationStepInput = Record<string, any>;

export interface PresentationPromptTemplate {
  step: number;
  name: string;
  framework_variant?: 'scqa_minto' | '5m_mission' | 'popup_pitch';
  buildPrompt: (input: PresentationStepInput) => { system: string; user: string };
  parseOutput: (raw: string) => any;
  maxTokens: number;
  creditsRequired: number;
}

// =====================================================
// STEP 1: Quick Brief
// Free config + AI extracts key topics, suggests framework
// =====================================================
export const step1Prompt: PresentationPromptTemplate = {
  step: 1,
  name: 'Quick Brief',
  maxTokens: 4000,
  creditsRequired: 0, // free — no AI
  buildPrompt: (input) => ({
    system: `คุณคือ Presentation Strategist ที่ช่วยร่าง brief ให้ชัดเจนและลงมือได้

⚠️ ตอบ JSON object เดียวเท่านั้น ห้ามมี markdown code fence`,
    user: `# หัวข้อ Presentation
- Title: ${input.title}
- Objective: ${input.objective} (informative/persuasive/story)
- จำนวน slides: ${input.target_slides}
- เวลา: ${input.time_minutes} นาที
- ภาษา: ${input.language || 'th'}

${input.description ? `# คำอธิบายเพิ่มเติม\n${input.description}` : ''}

# Output JSON Schema
{
  "key_topics": ["ประเด็นหลัก 3-5 ข้อที่ควรอยู่ใน presentation"],
  "central_question": "คำถามหลักที่ presentation นี้ต้องตอบ",
  "success_criteria": "presentation จะสำเร็จเมื่อผู้ฟัง...",
  "framework_rationale": "เหตุผลที่เลือก framework นี้ 1-2 ประโยค"
}

ข้อจำกัด: ตอบ JSON เท่านั้น ไม่เกิน 800 tokens`,
  }),
  parseOutput: (raw) => raw,
};

// =====================================================
// STEP 2: Audience Profile
// Generate audience persona card from selected styles + concerns
// =====================================================
export const step2Prompt: PresentationPromptTemplate = {
  step: 2,
  name: 'Audience Profile',
  maxTokens: 6000,
  creditsRequired: 1,
  buildPrompt: (input) => {
    const styleDescriptions = (input.communication_styles || []).map((id: string) => {
      const s = COMMUNICATION_STYLES.find(x => x.id === id);
      return s ? `${s.name} (${s.description})` : id;
    }).join(', ');

    const concernDescriptions = (input.audience_concerns || []).map((id: string) => {
      const c = AUDIENCE_CONCERNS.find(x => x.id === id);
      return c ? c.name : id;
    }).join(', ');

    return {
      system: `คุณคือ Audience Analyst ที่เชี่ยวชาญในการสร้าง audience persona card สำหรับ presentation
เข้าใจ communication styles (Mark Murphy framework) และ typical concerns
ตอบเป็น JSON เท่านั้น ไม่มี markdown`,
      user: `# Presentation Context
- Title: ${input.title}
- Objective: ${input.objective}
- ผู้ฟัง: ${input.audience_role}
- บริบทธุรกิจ: ${input.business_context || '—'}

# Communication Style ที่เลือก
${styleDescriptions || 'ไม่ได้ระบุ'}

# Concerns ที่ผู้ฟังอาจมี
${concernDescriptions || 'ไม่ได้ระบุ'}

# Output JSON Schema
{
  "persona_card": {
    "role": "ชื่อเรียกสั้นๆ เช่น 'CMO ที่เน้น data'",
    "demographics": "อายุ/ตำแหน่ง/ประสบการณ์โดยสังเขป",
    "decision_style": "ใจความ 1-2 ประโยค",
    "what_they_want": ["สิ่งที่ผู้ฟังอยากได้จาก presentation 3-5 ข้อ"],
    "what_they_fear": ["สิ่งที่กลัว/กังวล 3-5 ข้อ"],
    "language_preference": "ภาษาที่ควรใช้ (formal/casual/technical)",
    "attention_span": "ระยะเวลาที่จะตั้งใจฟัง (นาที)"
  },
  "handling_strategy": {
    "open_with": "วิธีเปิดที่ตรงใจ 1-2 ประโยค",
    "data_density": "low | medium | high (เลือกตาม style)",
    "visual_density": "low | medium | high",
    "story_emphasis": "low | medium | high",
    "transition_phrases": ["วลีเชื่อมที่ควรใช้ 3-5 วลี"]
  },
  "concerns_responses": [
    {
      "concern": "ชื่อ concern",
      "slide_to_address": "slide ที่จะตอบ concern นี้",
      "talking_point": "จุดสำคัญที่จะพูด"
    }
  ]
}`,
    };
  },
  parseOutput: (raw) => raw,
};

// =====================================================
// STEP 3: ATR Canvas
// 4×2 grid: Know/Believe/Feel/Do × Before/After
// =====================================================
export const step3Prompt: PresentationPromptTemplate = {
  step: 3,
  name: 'ATR (Audience Transformation)',
  maxTokens: 6000,
  creditsRequired: 1,
  buildPrompt: (input) => ({
    system: `คุณคือ Presentation Strategist ที่เชี่ยวชาญ Audience Transformation Roadmap (Phil Waknell)
หลักการ: "Don't inform, transform! ไม่ใช่นำเสนอเพื่อให้ข้อมูล แต่เพื่อสร้างการเปลี่ยนแปลงของผู้ฟัง"

ATR คือ 4×2 grid:
- 4 มิติ: KNOW (รู้), BELIEVE (เชื่อ), FEEL (รู้สึก), DO (ทำ)
- 2 ช่วงเวลา: BEFORE (ก่อนฟัง), AFTER (หลังฟัง)
- Middle band (gap) = เนื้อหาที่ต้องนำเสนอ

ตอบ JSON เท่านั้น`,
    user: `# Presentation
- Title: ${input.title}
- Objective: ${input.objective}
- เนื้อหาโดยย่อ: ${input.summary || '—'}

# Audience Persona (from Step 2)
${input.audience_persona || '—'}

${input.atr ? `# ATR Draft (จากผู้ใช้)
${JSON.stringify(input.atr, null, 2)}
` : ''}
# Output JSON Schema
{
  "before": {
    "know": "ผู้ฟังรู้อะไรแล้วเกี่ยวกับเรื่องนี้ (1-2 ประโยค)",
    "believe": "ผู้ฟังเชื่อ/คิดอย่างไรกับเรื่องนี้ (1-2 ประโยค)",
    "feel": "ผู้ฟังรู้สึกอย่างไร (1-2 ประโยค)",
    "do": "ผู้ฟังทำอะไรอยู่ตอนนี้ (1-2 ประโยค)"
  },
  "after": {
    "know": "หลังฟัง ผู้ฟังต้องรู้เรื่องอะไร (1-2 ประโยค)",
    "believe": "หลังฟัง อยากให้ผู้ฟังเชื่ออะไร (1-2 ประโยค)",
    "feel": "หลังฟัง อยากให้ผู้ฟังรู้สึกอะไร (1-2 ประโยค)",
    "do": "หลังฟัง อยากให้ผู้ฟังทำอะไร (action ที่ชัดเจน)"
  },
  "content_gap": [
    "เนื้อหาที่ต้องนำเสนอ 1 (มาจาก KNOW gap)",
    "เนื้อหาที่ต้องนำเสนอ 2 (มาจาก BELIEVE gap)",
    "เนื้อหาที่ต้องนำเสนอ 3 (มาจาก FEEL gap)",
    "เนื้อหาที่ต้องนำเสนอ 4 (มาจาก DO gap)"
  ],
  "transformation_summary": "สรุปการเปลี่ยนแปลงที่ต้องเกิดขึ้นกับผู้ฟัง 1-2 ประโยค"
}`,
  }),
  parseOutput: (raw) => raw,
};

// =====================================================
// STEP 4: Source Content Extraction
// No AI — just saves uploaded content
// =====================================================
export const step4Prompt: PresentationPromptTemplate = {
  step: 4,
  name: 'Source Content',
  maxTokens: 1000,
  creditsRequired: 0,
  buildPrompt: (input) => ({
    system: 'No AI for this step — just save source content',
    user: 'Save source content for next step',
  }),
  parseOutput: (raw) => raw,
};

// =====================================================
// STEP 5: Content Triage (Must/Maybe/Kill)
// AI classifies each content item
// =====================================================
export const step5Prompt: PresentationPromptTemplate = {
  step: 5,
  name: 'Content Triage',
  maxTokens: 8000,
  creditsRequired: 1,
  buildPrompt: (input) => {
    const sourceItems = (input.source_items || []).map((item: any, i: number) =>
      `${i + 1}. [${item.title || 'Item ' + (i + 1)}] ${item.content?.slice(0, 300) || ''}`
    ).join('\n\n');

    return {
      system: `คุณคือ Content Strategist ที่เชี่ยวชาญในการ triage เนื้อหาสำหรับ presentation

หลักการ "Must Have / Maybe / Kill It":
- **Must Have**: ถ้าเอาออก → ตัดสินใจไม่ได้ หรือเรื่องขาดน้ำหนัก ห้ามตัดทิ้ง
- **Maybe**: สำคัญรอง ย้ายไปภาคผนวกหรือ speaker notes
- **Kill It**: ทำให้ผู้ฟังสับสน ไม่ตรง objective ตัดทิ้งได้

ตอบ JSON เท่านั้น`,
      user: `# Presentation
- Title: ${input.title}
- Objective: ${input.objective}
- Time: ${input.time_minutes} นาที
- Target slides: ${input.target_slides}

# ATR Content Gap (จาก Step 3)
${JSON.stringify(input.atr?.content_gap || [], null, 2)}

# Source Content (จาก Step 4)
${sourceItems || 'ไม่มี — ใช้ ATR + Title + Description เป็นฐาน'}

# Output JSON Schema
{
  "must_have": [
    {
      "id": "item-1",
      "title": "หัวข้อ",
      "content": "เนื้อหาสั้นๆ 1-2 ประโยค",
      "why_must": "เหตุผลที่ต้องอยู่บนสไลด์",
      "slide_target": "slide ที่ควรอยู่ (1-N)"
    }
  ],
  "maybe": [
    {
      "id": "item-x",
      "title": "...",
      "content": "...",
      "placement": "speaker_notes | appendix | late_slide"
    }
  ],
  "kill_it": [
    {
      "id": "item-y",
      "title": "...",
      "content": "...",
      "reason": "เหตุผลที่ตัดทิ้ง"
    }
  ],
  "coverage_check": "Must + Maybe ครอบคลุม content_gap หรือไม่ (1-2 ประโยค)"
}`,
    };
  },
  parseOutput: (raw) => raw,
};

// =====================================================
// STEP 6: Story Outline (3 framework variants)
// =====================================================

function step6Base(input: PresentationStepInput, framework: 'scqa_minto' | '5m_mission' | 'popup_pitch'): { system: string; user: string } {
  const fw = FRAMEWORK_NAMES[framework];

  const context = `
# Presentation
- Title: ${input.title}
- Objective: ${input.objective}
- Time: ${input.time_minutes} นาที
- Target slides: ${input.target_slides}

# Audience Persona
${JSON.stringify(input.audience_persona || {}, null, 2)}

# ATR
${JSON.stringify(input.atr || {}, null, 2)}

# Must-Have Content (from Step 5)
${JSON.stringify(input.must_have || [], null, 2)}

# Maybe Content
${JSON.stringify(input.maybe || [], null, 2)}
`.trim();

  if (framework === 'scqa_minto') {
    return {
      system: `คุณคือ Presentation Architect ที่เชี่ยวชาญ SCQA + Minto Pyramid (Barbara Minto, McKinsey)

**SCQA** = Structure for INTRODUCTION:
- **S (Situation)**: สถานการณ์ปัจจุบันที่ผู้ฟังทุกคนยอมรับ
- **C (Complication)**: ปัญหา/โอกาสที่ทำให้ S ไม่เป็นเหมือนเดิม
- **Q (Question)**: คำถามที่ S+C นำไปสู่
- **A (Answer)**: คำตอบ/ข้อสรุปหลัก

**Minto Pyramid** = Structure for MAIN CONTENT:
- ยอด (Key Message) = Answer
- ฐาน 1 (Supporting Arguments) = 3-5 เหตุผลหลัก
- ฐาน 2 (Data/Facts) = หลักฐานสนับสนุน

ตอบ JSON เท่านั้น ไม่มี markdown`,
      user: `${context}

# Framework: SCQA + Minto Pyramid (Informative)
# Output JSON Schema
{
  "framework": "scqa_minto",
  "title": "${input.title}",
  "total_slides": ${input.target_slides},
  "outline": [
    {
      "slide_number": 1,
      "section": "title",
      "title": "ชื่อ presentation (assertion title)",
      "subtitle": "subtitle",
      "speaker_note": "1-2 ประโยค",
      "duration_seconds": 30
    },
    {
      "slide_number": 2,
      "section": "situation",
      "title": "S: สถานการณ์ปัจจุบัน",
      "key_points": ["ประเด็น 1", "ประเด็น 2", "ประเด็น 3"],
      "supporting_data": "ตัวเลข/สถิติที่สนับสนุน",
      "speaker_note": "...",
      "duration_seconds": 60
    },
    {
      "slide_number": 3,
      "section": "complication",
      "title": "C: ปัญหา/โอกาส",
      "key_points": [...],
      "supporting_data": "...",
      "speaker_note": "...",
      "duration_seconds": 90
    },
    {
      "slide_number": 4,
      "section": "question",
      "title": "Q: คำถามสำคัญ",
      "key_points": ["คำถามหลัก 1 ข้อ"],
      "speaker_note": "...",
      "duration_seconds": 30
    },
    {
      "slide_number": 5,
      "section": "answer",
      "title": "A: คำตอบ/Key Message",
      "key_message": "ประโยคเดียวที่เป็นคำตอบ",
      "speaker_note": "...",
      "duration_seconds": 60
    },
    // 3-5 Minto slides (Supporting Arguments)
    {
      "slide_number": 6,
      "section": "minto_support",
      "minto_index": 1,
      "title": "เหตุผลสนับสนุน #1",
      "key_points": ["..."],
      "supporting_data": "...",
      "speaker_note": "...",
      "duration_seconds": 90
    },
    {
      "slide_number": 11,
      "section": "summary",
      "title": "สรุป",
      "key_points": ["..."],
      "speaker_note": "...",
      "duration_seconds": 60
    }
  ]
}

⚠️ สร้าง ${input.target_slides} slides ตาม flow:
1. Title (1)
2. S - Situation (1-2)
3. C - Complication (1-2)
4. Q - Question (1)
5. A - Answer / Key Message (1)
6. Minto Supporting Arguments (3-5)
7. Action plan / Next steps (1-2)
8. Summary / Q&A (1)

แต่ละ slide ต้องมี speaker_note 30-90 วินาที`,
    };
  }

  if (framework === '5m_mission') {
    return {
      system: `คุณคือ Presentation Architect ที่เชี่ยวชาญ 5M Mission Flow

**5M** = Persuasive narrative structure:
- **Message** → จุดประกาย "เรื่องนี้สำคัญ" — ผู้ฟัง: สนใจ/ตั้งใจฟัง
- **Matter** → เข้าใจเหตุผล/บริบทเชิงลึก — ผู้ฟัง: เห็นภาพ/เชื่อมโยง
- **Momentum** → รู้สึกแรงขับและความจำเป็น — ผู้ฟัง: ตื่นตัว/ต้องเปลี่ยน
- **Mindshift** → เกิดจุดประกายความคิดใหม่ — ผู้ฟัง: เห็นต่าง/เปิดใจ
- **Move** → ปลุกให้ลงมือ — ผู้ฟัง: ตกผลึก/อยากเริ่มทำ

ตอบ JSON เท่านั้น ไม่มี markdown`,
      user: `${context}

# Framework: 5M Mission Flow (Persuasive)
# Output JSON Schema
{
  "framework": "5m_mission",
  "title": "${input.title}",
  "total_slides": ${input.target_slides},
  "outline": [
    {
      "slide_number": 1,
      "section": "title",
      "section_label": "Title",
      "title": "...",
      "subtitle": "...",
      "speaker_note": "...",
      "duration_seconds": 30,
      "audience_emotion_target": "ตื่นเต้น/ตั้งใจ"
    },
    {
      "slide_number": 2,
      "section": "message",
      "section_label": "Message",
      "title": "Message: ใจความหลัก 1 ประโยค",
      "key_message": "ประโยคเดียวที่ต้องจำ",
      "key_points": ["..."],
      "speaker_note": "...",
      "duration_seconds": 90,
      "audience_emotion_target": "สนใจ ตั้งใจฟัง"
    },
    {
      "slide_number": 3,
      "section": "matter",
      "section_label": "Matter",
      "title": "Matter: ที่มา/บริบท",
      "key_points": ["..."],
      "supporting_data": "...",
      "speaker_note": "...",
      "duration_seconds": 120,
      "audience_emotion_target": "เห็นภาพ เชื่อมโยง"
    },
    {
      "slide_number": 5,
      "section": "momentum",
      "section_label": "Momentum",
      "title": "Momentum: ผลกระทบ/แรงขับ",
      "key_points": ["..."],
      "supporting_data": "...",
      "speaker_note": "...",
      "duration_seconds": 90,
      "audience_emotion_target": "ตื่นตัว รู้สึกต้องเปลี่ยน"
    },
    {
      "slide_number": 7,
      "section": "mindshift",
      "section_label": "Mindshift",
      "title": "Mindshift: จุดเปลี่ยนมุมมอง",
      "key_points": ["..."],
      "speaker_note": "...",
      "duration_seconds": 90,
      "audience_emotion_target": "เห็นต่าง เปิดใจ"
    },
    {
      "slide_number": 8,
      "section": "move",
      "section_label": "Move",
      "title": "Move: สิ่งที่อยากให้ผู้ฟังทำ",
      "call_to_action": "...",
      "key_points": ["..."],
      "speaker_note": "...",
      "duration_seconds": 90,
      "audience_emotion_target": "ตกผลึก อยากเริ่มทำ"
    }
  ]
}

⚠️ สร้าง ${input.target_slides} slides ตาม 5M flow:
- 1 Title
- 1-2 Message
- 1-2 Matter
- 1-2 Momentum
- 1 Mindshift
- 1-2 Move
- 1 Summary/Thank you

แต่ละ slide มี audience_emotion_target ที่ตรงกับ M นั้น`,
    };
  }

  // popup_pitch
  return {
    system: `คุณคือ Presentation Architect ที่เชี่ยวชาญ The Pop-Up Pitch by Dan Roam

**10-Slide Structure** (ตายตัว):
1. Title Page — รู้หัวข้อชัดเจน
2. Common Ground — เชื่อใจเป็นทีมเดียวกัน
3. Coming Problem — ตกใจและตื่นตัว
4. Emotional Win — โล่งใจ มีความหวัง
5. False Hope — ถูกดึงสติด้วยความจริง
6. Audacious Reality — ใช้ความกล้า
7. We Can Do This — ตื่นเต้นที่เจอทางออก ทำได้จริง
8. Call to Action — ไปด้วยกัน
9. Early Benefits — อยากได้รางวัล เชื่อใจทีม
10. The Long Win — ทะเยอทะยาน รู้สึกดี

ตอบ JSON เท่านั้น ไม่มี markdown`,
    user: `${context}

# Framework: The Pop-Up Pitch (Story) — 10 slides ตายตัว
# Output JSON Schema
{
  "framework": "popup_pitch",
  "title": "${input.title}",
  "total_slides": 10,
  "outline": [
    {
      "slide_number": 1,
      "section": "title_page",
      "section_label": "Title Page",
      "title": "...",
      "subtitle": "...",
      "key_points": ["..."],
      "speaker_note": "...",
      "duration_seconds": 30,
      "emotional_trigger": "รู้หัวข้อชัดเจน"
    },
    {
      "slide_number": 2,
      "section": "common_ground",
      "section_label": "Common Ground",
      "title": "...",
      "key_points": ["..."],
      "speaker_note": "...",
      "duration_seconds": 60,
      "emotional_trigger": "เชื่อใจ เป็นทีมเดียวกัน"
    },
    {
      "slide_number": 3,
      "section": "coming_problem",
      "section_label": "Coming Problem",
      "title": "...",
      "key_points": ["..."],
      "speaker_note": "...",
      "duration_seconds": 90,
      "emotional_trigger": "ตกใจ ตื่นตัว"
    },
    {
      "slide_number": 4,
      "section": "emotional_win",
      "section_label": "Emotional Win",
      "title": "...",
      "key_points": ["..."],
      "speaker_note": "...",
      "duration_seconds": 60,
      "emotional_trigger": "โล่งใจ มีความหวัง"
    },
    {
      "slide_number": 5,
      "section": "false_hope",
      "section_label": "False Hope",
      "title": "...",
      "key_points": ["..."],
      "speaker_note": "...",
      "duration_seconds": 60,
      "emotional_trigger": "ถูกดึงสติด้วยความจริง"
    },
    {
      "slide_number": 6,
      "section": "audacious_reality",
      "section_label": "Audacious Reality",
      "title": "...",
      "key_points": ["..."],
      "speaker_note": "...",
      "duration_seconds": 60,
      "emotional_trigger": "ใช้ความกล้า"
    },
    {
      "slide_number": 7,
      "section": "we_can_do_this",
      "section_label": "We Can Do This",
      "title": "...",
      "key_points": ["..."],
      "speaker_note": "...",
      "duration_seconds": 60,
      "emotional_trigger": "ตื่นเต้น เจอทางออก ทำได้จริง"
    },
    {
      "slide_number": 8,
      "section": "call_to_action",
      "section_label": "Call to Action",
      "title": "...",
      "call_to_action": "...",
      "key_points": ["..."],
      "speaker_note": "...",
      "duration_seconds": 60,
      "emotional_trigger": "ไปด้วยกัน"
    },
    {
      "slide_number": 9,
      "section": "early_benefits",
      "section_label": "Early Benefits",
      "title": "...",
      "key_points": ["..."],
      "speaker_note": "...",
      "duration_seconds": 60,
      "emotional_trigger": "อยากได้รางวัล เชื่อใจทีม"
    },
    {
      "slide_number": 10,
      "section": "the_long_win",
      "section_label": "The Long Win",
      "title": "...",
      "key_points": ["..."],
      "speaker_note": "...",
      "duration_seconds": 60,
      "emotional_trigger": "ทะเยอทะยาน รู้สึกดี"
    }
  ]
}

⚠️ ใช้ 10 slides ตายตัว — ห้ามเพิ่ม/ลด ห้ามข้าม section
แต่ละ slide ต้องมี emotional_trigger ที่ตรงกับ slide นั้น`,
  };
}

export const step6Prompt: PresentationPromptTemplate = {
  step: 6,
  name: 'Story Outline',
  maxTokens: 14000,
  creditsRequired: 2,
  buildPrompt: (input) => {
    const fw = input.framework_variant || frameworkVariantForObjective(input.objective);
    return step6Base(input, fw as any);
  },
  parseOutput: (raw) => raw,
};

// =====================================================
// STEP 7: Slide Blueprint (per slide: type, layout, media, chart)
// User can EDIT the system prompt here
// =====================================================
export const step7Prompt: PresentationPromptTemplate = {
  step: 7,
  name: 'Slide Blueprint',
  maxTokens: 18000,
  creditsRequired: 2,
  buildPrompt: (input) => ({
    system: `คุณคือ Slide Designer ที่เชี่ยวชาญ visual storytelling และ 3P Impact Flow

**Slide Types** (3P - Purpose):
- **Flat** — เน้นข้อความ เหมาะกับ Report/Appendix
- **Story** — Assertion title + bullets + visual เหมาะกับส่วนใหญ่
- **Visual** — Full-bleed image + hook เหมาะกับ Pitch/Persuasive

**Layout Patterns** (5 patterns):
- 4 Quadrant
- 3 Column
- Chart + Text
- Full-bleed Image
- Before vs After

**Chart Types** (แบ่ง/แข่ง/โต):
- Composition: pie, stacked_bar, treemap, sankey
- Comparison: grouped_bar, clustered_bar, bullet, heatmap
- Change: line, area, dot_plot, slope

**Gestalt Principles**:
- 1 slide 1 idea
- ใช้สี 1 เด่น + 1 รอง + neutral
- "ตะโกน" data point เด่น
- Remove before adding

ตอบ JSON เท่านั้น ไม่มี markdown`,
    user: `# Presentation
- Title: ${input.title}
- Framework: ${input.framework_variant}
- Color theme: ${input.color_theme}

# Outline (from Step 6)
${JSON.stringify(input.outline || {}, null, 2)}

# Output JSON Schema
{
  "slides": [
    {
      "slide_number": 1,
      "type": "title | flat | story | visual",
      "layout": "title | quadrant | 3column | chart_text | full_bleed | comparison",
      "title": "หัวข้อ (assertion title)",
      "subtitle": "...",
      "body": "...",
      "bullet_points": ["..."],
      "data_table": {
        "headers": ["..."],
        "rows": [["..."]]
      },
      "chart": {
        "type": "pie | bar | stacked_bar | line | area | ...",
        "data": [{"label": "...", "value": 0}],
        "highlight": "..."
      },
      "media_suggestion": {
        "kind": "image | icon | chart | none",
        "description": "...",
        "image_prompt": "ถ้าเป็น Visual ใส่ prompt สำหรับ gen ภาพ (5W2H: What/Who/Where/How/Style/Lighting)"
      },
      "color_emphasis": "primary | secondary | accent | muted"
    }
  ]
}

⚠️ ทุก slide ต้องมี type + layout + media_suggestion
- title slide → type='title' layout='title'
- เนื้อหาหลัก → type='story' layout ตามเนื้อหา
- Visual slides → full_bleed + image_prompt ครบ
- Data slides → chart ครบ

ใช้ color_theme: ${input.color_theme} เป็นหลัก`,
  }),
  parseOutput: (raw) => raw,
};

// =====================================================
// STEP 8: Speaker Notes
// Per-slide script 30-90 sec + handle audience concerns
// =====================================================
export const step8Prompt: PresentationPromptTemplate = {
  step: 8,
  name: 'Speaker Notes',
  maxTokens: 14000,
  creditsRequired: 1,
  buildPrompt: (input) => ({
    system: `คุณคือ Public Speaking Coach ที่เชี่ยวชาญ writing speaker notes
หลักการ:
- ทุก slide มี script 30-90 วินาที
- Handle audience concerns (objection handling) ในแต่ละ slide ที่เกี่ยวข้อง
- ใช้ transition phrases เชื่อม slide
- ตรง communication style ของผู้ฟัง

ตอบ JSON เท่านั้น ไม่มี markdown`,
    user: `# Presentation
- Title: ${input.title}
- Framework: ${input.framework_variant}

# Audience Profile
${JSON.stringify(input.audience_persona || {}, null, 2)}

# Concerns ที่ต้อง handle
${JSON.stringify(input.concerns_responses || [], null, 2)}

# Outline + Blueprint (from Step 6+7)
${JSON.stringify(input.blueprint || input.outline || {}, null, 2)}

# Output JSON Schema
{
  "global_notes": {
    "opening_hook": "ประโยคเปิด presentation ทั้งชุด (1-2 ประโยค)",
    "transition_phrases": ["วลีเชื่อม 5-7 วลี"],
    "closing_line": "ประโยคปิดที่ฝังใจ"
  },
  "slide_notes": [
    {
      "slide_number": 1,
      "script": "30-90 วินาที script สำหรับพูด",
      "talking_points": ["จุดสำคัญ 3-5 ข้อ"],
      "transition_to_next": "วลีเชื่อมไป slide ถัดไป",
      "concerns_addressed": ["concern id ที่ slide นี้ตอบ"],
      "energy_level": "low | medium | high",
      "pacing": "slow | normal | fast"
    }
  ]
}

⚠️ script ต้องเป็นภาษาพูดจริง ไม่ใช่อ่านสไลด์
⚠️ ทุก concern ใน concerns_responses ต้องถูก addressed ใน slide ที่เกี่ยวข้อง`,
  }),
  parseOutput: (raw) => raw,
};

// =====================================================
// STEP 9: Final Polish & Export
// (mostly no AI — just assembly)
// =====================================================
export const step9Prompt: PresentationPromptTemplate = {
  step: 9,
  name: 'Final Polish & Export',
  maxTokens: 2000,
  creditsRequired: 0, // free
  buildPrompt: (input) => ({
    system: 'No AI for export — just package final output',
    user: 'Compile final presentation',
  }),
  parseOutput: (raw) => raw,
};

export const PRESENTATION_PROMPTS: Record<number, PresentationPromptTemplate> = {
  1: step1Prompt,
  2: step2Prompt,
  3: step3Prompt,
  4: step4Prompt,
  5: step5Prompt,
  6: step6Prompt,
  7: step7Prompt,
  8: step8Prompt,
  9: step9Prompt,
};

export const STEP_CREDIT_COSTS: Record<number, number> = {
  1: 0,
  2: 1,
  3: 1,
  4: 0,
  5: 1,
  6: 2,
  7: 2,
  8: 1,
  9: 0,
};

export const STEP_NAMES_TH: Record<number, string> = {
  1: 'Quick Brief',
  2: 'Audience Profile',
  3: 'ATR Canvas',
  4: 'Source Content',
  5: 'Content Triage',
  6: 'Story Outline',
  7: 'Slide Blueprint',
  8: 'Speaker Notes',
  9: 'Export',
};

// =====================================================
// Autofill prompts — draft the wizard's OWN input fields (title excepted;
// that's the one thing only the user can seed) from whatever context
// exists so far, so a user can review/edit an AI-drafted starting point
// instead of typing every field from a blank form. Deliberately NOT
// offered for Step 4 (Source Content): fabricating fake source material
// the user never actually researched would be actively harmful, not just
// low-value — Step 4 already has a real, honest fallback (auto-use the
// Step 3 content gap) for when there's no source text yet.
// =====================================================

export interface AutofillPromptTemplate {
  step: number;
  buildPrompt: (input: PresentationStepInput) => { system: string; user: string };
  maxTokens: number;
}

const autofillStep1: AutofillPromptTemplate = {
  step: 1,
  maxTokens: 1200,
  buildPrompt: (input) => ({
    system: `คุณคือ Presentation Strategist ช่วยร่าง brief จากหัวข้อสั้นๆ ให้ผู้ใช้แก้ไขต่อได้ทันที
⚠️ ตอบ JSON object เดียวเท่านั้น ห้ามมี markdown code fence ห้ามอธิบายก่อน/หลัง`,
    user: `# หัวข้อ Presentation
${input.title}

${input.objective ? `# Objective ที่ผู้ใช้เลือกไว้แล้ว\n${input.objective} (เก็บค่านี้ไว้ ไม่ต้องเปลี่ยน)` : '# Objective ยังไม่ได้เลือก — ช่วยแนะนำจากหัวข้อ'}

# Output JSON Schema
{
  "objective": "informative | persuasive | story",
  "description": "คำอธิบาย 1-2 ประโยคว่า presentation นี้เกี่ยวกับอะไร จุดประสงค์หลักคืออะไร",
  "target_slides": 10,
  "time_minutes": 15
}

⚠️ objective: informative = รายงาน/สรุปงาน/อธิบาย, persuasive = pitch/ขออนุมัติ/เสนอไอเดีย, story = keynote/TED Talk/เล่าเรื่องแบรนด์
⚠️ target_slides ระหว่าง 5-25, time_minutes ระหว่าง 3-60 ให้เหมาะกับเนื้อหา
⚠️ ตอบ JSON เท่านั้น`,
  }),
};

const autofillStep2: AutofillPromptTemplate = {
  step: 2,
  maxTokens: 1500,
  buildPrompt: (input) => ({
    system: `คุณคือ Audience Analyst ช่วยร่าง audience profile จาก context ของ presentation ให้ผู้ใช้แก้ไขต่อได้ทันที
⚠️ ตอบ JSON object เดียวเท่านั้น ห้ามมี markdown code fence`,
    user: `# Presentation Context
- Title: ${input.title}
- Objective: ${input.objective}
${input.description ? `- คำอธิบาย: ${input.description}` : ''}

# ตัวเลือก Communication Style ที่มีจริง (เลือกได้หลายข้อ ต้องใช้ id ตรงนี้เท่านั้น)
${COMMUNICATION_STYLES.map((s) => `- ${s.id}: ${s.name} — ${s.description}`).join('\n')}

# ตัวเลือก Concerns ที่มีจริง (เลือกได้หลายข้อ ต้องใช้ id ตรงนี้เท่านั้น)
${AUDIENCE_CONCERNS.map((c) => `- ${c.id}: ${c.name}`).join('\n')}

# Output JSON Schema
{
  "audience_role": "ผู้ฟังคือใคร เช่น CMO + Head of Sales",
  "business_context": "บริบทธุรกิจสั้นๆ",
  "communication_styles": ["เลือกจาก id ด้านบน 1-2 ตัวที่เข้ากับ objective และ audience_role"],
  "audience_concerns": ["เลือกจาก id ด้านบน 2-4 ตัวที่ audience นี้น่าจะกังวล"]
}

⚠️ communication_styles และ audience_concerns ต้องเป็น id ที่มีอยู่จริงในลิสต์ด้านบนเท่านั้น ห้ามสร้าง id ใหม่
⚠️ ตอบ JSON เท่านั้น`,
  }),
};

const autofillStep3: AutofillPromptTemplate = {
  step: 3,
  maxTokens: 1800,
  buildPrompt: (input) => ({
    system: `คุณคือ Presentation Strategist ช่วยร่าง ATR (Audience Transformation Roadmap, Phil Waknell) ให้ผู้ใช้แก้ไขต่อได้ทันที
⚠️ ตอบ JSON object เดียวเท่านั้น ห้ามมี markdown code fence`,
    user: `# Presentation Context
- Title: ${input.title}
- Objective: ${input.objective}
${input.audience_role ? `- ผู้ฟัง: ${input.audience_role}` : ''}
${input.business_context ? `- บริบทธุรกิจ: ${input.business_context}` : ''}
${input.audience_persona ? `- Persona: ${JSON.stringify(input.audience_persona)}` : ''}

# Output JSON Schema
{
  "summary": "สรุปสั้นๆ ว่า presentation นี้จะพูดเรื่องอะไร",
  "before": { "know": "ผู้ฟังรู้อะไรแล้วก่อนฟัง", "believe": "ผู้ฟังเชื่ออะไรก่อนฟัง", "feel": "ผู้ฟังรู้สึกอย่างไรก่อนฟัง", "do": "ผู้ฟังทำอะไรอยู่ก่อนฟัง" },
  "after": { "know": "อยากให้รู้อะไรหลังฟัง", "believe": "อยากให้เชื่ออะไรหลังฟัง", "feel": "อยากให้รู้สึกอย่างไรหลังฟัง", "do": "อยากให้ทำอะไร (action) หลังฟัง" }
}

⚠️ ทุก field ต้องมีเนื้อหาจริง ไม่เว้นว่าง กระชับ 1 ประโยคต่อช่อง
⚠️ ตอบ JSON เท่านั้น`,
  }),
};

export const AUTOFILL_PROMPTS: Record<number, AutofillPromptTemplate> = {
  1: autofillStep1,
  2: autofillStep2,
  3: autofillStep3,
};
