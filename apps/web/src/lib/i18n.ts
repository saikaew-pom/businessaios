/**
 * i18n strings — Thai primary, English secondary
 *
 * 2026-07-29: renamed BusinessAiOs -> Business Smart OS, and replaced "AI"
 * in user-facing copy with "ระบบอัจฉริยะ" (th) / "Smart Engine" (en) — many
 * corporate networks only allow specific pre-approved AI tools and block
 * pages that say "AI" outright. Also rewrote the features/pricing/FAQ
 * copy to match what the product actually does: one shared Smart Engine
 * (not a choice of GPT-4o/Claude/Gemini/Llama), one-time credit packages
 * (not monthly subscriptions), BYOK as an optional add-on (not required
 * setup) — the old copy advertised a different product than what's live,
 * which breaks trust the moment a real user compares the landing page to
 * what they actually get. See docs/UX_REDESIGN_PLAN.md (finding P0-2).
 */

export type Locale = 'th' | 'en';

export const dict = {
  th: {
    // Nav
    'nav.features': 'ฟีเจอร์',
    'nav.how': 'วิธีใช้',
    'nav.pricing': 'ราคา',
    'nav.faq': 'คำถาม',
    'nav.cta': 'สมัครใช้งานฟรี',
    'nav.signin': 'เข้าสู่ระบบ',

    // Hero
    'hero.badge': 'พร้อมใช้งานแล้ว · ใช้ฟรี',
    'hero.title.1': 'ใส่ข้อมูล 7 ขั้นตอน',
    'hero.title.2': 'ได้แผนการตลาด',
    'hero.title.3': 'ครบชุด พร้อมใช้',
    'hero.subtitle': 'สร้าง Brand Card, กลุ่มลูกค้า, ปฏิทินคอนเทนต์, ขั้นตอนทำงาน และตัวชี้วัดผล ด้วยระบบอัจฉริยะ — Export เป็น Word, CSV, JSON ได้ทันที พิมพ์เป็น PDF จากเบราว์เซอร์ได้เลย',
    'hero.cta.primary': 'เริ่มใช้งานฟรี',
    'hero.cta.secondary': 'ดูวิธีทำงาน',
    'hero.proof': 'ใช้แล้ววันนี้ ไม่ต้องรอ',

    // Problem (Brain Audit — Bag 1: isolate the reader's actual pain)
    'problem.eyebrow': 'ปัญหาที่ SME ไทยเจอทุกวัน',
    'problem.title': 'ทำการตลาดคนเดียว ไม่รู้จะเริ่มตรงไหน',
    'problem.subtitle': 'จ้างเอเจนซี่เต็มรูปแบบก็แพงเกินงบ จะทำเองก็ไม่มีเวลานั่งคิด position เขียนคอนเทนต์ วางแผนให้ครบ',
    'problem.1': 'เปิดเพจ โพสต์ไปเรื่อยๆ ไม่มีทิศทาง ไม่รู้จะพูดกับใคร',
    'problem.2': 'อยากลงโฆษณาแต่ไม่รู้จะเขียนข้อความยังไงให้คนสนใจ',
    'problem.3': 'มีไอเดียเต็มหัว แต่ไม่มีเวลาจัดเป็นแผนที่ลงมือทำได้จริง',
    'problem.4': 'จ้างที่ปรึกษาหรือเอเจนซี่ราคาหลักหมื่นถึงแสน ทั้งที่งบมีจำกัด',
    'problem.agitate': 'ถ้าปล่อยไว้แบบนี้ต่อไป คู่แข่งที่มีแผนชัดเจนกว่าจะแซงหน้าไปเรื่อยๆ',

    // Target Audience (Brain Audit — Bag 3: make the reader see themselves, or rule themselves out)
    'audience.eyebrow': 'เหมาะกับใคร',
    'audience.title': 'สร้างมาสำหรับเจ้าของธุรกิจที่ทำการตลาดเอง',
    'audience.for.title': 'ใช่เลยถ้าคุณ...',
    'audience.for.1': 'เป็นเจ้าของ SME ที่ต้องดูแลการตลาดเอง ไม่มีทีมการตลาดประจำ',
    'audience.for.2': 'อยากได้แผนที่ชัดเจน ไม่ใช่แค่ไอเดียลอยๆ',
    'audience.for.3': 'งบจำกัด จ้างเอเจนซี่เต็มรูปแบบไม่ไหว',
    'audience.for.4': 'พร้อมลงมือทำเอง ถ้ามีแผนนำทางที่ชัดเจน',
    'audience.not.title': 'อาจไม่ใช่สำหรับคุณถ้า...',
    'audience.not.1': 'มีทีมการตลาดขนาดใหญ่ดูแลครบอยู่แล้ว',
    'audience.not.2': 'ต้องการเอเจนซี่ทำให้ทุกอย่างแบบ full-service',

    // Trigger (Brain Audit — Bag 4: why act now, not "someday")
    'trigger.title': 'ทุกเดือนที่ไม่มีแผน คือเดือนที่เสียโอกาส',
    'trigger.subtitle': 'ไม่ต้องรอให้พร้อม 100% — เริ่มวันนี้ ใช้เวลาประมาณ 45 นาที ก็ได้แผนที่ลงมือทำได้จริง',
    'trigger.cta': 'เริ่มวางแผนตอนนี้',

    // Waitlist (kept for legacy email capture, not primary CTA anymore)
    'waitlist.title': 'พร้อมเริ่มแล้ว?',
    'waitlist.subtitle': 'สมัครใช้งานฟรี ไม่ต้องใส่บัตรเครดิต — ใช้ได้ทันที',
    'waitlist.placeholder.name': 'ชื่อ (ไม่บังคับ)',
    'waitlist.placeholder.email': 'อีเมลของคุณ',
    'waitlist.button': 'สมัครใช้งานฟรี',
    'waitlist.success': 'เข้าร่วม Waitlist แล้ว! เราจะแจ้งให้คุณทราบ',
    'waitlist.error.invalid': 'กรุณาใส่อีเมลที่ถูกต้อง',
    'waitlist.error.generic': 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
    'waitlist.privacy': 'เราไม่ส่งสแปม และไม่แชร์อีเมลของคุณ',

    // Features (Brain Audit — Bag 2: the solution to the problem above)
    'features.title': 'นี่คือระบบที่ช่วยแก้ปัญหานั้น',
    'features.subtitle': 'ไม่ใช่แค่แชทบอทอัจฉริยะ — เป็นระบบที่ออกแบบมาเพื่อวางแผนการตลาดของ SME ไทยโดยเฉพาะ',
    'features.1.title': 'Wizard 7 ขั้น',
    'features.1.desc': 'กรอกข้อมูลตามขั้นตอน ไม่ต้องเรียน prompt ไม่ต้องเดา',
    'features.2.title': 'เครื่องมือเดี่ยว 11 แบบ',
    'features.2.desc': 'อยากได้แค่ชิ้นเดียว เช่น หาจุดขาย หรือคิดประโยคโฆษณา ก็เรียกใช้ได้ทันทีโดยไม่ต้องสร้างแผนเต็ม',
    'features.3.title': 'เครดิตไม่มีวันหมดอายุ',
    'features.3.desc': 'ซื้อเมื่อไหร่ก็ได้ ใช้เมื่อไหร่ก็ได้ ไม่ใช่ค่าสมาชิกรายเดือนที่หมดอายุถ้าไม่ใช้',
    'features.4.title': 'Export ใช้ต่อได้ทันที',
    'features.4.desc': 'Word, CSV, JSON, Markdown — เปิดแก้ต่อได้ทันที พิมพ์เป็น PDF จากเบราว์เซอร์ได้เลย ฟอนต์ไทยพร้อมพิมพ์จริง',
    'features.5.title': 'Thai Context',
    'features.5.desc': 'เข้าใจ SME ไทย pain point คนไทย platform คนไทย',
    'features.6.title': 'ไม่ต้องเรียน Prompt',
    'features.6.desc': 'แค่กรอกแบบฟอร์ม ระบบอัจฉริยะทำงานแทน — ได้ผลลัพธ์พร้อมใช้',

    // How it works
    'how.title': 'ใช้งานง่าย 4 ขั้นตอน',
    'how.subtitle': 'จากศูนย์ถึงแผนธุรกิจครบชุดใน 45 นาที',
    'how.1.title': 'สมัครฟรี',
    'how.1.desc': 'สมัครแล้วได้ 200 เครดิตทันที ไม่ต้องใส่บัตรเครดิต',
    'how.2.title': 'กรอก Wizard 7 ขั้น',
    'how.2.desc': 'ตอบคำถามทีละขั้น — ใช้เวลาประมาณ 45 นาที',
    'how.3.title': 'ให้ระบบอัจฉริยะช่วยคิด',
    'how.3.desc': 'กดปุ่ม — ได้ Brand Card, กลุ่มลูกค้า, คอนเทนต์, ขั้นตอนทำงาน',
    'how.4.title': 'Export ใช้งาน',
    'how.4.desc': 'ดาวน์โหลด Word, CSV, JSON เปิดแก้ต่อได้เลย หรือพิมพ์เป็น PDF จากเบราว์เซอร์',

    // Pricing — real one-time credit packages (apps/api/src/lib/packages.ts),
    // not monthly subscription tiers. Every account also gets 200 free
    // credits on signup regardless of which package they buy later.
    'pricing.title': 'ราคาที่เข้าใจง่าย',
    'pricing.subtitle': 'สมัครฟรี ได้ 200 เครดิตทันที · ซื้อเพิ่มเมื่อพร้อม ไม่มีวันหมดอายุ',
    'pricing.oneTime': 'จ่ายครั้งเดียว ไม่ต่ออายุอัตโนมัติ',
    'pricing.free.name': 'เริ่มต้นฟรี',
    'pricing.free.price': '฿0',
    'pricing.free.desc': 'ให้ทุกบัญชีใหม่',
    'pricing.free.f1': '200 เครดิตทันทีที่สมัคร',
    'pricing.free.f2': 'ลองแผนธุรกิจเต็ม 7 ขั้น หรือเครื่องมือเดี่ยวได้',
    'pricing.free.f3': 'Export Word, CSV, JSON ได้ครบ + พิมพ์เป็น PDF ได้เลย',
    'pricing.free.f4': 'ไม่ต้องใส่บัตรเครดิต',
    'pricing.free.cta': 'เริ่มฟรี',
    'pricing.starter.name': 'Starter',
    'pricing.starter.price': '฿99',
    'pricing.starter.desc': '100 เครดิต · ทดลองใช้ 1-2 ครั้ง',
    'pricing.starter.f1': '฿0.99 ต่อเครดิต',
    'pricing.starter.f2': 'เหมาะกับมือใหม่ลองระบบ',
    'pricing.starter.f3': 'เครดิตไม่มีวันหมดอายุ',
    'pricing.starter.f4': 'จ่ายผ่าน PromptPay ปลอดภัย',
    'pricing.starter.cta': 'เติมเครดิต Starter',
    'pricing.pro.name': 'Popular',
    'pricing.pro.badge': 'แนะนำ · ประหยัด 16%',
    'pricing.pro.price': '฿249',
    'pricing.pro.desc': '300 เครดิต · ทำงานจริงจัง 1-2 สัปดาห์',
    'pricing.pro.f1': '฿0.83 ต่อเครดิต',
    'pricing.pro.f2': 'พอสำหรับหลายแผนธุรกิจ',
    'pricing.pro.f3': 'เครดิตไม่มีวันหมดอายุ',
    'pricing.pro.f4': 'จ่ายผ่าน PromptPay ปลอดภัย',
    'pricing.pro.f5': 'ใช้ร่วมกับเครดิตฟรีที่มีอยู่ได้',
    'pricing.pro.cta': 'เติมเครดิต Popular',
    'pricing.team.name': 'Pro',
    'pricing.team.price': '฿399',
    'pricing.team.desc': '500 เครดิต · สำหรับ Power user',
    'pricing.team.f1': '฿0.80 ต่อเครดิต · ประหยัดสุด 19%',
    'pricing.team.f2': 'ทำงานหลายโปรเจกต์พร้อมกัน',
    'pricing.team.f3': 'เครดิตไม่มีวันหมดอายุ',
    'pricing.team.f4': 'จ่ายผ่าน PromptPay ปลอดภัย',
    'pricing.team.f5': 'คุ้มสุดต่อเครดิต',
    'pricing.team.cta': 'เติมเครดิต Pro',

    // FAQ (Brain Audit — Bag 5: answer the objections that block signup)
    'objections.eyebrow': 'ข้อสงสัยที่พบบ่อยก่อนตัดสินใจ',
    'faq.title': 'คำถามที่ถามบ่อย',
    'faq.q1': 'ต้องมี API Key ไหม?',
    'faq.a1': 'ไม่ต้องเลย — สมัครฟรีได้ 200 เครดิตทันที ใช้ระบบอัจฉริยะที่เตรียมไว้ให้แล้ว ถ้าอยากใช้ API key ของตัวเอง (BYOK) ก็เพิ่มได้ภายหลังจากหน้าโปรไฟล์',
    'faq.q2': 'ระบบจะเข้าใจธุรกิจไทยไหม?',
    'faq.a2': 'ใช่ — เราออกแบบให้เข้าใจ SME ไทย, คนไทย, platform ไทย (LINE, Facebook, TikTok) โดยเฉพาะ',
    'faq.q3': 'Export แล้วแก้ต่อได้ไหม?',
    'faq.a3': 'ได้ — ไฟล์ Word, CSV, JSON เปิดแก้ต่อได้ทันที ไม่ใช่ไฟล์ตายตัว หรือจะพิมพ์เป็น PDF จากเบราว์เซอร์ก็ได้ รองรับฟอนต์ไทยพร้อมพิมพ์จริง',
    'faq.q4': 'ใช้กับข้อมูลจริงของธุรกิจได้ไหม?',
    'faq.a4': 'ได้ — และแนะนำให้ใช้ เพราะระบบจะช่วยคิดได้แม่นยำขึ้นเมื่อมีบริบทจริง',
    'faq.q5': 'ข้อมูลของฉันปลอดภัยไหม?',
    'faq.a5': 'ถ้าคุณเพิ่ม API key ของตัวเอง (BYOK) จะถูก encrypt (AES-256) และเก็บใน Cloudflare D1 — เราไม่เห็น ไม่เก็บ log',
    'faq.q6': 'เครดิตหมดอายุไหม?',
    'faq.a6': 'ไม่หมดอายุ — ซื้อเมื่อไหร่ก็ได้ ใช้เมื่อไหร่ก็ได้ ไม่ใช่ค่าสมาชิกรายเดือน',

    // Credibility (Brain Audit — Bag 6, generic credibility markers, not fabricated
    // customer quotes — no real testimonials exist yet, see note in +page.svelte)
    'credibility.eyebrow': 'ทำไมถึงเชื่อได้',
    'credibility.title': 'ออกแบบมาเพื่อ SME ไทยโดยเฉพาะ',
    'credibility.1.title': 'เข้าใจบริบทไทย',
    'credibility.1.desc': 'รองรับ platform ที่ SME ไทยใช้จริง เช่น LINE, Facebook, TikTok',
    'credibility.2.title': 'ไม่ใช่ของก็อปมาจากต่างประเทศ',
    'credibility.2.desc': 'ออกแบบคำถามใน Wizard และเครื่องมือจากปัญหาจริงของ SME ไทย',
    'credibility.3.title': 'ใช้งานได้จริงวันนี้',
    'credibility.3.desc': 'ไม่ใช่ waitlist หรือ coming soon — สมัครแล้วใช้ได้ทันที',

    // Risk Reversal (Brain Audit — Bag 7)
    'risk.title': 'ไม่ต้องเสี่ยง ลองก่อนตัดสินใจ',
    'risk.subtitle': 'สมัครฟรี ได้ 200 เครดิตทันที ลองสร้างแผนเต็มหรือเครื่องมือเดี่ยวได้จริง ก่อนควักเงินสักบาท',
    'risk.point1': 'ไม่ต้องใส่บัตรเครดิตตอนสมัคร',
    'risk.point2': 'เครดิตที่ซื้อไม่มีวันหมดอายุ ไม่ใช้ก็ไม่เสียของ',
    'risk.point3': 'จ่ายครั้งเดียว ไม่ผูกมัดรายเดือน ไม่ auto-renew',

    // Uniqueness (Brain Audit — Bag 8)
    'unique.eyebrow': 'ต่างจากตัวเลือกอื่นยังไง',
    'unique.title': 'ทำไมไม่ใช้ทางเลือกอื่นแทน',
    'unique.vs1.name': 'เทียบกับ ChatGPT ทั่วไป',
    'unique.vs1.desc': 'ไม่ต้องคิด prompt เอง มี Wizard 7 ขั้นถามคำถามที่ถูกต้องให้ และได้ไฟล์ export ใช้งานได้ทันที ไม่ใช่แค่ข้อความในแชท',
    'unique.vs2.name': 'เทียบกับจ้างเอเจนซี่ / นักการตลาด',
    'unique.vs2.desc': 'ราคาหลักร้อยแทนหลักหมื่น ได้ผลลัพธ์ทันที ไม่ต้องรอนัด brief หรือรอบแก้งาน',
    'unique.vs3.name': 'เทียบกับ Canva / Template สำเร็จรูป',
    'unique.vs3.desc': 'ไม่ใช่แค่ดีไซน์สวย แต่ได้กลยุทธ์และเนื้อหาที่คิดมาให้ตามบริบทธุรกิจของคุณจริงๆ',

    // Final CTA
    'cta.title': 'พร้อมแล้วหรือยัง?',
    'cta.subtitle': 'สมัครฟรี วันนี้ — ใช้งานได้ทันที ไม่ต้องรอ',
    'cta.button': 'เริ่มใช้งานฟรี',

    // Footer
    'footer.tagline': 'ระบบปฏิบัติการอัจฉริยะสำหรับธุรกิจ',
    'footer.product': 'ผลิตภัณฑ์',
    'footer.features': 'ฟีเจอร์',
    'footer.pricing': 'ราคา',
    'footer.changelog': 'Changelog',
    'footer.company': 'บริษัท',
    'footer.about': 'เกี่ยวกับเรา',
    'footer.blog': 'Blog',
    'footer.contact': 'ติดต่อ',
    'footer.legal': 'กฎหมาย',
    'footer.privacy': 'Privacy',
    'footer.terms': 'Terms',
    'footer.copyright': '© 2026 Business Smart OS · All rights reserved',
  },

  en: {
    'nav.features': 'Features',
    'nav.how': 'How it works',
    'nav.pricing': 'Pricing',
    'nav.faq': 'FAQ',
    'nav.cta': 'Sign Up Free',
    'nav.signin': 'Sign In',

    'hero.badge': 'Live now · Free to use',
    'hero.title.1': 'Fill 7 steps.',
    'hero.title.2': 'Get a marketing plan',
    'hero.title.3': 'complete and ready to use.',
    'hero.subtitle': 'Generate a Brand Card, customer personas, content calendar, workflows, and KPIs with a Smart Engine — export as Word, CSV, or JSON instantly, plus print-to-PDF from your browser.',
    'hero.cta.primary': 'Start Free Now',
    'hero.cta.secondary': 'See how it works',
    'hero.proof': 'Use it today, no waiting',

    // Problem (Brain Audit — Bag 1)
    'problem.eyebrow': 'A problem every Thai SME runs into',
    'problem.title': "Doing marketing alone, not sure where to start",
    'problem.subtitle': "A full-service agency costs more than the budget allows. Doing it yourself means finding time to nail your positioning, write content, and plan it all out.",
    'problem.1': "Posting on your page with no direction, unsure who you're even talking to",
    'problem.2': "Want to run ads but don't know how to write copy that gets attention",
    'problem.3': "Ideas everywhere in your head, but no time to turn them into a plan you can act on",
    'problem.4': "Consultants and agencies quote tens of thousands of baht on a limited budget",
    'problem.agitate': "Keep putting it off, and competitors with a clearer plan keep pulling ahead.",

    // Target Audience (Brain Audit — Bag 3)
    'audience.eyebrow': 'Who this is for',
    'audience.title': 'Built for owners who handle their own marketing',
    'audience.for.title': "This is for you if...",
    'audience.for.1': "You're an SME owner handling marketing yourself, with no in-house team",
    'audience.for.2': "You want a clear plan, not just loose ideas",
    'audience.for.3': "Your budget can't stretch to a full-service agency",
    'audience.for.4': "You're ready to execute yourself, given a clear plan to follow",
    'audience.not.title': "This may not be for you if...",
    'audience.not.1': "You already have a full in-house marketing team",
    'audience.not.2': "You want an agency to handle everything, full-service",

    // Trigger (Brain Audit — Bag 4)
    'trigger.title': 'Every month without a plan is a month of lost opportunity',
    'trigger.subtitle': "You don't need to be 100% ready — start today. About 45 minutes gets you a plan you can actually act on.",
    'trigger.cta': 'Start planning now',

    'waitlist.title': 'Ready to start?',
    'waitlist.subtitle': 'Sign up free — no credit card required, use immediately',
    'waitlist.placeholder.name': 'Name (optional)',
    'waitlist.placeholder.email': 'Your email',
    'waitlist.button': 'Sign Up Free',
    'waitlist.success': 'You are on the waitlist! We will notify you.',
    'waitlist.error.invalid': 'Please enter a valid email',
    'waitlist.error.generic': 'Something went wrong. Please try again.',
    'waitlist.privacy': 'No spam. We do not share your email.',

    'features.title': 'This is the system built to solve that',
    'features.subtitle': 'Not just a smart chatbot — a system built for Thai SME marketing planning.',
    'features.1.title': '7-Step Wizard',
    'features.1.desc': 'Fill forms step by step. No prompt engineering. No guessing.',
    'features.2.title': '11 Standalone Tools',
    'features.2.desc': 'Just need one thing — positioning, an ad hook? Run a single tool without building a full plan.',
    'features.3.title': 'Credits Never Expire',
    'features.3.desc': 'Buy whenever, use whenever — not a monthly seat that expires unused.',
    'features.4.title': 'Export, Ready to Use',
    'features.4.desc': 'Word, CSV, JSON, Markdown — open and edit instantly, plus print-to-PDF straight from your browser. Thai fonts included.',
    'features.5.title': 'Thai Context',
    'features.5.desc': 'Built for Thai SMEs, Thai platforms, Thai pain points.',
    'features.6.title': 'No Prompt Skills',
    'features.6.desc': 'Just fill forms. The Smart Engine does the rest — ready-to-use assets.',

    'how.title': 'Easy as 1-2-3-4',
    'how.subtitle': 'From zero to a full business plan in 45 minutes.',
    'how.1.title': 'Sign up free',
    'how.1.desc': 'Get 200 credits instantly, no credit card required.',
    'how.2.title': 'Fill 7 Steps',
    'how.2.desc': 'Answer questions step by step — takes about 45 minutes.',
    'how.3.title': 'Let the Smart Engine think it through',
    'how.3.desc': 'Click button. Get your Brand Card, personas, content, workflow.',
    'how.4.title': 'Export & Use',
    'how.4.desc': 'Download Word, CSV, JSON. Open and edit right away, or print to PDF from your browser.',

    'pricing.title': 'Simple pricing',
    'pricing.subtitle': '200 free credits on signup · top up anytime, credits never expire',
    'pricing.oneTime': 'One-time payment, no auto-renewal',
    'pricing.free.name': 'Free to start',
    'pricing.free.price': '฿0',
    'pricing.free.desc': 'Every new account',
    'pricing.free.f1': '200 credits instantly on signup',
    'pricing.free.f2': 'Try the full 7-step plan or any single tool',
    'pricing.free.f3': 'Word, CSV, JSON export + print-to-PDF built in',
    'pricing.free.f4': 'No credit card required',
    'pricing.free.cta': 'Start free',
    'pricing.starter.name': 'Starter',
    'pricing.starter.price': '฿99',
    'pricing.starter.desc': '100 credits · try it 1-2 times',
    'pricing.starter.f1': '฿0.99 per credit',
    'pricing.starter.f2': 'Good for first-timers testing the system',
    'pricing.starter.f3': 'Credits never expire',
    'pricing.starter.f4': 'Pay securely via PromptPay',
    'pricing.starter.cta': 'Top up Starter',
    'pricing.pro.name': 'Popular',
    'pricing.pro.badge': 'Recommended · Save 16%',
    'pricing.pro.price': '฿249',
    'pricing.pro.desc': '300 credits · 1-2 weeks of real use',
    'pricing.pro.f1': '฿0.83 per credit',
    'pricing.pro.f2': 'Enough for several plans',
    'pricing.pro.f3': 'Credits never expire',
    'pricing.pro.f4': 'Pay securely via PromptPay',
    'pricing.pro.f5': 'Stacks with your free credits',
    'pricing.pro.cta': 'Top up Popular',
    'pricing.team.name': 'Pro',
    'pricing.team.price': '฿399',
    'pricing.team.desc': '500 credits · for power users',
    'pricing.team.f1': '฿0.80 per credit · best value, save 19%',
    'pricing.team.f2': 'Run multiple projects at once',
    'pricing.team.f3': 'Credits never expire',
    'pricing.team.f4': 'Pay securely via PromptPay',
    'pricing.team.f5': 'Lowest cost per credit',
    'pricing.team.cta': 'Top up Pro',

    'objections.eyebrow': 'Common questions before you decide',
    'faq.title': 'Frequently asked questions',
    'faq.q1': 'Do I need an API key?',
    'faq.a1': 'Not at all — sign up free and get 200 credits instantly, using our built-in Smart Engine. You can add your own API key (BYOK) later from your profile if you want to.',
    'faq.q2': 'Will it understand my Thai business?',
    'faq.a2': 'Yes — built for Thai SMEs, Thai platforms (LINE, Facebook, TikTok), and Thai pain points.',
    'faq.q3': 'Can I edit after export?',
    'faq.a3': 'Yes — Word, CSV, and JSON files are all editable, no locked files, or print straight to PDF from your browser. Thai fonts are print-ready.',
    'faq.q4': 'Should I use real business data?',
    'faq.a4': 'Yes — the Smart Engine works more accurately with real context.',
    'faq.q5': 'Is my data secure?',
    'faq.a5': 'If you add your own API key (BYOK), it is encrypted (AES-256) and stored in Cloudflare D1. We never see it, never log it.',
    'faq.q6': 'Do credits expire?',
    'faq.a6': 'No — buy whenever, use whenever. It is not a monthly subscription.',

    // Credibility (Brain Audit — Bag 6, generic credibility markers, not fabricated
    // customer quotes — no real testimonials exist yet, see note in +page.svelte)
    'credibility.eyebrow': 'Why you can trust this',
    'credibility.title': 'Built specifically for Thai SMEs',
    'credibility.1.title': 'Understands Thai context',
    'credibility.1.desc': 'Built around the platforms Thai SMEs actually use — LINE, Facebook, TikTok',
    'credibility.2.title': "Not a copy-paste of a foreign tool",
    'credibility.2.desc': "Wizard questions and tools designed around real Thai SME problems",
    'credibility.3.title': 'Live and usable today',
    'credibility.3.desc': "Not a waitlist or 'coming soon' — sign up and use it immediately",

    // Risk Reversal (Brain Audit — Bag 7)
    'risk.title': "No risk — try it before you decide",
    'risk.subtitle': 'Sign up free, get 200 credits instantly, and actually build a full plan or run a single tool before spending a baht.',
    'risk.point1': 'No credit card required to sign up',
    'risk.point2': "Purchased credits never expire — nothing wasted if you don't use them right away",
    'risk.point3': 'One-time payment, no monthly lock-in, no auto-renewal',

    // Uniqueness (Brain Audit — Bag 8)
    'unique.eyebrow': 'How this is different',
    'unique.title': 'Why not use something else instead',
    'unique.vs1.name': 'vs. plain ChatGPT',
    'unique.vs1.desc': "No prompt writing needed — a 7-step wizard asks the right questions, and you get exportable files, not just chat text",
    'unique.vs2.name': 'vs. hiring an agency or marketer',
    'unique.vs2.desc': 'Hundreds of baht instead of tens of thousands, results instantly — no waiting for briefs or revision rounds',
    'unique.vs3.name': 'vs. Canva or templates',
    'unique.vs3.desc': "Not just good-looking design — strategy and content actually built around your business context",

    'cta.title': 'Ready?',
    'cta.subtitle': 'Sign up free today. Use it immediately, no waiting.',
    'cta.button': 'Start Free Now',

    'footer.tagline': 'The Smart Operating System for Business',
    'footer.product': 'Product',
    'footer.features': 'Features',
    'footer.pricing': 'Pricing',
    'footer.changelog': 'Changelog',
    'footer.company': 'Company',
    'footer.about': 'About',
    'footer.blog': 'Blog',
    'footer.contact': 'Contact',
    'footer.legal': 'Legal',
    'footer.privacy': 'Privacy',
    'footer.terms': 'Terms',
    'footer.copyright': '© 2026 Business Smart OS · All rights reserved',
  },
} as const;

export type StringKey = keyof typeof dict.th;

export function t(locale: Locale, key: StringKey): string {
  return dict[locale][key] || dict.th[key] || key;
}
