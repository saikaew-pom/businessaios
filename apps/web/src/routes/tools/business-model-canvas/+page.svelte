<script lang="ts">
  import ToolLayout from '$lib/ToolLayout.svelte';
  import CanvasPdfButton from '$lib/CanvasPdfButton.svelte';
  import BusinessContextFields from '$lib/BusinessContextFields.svelte';
  import ToolChainHint from '$lib/ToolChainHint.svelte';
  import { runBusinessModelCanvas, saveToolRun, updateToolRun, exportSavedTool, getExportUrl, promoteToolToProject, listSavedTools } from '$lib/api';
  import { goto } from '$app/navigation';
  import { BUSINESS_TYPES, TARGET_AUDIENCES, REVENUE_MODELS, GEOGRAPHIC_SCOPES, DISTRIBUTION_MODELS, CURRENT_STAGES, BMC_BLOCKS } from '$lib/presets';
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

  // BMC-specific
  let revenue_model = $state('');
  let geographic_scope = $state('');
  let distribution_model = $state('');
  let current_stage = $state('');
  let cost_focus = $state('');
  let revenue_target = $state('');
  let team_size = $state('');
  let user_notes = $state('');

  // Optional pre-fill from VPC / JTBD / Competitor
  let vpc_saves = $state<any[]>([]);
  let jtbd_saves = $state<any[]>([]);
  let competitor_saves = $state<any[]>([]);
  let selectedVpcId = $state('');
  let selectedJtbdId = $state('');
  let selectedCompetitorId = $state('');

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

  // Load related saves on mount
  $effect(() => {
    listSavedTools({ tool_type: 'value_proposition_canvas' }).then(s => { vpc_saves = s || []; }).catch(() => {});
    listSavedTools({ tool_type: 'jtbd_generator' }).then(s => { jtbd_saves = s || []; }).catch(() => {});
    listSavedTools({ tool_type: 'competitor_analysis' }).then(s => { competitor_saves = s || []; }).catch(() => {});
  });

  function buildVpcContext(): string {
    if (!selectedVpcId) return '';
    const s = vpc_saves.find(x => x.id === selectedVpcId);
    if (!s) return '';
    const cp = s.output?.customer_profile || {};
    const vm = s.output?.value_map || {};
    const fa = s.output?.fit_analysis || {};
    return `VP Statement: ${s.output?.value_proposition_statement || '-'}
Fit Score: ${fa.overall_fit_score || '-'}/10 — ${fa.fit_verdict || ''}
Customer Jobs: ${(cp.jobs || []).slice(0, 3).map((j: any) => j.job).join('; ')}
Top Pains: ${(cp.pains || []).slice(0, 3).map((p: any) => p.pain).join('; ')}
Products/Services: ${(vm.products_services || []).slice(0, 3).map((p: any) => p.name).join('; ')}`;
  }

  function buildJtbdContext(): string {
    if (!selectedJtbdId) return '';
    const s = jtbd_saves.find(x => x.id === selectedJtbdId);
    if (!s) return '';
    return `Job statement: ${s.output?.primary_job?.job_statement || '-'}
Forces verdict: ${s.output?.forces_of_progress?.verdict || '-'}`;
  }

  function buildCompetitorContext(): string {
    if (!selectedCompetitorId) return '';
    const s = competitor_saves.find(x => x.id === selectedCompetitorId);
    if (!s) return '';
    const comps = s.output?.competitors || [];
    return `Top competitors: ${comps.slice(0, 3).map((c: any) => `${c.name} (${c.threat_level})`).join('; ')}
White space: ${s.output?.white_space || '-'}`;
  }

  // Edit flow (Option B Overwrite)
  $effect(() => {
    try {
      const raw = sessionStorage.getItem('tool_edit_input');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.tool_type !== 'business_model_canvas') return;
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
      if (input.product_description) product_description = input.product_description;
      if (input.product_features) product_features = input.product_features;
      if (input.revenue_model) revenue_model = input.revenue_model;
      if (input.geographic_scope) geographic_scope = input.geographic_scope;
      if (input.distribution_model) distribution_model = input.distribution_model;
      if (input.current_stage) current_stage = input.current_stage;
      if (input.cost_focus) cost_focus = input.cost_focus;
      if (input.revenue_target) revenue_target = input.revenue_target;
      if (input.team_size) team_size = input.team_size;
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
      const res = await runBusinessModelCanvas({
        business_name,
        business_type: resolvedBusinessType,
        industry: resolvedIndustry,
        location: location.trim(),
        target_audience: resolvedTargetAudience,
        differentiation: differentiation.trim(),
        price_range: price_range.trim(),
        product_description: product_description.trim(),
        product_features: product_features.trim(),
        revenue_model: revenue_model,
        geographic_scope: geographic_scope,
        distribution_model: distribution_model,
        current_stage: current_stage,
        cost_focus: cost_focus.trim(),
        revenue_target: revenue_target.trim(),
        team_size: team_size.trim(),
        vpc_context: buildVpcContext(),
        jtbd_context: buildJtbdContext(),
        competitor_context: buildCompetitorContext(),
        user_notes: user_notes.trim(),
      });
      output = res.output;
    } catch (err: any) {
      error = err.message || 'ระบบอัจฉริยะขัดข้อง ลองใหม่อีกครั้ง';
    } finally {
      isGenerating = false;
    }
  }

  async function handleSave() {
    if (!output) return;
    isSaving = true;
    saveMsg = '';
    try {
      const title = saveTitle.trim() || `BMC — ${business_name} ${new Date().toLocaleDateString('th-TH')}`;
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
        product_description: product_description.trim(),
        product_features: product_features.trim(),
        revenue_model,
        geographic_scope,
        distribution_model,
        current_stage,
        cost_focus: cost_focus.trim(),
        revenue_target: revenue_target.trim(),
        team_size: team_size.trim(),
        user_notes: user_notes.trim(),
        vpc_save_id: selectedVpcId || '',
        jtbd_save_id: selectedJtbdId || '',
        competitor_save_id: selectedCompetitorId || '',
        business_type_resolved: resolvedBusinessType,
        industry_resolved: resolvedIndustry,
        target_audience_resolved: resolvedTargetAudience,
      };
      if (saveId) {
        await updateToolRun(saveId, { input: payload, output });
        saveMsg = '✓ อัปเดตเรียบร้อย';
      } else {
        const res = await saveToolRun('business_model_canvas', payload, output, title);
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
      const url = res.download_url ? `${PUBLIC_API_URL}${res.download_url}` : getExportUrl(res.export_id);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bmc.${format}`;
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

  const importanceColor = (i: string) => {
    if (i === 'critical') return 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700';
    if (i === 'important') return 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700';
    return 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700';
  };
  const importanceLabel = (i: string) => {
    return ({ critical: '🔥 สำคัญมาก', important: '🟡 สำคัญ', supporting: '🟢 เสริม' } as any)[i] || i;
  };
  const priorityColor = (p: string) => {
    if (p === 'primary') return 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700';
    if (p === 'secondary') return 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700';
    return 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700';
  };
  const priorityLabel = (p: string) => {
    return ({ primary: '⭐ กลุ่มหลัก', secondary: '🟡 กลุ่มรอง', tertiary: '🟢 กลุ่มเสริม' } as any)[p] || p;
  };
  const marginColor = (m: string) => {
    if (!m) return 'bg-dark-100 dark:bg-dark-700';
    if (m.startsWith('high')) return 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700';
    if (m.startsWith('medium')) return 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700';
    return 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700';
  };
</script>

<ToolLayout
  title="วางแผนธุรกิจทั้งระบบ"
  subtitle="ช่วยคุณมองภาพรวมธุรกิจทั้งหมดในหน้าเดียว ไม่ใช่แค่ไอเดียเดียว"
  icon="📊"
  color="indigo"
>
  {#if !output}
    <div class="space-y-5">
      <div class="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
        <div class="font-semibold text-indigo-900 dark:text-indigo-200 mb-1">📊 มองภาพรวมธุรกิจทั้งหมดในหน้าเดียว</div>
        <div class="text-sm text-indigo-800 dark:text-indigo-300 space-y-1">
          <div>ช่วยคุณเห็นทั้งภาพว่าธุรกิจนี้อยู่รอดได้ไหม ใน 3 มุม:</div>
          <div>• <b>ลูกค้าอยากได้ไหม:</b> ใครคือลูกค้า และเราให้คุณค่าอะไรกับเขา</div>
          <div>• <b>ทำได้จริงไหม:</b> ขายผ่านช่องทางไหน ดูแลลูกค้ายังไง ต้องทำอะไรบ้าง ใช้ทรัพยากร/พาร์ทเนอร์อะไร</div>
          <div>• <b>ทำเงินได้ไหม:</b> รายได้มาจากไหน ต้นทุนหลักคืออะไร</div>
          <div>ต่อยอดได้จาก: หาปัญหาลูกค้า → วาดภาพลูกค้าในฝัน → เข้าใจว่าลูกค้า "จ้าง" เราทำอะไร → เช็คว่าสินค้าตรงใจลูกค้าไหม → <b>แผนธุรกิจทั้งระบบ</b></div>
          <button
            type="button"
            onclick={() => (showPrinciple = !showPrinciple)}
            class="text-xs text-indigo-700/70 dark:text-indigo-400/70 underline decoration-dotted hover:text-indigo-700 dark:hover:text-indigo-400"
          >
            {showPrinciple ? 'ซ่อนหลักการ' : 'ดูหลักการ'}
          </button>
          {#if showPrinciple}
            <div class="text-xs text-indigo-700/80 dark:text-indigo-400/80 pt-1">
              Business Model Canvas (Osterwalder, 2010) — ครบ 9 Building Blocks แบ่งเป็น 3 areas: Desirability (Customer Segments + Value Propositions), Feasibility (Channels + Customer Relationships + Key Activities + Key Resources + Key Partnerships), Viability (Revenue Streams + Cost Structure)
            </div>
          {/if}
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">ชื่อธุรกิจ *</label>
        <input type="text" bind:value={business_name} placeholder="เช่น ขนมบ้านโกไข่" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500" />
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
          <input type="text" bind:value={price_range} placeholder="เช่น 50-200 บาท" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">จุดต่าง (ถ้ามี)</label>
        <input type="text" bind:value={differentiation} placeholder="เช่น ใช้วัตถุดิบออร์แกนิค" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">สินค้า/บริการ *</label>
        <textarea bind:value={product_description} rows="3" placeholder="เช่น ขนมบ้านโกไข่ เป็นร้านขนมใต้สูตรโบราณ 28 สาขา มี 48 รายการ เน้นขนมคุณภาพสูง ขายหน้าร้าน + ออนไลน์" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"></textarea>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">จุดเด่นของสินค้า</label>
        <textarea bind:value={product_features} rows="2" placeholder="เช่น 1) สูตรโบราณ 2) วัตถุดิบสดใหม่ 3) หน้าร้าน 28 สาขา 4) ส่งฟรี 5) บรรจุภัณฑ์ premium" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"></textarea>
      </div>

      <!-- BMC Deep Context (4 fields) -->
      <div class="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-2 border-indigo-300 dark:border-indigo-700 rounded-xl p-4 space-y-3">
        <div class="font-semibold text-indigo-900 dark:text-indigo-200">📊 รายละเอียดโมเดลธุรกิจ (4 อย่าง — ไม่บังคับ)</div>
        <div>
          <label class="block text-xs font-semibold text-indigo-800 dark:text-indigo-300 mb-1">💵 วิธีทำเงิน</label>
          <select bind:value={revenue_model} class="w-full px-2.5 py-1.5 rounded border border-indigo-200 dark:border-indigo-800 text-sm">
            <option value="">— เลือก / ปล่อยว่างให้ ระบบอัจฉริยะ วิเคราะห์ —</option>
            {#each REVENUE_MODELS as r}
              <option value={r.id}>{r.label} — {r.desc}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-indigo-800 dark:text-indigo-300 mb-1">🗺️ พื้นที่ที่ขาย</label>
          <select bind:value={geographic_scope} class="w-full px-2.5 py-1.5 rounded border border-indigo-200 dark:border-indigo-800 text-sm">
            <option value="">— เลือก / ปล่อยว่าง —</option>
            {#each GEOGRAPHIC_SCOPES as g}
              <option value={g.id}>{g.label} — {g.desc}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-indigo-800 dark:text-indigo-300 mb-1">📡 วิธีขาย/กระจายสินค้า</label>
          <select bind:value={distribution_model} class="w-full px-2.5 py-1.5 rounded border border-indigo-200 dark:border-indigo-800 text-sm">
            <option value="">— เลือก / ปล่อยว่าง —</option>
            {#each DISTRIBUTION_MODELS as d}
              <option value={d.id}>{d.label} — {d.desc}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-indigo-800 dark:text-indigo-300 mb-1">🌱 ช่วงที่ธุรกิจอยู่ตอนนี้</label>
          <select bind:value={current_stage} class="w-full px-2.5 py-1.5 rounded border border-indigo-200 dark:border-indigo-800 text-sm">
            <option value="">— เลือก / ปล่อยว่าง —</option>
            {#each CURRENT_STAGES as s}
              <option value={s.id}>{s.label} — {s.desc}</option>
            {/each}
          </select>
        </div>
      </div>

      <!-- Financial Focus (optional) -->
      <div class="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
        <div class="font-semibold text-amber-900 dark:text-amber-200">💰 เรื่องเงินๆ ทองๆ (ไม่บังคับ แต่แนะนำ)</div>
        <div>
          <label class="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">🎯 ลงทุนหนักที่สุดเรื่องอะไร</label>
          <input type="text" bind:value={cost_focus} placeholder="เช่น โรงงานผลิต, ค่าเช่าหน้าร้าน, ทีม, การตลาด" class="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-800 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">📈 เป้ารายได้</label>
          <input type="text" bind:value={revenue_target} placeholder="เช่น 30 ล้าน/ปี ภายใน 12 เดือน" class="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-800 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">👥 ทีมงาน</label>
          <input type="text" bind:value={team_size} placeholder="เช่น 5 คน (1 co-founder, 2 chef, 2 sale)" class="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-800 text-sm" />
        </div>
      </div>

      <!-- Optional: pre-fill from VPC / JTBD / Competitor -->
      {#if vpc_saves.length > 0 || jtbd_saves.length > 0 || competitor_saves.length > 0}
        <div class="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40 border border-amber-300 dark:border-amber-700 rounded-xl p-3 space-y-2">
          <div class="font-semibold text-amber-900 dark:text-amber-200 text-sm">🔗 ใช้ข้อมูลจากเครื่องมืออื่นที่เคยทำไว้ (ไม่บังคับ แต่แนะนำ)</div>
          {#if vpc_saves.length > 0}
            <div>
              <label class="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">💎 ผลจากเช็คสินค้าตรงใจลูกค้าไหม</label>
              <select bind:value={selectedVpcId} class="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-800 text-sm">
                <option value="">— ไม่ใช้ —</option>
                {#each vpc_saves as v}
                  <option value={v.id}>💎 {v.title} ({new Date(v.created_at).toLocaleDateString('th-TH')})</option>
                {/each}
              </select>
            </div>
          {/if}
          {#if jtbd_saves.length > 0}
            <div>
              <label class="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">🎯 ผลจากเข้าใจว่าลูกค้า "จ้าง" เราทำอะไร</label>
              <select bind:value={selectedJtbdId} class="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-800 text-sm">
                <option value="">— ไม่ใช้ —</option>
                {#each jtbd_saves as j}
                  <option value={j.id}>🎯 {j.title} ({new Date(j.created_at).toLocaleDateString('th-TH')})</option>
                {/each}
              </select>
            </div>
          {/if}
          {#if competitor_saves.length > 0}
            <div>
              <label class="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">🔍 ผลจากส่องคู่แข่ง</label>
              <select bind:value={selectedCompetitorId} class="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-800 text-sm">
                <option value="">— ไม่ใช้ —</option>
                {#each competitor_saves as c}
                  <option value={c.id}>🔍 {c.title} ({new Date(c.created_at).toLocaleDateString('th-TH')})</option>
                {/each}
              </select>
            </div>
          {/if}
          <div class="text-xs text-amber-700 dark:text-amber-400 mt-1">ถ้าเลือก ระบบจะกรอกกลุ่มลูกค้ากับจุดขายหลักให้อัตโนมัติจากเครื่องมือเหล่านี้</div>
        </div>
      {/if}

      <div>
        <label class="block text-sm font-semibold mb-1.5">โน้ตเพิ่มเติม <span class="text-dark-900/50 dark:text-dark-100/50 font-normal">(ไม่บังคับ)</span></label>
        <textarea bind:value={user_notes} rows="2" placeholder="อะไรก็ได้ที่อยากให้ ระบบอัจฉริยะ รู้เพิ่ม..." class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500"></textarea>
      </div>

      {#if error}
        <div class="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">{error}</div>
      {/if}

      <div class="pt-4 flex items-center justify-end border-t border-dark-100 dark:border-dark-700">
        <button onclick={handleGenerate} disabled={isGenerating} class="btn-primary disabled:opacity-50">
          {isGenerating ? '⏳ ระบบอัจฉริยะ กำลังวางแผนธุรกิจ...' : '📊 วางแผนธุรกิจทั้งระบบ'}
        </button>
      </div>
    </div>
  {:else}
    <div class="space-y-5">
      <!-- Summary -->
      {#if output.summary}
        <div class="bg-primary-50 dark:bg-primary-900/40 border-l-4 border-primary-500 dark:border-primary-600 p-4 rounded-lg">
          <div class="text-xs font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider mb-1">สรุปแผนธุรกิจ</div>
          <div class="text-dark-900 dark:text-dark-50">{output.summary}</div>
        </div>
      {/if}

      <!-- Executive insight -->
      {#if output.executive_insight}
        <div class="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-l-4 border-indigo-500 dark:border-indigo-600 p-3 rounded">
          <div class="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase mb-1">💡 มุมมองสำคัญ</div>
          <div class="text-sm italic text-indigo-900 dark:text-indigo-200">"{output.executive_insight}"</div>
        </div>
      {/if}

      <!-- Model coherence -->
      {#if output.model_coherence}
        <div class="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 rounded-lg p-3 text-sm text-dark-900 dark:text-dark-50">
          <div class="text-xs font-bold text-dark-900/60 dark:text-dark-100/60 uppercase mb-1">🔗 ความเชื่อมโยงของแผน — กลุ่มลูกค้า → จุดขาย → รายได้ → ทรัพยากร เชื่อมกันยังไง</div>
          {output.model_coherence}
        </div>
      {/if}

      <!-- Business Model Pattern badge -->
      {#if output.business_model_pattern}
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold">
          🏷️ รูปแบบธุรกิจ: {output.business_model_pattern}
        </div>
      {/if}

      <!-- 9 BLOCKS in 3 areas -->
      <!-- DESIRABILITY: CS + VP -->
      <div>
        <div class="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase mb-2 tracking-wider">🟦 ลูกค้าอยากได้ไหม</div>
        <div class="grid lg:grid-cols-2 gap-3">
          <!-- Customer Segments -->
          <div class="bg-white dark:bg-dark-800 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-3">
            <div class="text-sm font-bold text-blue-700 dark:text-blue-400 mb-2">👥 กลุ่มลูกค้า ({output.customer_segments?.length || 0})</div>
            <div class="space-y-1.5">
              {#each output.customer_segments || [] as s}
                <div class="bg-blue-50 dark:bg-blue-950/40 rounded p-2 text-xs">
                  <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span class="px-1.5 py-0.5 rounded text-[10px] border {priorityColor(s.priority)}">{priorityLabel(s.priority)}</span>
                    <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">[{s.size_estimate}]</span>
                  </div>
                  <div class="font-semibold text-blue-900 dark:text-blue-200">{s.name}</div>
                  <div class="text-blue-800 dark:text-blue-300 mt-0.5">{s.description}</div>
                  {#if s.key_characteristic}
                    <div class="text-[10px] text-blue-700/70 dark:text-blue-400/70 mt-0.5 italic">→ {s.key_characteristic}</div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>

          <!-- Value Propositions -->
          <div class="bg-white dark:bg-dark-800 border-2 border-purple-200 dark:border-purple-800 rounded-xl p-3">
            <div class="text-sm font-bold text-purple-700 dark:text-purple-400 mb-2">💎 จุดขายหลักที่มอบให้ลูกค้า ({output.value_propositions?.length || 0})</div>
            <div class="space-y-1.5">
              {#each output.value_propositions || [] as v}
                <div class="bg-purple-50 dark:bg-purple-950/40 rounded p-2 text-xs">
                  <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">→ {v.for_segment}</span>
                  </div>
                  <div class="font-semibold text-purple-900 dark:text-purple-200">{v.vp_title}</div>
                  <div class="text-purple-800 dark:text-purple-300 italic mt-0.5">"{v.vp_statement}"</div>
                  {#if v.differentiator}
                    <div class="text-[10px] text-purple-700/70 dark:text-purple-400/70 mt-0.5">⭐ Differentiator: {v.differentiator}</div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>

      <!-- FEASIBILITY: Channels + CR + KR + KA + KP -->
      <div>
        <div class="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase mb-2 tracking-wider">🟩 ทำได้จริงไหม</div>

        <!-- Channels + CR row -->
        <div class="grid lg:grid-cols-2 gap-3 mb-3">
          <!-- Channels -->
          <div class="bg-white dark:bg-dark-800 border-2 border-teal-200 dark:border-teal-800 rounded-xl p-3">
            <div class="text-sm font-bold text-teal-700 dark:text-teal-400 mb-2">📡 ช่องทางขาย ({output.channels?.length || 0})</div>
            <div class="space-y-1.5">
              {#each output.channels || [] as ch}
                <div class="bg-teal-50 dark:bg-teal-950/40 rounded p-2 text-xs">
                  <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span class="px-1.5 py-0.5 rounded text-[10px] border {ch.effectiveness === 'high' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' : ch.effectiveness === 'medium' ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700' : 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700'}">{ch.effectiveness}</span>
                    <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">[{ch.phase}]</span>
                    <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">[{ch.type}]</span>
                  </div>
                  <div class="font-semibold text-teal-900 dark:text-teal-200">{ch.channel_name}</div>
                  {#if ch.notes}<div class="text-teal-800 dark:text-teal-300 text-[10px] mt-0.5">{ch.notes}</div>{/if}
                </div>
              {/each}
            </div>
          </div>

          <!-- Customer Relationships -->
          <div class="bg-white dark:bg-dark-800 border-2 border-cyan-200 dark:border-cyan-800 rounded-xl p-3">
            <div class="text-sm font-bold text-cyan-700 dark:text-cyan-400 mb-2">🤝 ความสัมพันธ์กับลูกค้า ({output.customer_relationships?.length || 0})</div>
            <div class="space-y-1.5">
              {#each output.customer_relationships || [] as r}
                <div class="bg-cyan-50 dark:bg-cyan-950/40 rounded p-2 text-xs">
                  <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span class="px-1.5 py-0.5 rounded text-[10px] border {r.intensity === 'high' ? 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700' : r.intensity === 'medium' ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700' : 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700'}">{r.intensity}</span>
                    <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">[{r.type}]</span>
                    <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">[{r.motivation}]</span>
                  </div>
                  <div class="font-semibold text-cyan-900 dark:text-cyan-200">→ {r.segment}</div>
                  {#if r.example}<div class="text-cyan-800 dark:text-cyan-300 text-[10px] mt-0.5 italic">"{r.example}"</div>{/if}
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- KR + KA + KP row -->
        <div class="grid lg:grid-cols-3 gap-3">
          <!-- Key Resources -->
          <div class="bg-white dark:bg-dark-800 border-2 border-amber-200 dark:border-amber-800 rounded-xl p-3">
            <div class="text-sm font-bold text-amber-700 dark:text-amber-400 mb-2">🔧 ทรัพยากรสำคัญ ({output.key_resources?.length || 0})</div>
            <div class="space-y-1.5">
              {#each output.key_resources || [] as r}
                <div class="bg-amber-50 dark:bg-amber-950/40 rounded p-2 text-xs">
                  <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span class="px-1.5 py-0.5 rounded text-[10px] border {importanceColor(r.importance)}">{importanceLabel(r.importance)}</span>
                    <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">[{r.type}]</span>
                  </div>
                  <div class="text-amber-900 dark:text-amber-200">{r.description}</div>
                  {#if r.supports_vp}<div class="text-[10px] text-amber-700/70 dark:text-amber-400/70 mt-0.5">💎 {r.supports_vp}</div>{/if}
                </div>
              {/each}
            </div>
          </div>

          <!-- Key Activities -->
          <div class="bg-white dark:bg-dark-800 border-2 border-orange-200 dark:border-orange-800 rounded-xl p-3">
            <div class="text-sm font-bold text-orange-700 dark:text-orange-400 mb-2">⚙️ กิจกรรมหลัก ({output.key_activities?.length || 0})</div>
            <div class="space-y-1.5">
              {#each output.key_activities || [] as a}
                <div class="bg-orange-50 dark:bg-orange-950/40 rounded p-2 text-xs">
                  <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span class="px-1.5 py-0.5 rounded text-[10px] border {importanceColor(a.importance)}">{importanceLabel(a.importance)}</span>
                    <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">[{a.type}]</span>
                  </div>
                  <div class="text-orange-900 dark:text-orange-200">{a.description}</div>
                  {#if a.supports_vp}<div class="text-[10px] text-orange-700/70 dark:text-orange-400/70 mt-0.5">💎 {a.supports_vp}</div>{/if}
                </div>
              {/each}
            </div>
          </div>

          <!-- Key Partnerships -->
          <div class="bg-white dark:bg-dark-800 border-2 border-pink-200 dark:border-pink-800 rounded-xl p-3">
            <div class="text-sm font-bold text-pink-700 dark:text-pink-400 mb-2">🤝 พาร์ทเนอร์สำคัญ ({output.key_partnerships?.length || 0})</div>
            <div class="space-y-1.5">
              {#each output.key_partnerships || [] as p}
                <div class="bg-pink-50 dark:bg-pink-950/40 rounded p-2 text-xs">
                  <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">[{p.type}]</span>
                    <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">[{p.motivation}]</span>
                  </div>
                  <div class="font-semibold text-pink-900 dark:text-pink-200">{p.partner_type}</div>
                  <div class="text-pink-800 dark:text-pink-300 text-[10px] mt-0.5">⇄ {p.value_exchange}</div>
                  {#if p.supports_vp}<div class="text-[10px] text-pink-700/70 dark:text-pink-400/70 mt-0.5">💎 {p.supports_vp}</div>{/if}
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>

      <!-- VIABILITY: Revenue + Cost -->
      <div>
        <div class="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-2 tracking-wider">🟨 ทำเงินได้ไหม</div>
        <div class="grid lg:grid-cols-2 gap-3">
          <!-- Revenue Streams -->
          <div class="bg-white dark:bg-dark-800 border-2 border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
            <div class="text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-2">💰 ช่องทางรายได้ ({output.revenue_streams?.length || 0})</div>
            <div class="space-y-1.5">
              {#each output.revenue_streams || [] as r}
                <div class="bg-emerald-50 dark:bg-emerald-950/40 rounded p-2 text-xs">
                  <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">[{r.type}]</span>
                    <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">[{r.pricing_model}]</span>
                    <span class="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">{r.estimated_share}</span>
                  </div>
                  <div class="text-emerald-900 dark:text-emerald-200">{r.description}</div>
                  <div class="text-emerald-700 dark:text-emerald-400 text-[10px] mt-0.5">💵 {r.price_range}</div>
                  {#if r.for_segment}<div class="text-[10px] text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">👥 {r.for_segment}</div>{/if}
                </div>
              {/each}
            </div>
          </div>

          <!-- Cost Structure -->
          {#if output.cost_structure}
            {@const cs = output.cost_structure}
            <div class="bg-white dark:bg-dark-800 border-2 border-red-200 dark:border-red-800 rounded-xl p-3">
              <div class="text-sm font-bold text-red-700 dark:text-red-400 mb-2">📊 โครงสร้างต้นทุน</div>
              <div class="space-y-2">
                <div class="flex items-center gap-1.5 flex-wrap text-xs">
                  <span class="px-1.5 py-0.5 rounded text-[10px] border {cs.model === 'value-driven' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' : cs.model === 'cost-driven' ? 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700' : 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'}">{cs.model}</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] border {marginColor(cs.estimated_margin_profile)}">กำไรขั้นต้น: {cs.estimated_margin_profile}</span>
                  {#if cs.economies_of_scale}<span class="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700">ยิ่งทำเยอะยิ่งถูกลง ✓</span>{/if}
                  {#if cs.economies_of_scope}<span class="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700">ทำหลายอย่างร่วมกันคุ้มกว่า ✓</span>{/if}
                </div>
                {#if cs.major_fixed_costs?.length}
                  <div>
                    <div class="text-[10px] font-bold text-red-800 dark:text-red-300 uppercase mb-1">ต้นทุนคงที่</div>
                    {#each cs.major_fixed_costs as c}
                      <div class="bg-red-50 dark:bg-red-950/40 rounded p-1.5 text-xs text-red-900 dark:text-red-200 mb-0.5">
                        {c.description} <span class="text-[10px] text-red-700/70 dark:text-red-400/70">({c.estimated_share})</span>
                      </div>
                    {/each}
                  </div>
                {/if}
                {#if cs.major_variable_costs?.length}
                  <div>
                    <div class="text-[10px] font-bold text-red-800 dark:text-red-300 uppercase mb-1">ต้นทุนผันแปร</div>
                    {#each cs.major_variable_costs as c}
                      <div class="bg-red-50 dark:bg-red-950/40 rounded p-1.5 text-xs text-red-900 dark:text-red-200 mb-0.5">
                        {c.description} <span class="text-[10px] text-red-700/70 dark:text-red-400/70">({c.estimated_share})</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- SWOT -->
      {#if output.swot_summary}
        {@const sw = output.swot_summary}
        <div class="bg-gradient-to-br from-slate-50 to-dark-50 dark:from-slate-900/40 dark:to-dark-900/40 border-2 border-slate-300 dark:border-slate-700 rounded-2xl p-4">
          <div class="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">🎯 สรุปจุดแข็ง-จุดอ่อน-โอกาส-อุปสรรค</div>
          <div class="grid grid-cols-2 gap-2">
            <div class="bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-500 dark:border-emerald-600 rounded p-2">
              <div class="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase mb-1">💪 จุดแข็ง</div>
              <ul class="text-xs text-emerald-900 dark:text-emerald-200 space-y-0.5">
                {#each sw.strengths || [] as s}<li>• {s}</li>{/each}
              </ul>
            </div>
            <div class="bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 dark:border-amber-600 rounded p-2">
              <div class="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase mb-1">⚠️ จุดอ่อน</div>
              <ul class="text-xs text-amber-900 dark:text-amber-200 space-y-0.5">
                {#each sw.weaknesses || [] as w}<li>• {w}</li>{/each}
              </ul>
            </div>
            <div class="bg-blue-50 dark:bg-blue-950/40 border-l-4 border-blue-500 dark:border-blue-600 rounded p-2">
              <div class="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase mb-1">🚀 โอกาส</div>
              <ul class="text-xs text-blue-900 dark:text-blue-200 space-y-0.5">
                {#each sw.opportunities || [] as o}<li>• {o}</li>{/each}
              </ul>
            </div>
            <div class="bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 dark:border-red-600 rounded p-2">
              <div class="text-xs font-bold text-red-800 dark:text-red-300 uppercase mb-1">⚡ อุปสรรค</div>
              <ul class="text-xs text-red-900 dark:text-red-200 space-y-0.5">
                {#each sw.threats || [] as t}<li>• {t}</li>{/each}
              </ul>
            </div>
          </div>
        </div>
      {/if}

      <!-- Key Assumptions -->
      {#if output.key_assumptions?.length}
        <div class="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/40 border-2 border-rose-300 dark:border-rose-700 rounded-2xl p-4">
          <div class="font-semibold text-rose-900 dark:text-rose-200 mb-2 flex items-center gap-2">🧪 สมมติฐานที่ต้องพิสูจน์</div>
          <div class="space-y-1.5">
            {#each output.key_assumptions as a}
              <div class="bg-white dark:bg-dark-800 border-l-4 {a.risk_level === 'high' ? 'border-red-500 dark:border-red-600' : a.risk_level === 'medium' ? 'border-amber-500 dark:border-amber-600' : 'border-blue-500 dark:border-blue-600'} rounded p-2 text-xs">
                <div class="flex items-center gap-1.5 mb-0.5">
                  <span class="px-1.5 py-0.5 rounded text-[10px] border {a.risk_level === 'high' ? 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700' : a.risk_level === 'medium' ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700' : 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700'}">Risk: {a.risk_level}</span>
                </div>
                <div class="font-semibold text-rose-900 dark:text-rose-200">{a.assumption}</div>
                <div class="text-rose-800 dark:text-rose-300 text-[10px] mt-0.5 italic">→ ทดสอบ: {a.how_to_test}</div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Validation Questions -->
      {#if output.validation_questions?.length}
        <div class="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 rounded-lg p-3">
          <div class="text-xs font-bold text-dark-900/60 dark:text-dark-100/60 uppercase mb-1.5">❓ คำถามที่ควรตอบให้ได้ก่อนขยายธุรกิจ</div>
          <ul class="space-y-0.5 text-sm text-dark-900/80 dark:text-dark-100/80">
            {#each output.validation_questions as v}<li>• {v}</li>{/each}
          </ul>
        </div>
      {/if}

      <!-- Next Steps -->
      {#if output.next_steps?.length}
        <div class="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
          <div class="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase mb-1.5">➡️ ขั้นตอนต่อไป</div>
          <ul class="space-y-0.5 text-sm text-emerald-900 dark:text-emerald-200">
            {#each output.next_steps as s}<li class="flex gap-1.5"><span>→</span>{s}</li>{/each}
          </ul>
        </div>
      {/if}

      {#if output.reasoning}
        <div class="bg-white dark:bg-dark-800 border border-dark-100 dark:border-dark-700 rounded-xl p-4 text-sm italic text-dark-900/70 dark:text-dark-100/70">
          💡 {output.reasoning}
        </div>
      {/if}

      <!-- Action bar -->
      <ToolChainHint current="business_model_canvas" />
      <div class="flex items-center justify-between pt-4 border-t border-dark-100 dark:border-dark-700 flex-wrap gap-2">
        <button onclick={() => { output = null; error = ''; saveId = null; saveMsg = ''; }} class="text-sm text-dark-900/60 dark:text-dark-100/60 hover:text-primary-600 dark:hover:text-primary-400">
          ← ออกแบบใหม่
        </button>
        <div class="flex items-center gap-2 flex-wrap">
          {#if saveMsg}<span class="text-xs {saveMsg.startsWith('✓') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}">{saveMsg}</span>{/if}
          <input type="text" bind:value={saveTitle} placeholder="ตั้งชื่อ (ไม่บังคับ)" class="text-xs px-2 py-1.5 rounded border border-dark-200 dark:border-dark-600 w-40" />
          <button onclick={handleSave} disabled={isSaving} class="text-sm btn-secondary disabled:opacity-50">
            {isSaving ? '...' : (saveId ? '✓ บันทึกแล้ว' : '💾 บันทึก')}
          </button>
          <button onclick={handlePromote} disabled={isPromoting} class="text-sm btn-secondary disabled:opacity-50" title="เอาไปใช้ในโปรเจกต์ (ใส่ให้อัตโนมัติในขั้นตอนที่ 1, 2, 4, 5, 6, 7)">
            {isPromoting ? '...' : '📋 ทำเป็นแผนงาน'}
          </button>
          {#if saveId}<CanvasPdfButton saveId={saveId} />{/if}
          <button onclick={() => handleExport('md')} class="text-sm btn-secondary">📥 .md</button>
          <button onclick={() => handleExport('json')} class="text-sm btn-secondary">📥 .json</button>
          <button onclick={handleCanvasPDF} class="text-sm btn-primary" title="เปิดใบสรุปหน้าเดียว พิมพ์ได้ (ขนาด A3 แนวนอน)">🎨 ใบสรุป (PDF)</button>
        </div>
      </div>
      {#if promoteMsg}<div class="mt-2 text-xs {promoteMsg.startsWith('✓') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}">{promoteMsg}</div>{/if}
    </div>
  {/if}
</ToolLayout>
