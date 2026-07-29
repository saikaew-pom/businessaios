# Step 7: KPI Dashboard + Action Plan

> **Output:** 5 KPIs + 30-day Action Plan + Dashboard structure
> **AI model recommended:** Claude Sonnet 4 (analytical)
> **Estimated tokens:** ~1,200 input + ~1,500 output = ~2,700 total
> **Estimated cost:** ~$0.02

## Variables

```
{brand_card}         - Brand Card
{positioning}        - Positioning
{current_metrics}    - ตัวเลขปัจจุบัน (ถ้ามี)
{goal_30}            - เป้า 30 วัน
{goal_90}            - เป้า 90 วัน
{business_type}      - ประเภทธุรกิจ
{monthly_revenue}    - รายได้ต่อเดือนปัจจุบัน
```

## Prompt Template

```markdown
# CONTEXT
คุณคือ Growth Marketing Analyst ที่ออกแบบ KPI dashboard ให้ SME ไทย
คุณเข้าใจว่า SME ไม่อยากดู dashboard 50 ตัว — แค่ 5 ตัวที่สำคัญจริง
คุณเขียน Action Plan ที่ทำได้จริง ไม่ใช่ทฤษฎี

# INPUT
## Business
- Brand: {brand_card}
- Positioning: {positioning}
- Type: {business_type}
- Monthly revenue: {monthly_revenue} บาท

## Goals
- 30 วัน: {goal_30}
- 90 วัน: {goal_90}

## Current Metrics (ถ้ามี)
{current_metrics}

# TASK
ออกแบบ:
1. 5 KPIs ที่ต้องวัด (เรียงตาม priority)
2. 30-day Action Plan (สัปดาห์ละอะไร)
3. Dashboard structure (Google Sheet template)

# KPI RULES
- 5 KPIs เท่านั้น (ไม่มากกว่า)
- แต่ละ KPI ต้อง actionable (ปรับได้)
- แต่ละ KPI ต้อง measurable (วัดได้)
- แต่ละ KPI มี target realistic (ไม่ใช่ 100x)
- ผสม leading + lagging indicators

# OUTPUT FORMAT (JSON)

```json
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
      "how_to_measure": "นับจาก LINE OA + Website form + Facebook inbox",
      "tool": "Google Sheet (manual) หรือ HubSpot Free",
      "frequency": "ทุกวันจันทร์",
      "owner": "Marketing",
      "action_if_below": "เพิ่ม content 2 ชิ้น/สัปดาห์ + ลง ad 1,000 บาท/สัปดาห์",
      "why_this_matters": "Lead = future revenue"
    }
  ],
  "action_plan_30d": {
    "week_1": {
      "theme": "Foundation",
      "tasks": [
        "ตั้ง Google Sheet dashboard",
        "เชื่อม LINE OA + Facebook",
        "กรอกข้อมูล KPI baseline"
      ],
      "outcome": "รู้ตัวเลขปัจจุบันทุกตัว"
    },
    "week_2": {
      "theme": "Awareness Push",
      "tasks": [
        "โพสต์ 5 ชิ้น/สัปดาห์ (ใช้ Content Calendar)",
        "ลง Facebook ad 500 บาท",
        "ทำ 1 Lead Magnet (PDF)"
      ],
      "outcome": "Reach 5,000+ คน"
    },
    "week_3": {
      "theme": "Conversion",
      "tasks": [
        "ตอบแชทภายใน 30 นาที",
        "Follow-up lead เก่า",
        "ทำ campaign โปรโมชั่น"
      ],
      "outcome": "Lead +30%"
    },
    "week_4": {
      "theme": "Optimize",
      "tasks": [
        "ดูข้อมูล 3 สัปดาห์",
        "ปรับ campaign ที่ไม่ work",
        "Scale ที่ work"
      ],
      "outcome": "ROAS ≥ 2x"
    }
  },
  "dashboard_template": {
    "tool": "Google Sheet",
    "tabs": [
      {
        "name": "Daily KPIs",
        "columns": ["Date", "Lead", "Conversion", "Revenue", "Notes"]
      },
      {
        "name": "Weekly Review",
        "columns": ["Week", "Lead Target", "Lead Actual", "Variance", "Actions"]
      },
      {
        "name": "Monthly Summary",
        "columns": ["Month", "Revenue", "Cost", "ROI", "Top Campaign", "Lessons"]
      }
    ],
    "auto_charts": [
      "Lead trend (line)",
      "Revenue by source (pie)",
      "Conversion funnel (bar)"
    ]
  },
  "review_ritual": {
    "daily": "เช็ค LINE + Facebook 5 นาที",
    "weekly": "ทุกจันทร์ 9:00 น. — review week",
    "monthly": "วันที่ 1 ของเดือน — review month + plan next"
  }
}
```

# CONSTRAINTS
- 5 KPIs เท่านั้น
- action_plan_30d มี 4 weeks
- ทุก KPI มี target_30d และ target_90d
- target realistic (1.5-3x current, ไม่ใช่ 10x)

# REASONING
อธิบาย:
1. ทำไม 5 KPIs นี้ (vs ตัวเลือกอื่น)
2. ทำไม target_30d นี้ realistic
3. ถ้าไม่ hit target ใน 30 วัน → ควรปรับอะไร
```

## Example Output

```json
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
      "how_to_measure": "นับจาก LINE OA add + Website form submit + Facebook inbox",
      "tool": "Google Sheet (manual)",
      "frequency": "ทุกวันจันทร์",
      "owner": "Marketing",
      "action_if_below": "เพิ่ม content 2 ชิ้น/สัปดาห์ + ลง ad 1,000 บาท/สัปดาห์",
      "why_this_matters": "Lead = future revenue (leading indicator)"
    },
    {
      "id": "kpi-2",
      "name": "Conversion Rate",
      "category": "lagging",
      "current": 8,
      "target_30d": 12,
      "target_90d": 18,
      "unit": "%",
      "how_to_measure": "(จำนวนลูกค้า / จำนวน lead) × 100",
      "tool": "Google Sheet",
      "frequency": "ทุกวันศุกร์",
      "owner": "Sales",
      "action_if_below": "ปรับ follow-up script + เพิ่ม social proof",
      "why_this_matters": "Conversion = ประสิทธิภาพการขาย"
    },
    {
      "id": "kpi-3",
      "name": "ต้นทุนต่อ Lead",
      "category": "leading",
      "current": 250,
      "target_30d": 180,
      "target_90d": 100,
      "unit": "บาท",
      "how_to_measure": "ค่าใช้จ่าย ad ทั้งหมด / จำนวน lead",
      "tool": "Facebook Ads Manager + Google Sheet",
      "frequency": "ทุกวันศุกร์",
      "owner": "Marketing",
      "action_if_below": "ปรับ targeting + creative + landing page",
      "why_this_matters": "ต้นทุนต่ำ = scale ได้"
    },
    {
      "id": "kpi-4",
      "name": "รายได้ต่อสัปดาห์",
      "category": "lagging",
      "current": 35000,
      "target_30d": 50000,
      "target_90d": 100000,
      "unit": "บาท",
      "how_to_measure": "สรุปจาก POS + delivery platform",
      "tool": "POS + Google Sheet",
      "frequency": "ทุกวันอาทิตย์",
      "owner": "Owner",
      "action_if_below": "เพิ่ม promotion + ขยายช่องทางขาย",
      "why_this_matters": "Bottom line"
    },
    {
      "id": "kpi-5",
      "name": "Repeat Customer Rate",
      "category": "lagging",
      "current": 15,
      "target_30d": 25,
      "target_90d": 40,
      "unit": "%",
      "how_to_measure": "(ลูกค้าที่กลับมา / ลูกค้าทั้งหมด) × 100",
      "tool": "POS + Google Sheet",
      "frequency": "ทุกเดือน",
      "owner": "Customer Success",
      "action_if_below": "ทำ loyalty program + LINE remarketing",
      "why_this_matters": "Retention ถูกกว่า acquisition 5-7 เท่า"
    }
  ],
  "action_plan_30d": {
    "week_1": {
      "theme": "Foundation",
      "tasks": [
        "ตั้ง Google Sheet dashboard (ใช้ template)",
        "เชื่อม LINE OA + Facebook Page",
        "กรอก baseline KPI 5 ตัว",
        "ตั้ง reminder ทุกวันจันทร์ 9:00"
      ],
      "outcome": "รู้ตัวเลขปัจจุบันทุกตัว"
    },
    "week_2": {
      "theme": "Awareness Push",
      "tasks": [
        "โพสต์ 5 ชิ้น/สัปดาห์ (ใช้ Content Calendar)",
        "ลง Facebook ad 500 บาท/วัน",
        "สร้าง Lead Magnet (PDF) — 1 ชิ้น",
        "ทำ LINE OA welcome message"
      ],
      "outcome": "Reach 5,000+ คน / Lead 20+ คน"
    },
    "week_3": {
      "theme": "Conversion",
      "tasks": [
        "ตอบแชทภายใน 30 นาที",
        "Follow-up lead เก่า (ทุกคน)",
        "ทำ campaign โปรโมชั่น",
        "ขอ testimonial จากลูกค้าแรก"
      ],
      "outcome": "Conversion 12%+ / Lead 30+ คน"
    },
    "week_4": {
      "theme": "Optimize",
      "tasks": [
        "ดูข้อมูล 3 สัปดาห์",
        "ปรับ campaign ที่ไม่ work (kill)",
        "Scale ที่ work (เพิ่มงบ 2 เท่า)",
        "วางแผนเดือนถัดไป"
      ],
      "outcome": "ROAS ≥ 2x / Cost per lead < 180 บาท"
    }
  },
  "dashboard_template": {
    "tool": "Google Sheet (link to template)",
    "tabs": [
      {
        "name": "Daily KPIs",
        "columns": ["Date", "Lead", "Conversion", "Revenue", "Cost", "Notes"]
      },
      {
        "name": "Weekly Review",
        "columns": ["Week", "Lead Target", "Lead Actual", "Conversion Target", "Conversion Actual", "Variance", "Actions"]
      },
      {
        "name": "Monthly Summary",
        "columns": ["Month", "Revenue", "Cost", "ROI", "Top Campaign", "Top Content", "Lessons"]
      }
    ],
    "auto_charts": [
      "Lead trend (line chart)",
      "Revenue by source (pie chart)",
      "Conversion funnel (bar chart)"
    ]
  },
  "review_ritual": {
    "daily": "9:00 เช็ค LINE + Facebook (5 นาที)",
    "weekly": "จันทร์ 9:00 review week + plan",
    "monthly": "วันที่ 1 ของเดือน review + plan"
  }
}
```

## Wizard UI Hints

- แสดง 5 KPIs เป็น cards
- ปุ่ม "Copy Dashboard Template" (Google Sheet link)
- 30-day plan เป็น timeline (4 weeks)
- Review ritual เป็น checklist

## Validation

- [ ] 5 KPIs
- [ ] แต่ละ KPI มี target_30d และ target_90d
- [ ] target realistic (1.5-3x current)
- [ ] action_plan มี 4 weeks
- [ ] มี review_ritual
