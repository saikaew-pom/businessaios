<script lang="ts">
  /**
   * Step 2: Audience Profile
   * Select communication styles + concerns → Smart Engine builds persona card
   */
  let { project, initialData, presets, onGenerate, isGenerating }: {
    project: any;
    initialData: any;
    presets: any;
    onGenerate: (input: any) => void;
    isGenerating: boolean;
  } = $props();

  let audience_role = $state(initialData?.audience_role || '');
  let business_context = $state(initialData?.business_context || '');
  let communication_styles = $state<string[]>(initialData?.communication_styles || []);
  let audience_concerns = $state<string[]>(initialData?.audience_concerns || []);

  function toggleStyle(id: string) {
    communication_styles = communication_styles.includes(id)
      ? communication_styles.filter((x) => x !== id)
      : [...communication_styles, id];
  }

  function toggleConcern(id: string) {
    audience_concerns = audience_concerns.includes(id)
      ? audience_concerns.filter((x) => x !== id)
      : [...audience_concerns, id];
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!audience_role.trim() || communication_styles.length === 0) return;
    onGenerate({ audience_role, business_context, communication_styles, audience_concerns });
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold mb-2">👥 Audience Profile</h2>
    <p class="text-sm text-dark-900/60">ระบุผู้ฟัง — ระบบอัจฉริยะ จะสร้าง persona card และ handling strategy</p>
  </div>

  <form onsubmit={handleSubmit} class="space-y-5">
    <div>
      <label class="block text-sm font-medium text-dark-700 mb-1">ผู้ฟังคือใคร? *</label>
      <input
        type="text"
        bind:value={audience_role}
        required
        placeholder="เช่น CMO + Head of Sales, Board of Directors, ลูกค้า B2B"
        class="w-full px-4 py-2.5 border border-dark-200 rounded-lg focus:ring-2 focus:ring-primary-500"
      />
    </div>

    <div>
      <label class="block text-sm font-medium text-dark-700 mb-1">บริบทธุรกิจ (optional)</label>
      <textarea
        bind:value={business_context}
        rows="2"
        placeholder="เช่น SaaS startup 10 คน, กำลังจะ launch ผลิตภัณฑ์ใหม่"
        class="w-full px-4 py-2.5 border border-dark-200 rounded-lg"
      ></textarea>
    </div>

    <div>
      <label class="block text-sm font-medium text-dark-700 mb-2">Communication Style * (เลือกได้หลายข้อ)</label>
      <p class="text-xs text-dark-900/60 mb-3">ผู้ฟังของคุณคิดและตัดสินใจแบบไหน?</p>
      <div class="grid grid-cols-2 gap-3">
        {#if presets}
          {#each presets.communication_styles as style}
            <button
              type="button"
              onclick={() => toggleStyle(style.id)}
              class="text-left p-3 border-2 rounded-lg transition {communication_styles.includes(style.id) ? 'border-primary-500 bg-primary-50' : 'border-dark-200 hover:border-dark-300'}"
            >
              <div class="font-semibold text-sm">{style.name}</div>
              <div class="text-xs text-dark-900/60 mt-1">{style.description}</div>
              {#if communication_styles.includes(style.id)}
                <div class="text-xs text-primary-600 mt-1">✓ เลือกแล้ว</div>
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium text-dark-700 mb-2">Concerns ที่ผู้ฟังอาจกังวล (เลือกได้หลายข้อ)</label>
      <div class="flex flex-wrap gap-2">
        {#if presets}
          {#each presets.audience_concerns as concern}
            <button
              type="button"
              onclick={() => toggleConcern(concern.id)}
              class="px-3 py-2 border rounded-full text-sm transition {audience_concerns.includes(concern.id) ? 'border-primary-500 bg-primary-500 text-white' : 'border-dark-200 hover:border-dark-300'}"
            >
              {concern.name}
            </button>
          {/each}
        {/if}
      </div>
    </div>

    <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
      💡 ระบบอัจฉริยะ จะ:
      <ul class="mt-1 ml-4 list-disc text-xs">
        <li>สร้าง persona card (role, decision_style, motivations, fears)</li>
        <li>แนะนำ handling strategy (data_density, visual_density, opening approach)</li>
        <li>วางแผนว่าแต่ละ concern จะถูกตอบใน slide ไหน</li>
      </ul>
    </div>

    <button
      type="submit"
      disabled={isGenerating || !audience_role.trim() || communication_styles.length === 0}
      class="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-dark-300 text-white font-semibold py-3 rounded-lg transition"
    >
      {isGenerating ? '⚙️ ระบบอัจฉริยะ กำลังวิเคราะห์...' : '✨ Generate Persona Card → Step 3'}
    </button>
  </form>
</div>
