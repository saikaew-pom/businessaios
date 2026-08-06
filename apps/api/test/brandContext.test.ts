import { describe, it, expect } from 'vitest';
import { validateBrandProfileInput, formatBrandContextBlock } from '../src/lib/creative/brandContext';

describe('validateBrandProfileInput — persona rules', () => {
  it('accepts a well-formed persona with exactly 3 complaints', () => {
    const r = validateBrandProfileInput({
      name: 'x',
      persona: { name: 'พี่หมู', age: '35', job: 'พนักงาน', daily_life: '', complaints: ['a', 'b', 'c'] },
    });
    expect(r.ok).toBe(true);
  });

  it('rejects fewer or more than exactly 3 complaints', () => {
    expect(validateBrandProfileInput({ name: 'x', persona: { name: 'p', complaints: ['a', 'b'] as any } }).errors)
      .toContain('persona_complaints_must_be_exactly_3');
    expect(validateBrandProfileInput({ name: 'x', persona: { name: 'p', complaints: ['a', 'b', 'c', 'd'] as any } }).errors)
      .toContain('persona_complaints_must_be_exactly_3');
  });

  it('rejects a complaint over 200 chars', () => {
    const long = 'a'.repeat(201);
    const r = validateBrandProfileInput({ name: 'x', persona: { name: 'p', complaints: ['a', 'b', long] } });
    expect(r.errors).toContain('persona_complaint_invalid');
  });

  // Regression: request-body values are untrusted and not guaranteed to be
  // strings even where the TS type says so. Before this fix,
  // `complaints.some((c) => !c?.trim() || ...)` threw "c?.trim is not a
  // function" on any non-string, non-nullish entry (e.g. a number) — an
  // unhandled exception that surfaced as a raw 500 from the global error
  // handler instead of a clean 400 validation response. Same issue existed
  // for `p.name?.trim()`.
  it('does not throw on non-string complaint entries; reports a validation error instead', () => {
    expect(() =>
      validateBrandProfileInput({ name: 'x', persona: { name: 'p', complaints: [1, 2, 3] as any } })
    ).not.toThrow();
    const r = validateBrandProfileInput({ name: 'x', persona: { name: 'p', complaints: [1, 2, 3] as any } });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('persona_complaint_invalid');
  });

  it('does not throw on a non-string persona.name; reports a validation error instead', () => {
    expect(() =>
      validateBrandProfileInput({ name: 'x', persona: { name: 42 as any, complaints: ['a', 'b', 'c'] } })
    ).not.toThrow();
    const r = validateBrandProfileInput({ name: 'x', persona: { name: 42 as any, complaints: ['a', 'b', 'c'] } });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('persona_name_required');
  });

  it('null complaint entries are rejected, not treated as a crash or a pass', () => {
    const r = validateBrandProfileInput({ name: 'x', persona: { name: 'p', complaints: ['a', null as any, 'c'] } });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('persona_complaint_invalid');
  });

  it('persona: null is valid (no persona set) and persona: undefined is valid (unchanged)', () => {
    expect(validateBrandProfileInput({ name: 'x', persona: null }).ok).toBe(true);
    expect(validateBrandProfileInput({ name: 'x' }).ok).toBe(true);
  });
});

describe('formatBrandContextBlock', () => {
  it('renders a no-profile snapshot as a plain Thai message, not JSON', () => {
    expect(formatBrandContextBlock(null)).toBe('ไม่มีข้อมูลแบรนด์ (ยังไม่ได้เลือก Brand Profile)');
    expect(formatBrandContextBlock({ schema_version: 1, profile_id: null })).toBe('ไม่มีข้อมูลแบรนด์ (ยังไม่ได้เลือก Brand Profile)');
  });

  it('includes persona name and complaints when present', () => {
    const block = formatBrandContextBlock({
      profile_id: 'p1',
      name: 'ร้านทดสอบ',
      persona: { name: 'พี่หมู', age: '35', job: 'พนักงาน', daily_life: 'ตื่นเช้าไปทำงาน', complaints: ['a', 'b', 'c'] },
    });
    expect(block).toContain('พี่หมู');
    expect(block).toContain('a / b / c');
    expect(block).not.toMatch(/^\{/); // not a raw JSON dump
  });
});
