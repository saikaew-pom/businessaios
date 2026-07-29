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
    'hero.title.2': 'ได้แผนธุรกิจ',
    'hero.title.3': 'ครบชุด',
    'hero.subtitle': 'สร้าง Brand Card, กลุ่มลูกค้า, ปฏิทินคอนเทนต์, ขั้นตอนทำงาน และตัวชี้วัดผล ด้วยระบบอัจฉริยะ — Export เป็น PDF, Word, Excel ได้ทันที',
    'hero.cta.primary': 'เริ่มใช้งานฟรี',
    'hero.cta.secondary': 'ดูวิธีทำงาน',
    'hero.proof': 'ใช้แล้ววันนี้ ไม่ต้องรอ',

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

    // Features
    'features.title': 'ทำไมต้อง Business Smart OS',
    'features.subtitle': 'ไม่ใช่แค่แชทบอทอัจฉริยะ — เป็นระบบที่ออกแบบมาเพื่อ SME ไทยโดยเฉพาะ',
    'features.1.title': 'Wizard 7 ขั้น',
    'features.1.desc': 'กรอกข้อมูลตามขั้นตอน ไม่ต้องเรียน prompt ไม่ต้องเดา',
    'features.2.title': 'เครื่องมือเดี่ยว 10 แบบ',
    'features.2.desc': 'อยากได้แค่ชิ้นเดียว เช่น หาจุดขาย หรือคิดประโยคโฆษณา ก็เรียกใช้ได้ทันทีโดยไม่ต้องสร้างแผนเต็ม',
    'features.3.title': 'เครดิตไม่มีวันหมดอายุ',
    'features.3.desc': 'ซื้อเมื่อไหร่ก็ได้ ใช้เมื่อไหร่ก็ได้ ไม่ใช่ค่าสมาชิกรายเดือนที่หมดอายุถ้าไม่ใช้',
    'features.4.title': 'Export ครบทุก Format',
    'features.4.desc': 'PDF, Word, Excel, JSON — เปิดแก้ต่อได้ทันที ฟอนต์ไทยพร้อมพิมพ์จริง',
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
    'how.4.desc': 'ดาวน์โหลด PDF, Word, Excel เปิดแก้ต่อได้เลย',

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
    'pricing.free.f3': 'Export PDF, Word, Excel ครบ',
    'pricing.free.f4': 'ไม่ต้องใส่บัตรเครดิต',
    'pricing.free.cta': 'เริ่มฟรี',
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

    // FAQ
    'faq.title': 'คำถามที่ถามบ่อย',
    'faq.q1': 'ต้องมี API Key ไหม?',
    'faq.a1': 'ไม่ต้องเลย — สมัครฟรีได้ 200 เครดิตทันที ใช้ระบบอัจฉริยะที่เตรียมไว้ให้แล้ว ถ้าอยากใช้ API key ของตัวเอง (BYOK) ก็เพิ่มได้ภายหลังจากหน้าโปรไฟล์',
    'faq.q2': 'ระบบจะเข้าใจธุรกิจไทยไหม?',
    'faq.a2': 'ใช่ — เราออกแบบให้เข้าใจ SME ไทย, คนไทย, platform ไทย (LINE, Facebook, TikTok) โดยเฉพาะ',
    'faq.q3': 'Export แล้วแก้ต่อได้ไหม?',
    'faq.a3': 'ได้ — PDF, Word, Excel ทั้งหมดเปิดแก้ต่อได้ทันที ไม่ใช่ไฟล์ตายตัว และรองรับฟอนต์ไทยพร้อมพิมพ์จริง',
    'faq.q4': 'ใช้กับข้อมูลจริงของธุรกิจได้ไหม?',
    'faq.a4': 'ได้ — และแนะนำให้ใช้ เพราะระบบจะช่วยคิดได้แม่นยำขึ้นเมื่อมีบริบทจริง',
    'faq.q5': 'ข้อมูลของฉันปลอดภัยไหม?',
    'faq.a5': 'ถ้าคุณเพิ่ม API key ของตัวเอง (BYOK) จะถูก encrypt (AES-256) และเก็บใน Cloudflare D1 — เราไม่เห็น ไม่เก็บ log',
    'faq.q6': 'เครดิตหมดอายุไหม?',
    'faq.a6': 'ไม่หมดอายุ — ซื้อเมื่อไหร่ก็ได้ ใช้เมื่อไหร่ก็ได้ ไม่ใช่ค่าสมาชิกรายเดือน',

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
    'hero.title.2': 'Get a complete',
    'hero.title.3': 'business plan.',
    'hero.subtitle': 'Generate a Brand Card, customer personas, content calendar, workflows, and KPIs with a Smart Engine — export as PDF, Word, or Excel instantly.',
    'hero.cta.primary': 'Start Free Now',
    'hero.cta.secondary': 'See how it works',
    'hero.proof': 'Use it today, no waiting',

    'waitlist.title': 'Ready to start?',
    'waitlist.subtitle': 'Sign up free — no credit card required, use immediately',
    'waitlist.placeholder.name': 'Name (optional)',
    'waitlist.placeholder.email': 'Your email',
    'waitlist.button': 'Sign Up Free',
    'waitlist.success': 'You are on the waitlist! We will notify you.',
    'waitlist.error.invalid': 'Please enter a valid email',
    'waitlist.error.generic': 'Something went wrong. Please try again.',
    'waitlist.privacy': 'No spam. We do not share your email.',

    'features.title': 'Why Business Smart OS',
    'features.subtitle': 'Not just a smart chatbot — a system built for Thai SMEs.',
    'features.1.title': '7-Step Wizard',
    'features.1.desc': 'Fill forms step by step. No prompt engineering. No guessing.',
    'features.2.title': '10 Standalone Tools',
    'features.2.desc': 'Just need one thing — positioning, an ad hook? Run a single tool without building a full plan.',
    'features.3.title': 'Credits Never Expire',
    'features.3.desc': 'Buy whenever, use whenever — not a monthly seat that expires unused.',
    'features.4.title': 'Export Everything',
    'features.4.desc': 'PDF, Word, Excel, JSON — open and edit instantly, print-ready Thai fonts included.',
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
    'how.4.desc': 'Download PDF, Word, Excel. Open and edit right away.',

    'pricing.title': 'Simple pricing',
    'pricing.subtitle': '200 free credits on signup · top up anytime, credits never expire',
    'pricing.oneTime': 'One-time payment, no auto-renewal',
    'pricing.free.name': 'Free to start',
    'pricing.free.price': '฿0',
    'pricing.free.desc': 'Every new account',
    'pricing.free.f1': '200 credits instantly on signup',
    'pricing.free.f2': 'Try the full 7-step plan or any single tool',
    'pricing.free.f3': 'Full PDF, Word, Excel export',
    'pricing.free.f4': 'No credit card required',
    'pricing.free.cta': 'Start free',
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

    'faq.title': 'Frequently asked questions',
    'faq.q1': 'Do I need an API key?',
    'faq.a1': 'Not at all — sign up free and get 200 credits instantly, using our built-in Smart Engine. You can add your own API key (BYOK) later from your profile if you want to.',
    'faq.q2': 'Will it understand my Thai business?',
    'faq.a2': 'Yes — built for Thai SMEs, Thai platforms (LINE, Facebook, TikTok), and Thai pain points.',
    'faq.q3': 'Can I edit after export?',
    'faq.a3': 'Yes — PDF, Word, Excel are all editable, no locked files, and Thai fonts are print-ready.',
    'faq.q4': 'Should I use real business data?',
    'faq.a4': 'Yes — the Smart Engine works more accurately with real context.',
    'faq.q5': 'Is my data secure?',
    'faq.a5': 'If you add your own API key (BYOK), it is encrypted (AES-256) and stored in Cloudflare D1. We never see it, never log it.',
    'faq.q6': 'Do credits expire?',
    'faq.a6': 'No — buy whenever, use whenever. It is not a monthly subscription.',

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
