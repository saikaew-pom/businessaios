<script lang="ts">
  /**
   * Component canon #7 — Field. Labeled text input, replacing the bare
   * `.input` class scattered across the app with a version that always
   * carries a visible label (a11y: audit P2-7 found controls with no
   * label at all).
   */
  let {
    label,
    value = $bindable(''),
    placeholder = '',
    type = 'text',
    hint = '',
    multiline = false,
    rows = 3,
  }: {
    label: string;
    value?: string;
    placeholder?: string;
    type?: string;
    hint?: string;
    multiline?: boolean;
    rows?: number;
  } = $props();

  const fieldClass = 'w-full rounded-xl border-[1.5px] border-dark-200 bg-white px-3.5 py-2.5 t-body text-dark-900 placeholder:text-dark-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-dark-700 dark:bg-dark-900 dark:text-dark-50 dark:placeholder:text-dark-500';
</script>

<label class="mb-3.5 block">
  <span class="t-micro mb-1.5 block text-dark-600 dark:text-dark-300">{label}</span>
  {#if multiline}
    <textarea bind:value {placeholder} {rows} class={fieldClass}></textarea>
  {:else}
    <input {type} bind:value {placeholder} class={fieldClass} />
  {/if}
  {#if hint}
    <span class="t-caption mt-1 block">{hint}</span>
  {/if}
</label>
