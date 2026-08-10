<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import {
    getContentItem,
    listContentItems,
    listProjects,
    transitionContentItem,
    type ContentItem,
    type Project,
  } from '$lib/api';
  import { initAuth, isAuthed } from '$lib/auth';
  import { fetchConfig } from '$lib/config';
  import ContentItemDrawer from '$lib/ContentItemDrawer.svelte';
  import { syncFilterParams, withProjectFilter } from '$lib/urlFilters';
  import { Sheet, ListItem } from '$lib/ui';

  const WEEKDAY_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  // Status dot — semantic tokens (commitment #4.2), not raw hex. Only three
  // states are ever visible on this page: approved-but-unscheduled (the
  // "รอจัดตาราง" backlog), scheduled (upcoming), and published (already
  // posted, fetched into the same date range as scheduled so past cells
  // show what actually went out).
  function dotClass(status: string) {
    if (status === 'published') return 'bg-success-600';
    if (status === 'scheduled') return 'bg-info-600';
    return 'bg-warning-600'; // approved, not yet scheduled
  }
  function statusLabel(status: string) {
    if (status === 'published') return 'โพสต์แล้ว';
    if (status === 'scheduled') return 'ตั้งเวลาไว้';
    return 'พร้อมโพสต์ ยังไม่ตั้งเวลา';
  }

  let isLoading = $state(true);
  let isFeatureEnabled = $state(false);
  let error = $state('');
  let notice = $state('');

  let cursor = $state(startOfMonth(new Date()));
  let scheduledItems = $state<ContentItem[]>([]);
  let publishedItems = $state<ContentItem[]>([]);
  let backlogItems = $state<ContentItem[]>([]);
  let selectedItem = $state<ContentItem | null>(null);
  let daySheetCell = $state<{ date: Date; key: string } | null>(null);
  let projectFilter = $state('');
  let projects = $state<Project[]>([]);
  let draggingId = $state<string | null>(null);
  let dragOverKey = $state<string | null>(null);
  // Per-item busy set (not a single string) — two drops can be in flight at
  // once (e.g. the user drags a second item while the first drop's
  // transitionContentItem + loadCalendar refresh is still pending), and a
  // shared "movingId" would have the second drop's `finally` clear the first
  // drop's busy flag (or vice versa) the moment either one settles.
  let movingIds = $state<Set<string>>(new Set());
  // Monotonic guard so an OLDER in-flight loadCalendar() response (from a
  // drop, a drawer save, or a month change) can never clobber a NEWER one
  // that already landed — without this, two concurrent drops racing on the
  // network can apply their responses out of order and silently revert the
  // more recent drop's item back to its old cell.
  let loadSeq = 0;

  function startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function dateKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  let gridStart = $derived(new Date(cursor.getFullYear(), cursor.getMonth(), 1 - cursor.getDay()));
  let itemsByDay = $derived.by(() => {
    const map = new Map<string, ContentItem[]>();
    for (const item of [...scheduledItems, ...publishedItems]) {
      if (!item.scheduled_at) continue;
      const key = dateKey(new Date(item.scheduled_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    for (const dayItems of map.values()) {
      dayItems.sort((a, b) => (a.scheduled_at || 0) - (b.scheduled_at || 0));
    }
    return map;
  });
  let cells = $derived.by(() => {
    const list: { date: Date; key: string; isCurrentMonth: boolean; isToday: boolean; items: ContentItem[] }[] = [];
    const todayKey = dateKey(new Date());
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const key = dateKey(d);
      list.push({
        date: d,
        key,
        isCurrentMonth: d.getMonth() === cursor.getMonth(),
        isToday: key === todayKey,
        items: itemsByDay.get(key) || [],
      });
    }
    return list;
  });
  let monthLabel = $derived(cursor.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }));

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
      projectFilter = $page.url.searchParams.get('project_id') || '';
      projects = (await listProjects()).filter((p) => p.status !== 'archived');
      await loadCalendar();
      const focusId = $page.url.searchParams.get('focus');
      if (focusId) {
        try {
          selectedItem = await getContentItem(focusId);
        } catch {
          // Deep link pointed at an item that's gone or belongs to someone
          // else — just skip opening the drawer, the calendar still loads.
        }
      }
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isLoading = false;
    }
  });

  async function loadCalendar() {
    error = '';
    const seq = ++loadSeq;
    const gridEnd = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + 42);
    const [scheduled, published, backlog] = await Promise.all([
      listContentItems({ status: 'scheduled', project_id: projectFilter, scheduled_from: gridStart.getTime(), scheduled_to: gridEnd.getTime(), limit: 100 }),
      listContentItems({ status: 'published', project_id: projectFilter, scheduled_from: gridStart.getTime(), scheduled_to: gridEnd.getTime(), limit: 100 }),
      listContentItems({ status: 'approved', project_id: projectFilter, limit: 100 }),
    ]);
    // A newer loadCalendar() call already started (and may have already
    // resolved) after this one — its results are more current, so discard
    // this stale response instead of overwriting the newer state.
    if (seq !== loadSeq) return;
    scheduledItems = scheduled;
    publishedItems = published;
    backlogItems = backlog.filter((item) => !item.scheduled_at);
    syncFilterParams({ project_id: projectFilter });
  }

  async function changeMonth(delta: number) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    isLoading = true;
    try {
      await loadCalendar();
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isLoading = false;
    }
  }

  async function goToday() {
    cursor = startOfMonth(new Date());
    isLoading = true;
    try {
      await loadCalendar();
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isLoading = false;
    }
  }

  function openItem(item: ContentItem) {
    daySheetCell = null;
    selectedItem = item;
  }

  function openDaySheet(cell: { date: Date; key: string }) {
    daySheetCell = cell;
  }

  let daySheetLabel = $derived(daySheetCell ? daySheetCell.date.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' }) : '');
  let daySheetItems = $derived(daySheetCell ? itemsByDay.get(daySheetCell.key) || [] : []);

  async function handleDrawerUpdated(updated: ContentItem) {
    selectedItem = updated;
    await loadCalendar();
    const all = [...scheduledItems, ...publishedItems, ...backlogItems];
    selectedItem = all.find((existing) => existing.id === updated.id) || null;
  }

  function handleDragStart(item: ContentItem, e: DragEvent) {
    // Refuse to start a new drag on an item that already has a
    // reschedule in flight — otherwise a second drop on the same item
    // before the first settles would fire a second concurrent
    // transitionContentItem call racing the first.
    if (movingIds.has(item.id)) {
      e.preventDefault();
      return;
    }
    draggingId = item.id;
  }

  function handleDragEnd() {
    draggingId = null;
    dragOverKey = null;
  }

  function handleCellDragOver(e: DragEvent, key: string) {
    e.preventDefault();
    dragOverKey = key;
  }

  async function handleCellDrop(e: DragEvent, day: Date) {
    e.preventDefault();
    dragOverKey = null;
    const id = draggingId;
    draggingId = null;
    if (!id) return;
    const item = [...scheduledItems, ...backlogItems].find((existing) => existing.id === id);
    if (!item) return;

    // Preserve the time-of-day an already-scheduled item had; a fresh drop
    // from the "รอจัดตาราง" backlog (never scheduled before) defaults to 09:00.
    const base = item.scheduled_at ? new Date(item.scheduled_at) : defaultDropTime();
    let target = new Date(day.getFullYear(), day.getMonth(), day.getDate(), base.getHours(), base.getMinutes(), 0, 0);
    const now = new Date();
    const droppedOnToday = day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth() && day.getDate() === now.getDate();
    if (!item.scheduled_at && droppedOnToday && target.getTime() <= now.getTime()) {
      // The 09:00 default has already passed today (e.g. it's 3pm and the
      // user drags a backlog card onto today's cell) — the backend rejects
      // any scheduled_at at/before now, so a fixed 09:00 default would make
      // "drop onto today" fail every afternoon. Scoped to TODAY only: a
      // fresh backlog drop onto a genuinely past day (a previous-month cell
      // in the grid) must still be rejected, not silently rescheduled to
      // "now" on the wrong day.
      target = new Date(now.getTime() + 5 * 60 * 1000);
    }

    movingIds = new Set(movingIds).add(id);
    error = '';
    try {
      // 'reschedule' is valid from both 'approved' and 'scheduled', so a drop
      // never needs to branch on the item's current status.
      await transitionContentItem(id, { action: 'reschedule', scheduled_at: target.getTime(), timezone: 'Asia/Bangkok' });
      notice = 'ย้ายกำหนดโพสต์แล้ว';
      await loadCalendar();
    } catch (err) {
      error = humanizeError(err);
    } finally {
      const next = new Set(movingIds);
      next.delete(id);
      movingIds = next;
    }
  }

  function defaultDropTime() {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  }

  function humanizeError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err || '');
    const map: Record<string, string> = {
      feature_disabled: 'Creative Workspace ยังไม่เปิดใช้งานบน environment นี้',
      invalid_schedule_time: 'ต้องเลือกวันเวลาที่เป็นอนาคต ย้ายไปวันในอดีตไม่ได้',
      approval_required: 'ต้องอนุมัติก่อนจึงจะกำหนดวันโพสต์ได้',
      content_item_not_found: 'ไม่พบ content นี้',
    };
    return map[message] || message || 'ทำรายการไม่สำเร็จ';
  }
</script>

<svelte:head>
  <title>Content Calendar — Business Smart OS</title>
</svelte:head>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950">
  <main class="container-narrow py-6 space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div class="text-sm text-primary-600 dark:text-primary-400 font-semibold">Creative Workspace</div>
        <h1 class="heading-2">Content Calendar</h1>
        <p class="text-dark-900/60 dark:text-dark-100/60">ลากคอนเทนต์ที่อนุมัติแล้วมาวางบนวันที่ต้องการโพสต์ หรือลากย้ายวันของงานที่ตั้งเวลาไว้แล้ว</p>
      </div>
      <div class="flex gap-2">
        <a href={withProjectFilter('/inbox', projectFilter)} class="btn-secondary">Inbox</a>
        <a href={withProjectFilter('/works', projectFilter)} class="btn-secondary">Works</a>
      </div>
    </div>

    {#if error}
      <div class="rounded-lg border border-danger-100 dark:border-danger-600/40 bg-danger-50 dark:bg-danger-600/15 p-3 text-sm text-danger-700 dark:text-danger-100">{error}</div>
    {/if}
    {#if notice}
      <div class="rounded-lg border border-success-100 dark:border-success-600/40 bg-success-50 dark:bg-success-600/15 p-3 text-sm text-success-700 dark:text-success-100">{notice}</div>
    {/if}

    {#if isLoading}
      <div class="py-16 text-center text-dark-900/60 dark:text-dark-100/60">กำลังโหลด...</div>
    {:else if !isFeatureEnabled}
      <div class="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-5">
        <div class="font-semibold text-amber-900 dark:text-amber-200">Calendar ยังปิดอยู่</div>
        <div class="text-sm text-amber-800 dark:text-amber-300 mt-1">เปิด `CREATIVE_EMBEDDED_ENABLED=true` หลัง apply migration Phase 8 แล้วจึงเริ่มใช้งานได้</div>
      </div>
    {:else}
      <div class="grid gap-4 lg:grid-cols-[1fr_260px]">
        <section class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
          <div class="mb-4 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <button type="button" onclick={() => changeMonth(-1)} class="btn-secondary px-3">‹</button>
              <div class="min-w-[9rem] text-center font-bold text-dark-900 dark:text-dark-50">{monthLabel}</div>
              <button type="button" onclick={() => changeMonth(1)} class="btn-secondary px-3">›</button>
            </div>
            <div class="flex items-center gap-2">
              <select
                bind:value={projectFilter}
                onchange={() => { isLoading = true; loadCalendar().catch((err) => { error = humanizeError(err); }).finally(() => { isLoading = false; }); }}
                class="input max-w-[190px]"
              >
                <option value="">ทุกโปรเจ็ค</option>
                {#each projects as p}
                  <option value={p.id}>{p.name}</option>
                {/each}
              </select>
              <button type="button" onclick={goToday} class="btn-secondary">วันนี้</button>
            </div>
          </div>

          <div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dark-900/60 dark:text-dark-100/60">
            <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full {dotClass('approved')}"></span>พร้อมโพสต์</span>
            <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full {dotClass('scheduled')}"></span>ตั้งเวลาไว้</span>
            <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full {dotClass('published')}"></span>โพสต์แล้ว</span>
          </div>

          <div class="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-dark-900/50 dark:text-dark-100/50">
            {#each WEEKDAY_LABELS as label}
              <div class="py-1">{label}</div>
            {/each}
          </div>

          <div class="grid grid-cols-7 gap-1">
            {#each cells as cell}
              {@const visibleItems = cell.items.slice(0, 2)}
              {@const overflowCount = cell.items.length - visibleItems.length}
              <div
                role="button"
                tabindex="0"
                aria-label={`วันที่ ${cell.date.getDate()} — แตะดูรายการทั้งหมด`}
                onclick={() => openDaySheet(cell)}
                onkeydown={(e) => { if (e.key === 'Enter') openDaySheet(cell); }}
                ondragover={(e) => handleCellDragOver(e, cell.key)}
                ondragleave={() => { if (dragOverKey === cell.key) dragOverKey = null; }}
                ondrop={(e) => handleCellDrop(e, cell.date)}
                class="min-h-[3.75rem] sm:min-h-[6rem] rounded-lg border p-1.5 text-left transition
                  {cell.isCurrentMonth ? 'border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800' : 'border-transparent bg-dark-50/60 dark:bg-dark-900/40'}
                  {dragOverKey === cell.key ? 'ring-2 ring-primary-400' : ''}"
              >
                <div class="mb-1 text-xs font-semibold {cell.isToday ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white' : cell.isCurrentMonth ? 'text-dark-900 dark:text-dark-50' : 'text-dark-900/30 dark:text-dark-100/30'}">
                  {cell.date.getDate()}
                </div>
                <div class="space-y-1">
                  {#each visibleItems as item}
                    <div
                      role="button"
                      tabindex="0"
                      draggable={item.status === 'scheduled' && !movingIds.has(item.id)}
                      ondragstart={(e) => handleDragStart(item, e)}
                      ondragend={handleDragEnd}
                      onclick={(e) => { e.stopPropagation(); if (!movingIds.has(item.id)) openItem(item); }}
                      onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); if (!movingIds.has(item.id)) openItem(item); } }}
                      class="flex items-center gap-1 truncate rounded sm:bg-primary-50 sm:dark:bg-primary-900/30 px-0.5 sm:px-1.5 py-1 text-left text-xs font-medium text-primary-800 dark:text-primary-200 sm:hover:bg-primary-100 sm:dark:hover:bg-primary-900/50 {movingIds.has(item.id) ? 'opacity-50' : ''}"
                      title={item.title}
                    >
                      <span class="h-2 w-2 sm:h-1.5 sm:w-1.5 shrink-0 rounded-full {dotClass(item.status)}"></span>
                      <span class="hidden sm:inline truncate">{formatTime(item.scheduled_at!)} {item.title}</span>
                    </div>
                  {/each}
                  {#if overflowCount > 0}
                    <div class="px-0.5 sm:px-1.5 text-[11px] text-dark-900/50 dark:text-dark-100/50">+{overflowCount}<span class="hidden sm:inline"> เพิ่มเติม</span></div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </section>

        <aside class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
          <div class="mb-1 font-semibold text-dark-900 dark:text-dark-50">รอจัดตาราง</div>
          <p class="mb-3 text-xs text-dark-900/60 dark:text-dark-100/60">อนุมัติแล้วแต่ยังไม่ตั้งเวลา — ลากไปวางบนวันที่ต้องการ (เริ่มต้น 09:00)</p>
          {#if !backlogItems.length}
            <div class="rounded-lg border border-dashed border-dark-100 dark:border-dark-700 p-4 text-center text-xs text-dark-900/50 dark:text-dark-100/50">
              ไม่มีงานที่รอจัดตาราง
            </div>
          {:else}
            <div class="space-y-2">
              {#each backlogItems as item}
                <div
                  draggable="true"
                  ondragstart={(e) => handleDragStart(item, e)}
                  ondragend={handleDragEnd}
                  role="button"
                  tabindex="0"
                  onclick={() => openItem(item)}
                  onkeydown={(e) => { if (e.key === 'Enter') openItem(item); }}
                  class="cursor-grab rounded-lg border border-dark-100 dark:border-dark-700 p-2 text-sm hover:border-primary-300 dark:hover:border-primary-700 {movingIds.has(item.id) ? 'opacity-50' : ''}"
                >
                  <div class="flex items-center gap-1.5 truncate font-medium text-dark-900 dark:text-dark-50">
                    <span class="h-1.5 w-1.5 shrink-0 rounded-full {dotClass(item.status)}"></span>
                    <span class="truncate">{item.title}</span>
                  </div>
                  <div class="text-xs text-dark-900/50 dark:text-dark-100/50">{item.platform || 'social'} · {item.format || 'post'}</div>
                </div>
              {/each}
            </div>
          {/if}
        </aside>
      </div>
    {/if}
  </main>
</div>

<Sheet open={Boolean(daySheetCell)} onclose={() => (daySheetCell = null)}>
  <div class="t-heading mb-1">{daySheetLabel}</div>
  {#if !daySheetItems.length}
    <p class="t-caption mb-2">ไม่มีงานในวันนี้</p>
  {:else}
    <div class="t-caption mb-2">{daySheetItems.length} รายการ — แตะเพื่อเปิด/แก้ไข</div>
    {#each daySheetItems as item, i}
      <ListItem
        title={item.title}
        subtitle={`${formatTime(item.scheduled_at!)} · ${statusLabel(item.status)}`}
        onclick={() => openItem(item)}
        last={i === daySheetItems.length - 1}
      >
        {#snippet icon()}<span class="block h-2.5 w-2.5 rounded-full {dotClass(item.status)}"></span>{/snippet}
      </ListItem>
    {/each}
  {/if}
</Sheet>

<ContentItemDrawer item={selectedItem} onClose={() => (selectedItem = null)} onUpdated={handleDrawerUpdated} />
