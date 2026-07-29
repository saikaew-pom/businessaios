# Step 5: Content Calendar (30 days)

> **Output:** 30 content pieces (10/day × 30 days) with caption, hook, CTA
> **AI model recommended:** Claude Sonnet 4 (long-form + structured)
> **Estimated tokens:** ~2,500 input + ~4,500 output = ~7,000 total
> **Estimated cost:** ~$0.05

## Variables

```
{brand_card}         - Brand Card จาก Step 1
{personas}           - Personas จาก Step 2
{positioning}        - Positioning จาก Step 4
{channels}           - ช่องทางที่ใช้ (Facebook, Instagram, TikTok, LINE, etc.)
{posts_per_week}     - โพสต์/สัปดาห์ (เช่น 5)
{industry}           - อุตสาหกรรม
{special_dates}      - วันสำคัญในเดือนนี้ (optional)
```

## Prompt Template

```markdown
# CONTEXT
คุณคือ Content Strategist ที่เขียน content ให้ SME ไทย — เข้าใจ platform ไทย, ภาษาไทย, คนไทย
คุณเขียน caption ที่กระชับ ไม่เกิน 4-5 บรรทัด
คุณเขียน hook ที่ทำให้คนหยุด scroll
คุณรู้ว่า content แต่ละ platform ต่างกัน (FB ≠ IG ≠ TikTok)

# INPUT
## Brand Card
{brand_card}

## Personas
{personas}

## Positioning
{positioning}

## Channels
{channels}

## Cadence
โพสต์ {posts_per_week} ชิ้น/สัปดาห์ = 30 ชิ้น/เดือน

## Special Dates
{special_dates}

# CONTENT PILLARS (4 หมวด)
- 25% Awareness: สร้างการรับรู้
- 35% Education: สอน / ให้ความรู้
- 25% Social Proof: รีวิว / ผลลัพธ์ลูกค้า
- 15% Conversion: ขาย / โปรโมชั่น

# TASK
สร้าง Content Calendar 30 วัน โดย:
1. แต่ละชิ้นมี hook 3 คำ + caption 3-5 บรรทัด + CTA 1 ประโยค
2. แบ่ง platform ตามที่ user เลือก
3. กระจาย content pillar ตาม % ข้างบน

# OUTPUT FORMAT (JSON array of 30 items)

```json
{
  "calendar": [
    {
      "day": 1,
      "date_suggested": "2026-07-01",
      "pillar": "awareness",
      "platform": "instagram",
      "format": "reel",
      "hook": "ก๋วยเตี๋ยว 280 kcal",
      "caption": "กิน comfort food โดยไม่ทำลายเป้า fitness\n\nเส้น shirataki 0 แคล + น้ำซุปโฮมเมด\n\nใครเบื่อสลัดแล้วบ้าง 🙋",
      "cta": "กดลิงก์ใน bio ลองชาม 99 บาท",
      "hashtags": ["#ก๋วยเตี๋ยวlowcarb", "#healthyfood", "#กินดี"],
      "visual_suggestion": "คลิปก๋วยเตี๋ยวหน้าตาดี + เทียบแคลอรี่",
      "expected_engagement": "high"
    }
  ]
}
```

# CONSTRAINTS
- 30 items
- caption ไม่เกิน 200 คำ
- hook ไม่เกิน 5 คำ
- ใช้ภาษาไทย
- ห้ามมี emoji เกิน 3 ตัวต่อ caption (ยกเว้น IG/TikTok)
- hashtag ไม่เกิน 5 ตัว
- CTA ต้อง actionable (กด/สั่ง/สมัคร/แชร์)

# PLATFORM RULES
- Facebook: caption 3-4 บรรทัด, ไม่มี emoji เยอะ
- Instagram: caption ยาวได้, มี emoji ได้, hashtag 3-5
- TikTok: hook แรง, คลิป 15-60 วิ, caption สั้น
- LINE: text-based, ไม่มี hashtag

# REASONING
อธิบาย:
1. ทำไมเลือก content pillar นี้สำหรับวันนั้น
2. คาดว่า engagement จะเป็นยังไง
3. ถ้าไม่ได้ผล → ทางเลือกคืออะไร
```

## Example Output (5 samples)

```json
{
  "calendar": [
    {
      "day": 1,
      "pillar": "awareness",
      "platform": "instagram",
      "format": "reel",
      "hook": "ก๋วยเตี๋ยว 280 kcal",
      "caption": "กิน comfort food โดยไม่ทำลายเป้า fitness\n\nเส้น shirataki 0 แคล + น้ำซุปโฮมเมด 0 MSG\n\nใครเบื่อสลัดแล้วบ้าง 🙋",
      "cta": "กดลิงก์ใน bio ลองชาม 99 บาท",
      "hashtags": ["#ก๋วยเตี๋ยวlowcarb", "#healthyfood", "#กินดี"],
      "visual_suggestion": "คลิปก๋วยเตี๋ยวหน้าตาดี เทียบข้างสลัด",
      "expected_engagement": "high"
    },
    {
      "day": 3,
      "pillar": "education",
      "platform": "facebook",
      "format": "post",
      "hook": "เส้น shirataki คืออะไร",
      "caption": "หลายคนถามว่าเส้น shirataki กินแล้วอร่อยไหม\n\nจริงๆ แล้วเส้น shirataki ทำมาจาก konjac (มันสำปะหลังญี่ปุ่น) แคล 0\n\nความลับคือน้ำซุปครับ ถ้าน้ำซุปอร่อย เส้นก็อร่อย",
      "cta": "แชร์ให้เพื่อนที่กำลังคุมน้ำหนัก",
      "hashtags": [],
      "visual_suggestion": "ภาพเส้น shirataki + ส่วนผสม",
      "expected_engagement": "medium"
    },
    {
      "day": 5,
      "pillar": "social_proof",
      "platform": "instagram",
      "format": "carousel",
      "hook": "ลูกค้าลด 3 กิโลใน 1 เดือน",
      "caption": "พี่หมูเป็นลูกค้าประจำมา 3 เดือน\n\nเค้าบอกว่า 'เปลี่ยนมื้อเย็นเป็นก๋วยเตี๋ยวบ้านหมู ลดไป 3 กิโล โดยไม่ต้องอดอาหาร'\n\nเค้าไม่ได้อด แค่เปลี่ยนทางเลือก",
      "cta": "อ่านรีวิวเพิ่มเติมที่ link",
      "hashtags": ["#ลดน้ำหนัก", "#healthy", "#ก๋วยเตี๋ยว"],
      "visual_suggestion": "Before/After + quote ลูกค้า",
      "expected_engagement": "high"
    },
    {
      "day": 7,
      "pillar": "conversion",
      "platform": "line",
      "format": "broadcast",
      "hook": "ส่วนลด 50 บาท วันนี้เท่านั้น",
      "caption": "วันนี้เท่านั้น! ก๋วยเตี๋ยวบ้านหมู ลด 50 บาท จาก 159 เหลือ 109\n\nใช้โค้ด: FRESH50\n\n⏰ หมดเขต เที่ยงคืน",
      "cta": "กดสั่งเลย",
      "hashtags": [],
      "visual_suggestion": "ภาพชามก๋วยเตี๋ยว + โค้ด",
      "expected_engagement": "high"
    },
    {
      "day": 9,
      "pillar": "awareness",
      "platform": "tiktok",
      "format": "video",
      "hook": "POV: เจอก๋วยเตี๋ยว low-carb",
      "caption": "เข้าใจเลย ในที่สุดก็มีคนทำ",
      "cta": "ตามไปกินเลย",
      "hashtags": ["#foodtok", "#healthy", "#ก๋วยเตี๋ยว"],
      "visual_suggestion": "POV style, คนเดินเข้าร้าน + ปฏิกิริยา",
      "expected_engagement": "high"
    }
  ]
}
```

## Wizard UI Hints

- แสดงเป็น calendar view (30 วัน)
- คลิกแต่ละวันเพื่อดูรายละเอียด
- ปุ่ม "Regenerate this post" / "Edit caption"
- ปุ่ม "Export as CSV / Excel"
- Highlight วันที่มี special date

## Validation

- [ ] 30 items ครบ
- [ ] กระจาย pillar ตาม % (8-10 awareness, 10-11 education, 7-8 social proof, 4-5 conversion)
- [ ] แต่ละ platform มี content ≥ 5
- [ ] ทุก caption มี CTA
- [ ] ทุก caption มี hashtags (ถ้า platform ต้องการ)
