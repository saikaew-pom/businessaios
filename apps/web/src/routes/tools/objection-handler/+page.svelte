<script lang="ts">
  import ToolLayout from '$lib/ToolLayout.svelte';
  import CanvasPdfButton from '$lib/CanvasPdfButton.svelte';
  import BusinessContextFields from '$lib/BusinessContextFields.svelte';
  import { runObjectionHandler, saveToolRun, updateToolRun, exportSavedTool, getExportUrl, promoteToolToProject, listSavedTools } from '$lib/api';
  import { goto } from '$app/navigation';
  import { BUSINESS_TYPES, TARGET_AUDIENCES, SALES_CHANNELS, PRICE_POSITIONS, OBJECTION_CATEGORIES, REFRAME_STRATEGIES } from '$lib/presets';
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

  let sales_channel = $state('');
  let known_objection = $state('');
  let price_position = $state('');
  let user_notes = $state('');

  // Optional pre-fill
  let offer_saves = $state<any[]>([]);
  let competitor_saves = $state<any[]>([]);
  let persona_saves = $state<any[]>([]);
  let selectedOfferId = $state('');
  let selectedCompetitorId = $state('');
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
    listSavedTools({ tool_type: 'competitor_analysis' }).then(s => { competitor_saves = s || []; }).catch(() => {});
    listSavedTools({ tool_type: 'persona_builder' }).then(s => { persona_saves = s || []; }).catch(() => {});
  });

  function buildOfferContext(): string {
    if (!selectedOfferId) return '';
    const s = offer_saves.find(x => x.id === selectedOfferId);
    if (!s) return '';
    return `Offer Name: ${s.output?.offer_name?.full_name || '-'}
Price: ${s.output?.pricing?.recommended_price || '-'}
Guarantee: ${s.output?.guarantee?.name || '-'}`;
  }

  function buildCompetitorContext(): string {
    if (!selectedCompetitorId) return '';
    const s = competitor_saves.find(x => x.id === selectedCompetitorId);
    if (!s) return '';
    return `Top competitors: ${(s.output?.competitors || []).slice(0, 3).map((c: any) => c.name).join('; ')}`;
  }

  function buildPersonaContext(): string {
    if (!selectedPersonaId) return '';
    const s = persona_saves.find(x => x.id === selectedPersonaId);
    if (!s) return '';
    return `Persona: ${(s.output?.personas || []).slice(0, 1).map((p: any) => p.name).join(', ')}`;
  }

  $effect(() => {
    try {
      const raw = sessionStorage.getItem('tool_edit_input');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.tool_type !== 'objection_handler') return;
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
      if (input.sales_channel) sales_channel = input.sales_channel;
      if (input.known_objection) known_objection = input.known_objection;
      if (input.price_position) price_position = input.price_position;
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
      const res = await runObjectionHandler({
        business_name,
        business_type: resolvedBusinessType,
        industry: resolvedIndustry,
        location: location.trim(),
        target_audience: resolvedTargetAudience,
        differentiation: differentiation.trim(),
        price_range: price_range.trim(),
        product_description: product_description.trim(),
        product_features: product_features.trim(),
        sales_channel,
        known_objection: known_objection.trim(),
        price_position,
        offer_context: buildOfferContext(),
        competitor_context: buildCompetitorContext(),
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
      const title = saveTitle.trim() || `Objections — ${business_name} ${new Date().toLocaleDateString('th-TH')}`;
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
        sales_channel,
        known_objection: known_objection.trim(),
        price_position,
        user_notes: user_notes.trim(),
        offer_save_id: selectedOfferId || '',
        competitor_save_id: selectedCompetitorId || '',
        persona_save_id: selectedPersonaId || '',
        business_type_resolved: resolvedBusinessType,
        industry_resolved: resolvedIndustry,
        target_audience_resolved: resolvedTargetAudience,
      };
      if (saveId) {
        await updateToolRun(saveId, { input: payload, output });
        saveMsg = '✓ อัปเดตเรียบร้อย';
      } else {
        const res = await saveToolRun('objection_handler', payload, output, title);
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
      a.href = url; a.download = `objections.${format}`; a.target = '_blank'; a.click();
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
      price: 'bg-red-100 text-red-800 border-red-300',
      trust: 'bg-blue-100 text-blue-800 border-blue-300',
      need: 'bg-purple-100 text-purple-800 border-purple-300',
      time: 'bg-amber-100 text-amber-800 border-amber-300',
      authority: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      comparison: 'bg-pink-100 text-pink-800 border-pink-300',
      risk: 'bg-orange-100 text-orange-800 border-orange-300',
    };
    return map[cat] || 'bg-gray-100 text-gray-800 border-gray-300';
  };
</script>

<ToolLayout
  title="Objection Handler"
  subtitle="จัดการข้อโต้แย้งลูกค้า — 7 Categories + LAER + Reframing"
  icon="🛡️"
  color="rose"
>
  {#if !output}
    <div class="space-y-5">
      <div class="bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 rounded-xl p-4">
        <div class="font-semibold text-rose-900 mb-1">🛡️ Objection Handler</div>
        <div class="text-sm text-rose-800 space-y-1">
          <div><b>7 Objection Categories:</b> Price · Trust · Need · Time · Authority · Comparison · Risk</div>
          <div><b>LAER Framework:</b> Listen → Acknowledge → Explore → Respond</div>
          <div><b>Reframing:</b> Value / Cost of Inaction / Comparison / Risk Reversal / Identity / Time / ROI</div>
          <div><b>Output:</b> 5-8 objections + response scripts + evidence + bridge to close + FAQ Top 5</div>
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">ชื่อธุรกิจ *</label>
        <input type="text" bind:value={business_name} placeholder="เช่น ขนมบ้านโกไข่" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 focus:outline-none focus:ring-2 focus:ring-primary-500" />
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
          <input type="text" bind:value={price_range} placeholder="เช่น 50-500 บาท" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">จุดต่าง (ถ้ามี)</label>
        <input type="text" bind:value={differentiation} placeholder="เช่น ขนมใต้สูตรโบราณ" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">Product / Service *</label>
        <textarea bind:value={product_description} rows="3" placeholder="เช่น ขนมบ้านโกไข่ ขนมใต้สูตรโบราณ 28 สาขา" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"></textarea>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">Features / จุดเด่น</label>
        <textarea bind:value={product_features} rows="2" placeholder="เช่น 1) สูตรโบราณ 2) วัตถุดิบสด 3) ปั๊ม ปตท." class="w-full px-3 py-2.5 rounded-lg border border-dark-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"></textarea>
      </div>

      <!-- Sales Context -->
      <div class="bg-gradient-to-r from-rose-50 to-pink-50 border-2 border-rose-300 rounded-xl p-4 space-y-3">
        <div class="font-semibold text-rose-900">💬 Sales Context (3 ตัวเลือก)</div>
        <div>
          <label class="block text-xs font-semibold text-rose-800 mb-1">💬 Sales Channel</label>
          <select bind:value={sales_channel} class="w-full px-2.5 py-1.5 rounded border border-rose-200 text-sm">
            <option value="">— เลือก / ปล่อยว่าง —</option>
            {#each SALES_CHANNELS as c}
              <option value={c.id}>{c.label} — {c.desc}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-rose-800 mb-1">💎 Price Position</label>
          <select bind:value={price_position} class="w-full px-2.5 py-1.5 rounded border border-rose-200 text-sm">
            <option value="">— เลือก / ปล่อยว่าง —</option>
            {#each PRICE_POSITIONS as p}
              <option value={p.id}>{p.label}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-rose-800 mb-1">⚠️ Top Objection ที่เจอบ่อย (ถ้ามี)</label>
          <input type="text" bind:value={known_objection} placeholder="เช่น แพงไป / ขนมใต้ไม่เหมือนเดิม" class="w-full px-2.5 py-1.5 rounded border border-rose-200 text-sm" />
        </div>
      </div>

      <!-- Optional pre-fill -->
      {#if offer_saves.length > 0 || competitor_saves.length > 0 || persona_saves.length > 0}
        <div class="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-xl p-3 space-y-2">
          <div class="font-semibold text-amber-900 text-sm">🔗 เชื่อม strategic tools ที่เคยวิเคราะห์ไว้ (optional)</div>
          {#if offer_saves.length > 0}
            <div>
              <label class="block text-xs font-semibold text-amber-800 mb-1">💎 Offer</label>
              <select bind:value={selectedOfferId} class="w-full px-2.5 py-1.5 rounded border border-amber-200 text-sm">
                <option value="">— ไม่ใช้ Offer —</option>
                {#each offer_saves as o}<option value={o.id}>💎 {o.title}</option>{/each}
              </select>
            </div>
          {/if}
          {#if competitor_saves.length > 0}
            <div>
              <label class="block text-xs font-semibold text-amber-800 mb-1">🔍 Competitor</label>
              <select bind:value={selectedCompetitorId} class="w-full px-2.5 py-1.5 rounded border border-amber-200 text-sm">
                <option value="">— ไม่ใช้ Competitor —</option>
                {#each competitor_saves as c}<option value={c.id}>🔍 {c.title}</option>{/each}
              </select>
            </div>
          {/if}
        </div>
      {/if}

      <div>
        <label class="block text-sm font-semibold mb-1.5">โน้ตเพิ่มเติม <span class="text-dark-900/50 font-normal">(optional)</span></label>
        <textarea bind:value={user_notes} rows="2" placeholder="อะไรก็ได้ที่อยากให้ ระบบอัจฉริยะ รู้เพิ่ม..." class="w-full px-3 py-2.5 rounded-lg border border-dark-200 focus:outline-none focus:ring-2 focus:ring-primary-500"></textarea>
      </div>

      {#if error}<div class="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>{/if}

      <div class="pt-4 flex items-center justify-end border-t border-dark-100">
        <button onclick={handleGenerate} disabled={isGenerating} class="btn-primary disabled:opacity-50">
          {isGenerating ? '⏳ ระบบอัจฉริยะ กำลังวิเคราะห์ Objections...' : '🛡️ สร้าง Objection Handler'}
        </button>
      </div>
    </div>
  {:else}
    <div class="space-y-5">
      {#if output.summary}
        <div class="bg-primary-50 border-l-4 border-primary-500 p-4 rounded-lg">
          <div class="text-xs font-bold text-primary-700 uppercase tracking-wider mb-1">สรุป Objection Playbook</div>
          <div class="text-dark-900">{output.summary}</div>
        </div>
      {/if}

      <!-- Objections -->
      {#if output.objections?.length}
        <div class="space-y-3">
          <h3 class="text-lg font-bold text-rose-900">🎯 Objections ({output.objections.length})</h3>
          {#each output.objections as o, i}
            <div class="bg-white border-2 border-rose-200 rounded-xl p-4">
              <div class="flex items-center gap-2 mb-2 flex-wrap">
                <span class="text-xs font-bold text-rose-700">#{i + 1}</span>
                <span class="px-2 py-0.5 rounded text-xs border {categoryColor(o.category)}">{o.category}</span>
                <span class="px-2 py-0.5 rounded text-xs bg-rose-100 text-rose-800 border border-rose-300">{o.reframe_strategy}</span>
              </div>
              <div class="text-sm font-bold text-rose-900 mb-2">{o.objection}</div>

              <div class="bg-rose-50 rounded p-2 mb-2 text-xs">
                <div class="text-[10px] text-rose-700 font-bold uppercase mb-0.5">💬 ลูกค้าพูดว่า:</div>
                <div class="text-rose-900 italic">"{o.what_customer_says}"</div>
              </div>

              <div class="bg-amber-50 rounded p-2 mb-2 text-xs">
                <div class="text-[10px] text-amber-700 font-bold uppercase mb-0.5">🔍 ทำไมลูกค้าพูดแบบนี้:</div>
                <div class="text-amber-900">{o.why_they_say_it}</div>
              </div>

              <div class="bg-emerald-50 border-l-4 border-emerald-500 rounded-r p-3 mb-2 text-xs">
                <div class="text-[10px] text-emerald-700 font-bold uppercase mb-1">✅ บทตอบ (Response Script):</div>
                <div class="text-emerald-900 leading-relaxed">{o.response_script}</div>
              </div>

              {#if o.evidence_to_provide?.length}
                <div class="bg-blue-50 rounded p-2 mb-2 text-xs">
                  <div class="text-[10px] text-blue-700 font-bold uppercase mb-1">📊 หลักฐานที่ใช้:</div>
                  <ul class="text-blue-900 space-y-0.5">
                    {#each o.evidence_to_provide as e}<li>• {e}</li>{/each}
                  </ul>
                </div>
              {/if}

              {#if o.bridge_to_close}
                <div class="bg-purple-50 border-l-4 border-purple-500 rounded-r p-2 text-xs">
                  <div class="text-[10px] text-purple-700 font-bold uppercase mb-0.5">🌉 Bridge to Close:</div>
                  <div class="text-purple-900">{o.bridge_to_close}</div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- Common Patterns -->
      {#if output.common_patterns?.length}
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div class="font-semibold text-amber-900 mb-1.5 text-sm">🔁 Common Patterns</div>
          <ul class="text-sm text-amber-900 space-y-1">
            {#each output.common_patterns as p}<li>• {p}</li>{/each}
          </ul>
        </div>
      {/if}

      <!-- Do / Don't -->
      {#if output.do_dont}
        <div class="grid md:grid-cols-2 gap-3">
          <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <div class="font-semibold text-emerald-900 mb-1.5 text-sm">✅ Do</div>
            <ul class="text-sm text-emerald-900 space-y-1">
              {#each (output.do_dont.do || []) as d}<li>✓ {d}</li>{/each}
            </ul>
          </div>
          <div class="bg-red-50 border border-red-200 rounded-lg p-3">
            <div class="font-semibold text-red-900 mb-1.5 text-sm">❌ Don't</div>
            <ul class="text-sm text-red-900 space-y-1">
              {#each (output.do_dont.dont || []) as d}<li>✗ {d}</li>{/each}
            </ul>
          </div>
        </div>
      {/if}

      <!-- FAQ Top 5 -->
      {#if output.faq_top_5?.length}
        <div class="bg-white border-2 border-rose-200 rounded-xl p-4">
          <h3 class="font-bold text-rose-900 mb-2 text-sm">❓ FAQ Top 5</h3>
          <div class="space-y-2">
            {#each output.faq_top_5 as f, i}
              <div class="border-l-4 border-rose-400 bg-rose-50 rounded-r p-2 text-xs">
                <div class="font-bold text-rose-900">Q{i + 1}: {f.q}</div>
                <div class="text-rose-800 mt-0.5">→ {f.a}</div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Next Steps -->
      {#if output.next_steps?.length}
        <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <div class="font-bold text-emerald-800 uppercase text-xs mb-1.5">➡️ Next Steps</div>
          <ul class="text-sm text-emerald-900">
            {#each output.next_steps as s}<li>→ {s}</li>{/each}
          </ul>
        </div>
      {/if}

      {#if output.reasoning}
        <div class="bg-white border border-dark-100 rounded-xl p-4 text-sm italic text-dark-900/70">
          💡 {output.reasoning}
        </div>
      {/if}

      <!-- Action bar -->
      <div class="flex items-center justify-between pt-4 border-t border-dark-100 flex-wrap gap-2">
        <button onclick={() => { output = null; error = ''; saveId = null; saveMsg = ''; }} class="text-sm text-dark-900/60 hover:text-primary-600">
          ← สร้างใหม่
        </button>
        <div class="flex items-center gap-2 flex-wrap">
          {#if saveMsg}<span class="text-xs {saveMsg.startsWith('✓') ? 'text-green-700' : 'text-red-700'}">{saveMsg}</span>{/if}
          <input type="text" bind:value={saveTitle} placeholder="ตั้งชื่อ" class="text-xs px-2 py-1.5 rounded border border-dark-200 w-40" />
          <button onclick={handleSave} disabled={isSaving} class="text-sm btn-secondary disabled:opacity-50">
            {isSaving ? '...' : (saveId ? '✓ บันทึกแล้ว' : '💾 บันทึก')}
          </button>
          <button onclick={handlePromote} disabled={isPromoting} class="text-sm btn-secondary disabled:opacity-50" title="บันทึกเป็นโปรเจกต์ (import เข้า step 4, 5, 6)">
            {isPromoting ? '...' : '📋 เป็น Playbook'}
          </button>
          {#if saveId}<CanvasPdfButton saveId={saveId} />{/if}
          <button onclick={() => handleExport('md')} class="text-sm btn-secondary">📥 .md</button>
          <button onclick={() => handleExport('json')} class="text-sm btn-secondary">📥 .json</button>
        </div>
      </div>
      {#if promoteMsg}<div class="mt-2 text-xs {promoteMsg.startsWith('✓') ? 'text-green-700' : 'text-red-700'}">{promoteMsg}</div>{/if}
    </div>
  {/if}
</ToolLayout>
