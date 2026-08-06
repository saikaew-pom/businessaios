<script lang="ts">
  /**
   * Component canon #3 — ListItem. A row inside a Card: icon + title +
   * subtitle + chevron. Used for navigable rows (settings, hub links) —
   * for a row the user *selects* rather than navigates from, use TapCard.
   */
  let {
    icon,
    title,
    subtitle = '',
    href,
    onclick,
    last = false,
  }: {
    icon?: import('svelte').Snippet;
    title: string;
    subtitle?: string;
    href?: string;
    onclick?: () => void;
    last?: boolean;
  } = $props();

  const borderClass = last ? '' : 'border-b border-dark-200 dark:border-dark-700';
</script>

{#snippet inner()}
  {#if icon}
    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-dark-100 dark:bg-dark-900 text-dark-600 dark:text-dark-300">
      {@render icon()}
    </div>
  {/if}
  <div class="min-w-0 flex-1">
    <div class="t-heading truncate">{title}</div>
    {#if subtitle}
      <div class="t-caption truncate">{subtitle}</div>
    {/if}
  </div>
  {#if href || onclick}
    <svg viewBox="0 0 24 24" class="h-[18px] w-[18px] shrink-0 stroke-dark-300 dark:stroke-dark-600" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
  {/if}
{/snippet}

{#if href}
  <a {href} class="flex items-center gap-3 py-3 {borderClass}">{@render inner()}</a>
{:else if onclick}
  <button type="button" {onclick} class="flex w-full items-center gap-3 py-3 text-left {borderClass}">{@render inner()}</button>
{:else}
  <div class="flex items-center gap-3 py-3 {borderClass}">{@render inner()}</div>
{/if}
