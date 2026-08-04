/**
 * assembleVisualPrompt is the half of the visual-prompt pipeline that does NOT
 * depend on the LLM — it turns slots into art direction. Its whole reason for
 * existing is to stay robust when a weaker model returns partial, malformed,
 * or hallucinated slots, so that's what these cover.
 */
import { describe, expect, it } from 'vitest';
import { assembleVisualPrompt, buildVisualSlotBatchPrompt, buildVisualSlotPrompt } from '../src/lib/creative/visualPrompt';

describe('assembleVisualPrompt', () => {
  const goodSlots = {
    subject: 'บาริสต้าชายไทยวัย 30 ปี',
    setting: 'cafe_restaurant',
    props: ['แก้วกาแฟร้อน', 'เครื่องชงกาแฟ'],
    mood: 'relieved_light',
    light: 'morning_soft',
    narrative: 'transformation',
  };

  it('renders every slot into the prompt', () => {
    const out = assembleVisualPrompt(goodSlots);
    expect(out).toContain('บาริสต้าชายไทยวัย 30 ปี');
    expect(out).toContain('ร้านกาแฟ');
    expect(out).toContain('แก้วกาแฟร้อน');
    expect(out).toContain('โล่งใจ');
    expect(out).toContain('แสงเช้า');
  });

  it('always appends the no-text constraint and the English style suffix', () => {
    const out = assembleVisualPrompt(goodSlots);
    expect(out).toContain('ห้ามมีในภาพเด็ดขาด');
    expect(out).toContain('commercial advertising photography');
  });

  it('falls back to defaults for hallucinated enum values instead of dropping them', () => {
    const out = assembleVisualPrompt({
      subject: 'ผู้หญิงวัยทำงาน',
      setting: 'moon_base',
      mood: 'ecstatic_beyond_words',
      light: 'blacklight_rave',
      narrative: 'interpretive_dance',
      props: [],
    });
    // Defaults: office_modern / calm_focused / morning_soft / showcase.
    expect(out).toContain('ออฟฟิศสมัยใหม่');
    expect(out).toContain('สงบ');
    expect(out).toContain('แสงเช้า');
    expect(out).not.toContain('moon_base');
    expect(out).not.toContain('undefined');
  });

  it('produces a usable prompt from a completely empty object', () => {
    const out = assembleVisualPrompt({});
    expect(out).not.toContain('undefined');
    expect(out).toContain('ห้ามมีในภาพเด็ดขาด');
    expect(out.length).toBeGreaterThan(200);
  });

  it('omits the props line entirely when there are no usable props', () => {
    const out = assembleVisualPrompt({ ...goodSlots, props: [] });
    expect(out).not.toContain('วางอยู่ในกรอบภาพ');
  });

  it('filters non-string / blank props and caps at 4', () => {
    // Latin marker strings on purpose: Thai words collide as substrings with
    // the fixed template text (e.g. "ห้า" matches inside "ห้ามมีในภาพ"), which
    // makes a .not.toContain assertion fail for the wrong reason.
    const out = assembleVisualPrompt({
      ...goodSlots,
      props: ['PROPA', '', '  ', 42 as any, null as any, 'PROPB', 'PROPC', 'PROPD', 'PROPE'],
    });
    expect(out).toContain('PROPA');
    expect(out).toContain('PROPD');
    expect(out).not.toContain('42');
    expect(out).not.toContain('PROPE'); // 5th valid prop dropped by the cap
  });

  it('degrades a non-string subject to the default instead of throwing', () => {
    // The model's reply is untrusted JSON; `subject` came back as a number on
    // a real reply. `.trim()` on it threw, which 500'd the regenerate route
    // with the credit reservation unrefunded and wiped a whole batch chunk in
    // the series generator. Every slot must degrade, never throw.
    for (const subject of [2024 as any, { a: 1 } as any, ['x'] as any, null as any, true as any]) {
      const out = assembleVisualPrompt({ ...goodSlots, subject });
      expect(out).toContain('บุคคลวัยทำงาน'); // the default subject
      expect(out).toContain('commercial advertising photography');
      expect(out).not.toContain('undefined');
      expect(out).not.toContain('[object Object]');
    }
  });

  it('tells the model NOT to render a before/after split for transformation content', () => {
    // A literal split-screen is the obvious-but-wrong reading of before→after
    // copy: diffusion models render it poorly and it usually needs on-image
    // text to read as a comparison at all.
    const out = assembleVisualPrompt({ ...goodSlots, narrative: 'transformation' });
    expect(out).toContain('ห้ามแบ่งภาพครึ่ง');
  });
});

describe('buildVisualSlotPrompt', () => {
  it('asks for slots as JSON and forbids un-drawable values in them', () => {
    const { system } = buildVisualSlotPrompt({ title: 'x' });
    expect(system).toContain('"subject"');
    expect(system).toContain('"props"');
    expect(system).toContain('ห้ามใส่ตัวเลข');
    // The worked example is load-bearing: without it the model answers
    // `subject` with something as vague as "ทีมงาน".
    expect(system).toContain('ตัวอย่าง');
  });

  it('includes the copy fields it should interpret, and skips missing ones', () => {
    const { user } = buildVisualSlotPrompt({ title: 'หัวข้อทดสอบ', caption: 'แคปชันทดสอบ' });
    expect(user).toContain('หัวข้อทดสอบ');
    expect(user).toContain('แคปชันทดสอบ');
    expect(user).not.toContain('Hook:');
    expect(user).not.toContain('CTA:');
  });
});

describe('buildVisualSlotBatchPrompt', () => {
  const items = [
    { index: 10, hook: 'ฮุกสิบ', caption: 'แคปสิบ' },
    { index: 11, hook: 'ฮุกสิบเอ็ด', platform: 'instagram' },
  ];

  it('labels each post with its global index, not its position in the chunk', () => {
    // Chunk 2 of a 30-post series covers indexes 10-19. If the prompt renumbered
    // them from 0 the reply would validate against the wrong post — or, since
    // out-of-chunk indexes are discarded, silently produce nothing at all.
    const { user } = buildVisualSlotBatchPrompt(items);
    expect(user).toContain('index 10');
    expect(user).toContain('index 11');
    expect(user).not.toContain('index 0');
  });

  it('retires the single-object reply format the base prompt asks for', () => {
    // The base prompt ends with "answer in exactly this format" + a worked
    // example that is a bare object. Left standing, a weak model copies the
    // example, the reply has no "items" array, and the entire chunk falls back
    // to the copy pass one-liner.
    const { system } = buildVisualSlotBatchPrompt(items);
    expect(system).toContain('"items"');
    expect(system).toContain('ใช้แทนรูปแบบคำตอบด้านบน');
    expect(system).toContain('ห้ามตอบเป็น object เดี่ยว');
    // The one worked example is the strongest signal in the prompt, so it has
    // to be restated in batch shape rather than left contradicting it.
    expect(system).toContain('{"items":[{"i":0,"subject":"บาริสต้าชายไทยวัย 30 ปี"');
  });

  it('still carries the slot rules from the single-item prompt', () => {
    const { system } = buildVisualSlotBatchPrompt(items);
    expect(system).toContain('ห้ามใส่ตัวเลข');
    expect(system).toContain('office_modern');
  });
});
