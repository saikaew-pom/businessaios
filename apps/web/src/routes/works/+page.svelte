<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount, tick } from 'svelte';
  import {
    createContentItemCreativeRequest,
    getMediaAssetContentUrl,
    listContentItems,
    listProjects,
    transitionContentItem,
    type ContentItem,
    type Project,
  } from '$lib/api';
  import { initAuth, isAuthed } from '$lib/auth';
  import { fetchConfig } from '$lib/config';
  import ContentItemDrawer from '$lib/ContentItemDrawer.svelte';
  import { buildStudioPrompt, suggestedAspectRatio } from '$lib/studioHandoff';
  import { syncFilterParams, withProjectFilter } from '$lib/urlFilters';

  const statuses = [
    { value: '', label: 'ทั้งหมด' },
    { value: 'pending_review', label: 'รอรีวิว' },
    { value: 'approved', label: 'อนุมัติแล้ว' },
    { value: 'scheduled', label: 'ตั้งเวลา' },
    { value: 'published', label: 'เผยแพร่แล้ว' },
    { value: 'archived', label: 'Archive' },
  ];

  let isLoading = true;
  let isFeatureEnabled = false;
  let items: ContentItem[] = [];
  let statusFilter = '';
  let projectFilter = '';
  let projects: Project[] = [];
  let query = '';
  let error = '';
  let notice = '';
  let actionBusy = '';
  let selectedItem: ContentItem | null = null;

  $: filteredItems = items.filter((item) => {
    const haystack = `${item.title} ${item.caption} ${item.platform} ${item.format} ${item.project_name || ''}`.toLowerCase();
    return !query.trim() || haystack.includes(query.trim().toLowerCase());
  });

  onMount(async () => {
    await initAuth();
    if (!$isAuthed) {
      goto('/login');
      return;
    }

    try {
      const config = await fetchConfig();
      isFeatureEnabled = Boolean(config.features.creative_embedded);
      if (!isFeatureEnabled) return;
      statusFilter = $page.url.searchParams.get('status') || '';
      projectFilter = $page.url.searchParams.get('project_id') || '';
      projects = (await listProjects()).filter((p) => p.status !== 'archived');
      await loadItems();
      await tick();
      const focus = $page.url.searchParams.get('focus');
      if (focus) {
        const focused = items.find((item) => item.id === focus);
        if (focused) selectedItem = focused;
        else document.getElementById(`work-${focus}`)?.scrollIntoView({ block: 'center' });
      }
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isLoading = false;
    }
  });

  async function loadItems() {
    error = '';
    items = await listContentItems({ status: statusFilter, project_id: projectFilter, limit: 120 });
    syncFilterParams({ status: statusFilter, project_id: projectFilter });
  }

  async function handleFilterChange() {
    isLoading = true;
    try {
      await loadItems();
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isLoading = false;
    }
  }

  function openItem(item: ContentItem) {
    selectedItem = item;
  }

  async function handleDrawerUpdated(updated: ContentItem) {
    // Show the freshest copy in the still-open drawer immediately, then
    // refetch the list — a status transition can move the item out of the
    // current filter (e.g. approving while filtered to "รอรีวิว"), and only
    // a real refetch (not a local splice) reflects that correctly.
    selectedItem = updated;
    try {
      await loadItems();
      selectedItem = items.find((existing) => existing.id === updated.id) || null;
    } catch (err) {
      // The transition/save itself already succeeded — only the background
      // refetch failed. Report it on the page (same pattern as the other
      // handlers below) rather than letting it surface inside the drawer as
      // a false "action failed", since the drawer now awaits this call.
      error = humanizeError(err);
    }
  }

  async function approve(item: ContentItem) {
    actionBusy = `approve:${item.id}`;
    error = '';
    try {
      await transitionContentItem(item.id, { action: 'approve' });
      notice = 'อนุมัติแล้ว';
      await loadItems();
    } catch (err) {
      error = humanizeError(err);
    } finally {
      actionBusy = '';
    }
  }

  async function markPublished(item: ContentItem) {
    const manual_publish_url = window.prompt('ใส่ URL โพสต์จริง ถ้ามี') || '';
    actionBusy = `published:${item.id}`;
    error = '';
    try {
      await transitionContentItem(item.id, { action: 'manual_publish_ack', manual_publish_url });
      notice = 'บันทึกว่าเผยแพร่แล้ว';
      await loadItems();
    } catch (err) {
      error = humanizeError(err);
    } finally {
      actionBusy = '';
    }
  }

  async function openStudio(item: ContentItem) {
    actionBusy = `studio:${item.id}`;
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
      actionBusy = '';
    }
  }

  function assetUrl(item: ContentItem) {
    return item.primary_asset_id ? getMediaAssetContentUrl(item.primary_asset_id) : '';
  }

  function formatDate(ts: number | null) {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function humanizeError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err || '');
    const map: Record<string, string> = {
      feature_disabled: 'Creative Workspace ยังไม่เปิดใช้งานบน environment นี้',
      approval_required: 'ต้องอนุมัติก่อนบันทึกว่าเผยแพร่แล้ว',
    };
    return map[message] || message || 'ทำรายการไม่สำเร็จ';
  }
</script>

<svelte:head>
  <title>Works — Business Smart OS</title>
</svelte:head>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950">
  <main class="container-narrow py-6 space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div class="text-sm text-primary-600 dark:text-primary-400 font-semibold">Creative Workspace</div>
        <h1 class="heading-2">Works</h1>
        <p class="text-dark-900/60 dark:text-dark-100/60">คลังงานคอนเทนต์และ creative asset ที่พร้อมตรวจ ต่อยอด และเผยแพร่</p>
      </div>
      <div class="flex gap-2">
        <a href={withProjectFilter('/inbox', projectFilter)} class="btn-secondary">Inbox</a>
        <a href={withProjectFilter('/calendar', projectFilter)} class="btn-secondary">Calendar</a>
        <a href="/studio/library" class="btn-primary">Asset Library</a>
      </div>
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
        <div class="font-semibold text-amber-900 dark:text-amber-200">Works ยังปิดอยู่</div>
        <div class="text-sm text-amber-800 dark:text-amber-300 mt-1">เปิด `CREATIVE_EMBEDDED_ENABLED=true` หลัง apply migration Phase 8 แล้วจึงเริ่มใช้งานได้</div>
      </div>
    {:else}
      <section class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
        <div class="grid md:grid-cols-[200px_200px_1fr_auto] gap-3">
          <select bind:value={statusFilter} onchange={handleFilterChange} class="input">
            {#each statuses as status}
              <option value={status.value}>{status.label}</option>
            {/each}
          </select>
          <select bind:value={projectFilter} onchange={handleFilterChange} class="input">
            <option value="">ทุกโปรเจ็ค</option>
            {#each projects as p}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
          <input bind:value={query} class="input" placeholder="ค้นหา title, caption, platform, project" />
          <button onclick={handleFilterChange} class="btn-secondary">Refresh</button>
        </div>
      </section>

      {#if !filteredItems.length}
        <div class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-10 text-center">
          <div class="font-semibold text-dark-900 dark:text-dark-50">ยังไม่มี work ที่ตรงกับ filter</div>
          <p class="text-sm text-dark-900/60 dark:text-dark-100/60 mt-1">เริ่มจาก Project Step 5 แล้วส่ง calendar เข้า Inbox</p>
        </div>
      {:else}
        <div class="grid md:grid-cols-2 gap-4">
          {#each filteredItems as item}
            <article id={`work-${item.id}`} class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 overflow-hidden">
              {#if assetUrl(item)}
                <img src={assetUrl(item)} alt={item.title} class="w-full aspect-video object-cover bg-dark-100 dark:bg-dark-700" />
              {/if}
              <div class="p-4">
                <div class="flex flex-wrap items-center gap-2 text-xs text-dark-900/50 dark:text-dark-100/50">
                  <span class="rounded-full bg-dark-100 dark:bg-dark-700 px-2 py-1 font-semibold text-dark-900 dark:text-dark-50">{item.status}</span>
                  <span>{item.platform || 'social'}</span>
                  <span>{item.format || 'post'}</span>
                  {#if item.scheduled_at}<span>โพสต์ {formatDate(item.scheduled_at)}</span>{/if}
                </div>
                <button type="button" onclick={() => openItem(item)} class="mt-2 block text-left text-lg font-bold text-dark-900 dark:text-dark-50 hover:underline">{item.title}</button>
                <p class="mt-2 line-clamp-3 text-sm text-dark-900/70 dark:text-dark-100/70">{item.caption || item.visual_suggestion || '-'}</p>
                <div class="mt-4 flex flex-wrap gap-2">
                  <button onclick={() => openItem(item)} class="btn-secondary">แก้ไข</button>
                  {#if !['approved', 'scheduled', 'published'].includes(item.status)}
                    <button onclick={() => approve(item)} disabled={!!actionBusy} class="btn-primary">
                      {actionBusy === `approve:${item.id}` ? 'กำลังอนุมัติ...' : 'Approve'}
                    </button>
                  {/if}
                  <button onclick={() => openStudio(item)} disabled={!!actionBusy} class="btn-secondary">
                    {actionBusy === `studio:${item.id}` ? 'กำลังเปิด...' : 'Create Creative'}
                  </button>
                  {#if ['approved', 'scheduled'].includes(item.status)}
                    <a href={withProjectFilter(`/calendar?focus=${item.id}`, projectFilter)} class="btn-secondary">📅 Calendar</a>
                    <button onclick={() => markPublished(item)} disabled={!!actionBusy} class="btn-secondary">Mark Published</button>
                  {/if}
                </div>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    {/if}
  </main>
</div>

<ContentItemDrawer item={selectedItem} onClose={() => (selectedItem = null)} onUpdated={handleDrawerUpdated} />
