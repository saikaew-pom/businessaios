<script lang="ts">
  /**
   * Component canon #10 — CostLine. "บอกต้นทุนก่อนกดทุกปุ่มที่เสียเครดิต"
   * (commitment 4) — every credit-spending button shows this first.
   *
   * The baht conversion is real, not a guess: apps/api/src/lib/packages.ts
   * prices credits at 0.80-0.99 THB each depending on package size. 0.85 is
   * the "Popular" package's rate (the one most users are actually on) —
   * using it here means this line shows a real, defensible approximation,
   * not a made-up round number. (An earlier draft of this plan's own copy
   * said "13 credits ≈ under 1 baht" — actually ≈11 baht at real pricing.
   * Exactly the kind of mismatch commitment 4 exists to catch, including
   * in our own examples.)
   */
  const THB_PER_CREDIT = 0.85;

  let { credits, remaining }: { credits: number; remaining?: number } = $props();

  const approxThb = $derived(Math.round(credits * THB_PER_CREDIT));
</script>

<div class="my-3 flex items-center gap-2 rounded-xl bg-dark-100 px-3.5 py-2.5 t-caption dark:bg-dark-900">
  <span>💳 ใช้ <b class="text-dark-900 dark:text-dark-50">{credits} เครดิต</b>{#if remaining !== undefined} (เหลือ {remaining}){/if}</span>
  <span class="ml-auto">≈ {approxThb} บาท</span>
</div>
