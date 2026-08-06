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
  let showPrinciple = $state(false);

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
      if (!win) alert('กรุณาอนุญาต popup เพื่อเปิดใบสรุป (PDF)');
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
    if (i === 'extreme') return 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700';
    if (i === 'high' || i === 'essential') return 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700';
    if (i === 'medium' || i === 'important') return 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700';
    return 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700';
  };
  const intensityLabel = (i: string) => {
    return ({ extreme: '🔥 extreme', essential: '⭐ essential', high: '🔴 high', important: '🟡 important', medium: '🟡 medium', low: '🟢 low', nice_to_have: '🟢 nice-to-have', strong: '💪 strong' } as any)[i] || i;
  };
  const fitScoreColor = (s: number) => {
    if (s >= 8) return 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700';
    if (s >= 6) return 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700';
    if (s >= 4) return 'bg-orange-100 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-700';
    return 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700';
  };
</script>

<ToolLayout
  title="เช็คว่าสินค้าคุณตรงใจลูกค้าไหม"
  subtitle="เทียบสิ่งที่ลูกค้าอยากได้ กับสิ่งที่สินค้าคุณให้ได้จริง แล้วดูว่าตรงกันแค่ไหน"
  icon="💎"
  color="purple"
>
  {#if !output}
    <div class="space-y-5">
      <div class="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/40 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
        <div class="font-semibold text-purple-900 dark:text-purple-200 mb-1">💎 เครื่องมือนี้ช่วยอะไร</div>
        <div class="text-sm text-purple-800 dark:text-purple-300 space-y-1">
          <div>บอกข้อมูลลูกค้า (ปัญหา + สิ่งที่อยากได้) และข้อมูลสินค้าคุณ (จุดเด่น + วิธีแก้ปัญหา) แล้วระบบจะเทียบให้ว่าตรงกันแค่ไหน</div>
          <div>ได้ผลลัพธ์เป็นจุดที่สินค้าคุณตอบโจทย์ลูกค้าแล้ว จุดที่ยังขาด และประโยคขายที่เอาไปใช้ต่อได้เลย</div>
        </div>
        <button
          type="button"
          onclick={() => showPrinciple = !showPrinciple}
          class="mt-2 text-xs text-purple-700/70 dark:text-purple-300/70 underline decoration-dotted hover:text-purple-700 dark:hover:text-purple-300"
        >
          {showPrinciple ? 'ซ่อนหลักการ' : 'ดูหลักการ'}
        </button>
        {#if showPrinciple}
          <div class="mt-1.5 text-xs text-purple-700/70 dark:text-purple-300/70">
            อิงหลักการ Value Proposition Canvas ของ Osterwalder — เทียบฝั่งลูกค้า (Jobs/Pains/Gains) กับฝั่งสินค้าคุณ (Products/Pain Relievers/Gain Creators) เพื่อหาว่า "Fit" กันแค่ไหน
          </div>
        {/if}
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
          <input type="text" bind:value={location} placeholder="เช่น หาดใหญ่" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1.5">ช่วงราคา</label>
          <input type="text" bind:value={price_range} placeholder="เช่น 50-150 บาท" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">จุดต่าง (ถ้ามี)</label>
        <input type="text" bind:value={differentiation} placeholder="เช่น ใช้วัตถุดิบออร์แกนิค" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>

      <!-- Customer profile (mini) -->
      <div class="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/40 dark:to-blue-950/40 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4">
        <div class="font-semibold text-cyan-900 dark:text-cyan-200 mb-2">👤 ข้อมูลลูกค้า</div>
        <div class="grid sm:grid-cols-3 gap-3">
          <div>
            <label class="block text-xs font-semibold text-cyan-800 dark:text-cyan-300 mb-1">อายุ</label>
            <input type="text" bind:value={customer_age} placeholder="28-40" class="w-full px-2.5 py-1.5 rounded border border-cyan-200 dark:border-cyan-800 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-cyan-800 dark:text-cyan-300 mb-1">อาชีพ</label>
            <input type="text" bind:value={customer_job} placeholder="พนักงานออฟฟิศ" class="w-full px-2.5 py-1.5 rounded border border-cyan-200 dark:border-cyan-800 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-cyan-800 dark:text-cyan-300 mb-1">รายได้</label>
            <input type="text" bind:value={customer_income} placeholder="25,000-50,000" class="w-full px-2.5 py-1.5 rounded border border-cyan-200 dark:border-cyan-800 text-sm" />
          </div>
        </div>
      </div>

      <!-- Product/Service (the heart of Value Map) -->
      <div class="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/40 border-2 border-rose-300 dark:border-rose-700 rounded-xl p-4 space-y-3">
        <div class="font-semibold text-rose-900 dark:text-rose-200">📦 สินค้า/บริการของคุณ *</div>
        <div>
          <label class="block text-xs font-semibold text-rose-800 dark:text-rose-300 mb-1">📦 สินค้า/บริการของคุณคืออะไร *</label>
          <textarea bind:value={product_description} rows="3" placeholder="เช่น ขนมบ้านโกไข่ เป็นร้านขนมใต้สูตรโบราณ มี 28 สาขาในกรุงเทพ + ภาคใต้ เน้นขนมคุณภาพสูง บรรจุภัณฑ์สวย ขายทั้งหน้าร้าน + ออนไลน์" class="w-full px-2.5 py-1.5 rounded border border-rose-200 dark:border-rose-800 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"></textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-rose-800 dark:text-rose-300 mb-1">✨ จุดเด่น/ฟีเจอร์เด่น</label>
          <textarea bind:value={product_features} rows="2" placeholder="เช่น 1) สูตรโบราณจากครอบครัว 2) ใช้วัตถุดิบสดใหม่ทุกวัน 3) บรรจุภัณฑ์อย่างดี 4) ส่งฟรีในกรุงเทพ 5) มีหน้าร้านให้สัมผัส 28 สาขา" class="w-full px-2.5 py-1.5 rounded border border-rose-200 dark:border-rose-800 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"></textarea>
        </div>
      </div>

      <!-- Customer Context (for Customer Profile) -->
      <div class="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
        <div class="font-semibold text-amber-900 dark:text-amber-200">🧠 บริบทของลูกค้า</div>
        <div>
          <label class="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">😰 ลูกค้าเจอปัญหาอะไร</label>
          <textarea bind:value={main_problem} rows="2" placeholder="เช่น อยากกินขนมใต้แท้ในกรุงเทพ แต่หาซื้อยาก กลัวได้ของไม่สด" class="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-800 text-sm"></textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">🛠 ตอนนี้ลูกค้าแก้ปัญหานี้ด้วยอะไร</label>
          <textarea bind:value={current_solutions} rows="2" placeholder="เช่น ซื้อขนมจากห้าง แต่รสไม่ใช่ขนมใต้แท้ / สั่งออนไลน์แต่รอนาน" class="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-800 text-sm"></textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">✨ ลูกค้าอยากได้อะไรสุดท้าย</label>
          <textarea bind:value={desired_outcome} rows="2" placeholder="เช่น ได้กินขนมใต้แท้รสชาติเหมือนอยู่บ้าน สะดวก ราคาไม่แพง ได้ความภูมิใจ" class="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-800 text-sm"></textarea>
        </div>
      </div>

      <!-- Optional JTBD pre-fill -->
      {#if jtbd_saves.length > 0}
        <div class="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40 border border-amber-300 dark:border-amber-700 rounded-xl p-3">
          <div class="font-semibold text-amber-900 dark:text-amber-200 mb-2 text-sm">🔗 เชื่อมข้อมูลจาก "เข้าใจว่าลูกค้าจ้างเราทำอะไร" ที่เคยวิเคราะห์ไว้ (ไม่บังคับ — แนะนำ)</div>
          <select bind:value={selectedJtbdId} class="w-full px-3 py-2 rounded border border-amber-200 dark:border-amber-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
            <option value="">— ไม่ใช้ —</option>
            {#each jtbd_saves as jtbd}
              <option value={jtbd.id}>📋 {jtbd.title} ({new Date(jtbd.created_at).toLocaleDateString('th-TH')})</option>
            {/each}
          </select>
          <div class="text-xs text-amber-700 dark:text-amber-400 mt-1.5">ถ้าเลือก ระบบจะเติมข้อมูลลูกค้าให้อัตโนมัติจากที่เคยวิเคราะห์ไว้</div>
        </div>
      {/if}

      <div>
        <label class="block text-sm font-semibold mb-1.5">โน้ตเพิ่มเติม <span class="text-dark-900/50 dark:text-dark-100/50 font-normal">(optional)</span></label>
        <textarea bind:value={user_notes} rows="2" placeholder="อะไรก็ได้ที่อยากให้ ระบบอัจฉริยะ รู้เพิ่ม..." class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500"></textarea>
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
          {isGenerating ? '⏳ ระบบอัจฉริยะ กำลังวิเคราะห์...' : '💎 เช็คว่าตรงใจลูกค้าไหม'}
        </button>
      </div>
    </div>
  {:else}
    <!-- Results -->
    <div class="space-y-5">
      {#if output.summary}
        <div class="bg-primary-50 dark:bg-primary-900/40 border-l-4 border-primary-500 p-4 rounded-lg">
          <div class="text-xs font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider mb-1">สรุปผล</div>
          <div class="text-dark-900 dark:text-dark-50">{output.summary}</div>
        </div>
      {/if}

      <!-- Customer Segment -->
      {#if output.customer_segment}
        <div class="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40 border-l-4 border-blue-500 dark:border-blue-600 p-3 rounded">
          <div class="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase mb-1">👤 กลุ่มลูกค้า</div>
          <div class="text-sm font-semibold text-blue-900 dark:text-blue-200">{output.customer_segment.name || '-'}</div>
          <div class="text-xs text-blue-800 dark:text-blue-300 mt-0.5">{output.customer_segment.description || '-'}</div>
        </div>
      {/if}

      <!-- 2-column: Customer Profile (left) + Value Map (right) -->
      <div class="grid lg:grid-cols-2 gap-4">
        <!-- Customer Profile -->
        <div class="space-y-3">
          <h3 class="font-semibold text-lg flex items-center gap-2">
            <span>👤 ฝั่งลูกค้า</span>
          </h3>
          {#if output.customer_profile?.jobs?.length}
            <div class="bg-white dark:bg-dark-800 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div class="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase mb-2">🔧 สิ่งที่ลูกค้าอยากทำให้สำเร็จ ({output.customer_profile.jobs.length})</div>
              <div class="space-y-1.5">
                {#each output.customer_profile.jobs as j}
                  <div class="bg-blue-50 dark:bg-blue-950/40 rounded p-2 text-xs">
                    <div class="flex items-center gap-1.5 mb-0.5">
                      <span class="px-1.5 py-0.5 rounded text-[10px] border {intensityColor(j.importance)}">{intensityLabel(j.importance)}</span>
                      <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">[{j.type}]</span>
                    </div>
                    <div class="text-dark-900 dark:text-dark-50">{j.job}</div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          {#if output.customer_profile?.pains?.length}
            <div class="bg-white dark:bg-dark-800 border-2 border-red-200 dark:border-red-800 rounded-lg p-3">
              <div class="text-xs font-bold text-red-700 dark:text-red-400 uppercase mb-2">😰 ปัญหาที่ลูกค้าเจอ ({output.customer_profile.pains.length})</div>
              <div class="space-y-1.5">
                {#each output.customer_profile.pains as p}
                  <div class="bg-red-50 dark:bg-red-950/40 rounded p-2 text-xs">
                    <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span class="px-1.5 py-0.5 rounded text-[10px] border {intensityColor(p.intensity)}">{intensityLabel(p.intensity)}</span>
                      <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">{p.frequency}</span>
                      <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">[{p.category}]</span>
                    </div>
                    <div class="text-red-900 dark:text-red-200">{p.pain}</div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          {#if output.customer_profile?.gains?.length}
            <div class="bg-white dark:bg-dark-800 border-2 border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
              <div class="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-2">✨ สิ่งที่ลูกค้าอยากได้เพิ่ม ({output.customer_profile.gains.length})</div>
              <div class="space-y-1.5">
                {#each output.customer_profile.gains as g}
                  <div class="bg-emerald-50 dark:bg-emerald-950/40 rounded p-2 text-xs">
                    <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span class="px-1.5 py-0.5 rounded text-[10px] border {intensityColor(g.relevance)}">{intensityLabel(g.relevance)}</span>
                      <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">[{g.category}]</span>
                    </div>
                    <div class="text-emerald-900 dark:text-emerald-200">{g.gain}</div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Value Map -->
        <div class="space-y-3">
          <h3 class="font-semibold text-lg flex items-center gap-2">
            <span>🗺️ ฝั่งสินค้าคุณ</span>
          </h3>
          {#if output.value_map?.products_services?.length}
            <div class="bg-white dark:bg-dark-800 border-2 border-purple-200 dark:border-purple-800 rounded-lg p-3">
              <div class="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase mb-2">📦 สินค้า/บริการของคุณ ({output.value_map.products_services.length})</div>
              <div class="space-y-1.5">
                {#each output.value_map.products_services as ps}
                  <div class="bg-purple-50 dark:bg-purple-950/40 rounded p-2 text-xs">
                    <div class="flex items-center gap-1.5 mb-0.5">
                      <span class="font-bold text-purple-900 dark:text-purple-200">{ps.name}</span>
                      <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">[{ps.type}]</span>
                    </div>
                    <div class="text-purple-900 dark:text-purple-200">{ps.description}</div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          {#if output.value_map?.pain_relievers?.length}
            <div class="bg-white dark:bg-dark-800 border-2 border-orange-200 dark:border-orange-800 rounded-lg p-3">
              <div class="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase mb-2">💊 สิ่งที่ช่วยแก้ปัญหาลูกค้า ({output.value_map.pain_relievers.length})</div>
              <div class="space-y-1.5">
                {#each output.value_map.pain_relievers as r}
                  <div class="bg-orange-50 dark:bg-orange-950/40 rounded p-2 text-xs">
                    <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span class="px-1.5 py-0.5 rounded text-[10px] border {intensityColor(r.intensity)}">{intensityLabel(r.intensity)}</span>
                      <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">[{r.pattern}]</span>
                    </div>
                    <div class="text-orange-900 dark:text-orange-200">{r.reliever}</div>
                    {#if r.addresses_pain}
                      <div class="text-[10px] text-orange-700/70 dark:text-orange-400/70 mt-0.5">→ แก้: {r.addresses_pain}</div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          {#if output.value_map?.gain_creators?.length}
            <div class="bg-white dark:bg-dark-800 border-2 border-teal-200 dark:border-teal-800 rounded-lg p-3">
              <div class="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase mb-2">🎁 สิ่งที่เพิ่มความพอใจให้ลูกค้า ({output.value_map.gain_creators.length})</div>
              <div class="space-y-1.5">
                {#each output.value_map.gain_creators as c}
                  <div class="bg-teal-50 dark:bg-teal-950/40 rounded p-2 text-xs">
                    <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span class="px-1.5 py-0.5 rounded text-[10px] border {intensityColor(c.strength)}">{intensityLabel(c.strength)}</span>
                      <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">[{c.pattern}]</span>
                    </div>
                    <div class="text-teal-900 dark:text-teal-200">{c.creator}</div>
                    {#if c.addresses_gain}
                      <div class="text-[10px] text-teal-700/70 dark:text-teal-400/70 mt-0.5">→ ตอบ: {c.addresses_gain}</div>
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
        <div class="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-2 border-indigo-300 dark:border-indigo-700 rounded-2xl p-5">
          <h3 class="font-semibold text-lg mb-3 text-indigo-900 dark:text-indigo-200">⚖️ สรุปว่าตรงกันแค่ไหน</h3>
          <div class="flex items-center gap-3 mb-3">
            <div class="text-xs font-bold text-indigo-700 dark:text-indigo-400">คะแนนความตรงกัน:</div>
            <span class="px-3 py-1 rounded-lg border-2 text-sm font-bold {fitScoreColor(fa.overall_fit_score || 0)}">
              {fa.overall_fit_score || '-'}/10 — {fa.fit_verdict || '-'}
            </span>
          </div>

          <div class="grid sm:grid-cols-2 gap-3 mb-3">
            {#if fa.matched_pains?.length}
              <div class="bg-white dark:bg-dark-800 border border-emerald-300 dark:border-emerald-700 rounded p-2.5">
                <div class="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1.5">✅ ปัญหาที่แก้ได้แล้ว ({fa.matched_pains.length})</div>
                <ul class="space-y-0.5 text-xs text-emerald-900 dark:text-emerald-200">
                  {#each fa.matched_pains as m}
                    <li>• <b>{m.pain}</b> → {m.reliever} [{m.strength}]</li>
                  {/each}
                </ul>
              </div>
            {/if}
            {#if fa.matched_gains?.length}
              <div class="bg-white dark:bg-dark-800 border border-emerald-300 dark:border-emerald-700 rounded p-2.5">
                <div class="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1.5">✅ ความต้องการที่ตอบโจทย์แล้ว ({fa.matched_gains.length})</div>
                <ul class="space-y-0.5 text-xs text-emerald-900 dark:text-emerald-200">
                  {#each fa.matched_gains as m}
                    <li>• <b>{m.gain}</b> → {m.creator} [{m.strength}]</li>
                  {/each}
                </ul>
              </div>
            {/if}
            {#if fa.uncovered_pains?.length}
              <div class="bg-white dark:bg-dark-800 border border-rose-300 dark:border-rose-700 rounded p-2.5">
                <div class="text-xs font-bold text-rose-800 dark:text-rose-300 mb-1.5">⚠️ ปัญหาที่ยังไม่ได้แก้ ({fa.uncovered_pains.length})</div>
                <ul class="space-y-1 text-xs text-rose-900 dark:text-rose-200">
                  {#each fa.uncovered_pains as u}
                    <li>• <b>{u.pain}</b> [{u.intensity}] → {u.recommendation}</li>
                  {/each}
                </ul>
              </div>
            {/if}
            {#if fa.uncovered_gains?.length}
              <div class="bg-white dark:bg-dark-800 border border-rose-300 dark:border-rose-700 rounded p-2.5">
                <div class="text-xs font-bold text-rose-800 dark:text-rose-300 mb-1.5">⚠️ ความต้องการที่ยังไม่ได้ตอบ ({fa.uncovered_gains.length})</div>
                <ul class="space-y-1 text-xs text-rose-900 dark:text-rose-200">
                  {#each fa.uncovered_gains as u}
                    <li>• <b>{u.gain}</b> [{u.relevance}] → {u.recommendation}</li>
                  {/each}
                </ul>
              </div>
            {/if}
          </div>

          {#if fa.orphans?.length}
            <div class="bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-400 dark:border-amber-600 rounded-r p-2.5 text-xs text-amber-900 dark:text-amber-200">
              <b>🗑️ สิ่งที่สินค้าคุณมี แต่ลูกค้าไม่ได้ต้องการ:</b>
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
        <div class="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/40 border-2 border-rose-400 dark:border-rose-600 rounded-2xl p-5">
          <h3 class="font-semibold text-lg mb-2 text-rose-900 dark:text-rose-200">💎 ประโยคสรุปจุดขาย</h3>
          <div class="bg-white dark:bg-dark-800 rounded-lg p-4 border border-rose-200 dark:border-rose-800 italic text-rose-900 dark:text-rose-200">
            "{output.value_proposition_statement}"
          </div>
        </div>
      {/if}

      {#if output.elevator_pitch}
        <div class="bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-400 dark:border-amber-600 p-3 rounded">
          <div class="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase mb-1">⏱️ พูดสั้นๆ ให้ลูกค้าเข้าใจใน 30 วินาที</div>
          <div class="text-sm italic text-amber-900 dark:text-amber-200">"{output.elevator_pitch}"</div>
        </div>
      {/if}

      {#if output.messaging_hierarchy}
        <div class="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 rounded-xl p-4">
          <div class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-2">📢 ลำดับข้อความที่ควรสื่อสาร</div>
          {#if output.messaging_hierarchy.primary_message}
            <div class="bg-primary-50 dark:bg-primary-900/40 rounded-lg p-2.5 mb-2 text-sm font-semibold">{output.messaging_hierarchy.primary_message}</div>
          {/if}
          {#if output.messaging_hierarchy.supporting_messages?.length}
            <ul class="text-sm space-y-1 mb-2">
              {#each output.messaging_hierarchy.supporting_messages as m}<li class="flex gap-1.5"><span class="text-primary-500">•</span>{m}</li>{/each}
            </ul>
          {/if}
          {#if output.messaging_hierarchy.proof_points?.length}
            <div class="text-xs text-dark-900/60 dark:text-dark-100/60">
              <b>หลักฐาน:</b> {output.messaging_hierarchy.proof_points.join(' · ')}
            </div>
          {/if}
        </div>
      {/if}

      {#if output.application_guide}
        <div class="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 rounded-xl p-4">
          <div class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-2">🛠️ เอาไปใช้ยังไง</div>
          {#if output.application_guide.ad_headlines?.length}
            <div class="mb-2">
              <div class="text-xs font-semibold text-dark-900/60 dark:text-dark-100/60 mb-1">หัวข้อโฆษณา</div>
              <ul class="text-sm space-y-0.5">{#each output.application_guide.ad_headlines as h}<li>• {h}</li>{/each}</ul>
            </div>
          {/if}
          {#if output.application_guide.landing_page_copy}
            <div class="mb-2">
              <div class="text-xs font-semibold text-dark-900/60 dark:text-dark-100/60 mb-1">ข้อความหน้าเว็บขาย</div>
              <div class="text-sm italic">{output.application_guide.landing_page_copy}</div>
            </div>
          {/if}
          {#if output.application_guide.sales_talking_points?.length}
            <div>
              <div class="text-xs font-semibold text-dark-900/60 dark:text-dark-100/60 mb-1">พูดกับลูกค้ายังไง</div>
              <ul class="text-sm space-y-0.5">{#each output.application_guide.sales_talking_points as p}<li>• {p}</li>{/each}</ul>
            </div>
          {/if}
        </div>
      {/if}

      <!-- What most brands get wrong -->
      {#if output.what_most_brands_get_wrong}
        <div class="bg-rose-50 dark:bg-rose-950/40 border-l-4 border-rose-400 dark:border-rose-600 p-3 rounded text-sm text-rose-900 dark:text-rose-200">
          <b>⚠️ ที่แบรนด์ส่วนใหญ่ทำผิด:</b> {output.what_most_brands_get_wrong}
        </div>
      {/if}

      <!-- Validation methods -->
      {#if output.validation_methods?.length}
        <div class="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 rounded-lg p-3">
          <div class="text-xs font-bold text-dark-900/60 dark:text-dark-100/60 uppercase mb-1.5">🔬 วิธีตรวจสอบว่าใช้ได้จริง</div>
          <ul class="space-y-0.5 text-sm text-dark-900/80 dark:text-dark-100/80">
            {#each output.validation_methods as v}
              <li>• {v}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <!-- Next steps -->
      {#if output.next_steps?.length}
        <div class="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
          <div class="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase mb-1.5">➡️ ขั้นตอนต่อไป</div>
          <ul class="space-y-0.5 text-sm text-emerald-900 dark:text-emerald-200">
            {#each output.next_steps as s}
              <li class="flex gap-1.5"><span>→</span>{s}</li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if output.reasoning}
        <div class="bg-white dark:bg-dark-800 border border-dark-100 dark:border-dark-700 rounded-xl p-4 text-sm italic text-dark-900/70 dark:text-dark-100/70">
          💡 {output.reasoning}
        </div>
      {/if}

      <!-- Action bar -->
      <ToolChainHint current="value_proposition_canvas" />
      <div class="flex items-center justify-between pt-4 border-t border-dark-100 dark:border-dark-700 flex-wrap gap-2">
        <button onclick={() => { output = null; error = ''; saveId = null; saveMsg = ''; }} class="text-sm text-dark-900/60 dark:text-dark-100/60 hover:text-primary-600 dark:hover:text-primary-400">
          ← ออกแบบใหม่
        </button>
        <div class="flex items-center gap-2 flex-wrap">
          {#if saveMsg}
            <span class="text-xs {saveMsg.startsWith('✓') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}">{saveMsg}</span>
          {/if}
          <input type="text" bind:value={saveTitle} placeholder="ตั้งชื่อ (ไม่บังคับ)" class="text-xs px-2 py-1.5 rounded border border-dark-200 dark:border-dark-600 w-40" />
          <button onclick={handleSave} disabled={isSaving} class="text-sm btn-secondary disabled:opacity-50">
            {isSaving ? '...' : (saveId ? '✓ บันทึกแล้ว' : '💾 บันทึก')}
          </button>
          <button onclick={handlePromote} disabled={isPromoting} class="text-sm btn-secondary disabled:opacity-50" title="บันทึกเป็นโปรเจกต์ (ใช้ต่อในขั้นตอน 1, 2, 4, 5)">
            {isPromoting ? '...' : '📋 ต่อยอดเป็นโปรเจกต์'}
          </button>
          {#if saveId}<CanvasPdfButton saveId={saveId} />{/if}
          <button onclick={() => handleExport('md')} class="text-sm btn-secondary">📥 .md</button>
          <button onclick={() => handleExport('json')} class="text-sm btn-secondary">📥 .json</button>
          <button onclick={handleCanvasPDF} class="text-sm btn-primary" title="เปิดไฟล์ PDF สรุปหน้าเดียว (ขนาด A3 แนวนอน)">🎨 พิมพ์เป็น PDF หน้าเดียว</button>
        </div>
      </div>
      {#if promoteMsg}
        <div class="mt-2 text-xs {promoteMsg.startsWith('✓') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}">{promoteMsg}</div>
      {/if}
    </div>
  {/if}
</ToolLayout>
