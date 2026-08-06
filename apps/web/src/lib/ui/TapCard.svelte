<script lang="ts">
  /**
   * Component canon #4 — TapCard. A card the user *selects* (category
   * picker, topic picker, pillar toggle) — as opposed to ListItem, which
   * navigates. Shows a checkmark when `selected`.
   */
  let {
    emoji = '',
    title,
    subtitle = '',
    selected = false,
    disabled = false,
    onclick,
    children,
  }: {
    emoji?: string;
    title?: string;
    subtitle?: string;
    selected?: boolean;
    disabled?: boolean;
    onclick?: () => void;
    children?: import('svelte').Snippet;
  } = $props();
</script>

<button
  type="button"
  {disabled}
  onclick={disabled ? undefined : onclick}
  class="flex w-full items-center gap-3 rounded-2xl border-[1.5px] p-4 text-left transition-colors duration-150 disabled:opacity-40
    {selected
      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
      : 'border-dark-200 bg-white hover:border-primary-300 dark:border-dark-700 dark:bg-dark-800 dark:hover:border-primary-600'}"
>
  {#if children}
    <div class="min-w-0 flex-1">{@render children()}</div>
  {:else}
    {#if emoji}<span class="text-2xl leading-none">{emoji}</span>{/if}
    <div class="min-w-0 flex-1">
      <div class="t-heading">{title}</div>
      {#if subtitle}<div class="t-caption">{subtitle}</div>{/if}
    </div>
  {/if}
  <div
    class="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-black
      {selected ? 'border-primary-500 bg-primary-500 text-white' : 'border-dark-300 dark:border-dark-600 text-transparent'}"
  >
    ✓
  </div>
</button>
