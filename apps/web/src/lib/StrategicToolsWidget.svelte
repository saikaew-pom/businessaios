<script lang="ts">
  import { onMount } from 'svelte';
  import { listSavedTools, type ToolSave } from '$lib/api';
  import {
    getNextTools,
    STRATEGIC_CHAIN,
    TACTICAL_TOOLS,
    getUserChainOrder,
    saveUserChainOrder,
    resetUserChainOrder,
    type ChainTool
  } from '$lib/toolChain';

  let saves = $state<ToolSave[]>([]);
  let isLoading = $state(true);
  let error = $state('');

  // Chain state
  let chain = $state<ChainTool[]>(STRATEGIC_CHAIN);
  let isEditing = $state(false);
  let dirtyChain = $state<ChainTool[]>([]);
  let saveMsg = $state('');

  // Tool meta (always from default — colors don't change)
  const toolMeta: Record<string, { label: string; emoji: string; color: string }> = {};
  [...STRATEGIC_CHAIN, ...TACTICAL_TOOLS].forEach(t => {
    toolMeta[t.id] = { label: t.label, emoji: t.emoji, color: t.color };
  });

  onMount(async () => {
    chain = getUserChainOrder();
    try {
      const all = await listSavedTools();
      saves = all.filter(s => !s.archived).slice(0, 3);
    } catch (e: any) {
      error = e?.message || 'โหลดข้อมูลไม่สำเร็จ';
    } finally {
      isLoading = false;
    }
  });

  function timeAgo(ts: number): string {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'เมื่อกี้';
    if (min < 60) return `${min} นาทีที่แล้ว`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} ชม.ที่แล้ว`;
    const d = Math.floor(hr / 24);
    if (d < 30) return `${d} วันที่แล้ว`;
    return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  }

  function getNextSuggestion(toolType: string): ChainTool | null {
    const idx = chain.findIndex(t => t.id === toolType);
    if (idx === -1 || idx === chain.length - 1) return null;
    return chain[idx + 1];
  }

  function startEdit() {
    dirtyChain = [...chain];
    isEditing = true;
    saveMsg = '';
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...dirtyChain];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    dirtyChain = next;
  }

  function moveDown(idx: number) {
    if (idx === dirtyChain.length - 1) return;
    const next = [...dirtyChain];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    dirtyChain = next;
  }

  function saveOrder() {
    saveUserChainOrder(dirtyChain);
    chain = [...dirtyChain];
    isEditing = false;
    saveMsg = '✓ บันทึกแล้ว';
    setTimeout(() => { saveMsg = ''; }, 2000);
  }

  function cancelEdit() {
    isEditing = false;
  }

  function resetDefault() {
    if (!confirm('ต้องการรีเซ็ตลำดับกลับเป็นค่าเริ่มต้นไหม (หาปัญหาลูกค้า → วาดภาพลูกค้าในฝัน → เข้าใจงานที่ลูกค้าจ้าง → เช็คจุดขาย → วางแผนธุรกิจ → ออกแบบข้อเสนอ)?')) return;
    resetUserChainOrder();
    chain = [...STRATEGIC_CHAIN];
    isEditing = false;
    saveMsg = '✓ รีเซ็ตกลับค่าเริ่มต้นแล้ว';
    setTimeout(() => { saveMsg = ''; }, 2000);
  }
</script>

<div class="bg-gradient-to-br from-indigo-50 via-blue-50 to-white dark:from-indigo-950/40 dark:via-dark-900 dark:to-dark-950 border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl p-5 mb-6 shadow-sm">
  <div class="flex items-center justify-between mb-4">
    <div class="flex items-center gap-2">
      <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg">
        🧭
      </div>
      <div>
        <h2 class="text-base font-bold text-dark-900 dark:text-dark-50">เครื่องมือกลยุทธ์</h2>
        <p class="text-xs text-dark-900/60 dark:text-dark-100/60">งานที่บันทึกไว้ล่าสุด 3 รายการ + เครื่องมือที่ควรทำถัดไป</p>
      </div>
    </div>
    <div class="flex items-center gap-2">
      {#if saveMsg}
        <span class="text-xs text-green-700 dark:text-green-400 font-semibold">{saveMsg}</span>
      {/if}
      <a href="/tools/saved" class="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold">
        ดูทั้งหมด →
      </a>
    </div>
  </div>

  {#if isLoading}
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {#each [1, 2, 3] as _}
        <div class="bg-white/60 dark:bg-dark-800/60 rounded-xl p-3 border border-dark-100 dark:border-dark-700 animate-pulse">
          <div class="h-4 bg-dark-100 dark:bg-dark-700 rounded w-3/4 mb-2"></div>
          <div class="h-3 bg-dark-100 dark:bg-dark-700 rounded w-1/2"></div>
        </div>
      {/each}
    </div>
  {:else if error}
    <div class="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-3">
      {error}
    </div>
  {:else if saves.length === 0}
    <div class="text-center py-6 text-dark-900/60 dark:text-dark-100/60">
      <div class="text-3xl mb-2">🚀</div>
      <div class="text-sm">ยังไม่เคยใช้เครื่องมือไหนเลย — เริ่มจาก <a href="/tools/pain-generator" class="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">หาปัญหาลูกค้า</a></div>
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {#each saves as save (save.id)}
        {@const meta = toolMeta[save.tool_type] || { label: save.tool_type, emoji: '📋', color: '#6B7280' }}
        {@const nextTool = getNextSuggestion(save.tool_type)}
        <div class="bg-white dark:bg-dark-800 rounded-xl border-2 border-dark-100 dark:border-dark-700 p-3 hover:shadow-md transition-shadow">
          <div class="flex items-start justify-between gap-2 mb-2">
            <div
              class="flex items-center gap-1.5 px-2 py-1 rounded-md text-white text-[10px] font-bold"
              style="background: {meta.color};"
            >
              <span>{meta.emoji}</span>
              <span>{meta.label}</span>
            </div>
            <span class="text-[10px] text-dark-900/50 dark:text-dark-100/50 whitespace-nowrap">{timeAgo(save.updated_at || save.created_at)}</span>
          </div>

          <a href="/tools/saved" class="block text-sm font-semibold text-dark-900 dark:text-dark-50 hover:text-indigo-600 dark:hover:text-indigo-400 line-clamp-2 mb-2 min-h-[2.5rem]" title={save.title}>
            {save.title || '(ไม่มีชื่อ)'}
          </a>

          {#if nextTool}
            <a
              href={`/tools/${nextTool.slug}`}
              class="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded-md bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors"
              title="ทำเครื่องมือถัดไป"
            >
              <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60 font-semibold">ถัดไป →</span>
              <span style="color: {nextTool.color};" class="text-sm">{nextTool.emoji}</span>
              <span class="text-xs font-semibold text-dark-800 dark:text-dark-100">{nextTool.label}</span>
            </a>
          {:else if STRATEGIC_CHAIN.find(t => t.id === save.tool_type)}
            <div class="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded-md bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800">
              <span class="text-[10px] text-green-700 dark:text-green-400 font-semibold">✅ ทำครบตามลำดับแล้ว</span>
            </div>
          {:else}
            <div class="text-[10px] text-dark-900/50 dark:text-dark-100/50 mt-2 italic">เครื่องมือเสริม</div>
          {/if}
        </div>
      {/each}
    </div>

    <div class="mt-4 pt-4 border-t border-indigo-100 dark:border-indigo-900">
      <div class="flex items-center justify-between mb-2">
        <div class="text-[10px] text-dark-900/50 dark:text-dark-100/50 font-semibold uppercase tracking-wide">ลำดับเครื่องมือแนะนำ</div>
        {#if !isEditing}
          <div class="flex items-center gap-2">
            <button onclick={startEdit} class="text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold">
              ✏️ แก้ไขลำดับ
            </button>
            <button onclick={resetDefault} class="text-[10px] text-dark-500 dark:text-dark-300 hover:text-dark-700 dark:hover:text-dark-100 font-semibold">
              ↺ ค่าเริ่มต้น
            </button>
          </div>
        {/if}
      </div>

      {#if isEditing}
        <!-- Editable chain -->
        <div class="bg-white dark:bg-dark-800 border-2 border-indigo-300 dark:border-indigo-700 rounded-lg p-3 mb-2">
          <div class="text-xs text-dark-700 dark:text-dark-200 mb-2">⬆️⬇️ เรียงลำดับ chain ตามที่คุณต้องการ</div>
          <div class="space-y-1.5">
            {#each dirtyChain as t, i (t.id)}
              <div class="flex items-center gap-2 px-2 py-1.5 rounded-md bg-dark-50 dark:bg-dark-900 border border-dark-100 dark:border-dark-700">
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style="background: {t.color};">
                  {i + 1}
                </div>
                <span class="text-sm">{t.emoji}</span>
                <span class="text-xs font-semibold text-dark-800 dark:text-dark-100 flex-1">{t.label}</span>
                <div class="flex items-center gap-0.5">
                  <button onclick={() => moveUp(i)} disabled={i === 0} class="w-6 h-6 rounded text-xs hover:bg-dark-200 dark:hover:bg-dark-700 disabled:opacity-30" title="ย้ายขึ้น">↑</button>
                  <button onclick={() => moveDown(i)} disabled={i === dirtyChain.length - 1} class="w-6 h-6 rounded text-xs hover:bg-dark-200 dark:hover:bg-dark-700 disabled:opacity-30" title="ย้ายลง">↓</button>
                </div>
              </div>
            {/each}
          </div>
          <div class="flex items-center gap-2 mt-3 pt-2 border-t border-dark-100 dark:border-dark-700">
            <button onclick={saveOrder} class="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 font-semibold">
              💾 บันทึก
            </button>
            <button onclick={cancelEdit} class="text-xs px-3 py-1.5 rounded bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 hover:bg-dark-50 dark:hover:bg-dark-700 font-semibold dark:text-dark-100">
              ยกเลิก
            </button>
          </div>
        </div>
      {:else}
        <!-- Display chain -->
        <div class="flex items-center gap-1 text-[11px] flex-wrap">
          {#each chain as t, i (t.id)}
            {@const isDone = saves.some(s => s.tool_type === t.id)}
            <span
              class="px-1.5 py-0.5 rounded {isDone ? 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-400 font-semibold' : 'bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 text-dark-900/50 dark:text-dark-100/50'}"
            >
              {t.emoji} {t.label}
            </span>
            {#if i < chain.length - 1}
              <span class="text-dark-300 dark:text-dark-600">→</span>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
