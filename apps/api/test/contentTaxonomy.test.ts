import { describe, it, expect } from 'vitest';
import {
  CONTENT_TYPES,
  isValidContentType,
  contentTypeGroup,
  isValidSeasonalEvent,
  upcomingSeasonalEvents,
} from '../src/lib/creative/contentTaxonomy';

describe('CONTENT_TYPES (14-type taxonomy, 4 groups)', () => {
  it('has exactly 14 types with no duplicate keys', () => {
    expect(CONTENT_TYPES).toHaveLength(14);
    expect(new Set(CONTENT_TYPES.map((t) => t.key)).size).toBe(14);
  });

  it('splits into the confirmed 4+4+3+3 group sizes', () => {
    const counts: Record<string, number> = {};
    for (const t of CONTENT_TYPES) counts[t.group] = (counts[t.group] || 0) + 1;
    expect(counts['ขายฝัน']).toBe(4);
    expect(counts['Expert']).toBe(4);
    expect(counts['Engagement']).toBe(3);
    expect(counts['Review']).toBe(3);
  });
});

describe('isValidContentType / contentTypeGroup', () => {
  it('accepts a real key and derives its group', () => {
    expect(isValidContentType('testimonial')).toBe(true);
    expect(contentTypeGroup('testimonial')).toBe('Review');
  });

  it('rejects an unknown or non-string key', () => {
    expect(isValidContentType('made_up_type')).toBe(false);
    expect(isValidContentType(42)).toBe(false);
    expect(isValidContentType(undefined)).toBe(false);
    expect(contentTypeGroup('made_up_type')).toBeUndefined();
  });
});

describe('THAI_MARKETING_CALENDAR / isValidSeasonalEvent', () => {
  it('accepts a real event key, rejects an unknown one', () => {
    expect(isValidSeasonalEvent('songkran')).toBe(true);
    expect(isValidSeasonalEvent('halloween')).toBe(false);
  });
});

describe('upcomingSeasonalEvents', () => {
  it('finds events within the window, wrapping December → January', () => {
    // From November (11), a 2-month window covers Nov/Dec/Jan.
    const keys = upcomingSeasonalEvents(11, 2).map((e) => e.key);
    expect(keys).toContain('loy_krathong'); // month 11
    expect(keys).toContain('eleven_eleven'); // month 11
    expect(keys).toContain('fathers_day'); // month 12
    expect(keys).toContain('double_twelve'); // month 12
    expect(keys).toContain('new_year'); // month 1, wraps around
    expect(keys).not.toContain('songkran'); // month 4, out of window
  });

  it('returns nothing further out than the window', () => {
    const keys = upcomingSeasonalEvents(1, 1).map((e) => e.key);
    expect(keys).not.toContain('songkran'); // month 4
  });
});
