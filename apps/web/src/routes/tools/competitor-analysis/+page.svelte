<script lang="ts">
  import ToolLayout from '$lib/ToolLayout.svelte';
  import BusinessContextFields from '$lib/BusinessContextFields.svelte';
  import { runCompetitorAnalysis, saveToolRun, updateToolRun, exportSavedTool, getExportUrl, getMeFull, promoteToolToProject } from '$lib/api';
  import { goto } from '$app/navigation';
  import { BUSINESS_TYPES, TARGET_AUDIENCES, COMPETITOR_FOCUS_AREAS, type CompetitorFocusArea } from '$lib/presets';
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

  let competitor_mode = $state<'manual' | 'auto_find'>('auto_find');
  let competitor_1 = $state('');
  let competitor_2 = $state('');
  let competitor_3 = $state('');
  let competitor_4 = $state('');
  let competitor_5 = $state('');

  let selectedFocusAreas = $state<string[]>([]);
  let user_notes = $state('');

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

  function toggleFocus(id: string) {
    if (selectedFocusAreas.includes(id)) {
      selectedFocusAreas = selectedFocusAreas.filter(x => x !== id);
    } else {
      selectedFocusAreas = [...selectedFocusAreas, id];
    }
  }

  // Auto-load from sessionStorage on page mount (Edit flow)
  $effect(() => {
    try {
      const raw = sessionStorage.getItem('tool_edit_input');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.tool_type !== 'competitor_analysis') return;
      if (data.save_id) saveId = data.save_id;
      const input = data.input || {};
      if (input.business_name) business_name = input.business_name;
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
      if (input.location) location = input.location;
      if (input.differentiation) differentiation = input.differentiation;
      if (input.price_range) price_range = input.price_range;
      if (Array.isArray(input.target_audience_ids)) {
        target_audience_pre = input.target_audience_ids.filter((id: string) =>
          TARGET_AUDIENCES.some(a => a.id === id)
        );
      } else if (Array.isArray(input.target_audience)) {
        target_audience_pre = input.target_audience
          .map((x: string) => TARGET_AUDIENCES.find(a => a.id === x || a.label === x)?.id)
          .filter(Boolean);
      } else if (typeof input.target_audience === 'string' && input.target_audience) {
        const chunks = input.target_audience.split(';').map((s: string) => s.trim()).filter(Boolean);
        const ids: string[] = [];
        let leftover = '';
        for (const chunk of chunks) {
          let cur = chunk;
          let matched = false;
          for (let i = 0; i < 5; i++) {
            const byLabel = TARGET_AUDIENCES.find(a => a.label === cur);
            if (byLabel) { ids.push(byLabel.id); matched = true; break; }
            const stripped = cur.replace(/\s*\([^)]*\)\s*$/, '').trim();
            if (stripped === cur) break;
            cur = stripped;
          }
          if (!matched) leftover += (leftover ? '; ' : '') + chunk;
        }
        target_audience_pre = ids;
        if (leftover && !custom_audience_text) custom_audience_text = leftover;
      }
      if (input.custom_audience_text) custom_audience_text = input.custom_audience_text;
      if (input.competitor_mode) competitor_mode = input.competitor_mode;
      if (input.competitor_1) competitor_1 = input.competitor_1;
      if (input.competitor_2) competitor_2 = input.competitor_2;
      if (input.competitor_3) competitor_3 = input.competitor_3;
      if (input.competitor_4) competitor_4 = input.competitor_4;
      if (input.competitor_5) competitor_5 = input.competitor_5;
      if (Array.isArray(input.focus_areas)) selectedFocusAreas = input.focus_areas;
      if (input.user_notes) user_notes = input.user_notes;
      sessionStorage.removeItem('tool_edit_input');
      error = '✏️ แก้ไขจาก saved tool — กด "Generate" เพื่อรันใหม่';
    } catch (err) { /* noop */ }
  });

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
    if (!business_name) { error = 'กรุณาใส่ชื่อธุรกิจ'; return; }
    if (!business_type) { businessTypeError = 'กรุณาเลือกประเภทธุรกิจ'; error = 'กรุณาเลือกประเภทธุรกิจ'; return; }
    if (!industry || (industry === '__custom__' && !industryCustom.trim())) { industryError = 'กรุณาเลือกอุตสาหกรรม'; error = 'กรุณาเลือกอุตสาหกรรม'; return; }

    if (competitor_mode === 'manual') {
      const named = [competitor_1, competitor_2, competitor_3, competitor_4, competitor_5].filter(c => c.trim());
      if (named.length === 0) {
        error = 'กรุณาระบุชื่อคู่แข่งอย่างน้อย 1 เจ้า (หรือเปลี่ยนเป็นโหมด Auto-find)';
        return;
      }
    }

    error = '';
    isGenerating = true;
    output = null;
    try {
      const res = await runCompetitorAnalysis({
        business_name,
        business_type: resolvedBusinessType,
        industry: resolvedIndustry,
        location: location.trim(),
        target_audience: resolvedTargetAudience,
        differentiation: differentiation.trim(),
        price_range: price_range.trim(),
        competitor_mode,
        competitor_1: competitor_1.trim(),
        competitor_2: competitor_2.trim(),
        competitor_3: competitor_3.trim(),
        competitor_4: competitor_4.trim(),
        competitor_5: competitor_5.trim(),
        focus_areas: selectedFocusAreas,
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
      const title = saveTitle.trim() || `Competitor Analysis — ${business_name} ${new Date().toLocaleDateString('th-TH')}`;
      const payload = {
        business_name,
        business_type,
        industry: industry === '__custom__' ? '__custom__' : industry,
        industry_custom: industry === '__custom__' ? industryCustom : '',
        location: location.trim(),
        target_audience_ids: [...target_audience_pre],
        custom_audience_text: custom_audience_text.trim(),
        differentiation: differentiation.trim(),
        price_range: price_range.trim(),
        competitor_mode,
        competitor_1: competitor_1.trim(),
        competitor_2: competitor_2.trim(),
        competitor_3: competitor_3.trim(),
        competitor_4: competitor_4.trim(),
        competitor_5: competitor_5.trim(),
        focus_areas: [...selectedFocusAreas],
        user_notes: user_notes.trim(),
        business_type_resolved: resolvedBusinessType,
        industry_resolved: resolvedIndustry,
        target_audience_resolved: resolvedTargetAudience,
      };
      if (saveId) {
        await updateToolRun(saveId, { input: payload, output });
        saveMsg = '✓ อัปเดตเรียบร้อย';
      } else {
        const res = await saveToolRun('competitor_analysis', payload, output, title);
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
      const url = res.download_url
        ? `${PUBLIC_API_URL}${res.download_url}`
        : getExportUrl(res.export_id);
      const a = document.createElement('a');
      a.href = url;
      a.download = `competitor-analysis.${format}`;
      a.target = '_blank';
      a.click();
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
      setTimeout(() => goto(`/projects/${res.project_id}`), 800);
    } catch (err: any) {
      promoteMsg = '✗ ' + err.message;
    } finally {
      isPromoting = false;
    }
  }

  const threatBadge = (lvl: string) => {
    if (lvl === 'high') return { cls: 'bg-red-100 dark:bg-red-950/40 border-red-400 dark:border-red-600 text-red-900 dark:text-red-200', label: '🔴 ภัยสูง' };
    if (lvl === 'medium') return { cls: 'bg-amber-100 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-200', label: '🟡 ปานกลาง' };
    return { cls: 'bg-blue-100 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 text-blue-900 dark:text-blue-200', label: '🟢 ต่ำ' };
  };
  const gapSizeBadge = (s: string) => {
    if (s === 'big') return { cls: 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300', label: '🟢 โอกาสใหญ่' };
    if (s === 'medium') return { cls: 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300', label: '🟡 กลาง' };
    return { cls: 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300', label: '⚪ เล็ก' };
  };
</script>

<ToolLayout
  title="Competitor Analysis"
  subtitle="วิเคราะห์คู่แข่ง + หา White Space — รู้ว่าใครกำลังชนะลูกค้าไปจากเรา และเราจะชนะเขาได้ยังไง"
  icon="🔍"
  color="red"
>
  {#if !output}
    <div class="space-y-5">
      <div class="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/40 dark:to-orange-950/40 border border-red-200 dark:border-red-800 rounded-xl p-4">
        <div class="font-semibold text-red-900 dark:text-red-200 mb-1">📐 SPICE Framework + Outside-In</div>
        <div class="text-sm text-red-800 dark:text-red-300 space-y-1">
          <div><b>S</b>ituation — ธุรกิจ + ตลาด + คู่แข่ง</div>
          <div><b>P</b>ersona — สวมบทบาท Competitive Intelligence Analyst</div>
          <div><b>I</b>nstruction — วิเคราะห์คู่แข่ง + market gaps + white space</div>
          <div><b>C</b>riteria — actionable, grounded, realistic</div>
          <div><b>E</b>xample — แผนรุกที่ทำได้จริง</div>
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">ชื่อธุรกิจ *</label>
        <input
          type="text"
          bind:value={business_name}
          placeholder="เช่น ร้านก๋วยเตี๋ยวลุงใบหยก"
          class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
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
          <input
            type="text"
            bind:value={location}
            placeholder="เช่น หาดใหญ่, กรุงเทพ, ออนไลน์"
            class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1.5">ช่วงราคา</label>
          <input
            type="text"
            bind:value={price_range}
            placeholder="เช่น 50-150 บาท, ฿ / ฿฿ / ฿฿฿"
            class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">จุดต่าง (ถ้ามี)</label>
        <input
          type="text"
          bind:value={differentiation}
          placeholder="เช่น ใช้วัตถุดิบออร์แกนิค, ส่งฟรีใน 30 นาที, รับประกันคืนเงิน"
          class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <!-- Competitor mode toggle -->
      <div class="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div class="font-semibold text-blue-900 dark:text-blue-200 mb-2">👥 คู่แข่ง</div>
        <div class="flex gap-2 mb-3">
          <button
            type="button"
            onclick={() => competitor_mode = 'auto_find'}
            class="flex-1 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition {competitor_mode === 'auto_find' ? 'border-blue-500 bg-white dark:bg-dark-800 text-blue-900 dark:text-blue-200 shadow-sm' : 'border-blue-200 dark:border-blue-800 bg-white/50 dark:bg-dark-900/40 text-blue-700 dark:text-blue-400 hover:border-blue-300 dark:hover:border-blue-600'}"
          >
            <div class="text-lg mb-0.5">🤖</div>
            <div>Auto-find</div>
            <div class="text-xs font-normal opacity-70">ระบบอัจฉริยะ ช่วยเดาคู่แข่งที่น่าจะอยู่ในตลาด</div>
          </button>
          <button
            type="button"
            onclick={() => competitor_mode = 'manual'}
            class="flex-1 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition {competitor_mode === 'manual' ? 'border-blue-500 bg-white dark:bg-dark-800 text-blue-900 dark:text-blue-200 shadow-sm' : 'border-blue-200 dark:border-blue-800 bg-white/50 dark:bg-dark-900/40 text-blue-700 dark:text-blue-400 hover:border-blue-300 dark:hover:border-blue-600'}"
          >
            <div class="text-lg mb-0.5">✍️</div>
            <div>Manual</div>
            <div class="text-xs font-normal opacity-70">ระบุชื่อคู่แข่งเอง (1-5 เจ้า)</div>
          </button>
        </div>

        {#if competitor_mode === 'auto_find'}
          <div class="bg-white/70 dark:bg-dark-900/40 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-300">
            💡 <b>แนะนำสำหรับมือใหม่:</b> ระบบอัจฉริยะ จะเดาคู่แข่ง 3-5 เจ้าที่น่าจะอยู่ในตลาดของคุณ (เช่น ร้านอาหารใต้ในหาดใหญ่) และระบุว่าเป็นการประมาณการณ์
          </div>
        {:else}
          <div class="space-y-2">
            <input
              type="text"
              bind:value={competitor_1}
              placeholder="ชื่อคู่แข่ง 1 (required)"
              class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
            <input
              type="text"
              bind:value={competitor_2}
              placeholder="ชื่อคู่แข่ง 2 (optional)"
              class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
            <input
              type="text"
              bind:value={competitor_3}
              placeholder="ชื่อคู่แข่ง 3 (optional)"
              class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
            <input
              type="text"
              bind:value={competitor_4}
              placeholder="ชื่อคู่แข่ง 4 (optional)"
              class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
            <input
              type="text"
              bind:value={competitor_5}
              placeholder="ชื่อคู่แข่ง 5 (optional)"
              class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
        {/if}
      </div>

      <!-- Focus areas -->
      <div class="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/40 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
        <div class="mb-2">
          <div class="font-semibold text-purple-900 dark:text-purple-200">🎯 โฟกัสเรื่องอะไรเป็นพิเศษ <span class="text-xs font-normal text-purple-700 dark:text-purple-400">(เลือกได้หลายข้อ / ไม่เลือก = วิเคราะห์ครบทุกมิติ)</span></div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {#each COMPETITOR_FOCUS_AREAS as fa}
            <button
              type="button"
              onclick={() => toggleFocus(fa.id)}
              class="text-left p-2.5 rounded-lg border-2 transition {selectedFocusAreas.includes(fa.id) ? 'border-purple-500 dark:border-purple-600 bg-white dark:bg-dark-800 shadow-sm' : 'border-purple-200 dark:border-purple-800 bg-white/50 dark:bg-dark-900/40 hover:border-purple-300 hover:bg-white dark:hover:bg-dark-800'}"
              title={fa.description}
            >
              <div class="flex items-center gap-1.5">
                <span class="text-xl">{fa.icon}</span>
                {#if selectedFocusAreas.includes(fa.id)}
                  <span class="text-xs text-purple-600 dark:text-purple-400">✓</span>
                {/if}
              </div>
              <div class="text-xs font-semibold text-dark-900 dark:text-dark-50 mt-1">{fa.label}</div>
            </button>
          {/each}
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">โน้ตเพิ่มเติม <span class="text-dark-900/50 dark:text-dark-100/50 font-normal">(optional)</span></label>
        <textarea
          bind:value={user_notes}
          rows="2"
          placeholder="เช่น สนใจแข่งในกลุ่ม premium, มีหน้าร้าน 3 สาขาแล้ว..."
          class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
        ></textarea>
      </div>

      {#if error}
        <div class="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      {/if}

      <div class="pt-4 flex items-center justify-end border-t border-dark-100 dark:border-dark-700">
        <button
          onclick={handleGenerate}
          disabled={isGenerating}
          class="btn-primary disabled:opacity-50"
        >
          {isGenerating ? '⏳ ระบบอัจฉริยะ กำลังวิเคราะห์...' : '🔍 วิเคราะห์คู่แข่ง'}
        </button>
      </div>
    </div>
  {:else}
    <!-- Results -->
    <div class="space-y-5">
      {#if output.summary}
        <div class="bg-primary-50 dark:bg-primary-900/40 border-l-4 border-primary-500 p-4 rounded-lg">
          <div class="text-xs font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider mb-1">ภาพรวมตลาด</div>
          <div class="text-dark-900 dark:text-dark-50">{output.summary}</div>
        </div>
      {/if}

      {#if output.is_estimated}
        <div class="bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 dark:border-amber-600 p-3 rounded-lg text-sm text-amber-900 dark:text-amber-200">
          ⚠️ <b>โหมด Auto-find:</b> {output.estimation_note || 'คู่แข่งเหล่านี้เป็นการประมาณการณ์จากบริบทธุรกิจ ควรไปตรวจสอบข้อมูลจริงอีกครั้ง'}
        </div>
      {/if}

      {#if output.market_dynamics}
        <div class="bg-white dark:bg-dark-800 border border-dark-100 dark:border-dark-700 rounded-xl p-4">
          <div class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-2">📊 Market Dynamics</div>
          <div class="text-sm leading-relaxed">{output.market_dynamics}</div>
        </div>
      {/if}

      <!-- Competitors -->
      <div class="space-y-3">
        <h3 class="font-semibold text-lg">👥 คู่แข่ง ({output.competitors?.length || 0} เจ้า)</h3>
        {#each (output.competitors || []) as comp, i}
          {@const tb = threatBadge(comp.threat_level)}
          <div class="rounded-xl border-2 border-dark-200 dark:border-dark-600 p-4 bg-white dark:bg-dark-800">
            <div class="flex items-start justify-between gap-3 mb-2">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-lg font-bold text-dark-900 dark:text-dark-50">#{i+1} {comp.name}</span>
                  <span class="text-xs px-2 py-0.5 rounded-full border {tb.cls}">{tb.label}</span>
                </div>
                {#if comp.tagline}
                  <div class="text-xs text-dark-900/60 dark:text-dark-100/60 italic mt-0.5">"{comp.tagline}"</div>
                {/if}
              </div>
            </div>
            <div class="text-sm mb-3">
              <span class="font-semibold text-dark-900/70 dark:text-dark-100/70">Positioning:</span> {comp.positioning}
              {#if comp.price_range}
                · <span class="font-semibold text-dark-900/70 dark:text-dark-100/70">ราคา:</span> {comp.price_range}
              {/if}
            </div>
            <div class="grid sm:grid-cols-2 gap-3 text-xs">
              <div class="bg-green-50 dark:bg-green-950/40 rounded-lg p-2.5">
                <div class="font-bold text-green-800 dark:text-green-300 mb-1">💪 จุดแข็ง</div>
                <ul class="space-y-0.5 text-green-900 dark:text-green-200">
                  {#each comp.strengths || [] as s}<li>• {s}</li>{/each}
                </ul>
              </div>
              <div class="bg-red-50 dark:bg-red-950/40 rounded-lg p-2.5">
                <div class="font-bold text-red-800 dark:text-red-300 mb-1">⚠️ จุดอ่อน</div>
                <ul class="space-y-0.5 text-red-900 dark:text-red-200">
                  {#each comp.weaknesses || [] as w}<li>• {w}</li>{/each}
                </ul>
              </div>
              {#if comp.marketing_channels?.length}
                <div class="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 rounded-lg p-2.5">
                  <div class="font-bold text-dark-900/70 dark:text-dark-100/70 mb-1">📣 Channels</div>
                  <div class="flex flex-wrap gap-1">
                    {#each comp.marketing_channels as ch}<span class="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 rounded text-[10px]">{ch}</span>{/each}
                  </div>
                </div>
              {/if}
              {#if comp.content_style}
                <div class="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 rounded-lg p-2.5">
                  <div class="font-bold text-dark-900/70 dark:text-dark-100/70 mb-1">🎨 Content style</div>
                  <div>{comp.content_style}</div>
                </div>
              {/if}
              {#if comp.why_threat}
                <div class="bg-amber-50 dark:bg-amber-950/40 rounded-lg p-2.5 sm:col-span-2">
                  <div class="font-bold text-amber-800 dark:text-amber-300 mb-1">🎯 ทำไมเป็นภัย</div>
                  <div class="text-amber-900 dark:text-amber-200">{comp.why_threat}</div>
                </div>
              {/if}
              {#if comp.response}
                <div class="bg-primary-50 dark:bg-primary-900/40 rounded-lg p-2.5 sm:col-span-2">
                  <div class="font-bold text-primary-700 dark:text-primary-300 mb-1">⚔️ เราจะทำอะไรกับรายนี้</div>
                  <div class="text-dark-900 dark:text-dark-50">{comp.response}</div>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- Market gaps -->
      {#if output.market_gaps?.length}
        <div class="space-y-3">
          <h3 class="font-semibold text-lg">🎯 Market Gaps (โอกาสที่คู่แข่งทำไม่ดี)</h3>
          {#each output.market_gaps as g, i}
            {@const sb = gapSizeBadge(g.opportunity_size)}
            <div class="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 p-4">
              <div class="flex items-start justify-between gap-2 mb-2">
                <div class="font-semibold text-emerald-900 dark:text-emerald-200">#{i+1} {g.gap}</div>
                <span class="text-xs px-2 py-0.5 rounded-full {sb.cls} whitespace-nowrap">{sb.label}</span>
              </div>
              {#if g.evidence}
                <div class="text-xs text-dark-900/70 dark:text-dark-100/70 mb-1"><b>หลักฐาน:</b> {g.evidence}</div>
              {/if}
              {#if g.your_advantage}
                <div class="text-xs text-emerald-800 dark:text-emerald-300"><b>โอกาสของเรา:</b> {g.your_advantage}</div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- White space -->
      {#if output.white_space}
        <div class="bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-900/40 dark:to-blue-950/40 border-2 border-primary-300 dark:border-primary-700 rounded-2xl p-5">
          <h3 class="font-semibold text-lg mb-3 text-primary-900 dark:text-primary-200">🚀 White Space (ตำแหน่งที่เราควรยึด)</h3>
          <div class="space-y-3 text-sm">
            {#if output.white_space.positioning}
              <div>
                <div class="text-xs font-bold text-primary-700 dark:text-primary-300 uppercase mb-1">Positioning</div>
                <div>{output.white_space.positioning}</div>
              </div>
            {/if}
            {#if output.white_space.uvp}
              <div>
                <div class="text-xs font-bold text-primary-700 dark:text-primary-300 uppercase mb-1">UVP</div>
                <div>{output.white_space.uvp}</div>
              </div>
            {/if}
            {#if output.white_space.key_message}
              <div class="bg-white dark:bg-dark-800 rounded-lg p-3 border border-primary-200 dark:border-primary-800">
                <div class="text-xs font-bold text-primary-700 dark:text-primary-300 uppercase mb-1">💬 Key Message</div>
                <div class="italic">"{output.white_space.key_message}"</div>
              </div>
            {/if}
            {#if output.white_space.anti_positioning}
              <div class="bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-400 dark:border-amber-600 p-2 rounded">
                <div class="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase mb-1">ไม่ใช่ลูกค้าเรา</div>
                <div class="text-amber-900 dark:text-amber-200 text-xs">{output.white_space.anti_positioning}</div>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Recommended strategy -->
      {#if output.recommended_strategy}
        <div class="space-y-3">
          <h3 class="font-semibold text-lg">📋 แผนรุก</h3>
          {#if output.recommended_strategy.now}
            <div class="bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 dark:border-red-600 p-3 rounded">
              <div class="text-xs font-bold text-red-800 dark:text-red-300 uppercase mb-1">🔥 ทำด่วนที่สุด</div>
              <div class="text-sm text-red-900 dark:text-red-200">{output.recommended_strategy.now}</div>
            </div>
          {/if}
          {#if output.recommended_strategy.next_30_days?.length}
            <div class="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div class="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase mb-2">📅 30 วันข้างหน้า</div>
              <ul class="space-y-1 text-sm">
                {#each output.recommended_strategy.next_30_days as a}<li class="flex gap-2"><span class="text-blue-600 dark:text-blue-400">→</span>{a}</li>{/each}
              </ul>
            </div>
          {/if}
          {#if output.recommended_strategy.next_90_days?.length}
            <div class="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
              <div class="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase mb-2">🎯 90 วันข้างหน้า</div>
              <ul class="space-y-1 text-sm">
                {#each output.recommended_strategy.next_90_days as a}<li class="flex gap-2"><span class="text-indigo-600 dark:text-indigo-400">→</span>{a}</li>{/each}
              </ul>
            </div>
          {/if}
          {#if output.recommended_strategy.avoid}
            <div class="bg-rose-50 dark:bg-rose-950/40 border-l-4 border-rose-400 dark:border-rose-600 p-3 rounded text-sm">
              <div class="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase mb-1">🚫 ห้ามทำ</div>
              <div class="text-rose-900 dark:text-rose-200">{output.recommended_strategy.avoid}</div>
            </div>
          {/if}
        </div>
      {/if}

      {#if output.reasoning}
        <div class="bg-white dark:bg-dark-800 border border-dark-100 dark:border-dark-700 rounded-xl p-4 text-sm italic text-dark-900/70 dark:text-dark-100/70">
          💡 {output.reasoning}
        </div>
      {/if}

      <!-- Action bar -->
      <div class="flex items-center justify-between pt-4 border-t border-dark-100 dark:border-dark-700 flex-wrap gap-2">
        <button onclick={() => { output = null; error = ''; saveId = null; saveMsg = ''; }} class="text-sm text-dark-900/60 dark:text-dark-100/60 hover:text-primary-600">
          ← วิเคราะห์ใหม่
        </button>
        <div class="flex items-center gap-2 flex-wrap">
          {#if saveMsg}
            <span class="text-xs {saveMsg.startsWith('✓') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}">{saveMsg}</span>
          {/if}
          <input type="text" bind:value={saveTitle} placeholder="ตั้งชื่อ (ไม่บังคับ)" class="text-xs px-2 py-1.5 rounded border border-dark-200 dark:border-dark-600 w-40" />
          <button onclick={handleSave} disabled={isSaving} class="text-sm btn-secondary disabled:opacity-50">
            {isSaving ? '...' : (saveId ? '✓ บันทึกแล้ว' : '💾 บันทึก')}
          </button>
          <button onclick={handlePromote} disabled={isPromoting} class="text-sm btn-secondary disabled:opacity-50" title="บันทึกเป็นโปรเจกต์ (import เนื้อหาเข้า step 1, 2, 4)">
            {isPromoting ? '...' : '📋 เป็น Playbook'}
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
