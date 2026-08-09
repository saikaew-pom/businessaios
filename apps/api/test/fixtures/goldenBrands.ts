/**
 * Golden set — Content Playbook Upgrade Plan ขั้นที่ 4's own risk list
 * (docs/CONTENT_PLAYBOOK_UPGRADE_PLAN.md, line ~110): "golden set 10 แบรนด์
 * ไว้ regression test ทุกครั้งที่แก้ prompt". 10 diverse, realistic Thai SME
 * brand snapshots (the exact shape `formatBrandContextBlock`/
 * `buildSeriesPrompt`/`buildSalesPostPrompt` all consume) — used by
 * test/goldenBrands.test.ts to catch a future prompt-engineering change that
 * breaks for some brand shape without needing a real (slow, costly, flaky)
 * MiniMax call per brand. Deliberately varies the dimensions those prompt
 * builders branch on: presence/absence of persona, voice_particle, offers,
 * voice_samples, and business type/register.
 */

export type GoldenBrand = {
  key: string;
  snapshot: {
    schema_version: number;
    profile_id: string;
    name: string;
    business_summary: string;
    audience: string[];
    tone_of_voice: string[];
    content_pillars: string[];
    offers: string[];
    rules: Record<string, unknown>;
    default_reference_asset_ids: string[];
    persona: {
      name: string;
      age: string;
      job: string;
      daily_life: string;
      complaints: [string, string, string];
    } | null;
    voice_samples: string[];
    voice_particle: string | null;
  };
};

export const GOLDEN_BRANDS: GoldenBrand[] = [
  {
    key: 'coffee_shop',
    snapshot: {
      schema_version: 1, profile_id: 'golden-coffee', name: 'ร้านกาแฟป้าน้อย',
      business_summary: 'ร้านกาแฟเล็ก ๆ ขายกาแฟสดชงใหม่ทุกแก้วและเบเกอรี่โฮมเมด',
      audience: ['คนทำงานออฟฟิศแถวนี้'], tone_of_voice: ['อบอุ่น', 'จริงใจ'],
      content_pillars: [], offers: ['กาแฟสดชงใหม่ทุกแก้ว', 'เบเกอรี่อบสดวันต่อวัน'],
      rules: {}, default_reference_asset_ids: [],
      persona: { name: 'พี่นิด', age: '30', job: 'พนักงานออฟฟิศ', daily_life: 'ตื่นเช้ารีบไปทำงาน',
        complaints: ['กาแฟร้านอื่นแพงแต่ไม่เข้ม', 'ต่อคิวนานทุกเช้า', 'เบเกอรี่ไม่สด'] },
      voice_samples: ['เช้านี้แวะมาจิบกาแฟเข้ม ๆ ก่อนเข้างานนะคะ'],
      voice_particle: 'ค่ะ',
    },
  },
  {
    key: 'hair_salon',
    snapshot: {
      schema_version: 1, profile_id: 'golden-salon', name: 'ร้านตัดผมช่างเอก',
      business_summary: 'ร้านตัดผมชายล้วน เน้นทรงเรียบร้อยเข้าที่ทำงาน',
      audience: ['ผู้ชายวัยทำงาน'], tone_of_voice: ['มั่นใจ', 'ตรงไปตรงมา'],
      content_pillars: [], offers: ['ตัดผมชาย 150 บาท', 'สระ+ตัด+จัดแต่งทรง'],
      rules: {}, default_reference_asset_ids: [],
      persona: { name: 'พี่ต้น', age: '35', job: 'เซลส์', daily_life: 'ต้องพบลูกค้าทุกวัน ทรงผมต้องเรียบร้อยตลอด',
        complaints: ['ร้านอื่นตัดแล้วทรงไม่เข้ารูปหน้า', 'ต้องรอคิวนาน', 'ช่างไม่ฟังว่าอยากได้ทรงไหน'] },
      voice_samples: [],
      voice_particle: 'ครับ',
    },
  },
  {
    key: 'fitness_gym',
    snapshot: {
      schema_version: 1, profile_id: 'golden-gym', name: 'FitCore Gym',
      business_summary: 'ยิมฟิตเนสขนาดกลาง มีเทรนเนอร์ส่วนตัวและคลาสกรุ๊ป',
      audience: ['คนอยากลดน้ำหนัก', 'คนเริ่มออกกำลังกาย'], tone_of_voice: ['กระตุ้น', 'เป็นกันเอง'],
      content_pillars: [], offers: [],
      rules: {}, default_reference_asset_ids: [],
      persona: { name: 'คุณเมย์', age: '28', job: 'พนักงานบริษัท', daily_life: 'นั่งทำงานทั้งวัน ไม่มีเวลาออกกำลังกาย',
        complaints: ['ไปยิมคนเดียวไม่รู้จะเริ่มยังไง', 'เสียเงินสมาชิกแล้วไม่ได้ไปตามที่ตั้งใจ', 'กลัวทำท่าผิดแล้วบาดเจ็บ'] },
      voice_samples: [],
      voice_particle: null,
    },
  },
  {
    key: 'online_clothing',
    snapshot: {
      schema_version: 1, profile_id: 'golden-clothing', name: 'MinimalWear.th',
      business_summary: 'แบรนด์เสื้อผ้าออนไลน์ สไตล์มินิมอล เน้นผ้าดี ใส่สบาย',
      audience: ['วัยทำงานสาย minimal'], tone_of_voice: ['เรียบหรู', 'มินิมอล'],
      content_pillars: [], offers: ['เสื้อผ้าคุณภาพผ้าคอตตอน 100%', 'ส่งฟรีทั่วประเทศ'],
      rules: { no_discount_language: true }, default_reference_asset_ids: [],
      persona: null,
      voice_samples: ['เสื้อตัวนี้ใส่ได้ทุกวัน ไม่มีเอาต์'],
      voice_particle: 'ค่ะ',
    },
  },
  {
    key: 'tutoring',
    snapshot: {
      schema_version: 1, profile_id: 'golden-tutor', name: 'ติวเตอร์พี่ฝน',
      business_summary: 'สอนพิเศษคณิตศาสตร์ ม.ปลาย ตัวต่อตัวและกลุ่มเล็ก',
      audience: ['ผู้ปกครองนักเรียน ม.ปลาย'], tone_of_voice: ['น่าเชื่อถือ', 'อบอุ่น'],
      content_pillars: [], offers: ['คอร์สละ 8 ครั้ง', 'เนื้อหาตรงตามหลักสูตรล่าสุด'],
      rules: {}, default_reference_asset_ids: [],
      persona: { name: 'คุณแม่เอ๋', age: '42', job: 'แม่บ้าน', daily_life: 'กังวลเรื่องผลการเรียนลูก',
        complaints: ['ลูกเรียนพิเศษหลายที่แล้วเกรดไม่ขึ้น', 'ครูสอนเร็วเกินตามไม่ทัน', 'ค่าเรียนแพงแต่ลูกไม่กล้าถาม'] },
      voice_samples: [],
      voice_particle: 'ค่ะ',
    },
  },
  {
    key: 'pet_grooming',
    snapshot: {
      schema_version: 1, profile_id: 'golden-pet', name: 'PetSpa บางนา',
      business_summary: 'อาบน้ำตัดขนสัตว์เลี้ยง รับฝากดูแลรายวัน',
      audience: ['คนเลี้ยงสุนัข-แมว'], tone_of_voice: ['น่ารัก', 'ใส่ใจ'],
      content_pillars: [], offers: [],
      rules: {}, default_reference_asset_ids: [],
      persona: { name: 'น้องมิ้น', age: '26', job: 'ฟรีแลนซ์', daily_life: 'เลี้ยงหมา 1 ตัว รักมากเหมือนลูก',
        complaints: ['ร้านอื่นจับหมาแรงจนหมากลัว', 'ต้องรอคิวนานทั้งวัน', 'ราคาไม่ชัดเจนจ่ายจริงแพงกว่าที่บอก'] },
      voice_samples: [],
      voice_particle: 'ค่ะ',
    },
  },
  {
    key: 'bakery',
    snapshot: {
      schema_version: 1, profile_id: 'golden-bakery', name: 'เบเกอรี่บ้านสวน',
      business_summary: 'ร้านขนมอบโฮมเมด เค้กสั่งทำ ของว่างจัดเลี้ยง',
      audience: ['คนจัดงานเลี้ยง', 'คนชอบทานขนม'], tone_of_voice: ['อบอุ่น', 'ใส่ใจทุกรายละเอียด'],
      content_pillars: [], offers: ['เค้กสั่งทำตามธีม', 'ขนมอบสดใหม่ทุกวัน'],
      rules: {}, default_reference_asset_ids: [],
      persona: { name: 'พี่แนน', age: '33', job: 'HR บริษัท', daily_life: 'ต้องจัดงานเลี้ยงบริษัทบ่อย',
        complaints: ['สั่งเค้กร้านอื่นแล้วรสชาติไม่อร่อยอย่างที่คิด', 'ของหวานจัดเลี้ยงมักมาช้ากว่านัด', 'ราคาสูงแต่คุณภาพไม่คุ้ม'] },
      voice_samples: [],
      voice_particle: null,
    },
  },
  {
    key: 'phone_repair',
    snapshot: {
      schema_version: 1, profile_id: 'golden-repair', name: 'ช่างซ่อมมือถือ โต้ง',
      business_summary: 'รับซ่อมมือถือทุกรุ่น เปลี่ยนจอ เปลี่ยนแบต รอรับได้',
      audience: ['คนใช้สมาร์ทโฟนทั่วไป'], tone_of_voice: ['เชื่อถือได้', 'ตรงไปตรงมา'],
      content_pillars: [], offers: ['ซ่อมเสร็จรอรับ 30 นาที', 'ประกันงานซ่อม 30 วัน'],
      rules: {}, default_reference_asset_ids: [],
      persona: { name: 'น้องเบส', age: '22', job: 'นักศึกษา', daily_life: 'ใช้มือถือตลอดเวลาเพื่อเรียนออนไลน์',
        complaints: ['ร้านอื่นซ่อมแล้วเครื่องมีปัญหาซ้ำ', 'ใช้เวลาซ่อมนานเป็นอาทิตย์', 'ไม่มีการันตีงานซ่อม'] },
      voice_samples: [],
      voice_particle: 'ครับ',
    },
  },
  {
    key: 'coworking_space',
    snapshot: {
      schema_version: 1, profile_id: 'golden-coworking', name: 'WorkHub Space',
      business_summary: 'พื้นที่ทำงานร่วม มีห้องประชุม อินเทอร์เน็ตแรง เปิด 24 ชม.',
      audience: ['ฟรีแลนซ์', 'สตาร์ทอัพขนาดเล็ก'], tone_of_voice: ['โปรเฟสชันแนล', 'ทันสมัย'],
      content_pillars: [], offers: [],
      rules: {}, default_reference_asset_ids: [],
      persona: null,
      voice_samples: [],
      voice_particle: null,
    },
  },
  {
    key: 'skincare_brand',
    snapshot: {
      schema_version: 1, profile_id: 'golden-skincare', name: 'GlowLab Thailand',
      business_summary: 'แบรนด์สกินแคร์ธรรมชาติ ผลิตในไทย ไม่ทดลองกับสัตว์',
      audience: ['ผู้หญิงวัย 25-40 ที่ใส่ใจผิว'], tone_of_voice: ['น่าเชื่อถือ', 'อ่อนโยน'],
      content_pillars: [], offers: ['เซรั่มวิตามินซีสกัดธรรมชาติ', 'ไม่มีพาราเบน'],
      rules: { no_medical_claims: true }, default_reference_asset_ids: [],
      persona: { name: 'คุณปุ้ย', age: '32', job: 'พนักงานธนาคาร', daily_life: 'เครียดจากงาน ผิวหมองคล้ำง่าย',
        complaints: ['ใช้ครีมแพงแล้วผิวไม่ดีขึ้น', 'แพ้ง่ายกับสารเคมีแรง ๆ', 'หาผลิตภัณฑ์ไทยที่มั่นใจได้ยาก'] },
      voice_samples: ['ผิวดีเริ่มจากการดูแลที่ใส่ใจทุกวัน'],
      voice_particle: 'ค่ะ',
    },
  },
];
