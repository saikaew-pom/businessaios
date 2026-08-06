<script lang="ts">
  /**
   * Component canon #8 — EmptyState. "Empty state สอนงาน" (commitment 6):
   * an icon/emoji, one sentence explaining what goes here, and a button to
   * start — never a bare grey box with just "ยังไม่มีข้อมูล".
   */
  let {
    emoji = '🌱',
    title,
    subtitle = '',
    actionLabel = '',
    onaction,
  }: {
    emoji?: string;
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onaction?: () => void;
  } = $props();
</script>

<div class="flex flex-col items-center rounded-2xl border-2 border-dashed border-dark-200 px-6 py-10 text-center dark:border-dark-700">
  <span class="mb-3 text-4xl leading-none">{emoji}</span>
  <div class="t-heading mb-1">{title}</div>
  {#if subtitle}<div class="t-caption mb-5 max-w-sm">{subtitle}</div>{/if}
  {#if actionLabel && onaction}
    <button type="button" onclick={onaction} class="rounded-2xl bg-primary-500 px-5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-primary-600">
      {actionLabel}
    </button>
  {/if}
</div>
