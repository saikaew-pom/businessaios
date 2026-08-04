/**
 * Visual-prompt builder for content items.
 *
 * DESIGN NOTE — why this is a two-step slot-filling pipeline instead of just
 * asking the LLM to "write a good image description":
 *
 * The engine behind this is MiniMax-M3, which is materially weaker at open
 * creative writing than the frontier models this app is developed against.
 * Asking it to do interpretation + visual composition + evocative prose in
 * one open-ended instruction reliably produces generic, low-signal output
 * ("ภาพทีมงานกำลังทำงาน") — the failure isn't the wording of the ask, it's
 * that the task has too many degrees of freedom for the model's ability.
 *
 * So the work is split by what the model is actually reliable at:
 *
 *   MiniMax does  → extraction (pull concrete nouns out of the copy) and
 *                   classification (pick one option from a closed list).
 *                   Both are easy, verifiable, and hard to fail at.
 *   This file does → all the photography/art-direction vocabulary, via
 *                   deterministic templates keyed off those choices.
 *
 * The quality ceiling therefore comes from the templates below, not from the
 * model's prose. Swapping in a smarter model later would improve slot ACCURACY
 * but the output stays structurally good either way — and every unknown or
 * missing slot falls back to a sane default rather than degrading the prompt.
 *
 * Why the output is Thai with an English style suffix: the field is shown to
 * the user in an editable textarea (so it must be readable/editable in Thai),
 * but image models are trained predominantly on English captions, so the
 * fixed technical/style terms are appended in English where they carry the
 * most weight for prompt adherence.
 */

export type VisualSlots = {
  subject: string;
  setting: string;
  props: string[];
  mood: string;
  light: string;
  narrative: string;
};

const SETTINGS: Record<string, string> = {
  office_modern: 'ในออฟฟิศสมัยใหม่ โต๊ะทำงานไม้อ่อนสไตล์มินิมอล ฉากหลังเป็นผนังโทนสว่างและต้นไม้ในกระถางเบลอเบา ๆ',
  home_office: 'ที่มุมทำงานในบ้าน โต๊ะไม้ติดหน้าต่าง ของใช้วางเป็นระเบียบ ฉากหลังเป็นห้องนั่งเล่นเบลอ',
  retail_shop: 'ภายในร้านค้าปลีกขนาดเล็กที่ตกแต่งสะอาดตา ชั้นวางสินค้าจัดเรียงเป็นระเบียบอยู่ด้านหลังเบลอ',
  cafe_restaurant: 'ภายในร้านกาแฟโทนอบอุ่น โต๊ะไม้ เก้าอี้ไม้ ฉากหลังเป็นเคาน์เตอร์บาร์เบลอเบา ๆ',
  studio_product: 'บนฉากสตูดิโอพื้นหลังเรียบโทนเดียว ไม่มีสิ่งรบกวน จัดวางแบบภาพถ่ายสินค้ามืออาชีพ',
  workshop_meeting: 'ในห้องประชุมสว่างโปร่ง โต๊ะยาว เก้าอี้สมัยใหม่ ฉากหลังเป็นกระจกและผนังสีอ่อนเบลอ',
  factory_warehouse: 'ภายในโรงงานหรือคลังสินค้าที่สะอาดเป็นระเบียบ โครงสร้างโลหะและชั้นวางเรียงเป็นแนวลึก',
  outdoor_urban: 'กลางแจ้งย่านเมือง ทางเดินริมถนนที่มีต้นไม้ ฉากหลังเป็นอาคารเบลอ',
};

const MOODS: Record<string, { expression: string; palette: string; energy: string }> = {
  calm_focused: {
    expression: 'สีหน้าผ่อนคลาย สงบ มีสมาธิ ยิ้มมุมปากเบา ๆ',
    palette: 'โทนสีอบอุ่นนุ่มนวล ครีม เบจ เขียวอ่อน',
    energy: 'สงบ เป็นระเบียบ ไม่เร่งรีบ',
  },
  confident_proud: {
    expression: 'สีหน้ามั่นใจ ยิ้มอย่างภูมิใจ ไหล่ผึ่งผาย',
    palette: 'โทนสีคมชัด น้ำเงิน ขาว ทอง',
    energy: 'มั่นคง น่าเชื่อถือ ดูเป็นมืออาชีพ',
  },
  relieved_light: {
    expression: 'สีหน้าโล่งใจ ผ่อนคลาย มองออกไปไกลอย่างสบายใจ',
    palette: 'โทนสีสว่างโปร่ง ฟ้าอ่อน ขาว พาสเทล',
    energy: 'เบาสบาย โปร่ง มีพื้นที่ว่างในภาพเยอะ',
  },
  energized_excited: {
    expression: 'สีหน้าตื่นเต้น กระตือรือร้น ยิ้มร่าเริง',
    palette: 'โทนสีสดใสมีชีวิตชีวา ส้ม เหลือง ชมพู',
    energy: 'มีพลัง มีการเคลื่อนไหว',
  },
  warm_connected: {
    expression: 'สีหน้าอบอุ่นเป็นมิตร ยิ้มจริงใจ',
    palette: 'โทนสีอบอุ่น ส้มอ่อน น้ำตาล ครีม',
    energy: 'อบอุ่น เป็นกันเอง เข้าถึงง่าย',
  },
};

const LIGHTS: Record<string, string> = {
  morning_soft: 'แสงเช้าธรรมชาติจากหน้าต่างด้านข้าง นุ่มนวล มีเงายาวอ่อน ๆ',
  daylight_bright: 'แสงกลางวันธรรมชาติสว่าง กระจายทั่วถึง เงาอ่อน',
  golden_hour: 'แสงเย็นสีทองอ่อน ส่องเฉียงจากด้านข้าง ให้ความรู้สึกอบอุ่น',
  indoor_warm: 'แสงในร่มโทนอบอุ่นจากไฟเพดานและหน้าต่าง นุ่มนวลไม่จ้า',
};

/**
 * How the story type should shape the composition. `transformation` is the
 * important one: content with a before→after structure ("3 วันเหลือ 4 ชั่วโมง")
 * tempts a literal split-screen, which diffusion models render badly and which
 * usually needs on-image text to even read as a comparison. The template
 * instead renders only the resolved "after" state and lets order/space carry
 * the contrast implicitly.
 */
const NARRATIVES: Record<string, string> = {
  transformation: 'จัดองค์ประกอบให้เห็นความเป็นระเบียบและพื้นที่ว่างโล่งสบาย สื่อถึงภาระที่ลดลง — ห้ามแบ่งภาพครึ่งเปรียบเทียบก่อน-หลัง ให้วาดเฉพาะสภาพ "หลัง" ที่คลี่คลายแล้วเท่านั้น',
  showcase: 'จัดองค์ประกอบให้สินค้าหรือผลงานเป็นจุดเด่นกลางภาพ มีพื้นที่ว่างรอบ ๆ ให้หายใจ',
  educational: 'จัดองค์ประกอบให้เห็นการลงมือทำหรืออธิบาย มีอุปกรณ์ประกอบชัดเจนในกรอบภาพ',
  testimonial: 'จัดองค์ประกอบแบบภาพบุคคล เน้นสีหน้าและอารมณ์ของคนเป็นหลัก ฉากหลังเรียบง่าย',
};

const DEFAULTS = {
  setting: 'office_modern',
  mood: 'calm_focused',
  light: 'morning_soft',
  narrative: 'showcase',
};

function pick<T>(table: Record<string, T>, key: unknown, fallback: string): T {
  return (typeof key === 'string' && table[key]) || table[fallback];
}

/**
 * Assemble the final image prompt from the slots. Every lookup falls back to a
 * default, so a malformed or hallucinated enum from the model degrades to a
 * generic-but-still-well-formed prompt rather than a broken one.
 */
export function assembleVisualPrompt(slots: Partial<VisualSlots>): string {
  // Type-guard rather than `slots.subject || default` — the model's reply is
  // untrusted JSON, and a non-string `subject` (e.g. `"subject": 2024` when it
  // latches onto a number in the copy) made `.trim()` throw. That throw was
  // never caught on the single-item regenerate route (contentRoutes.ts), so it
  // 500'd with the reservation unrefunded, and in the series batch it killed
  // every other post in the same chunk. Every other slot already degrades to a
  // default; this one now does too, as the docblock above promises.
  const subject = (typeof slots.subject === 'string' ? slots.subject.trim() : '') || 'บุคคลวัยทำงาน';
  const setting = pick(SETTINGS, slots.setting, DEFAULTS.setting);
  const mood = pick(MOODS, slots.mood, DEFAULTS.mood);
  const light = pick(LIGHTS, slots.light, DEFAULTS.light);
  const narrative = pick(NARRATIVES, slots.narrative, DEFAULTS.narrative);
  const props = (Array.isArray(slots.props) ? slots.props : [])
    .filter((p): p is string => typeof p === 'string' && !!p.trim())
    .map((p) => p.trim())
    .slice(0, 4);

  return [
    `${subject} ${setting}`,
    mood.expression,
    props.length ? `มี${props.join(' ')} วางอยู่ในกรอบภาพอย่างเป็นระเบียบ` : '',
    `แสง: ${light}`,
    `สี: ${mood.palette}`,
    `บรรยากาศ: ${mood.energy}`,
    `องค์ประกอบ: ${narrative}`,
    'มุมกล้อง: ระดับสายตา มุมเฉียง 3/4 โฟกัสชัดที่ตัวแบบ ฉากหลังเบลอนุ่ม',
    'สไตล์: ภาพถ่ายโฆษณาเชิงพาณิชย์ สมจริง คุณภาพสูง',
    'commercial advertising photography, shallow depth of field, soft natural lighting, photorealistic, high detail',
    'ห้ามมีในภาพเด็ดขาด: ตัวอักษร ตัวเลข ป้ายข้อความ โลโก้ กราฟ แผนภูมิ นาฬิกาที่อ่านค่าได้ หรือหน้าจอที่มีข้อความชัดเจน (จะใส่หัวข้อ/CTA ทีหลังด้วยเครื่องมือแยกต่างหาก)',
  ].filter(Boolean).join('\n');
}

/**
 * Step 1 of the pipeline: ask the model ONLY for slots. Every interpretive
 * decision is reduced to picking from a closed list, and the two free-text
 * slots (subject/props) are pure extraction from the copy. The single
 * worked example anchors the expected level of specificity — without it the
 * model tends to answer `subject` with something as vague as "ทีมงาน".
 */
export function buildVisualSlotPrompt(context: {
  title?: string; platform?: string; format?: string; pillar?: string;
  hook?: string; caption?: string; cta?: string;
}) {
  const system = `คุณคือผู้ช่วยแยกข้อมูลสำหรับทีมอาร์ตไดเรกชัน อ่านโพสต์การตลาดแล้วเลือกองค์ประกอบภาพที่เหมาะที่สุด

ตอบเป็น JSON object เท่านั้น ตามรูปแบบนี้เป๊ะ ๆ:
{
  "subject": "ใครหรืออะไรคือจุดสนใจหลักของภาพ — ระบุให้เจาะจง เช่น เพศ ช่วงอายุ อาชีพ หรือชนิดสินค้า",
  "props": ["สิ่งของรูปธรรม 2-4 อย่างที่ควรอยู่ในภาพ ดึงจากเนื้อหาโพสต์"],
  "setting": "เลือก 1: office_modern | home_office | retail_shop | cafe_restaurant | studio_product | workshop_meeting | factory_warehouse | outdoor_urban",
  "mood": "เลือก 1: calm_focused | confident_proud | relieved_light | energized_excited | warm_connected",
  "light": "เลือก 1: morning_soft | daylight_bright | golden_hour | indoor_warm",
  "narrative": "เลือก 1: transformation | showcase | educational | testimonial"
}

กติกาสำคัญ:
- "subject" และ "props" ต้องเป็นสิ่งที่ "วาดเป็นภาพได้" เท่านั้น
- ห้ามใส่ตัวเลข สถิติ เปอร์เซ็นต์ ชื่อแบรนด์ โลโก้ หรือข้อความใด ๆ ลงใน subject/props เด็ดขาด
  (เช่น ถ้าโพสต์พูดถึง "ยอดขายโต 28%" ห้ามตอบว่า "กราฟ 28%" — ให้แปลงเป็นสิ่งของจริงที่สื่อความหมายแทน)
- ถ้าโพสต์พูดถึงธุรกิจประเภทใด ให้ดึงสินค้า/อุปกรณ์ของธุรกิจนั้นมาเป็น props
- "mood" ให้เลือกอารมณ์ "ปลายทาง" ที่โพสต์สัญญาไว้ ไม่ใช่อารมณ์ปัญหาตอนต้น

ตัวอย่าง —
โพสต์: "ร้านกาแฟเล็ก ๆ ที่เคยจดออร์เดอร์ในสมุด ตอนนี้ใช้ระบบช่วยจัดการ ลดคิวรอจาก 15 นาทีเหลือ 5 นาที ลูกค้ากลับมาซ้ำมากขึ้น"
คำตอบ:
{"subject":"บาริสต้าชายไทยวัย 30 ปี","props":["แก้วกาแฟร้อน","เครื่องชงกาแฟ","แท็บเล็ตบนเคาน์เตอร์"],"setting":"cafe_restaurant","mood":"relieved_light","light":"morning_soft","narrative":"transformation"}`;

  const user = [
    context.title ? `หัวข้อ: ${context.title}` : '',
    context.hook ? `Hook: ${context.hook}` : '',
    context.caption ? `Caption: ${context.caption}` : '',
    context.cta ? `CTA: ${context.cta}` : '',
    context.platform ? `Platform: ${context.platform}` : '',
    context.pillar ? `Pillar: ${context.pillar}` : '',
  ].filter(Boolean).join('\n');

  return { system, user };
}

export type VisualSlotBatchItem = {
  index: number;
  hook?: string;
  caption?: string;
  cta?: string;
  platform?: string;
  pillar?: string;
};

/**
 * Batch variant: one call covers several posts. Used by the Content Series
 * generator, where asking per-post would mean 30 sequential AI round-trips
 * for a single "generate my month" click.
 *
 * The reply is keyed by an explicit `i` rather than relying on array order —
 * a model that drops or reorders an entry would otherwise silently shift
 * every subsequent post's art direction onto the wrong copy.
 */
export function buildVisualSlotBatchPrompt(items: VisualSlotBatchItem[]) {
  const base = buildVisualSlotPrompt({});
  // The base prompt ends with a single-object schema AND a worked example whose
  // answer is a bare object — for a weak model the example is the strongest
  // signal in the prompt, so the batch section has to explicitly retire both or
  // the reply comes back unwrapped, `parsed.items` isn't an array, and the whole
  // chunk silently falls back to the copy pass one-liner. Hence: an explicit
  // override, and the same example restated in batch shape.
  const system = `${base.system}

โหมด batch (ใช้แทนรูปแบบคำตอบด้านบนทั้งหมด): จะได้รับโพสต์หลายชิ้นพร้อมกัน กติกาเรื่อง subject/props/ตัวเลือกยังใช้เหมือนเดิมทุกข้อ แต่คำตอบต้องเป็น JSON object เดียวที่ห่อด้วย "items" เท่านั้น:
{"items":[{"i":<เลข index ของโพสต์>, "subject":"...", "props":["..."], "setting":"...", "mood":"...", "light":"...", "narrative":"..."}]}

ตัวอย่างคำตอบในโหมด batch (ถ้าโพสต์ตัวอย่างร้านกาแฟด้านบนเป็น index 0):
{"items":[{"i":0,"subject":"บาริสต้าชายไทยวัย 30 ปี","props":["แก้วกาแฟร้อน","เครื่องชงกาแฟ","แท็บเล็ตบนเคาน์เตอร์"],"setting":"cafe_restaurant","mood":"relieved_light","light":"morning_soft","narrative":"transformation"}]}

- ห้ามตอบเป็น object เดี่ยวแบบตัวอย่างด้านบน — ทุกโพสต์ต้องอยู่ใน array "items" เสมอ
- ต้องตอบครบทุก index ที่ได้รับ และใส่ "i" ให้ตรงกับ index ของโพสต์นั้นเสมอ ห้ามใส่ index ที่ไม่ได้รับ
- แต่ละโพสต์ควรมีภาพต่างกัน ไม่ต้องซ้ำฉาก/มุมเดิมทุกชิ้น`;

  const user = items.map((item) => [
    `--- โพสต์ index ${item.index} ---`,
    item.hook ? `Hook: ${item.hook}` : '',
    item.caption ? `Caption: ${item.caption}` : '',
    item.cta ? `CTA: ${item.cta}` : '',
    item.platform ? `Platform: ${item.platform}` : '',
    item.pillar ? `Pillar: ${item.pillar}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');

  return { system, user };
}
