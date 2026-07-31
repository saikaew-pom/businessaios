<script lang="ts">
  /**
   * Step 1: Quick Brief
   * Configure title, objective, slides, time
   * Free — no ระบบอัจฉริยะ
   */
  let { project, initialData, presets, onGenerate, onUpdate, isGenerating }: {
    project: any;
    initialData: any;
    presets: any;
    onGenerate: (input: any) => void;
    onUpdate: (data: any) => void;
    isGenerating: boolean;
  } = $props();

  let title = $state(project?.title || '');
  let description = $state(initialData?.description || '');
  let target_slides = $state(project?.target_slides || 10);
  let time_minutes = $state(project?.time_minutes || 15);
  let color_theme = $state(project?.color_theme || 'business_blue');
  let language = $state(project?.language || 'th');

  let selectedObjective = $derived(presets?.objectives?.find((o: any) => o.id === project?.objective));

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!title.trim()) return;
    onUpdate({ title, target_slides, time_minutes, color_theme, language });
    onGenerate({ title, description, target_slides, time_minutes, color_theme, language });
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold mb-2">📝 Quick Brief</h2>
    <p class="text-sm text-dark-900/60 dark:text-dark-100/60">ตั้งค่าพื้นฐาน — objective จะกำหนด framework ที่ ระบบอัจฉริยะ ใช้</p>
  </div>

  <form onsubmit={handleSubmit} class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-dark-700 dark:text-dark-200 mb-1">หัวข้อ Presentation *</label>
      <input
        type="text"
        bind:value={title}
        required
        placeholder="เช่น Q3 Marketing Plan, Series A Pitch, Brand Story"
        class="w-full px-4 py-3 border border-dark-200 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
      />
    </div>

    <div>
      <label class="block text-sm font-medium text-dark-700 dark:text-dark-200 mb-1">คำอธิบายเพิ่มเติม (optional)</label>
      <textarea
        bind:value={description}
        rows="3"
        placeholder="อธิบายสั้นๆ ว่า presentation นี้เกี่ยวกับอะไร จุดประสงค์หลักคืออะไร"
        class="w-full px-4 py-2.5 border border-dark-200 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500"
      ></textarea>
    </div>

    {#if selectedObjective}
      <div class="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-2xl">{selectedObjective.icon}</span>
          <div>
            <div class="font-semibold text-blue-900 dark:text-blue-200">{selectedObjective.name}</div>
            <div class="text-xs text-blue-700 dark:text-blue-400">Framework: {selectedObjective.framework_name}</div>
          </div>
        </div>
        <p class="text-sm text-blue-800 dark:text-blue-300">{selectedObjective.description}</p>
        <div class="mt-2 flex flex-wrap gap-1">
          {#each selectedObjective.best_for as use}
            <span class="text-xs bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded">{use}</span>
          {/each}
        </div>
      </div>
    {/if}

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-dark-700 dark:text-dark-200 mb-1">จำนวน Slides</label>
        <input type="number" bind:value={target_slides} min="5" max="25" class="w-full px-4 py-2.5 border border-dark-200 dark:border-dark-600 rounded-lg" />
      </div>
      <div>
        <label class="block text-sm font-medium text-dark-700 dark:text-dark-200 mb-1">เวลา (นาที)</label>
        <input type="number" bind:value={time_minutes} min="3" max="60" class="w-full px-4 py-2.5 border border-dark-200 dark:border-dark-600 rounded-lg" />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-dark-700 dark:text-dark-200 mb-1">Color Theme</label>
        <select bind:value={color_theme} class="w-full px-4 py-2.5 border border-dark-200 dark:border-dark-600 rounded-lg">
          {#if presets}
            {#each presets.color_themes as theme}
              <option value={theme.id}>{theme.name}</option>
            {/each}
          {/if}
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-dark-700 dark:text-dark-200 mb-1">ภาษา</label>
        <select bind:value={language} class="w-full px-4 py-2.5 border border-dark-200 dark:border-dark-600 rounded-lg">
          <option value="th">ไทย</option>
          <option value="en">English</option>
        </select>
      </div>
    </div>

    <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300">
      💡 <strong>Tip:</strong> Objective ที่เลือกจะกำหนด framework + structure:
      <ul class="mt-1 ml-4 list-disc text-xs">
        <li><strong>Informative</strong> → SCQA + Minto Pyramid (Status report, training, brief)</li>
        <li><strong>Persuasive</strong> → 5M Mission Flow (Pitch, budget request, idea)</li>
        <li><strong>Story</strong> → Pop-Up Pitch (TED Talk, keynote, 10 slides fixed)</li>
      </ul>
    </div>

    <button
      type="submit"
      disabled={isGenerating || !title.trim()}
      class="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-dark-300 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
    >
      {#if isGenerating}
        <span class="animate-spin">⚙️</span> Saving...
      {:else}
        ✅ บันทึก → ไป Step 2
      {/if}
    </button>
  </form>
</div>
