<script lang="ts">
  /**
   * Shared content-item edit drawer — opened from /works and /inbox today,
   * and meant to be reused unchanged from /calendar (Stage 4) so "click an
   * item to edit and save" behaves identically wherever the item is clicked
   * from.
   */
  import { goto } from '$app/navigation';
  import {
    createContentItemCreativeRequest,
    getMediaAssetContentUrl,
    transitionContentItem,
    updateContentItem,
    type ContentItem,
  } from '$lib/api';

  let { item, onClose, onUpdated }: {
    item: ContentItem | null;
    onClose: () => void;
    onUpdated: (item: ContentItem) => void | Promise<void>;
  } = $props();

  let title = $state('');
  let platform = $state('');
  let format = $state('');
  let pillar = $state('');
  let hook = $state('');
  let caption = $state('');
  let cta = $state('');
  let hashtagsText = $state('');
  let visualSuggestion = $state('');
  let expectedEngagement = $state('');

  let isSaving = $state(false);
  let isActionBusy = $state('');
  // Save and every status transition/studio action mutate the same content
  // item, so they must not be allowed to fire concurrently (e.g. clicking
  // Approve while a Save PATCH is still in flight) — a single derived busy
  // flag disables ALL of them together instead of each guarding only its own
  // in-flight state.
  let busy = $derived(isSaving || !!isActionBusy);
  let error = $state('');
  let notice = $state('');
  let showScheduleInput = $state(false);
  let scheduleValue = $state('');

  let loadedItemId = $state<string | null>(null);

  // Re-seed the editable fields whenever a *different* item is opened, but
  // not on every reactive re-run (e.g. after onUpdated() replaces `item`
  // with the server's copy post-save) — otherwise in-progress edits would
  // be wiped out by the save's own response. Clearing loadedItemId when the
  // drawer closes (item becomes null) ensures reopening the SAME item later
  // always reseeds from fresh data instead of resurrecting whatever local
  // edits/errors/schedule-input state were left behind last time it was open.
  $effect(() => {
    if (!item) {
      loadedItemId = null;
      return;
    }
    if (item.id !== loadedItemId) {
      loadedItemId = item.id;
      title = item.title;
      platform = item.platform;
      format = item.format;
      pillar = item.pillar;
      hook = item.hook;
      caption = item.caption;
      cta = item.cta;
      hashtagsText = item.hashtags.join(', ');
      visualSuggestion = item.visual_suggestion;
      expectedEngagement = item.expected_engagement;
      error = '';
      notice = '';
      showScheduleInput = false;
      scheduleValue = item.scheduled_at ? toDatetimeLocal(item.scheduled_at) : defaultScheduleValue();
    }
  });

  function toDatetimeLocal(ts: number) {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function defaultScheduleValue() {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return toDatetimeLocal(d.getTime());
  }

  function assetUrl(current: ContentItem) {
    return current.primary_asset_id ? getMediaAssetContentUrl(current.primary_asset_id) : '';
  }

  async function handleSave() {
    if (!item) return;
    isSaving = true;
    error = '';
    notice = '';
    try {
      const updated = await updateContentItem(item.id, {
        title, platform, format, pillar, hook, caption, cta,
        visual_suggestion: visualSuggestion,
        expected_engagement: expectedEngagement,
        hashtags: hashtagsText.split(',').map((tag) => tag.trim()).filter(Boolean),
      });
      notice = 'บันทึกแล้ว';
      // Await the caller's post-update refresh (works/inbox refetch the list
      // and reselect the item) so `busy` stays true — and the button stays
      // disabled — until that settles, instead of releasing it early and
      // letting a second save/transition race the in-flight refetch.
      await onUpdated(updated);
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isSaving = false;
    }
  }

  async function runTransition(action: Parameters<typeof transitionContentItem>[1]['action'], extra: Record<string, unknown> = {}) {
    if (!item) return;
    isActionBusy = action;
    error = '';
    notice = '';
    try {
      const updated = await transitionContentItem(item.id, { action, ...extra });
      notice = actionNotice(action);
      showScheduleInput = false;
      // See handleSave: await so `busy` covers the parent's refetch too.
      await onUpdated(updated);
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isActionBusy = '';
    }
  }

  function actionNotice(action: string) {
    const map: Record<string, string> = {
      approve: 'อนุมัติแล้ว',
      reject: 'ส่งกลับแก้แล้ว',
      revert_to_draft: 'ดึงกลับเป็น draft แล้ว',
      schedule: 'ตั้งเวลาแล้ว',
      reschedule: 'เปลี่ยนเวลาโพสต์แล้ว',
      unschedule: 'ยกเลิกเวลาที่ตั้งไว้แล้ว',
      manual_publish_ack: 'บันทึกว่าเผยแพร่แล้ว',
      archive: 'Archive แล้ว',
    };
    return map[action] || 'ทำรายการแล้ว';
  }

  function handleReject() {
    // window.prompt returns null only when the user hits Cancel — that must
    // abort the reject, not silently proceed with an empty reason.
    const reason = window.prompt('เหตุผลที่ส่งกลับแก้');
    if (reason === null) return;
    void runTransition('reject', { reason });
  }

  function handleMarkPublished() {
    const manual_publish_url = window.prompt('ใส่ URL โพสต์จริง ถ้ามี');
    if (manual_publish_url === null) return;
    void runTransition('manual_publish_ack', { manual_publish_url });
  }

  function confirmSchedule() {
    if (!item) return;
    const scheduledAt = new Date(scheduleValue).getTime();
    if (!Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) {
      error = 'เวลาที่ตั้งต้องเป็นเวลาในอนาคต';
      return;
    }
    const action = item.status === 'scheduled' ? 'reschedule' : 'schedule';
    void runTransition(action, { scheduled_at: scheduledAt, timezone: 'Asia/Bangkok' });
  }

  async function openStudio() {
    if (!item) return;
    isActionBusy = 'studio';
    error = '';
    try {
      const res = await createContentItemCreativeRequest(item.id);
      localStorage.setItem('creativeStudioDraft', JSON.stringify({
        creative_request_id: res.creative_request_id,
        prompt: buildStudioPrompt(item),
        options: { aspect_ratio: suggestedAspectRatio(item), response_format: 'url', num_images: 1 },
        references: [],
      }));
      goto('/studio');
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isActionBusy = '';
    }
  }

  function buildStudioPrompt(current: ContentItem) {
    return [
      `สร้าง creative สำหรับ ${current.platform || 'social media'} format ${current.format || 'post'}`,
      current.visual_suggestion,
      current.hook ? `Main hook: ${current.hook}` : '',
      current.caption ? `Caption context: ${current.caption}` : '',
      current.cta ? `CTA: ${current.cta}` : '',
    ].filter(Boolean).join('\n');
  }

  function suggestedAspectRatio(current: ContentItem) {
    if (current.format.includes('story') || current.format.includes('reel') || current.format.includes('short')) return '9:16';
    if (current.platform.includes('youtube')) return '16:9';
    return '1:1';
  }

  function humanizeError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err || '');
    const map: Record<string, string> = {
      approval_required: 'ต้องอนุมัติก่อนตั้งเวลา/เผยแพร่',
      invalid_schedule_time: 'เวลาที่ตั้งต้องเป็นเวลาในอนาคต',
      invalid_transition: 'ทำรายการนี้ไม่ได้จากสถานะปัจจุบัน',
      no_editable_fields: 'ไม่มีข้อมูลที่แก้ไข',
    };
    return map[message] || message || 'ทำรายการไม่สำเร็จ';
  }
</script>

{#if item}
  <!--
    Full-screen editor (not a side drawer) — there is no visible backdrop to
    click through, so closing goes only through the header's × button.
    Guarded by `busy`: closing mid-save/mid-transition doesn't cancel the
    in-flight request, and onUpdated(...) unconditionally re-sets the
    parent's selectedItem when it resolves — so closing while busy would
    make the editor visibly pop back open once the request finishes.
    Blocking the close until the request settles avoids that.
  -->
  <div class="fixed inset-0 z-40 flex flex-col bg-white dark:bg-dark-900">
    <div class="flex shrink-0 items-center justify-between gap-3 border-b border-dark-100 dark:border-dark-700 px-6 py-4">
      <div class="min-w-0">
        <span class="rounded-full bg-dark-100 dark:bg-dark-700 px-2 py-0.5 text-xs font-semibold text-dark-900 dark:text-dark-50">{item.status}</span>
        <h2 class="mt-1 truncate text-xl font-bold text-dark-900 dark:text-dark-50">{item.title || 'Content item'}</h2>
      </div>
      <button type="button" onclick={() => { if (!busy) onClose(); }} disabled={busy} class="shrink-0 text-3xl leading-none text-dark-900/50 dark:text-dark-100/50 hover:text-dark-900 dark:hover:text-dark-50 disabled:opacity-30">&times;</button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto max-w-5xl space-y-5 p-6">
        {#if error}
          <div class="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>
        {/if}
        {#if notice}
          <div class="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 p-3 text-sm text-green-700 dark:text-green-300">{notice}</div>
        {/if}

        <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div class="space-y-3">
            {#if assetUrl(item)}
              <img src={assetUrl(item)} alt={item.title} class="w-full aspect-video rounded-lg object-cover bg-dark-100 dark:bg-dark-700" />
            {:else}
              <div class="flex aspect-video w-full items-center justify-center rounded-lg bg-dark-50 dark:bg-dark-800 text-sm text-dark-900/40 dark:text-dark-100/40">
                ยังไม่มี creative
              </div>
            {/if}
            <button type="button" onclick={openStudio} disabled={busy} class="btn-secondary w-full">
              {isActionBusy === 'studio' ? 'กำลังเปิด...' : item.primary_asset_id ? '🎨 เปลี่ยน Creative' : '🎨 สร้าง Creative'}
            </button>
          </div>

          <div class="space-y-5">
            <div class="space-y-3">
              <div>
                <label class="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-200" for="title">หัวข้อ</label>
                <input id="title" bind:value={title} class="input" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-200" for="platform">Platform</label>
                  <input id="platform" bind:value={platform} class="input" />
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-200" for="format">Format</label>
                  <input id="format" bind:value={format} class="input" />
                </div>
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-200" for="pillar">Pillar</label>
                <input id="pillar" bind:value={pillar} class="input" />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-200" for="hook">Hook</label>
                <textarea id="hook" bind:value={hook} rows="2" class="input"></textarea>
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-200" for="caption">Caption</label>
                <textarea id="caption" bind:value={caption} rows="4" class="input"></textarea>
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-200" for="cta">CTA</label>
                <input id="cta" bind:value={cta} class="input" />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-200" for="hashtags">Hashtags (คั่นด้วยจุลภาค)</label>
                <input id="hashtags" bind:value={hashtagsText} class="input" placeholder="#promo, #newlaunch" />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-200" for="visual">Visual suggestion</label>
                <textarea id="visual" bind:value={visualSuggestion} rows="2" class="input"></textarea>
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-200" for="engagement">Expected engagement</label>
                <input id="engagement" bind:value={expectedEngagement} class="input" />
              </div>
            </div>

            <button type="button" onclick={handleSave} disabled={busy} class="btn-primary w-full">
              {isSaving ? 'กำลังบันทึก...' : '💾 บันทึกเนื้อหา'}
            </button>

            <div class="border-t border-dark-100 dark:border-dark-700 pt-4">
              <div class="mb-2 text-sm font-semibold text-dark-900 dark:text-dark-50">สถานะ</div>
              <div class="flex flex-wrap gap-2">
                {#if ['draft', 'pending_review', 'rejected'].includes(item.status)}
                  <button type="button" onclick={() => runTransition('approve')} disabled={busy} class="btn-primary">
                    {isActionBusy === 'approve' ? '...' : 'Approve'}
                  </button>
                {/if}
                {#if ['pending_review', 'approved'].includes(item.status)}
                  <button type="button" onclick={handleReject} disabled={busy} class="btn-ghost">Reject</button>
                {/if}
                {#if item.status === 'approved'}
                  <button type="button" onclick={() => (showScheduleInput = !showScheduleInput)} disabled={busy} class="btn-secondary">Schedule</button>
                  <button type="button" onclick={handleMarkPublished} disabled={busy} class="btn-secondary">Mark Published</button>
                {/if}
                {#if item.status === 'scheduled'}
                  <button type="button" onclick={() => (showScheduleInput = !showScheduleInput)} disabled={busy} class="btn-secondary">เปลี่ยนวัน</button>
                  <button type="button" onclick={() => runTransition('unschedule')} disabled={busy} class="btn-ghost">Unschedule</button>
                  <button type="button" onclick={handleMarkPublished} disabled={busy} class="btn-secondary">Mark Published</button>
                {/if}
                {#if ['pending_review', 'approved', 'scheduled', 'rejected'].includes(item.status)}
                  <button type="button" onclick={() => runTransition('revert_to_draft')} disabled={busy} class="btn-ghost">↩ ดึงกลับเป็น Draft</button>
                {/if}
                {#if !['published', 'archived'].includes(item.status)}
                  <button type="button" onclick={() => runTransition('archive')} disabled={busy} class="btn-ghost">Archive</button>
                {/if}
              </div>

              {#if showScheduleInput}
                <div class="mt-3 flex items-end gap-2 rounded-lg border border-dark-100 dark:border-dark-700 p-3">
                  <div class="flex-1">
                    <label class="mb-1 block text-xs font-medium text-dark-700 dark:text-dark-200" for="schedule-at">วันเวลาโพสต์</label>
                    <input id="schedule-at" type="datetime-local" bind:value={scheduleValue} class="input" />
                  </div>
                  <button type="button" onclick={confirmSchedule} disabled={busy} class="btn-primary">ยืนยัน</button>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
