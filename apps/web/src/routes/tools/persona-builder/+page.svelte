<script lang="ts">
  import ToolLayout from '$lib/ToolLayout.svelte';
  import BusinessContextFields from '$lib/BusinessContextFields.svelte';
  import ToolChainHint from '$lib/ToolChainHint.svelte';
  import { runPersonaBuilder, saveToolRun, updateToolRun, exportSavedTool, getExportUrl, promoteToolToProject } from '$lib/api';
  import { goto } from '$app/navigation';
  import { PERSONA_PRESETS, type PersonaPreset, BUSINESS_TYPES, TARGET_AUDIENCES } from '$lib/presets';

  let business_name = $state('');
  let business_type = $state('');
  let industry = $state('');
  let industryCustom = $state('');
  let target_audience_pre = $state<string[]>([]);
  let custom_audience_text = $state('');
  let location = $state('');
  let target_age = $state('');
  let target_job = $state('');
  let target_income = $state('');
  let differentiation = $state('');
  let pain_points = $state('');
  let context = $state('');

  // Auto-load from sessionStorage on page mount (when user clicks "Edit" on saved tool)
  $effect(() => {
    try {
      const raw = sessionStorage.getItem('tool_edit_input');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.tool_type !== 'persona_builder') return;
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
      if (input.target_age) target_age = input.target_age;
      if (input.target_job) target_job = input.target_job;
      if (input.target_income) target_income = input.target_income;
      if (input.location) location = input.location;
      if (input.differentiation) differentiation = input.differentiation;
      if (input.pain_points) pain_points = input.pain_points;
      if (input.context) context = input.context;
      sessionStorage.removeItem('tool_edit_input');
      error = '✏️ แก้ไขจาก saved tool — กด "Generate" เพื่อรันใหม่';
    } catch (err) { /* noop */ }
  });

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

  let selectedPersona = $state<string | null>(null);

  function applyPersona(p: PersonaPreset) {
    selectedPersona = p.id;
    target_age = p.age;
    target_job = p.job;
    target_income = p.income;
    if (!location) location = p.location === 'กรุงเทพฯ และเมืองใหญ่' ? 'กรุงเทพฯ' : p.location;
    pain_points = p.common_pains.join('\n');
    context = `Persona template: ${p.name} (${p.nickname})\n${p.description}\n\nValues: ${p.psychographics.values}\nInterests: ${p.psychographics.interests}\nFears: ${p.psychographics.fears}\nAspirations: ${p.psychographics.aspirations}\nPreferred channels: ${p.channels.join(', ')}\nPreferred message: ${p.preferred_messages}\nPreferred offer: ${p.preferred_offers}`;
  }

  function clearPersona() {
    selectedPersona = null;
    target_age = '';
    target_job = '';
    target_income = '';
    pain_points = '';
    context = '';
  }

  // Compute resolved values
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
      const res = await runPersonaBuilder({
        business_name,
        business_type: resolvedBusinessType,
        industry: resolvedIndustry,
        location, target_age, target_job, target_income,
        differentiation, pain_points, context: context + (resolvedTargetAudience ? '\n\nTarget audience focus: ' + resolvedTargetAudience : '')
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
      const title = saveTitle.trim() || `Persona — ${business_name} ${new Date().toLocaleDateString('th-TH')}`;
      const payload = {
        business_name,
        business_type,
        industry: industry === '__custom__' ? '__custom__' : industry,
        industry_custom: industry === '__custom__' ? industryCustom : '',
        target_audience_ids: [...target_audience_pre],
        custom_audience_text: custom_audience_text.trim(),
        location, target_age, target_job, target_income,
        differentiation, pain_points, context,
        business_type_resolved: resolvedBusinessType,
        industry_resolved: resolvedIndustry,
        target_audience_resolved: resolvedTargetAudience,
      };
      if (saveId) {
        await updateToolRun(saveId, { input: payload, output });
        saveMsg = '✓ อัปเดตเรียบร้อย';
      } else {
        const res = await saveToolRun('persona_builder', payload, output, title);
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
      a.href = url; a.download = `personas.${format}`; a.target = '_blank'; a.click();
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
  title="Persona Builder"
  subtitle="สร้าง Customer Persona จากข้อมูลสมมติฐาน สำหรับธุรกิจใหม่ที่ยังไม่มีรีวิว/ข้อมูลลูกค้า — พร้อมวิธี validate ด้วยข้อมูลจริง"
  icon="👥"
  color="green"
>
  {#if !output}
    <div class="space-y-5">
      <div class="bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 dark:border-amber-600 p-4 rounded-lg">
        <div class="font-semibold text-amber-900 dark:text-amber-200 mb-1">💡 เหมาะกับ</div>
        <div class="text-sm text-amber-800 dark:text-amber-200">
          ธุรกิจใหม่ที่ยังไม่มีรีวิว/ข้อมูลลูกค้า · ใช้สำหรับวางแผน marketing เบื้องต้น แล้วค่อย update เมื่อมีข้อมูลจริง
        </div>
      </div>

      <div class="grid sm:grid-cols-2 gap-4">
        <!-- Persona preset picker -->
        <div class="bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-950/40 dark:to-teal-950/40 border border-green-200 dark:border-green-800 rounded-xl p-4 sm:col-span-2">
          <div class="flex items-center justify-between mb-2">
            <div>
              <div class="font-semibold text-green-900 dark:text-green-200">👥 เริ่มจาก Persona Template</div>
              <div class="text-xs text-green-700 dark:text-green-400">8 personas มาตรฐานสำหรับ SME ไทย — คลิกเติมข้อมูลอัตโนมัติ แล้วแก้ต่อได้</div>
            </div>
            {#if selectedPersona}
              <button type="button" onclick={clearPersona} class="text-xs text-green-700 dark:text-green-400 hover:underline">ล้างค่า</button>
            {/if}
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {#each PERSONA_PRESETS as p}
              <button
                type="button"
                onclick={() => applyPersona(p)}
                class="text-left p-2.5 rounded-lg border-2 transition {selectedPersona === p.id ? 'border-green-500 bg-white dark:bg-dark-800 shadow-sm' : 'border-green-200 dark:border-green-800 bg-white/50 dark:bg-dark-900/40 hover:border-green-300 dark:hover:border-green-600 hover:bg-white dark:hover:bg-dark-800'}"
                title={p.description}
              >
                <div class="flex items-center gap-1.5">
                  <span class="text-xl">{p.icon}</span>
                  {#if selectedPersona === p.id}
                    <span class="text-xs text-green-600 dark:text-green-400">✓</span>
                  {/if}
                </div>
                <div class="text-xs font-semibold text-dark-900 dark:text-dark-50 mt-1">{p.name}</div>
                <div class="text-xs text-dark-900/60 dark:text-dark-100/60 leading-tight">{p.nickname}</div>
              </button>
            {/each}
          </div>
          {#if selectedPersona}
            {@const p = PERSONA_PRESETS.find(x => x.id === selectedPersona)}
            <div class="mt-3 p-2.5 bg-white dark:bg-dark-800 rounded-lg border border-green-200 dark:border-green-800 text-xs">
              <div class="font-semibold text-green-700 dark:text-green-400 mb-1">📌 {p?.name} — เหมาะกับอุตสาหกรรม:</div>
              <div class="text-dark-900/70 dark:text-dark-100/70">{p?.industries.join(' · ')}</div>
            </div>
          {/if}
        </div>

        <div class="sm:col-span-2">
          <label class="block text-sm font-semibold mb-1.5">ชื่อธุรกิจ *</label>
          <input bind:value={business_name} type="text" placeholder="เช่น ร้านก๋วยเตี๋ยวลุงใบหยก" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>

        <div class="sm:col-span-2">
          <BusinessContextFields
            bind:businessType={business_type}
            bind:industry={industry}
            bind:industryCustom={industryCustom}
            bind:targetAudiences={target_audience_pre}
            bind:customAudience={custom_audience_text}
            {businessTypeError}
            {industryError}
          />
        </div>

        <div>
          <label class="block text-sm font-semibold mb-1.5">ที่ตั้ง</label>
          <input bind:value={location} type="text" placeholder="เช่น กรุงเทพ / เชียงใหม่" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1.5">อายุลูกค้าเป้าหมาย</label>
          <input bind:value={target_age} type="text" placeholder="เช่น 25-40" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600" />
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1.5">อาชีพลูกค้า</label>
          <input bind:value={target_job} type="text" placeholder="เช่น พนักงานออฟฟิศ" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600" />
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1.5">รายได้</label>
          <input bind:value={target_income} type="text" placeholder="เช่น 20,000-50,000" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600" />
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1.5">จุดต่าง</label>
          <input bind:value={differentiation} type="text" placeholder="เช่น น้ำซุปต้ม 8 ชม." class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600" />
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">Pain Points ที่คิดว่าลูกค้ามี</label>
        <textarea bind:value={pain_points} rows="2" placeholder="เช่น ก๋วยเตี๋ยวอร่อยยาก ราคาแพง รอนาน" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600"></textarea>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">บริบทเพิ่มเติม</label>
        <textarea bind:value={context} rows="2" placeholder="ข้อมูลอื่นๆ เช่น ช่องทางขาย, งบประมาณ, seasonality" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600"></textarea>
      </div>

      {#if error}
        <div class="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">{error}</div>
      {/if}

      <div class="pt-4 flex items-center justify-end border-t border-dark-100 dark:border-dark-700">
        <button onclick={handleGenerate} disabled={isGenerating} class="btn-primary disabled:opacity-50">
          {isGenerating ? '⏳ ระบบอัจฉริยะ กำลังสร้าง Persona...' : '👥 สร้าง Persona'}
        </button>
      </div>
    </div>
  {:else}
    <div class="space-y-5">
      {#if output.disclaimer}
        <div class="bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 dark:border-amber-600 p-4 rounded-lg text-sm text-amber-900 dark:text-amber-200">
          ⚠️ {output.disclaimer}
        </div>
      {/if}

      {#each (output.personas || []) as persona, i}
        <div class="bg-white dark:bg-dark-800 border-2 border-dark-100 dark:border-dark-700 rounded-2xl p-6">
          <div class="flex items-start gap-4 mb-4">
            <div class="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
              {(persona.name || '?')[0]}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-lg font-bold">{persona.name}</h3>
              {#if persona.tag}<div class="text-sm text-dark-900/60 dark:text-dark-100/60">{persona.tag}</div>{/if}
              {#if persona.size_estimate}<div class="text-xs text-primary-600 dark:text-primary-400 font-semibold mt-1">≈ {persona.size_estimate}</div>{/if}
            </div>
          </div>

          {#if persona.demographics}
            <div class="mb-4">
              <div class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-2">📋 ข้อมูลส่วนตัว</div>
              <div class="grid sm:grid-cols-2 gap-2 text-sm">
                {#if persona.demographics.age}<div><span class="text-dark-900/60 dark:text-dark-100/60">อายุ:</span> {persona.demographics.age}</div>{/if}
                {#if persona.demographics.job}<div><span class="text-dark-900/60 dark:text-dark-100/60">อาชีพ:</span> {persona.demographics.job}</div>{/if}
                {#if persona.demographics.income}<div><span class="text-dark-900/60 dark:text-dark-100/60">รายได้:</span> {persona.demographics.income}</div>{/if}
                {#if persona.demographics.location}<div><span class="text-dark-900/60 dark:text-dark-100/60">ที่อยู่:</span> {persona.demographics.location}</div>{/if}
                {#if persona.demographics.family}<div><span class="text-dark-900/60 dark:text-dark-100/60">ครอบครัว:</span> {persona.demographics.family}</div>{/if}
              </div>
            </div>
          {/if}

          {#if persona.psychographics}
            <div class="mb-4">
              <div class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-2">🧠 จิตวิทยา</div>
              <div class="space-y-1 text-sm">
                {#if persona.psychographics.values}<div><span class="text-dark-900/60 dark:text-dark-100/60">ค่านิยม:</span> {persona.psychographics.values}</div>{/if}
                {#if persona.psychographics.interests}<div><span class="text-dark-900/60 dark:text-dark-100/60">สนใจ:</span> {persona.psychographics.interests}</div>{/if}
                {#if persona.psychographics.fears}<div><span class="text-dark-900/60 dark:text-dark-100/60">กลัว:</span> {persona.psychographics.fears}</div>{/if}
                {#if persona.psychographics.aspirations}<div><span class="text-dark-900/60 dark:text-dark-100/60">ใฝ่ฝัน:</span> {persona.psychographics.aspirations}</div>{/if}
              </div>
            </div>
          {/if}

          {#if persona.day_in_life || persona.sample_quotes?.length}
            <div class="mb-4 bg-dark-50 dark:bg-dark-900 rounded-lg p-3">
              <div class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-2">📖 วันหนึ่งของ{persona.name}</div>
              {#if persona.day_in_life}<div class="text-sm mb-2">{persona.day_in_life}</div>{/if}
              {#each (persona.sample_quotes || []) as q}
                <div class="text-sm italic text-dark-900/80 dark:text-dark-100/80 pl-3 border-l-2 border-primary-300 dark:border-primary-700 mb-1">"{q}"</div>
              {/each}
            </div>
          {/if}

          {#if persona.pain_points?.length}
            <div class="mb-4">
              <div class="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">😣 Pain Points (สมมติฐาน)</div>
              <ul class="space-y-1 text-sm">
                {#each persona.pain_points as p}<li class="flex gap-2"><span class="text-red-500">•</span>{p}</li>{/each}
              </ul>
            </div>
          {/if}

          {#if persona.needs?.length}
            <div class="mb-4">
              <div class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-2">✨ Needs</div>
              <ul class="space-y-1 text-sm">
                {#each persona.needs as n}<li class="flex gap-2"><span class="text-primary-500">→</span>{n}</li>{/each}
              </ul>
            </div>
          {/if}

          {#if persona.preferred_channels?.length}
            <div class="mb-4">
              <div class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-2">📱 Preferred Channels</div>
              <div class="flex flex-wrap gap-2">
                {#each persona.preferred_channels as c}<span class="px-3 py-1 bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-sm rounded-full">{c}</span>{/each}
              </div>
            </div>
          {/if}

          {#if persona.best_message}
            <div class="mb-4 bg-primary-50 dark:bg-primary-900/40 border-l-4 border-primary-500 p-3 rounded">
              <div class="text-xs font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider mb-1">💬 Best Message</div>
              <div class="text-sm">{persona.best_message}</div>
            </div>
          {/if}

          {#if persona.best_offer}
            <div class="mb-4 bg-green-50 dark:bg-green-950/40 border-l-4 border-green-500 p-3 rounded">
              <div class="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider mb-1">🎯 Best Offer</div>
              <div class="text-sm">{persona.best_offer}</div>
            </div>
          {/if}

          {#if persona.buying_behavior}
            <div class="mb-4 bg-dark-50 dark:bg-dark-900 rounded-lg p-3">
              <div class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-2">🛒 พฤติกรรมการซื้อ</div>
              <div class="text-sm space-y-1">
                {#if persona.buying_behavior.research_style}<div><span class="text-dark-900/60 dark:text-dark-100/60">หาข้อมูลยังไง:</span> {persona.buying_behavior.research_style}</div>{/if}
                {#if persona.buying_behavior.decision_speed}<div><span class="text-dark-900/60 dark:text-dark-100/60">ตัดสินใจ:</span> {persona.buying_behavior.decision_speed}</div>{/if}
                {#if persona.buying_behavior.objections?.length}
                  <div><span class="text-dark-900/60 dark:text-dark-100/60">อาจลังเลเพราะ:</span> {persona.buying_behavior.objections.join(', ')}</div>
                {/if}
              </div>
            </div>
          {/if}

          {#if persona.validation_methods?.length}
            <details class="mt-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg p-3">
              <summary class="text-xs font-bold text-amber-700 dark:text-amber-400 cursor-pointer">🔍 วิธี validate persona นี้ด้วยข้อมูลจริง</summary>
              <ul class="mt-2 space-y-1 text-sm text-amber-900 dark:text-amber-200">
                {#each persona.validation_methods as v}<li>• {v}</li>{/each}
              </ul>
            </details>
          {/if}
        </div>
      {/each}

      {#if output.how_to_validate?.length}
        <div class="bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700 rounded-xl p-5">
          <div class="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2">📋 วิธี collect ข้อมูลจริง</div>
          <ul class="space-y-1 text-sm text-blue-900 dark:text-blue-200">
            {#each output.how_to_validate as v}<li>• {v}</li>{/each}
          </ul>
        </div>
      {/if}

      <ToolChainHint current="persona_builder" />

      <div class="flex items-center justify-between pt-4 border-t border-dark-100 dark:border-dark-700 flex-wrap gap-2">
        <button onclick={() => { output = null; error = ''; saveId = null; saveMsg = ''; }} class="text-sm text-dark-900/60 dark:text-dark-100/60 hover:text-primary-600 dark:hover:text-primary-400">← สร้างใหม่</button>
        <div class="flex items-center gap-2 flex-wrap">
          {#if saveMsg}
            <span class="text-xs {saveMsg.startsWith('✓') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}">{saveMsg}</span>
          {/if}
          <input type="text" bind:value={saveTitle} placeholder="ตั้งชื่อ (ไม่บังคับ)" class="text-xs px-2 py-1.5 rounded border border-dark-200 dark:border-dark-600 w-40" />
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
