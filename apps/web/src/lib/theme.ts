/**
 * Theme (light/dark) store with localStorage persistence — same pattern as
 * $lib/stores.ts's `locale`. Applies/removes the `dark` class on <html>,
 * which tailwind.config.js's `darkMode: 'class'` gates every `dark:` variant on.
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

function detectInitialTheme(): Theme {
  if (!browser) return 'light';

  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const theme = writable<Theme>(detectInitialTheme());

if (browser) {
  theme.subscribe((value) => {
    localStorage.setItem('theme', value);
    document.documentElement.classList.toggle('dark', value === 'dark');
  });
}

export function toggleTheme() {
  theme.update((current) => (current === 'dark' ? 'light' : 'dark'));
}
