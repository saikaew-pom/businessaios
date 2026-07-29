# Step 1: Business DNA → Brand Card

> **Output:** Brand Card 5 ข้อ (positioning, UVP, target, voice, anti-positioning)
> **AI model recommended:** Claude Sonnet 4 (reasoning) or GPT-4o
> **Estimated tokens:** ~1,500 input + ~1,000 output = ~2,500 total
> **Estimated cost (Claude Sonnet):** ~$0.02

## Variables

The wizard collects these from the user:

```
{business_name}      - ชื่อธุรกิจ
{business_type}      - ประเภทธุรกิจ (ร้านอาหาร/คลินิก/ร้านค้าออนไลน์/บริการ/etc.)
{industry}           - อุตสาหกรรม (F&B/Health/Retail/Real Estate/etc.)
{location}           - ที่ตั้ง (กรุงเทพ/เชียงใหม่/ออนไลน์/etc.)
{customer_age}       - อายุลูกค้า (เช่น 25-40)
{customer_job}       - อาชีพลูกค้า (เช่น พนักงานออฟฟิศ/แม่บ้าน/etc.)
{customer_income}    - รายได้ (เช่น 25,000-50,000 บาท/เดือน)
{pain_point_1}       - Pain point หลักข้อ 1
{pain_point_2}       - Pain point หลักข้อ 2
{pain_point_3}       - Pain point หลักข้อ 3
{differentiation}    - จุดต่างจากคู่แข่ง (ถ้ามี)
{competitor_1}       - คู่แข่งหลัก 1
{competitor_2}       - คู่แข่งหลัก 2
{competitor_3}       - คู่แข่งหลัก 3
{price_range}        - ช่วงราคา (ถูก/กลาง/แพง)
{current_marketing}  - ทำการตลาดอะไรอยู่ตอนนี้
{goal}               - เป้าหมาย 3 เดือน
```

## Prompt Template

```markdown
# CONTEXT
คุณคือ Marketing Strategist ที่มีประสบการณ์ 20 ปีในการสร้าง Brand Card ให้ SME ไทย
คุณเข้าใจ pain point คนไทย ตลาดไทย และ platform ไทย (Facebook, LINE, TikTok)
คุณเขียนแบบชัด กระชับ ไม่เยอะ ใช้ภาษาที่ ป.6 อ่านเข้าใจ

# BUSINESS INFO
- ชื่อธุรกิจ: {business_name}
- ประเภท: {business_type}
- อุตสาหกรรม: {industry}
- ที่ตั้ง: {location}

# TARGET CUSTOMER
- อายุ: {customer_age}
- อาชีพ: {customer_job}
- รายได้: {customer_income}

# PAIN POINTS (3 ข้อหลัก)
1. {pain_point_1}
2. {pain_point_2}
3. {pain_point_3}

# COMPETITORS
- {competitor_1}
- {competitor_2}
- {competitor_3}

# OTHER
- จุดต่างจากคู่แข่ง: {differentiation}
- ช่วงราคา: {price_range}
- การตลาดปัจจุบัน: {current_marketing}
- เป้าหมาย 3 เดือน: {goal}

# TASK
สร้าง Brand Card 5 ข้อ ที่จะใช้เป็น foundation ของ marketing system

# OUTPUT FORMAT
ส่งออกเป็น JSON ตาม schema นี้:

```json
{
  "positioning": "ประโยคเดียว บอกว่าธุรกิจนี้คือใคร + ทำอะไร + ใครใช้ + ต่างจากใคร",
  "uvp": "Unique Value Proposition — ข้อเสนอเฉพาะที่ลูกค้าจะได้รับ",
  "target_audience": "คำอธิบายลูกค้า 2-3 ประโยค ให้เห็นภาพชัด",
  "voice_tone": "สไตล์การสื่อสาร (เช่น friendly+professional / playful+casual)",
  "anti_positioning": "ลูกค้าที่ไม่ใช่ target (เพื่อให้ focus)"
}
```

# CONSTRAINTS
- ใช้ภาษาไทย
- แต่ละข้อไม่เกิน 2-3 ประโยค
- ห้ามใช้คำว่า "ดีที่สุด", "ครบวงจร", "มืออาชีพ" (overused)
- ห้ามเดา — ถ้าไม่มีข้อมูลให้ใช้ 'ค่าเริ่มต้นสมมติฐาน' แล้วบอก user
- ให้ reasoning สั้นๆ ใน `reasoning` field ว่าทำไมเลือกแบบนี้

# REASONING
ในขั้นตอนนี้ ให้อธิบายสั้นๆ ว่าทำไมเลือก positioning นี้ (1-2 ประโยค)
```

## Example Output

```json
{
  "reasoning": "วงการ F&B ในกรุงเทพแข่งขันสูง ต้องเน้น differentiation ที่ชัดเจน — เลือก niche 'ร้านก๋วยเตี๋ยวสำหรับคนรักสุขภาพ' เพราะ pain point หลักคือ 'อยากกิน comfort food แต่กลัวอ้วน'",
  "positioning": "ร้านก๋วยเตี๋ยว low-carb แห่งแรกในย่านอโศก สำหรับคนออฟฟิศอายุ 28-40 ที่อยากกิน comfort food โดยไม่ทำลายสุขภาพ",
  "uvp": "เส้น shirataki + น้ำซุปโฮมเมด 0 MSG + โปรตีนจากอกไก่ — ได้รสชาติเข้มข้น แต่แค่ 280 kcal ต่อจาน",
  "target_audience": "พนักงานออฟฟิศและเจ้าของกิจการ 28-40 ปี รายได้ 40,000-100,000 บาท ใช้เวลากลางวันย่านอโศก-ทองหล่อ ต้องการอาหารจานเดียวจบ รวดเร็ว และไม่ทำลายเป้า fitness",
  "voice_tone": "Friendly + Knowledgeable — พูดเหมือนเพื่อนที่เป็นเทรนเนอร์ส่วนตัว ใช้ emoji ได้ ไม่ทางการเกินไป แต่มีข้อมูลโภชนาการเสมอ",
  "anti_positioning": "ไม่ใช่ร้านสำหรับครอบครัวที่มีเด็กเล็ก / ไม่ใช่ร้านราคาถูกสำหรับนักศึกษา / ไม่เน้น takeaway ส่ง Grab"
}
```

## Validation Checklist (UI)

- [ ] Positioning มี 4 elements: ใคร + ทำอะไร + ให้ใคร + ต่างจากใคร
- [ ] UVP เป็น outcome-based (ไม่ใช่ feature-based)
- [ ] Target audience เฉพาะเจาะจง (ไม่ใช่ "คนทั่วไป")
- [ ] Voice/tone มี 2 คำ characteristic
- [ ] Anti-positioning ช่วยให้ focus

## Regeneration Trigger

ถ้า user ไม่พอใจ → regenerate โดย:
- เปลี่ยน tone เป็น more bold / more safe
- เปลี่ยน angle ของ differentiation
- ใช้ persona ที่แตกต่าง

## A/B Test Variants

- Variant A: Premium positioning (เน้นคุณภาพ)
- Variant B: Accessible positioning (เน้นราคา)
- Variant C: Niche positioning (เน้นกลุ่มเฉพาะ)
