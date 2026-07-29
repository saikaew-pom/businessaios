# Step 2: Customer Persona

> **Output:** Persona 3 แบบ พร้อม quote จริง
> **AI model recommended:** Claude Sonnet 4 (analytical)
> **Estimated tokens:** ~3,000 input (reviews) + ~2,000 output = ~5,000 total
> **Estimated cost:** ~$0.04

## Variables

```
{business_name}      - ชื่อธุรกิจ
{industry}           - อุตสาหกรรม
{reviews_text}       - รีวิว/ข้อความจากลูกค้าจริง 50-100 รีวิว
{sales_data}         - ข้อมูลการขาย (optional, ถ้ามี)
{age_range}          - อายุลูกค้า
{location}           - ที่อยู่ลูกค้า
```

## Prompt Template

```markdown
# CONTEXT
คุณคือ Customer Research Specialist ที่เชี่ยวชาญการวิเคราะห์ persona จากข้อมูลจริง
คุณเข้าใจ SME ไทย พฤติกรรมคนไทย และ platform สังคมออนไลน์ไทย
คุณไม่เดา — ใช้แต่ข้อมูลจริงที่ user ให้

# BUSINESS CONTEXT
- ธุรกิจ: {business_name}
- อุตสาหกรรม: {industry}
- อายุลูกค้า (โดยรวม): {age_range}
- ที่ตั้ง: {location}

# RAW DATA (จากลูกค้าจริง)
นี่คือรีวิว/ข้อความ/feedback จากลูกค้า {reviews_text}

{sales_data}

# TASK
วิเคราะห์ raw data แล้วสร้าง Persona 3 แบบ
- Persona 1 = ลูกค้าหลัก (50%+ ของยอดขาย)
- Persona 2 = ลูกค้าโอกาส (20-30% — เติบโตได้)
- Persona 3 = ลูกค้า surprise (10-20% — ไม่คาดคิด)

# OUTPUT FORMAT (JSON)

```json
{
  "personas": [
    {
      "name": "ชื่อ persona (เช่น 'พี่หมู - พนักงานออฟฟิศสายสุขภาพ')",
      "demographics": {
        "age": "28-35",
        "job": "Product Manager",
        "income": "40,000-70,000 บาท/เดือน",
        "location": "กรุงเทพ ย่านอโศก-ทองหล่อ",
        "family": "โสด/มีแฟน/มีลูก 1 คน"
      },
      "psychographics": {
        "values": "สุขภาพ + ความสำเร็จ + work-life balance",
        "interests": "Fitness, healthy food, productivity",
        "fears": "กลัวแก่ก่อนวัย, กลัว burnout",
        "aspirations": "อยากดูดีในวัย 40, อยากมีเวลาเที่ยว"
      },
      "pain_points": [
        "ไม่มีเวลาทำอาหาร",
        "อาหารเดลิเวอรี่ไม่สุขภาพ",
        "เทรนเนอร์บอกให้คุมอาหารแต่ทำไม่ได้"
      ],
      "preferred_channels": ["Instagram", "Facebook", "LINE"],
      "key_quotes": [
        "อยากกินอร่อยแต่ไม่อ้วน",
        "เบื่อสลัดทุกมื้อ",
        "ก๋วยเตี๋ยว low-carb นี่แหละคำตอบ"
      ],
      "motivators": ["ผลลัพธ์ที่วัดได้", "ความสะดวก", "รสชาติ"],
      "objections": ["แพงไป", "เส้นจะอร่อยจริงเหรอ"],
      "best_offer": "ลองชามแรก 99 บาท (จาก 159)",
      "size_estimate": "50% ของลูกค้า"
    }
  ],
  "insights": [
    "75% ของลูกค้าพูดถึง 'สุขภาพ' ในรีวิว",
    "Pain point หลักคือ 'ไม่มีเวลา' ไม่ใช่ 'ราคา'",
    "Pain point #2 คือ 'ไม่อร่อย' — เป็นจุดต่างจากร้าน healthy อื่น"
  ]
}
```

# CONSTRAINTS
- ใช้ภาษาไทย
- key_quotes ต้องเป็น quote จริงจาก raw data (ห้ามแต่ง)
- ถ้า raw data ไม่พอ — บอกใน `insights` และใช้ assumption ที่ conservative
- แต่ละ persona มี key_quotes อย่างน้อย 2 quotes
- preferred_channels ต้องมีเหตุผล (เช่น "Instagram เพราะดู food porn")

# REASONING
อธิบายสั้นๆ ว่า:
1. ทำไมแบ่งเป็น 3 persona แบบนี้
2. ทำไม persona 1 เป็น main
3. มี edge case ไหนที่ user ควรระวัง
```

## Example Output

```json
{
  "personas": [
    {
      "name": "พี่หมู - พนักงานออฟฟิศสายสุขภาพ",
      "demographics": {
        "age": "28-35",
        "job": "Product Manager / Marketing Manager",
        "income": "40,000-70,000 บาท/เดือน",
        "location": "กรุงเทพ ย่านอโศก-ทองหล่อ-อรุณอัมรินทร์",
        "family": "โสดหรือมีแฟน ไม่มีลูก"
      },
      "psychographics": {
        "values": "สุขภาพ + ความก้าวหน้า + work-life balance",
        "interests": "Gym, marathon, healthy cooking, productivity",
        "fears": "เผละเป็นพุง, แก่ก่อนวัย, ไม่มีเวลา",
        "aspirations": "ดูดีตอนอายุ 40, มี passive income, เที่ยวต่างประเทศ"
      },
      "pain_points": [
        "ทำอาหารเองไม่เป็น / ไม่มีเวลา",
        "เดลิเวอรี่อร่อยแต่ไม่สุขภาพ",
        "เทรนเนอร์บอกให้คุมอาหาร แต่กินอะไรก็ไม่อร่อย"
      ],
      "preferred_channels": [
        "Instagram (ดู food porn + เทรนเนอร์แนะนำ)",
        "Facebook (community fitness + รีวิว)",
        "LINE (สั่งอาหาร)"
      ],
      "key_quotes": [
        "กินคลีนมาสามเดือน เบื่อมาก",
        "อยากกินก๋วยเตี๋ยวแต่กลัวแคล",
        "เจอร้านนี้เหมือนฝันเป็นจริง"
      ],
      "motivators": ["ผลลัพธ์ที่วัดได้ (แคล/โปรตีน)", "ไม่ต้องเสียสละรสชาติ", "สะดวก"],
      "objections": ["159 บาท แพงกว่าร้านก๋วยเตี๋ยวทั่วไป", "เส้น shirataki จะอร่อยจริงเหรอ"],
      "best_offer": "ลองชามแรก 99 บาท (จาก 159)",
      "size_estimate": "55% ของลูกค้า"
    }
  ],
  "insights": [
    "80% ของรีวิวพูดถึงคำว่า 'สุขภาพ' หรือ 'แคลอรี่'",
    "Pain point หลักไม่ใช่ราคา แต่เป็น 'ไม่มีเวลา + ไม่อร่อย'",
    "มี mention ของ 'เทรนเนอร์แนะนำ' บ่อย → ควร partnership กับ fitness studio"
  ]
}
```

## Wizard UI Hints

- Show textarea สำห�ับ paste reviews (min 20 reviews)
- ถ้าไม่มี reviews → แนะนำให้เก็บก่อน (1 สัปดาห์) แล้วค่อยทำ Step นี้
- Optional: upload CSV from Google Forms / Typeform

## Validation

- [ ] มี 3 personas
- [ ] แต่ละ persona มี key_quotes ≥ 2
- [ ] key_quotes เป็น quote จริง (cross-check กับ input)
- [ ] Demographics เฉพาะเจาะจง (ไม่ใช่ "คนทั่วไป")
- [ ] Pain points เชื่อมโยงกับ Brand Card
