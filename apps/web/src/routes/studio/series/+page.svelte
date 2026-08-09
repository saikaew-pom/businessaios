<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import {
    createContentSeriesTemplate,
    deleteContentSeriesTemplate,
    generateContentSeries,
    listBrandProfiles,
    listProjects,
    listContentSeries,
    listContentSeriesTemplates,
    listContentThemes,
    suggestContentThemes,
    confirmContentThemes,
    listContentTopics,
    suggestContentTopics,
    type BrandProfile,
    type ContentItem,
    type Project,
    type ContentSeries,
    type ContentSeriesTemplate,
    type ContentTheme,
    type ContentTopic,
  } from '$lib/api';
  import { initAuth, isAuthed, fullUser } from '$lib/auth';
  import { fetchConfig } from '$lib/config';
  import { Chip, TapCard, Button } from '$lib/ui';
  import { contentTypeLabel, contentTypeChipTone, seasonalEventLabel } from '$lib/contentTaxonomy';

  const PLATFORM_OPTIONS = ['facebook', 'instagram', 'line', 'tiktok'];
  const CADENCE_OPTIONS = [
    { value: 1, label: 'ทุกวัน' },
    { value: 2, label: 'ทุก 2 วัน' },
    { value: 3.5, label: 'สัปดาห์ละ 2 ครั้ง' },
    { value: 7, label: 'ทุกสัปดาห์' },
  ];

  let isLoading = true;
  let isFeatureEnabled = false;
  let isAdmin = false;
  let error = '';
  let notice = '';

  let templates: ContentSeriesTemplate[] = [];
  let brandProfiles: BrandProfile[] = [];
  let history: ContentSeries[] = [];

  // Generate form state
  let topic = '';
  let requestedCount = 7;
  let cadenceDays = 1;
  let templateId = '';
  let brandProfileId = '';
  let projectId = '';
  let projects: Project[] = [];
  let platforms: string[] = ['facebook', 'line', 'tiktok'];
  let isGenerating = false;
  let lastResult: { series: ContentSeries; items: ContentItem[] } | null = null;

  // Content Playbook Upgrade Plan ขั้นที่ 2 — Topic Picker. "พิมพ์เอง" is the
  // fallback now, not the default (per the plan's own wording) — 'pick' is
  // the initial mode, 'manual' reveals the classic free-text textarea.
  let topicMode: 'pick' | 'manual' = 'pick';
  let selectedTopicId = '';
  let themes: ContentTheme[] = [];
  let themesLoading = false;
  let suggestingThemes = false;
  let selectedThemeId = '';
  let pendingThemeIds: string[] = []; // freshly-suggested, not yet confirmed
  let checkedThemeIds: Record<string, boolean> = {};
  let themeRenames: Record<string, string> = {};
  let confirmingThemes = false;
  let topics: ContentTopic[] = [];
  let topicsLoading = false;
  let suggestingTopics = false;
  let pickerError = '';
  let lastLoadedBrandProfileId = '';

  // Runs whenever brandProfileId changes (including its initial default from
  // loadBrandProfiles()) — themes are scoped per brand profile, so switching
  // profiles must reset the whole picker rather than show stale themes/topics.
  $: if (brandProfileId && brandProfileId !== lastLoadedBrandProfileId) {
    lastLoadedBrandProfileId = brandProfileId;
    selectedThemeId = '';
    selectedTopicId = '';
    topics = [];
    pendingThemeIds = [];
    loadThemes();
  }

  async function loadThemes() {
    if (!brandProfileId) return;
    themesLoading = true;
    pickerError = '';
    try {
      const res = await listContentThemes(brandProfileId);
      themes = res.themes;
    } catch (err) {
      pickerError = humanizeError(err);
    } finally {
      themesLoading = false;
    }
  }

  async function requestThemeSuggestions() {
    if (!brandProfileId || suggestingThemes) return;
    suggestingThemes = true;
    pickerError = '';
    try {
      const res = await suggestContentThemes(brandProfileId);
      // Suggest replaces the prior unconfirmed batch server-side — mirror
      // that here by dropping any 'suggested' themes we already had and
      // showing only the fresh batch for confirmation.
      themes = [...themes.filter((t) => t.status === 'confirmed'), ...res.themes];
      pendingThemeIds = res.themes.map((t) => t.id);
      checkedThemeIds = Object.fromEntries(res.themes.map((t) => [t.id, true]));
      themeRenames = {};
    } catch (err) {
      pickerError = humanizeError(err);
    } finally {
      suggestingThemes = false;
    }
  }

  async function confirmSelectedThemes() {
    const ids = pendingThemeIds.filter((id) => checkedThemeIds[id]);
    if (!ids.length || confirmingThemes) return;
    confirmingThemes = true;
    pickerError = '';
    try {
      await confirmContentThemes(ids, themeRenames);
      pendingThemeIds = [];
      checkedThemeIds = {};
      themeRenames = {};
      await loadThemes();
    } catch (err) {
      pickerError = humanizeError(err);
    } finally {
      confirmingThemes = false;
    }
  }

  async function selectTheme(themeId: string) {
    selectedThemeId = themeId;
    selectedTopicId = '';
    topics = [];
    topicsLoading = true;
    pickerError = '';
    try {
      const res = await listContentTopics(themeId);
      topics = res.topics;
    } catch (err) {
      pickerError = humanizeError(err);
    } finally {
      topicsLoading = false;
    }
  }

  async function requestTopicSuggestions() {
    if (!selectedThemeId || suggestingTopics) return;
    suggestingTopics = true;
    pickerError = '';
    try {
      const res = await suggestContentTopics(selectedThemeId);
      // Additive, not a replacement — unlike themes, topic history is meant
      // to accumulate (that's what de-dup is checked against server-side).
      topics = [...topics, ...res.topics];
    } catch (err) {
      pickerError = humanizeError(err);
    } finally {
      suggestingTopics = false;
    }
  }

  function pickTopic(t: ContentTopic) {
    topic = t.title;
    selectedTopicId = t.id;
  }

  // Template creation form state
  let showTemplateForm = false;
  let templateName = '';
  let templateDescription = '';
  let templateIsGlobal = false;
  let templatePlatforms: string[] = ['facebook', 'line', 'tiktok'];
  let templateSlots: Array<{ pillar: string; hook_style: string; cta_style: string }> = [
    { pillar: 'awareness', hook_style: '', cta_style: '' },
  ];
  let isSavingTemplate = false;

  onMount(async () => {
    await initAuth();
    if (!$isAuthed) {
      goto('/login');
      return;
    }
    try {
      const config = await fetchConfig();
      isFeatureEnabled = Boolean(config.features.content_series);
      isAdmin = $fullUser?.role === 'admin';
      if (!isFeatureEnabled) return;
      await Promise.all([loadTemplates(), loadBrandProfiles(), loadProjects(), loadHistory()]);
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isLoading = false;
    }
  });

  async function loadTemplates() {
    templates = await listContentSeriesTemplates();
  }

  async function loadBrandProfiles() {
    const res = await listBrandProfiles();
    brandProfiles = res.profiles;
    if (!brandProfileId && res.active_profile) brandProfileId = res.active_profile.id;
  }

  async function loadProjects() {
    // Archived projects are excluded on purpose — you shouldn't be able to
    // file brand-new content into a project that's been put away.
    projects = (await listProjects()).filter((p) => p.status !== 'archived');
  }

  async function loadHistory() {
    history = await listContentSeries();
  }

  function togglePlatform(list: string[], platform: string): string[] {
    return list.includes(platform) ? list.filter((p) => p !== platform) : [...list, platform];
  }

  async function generate(e: Event) {
    e.preventDefault();
    if (!topic.trim() || isGenerating) return;
    isGenerating = true;
    error = '';
    notice = '';
    lastResult = null;
    try {
      const result = await generateContentSeries({
        topic: topic.trim(),
        requested_count: requestedCount,
        cadence_days: cadenceDays,
        template_id: templateId || null,
        brand_profile_id: brandProfileId || null,
        project_id: projectId || null,
        platforms,
        topic_id: topicMode === 'pick' ? (selectedTopicId || null) : null,
      });
      lastResult = result;
      notice = result.series.status === 'partial'
        ? `AI สร้างได้แค่ ${result.items.length}/${result.series.requested_count} ชิ้น (ใช้ ${result.series.credits_used} เครดิต) — ลองสร้างเพิ่มอีกรอบถ้าต้องการครบจำนวน`
        : `สร้าง content ${result.items.length} ชิ้นสำเร็จ (ใช้ ${result.series.credits_used} เครดิต)`;
      selectedTopicId = ''; // this generate already linked it server-side; don't relink on a repeat submit
      await loadHistory();
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isGenerating = false;
    }
  }

  function addSlotRow() {
    templateSlots = [...templateSlots, { pillar: 'education', hook_style: '', cta_style: '' }];
  }

  function removeSlotRow(index: number) {
    templateSlots = templateSlots.filter((_, i) => i !== index);
  }

  async function saveTemplate(e: Event) {
    e.preventDefault();
    if (!templateName.trim() || isSavingTemplate) return;
    isSavingTemplate = true;
    error = '';
    try {
      await createContentSeriesTemplate({
        name: templateName.trim(),
        description: templateDescription.trim(),
        slots: templateSlots,
        default_platforms: templatePlatforms,
        owner_type: templateIsGlobal ? 'admin' : 'user',
      });
      notice = 'สร้าง template แล้ว';
      templateName = '';
      templateDescription = '';
      templateIsGlobal = false;
      templateSlots = [{ pillar: 'awareness', hook_style: '', cta_style: '' }];
      showTemplateForm = false;
      await loadTemplates();
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isSavingTemplate = false;
    }
  }

  async function removeTemplate(t: ContentSeriesTemplate) {
    if (!confirm(`ลบ template "${t.name}"?`)) return;
    error = '';
    try {
      await deleteContentSeriesTemplate(t.id);
      notice = 'ลบ template แล้ว';
      if (templateId === t.id) templateId = '';
      await loadTemplates();
    } catch (err) {
      error = humanizeError(err);
    }
  }

  function canEditTemplate(t: ContentSeriesTemplate): boolean {
    if (t.owner_type === 'admin') return isAdmin;
    return true; // only own private templates are ever listed for a non-admin user
  }

  function statusLabel(status: string) {
    return ({
      queued: 'รอคิว',
      generating: 'กำลังสร้าง',
      completed: 'เสร็จแล้ว',
      partial: 'ได้บางส่วน',
      failed: 'ล้มเหลว',
    } as Record<string, string>)[status] || status;
  }

  function statusClass(status: string) {
    if (status === 'completed') return 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300';
    if (status === 'partial') return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
    if (status === 'failed') return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300';
    return 'bg-dark-100 text-dark-900/70 dark:bg-dark-800 dark:text-dark-100/70';
  }

  function formatDate(ts: number | null) {
    if (!ts) return '-';
    return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function humanizeError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err || '');
    const map: Record<string, string> = {
      feature_disabled: 'Content Series Generator ยังไม่เปิดใช้งานบน environment นี้',
      topic_required: 'กรุณาใส่หัวข้อ',
      name_required: 'กรุณาใส่ชื่อ template',
      template_not_found: 'ไม่พบ template ที่เลือก',
      insufficient_credits: 'เครดิตไม่เพียงพอ กรุณาเติมเครดิต',
      forbidden: 'ไม่มีสิทธิ์ทำรายการนี้',
    };
    if (map[message]) return map[message];
    if (message.startsWith('requested_count_must_be_between')) return 'จำนวน content ต้องอยู่ระหว่าง 1-7 ชิ้น';
    if (message.startsWith('cadence_days_must_be')) return 'ความถี่ต้องอยู่ระหว่าง 0-30 วัน';
    return message || 'ทำรายการไม่สำเร็จ';
  }
</script>

<svelte:head>
  <title>Content Series Generator — Business Smart OS</title>
</svelte:head>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950">
  <main class="container-narrow py-6 space-y-5 max-w-5xl">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div class="text-sm text-primary-600 dark:text-primary-400 font-semibold">Creative Studio</div>
        <h1 class="heading-2">Content Series Generator</h1>
        <p class="text-dark-900/60 dark:text-dark-100/60">ใส่หัวข้อเดียว กำหนดจำนวน content ที่ต้องการ ระบบจะสร้างให้ครบเป็นชุด พร้อมวางลง calendar</p>
      </div>
      <a href="/studio" class="btn-secondary">กลับ Studio</a>
    </div>

    {#if error}
      <div class="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>
    {/if}
    {#if notice}
      <div class="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 p-3 text-sm text-green-700 dark:text-green-300">{notice}</div>
    {/if}

    {#if isLoading}
      <div class="py-16 text-center text-dark-900/60 dark:text-dark-100/60">กำลังโหลด...</div>
    {:else if !isFeatureEnabled}
      <div class="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-5">
        <div class="font-semibold text-amber-900 dark:text-amber-200">Content Series Generator ยังปิดอยู่</div>
        <div class="text-sm text-amber-800 dark:text-amber-300 mt-1">เปิด `CONTENT_SERIES_ENABLED=true` บน environment นี้ก่อนจึงจะเริ่มใช้งานได้</div>
      </div>
    {:else}
      <!-- Generate form -->
      <form onsubmit={generate} class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-5 space-y-4">
        <div>
          <h2 class="font-bold text-dark-900 dark:text-dark-50">สร้าง Series ใหม่</h2>
          <p class="mt-1 text-sm text-dark-900/60 dark:text-dark-100/60">1 หัวข้อ → หลาย content มุมต่างกัน ไม่ซ้ำกัน</p>
        </div>

        <!-- Content Playbook ขั้นที่ 2 — Topic Picker. "เลือกจากไอเดีย" is the
             default; "พิมพ์เอง" is a fallback toggle, not the primary path. -->
        <div class="flex gap-2 text-sm font-semibold">
          <button type="button" onclick={() => (topicMode = 'pick')}
            class="px-3 py-1.5 rounded-full {topicMode === 'pick' ? 'bg-primary-600 text-white' : 'bg-dark-50 text-dark-900/70 dark:bg-dark-900 dark:text-dark-100/70'}">
            เลือกจากไอเดีย
          </button>
          <button type="button" onclick={() => { topicMode = 'manual'; selectedTopicId = ''; }}
            class="px-3 py-1.5 rounded-full {topicMode === 'manual' ? 'bg-primary-600 text-white' : 'bg-dark-50 text-dark-900/70 dark:bg-dark-900 dark:text-dark-100/70'}">
            พิมพ์เอง
          </button>
        </div>

        {#if pickerError}
          <div class="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{pickerError}</div>
        {/if}

        {#if topicMode === 'manual'}
          <textarea
            bind:value={topic}
            rows="2"
            class="input w-full"
            placeholder="หัวข้อ เช่น เปิดร้านกาแฟใหม่ย่านทองหล่อ, โปรโมชันลดราคาสิ้นปี"
          ></textarea>
        {:else if !brandProfileId}
          <p class="t-caption text-dark-500 dark:text-dark-400">เลือก Brand Profile ด้านล่างก่อน เพื่อให้ AI ช่วยคิดหัวข้อให้</p>
        {:else}
          <!-- Step 1: theme -->
          {#if themesLoading}
            <p class="t-caption text-dark-500 dark:text-dark-400">กำลังโหลดธีม...</p>
          {:else}
            {#if themes.filter((t) => t.status === 'confirmed').length}
              <div class="space-y-2">
                <span class="t-caption text-dark-600 dark:text-dark-300 block">ธีมเสาหลัก</span>
                {#each themes.filter((t) => t.status === 'confirmed') as t}
                  <TapCard title={t.name} subtitle={t.reason} selected={selectedThemeId === t.id} onclick={() => selectTheme(t.id)} />
                {/each}
              </div>
            {/if}

            {#if pendingThemeIds.length}
              <div class="rounded-xl border border-dark-200 dark:border-dark-700 p-3 space-y-2">
                <span class="t-caption text-dark-600 dark:text-dark-300 block">AI เสนอธีมใหม่ — ติ๊กเลือกที่จะใช้ (แก้ชื่อได้)</span>
                {#each themes.filter((t) => pendingThemeIds.includes(t.id)) as t}
                  <label class="flex items-start gap-2 rounded-lg border border-dark-100 dark:border-dark-700 p-2.5">
                    <input type="checkbox" class="mt-1" checked={checkedThemeIds[t.id] ?? false}
                      onchange={(e) => (checkedThemeIds = { ...checkedThemeIds, [t.id]: (e.target as HTMLInputElement).checked })} />
                    <span class="min-w-0 flex-1">
                      <input type="text" class="input w-full text-sm font-semibold" value={themeRenames[t.id] ?? t.name}
                        oninput={(e) => (themeRenames = { ...themeRenames, [t.id]: (e.target as HTMLInputElement).value })} />
                      <span class="t-caption text-dark-500 dark:text-dark-400 block mt-1">{t.reason}</span>
                    </span>
                  </label>
                {/each}
                <Button disabled={confirmingThemes} onclick={confirmSelectedThemes}>
                  {confirmingThemes ? 'กำลังบันทึก...' : 'ยืนยันธีมที่เลือก'}
                </Button>
              </div>
            {:else}
              <p class="t-caption text-dark-500 dark:text-dark-400 mb-1">ใช้เครดิตไม่เกิน 9 เครดิตต่อครั้ง</p>
              <Button variant="secondary" disabled={suggestingThemes} onclick={requestThemeSuggestions}>
                {suggestingThemes ? 'กำลังคิดธีม...' : themes.length ? '+ คิดธีมใหม่' : '✨ ให้ AI ช่วยคิดธีมให้'}
              </Button>
            {/if}
          {/if}

          <!-- Step 2: topic cards for the selected theme -->
          {#if selectedThemeId}
            {#if topicsLoading}
              <p class="t-caption text-dark-500 dark:text-dark-400">กำลังโหลดหัวข้อ...</p>
            {:else}
              {#if topics.length}
                <div class="space-y-2">
                  <span class="t-caption text-dark-600 dark:text-dark-300 block">แตะเพื่อเลือกหัวข้อ</span>
                  {#each topics as t}
                    <TapCard selected={selectedTopicId === t.id} onclick={() => pickTopic(t)}>
                      <div class="t-body font-semibold">{t.title}</div>
                      <div class="mt-1.5 flex flex-wrap gap-1.5">
                        <Chip tone={contentTypeChipTone(t.content_type)}>{contentTypeLabel(t.content_type)}</Chip>
                        {#if t.seasonal_event}<Chip tone="gold">🎊 {seasonalEventLabel(t.seasonal_event)}</Chip>{/if}
                        {#if t.status === 'used'}<Chip>ใช้แล้ว</Chip>{/if}
                      </div>
                    </TapCard>
                  {/each}
                </div>
              {/if}
              <p class="t-caption text-dark-500 dark:text-dark-400 mb-1">ใช้เครดิตไม่เกิน 26 เครดิตต่อครั้ง</p>
              <Button variant="secondary" disabled={suggestingTopics} onclick={requestTopicSuggestions}>
                {suggestingTopics ? 'กำลังคิดหัวข้อ...' : topics.length ? '+ คิดหัวข้อเพิ่ม' : '✨ ให้ AI ช่วยคิดหัวข้อให้'}
              </Button>
              {#if selectedTopicId}
                <label class="text-sm block">
                  <span class="block mb-1 text-dark-900/70 dark:text-dark-100/70">หัวข้อที่เลือก (แก้ไขได้)</span>
                  <textarea bind:value={topic} rows="2" class="input w-full"></textarea>
                </label>
              {/if}
            {/if}
          {/if}
        {/if}

        <div class="grid md:grid-cols-3 gap-3">
          <label class="text-sm">
            <span class="block mb-1 text-dark-900/70 dark:text-dark-100/70">จำนวน content</span>
            <input type="number" min="1" max="7" bind:value={requestedCount} class="input w-full" />
            <span class="mt-1 block text-xs text-dark-900/50 dark:text-dark-100/50">
              สูงสุด 7 ชิ้นต่อครั้ง — อยากได้มากกว่านี้ให้สร้างซ้ำอีกรอบ ระบบจะดูของเดิมในปฏิทินแล้วเลี่ยงมุมที่เขียนไปแล้วให้เอง
            </span>
          </label>
          <label class="text-sm">
            <span class="block mb-1 text-dark-900/70 dark:text-dark-100/70">ความถี่โพสต์</span>
            <select bind:value={cadenceDays} class="input w-full">
              {#each CADENCE_OPTIONS as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </label>
          <label class="text-sm">
            <span class="block mb-1 text-dark-900/70 dark:text-dark-100/70">Template</span>
            <select bind:value={templateId} class="input w-full">
              <option value="">ไม่ใช้ template (ค่าเริ่มต้น)</option>
              {#each templates as t}
                <option value={t.id}>{t.owner_type === 'admin' ? '🌐 ' : ''}{t.name}</option>
              {/each}
            </select>
          </label>
        </div>

        <label class="text-sm block">
          <span class="block mb-1 text-dark-900/70 dark:text-dark-100/70">โปรเจ็ค (ไม่บังคับ)</span>
          <select bind:value={projectId} class="input w-full">
            <option value="">ไม่ระบุโปรเจ็ค</option>
            {#each projects as p}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
          <span class="mt-1 block text-xs text-dark-900/50 dark:text-dark-100/50">
            เลือกโปรเจ็คแล้ว content ทุกชิ้นในชุดนี้จะถูกจัดเข้าโปรเจ็คนั้น กรองดูแยกกันได้ในหน้า Works และ Calendar
          </span>
        </label>

        <label class="text-sm block">
          <span class="block mb-1 text-dark-900/70 dark:text-dark-100/70">Brand Book / Profile (ไม่บังคับ)</span>
          <select bind:value={brandProfileId} class="input w-full">
            <option value="">ไม่ระบุ</option>
            {#each brandProfiles as p}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
          <a href="/studio/brand-profile/new" class="mt-1 inline-block text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">
            + สร้าง Brand Profile ใหม่ (ตอบครั้งเดียว ใช้ได้กับ content ทุกชิ้น)
          </a>
        </label>

        <div>
          <span class="block mb-1 text-sm text-dark-900/70 dark:text-dark-100/70">Platform</span>
          <div class="flex flex-wrap gap-2">
            {#each PLATFORM_OPTIONS as platform}
              <button
                type="button"
                onclick={() => (platforms = togglePlatform(platforms, platform))}
                class={`rounded-full px-3 py-1.5 text-sm font-semibold capitalize ${platforms.includes(platform) ? 'bg-primary-600 text-white' : 'bg-dark-50 text-dark-900/70 hover:bg-dark-100 dark:bg-dark-900 dark:text-dark-100/70'}`}
              >{platform}</button>
            {/each}
          </div>
        </div>

        <p class="t-caption text-dark-500 dark:text-dark-100/60">ใช้เครดิตไม่เกิน {Math.max(1, Math.ceil(requestedCount * 8))} เครดิต — จ่ายจริงเท่าที่ใช้ ส่วนเกินคืนอัตโนมัติ</p>
        <button type="submit" disabled={isGenerating || !topic.trim()} class="btn-primary">
          {isGenerating ? 'กำลังสร้าง...' : `สร้าง ${requestedCount} content`}
        </button>
      </form>

      <!-- Latest result -->
      {#if lastResult}
        <div class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-5 space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="font-bold text-dark-900 dark:text-dark-50">ผลลัพธ์: {lastResult.series.topic}</h2>
            <a href="/works" class="btn-secondary py-2 text-sm">ไปที่ Works/Calendar</a>
          </div>
          <div class="grid md:grid-cols-2 gap-3">
            {#each lastResult.items as item, i}
              <article class="rounded-lg border border-dark-100 dark:border-dark-700 p-3">
                <div class="flex items-center justify-between text-xs text-dark-900/50 dark:text-dark-100/50">
                  <span>#{i + 1} · {item.platform} · {item.pillar}</span>
                  <span>{formatDate(item.scheduled_at)}</span>
                </div>
                <div class="mt-1 font-semibold text-sm text-dark-900 dark:text-dark-50">{item.hook}</div>
                <p class="mt-1 text-sm text-dark-900/70 dark:text-dark-100/70 whitespace-pre-line">{item.caption}</p>
                <div class="mt-2 text-xs text-primary-600 dark:text-primary-400">{item.cta}</div>
              </article>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Templates -->
      <div class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-5 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-bold text-dark-900 dark:text-dark-50">Templates</h2>
            <p class="text-sm text-dark-900/60 dark:text-dark-100/60">🌐 = ทุกคนเห็น (admin สร้าง) · ที่เหลือเป็นของคุณเอง</p>
          </div>
          <button onclick={() => (showTemplateForm = !showTemplateForm)} class="btn-secondary py-2 text-sm">
            {showTemplateForm ? 'ปิด' : '+ Template ใหม่'}
          </button>
        </div>

        {#if showTemplateForm}
          <form onsubmit={saveTemplate} class="rounded-lg border border-dark-100 dark:border-dark-700 p-4 space-y-3">
            <div class="grid md:grid-cols-2 gap-3">
              <input bind:value={templateName} class="input" placeholder="ชื่อ template" />
              <input bind:value={templateDescription} class="input" placeholder="คำอธิบายสั้น ๆ (ไม่บังคับ)" />
            </div>

            <div>
              <span class="block mb-1 text-sm text-dark-900/70 dark:text-dark-100/70">Platform เริ่มต้น</span>
              <div class="flex flex-wrap gap-2">
                {#each PLATFORM_OPTIONS as platform}
                  <button
                    type="button"
                    onclick={() => (templatePlatforms = togglePlatform(templatePlatforms, platform))}
                    class={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${templatePlatforms.includes(platform) ? 'bg-primary-600 text-white' : 'bg-dark-50 text-dark-900/70 dark:bg-dark-900 dark:text-dark-100/70'}`}
                  >{platform}</button>
                {/each}
              </div>
            </div>

            <div class="space-y-2">
              <span class="block text-sm text-dark-900/70 dark:text-dark-100/70">Slot rotation (แต่ละ content จะหมุนตามลำดับนี้)</span>
              {#each templateSlots as slot, i}
                <div class="flex flex-wrap gap-2 items-center">
                  <select bind:value={slot.pillar} class="input w-36 text-sm">
                    <option value="awareness">awareness</option>
                    <option value="education">education</option>
                    <option value="social_proof">social_proof</option>
                    <option value="conversion">conversion</option>
                  </select>
                  <input bind:value={slot.hook_style} class="input flex-1 text-sm" placeholder="สไตล์ hook เช่น ตั้งคำถาม" />
                  <input bind:value={slot.cta_style} class="input flex-1 text-sm" placeholder="สไตล์ CTA เช่น ทักแชท" />
                  {#if templateSlots.length > 1}
                    <button type="button" onclick={() => removeSlotRow(i)} class="text-red-600 dark:text-red-300 text-sm px-2">ลบ</button>
                  {/if}
                </div>
              {/each}
              <button type="button" onclick={addSlotRow} class="btn-secondary py-1.5 px-3 text-xs">+ เพิ่ม slot</button>
            </div>

            {#if isAdmin}
              <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" bind:checked={templateIsGlobal} />
                <span>ทำเป็น template กลาง (ทุก user เห็น)</span>
              </label>
            {/if}

            <button type="submit" disabled={isSavingTemplate || !templateName.trim()} class="btn-primary py-2 text-sm">
              {isSavingTemplate ? 'กำลังบันทึก...' : 'บันทึก Template'}
            </button>
          </form>
        {/if}

        <div class="grid md:grid-cols-2 gap-3">
          {#each templates as t}
            <div class="rounded-lg border border-dark-100 dark:border-dark-700 p-3 flex items-start justify-between gap-2">
              <div>
                <div class="font-semibold text-sm text-dark-900 dark:text-dark-50">
                  {t.owner_type === 'admin' ? '🌐 ' : ''}{t.name}
                </div>
                {#if t.description}<p class="text-xs text-dark-900/60 dark:text-dark-100/60 mt-0.5">{t.description}</p>{/if}
                <p class="text-xs text-dark-900/50 dark:text-dark-100/50 mt-1">{t.slots.length} slot · {t.default_platforms.join(', ') || 'ไม่ระบุ platform'}</p>
              </div>
              {#if canEditTemplate(t)}
                <button onclick={() => removeTemplate(t)} class="text-xs text-red-600 dark:text-red-300 shrink-0">ลบ</button>
              {/if}
            </div>
          {:else}
            <div class="text-sm text-dark-900/50 dark:text-dark-100/50 md:col-span-2">ยังไม่มี template — ใช้ค่าเริ่มต้นได้เลย หรือสร้างใหม่ด้านบน</div>
          {/each}
        </div>
      </div>

      <!-- History -->
      <div class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-5 space-y-3">
        <h2 class="font-bold text-dark-900 dark:text-dark-50">ประวัติ Series ที่สร้างไว้</h2>
        <div class="divide-y divide-dark-100 dark:divide-dark-700">
          {#each history as s}
            <div class="py-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div class="font-semibold text-sm text-dark-900 dark:text-dark-50">{s.topic}</div>
                <div class="text-xs text-dark-900/50 dark:text-dark-100/50">
                  {s.generated_count}/{s.requested_count} ชิ้น · {formatDate(s.created_at)} · {s.credits_used} เครดิต
                </div>
              </div>
              <span class={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(s.status)}`}>{statusLabel(s.status)}</span>
            </div>
          {:else}
            <div class="py-6 text-center text-sm text-dark-900/50 dark:text-dark-100/50">ยังไม่เคยสร้าง series</div>
          {/each}
        </div>
      </div>
    {/if}
  </main>
</div>
