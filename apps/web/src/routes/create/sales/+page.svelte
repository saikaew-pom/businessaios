<script lang="ts">
  /**
   * Content Playbook ขั้นที่ 5 — "สร้างโพสต์ขาย" (D2b UI, backend is D2a's
   * salesPost.ts). Deliberately a separate flow from /create's Golden Path:
   * that path never asks for real facts (price/promo/guarantee/channel)
   * because the AI can't be trusted to invent them — this page's whole job
   * is to collect exactly those facts and nothing else. Every field except
   * "หัวข้อที่จะขาย" is optional; the backend skips any block it has no real
   * data for rather than fabricating one (see salesPost.ts's doc comment).
   *
   * Reuses the same "done" screen pattern as /create/+page.svelte (post
   * preview + ลงปฏิทิน/ก๊อปไปโพสต์/สร้างรูปประกอบ) — duplicated rather than
   * extracted into a shared helper, matching this codebase's existing choice
   * to duplicate humanizeError's status-code mapping across ContentItemDrawer/
   * calendar/inbox/works/create rather than introduce a new shared module.
   */
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { isAuthed } from '$lib/auth';
  import {
    listBrandProfiles,
    generateSalesPost,
    transitionContentItem,
    createContentItemCreativeRequest,
    type ContentItem,
  } from '$lib/api';
  import { buildStudioPrompt, suggestedAspectRatio } from '$lib/studioHandoff';
  import { Card, Button, Field, EmptyState, showToast } from '$lib/ui';

  type Phase = 'loading' | 'no-brand' | 'form' | 'generating' | 'done' | 'error';
  let phase = $state<Phase>('loading');
  let error = $state('');
  let brandProfileId = $state('');

  let topic = $state('');
  let price = $state('');
  let promo = $state('');
  let guarantee = $state('');
  let channel = $state('');
  let socialProof = $state('');
  let submitting = $state(false);

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
      phase = 'form';
    } catch (err) {
      error = err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ';
      phase = 'error';
    }
  });

  async function submit() {
    if (!topic.trim() || submitting) return;
    submitting = true;
    phase = 'generating';
    error = '';
    try {
      const { item } = await generateSalesPost({
        topic: topic.trim(),
        price: price.trim() || undefined,
        promo: promo.trim() || undefined,
        guarantee: guarantee.trim() || undefined,
        channel: channel.trim() || undefined,
        social_proof: socialProof.trim() || undefined,
        brand_profile_id: brandProfileId,
        platform: 'facebook',
      });
      resultItem = item;
      phase = 'done';
    } catch (err) {
      error = err instanceof Error ? err.message : 'สร้างโพสต์ไม่สำเร็จ ลองอีกครั้ง';
      phase = 'form';
    } finally {
      submitting = false;
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

  function humanizeError(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err || '');
    const map: Record<string, string> = {
      approval_required: 'ต้องอนุมัติก่อนตั้งเวลา',
      invalid_schedule_time: 'เวลาที่ตั้งต้องเป็นเวลาในอนาคต',
      invalid_transition: 'ทำรายการนี้ไม่ได้จากสถานะปัจจุบัน',
    };
    return map[message] || message || 'ลงปฏิทินไม่สำเร็จ';
  }

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
    phase = 'form';
    topic = '';
    price = '';
    promo = '';
    guarantee = '';
    channel = '';
    socialProof = '';
    resultItem = null;
    error = '';
  }
</script>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950 pb-24">
  <main class="container-narrow py-8 max-w-2xl space-y-4">
    <a href="/create" class="t-caption text-dark-500 dark:text-dark-400">← กลับ</a>
    {#if phase === 'loading'}
      <p class="t-caption text-dark-500 dark:text-dark-400">กำลังโหลด...</p>
    {:else if phase === 'no-brand'}
      <EmptyState emoji="🏪" title="ยังไม่มี Brand Profile" subtitle="สร้างครั้งเดียว ใช้ได้กับ content ทุกชิ้นต่อจากนี้" actionLabel="สร้าง Brand Profile" onaction={() => goto('/studio/brand-profile/new')} />
    {:else if phase === 'error'}
      <div class="rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-4 py-3 t-caption">{error}</div>
    {:else if phase === 'form' || phase === 'generating'}
      <h1 class="t-title mb-1">สร้างโพสต์ขาย</h1>
      <p class="t-caption text-dark-500 dark:text-dark-400 mb-4">เติมเฉพาะข้อเท็จจริงที่มีจริง — ข้อไหนไม่มีปล่อยว่างได้ ระบบจะไม่แต่งเติมเอง</p>
      {#if error}<p class="t-caption text-amber-600 dark:text-amber-400 mb-2">{error}</p>{/if}
      <Card>
        <Field label="วันนี้จะขายอะไร / โปรอะไร (จำเป็น)" bind:value={topic} multiline rows={2} placeholder="เช่น โปรลาเต้เย็นสูตรน้ำตาลอ้อย เปิดตัวสัปดาห์นี้" />
        <Field label="ราคา (ถ้ามี)" bind:value={price} placeholder="เช่น 59 บาท จากราคาปกติ 79 บาท" />
        <Field label="โปรโมชั่น (ถ้ามี)" bind:value={promo} placeholder="เช่น ซื้อ 2 แถม 1 เฉพาะสัปดาห์นี้" />
        <Field label="การันตี (ถ้ามี)" bind:value={guarantee} placeholder="เช่น ไม่ชอบคืนเงินเต็มจำนวน" />
        <Field label="ช่องทางสั่งซื้อ (ถ้ามี)" bind:value={channel} placeholder="เช่น ทักไลน์ @panoi-coffee หรือแวะหน้าร้าน" />
        <Field label="รีวิว/หลักฐานจริง (ถ้ามี)" bind:value={socialProof} placeholder="เช่น คุณแนน ลูกค้าประจำ บอกว่าดื่มทุกเช้า" />
        <p class="t-caption text-dark-500 dark:text-dark-100/60 mb-3">ใช้เครดิตไม่เกิน 30 เครดิต — จ่ายจริงเท่าที่ใช้ ส่วนเกินคืนอัตโนมัติ</p>
        <Button disabled={!topic.trim() || phase === 'generating'} onclick={submit}>
          {phase === 'generating' ? 'กำลังเขียนโพสต์ขาย...' : 'สร้างโพสต์ขาย'}
        </Button>
      </Card>
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
      <Button variant="ghost" onclick={startOver}>สร้างโพสต์ขายอีกชิ้น</Button>
    {/if}
  </main>
</div>
