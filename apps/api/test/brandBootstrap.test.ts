import { describe, it, expect } from 'vitest';
import {
  buildBrandBootstrapPrompt,
  mapWizardPlanToBrandDraft,
  parseBrandBootstrapOutput,
} from '../src/lib/creative/brandBootstrap';

describe('mapWizardPlanToBrandDraft (path ก — deterministic, no AI)', () => {
  it('maps a full 4-step wizard plan into a brand draft with a 3-complaint persona', () => {
    const project = {
      name: 'ร้านแกงถุงป้าน้อย',
      step_data: JSON.stringify({
        step1: { positioning: 'แกงถุงสดใหม่ทุกวัน', uvp: 'ส่งไวใน 20 นาที', voice_tone: 'อบอุ่นเป็นกันเอง', target_audience: 'พนักงานออฟฟิศที่ไม่มีเวลาทำอาหาร' },
        step2: {
          personas: [
            {
              name: 'พี่หมู', demographics: { age: '35', job: 'พนักงานออฟฟิศ' },
              psychographics: { interests: 'สุขภาพ', values: 'ความสะดวก', aspirations: 'มีเวลาว่างมากขึ้น' },
              pain_points: ['หาของกินสายที่เปิดดึกไม่ได้', 'กลัวอ้วน'],
              size_estimate: '30% ของลูกค้า',
            },
            {
              name: 'น้องเบล', demographics: { age: '24', job: 'นักศึกษา' },
              pain_points: ['งบน้อย'],
              size_estimate: '60% ของลูกค้า',
            },
          ],
        },
        step3: { pain_points: [{ pain: 'สั่งเดลิเวอรี่แพงทุกวันไม่ไหว' }] },
        step4: { uvp_bullets: ['ส่งไว', 'ราคาถูก', 'สดใหม่'] },
      }),
    };

    const draft = mapWizardPlanToBrandDraft(project);

    expect(draft.name).toBe('ร้านแกงถุงป้าน้อย');
    expect(draft.business_summary).toBe('แกงถุงสดใหม่ทุกวัน — ส่งไวใน 20 นาที');
    expect(draft.tone_of_voice).toEqual(['อบอุ่นเป็นกันเอง']);
    expect(draft.audience).toEqual(['พนักงานออฟฟิศที่ไม่มีเวลาทำอาหาร']);
    expect(draft.offers).toEqual(['ส่งไว', 'ราคาถูก', 'สดใหม่']);
    expect(draft.content_pillars).toEqual([]); // ขั้นที่ 2's job, not bootstrap's

    // "น้องเบล" (60%) outsizes "พี่หมู" (30%) — the larger segment wins.
    expect(draft.persona?.name).toBe('น้องเบล');
    // น้องเบล only has 1 own pain_point — topped up from step3 to reach 3.
    expect(draft.persona?.complaints).toHaveLength(2);
    expect(draft.persona?.complaints).toContain('งบน้อย');
    expect(draft.persona?.complaints).toContain('สั่งเดลิเวอรี่แพงทุกวันไม่ไหว');
  });

  it('returns persona: null when the plan has no personas at all (no crash)', () => {
    const draft = mapWizardPlanToBrandDraft({ name: 'ร้านทดสอบ', step_data: JSON.stringify({ step1: {} }) });
    expect(draft.persona).toBeNull();
    expect(draft.name).toBe('ร้านทดสอบ');
  });

  it('degrades gracefully on completely empty/malformed step_data', () => {
    expect(() => mapWizardPlanToBrandDraft({ name: 'ร้านเปล่า', step_data: null })).not.toThrow();
    expect(() => mapWizardPlanToBrandDraft({ name: 'ร้านเปล่า', step_data: 'not json' })).not.toThrow();
    const draft = mapWizardPlanToBrandDraft({ name: 'ร้านเปล่า', step_data: 'not json' });
    expect(draft.name).toBe('ร้านเปล่า');
    expect(draft.offers).toEqual([]);
  });
});

describe('buildBrandBootstrapPrompt (path ข — 3-question AI draft)', () => {
  it('embeds all 3 answers into the user message', () => {
    const { system, user } = buildBrandBootstrapPrompt({
      business: 'ร้านขนมปังโฮมเมด', customer: 'คุณแม่มีลูกเล็ก', complaint: 'หาขนมที่ไม่ใส่สารกันบูดยาก',
    });
    expect(user).toContain('ร้านขนมปังโฮมเมด');
    expect(user).toContain('คุณแม่มีลูกเล็ก');
    expect(user).toContain('หาขนมที่ไม่ใส่สารกันบูดยาก');
    expect(system).toContain('JSON');
  });
});

describe('parseBrandBootstrapOutput (validates AI response shape before it becomes a draft)', () => {
  it('accepts a well-formed response', () => {
    const draft = parseBrandBootstrapOutput({
      name: 'ร้านขนมปัง', business_summary: 'ขายขนมปังโฮมเมด',
      tone_of_voice: ['อบอุ่น'], audience: ['คุณแม่'], offers: ['ไม่ใส่สารกันบูด'],
      persona: { name: 'คุณแม่มะลิ', age: '32', job: 'แม่บ้าน', daily_life: 'ดูแลลูกเล็กทั้งวัน', complaints: ['a', 'b', 'c'] },
    });
    expect(draft.persona?.complaints).toEqual(['a', 'b', 'c']);
  });

  it('throws when persona.complaints is missing or not exactly 3 — this is AI output, held to a stricter bar than the deterministic path', () => {
    expect(() => parseBrandBootstrapOutput({ name: 'x', persona: { complaints: ['a', 'b'] } })).toThrow();
    expect(() => parseBrandBootstrapOutput({ name: 'x', persona: {} })).toThrow();
    expect(() => parseBrandBootstrapOutput({ name: 'x' })).toThrow();
  });

  it('throws on a non-object response instead of silently producing a garbage draft', () => {
    expect(() => parseBrandBootstrapOutput(null)).toThrow();
    expect(() => parseBrandBootstrapOutput('a string')).toThrow();
  });
});
