/**
 * Golden-set regression test — Content Playbook Upgrade Plan ขั้นที่ 4's own
 * risk list: "golden set 10 แบรนด์ไว้ regression test ทุกครั้งที่แก้ prompt".
 *
 * Deliberately does NOT call real MiniMax — that would be slow, costly, and
 * flaky in CI, and the whole point here is a fast, deterministic check that
 * a future prompt-engineering edit (to buildSeriesPrompt, buildSalesPostPrompt,
 * or formatBrandContextBlock) doesn't silently break for some realistic
 * brand shape. It exercises the actual PROMPT-BUILDING functions directly —
 * the same code every real generation call goes through before the network
 * call — against 10 varied fixtures (see fixtures/goldenBrands.ts for what
 * varies: persona present/absent, voice_particle present/absent/ครับ/ค่ะ,
 * offers present/absent, voice_samples present/absent).
 *
 * "Regression" here means: brand name isn't lost, no raw-object/undefined
 * leakage into the prompt text (a classic symptom of a broken template
 * string edit), the voice_particle instruction appears exactly when set,
 * and the structural pieces (headline angles, anti-adjective-stacking rule,
 * fact-only sales blocks) survive future edits to those prompt builders.
 */
import { describe, it, expect } from 'vitest';
import { formatBrandContextBlock } from '../src/lib/creative/brandContext';
import { buildSeriesPrompt } from '../src/lib/creative/contentSeries';
import { buildSalesPostPrompt, resolveIncludedBlocks, type SalesPostInput } from '../src/lib/creative/salesPost';
import { GOLDEN_BRANDS } from './fixtures/goldenBrands';

// Symptoms of a broken template-string edit — a stray `${undefined}`, an
// object interpolated without a .join()/JSON.stringify(), a NaN slipping
// into a number-shaped slot. None of these should ever appear in real
// prompt output regardless of which golden brand produced it.
const LEAK_PATTERNS = [/undefined/, /\[object Object\]/, /\bNaN\b/, /null,null/];

function assertNoLeakage(text: string, where: string) {
  for (const pattern of LEAK_PATTERNS) {
    expect(text, `${where} leaked a template artifact matching ${pattern}`).not.toMatch(pattern);
  }
}

describe('Golden-set regression (10 brands) — formatBrandContextBlock', () => {
  for (const brand of GOLDEN_BRANDS) {
    it(`${brand.key}: renders a clean context block`, () => {
      const block = formatBrandContextBlock(brand.snapshot);
      assertNoLeakage(block, `formatBrandContextBlock(${brand.key})`);
      expect(block).toContain(brand.snapshot.name);

      if (brand.snapshot.voice_particle) {
        expect(block, `${brand.key} has voice_particle set but the particle instruction is missing`).toContain(brand.snapshot.voice_particle);
      } else {
        expect(block, `${brand.key} has no voice_particle but a particle line still rendered`).not.toContain('คำลงท้ายประโยค');
      }

      if (brand.snapshot.persona) {
        for (const complaint of brand.snapshot.persona.complaints) {
          expect(block, `${brand.key}'s persona complaint is missing from the context block`).toContain(complaint);
        }
      }
    });
  }
});

describe('Golden-set regression (10 brands) — buildSeriesPrompt at count=MAX_SERIES_COUNT (7)', () => {
  for (const brand of GOLDEN_BRANDS) {
    it(`${brand.key}: builds a structurally complete 7-item prompt`, () => {
      const { system, user } = buildSeriesPrompt({
        topic: 'โปรโมชั่นทดสอบ',
        count: 7,
        slots: [],
        platforms: ['facebook'],
        brandSnapshot: brand.snapshot,
      });
      assertNoLeakage(system, `buildSeriesPrompt(${brand.key}).system`);
      assertNoLeakage(user, `buildSeriesPrompt(${brand.key}).user`);

      // Every item 0..6 must get a rendered slot line — this is the exact
      // mechanism frameworks.ts's resolveFramework/renderSlotLine drives;
      // a regression there (e.g. an off-by-one in the loop bound) would
      // silently drop the last slot instead of throwing.
      for (let i = 0; i < 7; i++) expect(user).toContain(`[slot ${i}]`);

      expect(user, 'headline-angle system prompt block missing').toContain('มุมพาดหัว');
      expect(system, 'anti-adjective-stacking rule missing').toContain('คำคุณศัพท์ลอย');
      expect(user).toContain('โปรโมชั่นทดสอบ');

      if (brand.snapshot.persona) {
        // At least one of the two complaint-driven pillars (awareness,
        // social_proof) must land somewhere in DEFAULT_PILLAR_ROTATION for
        // a real complaint to actually get injected — assert it did, not
        // just that the mechanism exists.
        const anyComplaintInjected = brand.snapshot.persona.complaints.some((c) => user.includes(c));
        expect(anyComplaintInjected, `${brand.key}: no persona complaint made it into the rendered slot lines`).toBe(true);
      }
    });
  }
});

describe('Golden-set regression (10 brands) — buildSalesPostPrompt fact-only inclusion', () => {
  const FACT_SCENARIOS: Array<{ label: string; input: Omit<SalesPostInput, 'topic'> }> = [
    { label: 'no optional facts', input: {} },
    {
      label: 'all optional facts',
      input: {
        price: '199 บาท', promo: 'ซื้อ 1 แถม 1', guarantee: 'คืนเงินเต็มจำนวน',
        channel: 'ทักไลน์ @test', social_proof: 'ลูกค้าจริงบอกว่าดีมาก',
      },
    },
  ];

  for (const brand of GOLDEN_BRANDS) {
    for (const scenario of FACT_SCENARIOS) {
      it(`${brand.key}: ${scenario.label} — prompt matches resolveIncludedBlocks exactly`, () => {
        const input: SalesPostInput = { topic: 'สินค้าทดสอบ', ...scenario.input };
        const brandContextBlock = formatBrandContextBlock(brand.snapshot);
        const { system, user } = buildSalesPostPrompt({ input, platform: 'facebook', brandContextBlock });
        assertNoLeakage(system, `buildSalesPostPrompt(${brand.key}, ${scenario.label}).system`);
        assertNoLeakage(user, `buildSalesPostPrompt(${brand.key}, ${scenario.label}).user`);

        const included = resolveIncludedBlocks(input);
        for (const block of included) {
          expect(user, `${brand.key}/${scenario.label}: expected included block "${block.label}" missing from prompt`).toContain(block.label);
        }

        // The inverse direction matters just as much: a block with no
        // backing fact must never appear — this is the exact "skip a block
        // rather than invent it" rule the plan calls a Trust-cliff risk.
        //
        // Each rendered block line looks like "12. ราคา: บอกราคานี้ตามจริง: …"
        // (see buildSalesPostPrompt's `${i + 1}. ${b.label}: ${instruction}`)
        // — the label is preceded by ". " (the item number), never by ": ".
        // A literal `: {label}:` check therefore never matches the real
        // output regardless of whether the block is present, so it can't
        // catch a leaked block; matching on `. {label}:` does.
        const allLabels = ['หลักฐาน/รีวิว', 'ข้อเสนอ/โปรโมชั่น', 'ราคา', 'การันตี'];
        const includedLabels = new Set(included.map((b) => b.label));
        for (const label of allLabels) {
          if (!includedLabels.has(label)) {
            expect(user, `${brand.key}/${scenario.label}: "${label}" block appeared despite no backing fact`).not.toContain(`. ${label}:`);
          }
        }

        expect(user).toContain('สินค้าทดสอบ');
      });
    }
  }
});
