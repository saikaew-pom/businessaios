import { describe, it, expect } from 'vitest';
import {
  sanitizeExistingTopics,
  parseThemeSuggestionOutput,
  parseTopicSuggestionOutput,
  serializeTheme,
  serializeTopic,
  type ContentThemeRow,
  type ContentTopicRow,
} from '../src/lib/creative/contentThemes';

describe('sanitizeExistingTopics (topic-layer de-dup, mirrors sanitizeExistingHooks)', () => {
  it('flattens, trims, and de-dupes case-insensitively', () => {
    const out = sanitizeExistingTopics(['  หัวข้อ A  ', 'หัวข้อ a', 'หัวข้อ B']);
    expect(out).toEqual(['หัวข้อ A', 'หัวข้อ B']);
  });

  it('drops non-string entries and empty results after trimming', () => {
    const out = sanitizeExistingTopics([42, null, '   ', 'หัวข้อจริง']);
    expect(out).toEqual(['หัวข้อจริง']);
  });

  it('caps the count at 60', () => {
    const many = Array.from({ length: 100 }, (_, i) => `หัวข้อ ${i}`);
    expect(sanitizeExistingTopics(many)).toHaveLength(60);
  });

  it('returns [] for undefined/empty input', () => {
    expect(sanitizeExistingTopics(undefined)).toEqual([]);
    expect(sanitizeExistingTopics([])).toEqual([]);
  });

  it('strips control characters but preserves literal hyphens (a real title can legitimately contain one, e.g. "ก่อน-หลัง")', () => {
    const NUL = String.fromCharCode(0);
    const UNIT_SEPARATOR = String.fromCharCode(31);
    const DEL = String.fromCharCode(127);
    const input = ['ก่อน', NUL, '-', UNIT_SEPARATOR, 'หลัง', DEL, 'ราคาถูก'].join('');
    const out = sanitizeExistingTopics([input]);
    // Each control-char run collapses to a single space; the literal hyphen
    // sitting between two of them is untouched, not swallowed into a run.
    expect(out).toEqual(['ก่อน - หลัง ราคาถูก']);
  });
});

describe('parseThemeSuggestionOutput', () => {
  it('accepts a well-formed 3-5 theme response', () => {
    const themes = parseThemeSuggestionOutput({
      themes: [
        { name: 'ของกินยามดึก', reason: 'ลูกค้าหลักทำงานดึก' },
        { name: 'สุขภาพดีไม่ต้องแพง', reason: 'กลัวอ้วนแต่อยากกินอร่อย' },
        { name: 'ส่งไวไม่ต้องรอ', reason: 'จุดขายหลักคือความเร็ว' },
      ],
    });
    expect(themes).toHaveLength(3);
    expect(themes[0]).toEqual({ name: 'ของกินยามดึก', reason: 'ลูกค้าหลักทำงานดึก' });
  });

  it('throws on fewer than 3 or more than 5 themes', () => {
    expect(() => parseThemeSuggestionOutput({ themes: [{ name: 'a', reason: 'x' }] })).toThrow();
    expect(() => parseThemeSuggestionOutput({
      themes: Array.from({ length: 6 }, (_, i) => ({ name: `theme ${i}`, reason: 'x' })),
    })).toThrow();
  });

  it('throws on a non-object / missing themes array instead of returning garbage', () => {
    expect(() => parseThemeSuggestionOutput(null)).toThrow();
    expect(() => parseThemeSuggestionOutput({})).toThrow();
  });

  it('drops entries with no name rather than crashing', () => {
    const themes = parseThemeSuggestionOutput({
      themes: [
        { name: 'a', reason: 'x' }, { reason: 'no name here' },
        { name: 'b', reason: 'y' }, { name: 'c', reason: 'z' },
      ],
    });
    expect(themes).toHaveLength(3);
  });
});

describe('parseTopicSuggestionOutput', () => {
  it('accepts well-formed topics and keeps only known content_type values', () => {
    const topics = parseTopicSuggestionOutput({
      topics: [
        { title: 'ของกินยามดึกใกล้บ้าน', content_type: 'lifestyle', seasonal_event: null },
        { title: 'รีวิวจากลูกค้าจริง', content_type: 'testimonial', seasonal_event: 'songkran' },
        { title: 'หัวข้อประเภทมั่ว', content_type: 'not_a_real_type', seasonal_event: null },
        { title: 'อีเวนต์มั่ว', content_type: 'tips', seasonal_event: 'made_up_event' },
        { title: 'อีก 1', content_type: 'faq', seasonal_event: null },
      ],
    });
    // the "not_a_real_type" entry is dropped entirely (invalid content_type)
    expect(topics).toHaveLength(4);
    expect(topics.find((t) => t.title === 'หัวข้อประเภทมั่ว')).toBeUndefined();
    // an invalid seasonal_event value is nulled, not dropped
    const madeUp = topics.find((t) => t.title === 'อีเวนต์มั่ว');
    expect(madeUp?.seasonal_event).toBeNull();
    const withRealEvent = topics.find((t) => t.title === 'รีวิวจากลูกค้าจริง');
    expect(withRealEvent?.seasonal_event).toBe('songkran');
  });

  it('throws when fewer than 4 usable topics survive filtering (model drifted badly)', () => {
    expect(() => parseTopicSuggestionOutput({
      topics: [{ title: 'a', content_type: 'not_real' }, { title: 'b', content_type: 'also_fake' }],
    })).toThrow();
  });

  it('throws on a non-object / missing topics array', () => {
    expect(() => parseTopicSuggestionOutput(null)).toThrow();
    expect(() => parseTopicSuggestionOutput({})).toThrow();
  });
});

describe('serializeTheme / serializeTopic', () => {
  it('strips internal columns (user_id) from the API-facing shape', () => {
    const themeRow: ContentThemeRow = {
      id: 't1', user_id: 'u1', brand_profile_id: 'b1', name: 'ธีม', reason: 'เหตุผล',
      status: 'confirmed', created_at: 0, updated_at: 0,
    };
    const serialized = serializeTheme(themeRow) as any;
    expect(serialized.user_id).toBeUndefined();
    expect(serialized.name).toBe('ธีม');

    const topicRow: ContentTopicRow = {
      id: 'to1', user_id: 'u1', theme_id: 't1', title: 'หัวข้อ', content_type: 'tips',
      seasonal_event: null, status: 'suggested', used_series_id: null, created_at: 0, updated_at: 0,
    };
    const serializedTopic = serializeTopic(topicRow) as any;
    expect(serializedTopic.user_id).toBeUndefined();
    expect(serializedTopic.title).toBe('หัวข้อ');
  });
});
