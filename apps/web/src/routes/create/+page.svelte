<script lang="ts">
  /**
   * OS Redesign Master Plan §5 "✍️ สร้าง" + Content Playbook ขั้นที่ 3
   * "Golden Path เส้นทางป้าน้อย" — Stage C2. One question, one tap, one
   * finished post. Target: first post done in ≤3 minutes, typing ≤2 fields
   * (in practice here: 0 fields — the whole path is tap-only once a brand
   * profile + at least one confirmed theme already exist).
   *
   * Scope decision (stated, not silently dropped): the plan's "เห็นโพสต์
   * เสร็จพร้อมรูป" (see the finished post WITH an image) is NOT wired to
   * real image generation here. Real generation requires a model pick +
   * pricing quote + async polling (potentially minutes) — see
   * lib/media/generations.ts. Auto-spending credits on an image before the
   * user has even confirmed they like the TEXT would work against the
   * 3-minute goal, not for it. Instead this page finishes with the text
   * post + a "🎨 สร้างรูปประกอบ" button that hands off to the EXISTING
   * Creative Studio flow (same mechanism ContentItemDrawer's "สร้างงานภาพ"
   * button already uses) — reusing tested plumbing rather than building a
   * second, rushed image-generation path.
   *
   * Stage C2 is purely additive: reachable only by direct URL for now.
   * MobileNav's "สร้าง" item still points at /studio/series until Stage C3.
   */
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { isAuthed } from '$lib/auth';
  import {
    listBrandProfiles,
    listContentThemes,
    listContentTopics,
    suggestContentTopics,
    generateContentSeries,
    transitionContentItem,
    type ContentTheme,
    type ContentTopic,
    type ContentItem,
  } from '$lib/api';
  import { createContentItemCreativeRequest } from '$lib/api';
  import { buildStudioPrompt, suggestedAspectRatio } from '$lib/studioHandoff';
  import { Card, Button, TapCard, Chip, EmptyState, showToast } from '$lib/ui';
  import { contentTypeLabel, contentTypeChipTone } from '$lib/contentTaxonomy';

  // "ขายของ / เล่าเรื่องร้าน / ให้ความรู้ลูกค้า" — a coarser 3-way cut over
  // the same 14-type taxonomy from ขั้นที่ 2, for a first-time user who
  // shouldn't have to think about types/groups at all. Mapping is a design
  // judgment call (stated here, not hidden): sell = the aspirational-sell
  // types minus "lifestyle" (that reads more as storytelling than a pitch);
  // tell-your-story = storytelling + social proof (the "human" side);
  // educate = Expert + the remaining Engagement types.
  const CATEGORIES = [
    { key: 'sell', emoji: '💰', label: 'ขายของ', types: ['before_after', 'promotion', 'new_launch'] },
    { key: 'story', emoji: '📖', label: 'เล่าเรื่องร้าน', types: ['lifestyle', 'behind_the_scenes', 'casual_chat', 'testimonial', 'case_study', 'ugc'] },
    { key: 'educate', emoji: '💡', label: 'ให้ความรู้ลูกค้า', types: ['tips', 'faq', 'comparison', 'poll_question', 'seasonal'] },
  ];

  type Phase = 'loading' | 'no-brand' | 'no-theme' | 'choose' | 'topics' | 'generating' | 'done' | 'error';
  let phase = $state<Phase>('loading');
  let error = $state('');
  let brandProfileId = $state('');
  let themeId = $state('');
  let selectedCategory = $state<(typeof CATEGORIES)[number] | null>(null);
  let matchingTopics = $state<ContentTopic[]>([]);
  let loadingTopics = $state(false);
  let resultItem = $state<ContentItem | null>(null);
  let schedulingBusy = $state(false);

  onMount(async () => {
    await import('$lib/auth').then((m) => m.initAuth());
    if (!$isAuthed) { goto('/login'); return; }

    try {
      const { profiles, active_profile } = await listBrandProfiles();
      const profile = active_profile || profiles[0];
      if (!profile) { phase = 'no-brand'; return; }
      brandProfileId = profile.id;

      const { themes } = await listContentThemes(profile.id);
      const confirmed = themes.filter((t) => t.status === 'confirmed');
      if (!confirmed.length) { phase = 'no-theme'; return; }
      // Most-recently-confirmed theme — the Golden Path doesn't ask the user
      // to pick a theme explicitly (that's "ขั้นสูง" territory via
      // /studio/series); it just needs SOME grounded theme to draw from.
      themeId = confirmed.sort((a, b) => b.updated_at - a.updated_at)[0].id;
      phase = 'choose';
    } catch (err) {
      error = err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ';
      phase = 'error';
    }
  });

  async function pickCategory(cat: (typeof CATEGORIES)[number]) {
    selectedCategory = cat;
    phase = 'topics';
    loadingTopics = true;
    error = '';
    try {
      let { topics } = await listContentTopics(themeId);
      let matches = topics.filter((t) => cat.types.includes(t.content_type));
      if (matches.length < 3) {
        const suggested = await suggestContentTopics(themeId);
        topics = [...topics, ...suggested.topics];
        matches = topics.filter((t) => cat.types.includes(t.content_type));
      }
      matchingTopics = matches.slice(0, 6);
      if (!matchingTopics.length) {
        error = 'ยังไม่มีหัวข้อประเภทนี้ตอนนี้ ลองประเภทอื่นดูก่อนได้';
        phase = 'choose';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'คิดหัวข้อไม่สำเร็จ';
      phase = 'choose';
    } finally {
      loadingTopics = false;
    }
  }

  async function pickTopic(topic: ContentTopic) {
    phase = 'generating';
    error = '';
    try {
      const result = await generateContentSeries({
        topic: topic.title,
        requested_count: 1,
        brand_profile_id: brandProfileId,
        topic_id: topic.id,
        platforms: ['facebook', 'line', 'tiktok'],
      });
      resultItem = result.items[0] || null;
      if (!resultItem) throw new Error('AI ไม่ได้สร้างโพสต์กลับมา');
      phase = 'done';
    } catch (err) {
      error = err instanceof Error ? err.message : 'สร้างโพสต์ไม่สำเร็จ';
      phase = 'topics';
    }
  }

  function postText(item: ContentItem): string {
    return [item.hook, item.caption, item.cta, item.hashtags?.join(' ')].filter(Boolean).join('\n\n');
  }

  async function copyPost() {
    if (!resultItem) return;
    try {
      await navigator.clipboard.writeText(postText(resultItem));
      showToast('คัดลอกแล้ว — ไปวางในแอปที่จะโพสต์ได้เลย');
    } catch {
      showToast('คัดลอกไม่สำเร็จ ลองกดเลือกข้อความเอง');
    }
  }

  async function addToCalendar() {
    if (!resultItem || schedulingBusy) return;
    schedulingBusy = true;
    try {
      // Idempotent by current status rather than assuming a fresh item: if a
      // prior click got the approve through but the schedule call then
      // failed (network blip), resultItem is now 'approved' server-side, and
      // re-running an unconditional approve would 409 (invalid_transition)
      // and permanently block this button from ever reaching the schedule
      // step. Checking status before each call lets a retry pick up exactly
      // where the previous attempt left off.
      let item = resultItem;
      if (item.status !== 'approved' && item.status !== 'scheduled') {
        item = await transitionContentItem(item.id, { action: 'approve' });
        resultItem = item;
      }
      if (item.status !== 'scheduled') {
        item = await transitionContentItem(item.id, { action: 'schedule', scheduled_at: Date.now() + 3_600_000 });
        resultItem = item;
      }
      showToast('ลงปฏิทินแล้ว');
      goto('/calendar');
    } catch (err) {
      showToast(humanizeError(err));
    } finally {
      schedulingBusy = false;
    }
  }

  // Same code->Thai mapping ContentItemDrawer/calendar/inbox/works already
  // use for transitionContentItem failures — the /transition endpoint
  // deliberately returns bare error codes with no `message` field for these,
  // so each caller is expected to translate them rather than show the raw
  // code in a toast.
  function humanizeError(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err || '');
    const map: Record<string, string> = {
      approval_required: 'ต้องอนุมัติก่อนตั้งเวลา',
      invalid_schedule_time: 'เวลาที่ตั้งต้องเป็นเวลาในอนาคต',
      invalid_transition: 'ทำรายการนี้ไม่ได้จากสถานะปัจจุบัน',
    };
    return map[message] || message || 'ลงปฏิทินไม่สำเร็จ';
  }

  // Same hand-off ContentItemDrawer's "🎨 สร้างงานภาพ" button already uses —
  // reuses tested plumbing instead of a second image-generation path.
  async function createVisual() {
    if (!resultItem) return;
    try {
      const { creative_request_id } = await createContentItemCreativeRequest(resultItem.id);
      localStorage.setItem('creativeStudioDraft', JSON.stringify({
        creative_request_id,
        prompt: buildStudioPrompt(resultItem),
        options: { aspect_ratio: suggestedAspectRatio(resultItem), response_format: 'url', num_images: 1 },
      }));
      goto('/studio');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'เปิด Studio ไม่สำเร็จ');
    }
  }

  function startOver() {
    phase = 'choose';
    selectedCategory = null;
    matchingTopics = [];
    resultItem = null;
    error = '';
  }
</script>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950 pb-24">
  <main class="container-narrow py-8 max-w-2xl space-y-4">
    {#if phase === 'loading'}
      <p class="t-caption text-dark-500 dark:text-dark-400">กำลังโหลด...</p>
    {:else if phase === 'no-brand'}
      <EmptyState emoji="🏪" title="ยังไม่มี Brand Profile" subtitle="สร้างครั้งเดียว ใช้ได้กับ content ทุกชิ้นต่อจากนี้" actionLabel="สร้าง Brand Profile" onaction={() => goto('/studio/brand-profile/new')} />
    {:else if phase === 'no-theme'}
      <EmptyState emoji="🧭" title="ยังไม่มีธีมเสาหลัก" subtitle="ให้ AI ช่วยคิดธีมก่อน แล้วค่อยกลับมาสร้างโพสต์" actionLabel="ไปคิดธีม" onaction={() => goto('/studio/series')} />
    {:else if phase === 'error'}
      <div class="rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-4 py-3 t-caption">{error}</div>
    {:else if phase === 'choose'}
      <h1 class="t-title mb-1">วันนี้อยากโพสต์เรื่องอะไร</h1>
      {#if error}<p class="t-caption text-amber-600 dark:text-amber-400 mb-2">{error}</p>{/if}
      <div class="space-y-3">
        {#each CATEGORIES as cat}
          <TapCard emoji={cat.emoji} title={cat.label} onclick={() => pickCategory(cat)} />
        {/each}
      </div>
    {:else if phase === 'topics'}
      <button type="button" onclick={() => (phase = 'choose')} class="t-caption text-dark-500 dark:text-dark-400 mb-2">← ย้อนกลับ</button>
      <h1 class="t-title mb-3">{selectedCategory?.emoji} {selectedCategory?.label}</h1>
      {#if loadingTopics}
        <p class="t-caption text-dark-500 dark:text-dark-400">กำลังคิดหัวข้อ...</p>
      {:else}
        <div class="space-y-2">
          {#each matchingTopics as t}
            <TapCard onclick={() => pickTopic(t)}>
              <div class="t-body font-semibold">{t.title}</div>
              <div class="mt-1.5"><Chip tone={contentTypeChipTone(t.content_type)}>{contentTypeLabel(t.content_type)}</Chip></div>
            </TapCard>
          {/each}
        </div>
      {/if}
    {:else if phase === 'generating'}
      <p class="t-caption text-dark-500 dark:text-dark-400">กำลังเขียนโพสต์...</p>
    {:else if phase === 'done' && resultItem}
      <Card>
        <div class="t-heading mb-1">โพสต์เสร็จแล้ว</div>
        <p class="t-body whitespace-pre-line mb-4">{postText(resultItem)}</p>
        <div class="flex gap-2 mb-2">
          <div class="flex-1"><Button disabled={schedulingBusy} onclick={addToCalendar}>{schedulingBusy ? 'กำลังลง...' : 'ลงปฏิทิน'}</Button></div>
          <div class="flex-1"><Button variant="secondary" onclick={copyPost}>ก๊อปไปโพสต์</Button></div>
        </div>
        <Button variant="ghost" onclick={createVisual}>🎨 สร้างรูปประกอบ</Button>
      </Card>
      <Button variant="ghost" onclick={startOver}>สร้างโพสต์ต่ออีก</Button>
    {/if}
  </main>
</div>
