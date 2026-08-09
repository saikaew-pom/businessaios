import { describe, it, expect } from 'vitest';
import {
  FRAMEWORK_SPEC,
  HEADLINE_ANGLES,
  isComplaintDrivenPillar,
  parseHeadlineAngles,
  renderSlotLine,
  resolveFramework,
} from '../src/lib/creative/frameworks';

describe('resolveFramework', () => {
  it('rotates through a pillar\'s framework list by slot position when no explicit framework is set', () => {
    // Backward-compat case: a content_series_templates row saved before the
    // Framework Engine existed only has {pillar, hook_style, cta_style,
    // notes} — no `framework` field. resolveFramework must still produce
    // varied structure across positions, not collapse to one framework.
    const seen = [0, 1, 2].map((i) => resolveFramework('education', i));
    expect(seen).toEqual(['how_to', 'mindset_tips', 'mindset_do_dont']);
    expect(new Set(seen).size).toBe(3); // genuinely varied, not collapsed
  });

  it('wraps around once the position exceeds the pillar\'s framework count', () => {
    expect(resolveFramework('education', 4)).toBe(resolveFramework('education', 0));
  });

  it('an explicit framework on the slot always wins over the pillar rotation', () => {
    expect(resolveFramework('education', 0, 'story_5_beat')).toBe('story_5_beat');
  });

  it('falls back to the education rotation for an unknown pillar', () => {
    expect(resolveFramework('made_up_pillar', 0)).toBe(resolveFramework('education', 0));
  });

  it('ignores an explicit framework value that is not a real framework key', () => {
    expect(resolveFramework('education', 0, 'not_a_real_framework')).toBe('how_to');
  });
});

describe('parseHeadlineAngles — never throws on adversarial model output', () => {
  const cases: Array<[string, unknown, string[]]> = [
    ['a bare string instead of an array', 'result', []],
    ['mixed valid/invalid element types', [123, null, 'result'], ['result']],
    ['a duplicate valid value', ['result', 'result', 'question'], ['result', 'question']],
    ['undefined', undefined, []],
    ['null', null, []],
    ['an empty array', [], []],
    ['a plain object', { a: 1 }, []],
    ['more than 2 valid values (truncates to 2)', ['result', 'question', 'problem', 'time', 'unlikely'], ['result', 'question']],
    ['wrong-case keys (rejected, not normalised)', ['Result', 'RESULT'], []],
    ['a nested array', [['result']], []],
    ['NaN/Infinity mixed with a valid value', [NaN, Infinity, 'time'], ['time']],
  ];

  for (const [label, input, expected] of cases) {
    it(`degrades sensibly for: ${label}`, () => {
      expect(() => parseHeadlineAngles(input)).not.toThrow();
      expect(parseHeadlineAngles(input)).toEqual(expected);
    });
  }

  it('every declared angle key round-trips through validation', () => {
    for (const angle of HEADLINE_ANGLES) {
      expect(parseHeadlineAngles([angle.key])).toEqual([angle.key]);
    }
  });
});

describe('renderSlotLine — complaint cycling', () => {
  const complaints = ['complaint-A', 'complaint-B', 'complaint-C'];

  it('advances through all 3 complaints before repeating when complaint-driven slots are spaced a multiple of complaints.length apart', () => {
    // Regression case for the bug fixed in this review: cycling complaints
    // by the raw item index (`index % complaints.length`) collided whenever
    // complaint-driven pillar slots were spaced a multiple of 3 apart — e.g.
    // awareness at item indices 0, 3, 6 all resolved to complaints[0],
    // repeating the SAME complaint for every occurrence in the batch instead
    // of varying it. Tracking occurrences of complaint-driven slots
    // separately from the item index fixes this.
    const slots = [{ pillar: 'awareness' }, { pillar: 'education' }, { pillar: 'education' }];
    const usedComplaints: string[] = [];
    let complaintOccurrence = 0;
    for (let i = 0; i < 6; i++) {
      const slot = slots[i % slots.length];
      const line = renderSlotLine(i, slot, complaints, complaintOccurrence);
      if (isComplaintDrivenPillar(slot.pillar)) {
        complaintOccurrence++;
        const match = line.match(/เปิดด้วยคำบ่นนี้ถ้าเข้ากับหัวข้อ: "([^"]+)"/);
        usedComplaints.push(match?.[1] ?? '');
      }
    }
    // Slots at i=0,3 are the only awareness (complaint-driven) occurrences here.
    expect(usedComplaints).toEqual(['complaint-A', 'complaint-B']);
  });

  it('does not inject a complaint line for a pillar that is not complaint-driven', () => {
    const line = renderSlotLine(0, { pillar: 'education' }, complaints, 0);
    expect(line).not.toContain('เปิดด้วยคำบ่นนี้');
  });

  it('does not inject a complaint line when the brand has no persona complaints', () => {
    const line = renderSlotLine(0, { pillar: 'awareness' }, undefined, 0);
    expect(line).not.toContain('เปิดด้วยคำบ่นนี้');
  });
});

describe('FRAMEWORK_SPEC — sanity', () => {
  it('every framework has a non-empty label, structure, and length hint', () => {
    for (const [key, spec] of Object.entries(FRAMEWORK_SPEC)) {
      expect(spec.label.trim().length, `${key}.label`).toBeGreaterThan(0);
      expect(spec.structure.trim().length, `${key}.structure`).toBeGreaterThan(0);
      expect(spec.lengthHint.trim().length, `${key}.lengthHint`).toBeGreaterThan(0);
    }
  });
});
