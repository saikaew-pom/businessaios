<script lang="ts">
  /**
   * Component canon #1 — Card. Plain surface for grouping content, or
   * `tinted` for a lower-emphasis "AI note" / secondary block (matches the
   * `.card.tinted` pattern from the OS redesign prototypes).
   */
  let {
    tinted = false,
    padding = 'normal',
    children,
  }: {
    tinted?: boolean;
    padding?: 'normal' | 'tight' | 'none';
    children?: import('svelte').Snippet;
  } = $props();

  const paddingClass = { normal: 'p-4', tight: 'p-2', none: '' }[padding];
</script>

<div
  class="rounded-2xl {padding !== 'none' ? paddingClass : ''} {tinted
    ? 'bg-dark-100 dark:bg-dark-900 border border-transparent'
    : 'bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700'}"
>
  {@render children?.()}
</div>
