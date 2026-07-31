<script lang="ts">
  import ToolLayout from '$lib/ToolLayout.svelte';
  import BusinessContextFields from '$lib/BusinessContextFields.svelte';
  import ToolChainHint from '$lib/ToolChainHint.svelte';
  import { runJtbdGenerator, saveToolRun, updateToolRun, exportSavedTool, getExportUrl, getMeFull, promoteToolToProject } from '$lib/api';
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

  let core_problem = $state('');
  let current_solutions = $state('');
  let trigger_event = $state('');
  let known_objections = $state('');
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

  // Auto-load from sessionStorage on page mount (Edit flow)
  $effect(() => {
    try {
      const raw = sessionStorage.getItem('tool_edit_input');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.tool_type !== 'jtbd_generator') return;
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
      if (input.core_problem) core_problem = input.core_problem;
      if (input.current_solutions) current_solutions = input.current_solutions;
      if (input.trigger_event) trigger_event = input.trigger_event;
      if (input.known_objections) known_objections = input.known_objections;
      if (input.user_notes) user_notes = input.user_notes;
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

    error = '';
    isGenerating = true;
    output = null;
    try {
      const res = await runJtbdGenerator({
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
        core_problem: core_problem.trim(),
        current_solutions: current_solutions.trim(),
        trigger_event: trigger_event.trim(),
        known_objections: known_objections.trim(),
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
      const title = saveTitle.trim() || `JTBD — ${business_name} ${new Date().toLocaleDateString('th-TH')}`;
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
        core_problem: core_problem.trim(),
        current_solutions: current_solutions.trim(),
        trigger_event: trigger_event.trim(),
        known_objections: known_objections.trim(),
        user_notes: user_notes.trim(),
        business_type_resolved: resolvedBusinessType,
        industry_resolved: resolvedIndustry,
        target_audience_resolved: resolvedTargetAudience,
      };
      if (saveId) {
        await updateToolRun(saveId, { input: payload, output });
        saveMsg = '✓ อัปเดตเรียบร้อย';
      } else {
        const res = await saveToolRun('jtbd_generator', payload, output, title);
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
      a.download = `jtbd.${format}`;
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

  const intensityColor = (i: string) => {
    if (i === 'high') return 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700';
    if (i === 'medium') return 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700';
    return 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700';
  };
  const intensityLabel = (i: string) => {
    if (i === 'high') return '🔴 สูง';
    if (i === 'medium') return '🟡 กลาง';
    return '🟢 ต่ำ';
  };
  const scoreColor = (s: number) => {
    if (s >= 8) return 'bg-red-100 dark:bg-red-950/40 text-red-900 dark:text-red-200 border-red-300 dark:border-red-700';
    if (s >= 6) return 'bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700';
    return 'bg-blue-100 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700';
  };
  const stageLabel = (s: string) => {
    return ({ first_thought: '💡 เริ่มคิด', passive_looking: '👀 มองหาเงียบๆ', active_looking: '🔍 มองหาจริงจัง', deciding: '⚖️ ตัดสินใจ', first_use: '🚀 เริ่มใช้ครั้งแรก' } as any)[s] || s;
  };
  const stageOrder: string[] = ['first_thought', 'passive_looking', 'active_looking', 'deciding', 'first_use'];
</script>

<ToolLayout
  title="Job-to-be-Done (JTBD) Generator"
  subtitle="หา 'job' ที่ลูกค้าจ้างเราทำ — ใช้ 4 Forces of Progress + Decision Timeline + Outcome-Driven Innovation"
  icon="🎯"
  color="orange"
>
  {#if !output}
    <div class="space-y-5">
      <div class="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
        <div class="font-semibold text-indigo-900 dark:text-indigo-200 mb-1">🎯 JTBD Framework (Christensen + Moesta + Ulwick)</div>
        <div class="text-sm text-indigo-800 dark:text-indigo-300 space-y-1">
          <div><b>Core question:</b> "What progress is the customer trying to make?"</div>
          <div><b>Job statement:</b> When [situation], I want to [motivation], so I can [outcome]</div>
          <div><b>4 Forces of Progress:</b> Push + Pull > Anxiety + Habit = ลูกค้าเปลี่ยน</div>
          <div><b>5 Decision Stages:</b> First Thought → Passive → Active → Deciding → First Use</div>
          <div><b>Outcomes:</b> Importance × Satisfaction = Opportunity</div>
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
            placeholder="เช่น 50-150 บาท"
            class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">จุดต่าง (ถ้ามี)</label>
        <input
          type="text"
          bind:value={differentiation}
          placeholder="เช่น ใช้วัตถุดิบออร์แกนิค, ส่งฟรีใน 30 นาที"
          class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <!-- Customer profile inputs -->
      <div class="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/40 dark:to-blue-950/40 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4">
        <div class="font-semibold text-cyan-900 dark:text-cyan-200 mb-2">👤 Customer Profile</div>
        <div class="grid sm:grid-cols-3 gap-3">
          <div>
            <label class="block text-xs font-semibold text-cyan-800 dark:text-cyan-300 mb-1">อายุลูกค้า</label>
            <input type="text" bind:value={customer_age} placeholder="เช่น 28-40" class="w-full px-2.5 py-1.5 rounded border border-cyan-200 dark:border-cyan-800 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-cyan-800 dark:text-cyan-300 mb-1">อาชีพ</label>
            <input type="text" bind:value={customer_job} placeholder="เช่น พนักงานออฟฟิศ" class="w-full px-2.5 py-1.5 rounded border border-cyan-200 dark:border-cyan-800 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-cyan-800 dark:text-cyan-300 mb-1">รายได้</label>
            <input type="text" bind:value={customer_income} placeholder="เช่น 25,000-50,000" class="w-full px-2.5 py-1.5 rounded border border-cyan-200 dark:border-cyan-800 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>
        </div>
      </div>

      <!-- Deep context inputs (the unique JTBD inputs) -->
      <div class="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
        <div class="font-semibold text-amber-900 dark:text-amber-200 mb-1">🧠 Deep Context (ยิ่งกรอก ยิ่งดี)</div>

        <div>
          <label class="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">🎯 Core Problem — ลูกค้าเจอปัญหาอะไรบ่อยที่สุด</label>
          <textarea bind:value={core_problem} rows="2" placeholder="เช่น เวลากินขนมแล้วรู้สึกผิด เพราะกลัวอ้วน / ของแพงเกินไป ฯลฯ" class="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"></textarea>
        </div>

        <div>
          <label class="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">🛠 Current Solutions — ตอนนี้ลูกค้าใช้อะไรแก้</label>
          <textarea bind:value={current_solutions} rows="2" placeholder="เช่น ซื้อขนมคลีน, ทำเองที่บ้าน, กินผลไม้แทน, ไม่กินเลย" class="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"></textarea>
        </div>

        <div>
          <label class="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">⚡ Trigger — อะไรทำให้ลูกค้าเริ่มมองหาทางออกใหม่</label>
          <textarea bind:value={trigger_event} rows="2" placeholder="เช่น เพื่อนชวนไปออกกำลังกาย, หมอเตือนน้ำตาล, เห็นรีวิว IG" class="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"></textarea>
        </div>

        <div>
          <label class="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">😟 Objections / Fears — ลูกค้ากลัว/ลังเลอะไร</label>
          <textarea bind:value={known_objections} rows="2" placeholder="เช่น กลัวแพง, ไม่เชื่อว่าอร่อย, กลัวซื้อแล้วไม่กิน" class="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"></textarea>
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1.5">โน้ตเพิ่มเติม <span class="text-dark-900/50 dark:text-dark-100/50 font-normal">(optional)</span></label>
        <textarea
          bind:value={user_notes}
          rows="2"
          placeholder="อะไรก็ได้ที่อยากให้ ระบบอัจฉริยะ รู้เพิ่ม..."
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
          {isGenerating ? '⏳ ระบบอัจฉริยะ กำลังวิจัย...' : '🎯 วิเคราะห์ JTBD'}
        </button>
      </div>
    </div>
  {:else}
    <!-- Results -->
    <div class="space-y-5">
      {#if output.summary}
        <div class="bg-primary-50 dark:bg-primary-900/40 border-l-4 border-primary-500 dark:border-primary-600 p-4 rounded-lg">
          <div class="text-xs font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider mb-1">สรุป JTBD</div>
          <div class="text-dark-900 dark:text-dark-50">{output.summary}</div>
        </div>
      {/if}

      {#if output.answer_to_core_question}
        <div class="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-l-4 border-indigo-500 dark:border-indigo-600 p-4 rounded-lg">
          <div class="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mb-1">💡 Core Question → Answer</div>
          <div class="text-sm italic text-indigo-900 dark:text-indigo-200">"{output.answer_to_core_question}"</div>
        </div>
      {/if}

      <!-- Primary Job -->
      {#if output.primary_job}
        <div class="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 border-2 border-orange-300 dark:border-orange-700 rounded-2xl p-5">
          <h3 class="font-semibold text-lg mb-3 text-orange-900 dark:text-orange-200">🎯 Primary Job</h3>
          {#if output.primary_job.job_statement}
            <div class="bg-white dark:bg-dark-800 rounded-lg p-3 mb-3 border border-orange-200 dark:border-orange-800">
              <div class="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase mb-1">Job Statement</div>
              <div class="text-sm">{output.primary_job.job_statement}</div>
            </div>
          {/if}
          {#if output.primary_job.job_verb_format}
            <div class="text-xs text-orange-700 dark:text-orange-400 mb-3"><b>Ulwick format:</b> <span class="italic">{output.primary_job.job_verb_format}</span></div>
          {/if}
          {#if output.primary_job.dimensions}
            <div class="grid sm:grid-cols-3 gap-2 text-sm">
              <div class="bg-white dark:bg-dark-800 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                <div class="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase mb-1">⚙️ Functional</div>
                <div class="text-orange-900 dark:text-orange-200">{output.primary_job.dimensions.functional || '-'}</div>
              </div>
              <div class="bg-white dark:bg-dark-800 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                <div class="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase mb-1">💗 Emotional</div>
                <div class="text-orange-900 dark:text-orange-200">{output.primary_job.dimensions.emotional || '-'}</div>
              </div>
              <div class="bg-white dark:bg-dark-800 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                <div class="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase mb-1">👥 Social</div>
                <div class="text-orange-900 dark:text-orange-200">{output.primary_job.dimensions.social || '-'}</div>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Related Jobs -->
      {#if output.related_jobs?.length}
        <div class="space-y-2">
          <h3 class="font-semibold text-lg">📋 Related Jobs ({output.related_jobs.length})</h3>
          {#each output.related_jobs as r}
            <div class="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 rounded-lg p-3">
              <div class="font-semibold text-sm text-dark-900 dark:text-dark-50 mb-1">{r.job}</div>
              {#if r.context}<div class="text-xs text-dark-900/70 dark:text-dark-100/70 mb-1"><b>Context:</b> {r.context}</div>{/if}
              <div class="flex gap-2 text-xs flex-wrap">
                <span class="px-2 py-0.5 rounded {intensityColor(r.importance)}">Importance: {intensityLabel(r.importance)}</span>
                <span class="px-2 py-0.5 rounded {intensityColor(r.satisfaction_current)}">Satisfaction now: {intensityLabel(r.satisfaction_current)}</span>
              </div>
              {#if r.opportunity}
                <div class="text-xs text-emerald-700 dark:text-emerald-400 mt-1.5"><b>Opportunity:</b> {r.opportunity}</div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- Customer Decision Timeline -->
      {#if output.customer_decision_timeline?.length}
        <div class="space-y-2">
          <h3 class="font-semibold text-lg">⏱️ Customer Decision Timeline (5 Stages)</h3>
          <div class="relative">
            {#each stageOrder as stage}
              {@const items = output.customer_decision_timeline.filter((it: any) => it.stage === stage)}
              {#each items as t}
                <div class="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 rounded-lg p-4 mb-2">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-sm font-bold text-primary-600 dark:text-primary-400">{stageLabel(t.stage)}</span>
                    <span class="text-xs text-dark-900/40 dark:text-dark-100/40">— {t.stage_name_th || ''}</span>
                  </div>
                  <div class="grid sm:grid-cols-2 gap-2 text-xs">
                    {#if t.customer_thinks}
                      <div><b class="text-dark-900/70 dark:text-dark-100/70">💭 Thinks:</b> {t.customer_thinks}</div>
                    {/if}
                    {#if t.customer_feels}
                      <div><b class="text-dark-900/70 dark:text-dark-100/70">❤️ Feels:</b> {t.customer_feels}</div>
                    {/if}
                    {#if t.customer_does}
                      <div><b class="text-dark-900/70 dark:text-dark-100/70">👆 Does:</b> {t.customer_does}</div>
                    {/if}
                    {#if t.what_they_need}
                      <div><b class="text-dark-900/70 dark:text-dark-100/70">🎁 Needs:</b> {t.what_they_need}</div>
                    {/if}
                  </div>
                  {#if t.marketing_opportunity}
                    <div class="mt-2 bg-primary-50 dark:bg-primary-900/40 border-l-2 border-primary-400 dark:border-primary-600 rounded-r p-2 text-xs text-primary-900 dark:text-primary-200">
                      <b>📣 Marketing opportunity:</b> {t.marketing_opportunity}
                    </div>
                  {/if}
                </div>
              {/each}
            {/each}
          </div>
        </div>
      {/if}

      <!-- Forces of Progress -->
      {#if output.forces_of_progress}
        {@const f = output.forces_of_progress}
        <div class="space-y-3">
          <h3 class="font-semibold text-lg">⚖️ 4 Forces of Progress</h3>
          <div class="grid sm:grid-cols-2 gap-3">
            <div class="bg-red-50 dark:bg-red-950/40 border-2 border-red-200 dark:border-red-800 rounded-lg p-4">
              <div class="text-xs font-bold text-red-800 dark:text-red-300 uppercase mb-2">⬆️ PUSH (ดันให้เปลี่ยน)</div>
              <ul class="space-y-1.5 text-sm">
                {#each f.push || [] as p}
                  <li>
                    <span class="px-1.5 py-0.5 rounded text-[10px] {intensityColor(p.intensity)}">{intensityLabel(p.intensity)}</span>
                    <div class="text-red-900 dark:text-red-200 text-sm mt-0.5">{p.force}</div>
                    {#if p.evidence}<div class="text-xs text-red-700/70 dark:text-red-400/70 mt-0.5">{p.evidence}</div>{/if}
                  </li>
                {/each}
              </ul>
            </div>
            <div class="bg-green-50 dark:bg-green-950/40 border-2 border-green-200 dark:border-green-800 rounded-lg p-4">
              <div class="text-xs font-bold text-green-800 dark:text-green-300 uppercase mb-2">🧲 PULL (ดึงดูด)</div>
              <ul class="space-y-1.5 text-sm">
                {#each f.pull || [] as p}
                  <li>
                    <span class="px-1.5 py-0.5 rounded text-[10px] {intensityColor(p.intensity)}">{intensityLabel(p.intensity)}</span>
                    <div class="text-green-900 dark:text-green-200 text-sm mt-0.5">{p.force}</div>
                    {#if p.evidence}<div class="text-xs text-green-700/70 dark:text-green-400/70 mt-0.5">{p.evidence}</div>{/if}
                  </li>
                {/each}
              </ul>
            </div>
            <div class="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div class="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase mb-2">😟 ANXIETY (ถ่วง)</div>
              <ul class="space-y-1.5 text-sm">
                {#each f.anxiety || [] as p}
                  <li>
                    <span class="px-1.5 py-0.5 rounded text-[10px] {intensityColor(p.intensity)}">{intensityLabel(p.intensity)}</span>
                    <div class="text-amber-900 dark:text-amber-200 text-sm mt-0.5">{p.force}</div>
                    {#if p.evidence}<div class="text-xs text-amber-700/70 dark:text-amber-400/70 mt-0.5">{p.evidence}</div>{/if}
                  </li>
                {/each}
              </ul>
            </div>
            <div class="bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div class="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase mb-2">🛋️ HABIT (comfort zone)</div>
              <ul class="space-y-1.5 text-sm">
                {#each f.habit || [] as p}
                  <li>
                    <span class="px-1.5 py-0.5 rounded text-[10px] {intensityColor(p.intensity)}">{intensityLabel(p.intensity)}</span>
                    <div class="text-blue-900 dark:text-blue-200 text-sm mt-0.5">{p.force}</div>
                    {#if p.evidence}<div class="text-xs text-blue-700/70 dark:text-blue-400/70 mt-0.5">{p.evidence}</div>{/if}
                  </li>
                {/each}
              </ul>
            </div>
          </div>
          {#if f.verdict}
            <div class="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-l-4 border-indigo-500 dark:border-indigo-600 p-3 rounded text-sm text-indigo-900 dark:text-indigo-200">
              <b>⚖️ Verdict:</b> {f.verdict}
              {#if f.switch_likelihood}
                <span class="ml-2 px-2 py-0.5 rounded text-xs {intensityColor(f.switch_likelihood)}">Switch likelihood: {intensityLabel(f.switch_likelihood)}</span>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Desired Outcomes -->
      {#if output.desired_outcomes?.length}
        <div class="space-y-2">
          <h3 class="font-semibold text-lg">📏 Desired Outcomes ({output.desired_outcomes.length})</h3>
          <div class="text-xs text-dark-900/60 dark:text-dark-100/60 mb-2">Score: <b>Opportunity = Importance + max(Importance - Satisfaction, 0)</b></div>
          {#each output.desired_outcomes as o}
            <div class="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 rounded-lg p-3">
              <div class="flex items-start gap-2 mb-2">
                <span class="px-2 py-0.5 rounded text-xs border {scoreColor(o.opportunity_score)} font-bold">Opp: {o.opportunity_score}/10</span>
                {#if o.category}
                  <span class="px-2 py-0.5 rounded text-xs bg-dark-100 dark:bg-dark-700 text-dark-900/70 dark:text-dark-100/70">{o.category}</span>
                {/if}
              </div>
              <div class="text-sm font-mono text-dark-900 dark:text-dark-50 mb-1.5">{o.outcome}</div>
              <div class="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div class="flex items-center gap-1">
                    <span class="text-dark-900/60 dark:text-dark-100/60 w-20">Importance</span>
                    <div class="flex-1 h-1.5 bg-dark-100 dark:bg-dark-700 rounded-full overflow-hidden">
                      <div class="h-full bg-primary-500" style="width:{o.importance * 10}%"></div>
                    </div>
                    <span class="font-semibold w-6 text-right">{o.importance}</span>
                  </div>
                </div>
                <div>
                  <div class="flex items-center gap-1">
                    <span class="text-dark-900/60 dark:text-dark-100/60 w-20">Satisfaction</span>
                    <div class="flex-1 h-1.5 bg-dark-100 dark:bg-dark-700 rounded-full overflow-hidden">
                      <div class="h-full bg-amber-500" style="width:{o.satisfaction_current * 10}%"></div>
                    </div>
                    <span class="font-semibold w-6 text-right">{o.satisfaction_current}</span>
                  </div>
                </div>
              </div>
              {#if o.why}
                <div class="text-xs text-dark-900/70 dark:text-dark-100/70 mt-1.5"><b>Why:</b> {o.why}</div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- Triggers -->
      {#if output.triggers?.length}
        <div class="space-y-2">
          <h3 class="font-semibold text-lg">⚡ Triggers ({output.triggers.length})</h3>
          <div class="grid sm:grid-cols-2 gap-2">
            {#each output.triggers as t}
              <div class="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 rounded-lg p-3">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">{t.type}</span>
                  <span class="text-xs text-dark-900/60 dark:text-dark-100/60">{t.frequency}</span>
                </div>
                <div class="text-sm font-medium text-dark-900 dark:text-dark-50 mb-1">{t.event}</div>
                {#if t.emotional_state}
                  <div class="text-xs text-dark-900/70 dark:text-dark-100/70">❤️ {t.emotional_state}</div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Job Map (Ulwick 8 steps) -->
      {#if output.job_map?.length}
        {@const jobMapLabels = ({ define: '1️⃣ Define', locate: '2️⃣ Locate', prepare: '3️⃣ Prepare', confirm: '4️⃣ Confirm', execute: '5️⃣ Execute', monitor: '6️⃣ Monitor', modify: '7️⃣ Modify', conclude: '8️⃣ Conclude' } as Record<string, string>)}
        <div class="space-y-2">
          <h3 class="font-semibold text-lg">🗺️ Job Map — 8 ขั้นตอนการทำงาน</h3>
          <div class="grid sm:grid-cols-2 gap-2">
            {#each output.job_map as step}
              <div class="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 rounded-lg p-3">
                <div class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase mb-1">{jobMapLabels[step.step] || step.step}</div>
                <div class="text-sm text-dark-900 dark:text-dark-50 mb-1">{step.customer_action}</div>
                {#if step.opportunity}<div class="text-xs text-emerald-700 dark:text-emerald-400">💡 {step.opportunity}</div>{/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Hiring & Firing Criteria -->
      {#if output.hiring_firing_criteria}
        {@const hf = output.hiring_firing_criteria}
        <div class="bg-white dark:bg-dark-800 border-2 border-dark-200 dark:border-dark-600 rounded-xl p-4">
          <h3 class="font-semibold text-lg mb-3">🔄 Hiring &amp; Firing Criteria</h3>
          <div class="grid sm:grid-cols-2 gap-3">
            <div class="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div class="text-xs font-bold text-red-800 dark:text-red-300 uppercase mb-1">🔥 Fired (เลิกใช้เดิม) เพราะ</div>
              <div class="text-sm text-red-900 dark:text-red-200">{hf.fired_because}</div>
            </div>
            <div class="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <div class="text-xs font-bold text-green-800 dark:text-green-300 uppercase mb-1">✅ Hired (เลือกใหม่) เพราะ</div>
              <div class="text-sm text-green-900 dark:text-green-200">{hf.hired_because}</div>
            </div>
          </div>
          {#if hf.switch_moment}
            <div class="mt-2 text-xs text-dark-900/70 dark:text-dark-100/70"><b>⏱️ จุดเปลี่ยนใจ:</b> {hf.switch_moment}</div>
          {/if}
        </div>
      {/if}

      <!-- Deep Research Insights -->
      {#if output.deep_research_insights}
        {@const ins = output.deep_research_insights}
        <div class="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/40 border-2 border-purple-300 dark:border-purple-700 rounded-2xl p-5">
          <h3 class="font-semibold text-lg mb-3 text-purple-900 dark:text-purple-200">🧠 Deep Research Insights</h3>
          {#if ins.methodology}
            <div class="text-xs text-purple-800 dark:text-purple-300 italic mb-3">Methodology: {ins.methodology}</div>
          {/if}
          {#if ins.key_insights?.length}
            <div class="space-y-1.5 mb-3">
              {#each ins.key_insights as ki}
                <div class="text-sm bg-white dark:bg-dark-800 rounded p-2 border border-purple-200 dark:border-purple-800">💡 {ki}</div>
              {/each}
            </div>
          {/if}
          {#if ins.what_most_brands_get_wrong}
            <div class="bg-rose-50 dark:bg-rose-950/40 border-l-4 border-rose-400 dark:border-rose-600 rounded-r p-2.5 text-sm text-rose-900 dark:text-rose-200 mb-3">
              <b>⚠️ ที่แบรนด์ส่วนใหญ่ทำผิด:</b> {ins.what_most_brands_get_wrong}
            </div>
          {/if}
          {#if ins.validation_methods?.length}
            <div class="bg-white dark:bg-dark-800 border border-purple-200 dark:border-purple-800 rounded p-3">
              <div class="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase mb-1.5">🔬 Validation Methods</div>
              <ul class="space-y-0.5 text-xs text-purple-900 dark:text-purple-200">
                {#each ins.validation_methods as v}
                  <li>• {v}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Next Steps -->
      {#if output.next_steps?.length}
        <div class="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
          <div class="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase mb-2">➡️ Next Steps</div>
          <ul class="space-y-1 text-sm text-emerald-900 dark:text-emerald-200">
            {#each output.next_steps as s}
              <li class="flex gap-2"><span class="text-emerald-600 dark:text-emerald-400">→</span>{s}</li>
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
      <ToolChainHint current="jtbd_generator" />
      <div class="flex items-center justify-between pt-4 border-t border-dark-100 dark:border-dark-700 flex-wrap gap-2">
        <button onclick={() => { output = null; error = ''; saveId = null; saveMsg = ''; }} class="text-sm text-dark-900/60 dark:text-dark-100/60 hover:text-primary-600 dark:hover:text-primary-400">
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
