<script lang="ts">
  /**
   * OS Redesign Master Plan §5 "🏠 วันนี้" — Stage C1. The new home page:
   * three things in order, one mobile screen, no competing CTAs.
   *   1. โพสต์ของวันนี้ — if a post's turn has come, full card + copy/share
   *   2. รอคุณตรวจ (n) — count of AI work awaiting approval, links to Inbox
   *   3. การ์ดทำต่อ 1 ใบ — exactly one suggested next action
   *
   * Stage C1 is purely additive: reachable only by direct URL for now.
   * MobileNav's "วันนี้" item still points at /dashboard until Stage C3
   * does the real IA cutover (redirects, nav rewiring) — deliberately not
   * done here so nothing existing breaks mid-build.
   */
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { initAuth, isAuthed } from '$lib/auth';
  import { listContentItems, type ContentItem } from '$lib/api';
  import { Card, Button, EmptyState, Chip, showToast } from '$lib/ui';

  let loading = $state(true);
  let error = $state('');
  let todayPost = $state<ContentItem | null>(null);
  let pendingReviewCount = $state(0);
  let upcomingCount = $state(0);

  function startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  }

  onMount(async () => {
    await initAuth();
    if (!$isAuthed) { goto('/login'); return; }

    const now = Date.now();
    const endOfToday = startOfDay(new Date(now + 86_400_000));
    const in7Days = now + 7 * 86_400_000;

    try {
      const [dueSoon, pendingReview, upcoming] = await Promise.all([
        // "โพสต์ถึงคิว" — scheduled and due by end of today (covers overdue too).
        listContentItems({ status: 'scheduled', scheduled_to: endOfToday, limit: 5 }),
        listContentItems({ status: 'pending_review', limit: 100 }),
        // Window starts at "now" (not endOfToday) so a not-yet-due item
        // scheduled later today still counts as "coming up" if it ISN'T the
        // one already surfaced above — see the todayPost exclusion below.
        listContentItems({ status: 'scheduled', scheduled_from: now, scheduled_to: in7Days, limit: 100 }),
      ]);
      todayPost = dueSoon[0] || null;
      pendingReviewCount = pendingReview.length;
      // `upcoming`'s window ([now, in7Days)) overlaps `dueSoon`'s ([-inf, endOfToday))
      // whenever todayPost is scheduled later today rather than overdue, so the
      // same item would otherwise be shown as "today's post" AND counted here —
      // exclude it explicitly rather than relying on the windows staying disjoint.
      upcomingCount = upcoming.filter((item) => !todayPost || item.id !== todayPost.id).length;
    } catch (err) {
      error = err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ';
    } finally {
      loading = false;
    }
  });

  function postText(item: ContentItem): string {
    return [item.hook, item.caption, item.cta, item.hashtags?.join(' ')].filter(Boolean).join('\n\n');
  }

  async function copyPost(item: ContentItem) {
    const text = postText(item);
    if (!text.trim()) {
      showToast('โพสต์นี้ยังไม่มีเนื้อหาให้คัดลอก');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast('คัดลอกแล้ว — ไปวางในแอปที่จะโพสต์ได้เลย');
    } catch {
      showToast('คัดลอกไม่สำเร็จ ลองกดเลือกข้อความเอง');
    }
  }

  async function sharePost(item: ContentItem) {
    const text = postText(item);
    if (!text.trim()) {
      showToast('โพสต์นี้ยังไม่มีเนื้อหาให้คัดลอก');
      return;
    }
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch { /* user cancelled — fall through to copy */ }
    }
    await copyPost(item);
  }
</script>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950 pb-24">
  <main class="container-narrow py-8 max-w-2xl space-y-5">
    <h1 class="t-title">วันนี้</h1>

    {#if error}
      <div class="rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-4 py-3 t-caption">{error}</div>
    {/if}

    {#if loading}
      <p class="t-caption text-dark-500 dark:text-dark-400">กำลังโหลด...</p>
    {:else}
      <!-- 1. โพสต์ของวันนี้ -->
      {#if todayPost}
        <Card>
          <div class="t-heading mb-1">โพสต์ของวันนี้</div>
          <div class="flex flex-wrap gap-1.5 mb-3">
            <Chip tone="sage">{todayPost.platform}</Chip>
            {#if todayPost.scheduled_at && todayPost.scheduled_at < Date.now()}<Chip tone="gold">เลยกำหนดแล้ว</Chip>{/if}
          </div>
          <p class="t-body whitespace-pre-line mb-4">{postText(todayPost)}</p>
          <div class="flex gap-2">
            <div class="flex-1"><Button onclick={() => copyPost(todayPost!)}>ก๊อปไปโพสต์</Button></div>
            <div class="flex-1"><Button variant="secondary" onclick={() => sharePost(todayPost!)}>แชร์</Button></div>
          </div>
        </Card>
      {:else}
        <EmptyState emoji="📭" title="วันนี้ยังไม่มีโพสต์ถึงคิว" subtitle="ดูปฏิทินเพื่อเช็คว่าอาทิตย์นี้มีอะไรบ้าง" actionLabel="ดูปฏิทิน" onaction={() => goto('/calendar')} />
      {/if}

      <!-- 2. รอคุณตรวจ -->
      {#if pendingReviewCount > 0}
        <button type="button" onclick={() => goto('/inbox')} class="w-full text-left">
          <Card tinted>
            <div class="flex items-center justify-between">
              <div>
                <div class="t-heading">รอคุณตรวจ</div>
                <div class="t-caption text-dark-600 dark:text-dark-300">งานที่ AI ทำเสร็จแล้ว รออนุมัติ</div>
              </div>
              <div class="text-2xl font-black text-primary-600 dark:text-primary-400">{pendingReviewCount}</div>
            </div>
          </Card>
        </button>
      {/if}

      <!-- 3. การ์ดทำต่อ 1 ใบ -->
      <Card>
        {#if upcomingCount === 0}
          <div class="t-heading mb-1">ปฏิทินอาทิตย์หน้ายังว่าง</div>
          <p class="t-caption text-dark-600 dark:text-dark-300 mb-4">สร้างโพสต์ต่อไหม</p>
          <Button onclick={() => goto('/studio/series')}>สร้างโพสต์</Button>
        {:else}
          <div class="t-heading mb-1">มีโพสต์รอคิวอีก {upcomingCount} ชิ้นในสัปดาห์นี้</div>
          <p class="t-caption text-dark-600 dark:text-dark-300 mb-4">ดูภาพรวมทั้งหมดได้ที่ปฏิทิน</p>
          <Button variant="secondary" onclick={() => goto('/calendar')}>ดูปฏิทิน</Button>
        {/if}
      </Card>
    {/if}
  </main>
</div>
