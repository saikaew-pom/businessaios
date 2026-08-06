<script lang="ts">
  /**
   * Component canon #6 — Sheet. Mobile-first modal replacement: slides up
   * from the bottom instead of centering a dialog box (commitment: "Modal
   * ซ้อน modal บนมือถือ" is on the No List). Controlled by the parent via
   * `open`; closes on backdrop click, Escape, or calling `onclose`.
   */
  let {
    open = false,
    onclose,
    children,
  }: {
    open?: boolean;
    onclose: () => void;
    children?: import('svelte').Snippet;
  } = $props();

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
  <div
    class="fixed inset-0 z-40 flex items-end justify-center bg-dark-900/55 transition-opacity duration-200"
    onclick={onclose}
    role="presentation"
  >
    <div
      class="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-[22px] bg-white p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl dark:bg-dark-800 sm:rounded-b-[22px] sm:mb-6"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-dark-200 dark:bg-dark-600 sm:hidden"></div>
      {@render children?.()}
    </div>
  </div>
{/if}
