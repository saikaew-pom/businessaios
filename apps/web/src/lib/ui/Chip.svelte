<script lang="ts">
  /**
   * Component canon #5 — Chip. Small toggle/tag, e.g. tone/emotion
   * modifiers on the ✨ regenerate buttons, or a topic card's type tag.
   * `interactive` chips toggle on click; non-interactive ones (pass no
   * onclick) render as plain tags (e.g. "🎊 ใกล้วันแม่").
   */
  let {
    active = false,
    tone = 'neutral',
    onclick,
    children,
  }: {
    active?: boolean;
    tone?: 'neutral' | 'sage' | 'gold';
    onclick?: () => void;
    children?: import('svelte').Snippet;
  } = $props();

  const toneClass = {
    neutral: 'bg-dark-100 dark:bg-dark-900 text-dark-700 dark:text-dark-200',
    sage: 'bg-sage-100 dark:bg-sage-800/40 text-sage-800 dark:text-sage-100',
    gold: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
  }[tone];
</script>

{#if onclick}
  <button
    type="button"
    {onclick}
    class="rounded-full border-[1.5px] px-3 py-1.5 text-[12.5px] font-bold transition-colors duration-150
      {active ? 'border-dark-900 bg-dark-900 text-white dark:border-dark-50 dark:bg-dark-50 dark:text-dark-900' : 'border-dark-200 bg-white text-dark-900 hover:border-dark-400 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-50'}"
  >
    {@render children?.()}
  </button>
{:else}
  <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold {toneClass}">
    {@render children?.()}
  </span>
{/if}
