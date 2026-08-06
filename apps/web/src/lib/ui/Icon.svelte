<script lang="ts">
  /**
   * System icon set (commitment 4.3) — replaces emoji-as-icon (audit P2-1:
   * "🎤💎🛡️🎣 ดูไม่โปร") with one stroke-icon language, hand-inlined here
   * rather than adding lucide-svelte or similar as a new dependency —
   * apps/web currently has zero runtime npm dependencies (only devDependencies),
   * and this is a small enough curated set (~16 icons, the ones this app
   * actually uses) that adding a package for it would be the first
   * dependency purely to save writing some <path> elements.
   *
   * Emoji are NOT banned system-wide — they stay for moments with actual
   * feeling (🎉 celebration, 🎊 a seasonal topic card) per commitment 4.3.
   * This component is specifically for icons that function as UI chrome:
   * nav items, buttons, list rows.
   */
  type IconName =
    | 'home' | 'edit' | 'calendar' | 'store' | 'more-horizontal'
    | 'zap' | 'shield' | 'image' | 'wallet' | 'folder' | 'terminal'
    | 'user' | 'inbox' | 'layout-grid' | 'chevron-right' | 'x' | 'log-out'
    | 'check' | 'undo';

  let { name, size = 20 }: { name: IconName; size?: number } = $props();

  const paths: Record<IconName, string[]> = {
    home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5', 'M10 21v-6h4v6'],
    edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'],
    calendar: ['M5 5 19 5 Q 21 5 21 7 L 21 19 Q 21 21 19 21 L 5 21 Q 3 21 3 19 L 3 7 Q 3 5 5 5 Z', 'M3 10h18', 'M8 3v4', 'M16 3v4'],
    store: ['M4 10v10h16V10', 'M3 10 5 4h14l2 6', 'M9.5 20v-5h5v5'],
    'more-horizontal': ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
    zap: ['M13 2 3 14h7l-1 8 10-12h-7z'],
    shield: ['M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z'],
    image: ['M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z', 'M9 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z', 'm5 17 5-5 3 3 4-4 3 3'],
    wallet: ['M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3', 'M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-4a2 2 0 0 0 0 4h4'],
    folder: ['M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z'],
    terminal: ['m8 6-6 6 6 6', 'm16 6 6 6-6 6'],
    user: ['M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z', 'M4 21c1.5-4.5 5-6.5 8-6.5s6.5 2 8 6.5'],
    inbox: ['M3 12h5l1.5 3h5L16 12h5', 'M5.5 5h13l2.5 7v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7Z'],
    'layout-grid': ['M4 4h7v7H4Z', 'M13 4h7v7h-7Z', 'M4 13h7v7H4Z', 'M13 13h7v7h-7Z'],
    'chevron-right': ['m9 6 6 6-6 6'],
    x: ['M18 6 6 18', 'm6 6 12 12'],
    'log-out': ['M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4', 'm16 17 5-5-5-5', 'M21 12H9'],
    check: ['m4 12 6 6 10-12'],
    undo: ['M3 10h10a5 5 0 0 1 5 5v1', 'M8 5 3 10l5 5'],
  };
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#each paths[name] as d}
    <path {d} />
  {/each}
</svg>
