<script lang="ts">
  import ToolLayout from '$lib/ToolLayout.svelte';
  import CanvasPdfButton from '$lib/CanvasPdfButton.svelte';
  import BusinessContextFields from '$lib/BusinessContextFields.svelte';
  import ToolChainHint from '$lib/ToolChainHint.svelte';
  import { runValuePropositionCanvas, saveToolRun, updateToolRun, exportSavedTool, getExportUrl, getMeFull, promoteToolToProject, listSavedTools } from '$lib/api';
  import { goto } from '$app/navigation';
  import { BUSINESS_TYPES, TARGET_AUDIENCES } from '$lib/presets';
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

  let customer_age = $state('');
  let customer_job = $state('');
  let customer_income = $state('');

  let product_description = $state('');
  let product_features = $state('');
  let main_problem = $state('');
  let current_solutions = $state('');
  let desired_outcome = $state('');
  let user_notes = $state('');

  // JTBD pre-fill
  let jtbd_saves = $state<any[]>([]);
  let selectedJtbdId = $state('');

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

  // Load JTBD saves on mount
  $effect(() => {
    listSavedTools({ tool_type: 'jtbd_generator' })
      .then(saves => { jtbd_saves = saves || []; })
      .catch(() => {});
  });

  function buildJtbdContext(): string {
    if (!selectedJtbdId) return '';
    const save = jtbd_saves.find(s => s.id === selectedJtbdId);
    if (!save) return '';
    return `Job statement: ${save?.output?.primary_job?.job_statement || '-'}
Functional: ${save?.output?.primary_job?.dimensions?.functional || '-'}
Emotional: ${save?.output?.primary_job?.dimensions?.emotional || '-'}
Social: ${save?.output?.primary_job?.dimensions?.social || '-'}
Top pains: ${(save?.output?.related_jobs || []).slice(0, 3).map((r: any) => r.job).join('; ')}`;
  }

  $effect(() => {
    try {
      const raw = sessionStorage.getItem('tool_edit_input');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.tool_type !== 'value_proposition_canvas') return;
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
      if (input.customer_age) customer_age = input.customer_age;
      if (input.customer_job) customer_job = input.customer_job;
      if (input.customer_income) customer_income = input.customer_income;
      if (input.product_description) product_description = input.product_description;
      if (input.product_features) product_features = input.product_features;
      if (input.main_problem) main_problem = input.main_problem;
      if (input.current_solutions) current_solutions = input.current_solutions;
      if (input.desired_outcome) desired_outcome = input.desired_outcome;
      if (input.user_notes) user_notes = input.user_notes;
      if (Array.isArray(input.target_audience_ids)) {
        target_audience_pre = input.target_audience_ids.filter((id: string) =>
          TARGET_AUDIENCES.some(a => a.id === id)
        );
      }
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
    if (!product_description.trim()) { error = 'กรุณาอธิบาย product/service'; return; }

    error = '';
    isGenerating = true;
    output = null;
    try {
      const res = await runValuePropositionCanvas({
        business_name,
        business_type: resolvedBusinessType,
        industry: resolvedIndustry,
        location: location.trim(),
        target_audience: resolvedTargetAudience,
        differentiation: differentiation.trim(),
        price_range: price_range.trim(),
        customer_age: customer_age.trim(),
        customer_job: customer_job.trim(),
        customer_income: customer_income.trim(),
        product_description: product_description.trim(),
        product_features: product_features.trim(),
        main_problem: main_problem.trim(),
        current_solutions: current_solutions.trim(),
        desired_outcome: desired_outcome.trim(),
        jtbd_context: buildJtbdContext(),
        user_notes: user_notes.trim(),
      });
      output = res.output;
    } catch (err: any) {
      error = err.message || 'AI error';
    } finally {
      isGenerating = false;
    }
  }

  async function handleSave() {
    if (!output) return;
    isSaving = true;
    saveMsg = '';
    try {
      const title = saveTitle.trim() || `VPC — ${business_name} ${new Date().toLocaleDateString('th-TH')}`;
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
        customer_age: customer_age.trim(),
        customer_job: customer_job.trim(),
        customer_income: customer_income.trim(),
        product_description: product_description.trim(),
        product_features: product_features.trim(),
        main_problem: main_problem.trim(),
        current_solutions: current_solutions.trim(),
        desired_outcome: desired_outcome.trim(),
        user_notes: user_notes.trim(),
        jtbd_save_id: selectedJtbdId || '',
        business_type_resolved: resolvedBusinessType,
        industry_resolved: resolvedIndustry,
        target_audience_resolved: resolvedTargetAudience,
      };
      if (saveId) {
        await updateToolRun(saveId, { input: payload, output });
        saveMsg = '✓ อัปเดตเรียบร้อย';
      } else {
        const res = await saveToolRun('value_proposition_canvas', payload, output, title);
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
      a.download = `vpc.${format}`;
      a.target = '_blank';
      a.click();
    } catch (err: any) { alert(err.message); }
  }

  async function handleCanvasPDF() {
    if (!saveId) { await handleSave(); }
    if (!saveId) return;
    try {
      const res = await exportSavedTool(saveId, 'pdf');
      // Open canvas in new tab with auto-print
      const url = `${PUBLIC_API_URL}${res.download_url}?print=1`;
      const win = window.open(url, '_blank');
      if (!win) alert('กรุณาอนุญาต popup เพื่อเปิด Canvas');
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

  const intensityColor = (i: string) => {
    if (i === 'extreme') return 'bg-red-100 text-red-800 border-red-300';
    if (i === 'high' || i === 'essential') return 'bg-red-100 text-red-800 border-red-300';
    if (i === 'medium' || i === 'important') return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };
  const intensityLabel = (i: string) => {
    return ({ extreme: '🔥 extreme', essential: '⭐ essential', high: '🔴 high', important: '🟡 important', medium: '🟡 medium', low: '🟢 low', nice_to_have: '🟢 nice-to-have', strong: '💪 strong' } as any)[i] || i;
  };
  const fitScoreColor = (s: number) => {
    if (s >= 8) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (s >= 6) return 'bg-amber-100 text-amber-800 border-amber-300';
    if (s >= 4) return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };
</script>

<ToolLayout
  title="Value Proposition Canvas"
  subtitle="ออกแบบ Value Proposition ที่ match กับ Customer — Problem-Solution Fit (Osterwalder + Pigneur)"
  icon="💎"
  color="purple"
>
  {#if !output}
    <div class="space-y-5">
      <div class="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
        <div class="font-semibold text-purple-900 mb-1">💎 Value Proposition Canvas (Osterwalder 2014)</div>
        <div class="text-sm text-purple-800 space-y-1">
          <div><b>2 ฝั่ง:</b> Customer Profile (Jobs + Pains + Gains) ↔ Value Map (Products + Pain Relievers + Gain Creators)</div>
          <div><b>Goal:</b> FIT = top pains ถูก relievers + top gains ถูก creators</div>
          <div><b>3 Types of Fit:</b> Problem-Solution → Product-Market → Business Model</div>
          <div><b>Bridge:</b> ต่อจาก JTBD (Jobs) → ไปสู่ BMC (Business Model)</div>
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">ชื่อธุรกิจ *</label>
        <input
          type="text"
          bind:value={business_name}
          placeholder="เช่น ร้านก๋วยเตี๋ยวลุงใบหยก"
          class="w-full px-3 py-2.5 rounded-lg border border-dark-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
          <input type="text" bind:value={location} placeholder="เช่น หาดใหญ่" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1.5">ช่วงราคา</label>
          <input type="text" bind:value={price_range} placeholder="เช่น 50-150 บาท" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">จุดต่าง (ถ้ามี)</label>
        <input type="text" bind:value={differentiation} placeholder="เช่น ใช้วัตถุดิบออร์แกนิค" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>

      <!-- Customer profile (mini) -->
      <div class="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-xl p-4">
        <div class="font-semibold text-cyan-900 mb-2">👤 Customer (สำหรับ Customer Profile)</div>
        <div class="grid sm:grid-cols-3 gap-3">
          <div>
            <label class="block text-xs font-semibold text-cyan-800 mb-1">อายุ</label>
            <input type="text" bind:value={customer_age} placeholder="28-40" class="w-full px-2.5 py-1.5 rounded border border-cyan-200 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-cyan-800 mb-1">อาชีพ</label>
            <input type="text" bind:value={customer_job} placeholder="พนักงานออฟฟิศ" class="w-full px-2.5 py-1.5 rounded border border-cyan-200 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-cyan-800 mb-1">รายได้</label>
            <input type="text" bind:value={customer_income} placeholder="25,000-50,000" class="w-full px-2.5 py-1.5 rounded border border-cyan-200 text-sm" />
          </div>
        </div>
      </div>

      <!-- Product/Service (the heart of Value Map) -->
      <div class="bg-gradient-to-r from-rose-50 to-pink-50 border-2 border-rose-300 rounded-xl p-4 space-y-3">
        <div class="font-semibold text-rose-900">📦 Product / Service (สำหรับ Value Map) *</div>
        <div>
          <label class="block text-xs font-semibold text-rose-800 mb-1">📦 Product/Service คืออะไร *</label>
          <textarea bind:value={product_description} rows="3" placeholder="เช่น ขนมบ้านโกไข่ เป็นร้านขนมใต้สูตรโบราณ มี 28 สาขาในกรุงเทพ + ภาคใต้ เน้นขนมคุณภาพสูง บรรจุภัณฑ์สวย ขายทั้งหน้าร้าน + ออนไลน์" class="w-full px-2.5 py-1.5 rounded border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"></textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-rose-800 mb-1">✨ Features / จุดเด่น</label>
          <textarea bind:value={product_features} rows="2" placeholder="เช่น 1) สูตรโบราณจากครอบครัว 2) ใช้วัตถุดิบสดใหม่ทุกวัน 3) บรรจุภัณฑ์ premium 4) ส่งฟรีในกรุงเทพ 5) มีหน้าร้านให้สัมผัส 28 สาขา" class="w-full px-2.5 py-1.5 rounded border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"></textarea>
        </div>
      </div>

      <!-- Customer Context (for Customer Profile) -->
      <div class="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 space-y-3">
        <div class="font-semibold text-amber-900">🧠 Customer Context (สำหรับ Customer Profile)</div>
        <div>
          <label class="block text-xs font-semibold text-amber-800 mb-1">😰 Main Problem — ลูกค้าเจอปัญหาอะไร</label>
          <textarea bind:value={main_problem} rows="2" placeholder="เช่น อยากกินขนมใต้แท้ในกรุงเทพ แต่หาซื้อยาก กลัวได้ของไม่สด" class="w-full px-2.5 py-1.5 rounded border border-amber-200 text-sm"></textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-amber-800 mb-1">🛠 Current Solutions — ตอนนี้ใช้อะไรอยู่</label>
          <textarea bind:value={current_solutions} rows="2" placeholder="เช่น ซื้อขนมจากห้าง แต่รสไม่ใช่ขนมใต้แท้ / สั่งออนไลน์แต่รอนาน" class="w-full px-2.5 py-1.5 rounded border border-amber-200 text-sm"></textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-amber-800 mb-1">✨ Desired Outcome — ลูกค้าอยากได้อะไร</label>
          <textarea bind:value={desired_outcome} rows="2" placeholder="เช่น ได้กินขนมใต้แท้รสชาติเหมือนอยู่บ้าน สะดวก ราคาไม่แพง ได้ความภูมิใจ" class="w-full px-2.5 py-1.5 rounded border border-amber-200 text-sm"></textarea>
        </div>
      </div>

      <!-- Optional JTBD pre-fill -->
      {#if jtbd_saves.length > 0}
        <div class="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-xl p-3">
          <div class="font-semibold text-amber-900 mb-2 text-sm">🔗 เชื่อม JTBD ที่เคยวิเคราะห์ไว้ (optional — แนะนำ)</div>
          <select bind:value={selectedJtbdId} class="w-full px-3 py-2 rounded border border-amber-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
            <option value="">— ไม่ใช้ JTBD —</option>
            {#each jtbd_saves as jtbd}
              <option value={jtbd.id}>📋 {jtbd.title} ({new Date(jtbd.created_at).toLocaleDateString('th-TH')})</option>
            {/each}
          </select>
          <div class="text-xs text-amber-700 mt-1.5">ถ้าเลือก ระบบจะ pre-fill Customer Profile จาก JTBD ที่เคยวิเคราะห์ไว้</div>
        </div>
      {/if}

      <div>
        <label class="block text-sm font-semibold mb-1.5">โน้ตเพิ่มเติม <span class="text-dark-900/50 font-normal">(optional)</span></label>
        <textarea bind:value={user_notes} rows="2" placeholder="อะไรก็ได้ที่อยากให้ AI รู้เพิ่ม..." class="w-full px-3 py-2.5 rounded-lg border border-dark-200 focus:outline-none focus:ring-2 focus:ring-primary-500"></textarea>
      </div>

      {#if error}
        <div class="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      {/if}

      <div class="pt-4 flex items-center justify-end border-t border-dark-100">
        <button
          onclick={handleGenerate}
          disabled={isGenerating}
          class="btn-primary disabled:opacity-50"
        >
          {isGenerating ? '⏳ AI กำลังออกแบบ VPC...' : '💎 ออกแบบ Value Proposition'}
        </button>
      </div>
    </div>
  {:else}
    <!-- Results -->
    <div class="space-y-5">
      {#if output.summary}
        <div class="bg-primary-50 border-l-4 border-primary-500 p-4 rounded-lg">
          <div class="text-xs font-bold text-primary-700 uppercase tracking-wider mb-1">สรุป VPC</div>
          <div class="text-dark-900">{output.summary}</div>
        </div>
      {/if}

      <!-- Customer Segment -->
      {#if output.customer_segment}
        <div class="bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-blue-500 p-3 rounded">
          <div class="text-xs font-bold text-blue-700 uppercase mb-1">👤 Customer Segment</div>
          <div class="text-sm font-semibold text-blue-900">{output.customer_segment.name || '-'}</div>
          <div class="text-xs text-blue-800 mt-0.5">{output.customer_segment.description || '-'}</div>
        </div>
      {/if}

      <!-- 2-column: Customer Profile (left) + Value Map (right) -->
      <div class="grid lg:grid-cols-2 gap-4">
        <!-- Customer Profile -->
        <div class="space-y-3">
          <h3 class="font-semibold text-lg flex items-center gap-2">
            <span>👤 Customer Profile</span>
            <span class="text-xs text-dark-900/50">(right circle)</span>
          </h3>
          {#if output.customer_profile?.jobs?.length}
            <div class="bg-white border-2 border-blue-200 rounded-lg p-3">
              <div class="text-xs font-bold text-blue-700 uppercase mb-2">🔧 Jobs (3-{output.customer_profile.jobs.length})</div>
              <div class="space-y-1.5">
                {#each output.customer_profile.jobs as j}
                  <div class="bg-blue-50 rounded p-2 text-xs">
                    <div class="flex items-center gap-1.5 mb-0.5">
                      <span class="px-1.5 py-0.5 rounded text-[10px] border {intensityColor(j.importance)}">{intensityLabel(j.importance)}</span>
                      <span class="text-[10px] text-dark-900/60">[{j.type}]</span>
                    </div>
                    <div class="text-dark-900">{j.job}</div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          {#if output.customer_profile?.pains?.length}
            <div class="bg-white border-2 border-red-200 rounded-lg p-3">
              <div class="text-xs font-bold text-red-700 uppercase mb-2">😰 Pains (3-{output.customer_profile.pains.length})</div>
              <div class="space-y-1.5">
                {#each output.customer_profile.pains as p}
                  <div class="bg-red-50 rounded p-2 text-xs">
                    <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span class="px-1.5 py-0.5 rounded text-[10px] border {intensityColor(p.intensity)}">{intensityLabel(p.intensity)}</span>
                      <span class="text-[10px] text-dark-900/60">{p.frequency}</span>
                      <span class="text-[10px] text-dark-900/60">[{p.category}]</span>
                    </div>
                    <div class="text-red-900">{p.pain}</div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          {#if output.customer_profile?.gains?.length}
            <div class="bg-white border-2 border-emerald-200 rounded-lg p-3">
              <div class="text-xs font-bold text-emerald-700 uppercase mb-2">✨ Gains (3-{output.customer_profile.gains.length})</div>
              <div class="space-y-1.5">
                {#each output.customer_profile.gains as g}
                  <div class="bg-emerald-50 rounded p-2 text-xs">
                    <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span class="px-1.5 py-0.5 rounded text-[10px] border {intensityColor(g.relevance)}">{intensityLabel(g.relevance)}</span>
                      <span class="text-[10px] text-dark-900/60">[{g.category}]</span>
                    </div>
                    <div class="text-emerald-900">{g.gain}</div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Value Map -->
        <div class="space-y-3">
          <h3 class="font-semibold text-lg flex items-center gap-2">
            <span>🗺️ Value Map</span>
            <span class="text-xs text-dark-900/50">(left square)</span>
          </h3>
          {#if output.value_map?.products_services?.length}
            <div class="bg-white border-2 border-purple-200 rounded-lg p-3">
              <div class="text-xs font-bold text-purple-700 uppercase mb-2">📦 Products & Services (3-{output.value_map.products_services.length})</div>
              <div class="space-y-1.5">
                {#each output.value_map.products_services as ps}
                  <div class="bg-purple-50 rounded p-2 text-xs">
                    <div class="flex items-center gap-1.5 mb-0.5">
                      <span class="font-bold text-purple-900">{ps.name}</span>
                      <span class="text-[10px] text-dark-900/60">[{ps.type}]</span>
                    </div>
                    <div class="text-purple-900">{ps.description}</div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          {#if output.value_map?.pain_relievers?.length}
            <div class="bg-white border-2 border-orange-200 rounded-lg p-3">
              <div class="text-xs font-bold text-orange-700 uppercase mb-2">💊 Pain Relievers (3-{output.value_map.pain_relievers.length})</div>
              <div class="space-y-1.5">
                {#each output.value_map.pain_relievers as r}
                  <div class="bg-orange-50 rounded p-2 text-xs">
                    <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span class="px-1.5 py-0.5 rounded text-[10px] border {intensityColor(r.intensity)}">{intensityLabel(r.intensity)}</span>
                      <span class="text-[10px] text-dark-900/60">[{r.pattern}]</span>
                    </div>
                    <div class="text-orange-900">{r.reliever}</div>
                    {#if r.addresses_pain}
                      <div class="text-[10px] text-orange-700/70 mt-0.5">→ แก้: {r.addresses_pain}</div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          {#if output.value_map?.gain_creators?.length}
            <div class="bg-white border-2 border-teal-200 rounded-lg p-3">
              <div class="text-xs font-bold text-teal-700 uppercase mb-2">🎁 Gain Creators (3-{output.value_map.gain_creators.length})</div>
              <div class="space-y-1.5">
                {#each output.value_map.gain_creators as c}
                  <div class="bg-teal-50 rounded p-2 text-xs">
                    <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span class="px-1.5 py-0.5 rounded text-[10px] border {intensityColor(c.strength)}">{intensityLabel(c.strength)}</span>
                      <span class="text-[10px] text-dark-900/60">[{c.pattern}]</span>
                    </div>
                    <div class="text-teal-900">{c.creator}</div>
                    {#if c.addresses_gain}
                      <div class="text-[10px] text-teal-700/70 mt-0.5">→ ตอบ: {c.addresses_gain}</div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Fit Analysis -->
      {#if output.fit_analysis}
        {@const fa = output.fit_analysis}
        <div class="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300 rounded-2xl p-5">
          <h3 class="font-semibold text-lg mb-3 text-indigo-900">⚖️ Fit Analysis</h3>
          <div class="flex items-center gap-3 mb-3">
            <div class="text-xs font-bold text-indigo-700">Overall Fit:</div>
            <span class="px-3 py-1 rounded-lg border-2 text-sm font-bold {fitScoreColor(fa.overall_fit_score || 0)}">
              {fa.overall_fit_score || '-'}/10 — {fa.fit_verdict || '-'}
            </span>
          </div>

          <div class="grid sm:grid-cols-2 gap-3 mb-3">
            {#if fa.matched_pains?.length}
              <div class="bg-white border border-emerald-300 rounded p-2.5">
                <div class="text-xs font-bold text-emerald-800 mb-1.5">✅ Matched Pains ({fa.matched_pains.length})</div>
                <ul class="space-y-0.5 text-xs text-emerald-900">
                  {#each fa.matched_pains as m}
                    <li>• <b>{m.pain}</b> → {m.reliever} [{m.strength}]</li>
                  {/each}
                </ul>
              </div>
            {/if}
            {#if fa.matched_gains?.length}
              <div class="bg-white border border-emerald-300 rounded p-2.5">
                <div class="text-xs font-bold text-emerald-800 mb-1.5">✅ Matched Gains ({fa.matched_gains.length})</div>
                <ul class="space-y-0.5 text-xs text-emerald-900">
                  {#each fa.matched_gains as m}
                    <li>• <b>{m.gain}</b> → {m.creator} [{m.strength}]</li>
                  {/each}
                </ul>
              </div>
            {/if}
            {#if fa.uncovered_pains?.length}
              <div class="bg-white border border-rose-300 rounded p-2.5">
                <div class="text-xs font-bold text-rose-800 mb-1.5">⚠️ Uncovered Pains ({fa.uncovered_pains.length})</div>
                <ul class="space-y-1 text-xs text-rose-900">
                  {#each fa.uncovered_pains as u}
                    <li>• <b>{u.pain}</b> [{u.intensity}] → {u.recommendation}</li>
                  {/each}
                </ul>
              </div>
            {/if}
            {#if fa.uncovered_gains?.length}
              <div class="bg-white border border-rose-300 rounded p-2.5">
                <div class="text-xs font-bold text-rose-800 mb-1.5">⚠️ Uncovered Gains ({fa.uncovered_gains.length})</div>
                <ul class="space-y-1 text-xs text-rose-900">
                  {#each fa.uncovered_gains as u}
                    <li>• <b>{u.gain}</b> [{u.relevance}] → {u.recommendation}</li>
                  {/each}
                </ul>
              </div>
            {/if}
          </div>

          {#if fa.orphans?.length}
            <div class="bg-amber-50 border-l-4 border-amber-400 rounded-r p-2.5 text-xs text-amber-900">
              <b>🗑️ Orphans (over-engineering):</b>
              <ul class="mt-1 space-y-0.5">
                {#each fa.orphans as o}
                  <li>• {o}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Value Proposition Statement -->
      {#if output.value_proposition_statement}
        <div class="bg-gradient-to-br from-rose-50 to-pink-50 border-2 border-rose-400 rounded-2xl p-5">
          <h3 class="font-semibold text-lg mb-2 text-rose-900">💎 Value Proposition Statement</h3>
          <div class="bg-white rounded-lg p-4 border border-rose-200 italic text-rose-900">
            "{output.value_proposition_statement}"
          </div>
        </div>
      {/if}

      {#if output.elevator_pitch}
        <div class="bg-amber-50 border-l-4 border-amber-400 p-3 rounded">
          <div class="text-xs font-bold text-amber-800 uppercase mb-1">⏱️ 30-Second Elevator Pitch</div>
          <div class="text-sm italic text-amber-900">"{output.elevator_pitch}"</div>
        </div>
      {/if}

      <!-- What most brands get wrong -->
      {#if output.what_most_brands_get_wrong}
        <div class="bg-rose-50 border-l-4 border-rose-400 p-3 rounded text-sm text-rose-900">
          <b>⚠️ ที่แบรนด์ส่วนใหญ่ทำผิด:</b> {output.what_most_brands_get_wrong}
        </div>
      {/if}

      <!-- Validation methods -->
      {#if output.validation_methods?.length}
        <div class="bg-white border border-dark-200 rounded-lg p-3">
          <div class="text-xs font-bold text-dark-900/60 uppercase mb-1.5">🔬 Validation Methods</div>
          <ul class="space-y-0.5 text-sm text-dark-900/80">
            {#each output.validation_methods as v}
              <li>• {v}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <!-- Next steps -->
      {#if output.next_steps?.length}
        <div class="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3">
          <div class="text-xs font-bold text-emerald-800 uppercase mb-1.5">➡️ Next Steps</div>
          <ul class="space-y-0.5 text-sm text-emerald-900">
            {#each output.next_steps as s}
              <li class="flex gap-1.5"><span>→</span>{s}</li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if output.reasoning}
        <div class="bg-white border border-dark-100 rounded-xl p-4 text-sm italic text-dark-900/70">
          💡 {output.reasoning}
        </div>
      {/if}

      <!-- Action bar -->
      <ToolChainHint current="value_proposition_canvas" />
      <div class="flex items-center justify-between pt-4 border-t border-dark-100 flex-wrap gap-2">
        <button onclick={() => { output = null; error = ''; saveId = null; saveMsg = ''; }} class="text-sm text-dark-900/60 hover:text-primary-600">
          ← ออกแบบใหม่
        </button>
        <div class="flex items-center gap-2 flex-wrap">
          {#if saveMsg}
            <span class="text-xs {saveMsg.startsWith('✓') ? 'text-green-700' : 'text-red-700'}">{saveMsg}</span>
          {/if}
          <input type="text" bind:value={saveTitle} placeholder="ตั้งชื่อ (ไม่บังคับ)" class="text-xs px-2 py-1.5 rounded border border-dark-200 w-40" />
          <button onclick={handleSave} disabled={isSaving} class="text-sm btn-secondary disabled:opacity-50">
            {isSaving ? '...' : (saveId ? '✓ บันทึกแล้ว' : '💾 บันทึก')}
          </button>
          <button onclick={handlePromote} disabled={isPromoting} class="text-sm btn-secondary disabled:opacity-50" title="บันทึกเป็นโปรเจกต์ (import เข้า step 1, 2, 4, 5)">
            {isPromoting ? '...' : '📋 เป็น Playbook'}
          </button>
          {#if saveId}<CanvasPdfButton saveId={saveId} />{/if}
          <button onclick={() => handleExport('md')} class="text-sm btn-secondary">📥 .md</button>
          <button onclick={() => handleExport('json')} class="text-sm btn-secondary">📥 .json</button>
          <button onclick={handleCanvasPDF} class="text-sm btn-primary" title="เปิด One-page Canvas PDF (A3 landscape)">🎨 Canvas PDF</button>
        </div>
      </div>
      {#if promoteMsg}
        <div class="mt-2 text-xs {promoteMsg.startsWith('✓') ? 'text-green-700' : 'text-red-700'}">{promoteMsg}</div>
      {/if}
    </div>
  {/if}
</ToolLayout>
