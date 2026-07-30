<script lang="ts">
  import ToolLayout from '$lib/ToolLayout.svelte';
  import CanvasPdfButton from '$lib/CanvasPdfButton.svelte';
  import BusinessContextFields from '$lib/BusinessContextFields.svelte';
  import { runHookLibrary, saveToolRun, updateToolRun, exportSavedTool, getExportUrl, promoteToolToProject, listSavedTools } from '$lib/api';
  import { goto } from '$app/navigation';
  import { BUSINESS_TYPES, TARGET_AUDIENCES, PLATFORMS, HOOK_CATEGORIES, CAMPAIGN_GOALS, BRAND_VOICE_OPTIONS } from '$lib/presets';
  import { PUBLIC_API_URL } from '$env/static/public';

  let business_name = $state('');
  let business_type = $state('');
  let industry = $state('');
  let industryCustom = $state('');
  let location = $state('');
  let target_audience_pre = $state<string[]>([]);
  let custom_audience_text = $state('');
  let differentiation = $state('');
  let price_range = $state('');

  let product_description = $state('');
  let product_features = $state('');

  let primary_platform = $state('');
  let brand_voice = $state('');
  let campaign_goal = $state('');
  let top_hook_style = $state('');
  let user_notes = $state('');

  let offer_saves = $state<any[]>([]);
  let persona_saves = $state<any[]>([]);
  let selectedOfferId = $state('');
  let selectedPersonaId = $state('');

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

  $effect(() => {
    listSavedTools({ tool_type: 'million_dollar_offer' }).then(s => { offer_saves = s || []; }).catch(() => {});
    listSavedTools({ tool_type: 'persona_builder' }).then(s => { persona_saves = s || []; }).catch(() => {});
  });

  function buildOfferContext(): string {
    if (!selectedOfferId) return '';
    const s = offer_saves.find(x => x.id === selectedOfferId);
    if (!s) return '';
    return `Offer: ${s.output?.offer_name?.full_name || '-'} | Price: ${s.output?.pricing?.recommended_price || '-'}`;
  }

  function buildPersonaContext(): string {
    if (!selectedPersonaId) return '';
    const s = persona_saves.find(x => x.id === selectedPersonaId);
    if (!s) return '';
    return `Personas: ${(s.output?.personas || []).slice(0, 1).map((p: any) => p.name).join(', ')}`;
  }

  $effect(() => {
    try {
      const raw = sessionStorage.getItem('tool_edit_input');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.tool_type !== 'hook_library') return;
      if (data.save_id) saveId = data.save_id;
      const input = data.input || {};
      if (input.business_name) business_name = input.business_name;
      if (input.business_type) {
        const byId = BUSINESS_TYPES.find(t => t.id === input.business_type);
        business_type = byId?.id || input.business_type;
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
      if (input.location) location = input.location;
      if (input.differentiation) differentiation = input.differentiation;
      if (input.price_range) price_range = input.price_range;
      if (input.product_description) product_description = input.product_description;
      if (input.product_features) product_features = input.product_features;
      if (input.primary_platform) primary_platform = input.primary_platform;
      if (input.brand_voice) brand_voice = input.brand_voice;
      if (input.campaign_goal) campaign_goal = input.campaign_goal;
      if (input.top_hook_style) top_hook_style = input.top_hook_style;
      if (input.user_notes) user_notes = input.user_notes;
      if (Array.isArray(input.target_audience_ids)) {
        target_audience_pre = input.target_audience_ids.filter((id: string) =>
          TARGET_AUDIENCES.some(a => a.id === id)
        );
      }
      sessionStorage.removeItem('tool_edit_input');
      error = '✏️ แก้ไขจาก saved tool — กด "Generate" เพื่อรันใหม่';
    } catch (err) {}
  });

  let resolvedBusinessType = $derived(BUSINESS_TYPES.find(t => t.id === business_type)?.label ?? business_type);
  let resolvedIndustry = $derived(industry === '__custom__' ? industryCustom : industry);
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
    if (!business_name) { error = 'กรุณาใส่ชื่อธุรกิจ'; return; }
    if (!business_type) { businessTypeError = 'กรุณาเลือกประเภทธุรกิจ'; error = 'กรุณาเลือกประเภทธุรกิจ'; return; }
    if (!industry || (industry === '__custom__' && !industryCustom.trim())) { industryError = 'กรุณาเลือกอุตสาหกรรม'; error = 'กรุณาเลือกอุตสาหกรรม'; return; }
    if (!product_description.trim()) { error = 'กรุณาอธิบาย product/service'; return; }

    error = '';
    isGenerating = true;
    output = null;
    try {
      const res = await runHookLibrary({
        business_name,
        business_type: resolvedBusinessType,
        industry: resolvedIndustry,
        location: location.trim(),
        target_audience: resolvedTargetAudience,
        differentiation: differentiation.trim(),
        price_range: price_range.trim(),
        product_description: product_description.trim(),
        product_features: product_features.trim(),
        primary_platform,
        brand_voice,
        campaign_goal,
        top_hook_style,
        offer_context: buildOfferContext(),
        persona_context: buildPersonaContext(),
        user_notes: user_notes.trim(),
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
      const title = saveTitle.trim() || `Hooks — ${business_name} ${new Date().toLocaleDateString('th-TH')}`;
      const payload = {
        business_name, business_type,
        industry: industry === '__custom__' ? '__custom__' : industry,
        industry_custom: industry === '__custom__' ? industryCustom : '',
        location: location.trim(),
        target_audience_ids: [...target_audience_pre],
        custom_audience_text: custom_audience_text.trim(),
        differentiation: differentiation.trim(),
        price_range: price_range.trim(),
        product_description: product_description.trim(),
        product_features: product_features.trim(),
        primary_platform, brand_voice, campaign_goal, top_hook_style,
        user_notes: user_notes.trim(),
        offer_save_id: selectedOfferId || '',
        persona_save_id: selectedPersonaId || '',
        business_type_resolved: resolvedBusinessType,
        industry_resolved: resolvedIndustry,
        target_audience_resolved: resolvedTargetAudience,
      };
      if (saveId) {
        await updateToolRun(saveId, { input: payload, output });
        saveMsg = '✓ อัปเดตเรียบร้อย';
      } else {
        const res = await saveToolRun('hook_library', payload, output, title);
        saveId = res.id;
        saveMsg = '✓ บันทึกเรียบร้อย';
      }
    } catch (err: any) {
      saveMsg = '✗ ' + err.message;
    } finally { isSaving = false; }
  }

  async function handleExport(format: 'md' | 'json') {
    if (!saveId) { await handleSave(); }
    if (!saveId) return;
    try {
      const res = await exportSavedTool(saveId, format);
      const url = res.download_url ? `${PUBLIC_API_URL}${res.download_url}` : getExportUrl(res.export_id);
      const a = document.createElement('a');
      a.href = url; a.download = `hooks.${format}`; a.target = '_blank'; a.click();
    } catch (err: any) { alert(err.message); }
  }

  async function handlePromote() {
    if (!saveId) { await handleSave(); }
    if (!saveId) return;
    isPromoting = true;
    try {
      const res = await promoteToolToProject(saveId);
      promoteMsg = '✓ บันทึกเป็นโปรเจกต์แล้ว';
      setTimeout(() => goto(`/projects/${res.project_id}`), 800);
    } catch (err: any) { promoteMsg = '✗ ' + err.message; }
    finally { isPromoting = false; }
  }

  const categoryColor = (cat: string) => {
    const map: Record<string, string> = {
      curiosity: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700',
      pain: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700',
      story: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700',
      stat: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700',
      question: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700',
      contrarian: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-700',
      listicle: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700',
      pattern_interrupt: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700',
      big_promise: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700',
      identity: 'bg-pink-100 dark:bg-pink-900/40 text-pink-800 dark:text-pink-300 border-pink-300 dark:border-pink-700',
    };
    return map[cat] || 'bg-gray-100 dark:bg-dark-700 text-gray-800 dark:text-dark-200 border-gray-300 dark:border-dark-600';
  };
</script>

<ToolLayout
  title="Hook Library"
  subtitle="สร้าง Hook และ Headlines ดึงดูดความสนใจ — 10 Formulas + Platform-specific"
  icon="🎣"
  color="teal"
>
  {#if !output}
    <div class="space-y-5">
      <div class="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/40 dark:to-cyan-950/40 border border-teal-200 dark:border-teal-800 rounded-xl p-4">
        <div class="font-semibold text-teal-900 dark:text-teal-200 mb-1">🎣 Hook Library</div>
        <div class="text-sm text-teal-800 dark:text-teal-300 space-y-1">
          <div><b>10 Hook Formulas:</b> Curiosity · Pain · Story · Stat · Question · Contrarian · Listicle · Pattern Interrupt · Big Promise · Identity</div>
          <div><b>6 Platforms:</b> Facebook · Instagram · YouTube · TikTok · Email · Landing Page</div>
          <div><b>Output:</b> 30-50 hooks + 5 headlines A/B test + platform-specific + A/B testing tips</div>
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">ชื่อธุรกิจ *</label>
        <input type="text" bind:value={business_name} placeholder="เช่น ขนมบ้านโกไข่" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-dark-800" />
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

      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-semibold mb-1.5">ที่ตั้ง</label>
          <input type="text" bind:value={location} placeholder="เช่น หาดใหญ่" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-dark-800" />
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1.5">ช่วงราคา</label>
          <input type="text" bind:value={price_range} placeholder="เช่น 100-500 บาท" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-dark-800" />
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">จุดต่าง (ถ้ามี)</label>
        <input type="text" bind:value={differentiation} placeholder="เช่น ขนมใต้สูตรโบราณ" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-dark-800" />
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">Product / Service *</label>
        <textarea bind:value={product_description} rows="3" placeholder="เช่น ขนมบ้านโกไข่ ขนมใต้สูตรโบราณ 28 สาขา" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm dark:bg-dark-800"></textarea>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">Features / จุดเด่น</label>
        <textarea bind:value={product_features} rows="2" placeholder="เช่น 1) สูตรโบราณ 2) วัตถุดิบสด 3) ปั๊ม ปตท." class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm dark:bg-dark-800"></textarea>
      </div>

      <div class="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/40 dark:to-cyan-950/40 border-2 border-teal-300 dark:border-teal-700 rounded-xl p-4 space-y-3">
        <div class="font-semibold text-teal-900 dark:text-teal-200">🎣 Marketing Context (4 ตัวเลือก)</div>
        <div>
          <label class="block text-xs font-semibold text-teal-800 dark:text-teal-300 mb-1">📱 Primary Platform</label>
          <select bind:value={primary_platform} class="w-full px-2.5 py-1.5 rounded border border-teal-200 dark:border-teal-700 text-sm bg-white dark:bg-dark-800">
            <option value="">— เลือก / ปล่อยว่าง —</option>
            {#each PLATFORMS as p}
              <option value={p.id}>{p.label} — {p.desc}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-teal-800 dark:text-teal-300 mb-1">😊 Brand Voice</label>
          <select bind:value={brand_voice} class="w-full px-2.5 py-1.5 rounded border border-teal-200 dark:border-teal-700 text-sm bg-white dark:bg-dark-800">
            <option value="">— เลือก / ปล่อยว่าง —</option>
            {#each BRAND_VOICE_OPTIONS as v}
              <option value={v.id}>{v.label}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-teal-800 dark:text-teal-300 mb-1">🎯 Campaign Goal</label>
          <select bind:value={campaign_goal} class="w-full px-2.5 py-1.5 rounded border border-teal-200 dark:border-teal-700 text-sm bg-white dark:bg-dark-800">
            <option value="">— เลือก / ปล่อยว่าง —</option>
            {#each CAMPAIGN_GOALS as g}
              <option value={g.id}>{g.label}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-teal-800 dark:text-teal-300 mb-1">⭐ Top Hook Style ที่ชอบ</label>
          <select bind:value={top_hook_style} class="w-full px-2.5 py-1.5 rounded border border-teal-200 dark:border-teal-700 text-sm bg-white dark:bg-dark-800">
            <option value="">— เลือก / ปล่อยว่าง —</option>
            {#each HOOK_CATEGORIES as h}
              <option value={h.id}>{h.label} — {h.desc}</option>
            {/each}
          </select>
        </div>
      </div>

      {#if offer_saves.length > 0 || persona_saves.length > 0}
        <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl p-3 space-y-2">
          <div class="font-semibold text-amber-900 dark:text-amber-200 text-sm">🔗 เชื่อม strategic tools (optional)</div>
          {#if offer_saves.length > 0}
            <select bind:value={selectedOfferId} class="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-700 text-sm bg-white dark:bg-dark-800">
              <option value="">— ไม่ใช้ Offer —</option>
              {#each offer_saves as o}<option value={o.id}>💎 {o.title}</option>{/each}
            </select>
          {/if}
          {#if persona_saves.length > 0}
            <select bind:value={selectedPersonaId} class="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-700 text-sm bg-white dark:bg-dark-800">
              <option value="">— ไม่ใช้ Persona —</option>
              {#each persona_saves as p}<option value={p.id}>👥 {p.title}</option>{/each}
            </select>
          {/if}
        </div>
      {/if}

      <div>
        <label class="block text-sm font-semibold mb-1.5">โน้ตเพิ่มเติม <span class="text-dark-900/50 dark:text-dark-100/50 font-normal">(optional)</span></label>
        <textarea bind:value={user_notes} rows="2" placeholder="อะไรก็ได้ที่อยากให้ ระบบอัจฉริยะ รู้เพิ่ม..." class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-dark-800"></textarea>
      </div>

      {#if error}<div class="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">{error}</div>{/if}

      <div class="pt-4 flex items-center justify-end border-t border-dark-100 dark:border-dark-700">
        <button onclick={handleGenerate} disabled={isGenerating} class="btn-primary disabled:opacity-50">
          {isGenerating ? '⏳ ระบบอัจฉริยะ กำลังสร้าง Hooks...' : '🎣 สร้าง Hook Library'}
        </button>
      </div>
    </div>
  {:else}
    <div class="space-y-5">
      {#if output.summary}
        <div class="bg-primary-50 dark:bg-primary-900/40 border-l-4 border-primary-500 p-4 rounded-lg">
          <div class="text-xs font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider mb-1">สรุป Hook Library</div>
          <div class="text-dark-900 dark:text-dark-50">{output.summary}</div>
        </div>
      {/if}

      {#if output.brand_voice_summary}
        <div class="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/40 dark:to-cyan-950/40 border-l-4 border-teal-500 p-3 rounded">
          <div class="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase mb-1">🎙️ Brand Voice</div>
          <div class="text-sm italic text-teal-900 dark:text-teal-200">"{output.brand_voice_summary}"</div>
        </div>
      {/if}

      <!-- Hook Categories -->
      {#if output.hook_categories?.length}
        <div>
          <h3 class="text-lg font-bold text-teal-900 dark:text-teal-200 mb-3">🎣 Hook Categories ({output.hook_categories.length})</h3>
          <div class="space-y-3">
            {#each output.hook_categories as cat}
              <div class="bg-white dark:bg-dark-800 border-2 border-teal-200 dark:border-teal-800 rounded-xl p-4">
                <div class="flex items-center gap-2 mb-2 flex-wrap">
                  <span class="px-2 py-0.5 rounded text-xs border {categoryColor(cat.name)}">{cat.thai_label || cat.name}</span>
                </div>
                {#if cat.description}<div class="text-xs text-dark-900/70 dark:text-dark-100/70 mb-2 italic">{cat.description}</div>{/if}
                <div class="space-y-1.5">
                  {#each (cat.examples || []) as ex}
                    <div class="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/40 dark:to-cyan-950/40 border-l-4 border-teal-400 dark:border-teal-600 rounded-r p-2 text-xs">
                      <div class="font-semibold text-teal-900 dark:text-teal-200 mb-0.5">"{ex.hook}"</div>
                      <div class="text-[10px] text-teal-700 dark:text-teal-400">→ <b>ทำไมได้ผล:</b> {ex.why_works}</div>
                      <div class="text-[10px] text-dark-900/60 dark:text-dark-100/60 mt-0.5"><b>เหมาะ:</b> {ex.best_for} · <b>CTA:</b> {ex.cta}</div>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Platform-Specific -->
      {#if output.platform_specific && Object.keys(output.platform_specific).length > 0}
        <div>
          <h3 class="text-lg font-bold text-teal-900 dark:text-teal-200 mb-3">📱 Platform-Specific Hooks</h3>
          <div class="grid md:grid-cols-2 gap-3">
            {#each Object.entries(output.platform_specific) as [platform, hooks]}
              <div class="bg-white dark:bg-dark-800 border-2 border-cyan-200 dark:border-cyan-800 rounded-lg p-3">
                <div class="font-bold text-cyan-900 dark:text-cyan-200 mb-1.5 text-sm">📱 {platform}</div>
                <div class="space-y-1.5">
                  {#each (hooks as string[]) as h}
                    <div class="bg-cyan-50 dark:bg-cyan-950/40 rounded p-1.5 text-xs text-cyan-900 dark:text-cyan-200">"{h}"</div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Headlines 5 -->
      {#if output.headlines_5?.length}
        <div class="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-4">
          <h3 class="font-bold text-amber-900 dark:text-amber-200 mb-2 text-center">📰 Headlines 5 (A/B Test Variants)</h3>
          <div class="space-y-1.5">
            {#each output.headlines_5 as h, i}
              <div class="bg-white dark:bg-dark-800 rounded p-2 text-sm text-amber-900 dark:text-amber-200 border-l-4 border-amber-400 dark:border-amber-600">
                <span class="text-[10px] font-bold text-amber-700 dark:text-amber-400 mr-1">#{i + 1}</span>{h}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- A/B Testing Tips -->
      {#if output.ab_testing_tips?.length}
        <div class="bg-white dark:bg-dark-800 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl p-3">
          <h3 class="font-bold text-indigo-900 dark:text-indigo-200 mb-2 text-sm">🧪 A/B Testing Tips</h3>
          <ul class="text-sm text-indigo-900 dark:text-indigo-200 space-y-0.5">
            {#each output.ab_testing_tips as t}<li>✓ {t}</li>{/each}
          </ul>
        </div>
      {/if}

      <!-- Next Steps -->
      {#if output.next_steps?.length}
        <div class="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
          <div class="font-bold text-emerald-800 dark:text-emerald-300 uppercase text-xs mb-1.5">➡️ Next Steps</div>
          <ul class="text-sm text-emerald-900 dark:text-emerald-200">
            {#each output.next_steps as s}<li>→ {s}</li>{/each}
          </ul>
        </div>
      {/if}

      {#if output.reasoning}
        <div class="bg-white dark:bg-dark-800 border border-dark-100 dark:border-dark-700 rounded-xl p-4 text-sm italic text-dark-900/70 dark:text-dark-100/70">
          💡 {output.reasoning}
        </div>
      {/if}

      <!-- Action bar -->
      <div class="flex items-center justify-between pt-4 border-t border-dark-100 dark:border-dark-700 flex-wrap gap-2">
        <button onclick={() => { output = null; error = ''; saveId = null; saveMsg = ''; }} class="text-sm text-dark-900/60 dark:text-dark-100/60 hover:text-primary-600 dark:hover:text-primary-400">
          ← สร้างใหม่
        </button>
        <div class="flex items-center gap-2 flex-wrap">
          {#if saveMsg}<span class="text-xs {saveMsg.startsWith('✓') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}">{saveMsg}</span>{/if}
          <input type="text" bind:value={saveTitle} placeholder="ตั้งชื่อ" class="text-xs px-2 py-1.5 rounded border border-dark-200 dark:border-dark-600 w-40 dark:bg-dark-800" />
          <button onclick={handleSave} disabled={isSaving} class="text-sm btn-secondary disabled:opacity-50">
            {isSaving ? '...' : (saveId ? '✓ บันทึกแล้ว' : '💾 บันทึก')}
          </button>
          <button onclick={handlePromote} disabled={isPromoting} class="text-sm btn-secondary disabled:opacity-50" title="บันทึกเป็นโปรเจกต์ (import เข้า step 5, 6)">
            {isPromoting ? '...' : '📋 เป็น Playbook'}
          </button>
          {#if saveId}<CanvasPdfButton saveId={saveId} />{/if}
          <button onclick={() => handleExport('md')} class="text-sm btn-secondary">📥 .md</button>
          <button onclick={() => handleExport('json')} class="text-sm btn-secondary">📥 .json</button>
        </div>
      </div>
      {#if promoteMsg}<div class="mt-2 text-xs {promoteMsg.startsWith('✓') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}">{promoteMsg}</div>{/if}
    </div>
  {/if}
</ToolLayout>
