/**
 * Locale store with localStorage persistence
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { Locale } from './i18n';

function detectInitialLocale(): Locale {
  if (!browser) return 'th';

  const stored = localStorage.getItem('locale');
  if (stored === 'th' || stored === 'en') return stored;

  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('th')) return 'th';
  return 'en';
}

export const locale = writable<Locale>(detectInitialLocale());

if (browser) {
  locale.subscribe((value) => {
    localStorage.setItem('locale', value);
    document.documentElement.lang = value;
  });
}

export function toggleLocale() {
  locale.update((current) => (current === 'th' ? 'en' : 'th'));
}
