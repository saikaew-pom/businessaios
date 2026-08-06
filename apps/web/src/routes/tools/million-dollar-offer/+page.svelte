<script lang="ts">
  import ToolLayout from '$lib/ToolLayout.svelte';
  import CanvasPdfButton from '$lib/CanvasPdfButton.svelte';
  import BusinessContextFields from '$lib/BusinessContextFields.svelte';
  import ToolChainHint from '$lib/ToolChainHint.svelte';
  import { runMillionDollarOffer, saveToolRun, updateToolRun, exportSavedTool, getExportUrl, promoteToolToProject, listSavedTools } from '$lib/api';
  import { goto } from '$app/navigation';
  import { BUSINESS_TYPES, TARGET_AUDIENCES, OFFER_TYPES, DELIVERY_METHODS, GUARANTEE_TYPES, SCARCITY_TYPES, URGENCY_TYPES, VALUE_LEVERS } from '$lib/presets';
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

  // Offer-specific
  let offer_type = $state('');
  let current_price = $state('');
  let delivery_method = $state('');
  let current_guarantee = $state('');
  let dream_outcome_hint = $state('');
  let biggest_objection = $state('');
  let current_result_time = $state('');
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

  $effect(() => {
    listSavedTools({ tool_type: 'value_proposition_canvas' }).then(s => { vpc_saves = s || []; }).catch(() => {});
    listSavedTools({ tool_type: 'jtbd_generator' }).then(s => { jtbd_saves = s || []; }).catch(() => {});
    listSavedTools({ tool_type: 'competitor_analysis' }).then(s => { competitor_saves = s || []; }).catch(() => {});
  });

  function buildVpcContext(): string {
    if (!selectedVpcId) return '';
    const s = vpc_saves.find(x => x.id === selectedVpcId);
    if (!s) return '';
    return `VP Statement: ${s.output?.value_proposition_statement || '-'}
Customer Jobs: ${(s.output?.customer_profile?.jobs || []).slice(0, 3).map((j: any) => j.job).join('; ')}
Products: ${(s.output?.value_map?.products_services || []).slice(0, 3).map((p: any) => p.name).join('; ')}`;
  }

  function buildJtbdContext(): string {
    if (!selectedJtbdId) return '';
    const s = jtbd_saves.find(x => x.id === selectedJtbdId);
    if (!s) return '';
    return `Job: ${s.output?.primary_job?.job_statement || '-'}`;
  }

  function buildCompetitorContext(): string {
    if (!selectedCompetitorId) return '';
    const s = competitor_saves.find(x => x.id === selectedCompetitorId);
    if (!s) return '';
    return `Top competitors: ${(s.output?.competitors || []).slice(0, 3).map((c: any) => c.name).join('; ')}`;
  }

  // Edit flow
  $effect(() => {
    try {
      const raw = sessionStorage.getItem('tool_edit_input');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.tool_type !== 'million_dollar_offer') return;
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
      if (input.offer_type) offer_type = input.offer_type;
      if (input.current_price) current_price = input.current_price;
      if (input.delivery_method) delivery_method = input.delivery_method;
      if (input.current_guarantee) current_guarantee = input.current_guarantee;
      if (input.dream_outcome_hint) dream_outcome_hint = input.dream_outcome_hint;
      if (input.biggest_objection) biggest_objection = input.biggest_objection;
      if (input.current_result_time) current_result_time = input.current_result_time;
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
      const res = await runMillionDollarOffer({
        business_name,
        business_type: resolvedBusinessType,
        industry: resolvedIndustry,
        location: location.trim(),
        target_audience: resolvedTargetAudience,
        differentiation: differentiation.trim(),
        price_range: price_range.trim(),
        product_description: product_description.trim(),
        product_features: product_features.trim(),
        offer_type,
        current_price: current_price.trim(),
        delivery_method,
        current_guarantee: current_guarantee.trim(),
        dream_outcome_hint: dream_outcome_hint.trim(),
        biggest_objection: biggest_objection.trim(),
        current_result_time: current_result_time.trim(),
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
      const title = saveTitle.trim() || `Offer — ${business_name} ${new Date().toLocaleDateString('th-TH')}`;
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
        offer_type,
        current_price: current_price.trim(),
        delivery_method,
        current_guarantee: current_guarantee.trim(),
        dream_outcome_hint: dream_outcome_hint.trim(),
        biggest_objection: biggest_objection.trim(),
        current_result_time: current_result_time.trim(),
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
        const res = await saveToolRun('million_dollar_offer', payload, output, title);
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
      a.download = `offer.${format}`;
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

  async function handleCanvasPDF() {
    if (!saveId) { await handleSave(); }
    if (!saveId) return;
    try {
      const res = await exportSavedTool(saveId, 'pdf');
      const url = `${PUBLIC_API_URL}${res.download_url}?print=1`;
      const win = window.open(url, '_blank');
      if (!win) alert('กรุณาอนุญาต popup เพื่อเปิดใบสรุป (PDF)');
    } catch (err: any) { alert(err.message); }
  }

  // Helpers for rendering
  const leverColor = (score: number) => {
    if (score >= 8) return 'bg-emerald-500 text-white';
    if (score >= 6) return 'bg-amber-500 text-white';
    if (score >= 4) return 'bg-orange-500 text-white';
    return 'bg-red-500 text-white';
  };
  const priceRatioColor = (ratio: string) => {
    const n = parseInt(ratio?.split(':')?.[0] || '0', 10);
    if (n >= 5) return 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700';
    if (n >= 3) return 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700';
    return 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700';
  };
</script>

<ToolLayout
  title="ข้อเสนอที่ลูกค้าปฏิเสธยาก"
  subtitle="ช่วยคุณออกแบบข้อเสนอที่ลูกค้าปฏิเสธยาก"
  icon="💎"
  color="amber"
>
  {#if !output}
    <div class="space-y-5">
      <div class="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <div class="font-semibold text-amber-900 dark:text-amber-200 mb-1">💎 ออกแบบข้อเสนอที่ปฏิเสธยาก</div>
        <div class="text-sm text-amber-800 dark:text-amber-300 space-y-1">
          <div>ช่วยคุณคิดข้อเสนอที่ลูกค้าเห็นแล้วรู้สึกว่า "พลาดไม่ได้" — คุ้มจนปฏิเสธไม่ลง</div>
          <div>ได้จุดขายหลัก ของแถมที่ช่วยปิดข้อกังวล ราคาที่แนะนำ การรับประกัน และชื่อข้อเสนอที่จำง่าย</div>
          <div>ต่อยอดได้จาก: ผลจากเช็คสินค้าตรงใจลูกค้าไหม → ข้อเสนอที่ลูกค้าปฏิเสธยาก</div>
          <button
            type="button"
            onclick={() => (showPrinciple = !showPrinciple)}
            class="text-xs text-amber-700/70 dark:text-amber-400/70 underline decoration-dotted hover:text-amber-700 dark:hover:text-amber-400"
          >
            {showPrinciple ? 'ซ่อนหลักการ' : 'ดูหลักการ'}
          </button>
          {#if showPrinciple}
            <div class="text-xs text-amber-700/80 dark:text-amber-400/80 pt-1">
              Value Equation (Alex Hormozi): มูลค่าที่ลูกค้ารู้สึก = (ผลลัพธ์ในฝัน × ความเชื่อว่าจะสำเร็จ) ÷ (เวลาที่ต้องรอ × ความยากลำบาก) — ประกอบด้วย 7 ส่วน: Dream Outcome, Value Stack, Trim & Stack, Pricing, Guarantee, Scarcity/Urgency, MAGIC Name
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
          <input type="text" bind:value={price_range} placeholder="เช่น 200-500 บาท" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">จุดต่าง (ถ้ามี)</label>
        <input type="text" bind:value={differentiation} placeholder="เช่น ขนมใต้สูตรโบราณ" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">สินค้า/บริการ *</label>
        <textarea bind:value={product_description} rows="3" placeholder="เช่น ขนมบ้านโกไข่ ขนมใต้สูตรโบราณ 28 สาขา" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"></textarea>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">จุดเด่นของสินค้า</label>
        <textarea bind:value={product_features} rows="2" placeholder="เช่น 1) สูตรโบราณ 2) วัตถุดิบสด 3) ปั๊ม ปตท." class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"></textarea>
      </div>

      <!-- Offer Context (3 dropdowns) -->
      <div class="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-4 space-y-3">
        <div class="font-semibold text-amber-900 dark:text-amber-200">💎 รายละเอียดข้อเสนอ (3 อย่าง — ไม่บังคับ)</div>
        <div>
          <label class="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">🎯 ประเภทข้อเสนอ</label>
          <select bind:value={offer_type} class="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-800 text-sm">
            <option value="">— เลือก / ปล่อยว่าง —</option>
            {#each OFFER_TYPES as t}
              <option value={t.id}>{t.label} — {t.desc}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">🚚 วิธีส่งมอบสินค้า/บริการ</label>
          <select bind:value={delivery_method} class="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-800 text-sm">
            <option value="">— เลือก / ปล่อยว่าง —</option>
            {#each DELIVERY_METHODS as d}
              <option value={d.id}>{d.label} — {d.desc}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">💵 ราคาปัจจุบัน</label>
          <input type="text" bind:value={current_price} placeholder="เช่น 350 บาท/ชิ้น" class="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-800 text-sm" />
        </div>
      </div>

      <!-- Customer Insight (3 inputs) -->
      <div class="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-4 space-y-3">
        <div class="font-semibold text-rose-900 dark:text-rose-200">💡 ข้อมูลลูกค้าเพิ่มเติม (ไม่บังคับ แต่แนะนำ)</div>
        <div>
          <label class="block text-xs font-semibold text-rose-800 dark:text-rose-300 mb-1">🎯 ลูกค้าฝันถึงอะไร</label>
          <input type="text" bind:value={dream_outcome_hint} placeholder="เช่น ได้กินขนมใต้แท้ในกรุงเทพ" class="w-full px-2.5 py-1.5 rounded border border-rose-200 dark:border-rose-800 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-rose-800 dark:text-rose-300 mb-1">⚠️ ข้อกังวลที่ใหญ่ที่สุดของลูกค้า</label>
          <input type="text" bind:value={biggest_objection} placeholder="เช่น กลัวขนมไม่สด / ขนส่งช้า" class="w-full px-2.5 py-1.5 rounded border border-rose-200 dark:border-rose-800 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-rose-800 dark:text-rose-300 mb-1">⏱️ เวลาเห็นผลปัจจุบัน</label>
          <input type="text" bind:value={current_result_time} placeholder="เช่น 2-3 วัน" class="w-full px-2.5 py-1.5 rounded border border-rose-200 dark:border-rose-800 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-rose-800 dark:text-rose-300 mb-1">🛡️ การรับประกันตอนนี้ (ถ้ามี)</label>
          <input type="text" bind:value={current_guarantee} placeholder="เช่น คืนเงิน 7 วัน" class="w-full px-2.5 py-1.5 rounded border border-rose-200 dark:border-rose-800 text-sm" />
        </div>
      </div>

      <!-- Optional pre-fill -->
      {#if vpc_saves.length > 0 || jtbd_saves.length > 0 || competitor_saves.length > 0}
        <div class="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40 border border-amber-300 dark:border-amber-700 rounded-xl p-3 space-y-2">
          <div class="font-semibold text-amber-900 dark:text-amber-200 text-sm">🔗 ใช้ข้อมูลจากเครื่องมืออื่นที่เคยทำไว้ (ไม่บังคับ)</div>
          {#if vpc_saves.length > 0}
            <div>
              <label class="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">💎 ผลจากเช็คสินค้าตรงใจลูกค้าไหม</label>
              <select bind:value={selectedVpcId} class="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-800 text-sm">
                <option value="">— ไม่ใช้ —</option>
                {#each vpc_saves as v}
                  <option value={v.id}>💎 {v.title}</option>
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
                  <option value={c.id}>🔍 {c.title}</option>
                {/each}
              </select>
            </div>
          {/if}
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
          {isGenerating ? '⏳ ระบบอัจฉริยะ กำลังออกแบบข้อเสนอ...' : '💎 ออกแบบข้อเสนอ'}
        </button>
      </div>
    </div>
  {:else}
    <div class="space-y-5">
      <!-- Summary -->
      {#if output.summary}
        <div class="bg-primary-50 dark:bg-primary-900/40 border-l-4 border-primary-500 dark:border-primary-600 p-4 rounded-lg">
          <div class="text-xs font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider mb-1">สรุปข้อเสนอ</div>
          <div class="text-dark-900 dark:text-dark-50">{output.summary}</div>
        </div>
      {/if}

      <!-- What makes it unbeatable -->
      {#if output.what_makes_it_unbeatable}
        <div class="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40 border-l-4 border-amber-500 dark:border-amber-600 p-3 rounded">
          <div class="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase mb-1">💎 ทำไมปฏิเสธไม่ลง</div>
          <div class="text-sm italic text-amber-900 dark:text-amber-200">"{output.what_makes_it_unbeatable}"</div>
        </div>
      {/if}

      <!-- Value Equation Audit (4 levers) -->
      {#if output.value_equation_audit}
        {@const ve = output.value_equation_audit}
        <div class="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-4">
          <h3 class="font-semibold text-amber-900 dark:text-amber-200 mb-3">⚖️ เช็คมูลค่าที่ลูกค้ารู้สึก 4 ด้าน</h3>
          <div class="grid grid-cols-2 gap-2 mb-3">
            <div class="bg-white dark:bg-dark-800 rounded-lg p-2 text-center">
              <div class="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase">↑ เพิ่ม</div>
            </div>
            <div class="bg-white dark:bg-dark-800 rounded-lg p-2 text-center">
              <div class="text-[10px] text-red-700 dark:text-red-400 font-bold uppercase">↓ ลด</div>
            </div>
          </div>
          <div class="grid sm:grid-cols-2 gap-3">
            {#each [
              { key: 'dream_outcome', label: '🎯 ผลลัพธ์ในฝัน', dir: '↑' },
              { key: 'perceived_likelihood', label: '💪 ความเชื่อว่าจะสำเร็จ', dir: '↑' },
              { key: 'time_delay', label: '⏱️ เวลาที่ต้องรอ', dir: '↓' },
              { key: 'effort_sacrifice', label: '💪 ความยากลำบากที่ต้องแลก', dir: '↓' },
            ] as lever}
              {@const item = ve[lever.key] || {}}
              <div class="bg-white dark:bg-dark-800 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <div class="flex items-center justify-between mb-1.5">
                  <div class="text-sm font-semibold text-amber-900 dark:text-amber-200">{lever.label} <span class="text-xs text-amber-600 dark:text-amber-400">{lever.dir}</span></div>
                  <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold {leverColor(item.score || 0)}">
                    {item.score || '-'}/10
                  </div>
                </div>
                {#if item.current_state}<div class="text-[10px] text-amber-800 dark:text-amber-300 mt-1"><b>ปัจจุบัน:</b> {item.current_state}</div>{/if}
                {#if item.improvement}<div class="text-[10px] text-emerald-800 dark:text-emerald-300 mt-0.5"><b>ปรับ:</b> {item.improvement}</div>{/if}
              </div>
            {/each}
          </div>
          {#if ve.binding_constraint}
            <div class="mt-3 bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 dark:border-red-600 rounded p-2.5 text-xs">
              <div class="font-bold text-red-800 dark:text-red-300">⚠️ จุดที่ฉุดรั้งมากที่สุด:</div>
              <div class="text-red-900 dark:text-red-200 mt-0.5">{ve.binding_constraint}</div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Starving Crowd -->
      {#if output.starving_crowd}
        {@const sc = output.starving_crowd}
        <div class="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-3">
          <div class="font-semibold text-rose-900 dark:text-rose-200 mb-2">🎯 กลุ่มลูกค้าที่พร้อมจ่าย (อยากได้มาก + มีเงินจ่าย)</div>
          <div class="text-sm text-rose-900 dark:text-rose-200 mb-2"><b>{sc.who}</b></div>
          <div class="text-xs text-rose-800 dark:text-rose-300 mb-2 italic">{sc.why_starving}</div>
          <div class="grid grid-cols-4 gap-1">
            <div class="bg-white dark:bg-dark-800 rounded p-1.5 text-center">
              <div class="text-[10px] text-rose-700 dark:text-rose-400">เจ็บปวด</div>
              <div class="text-sm font-bold {leverColor(sc.pain_level || 0)} rounded">{sc.pain_level || '-'}</div>
            </div>
            <div class="bg-white dark:bg-dark-800 rounded p-1.5 text-center">
              <div class="text-[10px] text-rose-700 dark:text-rose-400">มีเงินจ่าย</div>
              <div class="text-sm font-bold {leverColor(sc.purchasing_power || 0)} rounded">{sc.purchasing_power || '-'}</div>
            </div>
            <div class="bg-white dark:bg-dark-800 rounded p-1.5 text-center">
              <div class="text-[10px] text-rose-700 dark:text-rose-400">เข้าถึงง่าย</div>
              <div class="text-sm font-bold {leverColor(sc.targetability || 0)} rounded">{sc.targetability || '-'}</div>
            </div>
            <div class="bg-white dark:bg-dark-800 rounded p-1.5 text-center">
              <div class="text-[10px] text-rose-700 dark:text-rose-400">โตได้อีก</div>
              <div class="text-sm font-bold {leverColor(sc.growth_potential || 0)} rounded">{sc.growth_potential || '-'}</div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Dream Outcome -->
      {#if output.dream_outcome}
        {@const dr = output.dream_outcome}
        <div class="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40 border-2 border-amber-400 dark:border-amber-700 rounded-2xl p-4">
          <h3 class="font-semibold text-amber-900 dark:text-amber-200 mb-2">🎯 ผลลัพธ์ในฝันของลูกค้า</h3>
          <div class="bg-white dark:bg-dark-800 rounded-lg p-3 text-sm text-amber-900 dark:text-amber-200 font-semibold">"{dr.specific_description || '-'}"</div>
          {#if dr.by_when}<div class="text-xs text-amber-800 dark:text-amber-300 mt-2">⏱️ <b>ภายในเมื่อไร:</b> {dr.by_when}</div>{/if}
          {#if dr.sensory_detail}<div class="text-xs text-amber-800 dark:text-amber-300 mt-1">👁️ <b>ความรู้สึกที่จับต้องได้:</b> {dr.sensory_detail}</div>{/if}
          {#if dr.owns}<div class="text-xs text-amber-800 dark:text-amber-300 mt-1">👤 <b>ใครเป็นคนพิสูจน์ผลลัพธ์นี้:</b> {dr.owns}</div>{/if}
        </div>
      {/if}

      <!-- Obstacles & Solutions -->
      {#if output.obstacles_and_solutions?.length}
        <div class="bg-white dark:bg-dark-800 border-2 border-rose-200 dark:border-rose-800 rounded-xl p-3">
          <h3 class="font-semibold text-rose-900 dark:text-rose-200 mb-2 text-sm">🚧 อุปสรรค กับวิธีแก้ ({output.obstacles_and_solutions.length})</h3>
          <div class="space-y-1.5">
            {#each output.obstacles_and_solutions as o}
              <div class="bg-rose-50 dark:bg-rose-950/40 rounded p-2 text-xs">
                <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <span class="px-1.5 py-0.5 rounded text-[10px] border {o.value_lever === 'dream_outcome' || o.value_lever === 'likelihood' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' : 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700'}">↑ {o.value_lever}</span>
                  <span class="text-[10px] text-dark-900/60 dark:text-dark-100/60">[{o.delivery_vehicle}]</span>
                  <span class="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">{o.perceived_value}</span>
                </div>
                <div class="text-rose-900 dark:text-rose-200">⚠️ <b>{o.obstacle}</b></div>
                <div class="text-emerald-800 dark:text-emerald-300 mt-0.5">✅ → {o.solution}</div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Value Stack -->
      {#if output.value_stack?.length}
        <div class="bg-white dark:bg-dark-800 border-2 border-amber-200 dark:border-amber-800 rounded-xl p-3">
          <h3 class="font-semibold text-amber-900 dark:text-amber-200 mb-2 text-sm">📚 รายการที่ลูกค้าได้ ({output.value_stack.length})</h3>
          <div class="space-y-1.5">
            {#each output.value_stack as v}
              <div class="rounded p-2 text-xs {v.is_core ? 'bg-amber-100 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-700' : 'bg-amber-50 dark:bg-amber-950/40'}">
                <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <span class="px-1.5 py-0.5 rounded text-[10px] border {v.is_core ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-dark-800 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700'}">{v.is_core ? '⭐ รายการหลัก' : '🎁 ของแถม'}</span>
                  <span class="text-[10px] text-amber-700 dark:text-amber-400">ต้นทุน: {v.cost_to_deliver}</span>
                  <span class="ml-auto text-sm font-bold text-amber-700 dark:text-amber-400">{v.perceived_value}</span>
                </div>
                <div class="font-semibold text-amber-900 dark:text-amber-200">{v.name}</div>
                <div class="text-amber-800 dark:text-amber-300 text-[11px]">{v.description}</div>
                {#if v.addresses_obstacle}<div class="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">→ แก้: {v.addresses_obstacle}</div>{/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Pricing -->
      {#if output.pricing}
        {@const pr = output.pricing}
        <div class="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border-2 border-emerald-300 dark:border-emerald-700 rounded-2xl p-4">
          <h3 class="font-semibold text-emerald-900 dark:text-emerald-200 mb-2">💰 ราคา</h3>
          <div class="flex items-center gap-3 mb-2">
            <div class="bg-white dark:bg-dark-800 rounded-lg p-2 px-3 text-center">
              <div class="text-[10px] text-emerald-700 dark:text-emerald-400">ราคาแนะนำ</div>
              <div class="text-xl font-bold text-emerald-900 dark:text-emerald-200">{pr.recommended_price || '-'}</div>
            </div>
            <div class="bg-white dark:bg-dark-800 rounded-lg p-2 px-3 text-center border-2 {priceRatioColor(pr.value_to_price_ratio || '0:1')}">
              <div class="text-[10px]">อัตราคุ้มค่า</div>
              <div class="text-base font-bold">{pr.value_to_price_ratio || '?'}</div>
            </div>
            {#if pr.anchor_price}
              <div class="bg-white dark:bg-dark-800 rounded-lg p-2 px-3 text-center">
                <div class="text-[10px] text-emerald-700 dark:text-emerald-400">เทียบราคาเดิม</div>
                <div class="text-sm font-bold text-dark-900/60 dark:text-dark-100/60 line-through">{pr.anchor_price}</div>
              </div>
            {/if}
          </div>
          {#if pr.payment_options?.length}
            <div class="mt-2">
              <div class="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1">ตัวเลือกการผ่อนชำระ:</div>
              <div class="grid grid-cols-2 gap-1.5">
                {#each pr.payment_options as opt}
                  <div class="bg-white dark:bg-dark-800 rounded p-1.5 text-xs text-emerald-900 dark:text-emerald-200">
                    <b>{opt.structure}:</b> {opt.amount} {opt.monthly_equivalent ? `(${opt.monthly_equivalent}/mo)` : ''}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          {#if pr.pricing_rationale}
            <div class="mt-2 text-xs text-emerald-800 dark:text-emerald-300 italic">💡 {pr.pricing_rationale}</div>
          {/if}
        </div>
      {/if}

      <!-- Guarantee -->
      {#if output.guarantee}
        {@const g = output.guarantee}
        <div class="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-2 border-blue-300 dark:border-blue-700 rounded-2xl p-4">
          <h3 class="font-semibold text-blue-900 dark:text-blue-200 mb-2">🛡️ การรับประกัน (ให้ลูกค้าอุ่นใจ ไม่ต้องกลัวเสี่ยง)</h3>
          <div class="bg-white dark:bg-dark-800 rounded-lg p-3 border-2 border-blue-200 dark:border-blue-800">
            <div class="text-xs text-blue-700 dark:text-blue-400 font-bold uppercase">{g.type}</div>
            <div class="text-base font-bold text-blue-900 dark:text-blue-200 mt-1">"{g.name || '-'}"</div>
            <div class="text-sm text-blue-800 dark:text-blue-300 mt-1.5">{g.terms || '-'}</div>
            <div class="text-xs text-blue-700 dark:text-blue-400 mt-1.5">⏱️ {g.duration || '-'} · <b>ความเสี่ยงที่เรารับแทนลูกค้า:</b> {g.risk_to_us || '-'}</div>
            {#if g.why_it_works}<div class="text-xs text-emerald-700 dark:text-emerald-400 mt-1.5 italic">✅ {g.why_it_works}</div>{/if}
          </div>
          {#if output.secondary_guarantee?.applicable}
            {@const sg = output.secondary_guarantee}
            <div class="bg-white dark:bg-dark-800 rounded-lg p-3 border-2 border-blue-200 dark:border-blue-800 mt-2">
              <div class="text-xs text-blue-700 dark:text-blue-400 font-bold uppercase">➕ เพิ่มอีกชั้น: {sg.type}</div>
              <div class="text-sm font-bold text-blue-900 dark:text-blue-200 mt-1">"{sg.name || '-'}"</div>
              <div class="text-xs text-blue-800 dark:text-blue-300 mt-1">{sg.terms || '-'}</div>
              {#if sg.why_it_stacks}<div class="text-xs text-emerald-700 dark:text-emerald-400 mt-1 italic">✅ {sg.why_it_stacks}</div>{/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Scarcity & Urgency -->
      {#if output.scarcity_urgency}
        {@const su = output.scarcity_urgency}
        <div class="bg-white dark:bg-dark-800 border-2 border-orange-200 dark:border-orange-800 rounded-xl p-3">
          <h3 class="font-semibold text-orange-900 dark:text-orange-200 mb-2 text-sm">⏰ ความเร่งด่วน (ของมีจำกัด/เวลาจำกัด)</h3>
          <div class="grid sm:grid-cols-2 gap-2">
            <div class="bg-orange-50 dark:bg-orange-950/40 rounded p-2 text-xs">
              <div class="text-[10px] text-orange-700 dark:text-orange-400 uppercase font-bold">ของมีจำกัด</div>
              <div class="text-orange-900 dark:text-orange-200 font-semibold mt-0.5">{su.scarcity_type || '-'}</div>
              <div class="text-orange-800 dark:text-orange-300 mt-0.5">{su.scarcity_details || '-'}</div>
            </div>
            <div class="bg-amber-50 dark:bg-amber-950/40 rounded p-2 text-xs">
              <div class="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold">เวลาจำกัด</div>
              <div class="text-amber-900 dark:text-amber-200 font-semibold mt-0.5">{su.urgency_type || '-'}</div>
              <div class="text-amber-800 dark:text-amber-300 mt-0.5">{su.urgency_details || '-'}</div>
            </div>
          </div>
          {#if su.is_ethical}
            <div class="mt-2 bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-500 dark:border-emerald-600 rounded p-2 text-xs">
              <div class="font-bold text-emerald-800 dark:text-emerald-300">✅ ของจริง ไม่ได้สร้างขึ้นมาหลอกลวง</div>
              {#if su.ethical_note}<div class="text-emerald-800 dark:text-emerald-300 mt-0.5">{su.ethical_note}</div>{/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- MAGIC Name -->
      {#if output.offer_name}
        {@const n = output.offer_name}
        <div class="bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-50 dark:from-amber-950/40 dark:via-yellow-950/40 dark:to-amber-950/40 border-2 border-amber-400 dark:border-amber-700 rounded-2xl p-4">
          <h3 class="font-semibold text-amber-900 dark:text-amber-200 mb-2 text-center">🏷️ ชื่อข้อเสนอที่จำง่าย</h3>
          <div class="bg-white dark:bg-dark-800 rounded-lg p-3 text-center border-2 border-amber-300 dark:border-amber-700">
            <div class="text-2xl font-bold text-amber-900 dark:text-amber-200">"{n.full_name || '-'}"</div>
          </div>
          <div class="grid grid-cols-5 gap-1.5 mt-3 text-xs">
            <div class="bg-white dark:bg-dark-800 rounded p-1.5 text-center">
              <div class="text-[10px] text-amber-700 dark:text-amber-400 font-bold">M</div>
              <div class="text-amber-900 dark:text-amber-200 mt-0.5">{n.magnet || '-'}</div>
            </div>
            <div class="bg-white dark:bg-dark-800 rounded p-1.5 text-center">
              <div class="text-[10px] text-amber-700 dark:text-amber-400 font-bold">A</div>
              <div class="text-amber-900 dark:text-amber-200 mt-0.5">{n.avatar || '-'}</div>
            </div>
            <div class="bg-white dark:bg-dark-800 rounded p-1.5 text-center">
              <div class="text-[10px] text-amber-700 dark:text-amber-400 font-bold">G</div>
              <div class="text-amber-900 dark:text-amber-200 mt-0.5">{n.goal || '-'}</div>
            </div>
            <div class="bg-white dark:bg-dark-800 rounded p-1.5 text-center">
              <div class="text-[10px] text-amber-700 dark:text-amber-400 font-bold">I</div>
              <div class="text-amber-900 dark:text-amber-200 mt-0.5">{n.interval || '-'}</div>
            </div>
            <div class="bg-white dark:bg-dark-800 rounded p-1.5 text-center">
              <div class="text-[10px] text-amber-700 dark:text-amber-400 font-bold">C</div>
              <div class="text-amber-900 dark:text-amber-200 mt-0.5">{n.container || '-'}</div>
            </div>
          </div>
          {#if n.alternatives?.length}
            <div class="mt-3 text-xs text-amber-800 dark:text-amber-300">
              <b>ทางเลือก:</b> {n.alternatives.join(' | ')}
            </div>
          {/if}
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
      <ToolChainHint current="million_dollar_offer" />
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
          <button onclick={handlePromote} disabled={isPromoting} class="text-sm btn-secondary disabled:opacity-50" title="เอาไปใช้ในโปรเจกต์ (ใส่ให้อัตโนมัติในขั้นตอนที่ 1, 4, 7)">
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
