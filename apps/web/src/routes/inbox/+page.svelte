<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import {
    createContentItemCreativeRequest,
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
  import { page } from '$app/stores';

  const statusOptions = [
    { value: 'pending_review', label: 'รอรีวิว' },
    { value: 'approved', label: 'อนุมัติแล้ว' },
    { value: 'rejected', label: 'ส่งกลับแก้' },
    { value: 'scheduled', label: 'ตั้งเวลาแล้ว' },
  ];

  let isLoading = true;
  let isFeatureEnabled = false;
  let error = '';
  let notice = '';
  let items: ContentItem[] = [];
  let statusFilter = 'pending_review';
  let projectFilter = '';
  let projects: Project[] = [];
  let actionBusy = '';
  let selectedItem: ContentItem | null = null;

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
      statusFilter = $page.url.searchParams.get('status') || statusFilter;
      projectFilter = $page.url.searchParams.get('project_id') || '';
      projects = (await listProjects()).filter((p) => p.status !== 'archived');
      await loadItems();
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isLoading = false;
    }
  });

  async function loadItems() {
    error = '';
    items = await listContentItems({ status: statusFilter, project_id: projectFilter, limit: 80 });
    syncFilterParams({ status: statusFilter, project_id: projectFilter });
  }

  async function handleStatusChange() {
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
    // Show the freshest copy immediately, then refetch since a transition
    // can move the item out of the current status filter.
    selectedItem = updated;
    try {
      await loadItems();
      selectedItem = items.find((existing) => existing.id === updated.id) || null;
    } catch (err) {
      // The transition/save itself already succeeded — only the background
      // refetch failed. Report it on the page rather than letting it surface
      // inside the drawer as a false "action failed" (the drawer now awaits
      // this call so its busy state covers the refetch too).
      error = humanizeError(err);
    }
  }

  async function transition(item: ContentItem, action: 'approve' | 'reject' | 'archive') {
    actionBusy = `${action}:${item.id}`;
    error = '';
    try {
      const reason = action === 'reject' ? window.prompt('เหตุผลที่ส่งกลับแก้') || '' : undefined;
      await transitionContentItem(item.id, { action, reason });
      notice = action === 'approve' ? 'อนุมัติแล้ว' : action === 'reject' ? 'ส่งกลับแก้แล้ว' : 'Archive แล้ว';
      await loadItems();
    } catch (err) {
      error = humanizeError(err);
    } finally {
      actionBusy = '';
    }
  }

  async function schedule(item: ContentItem) {
    const value = window.prompt('ตั้งเวลาโพสต์ เช่น 2026-08-05 09:30', defaultScheduleText());
    if (!value) return;
    const normalized = value.replace(' ', 'T');
    const scheduledAt = new Date(normalized).getTime();
    actionBusy = `schedule:${item.id}`;
    error = '';
    try {
      await transitionContentItem(item.id, { action: 'schedule', scheduled_at: scheduledAt, timezone: 'Asia/Bangkok' });
      notice = 'ตั้งเวลาแล้ว';
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

  function defaultScheduleText() {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 09:00`;
  }

  function formatDate(ts: number | null) {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function statusLabel(status: string) {
    return statusOptions.find((item) => item.value === status)?.label || status;
  }

  function humanizeError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err || '');
    const map: Record<string, string> = {
      feature_disabled: 'Content Workspace ยังไม่เปิดใช้งานบน environment นี้',
      approval_required: 'ต้องอนุมัติก่อนตั้งเวลา/เผยแพร่',
      invalid_schedule_time: 'เวลาที่ตั้งต้องเป็นเวลาในอนาคต',
    };
    return map[message] || message || 'ทำรายการไม่สำเร็จ';
  }
</script>

<svelte:head>
  <title>Content Inbox — Business Smart OS</title>
</svelte:head>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950">
  <main class="container-narrow py-6 space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div class="text-sm text-primary-600 dark:text-primary-400 font-semibold">Creative Workspace</div>
        <h1 class="heading-2">Content Inbox</h1>
        <p class="text-dark-900/60 dark:text-dark-100/60">รีวิวคอนเทนต์จาก calendar ก่อนส่งต่อไปสร้าง creative หรือเตรียมโพสต์</p>
      </div>
      <div class="flex gap-2">
        <a href={withProjectFilter('/works', projectFilter)} class="btn-secondary">Works</a>
        <a href={withProjectFilter('/calendar', projectFilter)} class="btn-secondary">Calendar</a>
        <a href="/studio" class="btn-primary">Studio</a>
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
        <div class="font-semibold text-amber-900 dark:text-amber-200">Content Workspace ยังปิดอยู่</div>
        <div class="text-sm text-amber-800 dark:text-amber-300 mt-1">เปิด `CREATIVE_EMBEDDED_ENABLED=true` หลัง apply migration Phase 8 แล้วจึงเริ่มใช้งาน inbox ได้</div>
      </div>
    {:else}
      <section class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
        <div class="flex flex-wrap items-center gap-3">
          <label class="text-sm font-semibold text-dark-900 dark:text-dark-50" for="status">สถานะ</label>
          <select id="status" bind:value={statusFilter} onchange={handleStatusChange} class="input max-w-[220px]">
            {#each statusOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
          <label class="text-sm font-semibold text-dark-900 dark:text-dark-50" for="project">โปรเจ็ค</label>
          <select id="project" bind:value={projectFilter} onchange={handleStatusChange} class="input max-w-[220px]">
            <option value="">ทุกโปรเจ็ค</option>
            {#each projects as p}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
          <button onclick={handleStatusChange} class="btn-secondary">Refresh</button>
        </div>
      </section>

      {#if !items.length}
        <div class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-10 text-center">
          <div class="font-semibold text-dark-900 dark:text-dark-50">ยังไม่มีรายการในสถานะนี้</div>
          <p class="text-sm text-dark-900/60 dark:text-dark-100/60 mt-1">ไปที่ Project Step 5 แล้วกดเปิดใน Inbox เพื่อแยกโพสต์จากปฏิทินคอนเทนต์</p>
        </div>
      {:else}
        <div class="space-y-3">
          {#each items as item}
            <article class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2 text-xs text-dark-900/50 dark:text-dark-100/50">
                    <span class="rounded-full bg-dark-100 dark:bg-dark-700 px-2 py-1 font-semibold text-dark-900 dark:text-dark-50">{statusLabel(item.status)}</span>
                    <span>{item.platform || 'social'}</span>
                    <span>{item.format || 'post'}</span>
                    <span>{item.project_name || 'No project'}</span>
                  </div>
                  <button type="button" onclick={() => openItem(item)} class="mt-2 block text-left text-lg font-bold text-dark-900 dark:text-dark-50 hover:underline">{item.title}</button>
                  {#if item.caption}
                    <p class="mt-2 text-sm text-dark-900/70 dark:text-dark-100/70 whitespace-pre-line">{item.caption}</p>
                  {/if}
                  {#if item.visual_suggestion}
                    <p class="mt-2 text-sm text-primary-700 dark:text-primary-300">Visual: {item.visual_suggestion}</p>
                  {/if}
                  {#if item.hashtags?.length}
                    <div class="mt-2 flex flex-wrap gap-1">
                      {#each item.hashtags as tag}
                        <span class="text-xs text-dark-900/50 dark:text-dark-100/50">#{tag.replace(/^#/, '')}</span>
                      {/each}
                    </div>
                  {/if}
                </div>
                <div class="text-xs text-dark-900/50 dark:text-dark-100/50 text-right">อัปเดต {formatDate(item.updated_at)}</div>
              </div>

              <div class="mt-4 flex flex-wrap gap-2">
                <button onclick={() => openItem(item)} class="btn-secondary">แก้ไข</button>
                {#if item.status !== 'approved'}
                  <button onclick={() => transition(item, 'approve')} disabled={!!actionBusy} class="btn-primary">
                    {actionBusy === `approve:${item.id}` ? 'กำลังอนุมัติ...' : 'Approve'}
                  </button>
                {/if}
                <button onclick={() => openStudio(item)} disabled={!!actionBusy} class="btn-secondary">
                  {actionBusy === `studio:${item.id}` ? 'กำลังเปิด...' : 'Create Creative'}
                </button>
                {#if item.status === 'approved'}
                  <button onclick={() => schedule(item)} disabled={!!actionBusy} class="btn-secondary">Schedule</button>
                  <button onclick={() => markPublished(item)} disabled={!!actionBusy} class="btn-secondary">Mark Published</button>
                {/if}
                {#if item.status !== 'rejected'}
                  <button onclick={() => transition(item, 'reject')} disabled={!!actionBusy} class="btn-ghost">Reject</button>
                {/if}
                <button onclick={() => transition(item, 'archive')} disabled={!!actionBusy} class="btn-ghost">Archive</button>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    {/if}
  </main>
</div>

<ContentItemDrawer item={selectedItem} onClose={() => (selectedItem = null)} onUpdated={handleDrawerUpdated} />
