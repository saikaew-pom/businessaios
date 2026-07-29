/**
 * Brand Voice Presets — curated from 12 Brand Archetypes (Margaret Mark)
 * Filtered to 6 most relevant for Thai SMEs
 */

export type BrandVoicePreset = {
  id: string;
  archetype: string;  // from 12 archetypes
  icon: string;
  label: string;       // Thai short label
  description: string;  // when to use this
  personality: string;
  tone: string;
  tone_keywords: string;
  dimensions: {
    formal_casual: number;    // 1-10
    serious_playful: number;
    factual_emotional: number;
    formal_concise: number;
  };
  dos: string;
  donts: string;
  sample_phrases: string[];
  use_words: string[];
  avoid_words: string[];
  content_examples: {
    facebook_post: string;
    instagram_caption: string;
    line_message: string;
  };
};

export const BRAND_VOICE_PRESETS: BrandVoicePreset[] = [
  {
    id: 'everyman_local',
    archetype: 'The Everyman',
    icon: '🏪',
    label: 'ร้านเล็ก ซอยตื่น',
    description: 'ร้านอาหารท้องถิ่น, ร้านค้าชุมชน, ธุรกิจครอบครัว',
    personality: 'เพื่อนบ้านที่ไว้ใจได้ เป็นกันเอง เหมือนรู้จักกันมานาน',
    tone: 'อบอุ่น จริงใจ พูดง่าย ไม่เยอะ',
    tone_keywords: 'อบอุ่น, จริงใจ, เป็นกันเอง, สบายๆ, ซื่อสัตย์',
    dimensions: {
      formal_casual: 8,
      serious_playful: 4,
      factual_emotional: 5,
      formal_concise: 4,
    },
    dos: 'ทักทายเหมือนคนรู้จัก, อธิบายง่ายๆ ไม่เวอร์, ใช้ภาษาชาวบ้าน, เล่าเรื่องจริง',
    donts: 'พูดเป็นทางการ, ใช้ศัพท์วิชาการ, ขายแรงๆ, โอ้อวดเกินจริง',
    sample_phrases: [
      'มาเลยครับ กินอะไรก็บอก',
      'ของสดทุกวัน เชื่อใจได้',
      'ลูกค้าประจำรู้จักกันหมด',
      'อร่อยจริง ไม่จริงคืนเงิน',
    ],
    use_words: ['สด', 'อร่อย', 'จริงใจ', 'ใส่ใจ', 'เพื่อนบ้าน', 'ประจำ', 'คุ้นเคย', 'จริงๆ'],
    avoid_words: ['ดีที่สุด', 'ครบวงจร', 'มืออาชีพ', 'premium', 'exclusive', 'พรีเมียม', 'หรูหรา'],
    content_examples: {
      facebook_post: 'วันนี้น้ำซุปต้มใหม่ ตั้งแต่ตี 4 เช้า ลูกค้าประจำรู้กันว่ามาก่อนได้ชามเป็นพิเศษ 😋',
      instagram_caption: 'เช้านี้ตักเส้นเส้นหมี่ลูกชิ้นปลาเค็มใส่น้ำซุปร้อนๆ พร้อมผักบุ้งลวก ราคา 45 บาท อิ่มท้องทั้งวัน',
      line_message: 'พี่คะ ร้านเปิดแล้วค่ะ วันนี้มีปลาเผาอร่อยมาก มาทานกันนะคะ',
    },
  },

  {
    id: 'ruler_premium',
    archetype: 'The Ruler',
    icon: '💎',
    label: 'พรีเมียม เหนือระดับ',
    description: 'Luxury brand, premium service, high-end restaurant, สินค้าราคาสูง',
    personality: 'ผู้เชี่ยวชาญที่คัดสรร รู้ว่าอะไรดีที่สุด พร้อมจ่ายเพื่อคุณภาพ',
    tone: 'สงบ มั่นคง ละเมียดละไม สุภาพ',
    tone_keywords: 'สงบ, มั่นคง, ละเมียดละไม, สุภาพ, คัดสรร, พรีเมียม',
    dimensions: {
      formal_casual: 2,
      serious_playful: 8,
      factual_emotional: 7,
      formal_concise: 8,
    },
    dos: 'พูดถึงคุณภาพ, ใช้คำสุภาพ, มีบริการเสริม, รายละเอียดครบถ้วน, สร้างความรู้สึก exclusive',
    donts: 'พูดเร็ว พูดแรง, ใช้สแลง, ลดราคาแรงๆ, พูดถึงคู่แข่ง',
    sample_phrases: [
      'ยินดีต้อนรับสู่ประสบการณ์ที่คัดสรร',
      'คุณภาพที่เหนือกว่า คือสิ่งที่เรายึดมั่น',
      'เฉพาะสมาชิกเท่านั้น',
      'จำกัดจำนวน เพื่อความพิเศษ',
    ],
    use_words: ['พิเศษ', 'คัดสรร', 'ประณีต', 'คุณภาพ', 'ละเมียดละไม', 'สง่างาม', 'พิเศษสุด', 'เหนือระดับ'],
    avoid_words: ['ถูก', 'ลด', 'โปรโมชั่น', 'ดีที่สุดใน', 'สุดๆ', 'เด็ด', 'โหด'],
    content_examples: {
      facebook_post: 'ขอเชิญท่านสัมผัสประสบการณ์ Fine Dining ระดับมิชลิน ในค่ำคืนแห่งความทรงจำ — จองล่วงหน้าเท่านั้น',
      instagram_caption: 'ไวน์ Grand Cru 1990 ผ่านการบ่มในถังโอ๊คฝรั่งเศส 25 ปี จับคู่กับเนื้อวากิว A5',
      line_message: 'ท่านที่เคารพ เราขอเรียนเชิญท่านเข้าร่วมงานเปิดตัวคอลเลกชันใหม่ในวันเสาร์นี้',
    },
  },

  {
    id: 'jester_fun',
    archetype: 'The Jester',
    icon: '😜',
    label: 'ขำๆ สนุกๆ',
    description: 'แบรนด์วัยรุ่น, Gen Z, คาเฟ่สายฮา, streetwear, ของหวาน, เกม',
    personality: 'เพื่อนตลกที่แสนรู้ ไม่เครียด มีพลัง ตลกแต่ไม่โง่',
    tone: 'สนุกสนาน ตลก มีพลัง เยอะแยะได้',
    tone_keywords: 'สนุก, ตลก, มีพลัง, เอ็นเอ็น, ซน, สดใส',
    dimensions: {
      formal_casual: 9,
      serious_playful: 1,
      factual_emotional: 3,
      formal_concise: 5,
    },
    dos: 'ใช้มีม, เล่นคำ, ตลกเฮฮา, เยอะแยะ, ใส่ emoji ได้, ขำได้',
    donts: 'จริงจังเกินไป, พูดเป็นทางการ, เครียด, ยาว, ตักเตือน',
    sample_phrases: [
      '555+ เอาไปเลย!',
      'ใครว่าขำไม่ได้ เอามาที่นี่!',
      'เอ้า กินเลย กินดีกว่า!',
      'เค้าเล่า เค้าเล่า 555',
    ],
    use_words: ['จริง', 'โหด', 'ปัง', 'สนุก', 'ตลก', 'ฮา', 'เริ่ด', 'เด่ด', 'เริ่ร์', 'เอาให้รู้ไป', 'มันส์'],
    avoid_words: ['เคร่งขรึม', 'เรียบร้อย', 'สุภาพเกิน', 'เป็นทางการ', 'จริงจัง', 'โปรด'],
    content_examples: {
      facebook_post: 'ชานมไข่มุก 1 แก้ว ให้ 1 เหรียญ ถ้าไม่อร่อยเอาเหรียญไปซื้อที่อื่นได้เลย 😤',
      instagram_caption: 'อร่อยจนต้องร้องโอ้ย 555 ลองแล้วจะรู้ว่าทำไมเพื่อนบ่นกันทั้งออฟฟิศ',
      line_message: 'พี่จ๋าาา วันนี้ชานมลด 50% เพราะว่า...เราใจดี 💕',
    },
  },

  {
    id: 'hero_expert',
    archetype: 'The Hero',
    icon: '💪',
    label: 'ผู้เชี่ยวชาญ ไว้ใจได้',
    description: 'คลินิก, ที่ปรึกษา, SaaS, B2B services, สถาบันการศึกษา',
    personality: 'ผู้เชี่ยวชาญที่รู้จริง พร้อมพิสูจน์ด้วยข้อมูล ช่วยให้คุณสำเร็จ',
    tone: 'มั่นคง ชัดเจน จริงใจ ไม่คลุมเครือ',
    tone_keywords: 'มั่นคง, ชัดเจน, จริงใจ, เชี่ยวชาญ, พิสูจน์ได้, ผลลัพธ์',
    dimensions: {
      formal_casual: 4,
      serious_playful: 7,
      factual_emotional: 9,
      formal_concise: 7,
    },
    dos: 'ใช้ data, อ้างอิง, มีหลักฐาน, เป็นขั้นเป็นตอน, สร้างความมั่นใจ',
    donts: 'เดาสุ่ม, คลุมเครือ, พูดน่ารัก, โอ้อวดเกินจริง',
    sample_phrases: [
      'จากประสบการณ์ 15 ปี เราพบว่า...',
      'ผลลัพธ์ชัดเจนภายใน 30 วัน',
      'มีเคสจริง 50+ ราย',
      'วิธีนี้ใช้ได้ผลกับลูกค้า 9 ใน 10',
    ],
    use_words: ['ผลลัพธ์', 'หลักฐาน', 'ข้อมูล', 'ประสบการณ์', 'เชี่ยวชาญ', 'รับประกัน', 'พิสูจน์แล้ว', 'ผ่านการทดสอบ'],
    avoid_words: ['สุดๆ', 'ที่สุด', 'เหนือกว่า', 'ตื่นเต้น', 'ว้าว', '555'],
    content_examples: {
      facebook_post: 'จากข้อมูลลูกค้า 200+ ราย 87% เห็นผลลัพธ์ภายใน 14 วัน — ตัวเลขจริง ไม่ใช่คำโฆษณา',
      instagram_caption: 'หลักฐานจากงานวิจัย 12 ปี: ใช้ 30 วัน เห็น ROI 300%',
      line_message: 'คุณลูกค้าคะ กราฟนี้แสดงผลลัพธ์จริง 30 วัน หลังใช้บริการ — ยินดีปรึกษาฟรีค่ะ',
    },
  },

  {
    id: 'caregiver_warm',
    archetype: 'The Caregiver',
    icon: '❤️',
    label: 'ใส่ใจ อบอุ่น',
    description: 'สปา, คลินิกสุขภาพ, ธุรกิจครอบครัว, สัตว์เลี้ยง, เด็ก, ผู้สูงอายุ',
    personality: 'พี่สาว/พี่ชายที่ดูแล เข้าใจความรู้สึก เห็นอกเห็นใจ ไม่ตัดสิน',
    tone: 'อบอุ่น เข้าใจ เห็นอกเห็นใจ อ่อนโยน',
    tone_keywords: 'อบอุ่น, เข้าใจ, เห็นอกเห็นใจ, ใส่ใจ, ดูแล, อ่อนโยน',
    dimensions: {
      formal_casual: 7,
      serious_playful: 4,
      factual_emotional: 5,
      formal_concise: 4,
    },
    dos: 'เข้าใจปัญหา, แสดงความเห็นใจ, ใช้คำอ่อนโยน, ใส่ใจรายละเอียด, สร้างความอุ่นใจ',
    donts: 'ขายแรง, กดดัน, ตำหนิ, พูดแข็ง, เร่งด่วน',
    sample_phrases: [
      'เราเข้าใจความรู้สึกของคุณ',
      'ไม่ต้องกังวลนะคะ เราดูแลคุณ',
      'พร้อมรับฟังเสมอ',
      'ค่อยๆ ดูแลกันไป',
    ],
    use_words: ['ใส่ใจ', 'อบอุ่น', 'เข้าใจ', 'ดูแล', 'เอาใจใส่', 'อ่อนโยน', 'เห็นอกเห็นใจ', 'ปลอดภัย'],
    avoid_words: ['ต้อง', 'ควร', 'เร็วๆ', 'ด่วน', 'เดี๋ยวนี้', 'รีบ'],
    content_examples: {
      facebook_post: 'เราเข้าใจว่าการดูแลคุณพ่อคุณแม่ที่อายุมากไม่ใช่เรื่องง่าย เราพร้อมดูแลท่านเหมือนคนในครอบครัว',
      instagram_caption: 'ทุกครั้งที่ลูกค้าเดินเข้ามา เราถามว่า "วันนี้เป็นอย่างไรบ้าง" ก่อนเสมอ',
      line_message: 'น้องคะ พี่เห็นว่าน้องยังไม่ค่อยสบายใจ พร้อมรับฟังนะคะ ไม่ต้องรีบ',
    },
  },

  {
    id: 'creator_modern',
    archetype: 'The Creator',
    icon: '🚀',
    label: 'ทันสมัย เทรนด์',
    description: 'Tech startup, D2C brand, social-first brand, creative agency',
    personality: 'ผู้สร้างสรรค์ที่อัปเดต ฉลาด มีรสนิยม ทันสมัย',
    tone: 'ทันสมัย ฉลาด กระชับ ไม่เยอะ',
    tone_keywords: 'ทันสมัย, ฉลาด, กระชับ, เรียบง่าย, ดีไซน์',
    dimensions: {
      formal_casual: 8,
      serious_playful: 5,
      factual_emotional: 6,
      formal_concise: 8,
    },
    dos: 'ใช้ศัพท์ใหม่, สั้น กระชับ, design-led, ไม่เยอะ, ชัดเจน',
    donts: 'พูดเยอะ, อธิบายยาว, ใช้ภาษาทางการ, ซับซ้อน',
    sample_phrases: [
      'Designed for the modern you.',
      'เรียบง่าย. ใช้งานง่าย. ได้ผลจริง.',
      'Built different.',
      'No fluff. Just results.',
    ],
    use_words: ['ใหม่', 'เร็ว', 'ฉลาด', 'ง่าย', 'โดนใจ', 'minimal', 'simple', 'pure', 'clean'],
    avoid_words: ['ซับซ้อน', 'ยาก', 'เข้าใจยาก', 'อธิบายยาว', 'เก่า', 'ล้าสมัย'],
    content_examples: {
      facebook_post: '3 features. 1 click. Zero learning curve. — Built for the way you actually work.',
      instagram_caption: 'Less, but better. ✨',
      line_message: 'Quick question: ถ้า design ใช้เวลาเรียนรู้แค่ 30 วินาที คุณจะลองมั้ย?',
    },
  },

  // ===== ADDITIONAL 6 ARCHETYPES (added 2026-07-26) =====
  // Source: Margaret Mark & Carol S. Pearson — The Hero and the Outlaw (2001)
  // Original 6: Everyman, Ruler, Jester, Hero, Caregiver, Creator (most relevant for Thai SMEs)
  // Added 6: Innocent, Sage, Explorer, Outlaw, Magician, Lover

  {
    id: 'innocent_pure',
    archetype: 'The Innocent',
    icon: '☁️',
    label: 'บริสุทธิ์ อบอุ่น',
    description: 'สบู่, ผลิตภัณฑ์เด็ก, อาหารออร์แกนิก, แบรนด์ที่เน้นความสะอาด ปลอดภัย',
    personality: 'คนดี มองโลกในแง่ดี เชื่อในความเรียบง่าย สบายใจ',
    tone: 'สะอาด บริสุทธิ์ อบอุ่น เรียบง่าย ไร้เดียงสา',
    tone_keywords: 'สะอาด, บริสุทธิ์, เรียบง่าย, อบอุ่น, ไร้กังวล, สดใส',
    dimensions: {
      formal_casual: 6,
      serious_playful: 5,
      factual_emotional: 7,
      formal_concise: 6,
    },
    dos: 'พูดถึงความสะอาด ปลอดภัย, ใช้คำเรียบง่าย, สร้างความสบายใจ, เลี่ยงความซับซ้อน',
    donts: 'พูดถึงความเสี่ยง, ใช้ศัพท์เทคนิค, ทำให้กังวล, ขายแรง, พูดถึงคู่แข่ง',
    sample_phrases: [
      'บริสุทธิ์จากธรรมชาติ',
      'ปลอดภัย ไร้กังวล',
      'กลับมาเรียบง่าย อบอุ่น',
      'อ่อนโยนต่อผิว อ่อนโยนต่อใจ',
    ],
    use_words: ['บริสุทธิ์', 'สะอาด', 'อ่อนโยน', 'ปลอดภัย', 'เรียบง่าย', 'อบอุ่น', 'สดใส', 'ใส'],
    avoid_words: ['อันตราย', 'ซับซ้อน', 'รุนแรง', 'ท้าทาย', 'เสี่ยง', 'โจ่งแจ้ง'],
    content_examples: {
      facebook_post: 'เหมือนอาบน้ำฝน สะอาด บริสุทธิ์ ไม่มีอะไรเจือปน — เพื่อผิวคุณและโลกของเรา',
      instagram_caption: 'เรียบง่าย อ่อนโยน บริสุทธิ์ — เหมือนสายลมแห่งฤดูใบไม้ผลิ ☁️',
      line_message: 'พี่คะ ผลิตภัณฑ์ใหม่จากธรรมชาติ 100% บอบบางแม้ผิวแพ้ง่ายก็ใช้ได้สบายเลยค่ะ',
    },
  },

  {
    id: 'sage_expert',
    archetype: 'The Sage',
    icon: '📚',
    label: 'ผู้รู้ ครู',
    description: 'สถาบันการศึกษา, คอร์สออนไลน์, ที่ปรึกษา, สื่อ, นักวิชาการ',
    personality: 'ครูที่รู้จริง ให้ความรู้แบบไม่ยัดเยียด ช่วยให้คุณคิดเป็น',
    tone: 'มีหลักฐาน มีข้อมูล สงบ ไม่เร่งเร้า ลึกซึ้ง',
    tone_keywords: 'รู้จริง, มีหลักฐาน, ลึกซึ้ง, สงบ, ให้ความรู้, วิเคราะห์',
    dimensions: {
      formal_casual: 4,
      serious_playful: 7,
      factual_emotional: 9,
      formal_concise: 7,
    },
    dos: 'อ้างอิงงานวิจัย, ใช้ data, อธิบายที่มาที่ไป, ให้มุมมองหลายด้าน, สอนให้คิด',
    donts: 'พูดแบบโฆษณา, ใช้อารมณ์มากเกินไป, ตัดสินใจแทน, พูดคลุมเครือ',
    sample_phrases: [
      'จากงานวิจัยปี 2024 พบว่า...',
      'ข้อมูลชี้ชัดว่า...',
      'มาเข้าใจหลักการกันก่อน',
      'ความรู้คือพลัง',
    ],
    use_words: ['ข้อมูล', 'งานวิจัย', 'หลักฐาน', 'วิเคราะห์', 'เข้าใจ', 'เรียนรู้', 'หลักการ', 'แหล่งที่มา'],
    avoid_words: ['ลดราคา', 'ด่วน', 'เร่งด่วน', 'เดี๋ยวนี้', 'สุดๆ', 'ว้าว'],
    content_examples: {
      facebook_post: 'งานวิจัยจาก MIT ปี 2024 ชี้ว่า: ใช้เวลาเรียนรู้ 4 ชั่วโมง/สัปดาห์ ผลลัพธ์ดีกว่าเรียน 40 ชั่วโมงแบบกระจาย — อยากรู้ว่าทำไม?',
      instagram_caption: 'หลักการ 80/20 ของ Pareto ใช้กับการเรียนรู้ยังไง — มาดูกัน 📊',
      line_message: 'จากผลสำรวจ 1,000 คน 73% เข้าใจผิดเรื่องนี้ — มาดูข้อมูลจริงกันครับ',
    },
  },

  {
    id: 'explorer_adventurous',
    archetype: 'The Explorer',
    icon: '🧭',
    label: 'นักสำรวจ อิสระ',
    description: 'ท่องเที่ยว, กีฬาเอ็กซ์ตรีม, แบรนด์กลางแจ้ง, gear, adventure',
    personality: 'นักผจญภัยที่อยากออกไปค้นหา ชอบอิสระ ไม่ชอบขีดเส้น',
    tone: 'กล้าหาญ อิสระ ตื่นเต้น แปลกใหม่ ผจญภัย',
    tone_keywords: 'กล้า, อิสระ, ผจญภัย, ค้นพบ, ใหม่, ขอบเขตใหม่',
    dimensions: {
      formal_casual: 8,
      serious_playful: 6,
      factual_emotional: 6,
      formal_concise: 6,
    },
    dos: 'เล่าเรื่องการผจญภัย, เชิญชวนออกไปทำ, แสดงความอิสระ, ใช้ภาพธรรมชาติ',
    donts: 'พูดถึงความปลอดภัยมาก, ใช้ภาษาราชการ, ขายของตรงๆ, ผูกมัด',
    sample_phrases: [
      'ออกไปค้นหาตัวเอง',
      'ทางที่ไม่เคยเดิน',
      'ปลดปล่อยขีดจำกัด',
      'ผจญภัยเริ่มที่นี่',
    ],
    use_words: ['ผจญภัย', 'ค้นพบ', 'อิสระ', 'ท้าทาย', 'ธรรมชาติ', 'เส้นทาง', 'ขอบเขต', 'ใหม่'],
    avoid_words: ['ปลอดภัย', 'ระวัง', 'จำกัด', 'ห้าม', 'อยู่กับที่', 'ขีดเส้น'],
    content_examples: {
      facebook_post: 'เส้นทาง 100 กม. ไม่มีป้าย ไม่มี google maps แค่เข็มทิศกับฟ้าที่มืด — ใครกล้าไปด้วยกัน?',
      instagram_caption: 'ทุกยอดเขาคือคำถาม ทุกพื้นที่คือคำตอบ — ไปให้พ้นขอบฟ้า 🏔️',
      line_message: 'พี่ ทริปหน้าอยากไปภูเขาใหม่ ค้างคืนบนยอดดอย สนใจมั้ย?',
    },
  },

  {
    id: 'outlaw_rebel',
    archetype: 'The Outlaw',
    icon: '⚡',
    label: 'กบฏ ท้าทาย',
    description: 'สตรีทแวร์, แบรนด์ disrupt, แฟชั่นรุ่นใหม่, เกม, subculture',
    personality: 'คนไม่ยอมตามกฎ ชอบทลายกรอบ กล้าแสดงความเห็น',
    tone: 'ท้าทาย ดุ กล้า ดิบ ไม่เกรงใจ แหกกฎ',
    tone_keywords: 'ท้าทาย, กบฏ, ดิบ, แหก, ไม่เกรงใจ, พลิกลูกไม้',
    dimensions: {
      formal_casual: 9,
      serious_playful: 3,
      factual_emotional: 4,
      formal_concise: 5,
    },
    dos: 'พูดตรงๆ ถึงสิ่งที่คนอื่นไม่กล้าพูด, ท้าทาย norm, ใช้ภาษาดิบ, สร้าง tribe',
    donts: 'สุภาพเกินไป, เป็นทางการ, ปลอบใจ, ขอโทษ, พูดแบบ mainstream',
    sample_phrases: [
      'กฎมีไว้ทำลาย',
      'ไม่แคร์สื่อ — แคร์คุณ',
      'ทุกคนบอกทำไม่ได้ เราทำได้',
      'ผิดกฎ แต่ถูกใจ',
    ],
    use_words: ['ท้าทาย', 'กฎ', 'ทำลาย', 'ผิด', 'ใหม่', 'กล้า', 'เถื่อน', 'โหด'],
    avoid_words: ['สุภาพ', 'เรียบร้อย', 'ปลอดภัย', 'อนุรักษ์', 'ทางการ', 'จริงจัง'],
    content_examples: {
      facebook_post: 'ทุกแบรนด์บอก "เราดีที่สุด" — เราบอก "เราไม่สน" เราทำของจริง ไม่ใช่ของโฆษณา',
      instagram_caption: 'Norm ไม่ได้สร้างมาเพื่อเรา — เราสร้างของเราเอง ⚡',
      line_message: 'ไม่ขายของถูก ไม่ลดราคา ไม่โปรโมชั่น — แค่ทำของที่ดีที่สุด',
    },
  },

  {
    id: 'magician_transformative',
    archetype: 'The Magician',
    icon: '✨',
    label: 'นักเปลี่ยนเกม',
    description: 'SaaS AI, เทคโนโลยีเปลี่ยนโลก, coaching, wellness, transformation',
    personality: 'นักมายากลที่เปลี่ยนแปลงชีวิต ทำให้สิ่งที่เป็นไปไม่ได้เกิดขึ้น',
    tone: 'มหัศจรรย์ เปลี่ยนแปลง ลึกลับ แรงบันดาลใจ transformation',
    tone_keywords: 'เปลี่ยนแปลง, มหัศจรรย์, ลึกลับ, พลิกชีวิต, แรงบันดาลใจ',
    dimensions: {
      formal_casual: 5,
      serious_playful: 4,
      factual_emotional: 8,
      formal_concise: 6,
    },
    dos: 'เล่าเรื่อง transformation, ใช้ before/after, เชิญชวนเปิดใจ, แสดงวิสัยทัศน์',
    donts: 'พูดแบบตรงไปตรงมา, ใช้ศัพท์แห้ง, ขายของชัดเจน, พูดถึงข้อจำกัด',
    sample_phrases: [
      'เปลี่ยน "ทำไม่ได้" เป็น "ทำได้"',
      'ค้นพบตัวตนที่แท้จริง',
      'ชีวิตใหม่เริ่มที่นี่',
      'พลิกโฉมชีวิตใน 30 วัน',
    ],
    use_words: ['เปลี่ยนแปลง', 'มหัศจรรย์', 'พลิก', 'ปลดปล่อย', 'เปิด', 'วิสัยทัศน์', 'ค้นพบ', 'แรงบันดาลใจ'],
    avoid_words: ['ปกติ', 'ธรรมดา', 'ทั่วไป', 'จำกัด', 'ลด', 'ตัดทอน'],
    content_examples: {
      facebook_post: '30 วันที่ผ่านมา: จากคนที่ทำงาน 80 ชม./สัปดาห์ → เหลือ 20 ชม. รายได้เพิ่ม 3 เท่า — AI ไม่ได้มาแทนคุณ แต่มาปลดปล่อยคุณ',
      instagram_caption: 'คุณไม่ได้เป็นแค่คนเดิม — คุณคือคนที่จะเป็น ✨',
      line_message: 'ถ้า AI เปลี่ยนงาน 8 ชั่วโมงให้เหลือ 1 ชั่วโมงได้ คุณจะใช้เวลาที่เหลือทำอะไร?',
    },
  },

  {
    id: 'lover_intimate',
    archetype: 'The Lover',
    icon: '💋',
    label: 'เซ็กซี่ หรูหรา',
    description: 'แฟชั่น, ความงาม, เครื่องสำอาง, โรงแรมหรู, อาหาร fine dining, ของขวัญ',
    personality: 'คนเซ็กซี่ มีรสนิยม รักความสวยงาม สร้างบรรยากาศโรแมนติก',
    tone: 'เซ็กซี่ อ่อนหวาน หรูหรา มีรสนิยม ลึกซึ้ง ดึงดูด',
    tone_keywords: 'เซ็กซี่, หรูหรา, อ่อนหวาน, ดึงดูด, มีรสนิยม, ลึกซึ้ง',
    dimensions: {
      formal_casual: 5,
      serious_playful: 7,
      factual_emotional: 8,
      formal_concise: 6,
    },
    dos: 'สร้างบรรยากาศ, ใช้ภาพสวย หรู, พูดถึงประสบการณ์ ความรู้สึก, รายละเอียดประณีต',
    donts: 'พูดตรงไปตรงมาแบบแห้ง, ใช้ data เยอะ, ขายของดิบ, พูดถึงราคา',
    sample_phrases: [
      'สัมผัสแห่งความหรูหรา',
      'รักตัวเอง เริ่มที่นี่',
      'ช่วงเวลาที่คุณคู่ควร',
      'สวยจากภายใน ส่องประกายจากภายนอก',
    ],
    use_words: ['สวย', 'หรู', 'อ่อนหวาน', 'เซ็กซี่', 'ดึงดูด', 'ลึกซึ้ง', 'สัมผัส', 'พิเศษ'],
    avoid_words: ['ถูก', 'ลด', 'โปรโมชั่น', 'ดิบ', 'แห้ง', 'plain'],
    content_examples: {
      facebook_post: 'ค่ำคืนนี้ ให้ตัวเองได้พักผ่อนในแสงเทียน กลิ่นกุหลาบ และรสชาติที่ละเมียดละไม — เพราะคุณคู่ควรกับสิ่งที่ดีที่สุด',
      instagram_caption: 'สวยไม่ต้องพยายาม — แค่ใช้สิ่งที่ใช่ 💋',
      line_message: 'ที่รัก สินค้าใหม่มาถึงแล้วค่ะ สวยมากๆ เลย อยากให้ลองสัมผัส',
    },
  },
];

export function getBrandVoicePresetById(id: string): BrandVoicePreset | undefined {
  return BRAND_VOICE_PRESETS.find(p => p.id === id);
}
