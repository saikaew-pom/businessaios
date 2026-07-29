# Step 4: Positioning

> **Output:** Positioning Statement + UVP + Tagline
> **AI model recommended:** Claude Sonnet 4 (strategic)
> **Estimated tokens:** ~1,800 input + ~1,200 output = ~3,000 total
> **Estimated cost:** ~$0.025

## Variables

```
{brand_card}         - Brand Card จาก Step 1 (JSON)
{personas}           - Personas จาก Step 2 (JSON)
{competitor_1}       - คู่แข่ง 1 + positioning เขา
{competitor_2}       - คู่แข่ง 2 + positioning เขา
{competitor_3}       - คู่แข่ง 3 + positioning เขา
{price_position}     - ตำแหน่งราคา (premium / mid / budget)
{goal}               - เป้าหมาย
```

## Prompt Template

```markdown
# CONTEXT
คุณคือ Brand Strategist ที่เชี่ยวชาญ Positioning (ตามแนวคิด Ries/Trout + April Dunford)
คุณช่วย SME ไทยหา "ตำแหน่ง" ในใจลูกค้า — ไม่ใช่แค่ "เราดี"
คุณเขียน positioning statement ที่ใช้ได้จริง ไม่ใช่แค่สวยหรู

# INPUT
## Brand Card
{brand_card}

## Personas
{personas}

## Competitors
1. {competitor_1}
2. {competitor_2}
3. {competitor_3}

## Constraints
- ตำแหน่งราคา: {price_position}
- เป้าหมาย: {goal}

# TASK
สร้าง Positioning Statement ที่:
1. บอกชัดว่า "เราเป็นใคร"
2. บอกชัดว่า "เราเหมาะกับใคร"
3. บอกชัดว่า "เราต่างจากคู่แข่งยังไง"
4. บอกชัดว่า "ลูกค้าจะได้อะไร"
5. มีหลักฐานรองรับ

# OUTPUT FORMAT (JSON)

```json
{
  "positioning_statement": "ประโยคเต็ม 2-3 ประโยค ที่ใช้ภายในทีม",
  "positioning_one_liner": "1 ประโยค ใช้ในการแนะนำตัว",
  "uvp_bullets": [
    "จุดขาย 1 — 1 ประโยค",
    "จุดขาย 2 — 1 ประโยค",
    "จุดขาย 3 — 1 ประโยค"
  ],
  "tagline_options": [
    "ก๋วยเตี๋ยวอร่อยได้ ไม่ทำลายเป้า",
    "Comfort Food ที่ไม่ต้องสูญเสีย",
    "กินอร่อย ออกกำลังกายต่อ"
  ],
  "competitive_frame": {
    "vs_competitor_1": "เรา X / เขา Y",
    "vs_competitor_2": "เรา X / เขา Y",
    "vs_competitor_3": "เรา X / เขา Y"
  },
  "proof_points": [
    "เคยเป็นเชฟที่ร้าน 5 ดาว 10 ปี",
    "ลูกค้า 1,000+ คน",
    "ผ่านมาตรฐาน อย. + GMP"
  ],
  "elevator_pitch": "30 วินาที — ใช้ตอน networking"
}
```

# CONSTRAINTS
- positioning_statement ต้องผ่าน "5-Second Test" (คนทั่วไปอ่านแล้วเข้าใจใน 5 วิ)
- tagline ไม่เกิน 8 คำ
- ห้ามใช้ "ดีที่สุด", "ครบวงจร", "มืออาชีพ", "คุณภาพสูง" (overused)
- ใช้ภาษาไทย
- proof_points ต้องเป็นข้อเท็จจริง (ถ้าไม่มี → เขียน "ต้องเก็บข้อมูลเพิ่ม")

# REASONING
อธิบาย:
1. ทำไมเลือก positioning นี้ (vs ตัวเลือกอื่น)
2. ตำแหน่งนี้แข่งได้จริงไหม (ถ้าแข่งไม่ได้ → แนะนำเปลี่ยน)
3. ความเสี่ยงของ positioning นี้
```

## Example Output

```json
{
  "positioning_statement": "สำหรับคนออฟฟิศย่านอโศก-ทองหล่อที่อยากกิน comfort food แต่กลัวทำลายเป้า fitness, ก๋วยเตี๋ยวบ้านหมูเป็นร้านเดียวที่ใช้เส้น shirataki + น้ำซุปโฮมเมด 0 MSG ที่ให้รสชาติเข้มข้นเทียบเท่าร้านดัง แต่แค่ 280 kcal — ต่างจากร้าน healthy อื่นที่รสชาติจืดชืด และต่างจากร้านก๋วยเตี๋ยวทั่วไปที่แคลสูง",
  "positioning_one_liner": "ก๋วยเตี๋ยวอร่อยเข้มข้น สำหรับคนรักสุขภาพ ไม่ต้องเลือกระหว่างรสชาติกับเป้า",
  "uvp_bullets": [
    "เส้น shirataki 0 แคล + โปรตีน 30g ต่อชาม — อิ่มนาน ไม่ทำลายเป้า",
    "น้ำซุปโฮมเมด 0 MSG — กินบ่อยได้ ไม่บวม",
    "รสชาติเทียบร้านดัง — ไม่ใช่ร้าน healthy ที่จืดชืด"
  ],
  "tagline_options": [
    "กินอร่อย ออกกำลังกายต่อ",
    "Comfort Food ไม่ทำลายเป้า",
    "รสชาติเข้ม แคลเบา"
  ],
  "competitive_frame": {
    "vs_competitor_1": "เรา: รสชาติเข้มข้น / เขา: จืดชืด healthy",
    "vs_competitor_2": "เรา: 280 kcal / เขา: 450 kcal",
    "vs_competitor_3": "เรา: ส่ง 25 นาที / เขา: ต้องไปกินที่ร้าน"
  },
  "proof_points": [
    "เชฟเจ้าของร้านเคยทำงานที่ iberry + Bonca",
    "ลูกค้าประจำ 800+ คน ใน 6 เดือน",
    "ผ่านมาตรฐาน อย. + Clean Food Standard",
    "Featured ใน The Standard, Wongnai"
  ],
  "elevator_pitch": "ก๋วยเตี๋ยวบ้านหมูคือร้านก๋วยเตี๋ยว low-carb แห่งแรกในย่านอโศก ใช้เส้น shirataki 0 แคล + น้ำซุปโฮมเมด รสชาติเทียบร้านดัง แต่แค่ 280 kcal เหมาะกับคนออฟฟิศที่อยากกิน comfort food แต่กลัวทำลายเป้า fitness ใน 6 เดือนเรามีลูกค้าประจำ 800 คน และขยายไปสาขาที่ 2 ในทองหล่อ"
}
```

## Wizard UI Hints

- แสดง positioning statement เป็น callout ใหญ่
- Tagline เป็น cards 3 ใบ ให้เลือก
- Competitive frame เป็น table
- ปุ่ม "Try A/B Variants" → เปลี่ยน tone

## Validation

- [ ] Positioning statement มี 4 elements (ใคร / ทำอะไร / ให้ใคร / ต่างจากใคร)
- [ ] Tagline ไม่เกิน 8 คำ
- [ ] Proof points ≥ 2
- [ ] Elevator pitch ≤ 100 คำ
- [ ] 5-Second Test: คนทั่วไปอ่านแล้วเข้าใจ
