<script lang="ts">
  /**
   * Step 3: ATR (Audience Transformation Roadmap) Canvas
   * 4×2 grid: Know/Believe/Feel/Do × Before/After
   * Smart Engine proposes → user edits → Smart Engine computes content gap
   */
  let { project, initialData, presets, step2Data, onGenerate, isGenerating }: {
    project: any;
    initialData: any;
    presets: any;
    step2Data: any;
    onGenerate: (input: any) => void;
    isGenerating: boolean;
  } = $props();

  // Initialize from previous data or defaults
  let summary = $state(initialData?.summary || '');

  let before = $state({
    know: initialData?.before?.know || '',
    believe: initialData?.before?.believe || '',
    feel: initialData?.before?.feel || '',
    do: initialData?.before?.do || '',
  });

  let after = $state({
    know: initialData?.after?.know || '',
    believe: initialData?.after?.believe || '',
    feel: initialData?.after?.feel || '',
    do: initialData?.after?.do || '',
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!summary.trim()) return;
    const input: any = {
      summary,
      before,
      after,
      audience_persona: step2Data?.persona_card,
    };
    onGenerate(input);
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold mb-2">🎯 ATR Canvas</h2>
    <p class="text-sm text-dark-900/60">Audience Transformation Roadmap (Phil Waknell) — ระบุว่าผู้ฟังจะเปลี่ยนไปอย่างไร</p>
  </div>

  <form onsubmit={handleSubmit} class="space-y-5">
    <div>
      <label class="block text-sm font-medium text-dark-700 mb-1">เนื้อหาโดยย่อ *</label>
      <textarea
        bind:value={summary}
        required
        rows="2"
        placeholder="สรุปสั้นๆ ว่า presentation นี้จะพูดเรื่องอะไร"
        class="w-full px-4 py-2.5 border border-dark-200 rounded-lg"
      ></textarea>
    </div>

    <!-- ATR Grid -->
    <div class="border-2 border-dark-200 rounded-xl overflow-hidden">
      <!-- Header row -->
      <div class="grid grid-cols-[100px_1fr_1fr] bg-dark-100 border-b border-dark-200">
        <div class="px-3 py-2 text-xs font-bold text-dark-900/60">มิติ</div>
        <div class="px-3 py-2 text-sm font-bold bg-amber-50 text-amber-900 text-center border-l border-dark-200">BEFORE (ก่อนฟัง)</div>
        <div class="px-3 py-2 text-sm font-bold bg-green-50 text-green-900 text-center border-l border-dark-200">AFTER (หลังฟัง)</div>
      </div>

      <!-- KNOW row -->
      <div class="grid grid-cols-[100px_1fr_1fr] border-b border-dark-200">
        <div class="px-3 py-2 text-xs font-semibold bg-dark-50 flex items-center">🧠 KNOW</div>
        <div class="border-l border-dark-200 p-2">
          <textarea bind:value={before.know} rows="2" placeholder="ผู้ฟังรู้อะไรแล้ว..." class="w-full text-sm px-2 py-1.5 border-0 bg-transparent focus:ring-1 focus:ring-primary-400 rounded"></textarea>
        </div>
        <div class="border-l border-dark-200 p-2">
          <textarea bind:value={after.know} rows="2" placeholder="อยากให้รู้อะไร..." class="w-full text-sm px-2 py-1.5 border-0 bg-transparent focus:ring-1 focus:ring-primary-400 rounded"></textarea>
        </div>
      </div>

      <!-- BELIEVE row -->
      <div class="grid grid-cols-[100px_1fr_1fr] border-b border-dark-200">
        <div class="px-3 py-2 text-xs font-semibold bg-dark-50 flex items-center">💭 BELIEVE</div>
        <div class="border-l border-dark-200 p-2">
          <textarea bind:value={before.believe} rows="2" placeholder="ผู้ฟังเชื่อ/คิดอย่างไร..." class="w-full text-sm px-2 py-1.5 border-0 bg-transparent focus:ring-1 focus:ring-primary-400 rounded"></textarea>
        </div>
        <div class="border-l border-dark-200 p-2">
          <textarea bind:value={after.believe} rows="2" placeholder="อยากให้เชื่ออะไร..." class="w-full text-sm px-2 py-1.5 border-0 bg-transparent focus:ring-1 focus:ring-primary-400 rounded"></textarea>
        </div>
      </div>

      <!-- FEEL row -->
      <div class="grid grid-cols-[100px_1fr_1fr] border-b border-dark-200">
        <div class="px-3 py-2 text-xs font-semibold bg-dark-50 flex items-center">❤️ FEEL</div>
        <div class="border-l border-dark-200 p-2">
          <textarea bind:value={before.feel} rows="2" placeholder="ผู้ฟังรู้สึกอย่างไร..." class="w-full text-sm px-2 py-1.5 border-0 bg-transparent focus:ring-1 focus:ring-primary-400 rounded"></textarea>
        </div>
        <div class="border-l border-dark-200 p-2">
          <textarea bind:value={after.feel} rows="2" placeholder="อยากให้รู้สึกอย่างไร..." class="w-full text-sm px-2 py-1.5 border-0 bg-transparent focus:ring-1 focus:ring-primary-400 rounded"></textarea>
        </div>
      </div>

      <!-- DO row -->
      <div class="grid grid-cols-[100px_1fr_1fr]">
        <div class="px-3 py-2 text-xs font-semibold bg-dark-50 flex items-center">🎯 DO</div>
        <div class="border-l border-dark-200 p-2">
          <textarea bind:value={before.do} rows="2" placeholder="ผู้ฟังทำอะไรอยู่..." class="w-full text-sm px-2 py-1.5 border-0 bg-transparent focus:ring-1 focus:ring-primary-400 rounded"></textarea>
        </div>
        <div class="border-l border-dark-200 p-2">
          <textarea bind:value={after.do} rows="2" placeholder="อยากให้ทำอะไร (action)..." class="w-full text-sm px-2 py-1.5 border-0 bg-transparent focus:ring-1 focus:ring-primary-400 rounded"></textarea>
        </div>
      </div>
    </div>

    <div class="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-800">
      💡 "พื้นที่ตรงกลาง (ช่องว่างระหว่าง Before/After) = <strong>เนื้อหาที่ต้องนำเสนอ</strong>"
      <div class="text-xs mt-1">ระบบอัจฉริยะ จะวิเคราะห์ gap นี้และสร้าง content_gap เพื่อใช้ใน Step 5 (Triage) และ Step 6 (Outline)</div>
    </div>

    <button
      type="submit"
      disabled={isGenerating || !summary.trim() || !before.know || !after.do}
      class="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-dark-300 text-white font-semibold py-3 rounded-lg transition"
    >
      {isGenerating ? '⚙️ ระบบอัจฉริยะ กำลังวิเคราะห์ ATR...' : '✨ Generate ATR + Content Gap → Step 4'}
    </button>
  </form>
</div>
