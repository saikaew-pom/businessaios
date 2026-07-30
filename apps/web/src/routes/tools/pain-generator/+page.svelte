<script lang="ts">
  import ToolLayout from '$lib/ToolLayout.svelte';
  import BusinessContextFields from '$lib/BusinessContextFields.svelte';
  import ToolChainHint from '$lib/ToolChainHint.svelte';
  import { runPainGenerator, saveToolRun, updateToolRun, exportSavedTool, getExportUrl, getMeFull, promoteToolToProject } from '$lib/api';
  import { goto } from '$app/navigation';
  import { PAIN_POINT_CATEGORIES, type PainPointCategory, BUSINESS_TYPES, getIndustriesForType, TARGET_AUDIENCES } from '$lib/presets';

  let business_name = $state('');
  let business_type = $state('');      // Business type id (e.g. 'fnb', 'tech_digital')
  let industry = $state('');            // Industry name (or '__custom__')
  let industryCustom = $state('');      // Custom industry text
  let target_audience_pre = $state<string[]>([]);  // Selected audience preset ids
  let custom_audience_text = $state('');            // Custom audience text
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

  let selectedCategories = $state<string[]>([]);

  function toggleCategory(cat: PainPointCategory) {
    if (selectedCategories.includes(cat.id)) {
      selectedCategories = selectedCategories.filter(id => id !== cat.id);
    } else {
      selectedCategories = [...selectedCategories, cat.id];
    }
  }

  // Auto-load from sessionStorage on page mount (when user clicks "Edit" on saved tool)
  $effect(() => {
    try {
      const raw = sessionStorage.getItem('tool_edit_input');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.tool_type !== 'pain_generator') return;
      // Restore saveId so Save = UPDATE instead of INSERT
      if (data.save_id) saveId = data.save_id;
      const input = data.input || {};
      if (input.business_name) business_name = input.business_name;
      // business_type: handle both id (new) and label (legacy)
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
      // target_audience: prefer array of ids (new) — fallback to joined string (legacy)
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
      // categories
      if (Array.isArray(input.selected_categories)) {
        selectedCategories = input.selected_categories;
      }
      sessionStorage.removeItem('tool_edit_input');
      error = '✏️ แก้ไขจาก saved tool — กด "Generate" เพื่อรันใหม่';
    } catch (err) { /* noop */ }
  });

  // Compute resolved values (custom + presets) for the API
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

    // If categories selected, append context to target_audience
    let audience = resolvedTargetAudience;
    if (selectedCategories.length > 0) {
      const cats = selectedCategories
        .map(id => PAIN_POINT_CATEGORIES.find(c => c.id === id))
        .filter((c): c is PainPointCategory => !!c);
      const focusHint = cats.map(c => c.context_block).join('\n');
      audience = audience
        ? `${audience}\n\n[หมวด Pain Point ที่เน้น]:\n${focusHint}`
        : focusHint;
    }

    error = '';
    isGenerating = true;
    output = null;
    // Don't reset saveId here — that would break Edit flow (Save = UPDATE)
    try {
      const res = await runPainGenerator({
        business_name,
        business_type: resolvedBusinessType,
        industry: resolvedIndustry,
        target_audience: audience
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
      const title = saveTitle.trim() || `Pain Points — ${business_name} ${new Date().toLocaleDateString('th-TH')}`;
      const payload = {
        business_name,
        business_type,
        industry: industry === '__custom__' ? '__custom__' : industry,
        industry_custom: industry === '__custom__' ? industryCustom : '',
        target_audience_ids: [...target_audience_pre],
        custom_audience_text: custom_audience_text.trim(),
        selected_categories: [...selectedCategories],
        business_type_resolved: resolvedBusinessType,
        industry_resolved: resolvedIndustry,
        target_audience_resolved: resolvedTargetAudience,
      };
      if (saveId) {
        // Edit flow: UPDATE existing record
        await updateToolRun(saveId, { input: payload, output });
        saveMsg = '✓ อัปเดตเรียบร้อย';
      } else {
        // First save: INSERT
        const res = await saveToolRun('pain_generator', payload, output, title);
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
    if (!saveId) {
      // Auto-save first
      await handleSave();
    }
    if (!saveId) return;
    try {
      const res = await exportSavedTool(saveId, format);
      const url = getExportUrl(res.export_id);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pain-points.${format}`;
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
      setTimeout(() => goto(`/dashboard?new_project=${res.project_id}`), 800);
    } catch (err: any) {
      promoteMsg = '✗ ' + err.message;
    } finally {
      isPromoting = false;
    }
  }

  const pillarColor = (sev: string) => {
    if (sev === 'high') return 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700 text-red-900 dark:text-red-200';
    if (sev === 'medium') return 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200';
    return 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200';
  };

  const pillarLabel = (sev: string) => {
    if (sev === 'high') return '🔴 รุนแรงมาก';
    if (sev === 'medium') return '🟡 ปานกลาง';
    return '🟢 น้อย';
  };
</script>

<ToolLayout
  title="Pain Point Generator"
  subtitle="หา Pain Point และ Unmet Need ของลูกค้า ด้วย SPICE Framework — เรียงตามความรุนแรง ความถี่ และโอกาสทางธุรกิจ"
  icon="🎯"
  color="blue"
>
  {#if !output}
    <div class="space-y-5">
      <div class="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div class="font-semibold text-blue-900 dark:text-blue-200 mb-1">📐 SPICE Framework</div>
        <div class="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <div><b>S</b>ituation — กลุ่มเป้าหมาย + หมวดสินค้า</div>
          <div><b>P</b>ersona — สวมบทบาทนักวิเคราะห์ Unmet Need</div>
          <div><b>I</b>nstruction — วิเคราะห์ Pain Point ที่ยังแก้ไม่ตรงจุด</div>
          <div><b>C</b>riteria — เรียงตามความรุนแรง/ความถี่</div>
          <div><b>E</b>xample — Pain Point ต้องใหญ่พอเป็นโอกาสธุรกิจ</div>
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">ชื่อธุรกิจ *</label>
        <input
          type="text"
          bind:value={business_name}
          placeholder="เช่น ร้านก๋วยเตี๋ยวลุงใบหยก"
          class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-dark-800"
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

      <!-- Pain category preset -->
      <div class="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/40 dark:to-orange-950/40 border border-red-200 dark:border-red-800 rounded-xl p-4">
        <div class="mb-2">
          <div class="font-semibold text-red-900 dark:text-red-200">🎯 เลือกหมวด Pain Point ที่เน้น <span class="text-xs font-normal text-red-700 dark:text-red-400">(เลือกได้หลายข้อ / ไม่เลือกก็ได้)</span></div>
          <div class="text-xs text-red-700 dark:text-red-400">ระบบอัจฉริยะ จะเน้น pain points ในหมวดที่เลือก — เลือก 0 ข้อถ้าอยากให้ ระบบอัจฉริยะ วิเคราะห์กว้างๆ</div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {#each PAIN_POINT_CATEGORIES as cat}
            <button
              type="button"
              onclick={() => toggleCategory(cat)}
              class="text-left p-2.5 rounded-lg border-2 transition {selectedCategories.includes(cat.id) ? 'border-red-500 bg-white dark:bg-dark-800 shadow-sm' : 'border-red-200 dark:border-red-800 bg-white/50 dark:bg-dark-800/50 hover:border-red-300 dark:hover:border-red-600 hover:bg-white dark:hover:bg-dark-800'}"
              title={cat.description}
            >
              <div class="flex items-center gap-1.5">
                <span class="text-xl">{cat.icon}</span>
                {#if selectedCategories.includes(cat.id)}
                  <span class="text-xs text-red-600 dark:text-red-400">✓</span>
                {/if}
              </div>
              <div class="text-xs font-semibold text-dark-900 dark:text-dark-50 mt-1">{cat.label}</div>
            </button>
          {/each}
        </div>
        {#if selectedCategories.length > 0}
          {@const selected = selectedCategories.map(id => PAIN_POINT_CATEGORIES.find(c => c.id === id)).filter((c): c is PainPointCategory => !!c)}
          <div class="mt-3 p-2.5 bg-white dark:bg-dark-800 rounded-lg border border-red-200 dark:border-red-800 text-xs space-y-1">
            {#each selected as cat}
              <div class="text-dark-900/80 dark:text-dark-100/80">
                <span class="font-semibold text-red-700 dark:text-red-400">{cat.icon} {cat.label}:</span> {cat.description}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">กลุ่มเป้าหมายเพิ่มเติม <span class="text-dark-900/50 dark:text-dark-100/50 font-normal">(ระบุเอง ถ้ายังไม่ครบ)</span></label>
        <input
          type="text"
          bind:value={custom_audience_text}
          placeholder="เช่น พนักงานออฟฟิศอายุ 25-40 ที่ใส่ใจสุขภาพ"
          class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-dark-800"
        />
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
          {isGenerating ? '⏳ ระบบอัจฉริยะ กำลังวิเคราะห์...' : '🎯 วิเคราะห์ Pain Points'}
        </button>
      </div>
    </div>
  {:else}
    <!-- Results -->
    <div class="space-y-5">
      {#if output.summary}
        <div class="bg-primary-50 dark:bg-primary-900/40 border-l-4 border-primary-500 p-4 rounded-lg">
          <div class="text-xs font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider mb-1">สรุป</div>
          <div class="text-dark-900 dark:text-dark-50">{output.summary}</div>
        </div>
      {/if}

      {#if output.persona_insight}
        <div class="bg-white dark:bg-dark-800 border border-dark-100 dark:border-dark-700 rounded-xl p-4">
          <div class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-2">🔍 Persona Insight</div>
          <div class="text-sm leading-relaxed">{output.persona_insight}</div>
        </div>
      {/if}

      <div class="space-y-3">
        <h3 class="font-semibold text-lg">🎯 Pain Points (เรียงตามความรุนแรง)</h3>
        {#each (output.pain_points || []) as pp, i}
          <div class={`rounded-xl border-2 p-5 ${pillarColor(pp.severity)}`}>
            <div class="flex items-start justify-between gap-3 mb-2">
              <div>
                <div class="text-xs font-bold opacity-70">#{(pp.rank || i+1)} · {pillarLabel(pp.severity)} · {pp.frequency || ''}</div>
                <h4 class="text-lg font-bold mt-1">{pp.title}</h4>
              </div>
            </div>
            <p class="text-sm mb-3 leading-relaxed">{pp.description}</p>
            <div class="grid sm:grid-cols-2 gap-3 text-xs">
              <div class="bg-white/60 dark:bg-dark-900/40 rounded-lg p-2">
                <div class="font-bold opacity-70 mb-1">📊 ขนาดตลาด</div>
                <div>{pp.market_size}</div>
              </div>
              <div class="bg-white/60 dark:bg-dark-900/40 rounded-lg p-2">
                <div class="font-bold opacity-70 mb-1">💡 โอกาสของคุณ</div>
                <div>{pp.your_opportunity}</div>
              </div>
              {#if pp.current_solutions?.length}
                <div class="bg-white/60 dark:bg-dark-900/40 rounded-lg p-2 sm:col-span-2">
                  <div class="font-bold opacity-70 mb-1">🔧 วิธีที่ลูกค้าแก้ตอนนี้</div>
                  <ul class="space-y-0.5">{#each pp.current_solutions as s}<li>• {s}</li>{/each}</ul>
                </div>
              {/if}
              {#if pp.why_existing_fails}
                <div class="bg-white/60 dark:bg-dark-900/40 rounded-lg p-2 sm:col-span-2">
                  <div class="font-bold opacity-70 mb-1">❌ ทำไมถึงยังไม่ตรงจุด</div>
                  <div>{pp.why_existing_fails}</div>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      {#if output.quick_wins?.length}
        <div class="bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-700 rounded-xl p-4">
          <div class="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider mb-2">⚡ Quick Wins (แก้ได้เร็ว)</div>
          <ul class="space-y-1 text-sm">
            {#each output.quick_wins as q}<li class="flex gap-2"><span class="text-green-600 dark:text-green-400">→</span>{q}</li>{/each}
          </ul>
        </div>
      {/if}

      {#if output.moonshots?.length}
        <div class="bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-700 rounded-xl p-4">
          <div class="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider mb-2">🚀 Moonshots (payoff สูง แต่ใช้เวลา)</div>
          <ul class="space-y-1 text-sm">
            {#each output.moonshots as m}<li class="flex gap-2"><span class="text-purple-600 dark:text-purple-400">→</span>{m}</li>{/each}
          </ul>
        </div>
      {/if}

      <ToolChainHint current="pain_generator" />

      <div class="flex items-center justify-between pt-4 border-t border-dark-100 dark:border-dark-700 flex-wrap gap-2">
        <button onclick={() => { output = null; error = ''; saveId = null; saveMsg = ''; }} class="text-sm text-dark-900/60 dark:text-dark-100/60 hover:text-primary-600 dark:hover:text-primary-400">
          ← วิเคราะห์ใหม่
        </button>
        <div class="flex items-center gap-2 flex-wrap">
          {#if saveMsg}
            <span class="text-xs {saveMsg.startsWith('✓') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}">{saveMsg}</span>
          {/if}
          <input type="text" bind:value={saveTitle} placeholder="ตั้งชื่อ (ไม่บังคับ)" class="text-xs px-2 py-1.5 rounded border border-dark-200 dark:border-dark-600 w-40 dark:bg-dark-800" />
          <button onclick={handleSave} disabled={isSaving} class="text-sm btn-secondary disabled:opacity-50">
            {isSaving ? '...' : (saveId ? '✓ บันทึกแล้ว' : '💾 บันทึก')}
          </button>
          <button onclick={handlePromote} disabled={isPromoting} class="text-sm btn-secondary disabled:opacity-50" title="บันทึกเป็นโปรเจกต์แยก (จะแสดงใน Dashboard)">
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
