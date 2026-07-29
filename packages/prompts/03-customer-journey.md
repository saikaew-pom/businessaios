# Step 3: Customer Journey

> **Output:** Customer Journey 5 จุด พร้อม emotion curve
> **AI model recommended:** Claude Sonnet 4 (empathy + structure)
> **Estimated tokens:** ~2,500 input + ~1,800 output = ~4,300 total
> **Estimated cost:** ~$0.03

## Variables

```
{business_name}      - ชื่อธุรกิจ
{persona_1}          - Persona หลัก (from Step 2)
{persona_2}          - Persona รอง
{goal}               - Conversion goal (เช่น ซื้อครั้งแรก / subscribe / line add)
{product_price}      - ราคาสินค้า
{current_funnel}     - Funnel ปัจจุบัน (ถ้ามี)
```

## Prompt Template

```markdown
# CONTEXT
คุณคือ Customer Experience Designer ที่ออกแบบ customer journey ให้ SME ไทย
คุณเข้าใจ touchpoint ทั้งออนไลน์และออฟไลน์ของคนไทย
คุณเขียนอารมณ์/ความรู้สึกได้ชัดเจน ไม่ใช่แค่ "รู้สึกดี"

# BUSINESS
- ธุรกิจ: {business_name}
- Conversion goal: {goal}
- ราคาเฉลี่ย: {product_price}
- Funnel ปัจจุบัน: {current_funnel}

# PERSONAS (จาก Step 2)
## Persona 1 (หลัก)
{persona_1}

## Persona 2 (รอง)
{persona_2}

# TASK
ออกแบบ Customer Journey 5 จุดสำหรับ Persona 1
- จุดที่ 1: Awareness (รู้จักครั้งแรก)
- จุดที่ 2: Consideration (เปรียบเทียบ)
- จุดที่ 3: Decision (ตัดสินใจ)
- จุดที่ 4: Action (ซื้อ/สั่ง)
- จุดที่ 5: Loyalty (กลับมาซื้อซ้ำ)

# OUTPUT FORMAT (JSON)

```json
{
  "journey": [
    {
      "stage": "awareness",
      "stage_name_th": "รู้จักครั้งแรก",
      "touchpoints": [
        "เห็นโฆษณา Instagram ตอนเลื่อนฟีด",
        "เพื่อนแชร์ใน LINE group",
        "Google search 'ก๋วยเตี๋ยว low carb'"
      ],
      "emotions": {
        "primary": "อยากรู้",
        "secondary": "สงสัย",
        "pain": "ไม่แน่ใจว่าจะอร่อยไหม",
        "quote": "โอ้ มีก๋วยเตี๋ยว low-carb ด้วย น่าลอง"
      },
      "key_message": "ก๋วยเตี๋ยวอร่อยได้โดยไม่ทำลายเป้า fitness",
      "kpi": "impressions, reach, CTR",
      "content_types": ["Reels", "Carousel IG", "LINE ad"]
    }
  ],
  "pain_points": [
    {
      "stage": "decision",
      "pain": "กลัวเสียเงินฟรี 159 บาท ถ้าไม่อร่อย",
      "solution": "มี trial 99 บาท + คืนเงินถ้าไม่ชอบ"
    }
  ],
  "emotion_curve": {
    "description": "อารมณ์ขึ้นลงตลอด journey",
    "data": [
      {"stage": "awareness", "emotion_score": 3, "label": "curious"},
      {"stage": "consideration", "emotion_score": 4, "label": "interested"},
      {"stage": "decision", "emotion_score": 2, "label": "hesitant"},
      {"stage": "action", "emotion_score": 5, "label": "excited"},
      {"stage": "loyalty", "emotion_score": 6, "label": "delighted"}
    ]
  },
  "opportunities": [
    "ช่วง decision → ควรมี social proof ชัด (รีวิว 50+ ดาว)",
    "ช่วง loyalty → ทำ referral program (แนะนำเพื่อนได้ 100 บาท)"
  ]
}
```

# CONSTRAINTS
- emotions.quote ต้องเป็นภาษาที่คนไทยพูดจริงๆ
- pain_points ต้องระบุ stage ที่เจอ
- opportunities ต้อง actionable (ทำได้จริงใน 1 เดือน)
- emotion_curve เป็น 1-10 (1=แย่, 10=ดีมาก)

# REASONING
อธิบาย:
1. ทำไม persona 1 เป็น focus
2. journey นี้ต่างจาก B2C ทั่วไปยังไง
3. จุดไหนที่ควรใส่ใจเป็นพิเศษ
```

## Example Output

```json
{
  "journey": [
    {
      "stage": "awareness",
      "stage_name_th": "รู้จักครั้งแรก",
      "touchpoints": [
        "Instagram Reel — คลิปก๋วยเตี๋ยวหน้าตาดี",
        "LINE OA ad",
        "Google Maps search",
        "Word of mouth ในกลุ่ม fitness"
      ],
      "emotions": {
        "primary": "อยากรู้",
        "secondary": "สงสัย",
        "pain": "เส้น shirataki จะอร่อยจริงเหรอ?",
        "quote": "โอ้ มีก๋วยเตี๋ยว low-carb ด้วยเหรอ น่าลอง"
      },
      "key_message": "ก๋วยเตี๋ยวอร่อยได้โดยไม่ทำลายเป้า fitness",
      "kpi": "Reach, Impressions, CTR, View-through",
      "content_types": ["Reels", "Carousel", "LINE ad"]
    },
    {
      "stage": "consideration",
      "stage_name_th": "เปรียบเทียบ",
      "touchpoints": [
        "เข้าเว็บไซต์",
        "อ่านรีวิว Google/Facebook",
        "ดูเมนู + แคลอรี่",
        "ถามใน LINE OA"
      ],
      "emotions": {
        "primary": "สนใจ",
        "secondary": "ลังเล",
        "pain": "ราคา 159 บาท สูงกว่าร้านปกติ 2 เท่า",
        "quote": "ดูน่าสนใจ แต่ราคาก็แพงอยู่นะ"
      },
      "key_message": "ลองชาม 99 บาท คืนเงินถ้าไม่ชอบ",
      "kpi": "Site visits, time on site, add to cart",
      "content_types": ["Landing page", "Review pages", "FAQ"]
    },
    {
      "stage": "decision",
      "stage_name_th": "ตัดสินใจ",
      "touchpoints": [
        "Chat กับพนักงาน",
        "ดูรีวิวจริง",
        "ถามเพื่อนที่เคยกิน"
      ],
      "emotions": {
        "primary": "ลังเล",
        "secondary": "กลัวผิดหวัง",
        "pain": "กลัวเสียเงินฟรี",
        "quote": "เอาเหอะ ลองดูสักชาม ถ้าไม่ดีค่อยไม่กลับมา"
      },
      "key_message": "ประหยัด 60 บาท + รับประกัน",
      "kpi": "Conversion rate, cart abandonment",
      "content_types": ["Trust badges", "Money-back guarantee", "Live chat"]
    },
    {
      "stage": "action",
      "stage_name_th": "สั่งอาหาร",
      "touchpoints": [
        "กดสั่ง LINE",
        "จ่ายเงิน",
        "รอรับอาหาร"
      ],
      "emotions": {
        "primary": "ตื่นเต้น",
        "secondary": "หิว",
        "pain": "รอนาน",
        "quote": "หวานของฉันมาแล้ว!"
      },
      "key_message": "จัดส่งใน 25 นาที",
      "kpi": "Order rate, delivery time, NPS",
      "content_types": ["Order confirmation", "Delivery tracking"]
    },
    {
      "stage": "loyalty",
      "stage_name_th": "กลับมาซื้อ",
      "touchpoints": [
        "LINE ส่งโปรโมชั่น",
        "คะแนนสะสม",
        "แนะนำเพื่อน"
      ],
      "emotions": {
        "primary": "พอใจ",
        "secondary": "ภักดี",
        "pain": "ลืมชื่อร้าน",
        "quote": "อร่อยมาก แนะนำเพื่อนไป 3 คนแล้ว"
      },
      "key_message": "สะสม 10 ชาม ฟรี 1 ชาม",
      "kpi": "Repeat rate, LTV, referral rate",
      "content_types": ["Loyalty program", "Referral code", "Newsletter"]
    }
  ],
  "pain_points": [
    {
      "stage": "consideration",
      "pain": "ราคาแพงกว่าร้านปกติ",
      "solution": "Emphasize value (โปรตีน/แคล/รสชาติ) ไม่ใช่แค่ราคา"
    },
    {
      "stage": "decision",
      "pain": "กลัวไม่อร่อย",
      "solution": "Trial + money-back guarantee"
    }
  ],
  "emotion_curve": {
    "description": "อารมณ์ขึ้นตอนเห็น, ลงตอนเปรียบเทียบราคา, ขึ้นหลังซื้อ",
    "data": [
      {"stage": "awareness", "emotion_score": 3, "label": "curious"},
      {"stage": "consideration", "emotion_score": 4, "label": "interested"},
      {"stage": "decision", "emotion_score": 2, "label": "hesitant"},
      {"stage": "action", "emotion_score": 5, "label": "excited"},
      {"stage": "loyalty", "emotion_score": 6, "label": "delighted"}
    ]
  },
  "opportunities": [
    "ช่วง decision → ใส่ live chat / LINE OA auto-reply ทันที ไม่ต้องรอ",
    "ช่วง loyalty → ทำ referral program (แนะนำเพื่อนได้ส่วนลด 100 บาท)",
    "ทุก stage → ใช้ user-generated content (UGC) จากลูกค้าจริง"
  ]
}
```

## Wizard UI Hints

- แสดง journey เป็น timeline (horizontal scroll)
- ให้คลิกแต่ละ stage เพื่อดูรายละเอียด
- Emotion curve แสดงเป็น line chart
- ปุ่ม "Export Journey as Image" (สำหรับ slide)

## Validation

- [ ] มี 5 stages
- [ ] แต่ละ stage มี touchpoints ≥ 2
- [ ] แต่ละ stage มี pain ที่ระบุชัด
- [ ] emotion_curve มี 5 data points
- [ ] opportunities ≥ 2 ข้อ
