<script lang="ts">
  /**
   * Step 5: Content Triage (Must / Maybe / Kill)
   * Smart Engine classifies source content items
   * User can move items between buckets
   */
  let { project, initialData, sourceData, step3Data, presets, onGenerate, isGenerating }: {
    project: any;
    initialData: any;
    sourceData: any;
    step3Data: any;
    presets: any;
    onGenerate: (input: any) => void;
    isGenerating: boolean;
  } = $props();

  let sourceItems = $derived<any[]>(sourceData?.source_items || []);

  function handleSubmit(e: Event) {
    e.preventDefault();
    onGenerate({
      source_items: sourceItems,
      atr: step3Data,
      title: project?.title,
      objective: project?.objective,
      target_slides: project?.target_slides,
      time_minutes: project?.time_minutes,
    });
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold mb-2">🎯 Content Triage</h2>
    <p class="text-sm text-dark-900/60 dark:text-dark-100/60">ระบบอัจฉริยะ จะจัดเนื้อหาเป็น 3 กลุ่ม: <strong>Must Have</strong> (ลงสไลด์) / <strong>Maybe</strong> (speaker notes) / <strong>Kill It</strong> (ตัดทิ้ง)</p>
  </div>

  <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300">
    📋 Source items: <strong>{sourceItems.length}</strong> รายการ (จาก Step 4)
  </div>

  {#if sourceItems.length === 0}
    <div class="text-center py-8 text-dark-900/50 dark:text-dark-100/50">
      ⚠️ ไม่มี source content — กรุณากลับไป Step 4 เพื่อใส่ข้อมูล
    </div>
  {:else}
    <div class="space-y-2 max-h-96 overflow-y-auto border border-dark-200 dark:border-dark-600 rounded-lg p-3">
      {#each sourceItems.slice(0, 5) as item, i}
        <div class="text-xs bg-dark-50 dark:bg-dark-900 p-2 rounded">
          <strong>{item.title || `Item ${i + 1}`}:</strong> {(item.content || '').slice(0, 120)}...
        </div>
      {/each}
      {#if sourceItems.length > 5}
        <div class="text-xs text-dark-900/50 dark:text-dark-100/50 text-center">...และอีก {sourceItems.length - 5} รายการ</div>
      {/if}
    </div>
  {/if}

  <form onsubmit={handleSubmit} class="space-y-3">
    <button
      type="submit"
      disabled={isGenerating || sourceItems.length === 0}
      class="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-dark-300 text-white font-semibold py-3 rounded-lg transition"
    >
      {isGenerating ? '⚙️ ระบบอัจฉริยะ กำลังจัดกลุ่มเนื้อหา...' : '✨ Triage Content → Step 6'}
    </button>
  </form>

  {#if initialData}
    <div class="mt-8 border-t pt-6">
      <h3 class="font-semibold mb-3">📋 ผลลัพธ์ Triage</h3>

      {#if initialData.must_have?.length}
        <div class="mb-4">
          <div class="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">✅ Must Have ({initialData.must_have.length})</div>
          <div class="space-y-2">
            {#each initialData.must_have as item}
              <div class="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm">
                <div class="font-semibold">{item.title}</div>
                <div class="text-dark-900/70 dark:text-dark-100/70 mt-1">{item.content}</div>
                <div class="text-xs text-green-700 dark:text-green-400 mt-1">→ {item.why_must} (slide {item.slide_target})</div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if initialData.maybe?.length}
        <div class="mb-4">
          <div class="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2">⏸️ Maybe ({initialData.maybe.length})</div>
          <div class="space-y-2">
            {#each initialData.maybe as item}
              <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
                <div class="font-semibold">{item.title}</div>
                <div class="text-dark-900/70 dark:text-dark-100/70 mt-1">{item.content}</div>
                <div class="text-xs text-amber-700 dark:text-amber-400 mt-1">→ {item.placement}</div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if initialData.kill_it?.length}
        <div class="mb-4">
          <div class="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">🗑️ Kill It ({initialData.kill_it.length})</div>
          <div class="space-y-2">
            {#each initialData.kill_it as item}
              <div class="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm line-through opacity-70">
                <div class="font-semibold">{item.title}</div>
                <div class="text-dark-900/70 dark:text-dark-100/70 mt-1">{item.content}</div>
                <div class="text-xs text-red-700 dark:text-red-400 mt-1 not-italic">→ {item.reason}</div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if initialData.coverage_check}
        <div class="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-300">
          ✓ {initialData.coverage_check}
        </div>
      {/if}
    </div>
  {/if}
</div>
