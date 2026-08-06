<script lang="ts">
  // Mounted once in +layout.svelte. See toastStore.ts for the calling API.
  import { toastState, dismissToast } from './toastStore';
</script>

{#if $toastState}
  <div
    class="fixed inset-x-4 z-50 flex items-center gap-3 rounded-2xl bg-dark-900 px-4 py-3.5 text-[13.5px] text-white shadow-xl transition-opacity duration-200 dark:bg-dark-50 dark:text-dark-900"
    style="bottom: calc(5.5rem + env(safe-area-inset-bottom));"
    role="status"
  >
    <span class="flex-1">{$toastState.message}</span>
    {#if $toastState.undo}
      <button
        type="button"
        onclick={() => {
          $toastState?.undo?.();
          dismissToast();
        }}
        class="shrink-0 font-black text-primary-300 dark:text-primary-600"
      >
        เลิกทำ
      </button>
    {/if}
  </div>
{/if}
