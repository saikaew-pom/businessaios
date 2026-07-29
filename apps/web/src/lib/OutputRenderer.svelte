<script lang="ts">
  /**
   * OutputRenderer — renders Smart Engine generation output as beautiful, professional cards
   * Each step has its own layout
   */
  let { step, output }: { step: number; output: any } = $props();

  function copy(text: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  }
</script>

{#if step === 1 && output}
  <!-- Step 1: Brand Card -->
  <div class="space-y-4">
    <div class="bg-gradient-to-br from-primary-50 to-white border border-primary-200 rounded-2xl p-6">
      <div class="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">Positioning</div>
      <div class="text-lg font-semibold text-dark-900 leading-snug">{output.positioning || '—'}</div>
    </div>

    <div class="grid md:grid-cols-2 gap-4">
      <div class="bg-white border border-dark-100 rounded-xl p-5">
        <div class="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">UVP</div>
        <div class="text-sm text-dark-900 leading-relaxed">{output.uvp || '—'}</div>
      </div>
      <div class="bg-white border border-dark-100 rounded-xl p-5">
        <div class="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">Voice & Tone</div>
        <div class="text-sm text-dark-900 leading-relaxed">{output.voice_tone || '—'}</div>
      </div>
    </div>

    <div class="bg-white border border-dark-100 rounded-xl p-5">
      <div class="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">Target Audience</div>
      <div class="text-sm text-dark-900 leading-relaxed">{output.target_audience || '—'}</div>
    </div>

    {#if output.anti_positioning}
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <div class="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">ไม่ใช่ลูกค้าเรา</div>
        <div class="text-sm text-dark-900 leading-relaxed">{output.anti_positioning}</div>
      </div>
    {/if}

    {#if output.reasoning}
      <details class="bg-dark-50 border border-dark-100 rounded-xl p-5">
        <summary class="cursor-pointer text-sm font-semibold text-dark-900/70">💡 ทำไม ระบบอัจฉริยะ ถึงแนะนำแบบนี้</summary>
        <div class="mt-3 text-sm text-dark-900/80 leading-relaxed">{output.reasoning}</div>
      </details>
    {/if}
  </div>

{:else if step === 2 && output}
  <!-- Step 2: Customer Persona -->
  <div class="space-y-4">
    {#if output.personas && output.personas.length > 0}
      {#each output.personas as persona, i}
        <div class="bg-white border border-dark-100 rounded-2xl p-6">
          <div class="flex items-start gap-3 mb-4">
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold">
              {persona.name?.[0] || '?'}
            </div>
            <div class="flex-1">
              <div class="font-semibold text-dark-900">{persona.name || `Persona ${i+1}`}</div>
              {#if persona.size_estimate}
                <div class="text-xs text-dark-900/60">≈ {persona.size_estimate}</div>
              {/if}
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-4 mb-4">
            {#if persona.demographics}
              <div class="bg-dark-50 rounded-lg p-4">
                <div class="text-xs font-semibold text-primary-600 mb-2">ข้อมูลส่วนตัว</div>
                <dl class="text-sm space-y-1">
                  {#if persona.demographics.age}<div class="flex"><dt class="w-20 text-dark-900/60">อายุ</dt><dd>{persona.demographics.age}</dd></div>{/if}
                  {#if persona.demographics.job}<div class="flex"><dt class="w-20 text-dark-900/60">อาชีพ</dt><dd>{persona.demographics.job}</dd></div>{/if}
                  {#if persona.demographics.income}<div class="flex"><dt class="w-20 text-dark-900/60">รายได้</dt><dd>{persona.demographics.income}</dd></div>{/if}
                  {#if persona.demographics.location}<div class="flex"><dt class="w-20 text-dark-900/60">ที่อยู่</dt><dd>{persona.demographics.location}</dd></div>{/if}
                </dl>
              </div>
            {/if}
            {#if persona.psychographics}
              <div class="bg-dark-50 rounded-lg p-4">
                <div class="text-xs font-semibold text-primary-600 mb-2">ความสนใจ/ความกลัว</div>
                <dl class="text-sm space-y-1">
                  {#if persona.psychographics.values}<div class="flex"><dt class="w-20 text-dark-900/60">ค่านิยม</dt><dd>{persona.psychographics.values}</dd></div>{/if}
                  {#if persona.psychographics.fears}<div class="flex"><dt class="w-20 text-dark-900/60">กลัว</dt><dd>{persona.psychographics.fears}</dd></div>{/if}
                  {#if persona.psychographics.aspirations}<div class="flex"><dt class="w-20 text-dark-900/60">ใฝ่ฝัน</dt><dd>{persona.psychographics.aspirations}</dd></div>{/if}
                </dl>
              </div>
            {/if}
          </div>

          {#if persona.pain_points && persona.pain_points.length > 0}
            <div class="mb-3">
              <div class="text-xs font-semibold text-red-600 mb-2">😣 Pain Points</div>
              <ul class="text-sm space-y-1">
                {#each persona.pain_points as p}<li class="flex gap-2"><span class="text-red-400">•</span>{p}</li>{/each}
              </ul>
            </div>
          {/if}

          {#if persona.preferred_channels && persona.preferred_channels.length > 0}
            <div class="mb-3">
              <div class="text-xs font-semibold text-primary-600 mb-2">📱 ช่องทางที่ใช้</div>
              <div class="flex flex-wrap gap-2">
                {#each persona.preferred_channels as ch}
                  <span class="px-2.5 py-1 bg-primary-50 text-primary-700 text-xs rounded-full">{ch}</span>
                {/each}
              </div>
            </div>
          {/if}

          {#if persona.best_offer}
            <div class="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
              <div class="text-xs font-semibold text-green-700 mb-1">🎯 ข้อเสนอที่ตรงใจ</div>
              <div class="text-sm text-dark-900">{persona.best_offer}</div>
            </div>
          {/if}
        </div>
      {/each}
    {/if}

    {#if output.insights && output.insights.length > 0}
      <div class="bg-gradient-to-br from-primary-50 to-white border border-primary-200 rounded-xl p-5">
        <div class="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">🔍 Insights จากข้อมูล</div>
        <ul class="text-sm space-y-1">
          {#each output.insights as ins}<li class="flex gap-2"><span class="text-primary-500">→</span>{ins}</li>{/each}
        </ul>
      </div>
    {/if}
  </div>

{:else if step === 3 && output}
  <!-- Step 3: Customer Journey -->
  <div class="space-y-3">
    {#if output.journey && output.journey.length > 0}
      {#each output.journey as stage, i}
        <div class="bg-white border border-dark-100 rounded-2xl p-5 relative">
          <div class="flex items-start gap-4">
            <div class="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold">
              {i + 1}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="font-semibold text-dark-900">{stage.stage_name_th || stage.stage}</h4>
                <span class="text-xs text-dark-900/50 uppercase tracking-wider">{stage.stage}</span>
              </div>

              {#if stage.emotions}
                <div class="mt-2 text-sm text-dark-900/80">
                  <span class="font-medium">อารมณ์:</span>
                  {stage.emotions.primary}
                  {#if stage.emotions.secondary} · {stage.emotions.secondary}{/if}
                  {#if stage.emotions.quote}
                    <div class="italic text-dark-900/60 mt-1">"{stage.emotions.quote}"</div>
                  {/if}
                </div>
              {/if}

              {#if stage.touchpoints && stage.touchpoints.length > 0}
                <div class="mt-3 flex flex-wrap gap-1.5">
                  {#each stage.touchpoints as t}
                    <span class="px-2 py-0.5 bg-dark-50 text-dark-900/70 text-xs rounded">{t}</span>
                  {/each}
                </div>
              {/if}

              {#if stage.key_message}
                <div class="mt-3 bg-primary-50 border-l-4 border-primary-500 p-3 text-sm">
                  <span class="font-semibold text-primary-700">ข้อความหลัก: </span>{stage.key_message}
                </div>
              {/if}

              {#if stage.content_types && stage.content_types.length > 0}
                <div class="mt-2 text-xs text-dark-900/60">
                  📝 Content: {stage.content_types.join(' · ')}
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    {/if}

    {#if output.pain_points && output.pain_points.length > 0}
      <div class="bg-red-50 border border-red-200 rounded-xl p-5 mt-4">
        <div class="text-xs font-semibold text-red-700 uppercase tracking-wider mb-3">⚠️ จุดเจ็บที่ต้องระวัง</div>
        {#each output.pain_points as pp}
          <div class="mb-3 last:mb-0">
            <div class="text-xs font-semibold text-dark-900/70 uppercase">{pp.stage}</div>
            <div class="text-sm text-dark-900 mb-1"><span class="text-red-600">ปัญหา:</span> {pp.pain}</div>
            <div class="text-sm text-dark-900"><span class="text-green-600">วิธีแก้:</span> {pp.solution}</div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

{:else if step === 4 && output}
  <!-- Step 4: Positioning -->
  <div class="space-y-4">
    <div class="bg-gradient-to-br from-primary-500 to-primary-700 text-white rounded-2xl p-6">
      <div class="text-xs font-semibold uppercase tracking-wider mb-2 opacity-80">Positioning Statement</div>
      <div class="text-lg font-semibold leading-snug">{output.positioning_statement || '—'}</div>
    </div>

    <div class="bg-white border-2 border-primary-500 rounded-2xl p-5">
      <div class="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">One-Liner</div>
      <div class="text-base font-semibold text-dark-900">{output.positioning_one_liner || '—'}</div>
    </div>

    {#if output.uvp_bullets && output.uvp_bullets.length > 0}
      <div class="bg-white border border-dark-100 rounded-xl p-5">
        <div class="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-3">Value Bullets</div>
        <ul class="space-y-2">
          {#each output.uvp_bullets as bullet}
            <li class="flex gap-3 text-sm"><span class="text-primary-500 font-bold">✓</span>{bullet}</li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if output.tagline_options && output.tagline_options.length > 0}
      <div class="bg-white border border-dark-100 rounded-xl p-5">
        <div class="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-3">Tagline Options</div>
        <div class="space-y-2">
          {#each output.tagline_options as tag, i}
            <div class="flex items-center gap-3 p-3 bg-dark-50 rounded-lg">
              <span class="text-xs font-bold text-primary-500 w-6">#{i+1}</span>
              <span class="text-sm font-medium italic text-dark-900">"{tag}"</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if output.competitive_frame}
      <div class="bg-white border border-dark-100 rounded-xl p-5">
        <div class="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-3">vs คู่แข่ง</div>
        <div class="space-y-2">
          {#each Object.entries(output.competitive_frame) as [k, v]}
            {@const m = (k.match(/vs_competitor[_]?(\d+)/i) || k.match(/competitor[_]?(\d+)/i))}
            {@const label = m ? `คู่แข่งที่ ${m[1]}` : k}
            <div class="text-sm"><span class="font-semibold text-primary-700">{label}:</span> {v}</div>
          {/each}
        </div>
      </div>
    {/if}

    {#if output.elevator_pitch}
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <div class="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">⏱️ 30-Second Elevator Pitch</div>
        <div class="text-sm text-dark-900 leading-relaxed">{output.elevator_pitch}</div>
      </div>
    {/if}
  </div>

{:else if step === 5 && output}
  <!-- Step 5: Content Calendar -->
  <div>
    {#if output.calendar && output.calendar.length > 0}
      <div class="text-xs text-dark-900/60 mb-3">
        📅 {output.calendar.length} posts · {output.calendar.filter(p => p.pillar === 'awareness').length} awareness · {output.calendar.filter(p => p.pillar === 'education').length} education · {output.calendar.filter(p => p.pillar === 'social_proof').length} social proof · {output.calendar.filter(p => p.pillar === 'conversion').length} conversion
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {#each output.calendar as post}
          <div class="bg-white border border-dark-100 rounded-xl p-4 hover:shadow-md transition">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-primary-600">Day {post.day}</span>
              <span class="text-xs px-2 py-0.5 rounded-full {post.pillar === 'awareness' ? 'bg-blue-50 text-blue-700' : post.pillar === 'education' ? 'bg-purple-50 text-purple-700' : post.pillar === 'social_proof' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}">
                {post.pillar}
              </span>
            </div>
            <div class="text-xs text-dark-900/60 mb-2 uppercase tracking-wider">
              {post.platform} · {post.format}
            </div>
            <div class="font-semibold text-sm text-dark-900 mb-2 leading-snug">
              "{post.hook}"
            </div>
            <div class="text-xs text-dark-900/80 leading-relaxed mb-3 whitespace-pre-line">
              {post.caption}
            </div>
            <div class="text-xs font-semibold text-primary-600 mb-2">
              {post.cta}
            </div>
            {#if post.hashtags && post.hashtags.length > 0}
              <div class="flex flex-wrap gap-1 mb-2">
                {#each post.hashtags as h}
                  <span class="text-xs text-dark-900/60">{h}</span>
                {/each}
              </div>
            {/if}
            {#if post.visual_suggestion}
              <div class="text-xs text-dark-900/60 italic pt-2 border-t border-dark-100">
                🎨 {post.visual_suggestion}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>

{:else if step === 6 && output}
  <!-- Step 6: Marketing Workflow -->
  <div class="space-y-4">
    {#if output.workflows && output.workflows.length > 0}
      {#each output.workflows as wf}
        <div class="bg-white border border-dark-100 rounded-2xl p-5">
          <div class="flex items-start justify-between mb-3">
            <div>
              <h4 class="font-semibold text-dark-900">{wf.name}</h4>
              <div class="text-xs text-dark-900/60 mt-0.5">ID: {wf.id} · {wf.type}</div>
            </div>
            <div class="text-right">
              <div class="text-2xl font-bold text-green-600">-{wf.time_saved_pct}%</div>
              <div class="text-xs text-dark-900/60">เวลา</div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 mb-4 text-sm">
            <div class="bg-red-50 rounded-lg p-2 text-center">
              <div class="text-xs text-dark-900/60">ก่อนใช้ ระบบอัจฉริยะ</div>
              <div class="font-semibold text-red-700">{wf.time_before}</div>
            </div>
            <div class="bg-green-50 rounded-lg p-2 text-center">
              <div class="text-xs text-dark-900/60">หลังใช้ ระบบอัจฉริยะ</div>
              <div class="font-semibold text-green-700">{wf.time_after}</div>
            </div>
          </div>

          {#if wf.steps && wf.steps.length > 0}
            <div class="space-y-2 mb-3">
              <div class="text-xs font-semibold text-primary-600 uppercase tracking-wider">ขั้นตอน</div>
              {#each wf.steps as step}
                <div class="flex gap-3 text-sm">
                  <span class="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{step.step}</span>
                  <div class="flex-1">
                    <div class="font-medium text-dark-900">{step.action}</div>
                    <div class="text-xs text-dark-900/60">⏱ {step.duration} · 📦 {step.output}</div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          {#if wf.tools_used && wf.tools_used.length > 0}
            <div class="text-xs text-dark-900/70 mb-2">
              🛠 <span class="font-semibold">เครื่องมือ:</span> {wf.tools_used.join(', ')} (~{wf.tools_cost_monthly} บาท/เดือน)
            </div>
          {/if}
          <div class="text-xs text-dark-900/70">
            📊 <span class="font-semibold">KPI:</span> {wf.kpi} · <span class="font-semibold">ความถี่:</span> {wf.frequency}
          </div>

          {#if wf.pitfalls && wf.pitfalls.length > 0}
            <details class="mt-3">
              <summary class="text-xs font-semibold text-amber-700 cursor-pointer">⚠️ ข้อควรระวัง</summary>
              <ul class="mt-2 text-xs space-y-1">
                {#each wf.pitfalls as p}<li class="text-dark-900/80">• {p}</li>{/each}
              </ul>
            </details>
          {/if}
        </div>
      {/each}
    {/if}

    {#if output.voice_guide}
      <div class="bg-gradient-to-br from-primary-50 to-white border border-primary-200 rounded-2xl p-5">
        <div class="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-3">🎙️ Voice Guide</div>
        <div class="text-sm font-semibold text-dark-900 mb-2">{output.voice_guide.tone}</div>
        <div class="grid md:grid-cols-2 gap-3 text-sm">
          <div>
            <div class="text-xs font-semibold text-green-700 mb-1">✅ ควรทำ</div>
            <ul class="space-y-1">{#each output.voice_guide.do as d}<li>• {d}</li>{/each}</ul>
          </div>
          <div>
            <div class="text-xs font-semibold text-red-700 mb-1">❌ ไม่ควรทำ</div>
            <ul class="space-y-1">{#each output.voice_guide.dont as d}<li>• {d}</li>{/each}</ul>
          </div>
        </div>
        {#if output.voice_guide.sample_phrases && output.voice_guide.sample_phrases.length > 0}
          <div class="mt-3 pt-3 border-t border-primary-200">
            <div class="text-xs font-semibold text-dark-900/70 mb-2">ตัวอย่างประโยค</div>
            <div class="space-y-1">
              {#each output.voice_guide.sample_phrases as p}
                <div class="text-sm italic text-dark-900">"{p}"</div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

{:else if step === 7 && output}
  <!-- Step 7: KPI Dashboard -->
  <div class="space-y-4">
    {#if output.kpis && output.kpis.length > 0}
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {#each output.kpis as kpi}
          <div class="bg-white border border-dark-100 rounded-xl p-5">
            <div class="text-xs text-dark-900/60 mb-1">{kpi.id}</div>
            <div class="font-semibold text-dark-900 mb-3">{kpi.name}</div>
            <div class="flex items-end gap-3 mb-3">
              <div>
                <div class="text-2xl font-bold text-dark-900/40">{kpi.current}</div>
                <div class="text-xs text-dark-900/60">ปัจจุบัน</div>
              </div>
              <svg class="w-6 h-6 text-dark-900/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
              <div>
                <div class="text-2xl font-bold text-green-600">{kpi.target_30d}</div>
                <div class="text-xs text-dark-900/60">30 วัน</div>
              </div>
              <div>
                <div class="text-2xl font-bold text-primary-600">{kpi.target_90d}</div>
                <div class="text-xs text-dark-900/60">90 วัน</div>
              </div>
            </div>
            <div class="text-xs text-dark-900/70 space-y-1">
              <div><span class="text-dark-900/50">หน่วย:</span> {kpi.unit}</div>
              <div><span class="text-dark-900/50">เครื่องมือ:</span> {kpi.tool}</div>
              <div><span class="text-dark-900/50">ความถี่:</span> {kpi.frequency}</div>
              <div><span class="text-dark-900/50">คนดูแล:</span> {kpi.owner}</div>
            </div>
            {#if kpi.action_if_below}
              <div class="mt-2 pt-2 border-t border-dark-100 text-xs text-amber-700">
                ⚠️ ถ้าต่ำกว่าเป้า: {kpi.action_if_below}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if output.action_plan_30d}
      <div class="bg-white border border-dark-100 rounded-2xl p-5">
        <div class="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-3">📅 Action Plan 30 วัน</div>
        <div class="space-y-3">
          {#each Object.entries(output.action_plan_30d) as [week, plan]}
            <div class="bg-dark-50 rounded-lg p-4">
              <div class="text-xs font-bold text-primary-600 uppercase tracking-wider mb-1">{week}</div>
              <div class="font-semibold text-dark-900 mb-2">{plan.theme}</div>
              {#if plan.tasks}
                <ul class="text-sm space-y-1">
                  {#each plan.tasks as task}<li class="flex gap-2"><span class="text-primary-500">•</span>{task}</li>{/each}
                </ul>
              {/if}
              {#if plan.outcome}
                <div class="text-xs text-dark-900/60 mt-2">🎯 {plan.outcome}</div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if output.review_ritual}
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <div class="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-3">🔁 Review Ritual</div>
        <div class="space-y-2 text-sm">
          {#if output.review_ritual.daily}<div><span class="font-semibold">ทุกวัน:</span> {output.review_ritual.daily}</div>{/if}
          {#if output.review_ritual.weekly}<div><span class="font-semibold">ทุกสัปดาห์:</span> {output.review_ritual.weekly}</div>{/if}
          {#if output.review_ritual.monthly}<div><span class="font-semibold">ทุกเดือน:</span> {output.review_ritual.monthly}</div>{/if}
        </div>
      </div>
    {/if}
  </div>

{:else if output}
  <!-- Fallback for unknown step or missing output — pretty JSON -->
  <div class="bg-dark-50 rounded-lg p-4 text-sm text-dark-900/70">
    Output ยังไม่อยู่ในรูปแบบที่กำหนด — ลอง regenerate
  </div>
  <pre class="mt-3 bg-dark-50 border border-dark-100 rounded-lg p-4 text-xs overflow-auto max-h-96 text-dark-900/80 font-mono">{JSON.stringify(output, null, 2)}</pre>
{/if}
