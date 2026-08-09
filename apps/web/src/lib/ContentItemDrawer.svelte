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
    regenerateContentItemField,
    transitionContentItem,
    updateContentItem,
    type ContentItem,
    type RegenerableContentField,
  } from '$lib/api';
  import { buildStudioPrompt, suggestedAspectRatio } from '$lib/studioHandoff';

  // Canonical values the content generators (Content Series, Presentation
  // Builder step 5) actually produce — see apps/api/src/lib/prompts.ts and
  // lib/creative/contentSeries.ts. Kept in sync manually since they're plain
  // string columns server-side, not an enum the backend validates.
  const PLATFORM_OPTIONS = [
    { value: 'facebook', label: 'Facebook' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'line', label: 'LINE' },
  ];
  const FORMAT_OPTIONS = [
    { value: 'post', label: 'โพสต์' },
    { value: 'image', label: 'รูปภาพ' },
    { value: 'carousel', label: 'การ์ดเลื่อน' },
    { value: 'reel', label: 'รีล' },
    { value: 'story', label: 'สตอรี่' },
  ];
  const PILLAR_OPTIONS = [
    { value: 'awareness', label: 'ให้คนรู้จักร้าน' },
    { value: 'education', label: 'ให้ความรู้' },
    { value: 'social_proof', label: 'รีวิวจากลูกค้าจริง' },
    { value: 'conversion', label: 'ปิดการขาย' },
  ];

  // Content Playbook ขั้นที่ 6 — "✨ บอกทิศ": a small enumerated set of tone
  // + emotion chips, not the playbook's original "8 มิติเต็ม" (deliberately
  // cut per the plan's own choice-paralysis concern). Emotion chips are the
  // plan's literal 5 ("กลัวพลาด/คุ้ม/ไม่ตกขบวน/สะดวก/คนพิเศษ"); tone chips
  // are this implementation's pick of 5 common Thai SME registers — the plan
  // only specifies a count (4-6), not which ones.
  const TONE_CHIPS = ['ขี้เล่น', 'จริงจัง', 'อบอุ่น', 'กระตุ้น', 'เป็นทางการ'];
  const EMOTION_CHIPS = ['กลัวพลาด', 'คุ้ม', 'ไม่ตกขบวน', 'สะดวก', 'คนพิเศษ'];
  let selectedTone = $state('');
  let selectedEmotion = $state('');
  let direction = $derived(
    [selectedTone && `โทน: ${selectedTone}`, selectedEmotion && `อารมณ์: ${selectedEmotion}`].filter(Boolean).join(', '),
  );

  // Stage E2 — "เห็นโพสต์เสร็จ → จิ้มส่วนที่อยากแก้": each content field
  // renders as read-only preview text by default (looks like the finished
  // post) and switches to its existing edit control only once tapped, tracked
  // per-field so multiple can be open at once.
  let fieldEditing = $state<Record<string, boolean>>({});
  function toggleEdit(field: string) {
    fieldEditing[field] = !fieldEditing[field];
  }

  // Status shown as a plain-Thai badge — same value set used across
  // /works, /calendar, /inbox; only the on-screen label changes here.
  const STATUS_LABELS: Record<string, string> = {
    draft: 'ฉบับร่าง',
    pending_review: 'รอรีวิว',
    approved: 'อนุมัติแล้ว',
    scheduled: 'ตั้งเวลาไว้',
    published: 'เผยแพร่แล้ว',
    rejected: 'ส่งกลับแก้',
    archived: 'เก็บเข้าคลัง',
  };
  function statusLabel(status: string) {
    return STATUS_LABELS[status] || status;
  }

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
  let regeneratingField = $state<RegenerableContentField | ''>('');
  // Save, every status transition/studio action, and field regeneration all
  // mutate the same content item's editable state, so none of them may fire
  // concurrently (e.g. clicking Approve while a Save PATCH — or an AI
  // regenerate — is still in flight) — a single derived busy flag disables
  // ALL of them together instead of each guarding only its own in-flight state.
  let busy = $derived(isSaving || !!isActionBusy || !!regeneratingField);
  let error = $state('');
  let notice = $state('');
  let showScheduleInput = $state(false);
  let scheduleValue = $state('');

  // A select bound to a value outside its own <option> list silently falls
  // back to the first option while the underlying state keeps the real
  // (off-list) value — the UI would show one platform while `platform`
  // actually holds another, and saving would look like a no-op edit that
  // secretly changed nothing. Content items created before these dropdowns
  // existed (or from a hand-edited value) can genuinely hold a value outside
  // PLATFORM/FORMAT/PILLAR_OPTIONS, so each list appends the current value
  // as an extra option rather than risk that silent mismatch.
  let platformOptions = $derived(
    !platform || PLATFORM_OPTIONS.some((o) => o.value === platform) ? PLATFORM_OPTIONS : [...PLATFORM_OPTIONS, { value: platform, label: platform }],
  );
  let formatOptions = $derived(
    !format || FORMAT_OPTIONS.some((o) => o.value === format) ? FORMAT_OPTIONS : [...FORMAT_OPTIONS, { value: format, label: format }],
  );
  let pillarOptions = $derived(
    !pillar || PILLAR_OPTIONS.some((o) => o.value === pillar) ? PILLAR_OPTIONS : [...PILLAR_OPTIONS, { value: pillar, label: pillar }],
  );

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
      fieldEditing = {};
      selectedTone = '';
      selectedEmotion = '';
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

  async function regenerateField(field: RegenerableContentField) {
    if (!item || busy) return;
    regeneratingField = field;
    error = '';
    try {
      const result = await regenerateContentItemField(item.id, {
        field,
        // Send the CURRENT (possibly unsaved) draft, not item.* — so
        // regenerating Caption after just editing Hook (without saving
        // first) stays consistent with what's on screen right now.
        context: {
          title, platform, format, pillar, hook, caption, cta, visual_suggestion: visualSuggestion,
          hashtags: hashtagsText.split(',').map((t) => t.trim()).filter(Boolean),
        },
        // ✨ บอกทิศ — only meaningful for the two free-prose voice fields;
        // sending it for hashtags/visual_suggestion/sales_closer would just
        // be ignored server-side rules text, so keep it scoped to where the
        // chip picker actually shows (see the template below).
        direction: (field === 'hook' || field === 'caption') && direction ? direction : undefined,
      });
      if (field === 'hashtags') {
        hashtagsText = (Array.isArray(result.value) ? result.value : []).join(', ');
      } else if (field === 'hook') {
        hook = String(result.value);
      } else if (field === 'caption') {
        caption = String(result.value);
      } else if (field === 'cta') {
        cta = String(result.value);
      } else if (field === 'visual_suggestion') {
        visualSuggestion = String(result.value);
      } else if (field === 'sales_closer') {
        // Appends to the existing caption rather than replacing it — this
        // button adds a closing paragraph to a post that's already written,
        // it doesn't rewrite the post (see contentRoutes.ts's
        // buildSalesCloserPrompt doc comment).
        caption = `${caption}\n\n${result.value}`;
      }
      notice = field === 'sales_closer'
        ? 'เพิ่มย่อหน้าปิดท้ายแล้ว — ตรวจแล้วกด บันทึกเนื้อหา เพื่อเก็บไว้'
        : 'AI เขียนให้ใหม่แล้ว — ตรวจแล้วกด บันทึกเนื้อหา เพื่อเก็บไว้';
    } catch (err) {
      error = humanizeError(err);
    } finally {
      regeneratingField = '';
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
      revert_to_draft: 'ดึงกลับเป็นฉบับร่างแล้ว',
      schedule: 'ตั้งเวลาแล้ว',
      reschedule: 'เปลี่ยนเวลาโพสต์แล้ว',
      unschedule: 'ยกเลิกเวลาที่ตั้งไว้แล้ว',
      manual_publish_ack: 'บันทึกว่าเผยแพร่แล้ว',
      archive: 'เก็บเข้าคลังแล้ว',
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
      // Use the drawer's live `visualSuggestion` field, not `item.visual_suggestion` —
      // otherwise editing the Visual suggestion textarea and clicking สร้าง Creative
      // without saving first would silently send the stale, pre-edit description.
      localStorage.setItem('creativeStudioDraft', JSON.stringify({
        creative_request_id: res.creative_request_id,
        prompt: buildStudioPrompt({ ...item, visual_suggestion: visualSuggestion }),
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
        <span class="rounded-full bg-dark-100 dark:bg-dark-700 px-2 py-0.5 text-xs font-semibold text-dark-900 dark:text-dark-50">{statusLabel(item.status)}</span>
        <h2 class="mt-1 truncate text-xl font-bold text-dark-900 dark:text-dark-50">{item.title || 'รายการคอนเทนต์'}</h2>
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
                ยังไม่มีภาพประกอบ
              </div>
            {/if}
            <button type="button" onclick={openStudio} disabled={busy} class="btn-secondary w-full">
              {isActionBusy === 'studio' ? 'กำลังเปิด...' : item.primary_asset_id ? '🎨 เปลี่ยนงานภาพ' : '🎨 สร้างงานภาพ'}
            </button>
            <!-- Art-direction text for the image generator, not part of the
                 post a viewer reads — kept beside the image, not in the
                 post-preview flow below. -->
            <div class="rounded-lg border border-dark-100 dark:border-dark-700 p-3">
              {#if fieldEditing.visual_suggestion}
                <div class="mb-1 flex items-center justify-between gap-2">
                  <label class="text-xs font-medium text-dark-700 dark:text-dark-200" for="visual">รายละเอียดภาพ</label>
                  <div class="flex shrink-0 items-center gap-2">
                    <button type="button" onclick={() => regenerateField('visual_suggestion')} disabled={busy} class="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 disabled:opacity-40">
                      {regeneratingField === 'visual_suggestion' ? '✨ กำลังคิด...' : '✨ AI ช่วยเขียน'}
                    </button>
                    <button type="button" onclick={() => toggleEdit('visual_suggestion')} class="text-xs font-semibold text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200">เสร็จแล้ว</button>
                  </div>
                </div>
                <textarea id="visual" bind:value={visualSuggestion} rows="3" class="input"></textarea>
              {:else}
                <button type="button" onclick={() => toggleEdit('visual_suggestion')} aria-label={`แตะเพื่อแก้ไขรายละเอียดภาพ: ${visualSuggestion || 'ยังไม่มีข้อความ'}`} class="block w-full rounded-lg p-1 -m-1 text-left transition-colors hover:bg-dark-50 dark:hover:bg-dark-800">
                  <div class="text-xs font-medium text-dark-500 dark:text-dark-400 mb-0.5">รายละเอียดภาพ</div>
                  <p class="text-sm text-dark-700 dark:text-dark-200">{visualSuggestion || 'แตะเพื่อเขียนรายละเอียดภาพ'}</p>
                </button>
              {/if}
            </div>
          </div>

          <div class="space-y-5">
            <div class="space-y-3 rounded-xl border border-dark-100 dark:border-dark-700 p-4">
              <div class="text-xs font-semibold uppercase tracking-wide text-dark-900/50 dark:text-dark-100/50">รายละเอียดโพสต์</div>
              <div>
                <label class="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-200" for="title">หัวข้อ</label>
                <input id="title" bind:value={title} class="input" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-200" for="platform">แพลตฟอร์ม</label>
                  <select id="platform" bind:value={platform} class="input">
                    {#each platformOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}
                  </select>
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-200" for="format">รูปแบบโพสต์</label>
                  <select id="format" bind:value={format} class="input">
                    {#each formatOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}
                  </select>
                </div>
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-200" for="pillar">จุดประสงค์ของโพสต์</label>
                <select id="pillar" bind:value={pillar} class="input">
                  {#each pillarOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}
                </select>
              </div>
            </div>

            {#snippet directionChips()}
              <div class="mb-2 flex flex-wrap gap-1.5">
                {#each TONE_CHIPS as chip}
                  <button type="button" onclick={() => (selectedTone = selectedTone === chip ? '' : chip)} class="rounded-full px-2.5 py-1 text-xs font-semibold {selectedTone === chip ? 'bg-primary-600 text-white' : 'bg-dark-50 text-dark-900/70 hover:bg-dark-100 dark:bg-dark-900 dark:text-dark-100/70'}">
                    {chip}
                  </button>
                {/each}
                {#each EMOTION_CHIPS as chip}
                  <button type="button" onclick={() => (selectedEmotion = selectedEmotion === chip ? '' : chip)} class="rounded-full px-2.5 py-1 text-xs font-semibold {selectedEmotion === chip ? 'bg-primary-600 text-white' : 'bg-dark-50 text-dark-900/70 hover:bg-dark-100 dark:bg-dark-900 dark:text-dark-100/70'}">
                    {chip}
                  </button>
                {/each}
              </div>
            {/snippet}

            <!--
              Stage E2 — "เห็นโพสต์เสร็จ → จิ้มส่วนที่อยากแก้": rendered to
              read like the actual finished post (hook as a bold opening
              line, caption below it, cta and hashtags styled the way they'd
              actually appear), not a stack of labeled form fields. Each
              block is a tap target that reveals its existing edit control
              (textarea + ✨ regenerate + ✨ บอกทิศ chips) in place — nothing
              about the regenerate/save/credit mechanics changed, only when
              the raw textarea is visible.
            -->
            <div class="space-y-1 rounded-xl border border-dark-100 dark:border-dark-700 p-4">
              <div class="text-xs font-semibold uppercase tracking-wide text-dark-900/50 dark:text-dark-100/50 mb-2">โพสต์</div>

              {#if fieldEditing.hook}
                <div class="mb-1 flex items-center justify-between gap-2">
                  <label class="text-sm font-medium text-dark-700 dark:text-dark-200" for="hook">ประโยคเปิด</label>
                  <div class="flex shrink-0 items-center gap-2">
                    <button type="button" onclick={() => regenerateField('hook')} disabled={busy} class="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 disabled:opacity-40">
                      {regeneratingField === 'hook' ? '✨ กำลังคิด...' : '✨ AI ช่วยเขียน'}
                    </button>
                    <button type="button" onclick={() => toggleEdit('hook')} class="text-xs font-semibold text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200">เสร็จแล้ว</button>
                  </div>
                </div>
                {@render directionChips()}
                <textarea id="hook" bind:value={hook} rows="2" class="input"></textarea>
              {:else}
                <button type="button" onclick={() => toggleEdit('hook')} aria-label={`แตะเพื่อแก้ไขประโยคเปิด: ${hook || 'ยังไม่มีข้อความ'}`} class="block w-full rounded-lg p-2 -m-2 text-left transition-colors hover:bg-dark-50 dark:hover:bg-dark-800">
                  <p class="t-heading font-bold text-dark-900 dark:text-dark-50">{hook || 'แตะเพื่อเขียนประโยคเปิด'}</p>
                </button>
              {/if}

              {#if fieldEditing.caption}
                <div class="mb-1 mt-3 flex items-center justify-between gap-2">
                  <label class="text-sm font-medium text-dark-700 dark:text-dark-200" for="caption">เนื้อหาโพสต์</label>
                  <div class="flex shrink-0 items-center gap-2">
                    <button type="button" onclick={() => regenerateField('caption')} disabled={busy} class="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 disabled:opacity-40">
                      {regeneratingField === 'caption' ? '✨ กำลังคิด...' : '✨ AI ช่วยเขียน'}
                    </button>
                    <button type="button" onclick={() => toggleEdit('caption')} class="text-xs font-semibold text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200">เสร็จแล้ว</button>
                  </div>
                </div>
                {@render directionChips()}
                <textarea id="caption" bind:value={caption} rows="6" class="input"></textarea>
                <button type="button" onclick={() => regenerateField('sales_closer')} disabled={busy || !caption.trim()} class="mt-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 disabled:opacity-40">
                  {regeneratingField === 'sales_closer' ? '✨ กำลังคิด...' : '✨ ปิดจบแบบขายเนียน ๆ'}
                </button>
              {:else}
                <button type="button" onclick={() => toggleEdit('caption')} aria-label={`แตะเพื่อแก้ไขเนื้อหาโพสต์: ${caption || 'ยังไม่มีข้อความ'}`} class="mt-2 block w-full rounded-lg p-2 -m-2 text-left transition-colors hover:bg-dark-50 dark:hover:bg-dark-800">
                  <p class="t-body whitespace-pre-line text-dark-900 dark:text-dark-50">{caption || 'แตะเพื่อเขียนเนื้อหาโพสต์'}</p>
                </button>
              {/if}

              {#if fieldEditing.cta}
                <div class="mb-1 mt-3 flex items-center justify-between gap-2">
                  <label class="text-sm font-medium text-dark-700 dark:text-dark-200" for="cta">ชวนลูกค้าทำอะไรต่อ</label>
                  <div class="flex shrink-0 items-center gap-2">
                    <button type="button" onclick={() => regenerateField('cta')} disabled={busy} class="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 disabled:opacity-40">
                      {regeneratingField === 'cta' ? '✨ กำลังคิด...' : '✨ AI ช่วยเขียน'}
                    </button>
                    <button type="button" onclick={() => toggleEdit('cta')} class="text-xs font-semibold text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200">เสร็จแล้ว</button>
                  </div>
                </div>
                <input id="cta" bind:value={cta} class="input" />
              {:else}
                <button type="button" onclick={() => toggleEdit('cta')} aria-label={`แตะเพื่อแก้ไขคำชวนลูกค้าทำอะไรต่อ: ${cta || 'ยังไม่มีข้อความ'}`} class="mt-2 block w-full rounded-lg p-2 -m-2 text-left transition-colors hover:bg-dark-50 dark:hover:bg-dark-800">
                  <p class="t-body font-semibold text-primary-600 dark:text-primary-400">{cta || 'แตะเพื่อเขียนคำชวน'}</p>
                </button>
              {/if}

              {#if fieldEditing.hashtags}
                <div class="mb-1 mt-3 flex items-center justify-between gap-2">
                  <label class="text-sm font-medium text-dark-700 dark:text-dark-200" for="hashtags">แฮชแท็ก (คั่นด้วยจุลภาค)</label>
                  <div class="flex shrink-0 items-center gap-2">
                    <button type="button" onclick={() => regenerateField('hashtags')} disabled={busy} class="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 disabled:opacity-40">
                      {regeneratingField === 'hashtags' ? '✨ กำลังคิด...' : '✨ AI ช่วยเขียน'}
                    </button>
                    <button type="button" onclick={() => toggleEdit('hashtags')} class="text-xs font-semibold text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200">เสร็จแล้ว</button>
                  </div>
                </div>
                <input id="hashtags" bind:value={hashtagsText} class="input" placeholder="#promo, #newlaunch" />
              {:else}
                <button type="button" onclick={() => toggleEdit('hashtags')} aria-label={`แตะเพื่อแก้ไขแฮชแท็ก: ${hashtagsText || 'ยังไม่มีข้อความ'}`} class="mt-2 block w-full rounded-lg p-2 -m-2 text-left transition-colors hover:bg-dark-50 dark:hover:bg-dark-800">
                  <p class="t-caption text-primary-500 dark:text-primary-400">{hashtagsText || 'แตะเพื่อเพิ่มแฮชแท็ก'}</p>
                </button>
              {/if}

              <div class="mt-3 border-t border-dark-100 dark:border-dark-700 pt-3">
                <label class="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-200" for="engagement">ผลตอบรับที่คาดว่าจะได้</label>
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
                    {isActionBusy === 'approve' ? '...' : 'อนุมัติ'}
                  </button>
                {/if}
                {#if ['pending_review', 'approved'].includes(item.status)}
                  <button type="button" onclick={handleReject} disabled={busy} class="btn-ghost">ส่งกลับแก้</button>
                {/if}
                {#if item.status === 'approved'}
                  <button type="button" onclick={() => (showScheduleInput = !showScheduleInput)} disabled={busy} class="btn-secondary">ตั้งเวลาโพสต์</button>
                  <button type="button" onclick={handleMarkPublished} disabled={busy} class="btn-secondary">บันทึกว่าโพสต์แล้ว</button>
                {/if}
                {#if item.status === 'scheduled'}
                  <button type="button" onclick={() => (showScheduleInput = !showScheduleInput)} disabled={busy} class="btn-secondary">เปลี่ยนวัน</button>
                  <button type="button" onclick={() => runTransition('unschedule')} disabled={busy} class="btn-ghost">ยกเลิกเวลาที่ตั้งไว้</button>
                  <button type="button" onclick={handleMarkPublished} disabled={busy} class="btn-secondary">บันทึกว่าโพสต์แล้ว</button>
                {/if}
                {#if ['pending_review', 'approved', 'scheduled', 'rejected'].includes(item.status)}
                  <button type="button" onclick={() => runTransition('revert_to_draft')} disabled={busy} class="btn-ghost">↩ ดึงกลับเป็นฉบับร่าง</button>
                {/if}
                {#if !['published', 'archived'].includes(item.status)}
                  <button type="button" onclick={() => runTransition('archive')} disabled={busy} class="btn-ghost">เก็บเข้าคลัง</button>
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
