<script lang="ts">
  import ToolLayout from '$lib/ToolLayout.svelte';
  import BusinessContextFields from '$lib/BusinessContextFields.svelte';
  import { runBrandVoice, saveToolRun, updateToolRun, exportSavedTool, getExportUrl, promoteToolToProject } from '$lib/api';
  import { goto } from '$app/navigation';
  import { BRAND_VOICE_PRESETS, type BrandVoicePreset, BUSINESS_TYPES, TARGET_AUDIENCES } from '$lib/presets';

  let business_name = $state('');
  let business_type = $state('');
  let industry = $state('');
  let industryCustom = $state('');
  let target_audience_pre = $state<string[]>([]);
  let custom_audience_text = $state('');
  let brand_personality = $state('');
  let tone_keywords = $state('');
  let dos = $state('');
  let donts = $state('');

  let isGenerating = $state(false);
  let output = $state<any>(null);
  let error = $state('');
  let businessTypeError = $state('');
  let industryError = $state('');

  let saveId = $state<string | null>(null);
  let saveTitle = $state('');
  let isSaving = $state(false);
  let saveMsg = $state('');
  let isPromoting = $state(false);
  let promoteMsg = $state('');

  let selectedPreset = $state<string | null>(null);
  let showPresets = $state(true);

  function applyPreset(p: BrandVoicePreset) {
    selectedPreset = p.id;
    brand_personality = p.personality;
    tone_keywords = p.tone_keywords;
    dos = p.dos;
    donts = p.donts;
  }

  function clearPreset() {
    selectedPreset = null;
    brand_personality = '';
    tone_keywords = '';
    dos = '';
    donts = '';
  }

  // Auto-load from sessionStorage on page mount (when user clicks "Edit" on saved tool)
  $effect(() => {
    loadFromSessionStorage();
  });

  function loadFromSessionStorage() {
    try {
      const raw = sessionStorage.getItem('tool_edit_input');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.tool_type !== 'brand_voice') return;
      // Restore saveId so Save = UPDATE instead of INSERT
      if (data.save_id) saveId = data.save_id;
      const input = data.input || {};
      if (input.business_name) business_name = input.business_name;
      // business_type: handle both id (new saves) and label (legacy saves)
      if (input.business_type) {
        const byId = BUSINESS_TYPES.find(t => t.id === input.business_type);
        const byLabel = BUSINESS_TYPES.find(t => t.label === input.business_type);
        business_type = byId?.id || byLabel?.id || input.business_type;
      }
      if (input.industry) {
        if (input.industry === '__custom__' && input.industry_custom) {
          industry = '__custom__';
          industryCustom = input.industry_custom;
        } else {
          industry = input.industry;
          industryCustom = '';
        }
      }
      // target_audience: prefer array of ids (new) — fallback to parse joined string (legacy)
      if (Array.isArray(input.target_audience_ids)) {
        target_audience_pre = input.target_audience_ids.filter((id: string) =>
          TARGET_AUDIENCES.some(a => a.id === id)
        );
      } else if (Array.isArray(input.target_audience)) {
        target_audience_pre = input.target_audience
          .map((x: string) => {
            const byId = TARGET_AUDIENCES.find(a => a.id === x);
            if (byId) return byId.id;
            const byLabel = TARGET_AUDIENCES.find(a => a.label === x);
            return byLabel?.id || null;
          })
          .filter(Boolean);
      } else if (typeof input.target_audience === 'string' && input.target_audience) {
        const chunks = input.target_audience.split(';').map((s: string) => s.trim()).filter(Boolean);
        const ids: string[] = [];
        let leftoverText = '';
        for (const chunk of chunks) {
          // Try to find by exact label, then progressively strip trailing (...) descriptions
          let cur = chunk;
          let matched = false;
          for (let i = 0; i < 5; i++) {
            const byLabel = TARGET_AUDIENCES.find(a => a.label === cur);
            if (byLabel) { ids.push(byLabel.id); matched = true; break; }
            const stripped = cur.replace(/\s*\([^)]*\)\s*$/, '').trim();
            if (stripped === cur) break; // nothing more to strip
            cur = stripped;
          }
          if (!matched) leftoverText += (leftoverText ? '; ' : '') + chunk;
        }
        target_audience_pre = ids;
        if (leftoverText && !custom_audience_text) custom_audience_text = leftoverText;
      }
      if (input.custom_audience_text) custom_audience_text = input.custom_audience_text;
      if (input.brand_personality) brand_personality = input.brand_personality;
      if (input.tone_keywords) tone_keywords = input.tone_keywords;
      if (input.dos) dos = input.dos;
      if (input.donts) donts = input.donts;
      error = '✏️ แก้ไขจาก saved tool — กด "Generate" เพื่อรันใหม่';
      sessionStorage.removeItem('tool_edit_input');
    } catch (err) {
      console.error('Failed to load from sessionStorage:', err);
    }
  }

  // Compute resolved values for the API
  let resolvedBusinessType = $derived(
    BUSINESS_TYPES.find(t => t.id === business_type)?.label ?? business_type
  );
  let resolvedIndustry = $derived(
    industry === '__custom__' ? industryCustom : industry
  );
  let resolvedTargetAudience = $derived.by(() => {
    const parts: string[] = [];
    for (const id of target_audience_pre) {
      const a = TARGET_AUDIENCES.find(x => x.id === id);
      if (a) parts.push(`${a.label} (${a.description})`);
    }
    if (custom_audience_text.trim()) parts.push(custom_audience_text.trim());
    return parts.join('; ');
  });

  async function handleGenerate() {

    businessTypeError = '';
    industryError = '';
    if (!business_name) {
      error = 'กรุณาใส่ชื่อธุรกิจ';
      return;
    }
    if (!business_type) {
      businessTypeError = 'กรุณาเลือกประเภทธุรกิจ';
      error = 'กรุณาเลือกประเภทธุรกิจ';
      return;
    }
    if (!industry || (industry === '__custom__' && !industryCustom.trim())) {
      industryError = 'กรุณาเลือกอุตสาหกรรม';
      error = 'กรุณาเลือกอุตสาหกรรม';
      return;
    }
    error = '';
    isGenerating = true;
    output = null;
    // Don't reset saveId — that would break Edit flow (Save = UPDATE)
    try {
      const res = await runBrandVoice({
        business_name,
        business_type: resolvedBusinessType,
        industry: resolvedIndustry,
        target_audience: resolvedTargetAudience,
        brand_personality, tone_keywords, dos, donts
      });
      output = res.output;
    } catch (err: any) {
      error = err.message || 'Smart Engine error';
    } finally {
      isGenerating = false;
    }
  }

  async function handleSave() {
    if (!output) return;
    isSaving = true;
    saveMsg = '';
    try {
      const title = saveTitle.trim() || `Brand Voice — ${business_name} ${new Date().toLocaleDateString('th-TH')}`;
      const payload = {
        // canonical state (used for Edit re-fill)
        business_name,
        business_type,                              // id e.g. "education"
        industry: industry === '__custom__' ? '__custom__' : industry,
        industry_custom: industry === '__custom__' ? industryCustom : '',
        target_audience_ids: [...target_audience_pre],  // ids array
        custom_audience_text: custom_audience_text.trim(),
        brand_personality, tone_keywords, dos, donts,
        // resolved (for display/legacy compat)
        business_type_resolved: resolvedBusinessType,
        industry_resolved: resolvedIndustry,
        target_audience_resolved: resolvedTargetAudience,
      };
      if (saveId) {
        await updateToolRun(saveId, { input: payload, output });
        saveMsg = '✓ อัปเดตเรียบร้อย';
      } else {
        const res = await saveToolRun('brand_voice', payload, output, title);
        saveId = res.id;
        saveMsg = '✓ บันทึกเรียบร้อย';
      }
    } catch (err: any) {
      saveMsg = '✗ ' + err.message;
    } finally {
      isSaving = false;
    }
  }

  async function handleExport(format: 'md' | 'json') {
    if (!saveId) { await handleSave(); }
    if (!saveId) return;
    try {
      const res = await exportSavedTool(saveId, format);
      const url = getExportUrl(res.export_id);
      const a = document.createElement('a');
      a.href = url; a.download = `brand-voice.${format}`; a.target = '_blank'; a.click();
    } catch (err: any) { alert(err.message); }
  }

  async function handlePromote() {
    if (!saveId) { await handleSave(); }
    if (!saveId) return;
    isPromoting = true;
    promoteMsg = '';
    try {
      const res = await promoteToolToProject(saveId);
      promoteMsg = '✓ บันทึกเป็นโปรเจกต์แล้ว';
      setTimeout(() => goto(`/dashboard?new_project=${res.project_id}`), 800);
    } catch (err: any) {
      promoteMsg = '✗ ' + err.message;
    } finally {
      isPromoting = false;
    }
  }
</script>

<ToolLayout
  title="Brand Voice Generator"
  subtitle="สร้าง Brand Voice & Tone ที่จำง่าย ต่างจากคู่แข่ง ใช้ได้จริงทุกแพลตฟอร์ม — ด้วย SPICE Framework"
  icon="🎙️"
  color="purple"
>
  {#if !output}
    <div class="space-y-5">
      <!-- Preset picker -->
      <div class="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/40 dark:to-blue-950/40 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
        <div class="flex items-center justify-between mb-2">
          <div>
            <div class="font-semibold text-purple-900 dark:text-purple-200">🎯 เริ่มจาก Preset (12 Brand Archetypes)</div>
            <div class="text-xs text-purple-700 dark:text-purple-400">คลิกเพื่อเติมข้อมูลอัตโนมัติ แล้วแก้ต่อได้</div>
          </div>
          {#if selectedPreset}
            <button type="button" onclick={clearPreset} class="text-xs text-purple-700 dark:text-purple-400 hover:underline">ล้างค่า</button>
          {/if}
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {#each BRAND_VOICE_PRESETS as preset}
            <button
              type="button"
              onclick={() => applyPreset(preset)}
              class="text-left p-3 rounded-lg border-2 transition {selectedPreset === preset.id ? 'border-purple-500 bg-white dark:bg-dark-800 shadow-sm' : 'border-purple-200 dark:border-purple-800 bg-white/50 dark:bg-dark-800/50 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-white dark:hover:bg-dark-800'}"
              title={preset.description}
            >
              <div class="text-2xl mb-1">{preset.icon}</div>
              <div class="text-sm font-semibold text-dark-900 dark:text-dark-50">{preset.label}</div>
              <div class="text-xs text-dark-900/60 dark:text-dark-100/60 leading-tight mt-0.5">{preset.archetype}</div>
            </button>
          {/each}
        </div>
        {#if selectedPreset}
          {@const p = BRAND_VOICE_PRESETS.find(x => x.id === selectedPreset)}
          <div class="mt-3 p-3 bg-white dark:bg-dark-800 rounded-lg border border-purple-200 dark:border-purple-800 text-xs">
            <div class="font-semibold text-purple-900 dark:text-purple-200 mb-1">📌 {p?.label} ใช้กับ:</div>
            <div class="text-dark-900/70 dark:text-dark-100/70">{p?.description}</div>
          </div>
        {/if}
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">ชื่อธุรกิจ *</label>
        <input bind:value={business_name} type="text" placeholder="เช่น ร้านกาแฟใบไม้" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-dark-800" />
      </div>

      <BusinessContextFields
        bind:businessType={business_type}
        bind:industry={industry}
        bind:industryCustom={industryCustom}
        bind:targetAudiences={target_audience_pre}
        bind:customAudience={custom_audience_text}
        {businessTypeError}
        {industryError}
      />

      <details class="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
        <summary class="font-semibold text-purple-900 dark:text-purple-200 cursor-pointer">⚙️ ตั้งค่าเพิ่มเติม (ไม่บังคับ)</summary>
        <div class="space-y-3 mt-4">
          <div>
            <label class="block text-sm font-medium mb-1">บุคลิกแบรนด์ที่อยากเป็น</label>
            <input bind:value={brand_personality} type="text" placeholder="เช่น เพื่อนซื่อสัตย์ / ที่ปรึกษา / ผู้เชี่ยวชาญ" class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 dark:bg-dark-800" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Tone keywords</label>
            <input bind:value={tone_keywords} type="text" placeholder="เช่น ตรง อบอุ่น ตลก เป็นกันเอง" class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 dark:bg-dark-800" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">สิ่งที่อยากทำ (Do)</label>
            <textarea bind:value={dos} rows="2" placeholder="เช่น ใช้ภาษาวัยรุ่น, ตอบคำถามลูกค้าเร็ว, โพสต์รูป lifestyle" class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 dark:bg-dark-800"></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">สิ่งที่ไม่อยากทำ (Don't)</label>
            <textarea bind:value={donts} rows="2" placeholder="เช่น พูดทางการเกินไป, ใช้คำว่า 'ดีที่สุด', ขายแรงๆ" class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 dark:bg-dark-800"></textarea>
          </div>
        </div>
      </details>

      {#if error}
        <div class="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">{error}</div>
      {/if}

      <div class="pt-4 flex items-center justify-end border-t border-dark-100 dark:border-dark-700">
        <button onclick={handleGenerate} disabled={isGenerating} class="btn-primary disabled:opacity-50">
          {isGenerating ? '⏳ ระบบอัจฉริยะ กำลังคิด...' : '🎙️ สร้าง Brand Voice'}
        </button>
      </div>
    </div>
  {:else}
    <div class="space-y-5">
      <div class="bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-2xl p-6">
        <div class="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">Voice Summary</div>
        <div class="text-xl font-semibold">{output.voice_summary || '—'}</div>
      </div>

      {#if output.personality_archetype}
        <div class="bg-white dark:bg-dark-800 border border-dark-100 dark:border-dark-700 rounded-xl p-4">
          <div class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-1">Personality Archetype</div>
          <div class="text-lg font-semibold">{output.personality_archetype}</div>
        </div>
      {/if}

      {#if output.tone}
        <div class="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
          <div class="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider mb-1">Tone</div>
          <div class="font-semibold">{output.tone}</div>
        </div>
      {/if}

      {#if output.voice_attributes?.length}
        <div class="bg-white dark:bg-dark-800 border border-dark-100 dark:border-dark-700 rounded-xl p-5">
          <div class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-3">🎯 Voice Attributes — หมายถึง / ไม่ได้หมายถึง</div>
          <div class="space-y-3">
            {#each output.voice_attributes as attr}
              <div class="bg-dark-50 dark:bg-dark-900 rounded-lg p-3">
                <div class="font-semibold text-sm mb-1.5">{attr.attribute}</div>
                <div class="grid sm:grid-cols-2 gap-2 text-xs">
                  <div><span class="font-semibold text-green-700 dark:text-green-400">✓ หมายถึง:</span> {attr.means}</div>
                  <div><span class="font-semibold text-red-700 dark:text-red-400">✗ ไม่ได้หมายถึง:</span> {attr.does_not_mean}</div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if output.voice_dimensions}
        <div class="bg-white dark:bg-dark-800 border border-dark-100 dark:border-dark-700 rounded-xl p-5">
          <div class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-3">📊 Voice Dimensions</div>
          <div class="space-y-3">
            {#each Object.entries(output.voice_dimensions) as [k, v]}
              {@const score = Number(v)}
              <div>
                <div class="flex justify-between text-sm mb-1">
                  <span class="font-medium capitalize">{k.replace(/_/g, ' ')}</span>
                  <span class="text-primary-600 dark:text-primary-400 font-semibold">{score}/10</span>
                </div>
                <div class="h-2 bg-dark-100 dark:bg-dark-700 rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-purple-500 to-purple-700" style="width: {score * 10}%"></div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if output.do_list || output.dont_list}
        <div class="grid sm:grid-cols-2 gap-3">
          {#if output.do_list?.length}
            <div class="bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-700 rounded-xl p-4">
              <div class="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider mb-2">✅ Do</div>
              <ul class="space-y-1 text-sm">{#each output.do_list as d}<li class="flex gap-2"><span class="text-green-600 dark:text-green-400">✓</span>{d}</li>{/each}</ul>
            </div>
          {/if}
          {#if output.dont_list?.length}
            <div class="bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-700 rounded-xl p-4">
              <div class="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider mb-2">❌ Don't</div>
              <ul class="space-y-1 text-sm">{#each output.dont_list as d}<li class="flex gap-2"><span class="text-red-600 dark:text-red-400">✗</span>{d}</li>{/each}</ul>
            </div>
          {/if}
        </div>
      {/if}

      {#if output.vocabulary}
        <div class="bg-white dark:bg-dark-800 border border-dark-100 dark:border-dark-700 rounded-xl p-5">
          <div class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-3">📚 Vocabulary</div>
          <div class="grid sm:grid-cols-2 gap-3">
            {#if output.vocabulary.use_words?.length}
              <div>
                <div class="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">✅ คำที่ใช้บ่อย</div>
                <div class="flex flex-wrap gap-1.5">{#each output.vocabulary.use_words as w}<span class="px-2.5 py-1 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 text-xs rounded-full">{w}</span>{/each}</div>
              </div>
            {/if}
            {#if output.vocabulary.avoid_words?.length}
              <div>
                <div class="text-xs font-semibold text-red-700 dark:text-red-400 mb-2">❌ คำที่ห้ามใช้</div>
                <div class="flex flex-wrap gap-1.5">{#each output.vocabulary.avoid_words as w}<span class="px-2.5 py-1 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 text-xs rounded-full line-through">{w}</span>{/each}</div>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      {#if output.sample_phrases}
        <div class="bg-white dark:bg-dark-800 border border-dark-100 dark:border-dark-700 rounded-xl p-5">
          <div class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-3">💬 Sample Phrases</div>
          <div class="space-y-3">
            {#each Object.entries(output.sample_phrases) as [context, phrases]}
              {#if Array.isArray(phrases) && phrases.length}
                <div>
                  <div class="text-xs font-semibold text-dark-900/70 dark:text-dark-100/70 capitalize mb-1.5">📌 {context}</div>
                  <div class="space-y-1">
                    {#each phrases as p}<div class="italic text-sm text-dark-900/90 dark:text-dark-100/90 pl-3 border-l-2 border-primary-300 dark:border-primary-700">"{p}"</div>{/each}
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {/if}

      {#if output.content_examples}
        <div class="bg-white dark:bg-dark-800 border border-dark-100 dark:border-dark-700 rounded-xl p-5">
          <div class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-3">📝 Content Examples</div>
          <div class="space-y-3">
            {#each Object.entries(output.content_examples) as [platform, content]}
              <div class="bg-dark-50 dark:bg-dark-900 rounded-lg p-3">
                <div class="text-xs font-semibold text-primary-600 dark:text-primary-400 mb-1 capitalize">{platform.replace(/_/g, ' ')}</div>
                <div class="text-sm whitespace-pre-line">{content}</div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if output.self_check_list?.length}
        <div class="bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-600 rounded-xl p-4">
          <div class="text-xs font-bold text-dark-900/70 dark:text-dark-100/70 uppercase tracking-wider mb-2">✅ Checklist ก่อนโพสต์</div>
          <ul class="space-y-1 text-sm">
            {#each output.self_check_list as item}<li class="flex gap-2"><input type="checkbox" class="mt-1" /><span>{item}</span></li>{/each}
          </ul>
        </div>
      {/if}

      <div class="flex items-center justify-between pt-4 border-t border-dark-100 dark:border-dark-700 flex-wrap gap-2">
        <button onclick={() => { output = null; error = ''; saveId = null; saveMsg = ''; }} class="text-sm text-dark-900/60 dark:text-dark-100/60 hover:text-primary-600 dark:hover:text-primary-400">← สร้างใหม่</button>
        <div class="flex items-center gap-2 flex-wrap">
          {#if saveMsg}
            <span class="text-xs {saveMsg.startsWith('✓') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}">{saveMsg}</span>
          {/if}
          <input type="text" bind:value={saveTitle} placeholder="ตั้งชื่อ (ไม่บังคับ)" class="text-xs px-2 py-1.5 rounded border border-dark-200 dark:border-dark-600 w-40 dark:bg-dark-800" />
          <button onclick={handleSave} disabled={isSaving} class="text-sm btn-secondary disabled:opacity-50">
            {isSaving ? '...' : (saveId ? '✓ บันทึกแล้ว' : '💾 บันทึก')}
          </button>
          <button onclick={handlePromote} disabled={isPromoting} class="text-sm btn-secondary disabled:opacity-50" title="บันทึกเป็นโปรเจกต์แยก">
            {isPromoting ? '...' : '💼 เป็นโปรเจกต์'}
          </button>
          <button onclick={() => handleExport('md')} class="text-sm btn-secondary">📥 .md</button>
          <button onclick={() => handleExport('json')} class="text-sm btn-secondary">📥 .json</button>
        </div>
      </div>
      {#if promoteMsg}
        <div class="mt-2 text-xs {promoteMsg.startsWith('✓') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}">{promoteMsg}</div>
      {/if}
    </div>
  {/if}
</ToolLayout>
