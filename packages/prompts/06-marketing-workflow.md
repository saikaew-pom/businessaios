# Step 6: Marketing Workflow

> **Output:** 3 Workflows (automation ที่ใช้ AI ช่วย) + 1 Voice Guide
> **AI model recommended:** Claude Sonnet 4 (process design)
> **Estimated tokens:** ~1,500 input + ~2,000 output = ~3,500 total
> **Estimated cost:** ~$0.03

## Variables

```
{brand_card}         - Brand Card จาก Step 1
{positioning}        - Positioning จาก Step 4
{current_work}       - งาน marketing ที่ทำเป็นประจำ
{team_size}          - ขนาดทีม (1 / 2-5 / 6-20)
{budget}             - งบ AI tools ต่อเดือน
{tools_available}    - เครื่องมือที่มี (ChatGPT, Canva, Zapier, etc.)
```

## Prompt Template

```markdown
# CONTEXT
คุณคือ Marketing Operations Specialist ที่ออกแบบ workflow ให้ SME ไทย
คุณเข้าใจเครื่องมือ AI ที่ใช้ได้จริง (ChatGPT, Claude, Make, Zapier, Canva)
คุณเน้น workflow ที่ทำได้ทันที ไม่ต้องลงทุนเยอะ

# INPUT
## Brand
{brand_card}

## Positioning
{positioning}

## Current Work
{current_work}

## Team
- ขนาดทีม: {team_size} คน
- งบ AI tools: {budget} บาท/เดือน
- เครื่องมือที่มี: {tools_available}

# TASK
ออกแบบ 3 Workflows ใหม่ ที่:
1. ใช้ AI ช่วยงานเดิม (ไม่ใช่เพิ่มงาน)
2. ประหยัดเวลา ≥ 50%
3. คุณภาพไม่ตก
4. ทำได้ภายใน 1 เดือน

# WORKFLOW TYPES (เลือก 3 จาก 5)
1. **Content Creation** (เขียนแคปชั่น/โพสต์)
2. **Customer Service** (ตอบแชท/FAQ)
3. **Research & Insight** (วิเคราะห์ข้อมูล/รีวิว)
4. **Sales Follow-up** (follow-up lead)
5. **Reporting** (สรุปยอด/รายงาน)

# OUTPUT FORMAT (JSON)

```json
{
  "workflows": [
    {
      "id": "wf-1",
      "name": "Content Creation 30 ชิ้น ใน 1 ชั่วโมง",
      "type": "content",
      "time_before": "6 ชม./เดือน",
      "time_after": "1 ชม./เดือน",
      "time_saved_pct": 83,
      "tools_used": ["ChatGPT Plus", "Canva Pro"],
      "tools_cost_monthly": 750,
      "steps": [
        {
          "step": 1,
          "action": "เปิด ChatGPT + ใช้ prompt 'Content Calendar' จาก Step 5",
          "duration": "10 นาที",
          "output": "30 caption + 30 visual brief"
        },
        {
          "step": 2,
          "action": "เปิด Canva → ใช้ Brand Kit → สร้าง visual 30 ชิ้น",
          "duration": "30 นาที",
          "output": "30 ภาพพร้อม caption"
        },
        {
          "step": 3,
          "action": "Schedule ผ่าน Canva Scheduler หรือ Meta Business Suite",
          "duration": "20 นาที",
          "output": "30 โพสต์พร้อมโพสต์อัตโนมัติ"
        }
      ],
      "frequency": "ทุกเดือน",
      "kpi": "Reach, Engagement, Conversion",
      "pitfalls": [
        "อย่าให้ AI เขียนเอง 100% — ต้อง review",
        "ใช้ Brand Kit ใน Canva ให้ตรงกับ Brand Card"
      ]
    }
  ],
  "voice_guide": {
    "tone": "Friendly + Knowledgeable",
    "do": [
      "ใช้ประโยคสั้น ไม่เกิน 15 คำ",
      "มีตัวเลข/ข้อมูลรองรับ",
      "พูดกับลูกค้าเหมือนเพื่อน"
    ],
    "dont": [
      "อย่าใช้คำว่า 'ดีที่สุด', 'ครบวงจร'",
      "อย่าเขียนเกิน 3 emojis",
      "อย่าพูดถึงคู่แข่งตรงๆ"
    ],
    "sample_phrases": [
      "เคล็ดลับจากเชฟ: ...",
      "ลูกค้าบอกว่า: ...",
      "ความจริงที่หลายคนไม่รู้: ..."
    ]
  }
}
```

# CONSTRAINTS
- 3 workflows
- แต่ละ workflow มี steps ≤ 5
- time_saved_pct ≥ 50%
- tools_cost_monthly ≤ {budget} บาท
- voice_guide มี do/dont/sample_phrases อย่างน้อย 3 ข้อ

# REASONING
อธิบาย:
1. ทำไมเลือก 3 workflow นี้ (impact + ease)
2. workflow ไหนควรทำก่อน
3. ความเสี่ยงที่อาจเกิด
```

## Example Output

```json
{
  "workflows": [
    {
      "id": "wf-1",
      "name": "Content 30 ชิ้น ใน 1 ชั่วโมง",
      "type": "content",
      "time_before": "6 ชม./เดือน",
      "time_after": "1 ชม./เดือน",
      "time_saved_pct": 83,
      "tools_used": ["ChatGPT Plus", "Canva Pro"],
      "tools_cost_monthly": 750,
      "steps": [
        {
          "step": 1,
          "action": "ใช้ prompt 'Content Calendar' จาก Step 5",
          "duration": "10 นาที",
          "output": "30 caption + 30 visual brief"
        },
        {
          "step": 2,
          "action": "Canva Brand Kit → สร้าง 30 visual",
          "duration": "30 นาที",
          "output": "30 ภาพพร้อม caption"
        },
        {
          "step": 3,
          "action": "Schedule ผ่าน Meta Business Suite",
          "duration": "20 นาที",
          "output": "30 โพสต์พร้อมโพสต์"
        }
      ],
      "frequency": "ทุกเดือน",
      "kpi": "Reach, Engagement, CTR",
      "pitfalls": ["ต้อง review ก่อนโพสต์", "ใช้ Brand Kit ให้ตรง"]
    },
    {
      "id": "wf-2",
      "name": "ตอบแชทลูกค้าอัตโนมัติ 80%",
      "type": "customer_service",
      "time_before": "3 ชม./วัน",
      "time_after": "30 นาที/วัน",
      "time_saved_pct": 83,
      "tools_used": ["LINE OA + ChatGPT"],
      "tools_cost_monthly": 500,
      "steps": [
        {
          "step": 1,
          "action": "รวม FAQ 20 ข้อ (ราคา, เวลาเปิด, ที่จอดรถ, etc.)",
          "duration": "1 ครั้งต่อเดือน",
          "output": "FAQ list"
        },
        {
          "step": 2,
          "action": "ตั้ง LINE OA Auto-reply ให้ตอบ FAQ อัตโนมัติ",
          "duration": "1 ชม.",
          "output": "LINE OA bot"
        },
        {
          "step": 3,
          "action": "ตอบเฉพาะคำถามที่ bot ตอบไม่ได้",
          "duration": "30 นาที/วัน",
          "output": "Customer satisfied"
        }
      ],
      "frequency": "ทุกวัน",
      "kpi": "Response time, CSAT",
      "pitfalls": ["อย่าให้ bot ตอบทุกอย่าง — คนซับซ้อนต้องคน"]
    },
    {
      "id": "wf-3",
      "name": "วิเคราะห์รีวิวลูกค้า ทุกสัปดาห์",
      "type": "research",
      "time_before": "2 ชม./สัปดาห์",
      "time_after": "15 นาที/สัปดาห์",
      "time_saved_pct": 87,
      "tools_used": ["Claude API"],
      "tools_cost_monthly": 300,
      "steps": [
        {
          "step": 1,
          "action": "Export รีวิวจาก Google/Facebook/Wongnai ทุกสัปดาห์",
          "duration": "5 นาที",
          "output": "CSV"
        },
        {
          "step": 2,
          "action": "Paste ใน Claude + prompt 'วิเคราะห์ sentiment + สรุป pain point'",
          "duration": "10 นาที",
          "output": "Insights + action items"
        }
      ],
      "frequency": "ทุกสัปดาห์",
      "kpi": "Sentiment score, Action items",
      "pitfalls": ["ต้องเก็บรีวิวอย่างสม่ำเสมอ"]
    }
  ],
  "voice_guide": {
    "tone": "Friendly + Knowledgeable — เหมือนเพื่อนที่เป็นเทรนเนอร์",
    "do": [
      "ประโยคสั้น ไม่เกิน 15 คำ",
      "มีตัวเลข/ข้อมูลรองรับ",
      "พูดกับลูกค้าเหมือนเพื่อน"
    ],
    "dont": [
      "ห้ามใช้ 'ดีที่สุด', 'ครบวงจร'",
      "ไม่เกิน 3 emojis",
      "ไม่พูดถึงคู่แข่งตรงๆ"
    ],
    "sample_phrases": [
      "เคล็ดลับจากเชฟ: ...",
      "ลูกค้าบอกว่า: ...",
      "ความจริงที่หลายคนไม่รู้: ..."
    ]
  }
}
```

## Wizard UI Hints

- แสดงแต่ละ workflow เป็น card
- มี progress bar "Time saved: 83%"
- ปุ่ม "Add to My Workflows"
- Voice guide เป็น accordion

## Validation

- [ ] 3 workflows
- [ ] time_saved_pct ≥ 50% ทุกตัว
- [ ] total cost ≤ budget
- [ ] voice_guide มี do/dont/sample_phrases
