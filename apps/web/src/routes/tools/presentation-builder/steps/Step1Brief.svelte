<script lang="ts">
  /**
   * Step 1: Quick Brief
   * Configure title, objective, slides, time
   * Free — no ระบบอัจฉริยะ (ยกเว้นปุ่ม autofill ซึ่งเป็น AI แยกต่างหาก)
   */
  import { autofillPresentationStep } from '$lib/api';

  let { project, initialData, presets, onGenerate, onUpdate, isGenerating, hasLaterSteps, onCreditsUpdated }: {
    project: any;
    initialData: any;
    presets: any;
    onGenerate: (input: any) => void;
    onUpdate: (data: any) => Promise<any>;
    isGenerating: boolean;
    hasLaterSteps?: boolean;
    onCreditsUpdated?: (remaining: number) => void;
  } = $props();

  let title = $state(project?.title || '');
  let description = $state(initialData?.description || '');
  let objective = $state(project?.objective || 'informative');
  let target_slides = $state(project?.target_slides || 10);
  let time_minutes = $state(project?.time_minutes || 15);
  let color_theme = $state(project?.color_theme || 'business_blue');
  let language = $state(project?.language || 'th');

  let isAutofilling = $state(false);
  let autofillError = $state('');

  let selectedObjective = $derived(presets?.objectives?.find((o: any) => o.id === objective));

  async function handleAutofill() {
    if (!title.trim() || isAutofilling) return;
    isAutofilling = true;
    autofillError = '';
    try {
      const res = await autofillPresentationStep(project.id, 1, { title, objective: objective || undefined });
      const s = res.suggestion || {};
      if (s.objective) objective = s.objective;
      if (s.description) description = s.description;
      if (s.target_slides) target_slides = s.target_slides;
      if (s.time_minutes) time_minutes = s.time_minutes;
      onCreditsUpdated?.(res.meta.credits_remaining);
    } catch (err: any) {
      autofillError = err.message || 'AI ช่วยกรอกไม่สำเร็จ';
    } finally {
      isAutofilling = false;
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!title.trim()) return;
    if (objective !== project?.objective && hasLaterSteps) {
      const confirmed = confirm(
        'การเปลี่ยน Objective จะเปลี่ยน Framework ที่ใช้ด้วย — เนื้อหาที่สร้างไว้แล้วใน Step อื่น (2 เป็นต้นไป) จะยังอยู่ แต่จะไม่ตรงกับ Framework ใหม่จนกว่าจะ Regenerate ใหม่ ต้องการดำเนินการต่อหรือไม่?'
      );
      if (!confirmed) return;
    }
    // Must complete BEFORE onGenerate fires: the generate call re-reads the
    // project row server-side to compute framework_variant for this (and
    // every later) step. Firing both requests without ordering them races
    // two separate HTTP round trips against the same row — if the generate
    // request's read lands before this update's write commits, it silently
    // computes the framework from the OLD objective with no error surfaced.
    await onUpdate({ title, objective, target_slides, time_minutes, color_theme, language });
    onGenerate({ title, description, objective, target_slides, time_minutes, color_theme, language });
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
      <button
        type="button"
        onclick={handleAutofill}
        disabled={!title.trim() || isAutofilling}
        class="mt-2 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isAutofilling ? '⏳ AI กำลังช่วยกรอก...' : '✨ ให้ AI ช่วยกรอกที่เหลือจากหัวข้อนี้'}
      </button>
      {#if autofillError}
        <p class="mt-1 text-xs text-red-600 dark:text-red-400">{autofillError}</p>
      {/if}
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

    <div>
      <label class="block text-sm font-medium text-dark-700 dark:text-dark-200 mb-1">Objective *</label>
      <select
        bind:value={objective}
        class="w-full px-4 py-2.5 border border-dark-200 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500"
      >
        {#if presets}
          {#each presets.objectives as o}
            <option value={o.id}>{o.icon} {o.name}</option>
          {/each}
        {/if}
      </select>
      {#if objective !== project?.objective && hasLaterSteps}
        <p class="mt-1 text-xs text-amber-600 dark:text-amber-400">⚠️ มี Step อื่นที่สร้างไว้แล้ว — เปลี่ยน Objective จะเปลี่ยน Framework ด้วย ต้อง Regenerate step ที่เหลือใหม่</p>
      {/if}
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
