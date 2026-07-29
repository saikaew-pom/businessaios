<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';

  // Demo walkthrough — full flow Pain → Offer (auto-advance + manual)
  const STEPS = [
    {
      tool: '🎯 Pain Point Generator',
      tagline: 'ค้นหาความเจ็บปวดจริง ๆ ของลูกค้า',
      color: '#3b82f6',
      bg: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
      duration: 6,
      content: {
        type: 'pain',
        title: 'ขนมบ้านโกไข่ · Pain Point Canvas',
        summary: 'Pain Point 5 อันดับแรกของคนไทยในกรุงเทพที่คิดถึงขนมใต้',
        items: [
          { rank: 1, pain: 'หาขนมใต้ของจริงยากมากในกรุงเทพ', severity: 9, tags: ['Availability', 'Nostalgia'] },
          { rank: 2, pain: 'กลัวขนมไม่สด / เสียระหว่างขนส่ง', severity: 8, tags: ['Quality', 'Logistics'] },
          { rank: 3, pain: 'ราคาแพงกว่าขนมกรุงเทพทั่วไป 2-3 เท่า', severity: 7, tags: ['Price'] },
          { rank: 4, pain: 'ไม่รู้ว่ายี่ห้อไหนของจริง vs ของปลอม', severity: 6, tags: ['Trust'] },
          { rank: 5, pain: 'ต้องรอกลับบ้านถึงจะได้กิน', severity: 5, tags: ['Time'] },
        ]
      }
    },
    {
      tool: '👥 Persona Builder',
      tagline: 'สร้างลูกค้าในอุดมคติที่ชัดเจน',
      color: '#10b981',
      bg: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
      duration: 6,
      content: {
        type: 'persona',
        title: 'ขนมบ้านโกไข่ · Persona #1',
        name: 'น้ำตาไหล — คนใต้ที่อยู่กรุงเทพ',
        summary: 'พนักงานออฟฟิศอายุ 28 ปี ย้ายจากหาดใหญ่มาทำงานในกรุงเทพ 3 ปี รายได้ 45,000 บาท',
        facts: [
          { label: '🎂 อายุ', value: '28' },
          { label: '💼 อาชีพ', value: 'Product Manager' },
          { label: '💰 รายได้', value: '45,000 บาท' },
          { label: '📍 อยู่', value: 'อโศก กรุงเทพ' },
          { label: '🎯 เป้าหมาย', value: 'กินของดี ๆ จากบ้าน แม้อยู่ไกล' },
          { label: '😰 Pain', value: 'คิดถึงบ้าน + หาของใต้ของจริงยาก' },
        ]
      }
    },
    {
      tool: '🎯 JTBD Generator',
      tagline: 'เข้าใจงานที่ลูกค้าจ้างผลิตภัณฑ์มาทำ',
      color: '#f97316',
      bg: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)',
      duration: 7,
      content: {
        type: 'jtbd',
        title: 'JTBD — Job-to-be-Done',
        coreQuestion: 'เมื่อคิดถึงบ้าน คนไทยในกรุงเทพ "จ้าง" ขนมใต้มาทำอะไร?',
        primaryJob: 'ช่วยให้รู้สึกเหมือนกลับบ้าน + ลดความคิดถึงบ้าน — ผ่านการกินขนมที่มีรสชาติ authentic + ritual เหมือนตอนอยู่บ้าน',
        forces: [
          { name: 'Push (ความเจ็บปวด)', score: 8, desc: 'คิดถึงบ้าน + เบื่อขนมกรุงเทพ' },
          { name: 'Pull (ดึงดูด)', score: 7, desc: 'อยากกินของดี ๆ + รู้สึกพรีเมียม' },
          { name: 'Anxiety (ความกังวล)', score: 5, desc: 'กลัวไม่สด + กลัวแพง' },
          { name: 'Habit (นิสัยเดิม)', score: 6, desc: 'ซื้อขนมใน 7-11 ตามสะดวก' },
        ]
      }
    },
    {
      tool: '💎 Value Proposition Canvas',
      tagline: 'จับคู่ Value กับ Customer jobs/pains',
      color: '#8b5cf6',
      bg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
      duration: 7,
      content: {
        type: 'vpc',
        title: 'VPC — Fit Analysis',
        fitScore: 8,
        fitLabel: 'Strong Fit',
        customerProfile: ['ต้องการขนมใต้ของจริง', 'กลัวขนมไม่สด', 'อยากได้ premium experience'],
        valueMap: ['สูตรโบราณ 50+ ปี', 'ส่งฟรีใน 24 ชม.', 'กล่อง premium'],
        statement: 'สำหรับ คนไทยในกรุงเทพที่คิดถึงบ้าน ขนมบ้านโกไข่ เป็น กล่องขนมใต้สูตรโบราณส่งด่วน 24 ชม. ที่ต่างจากขนมกรุงเทพทั่วไป เพราะ ส่งถึงมือสดใหม่ + รสชาติ authentic เหมือนกลับบ้าน',
      }
    },
    {
      tool: '📊 Business Model Canvas',
      tagline: 'ออกแบบ Business Model 9 building blocks',
      color: '#6366f1',
      bg: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
      duration: 7,
      content: {
        type: 'bmc',
        title: 'BMC — Strategyzer',
        pattern: 'Multi-channel Retail (Omni-channel) + Partnership Distribution',
        insight: 'ใช้ปั๊ม ปตท. เป็น distribution channel หลัก + ขยายเข้าห้าง + สนามบิน → ลด customer acquisition cost เหลือเกือบ 0',
        blocks: [
          { name: 'Customer Segments', color: '#3b82f6', count: 4 },
          { name: 'Value Propositions', color: '#8b5cf6', count: 3 },
          { name: 'Channels', color: '#14b8a6', count: 7 },
          { name: 'Customer Relationships', color: '#06b6d4', count: 4 },
          { name: 'Revenue Streams', color: '#10b981', count: 5 },
          { name: 'Key Resources', color: '#f59e0b', count: 5 },
          { name: 'Key Activities', color: '#f97316', count: 5 },
          { name: 'Key Partnerships', color: '#ec4899', count: 5 },
          { name: 'Cost Structure', color: '#ef4444', count: 'value-driven' },
        ]
      }
    },
    {
      tool: '💎 Million Dollar Offer',
      tagline: 'สร้างข้อเสนอที่ปฏิเสธไม่ได้',
      color: '#f59e0b',
      bg: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
      duration: 8,
      content: {
        type: 'offer',
        title: '🏆 Offer Name (MAGIC Formula)',
        offerName: 'กล่องคิดถึงบ้าน ขนมใต้โบราณส่งด่วน 24 ชม. สำหรับคนใต้ในกรุงเทพ',
        magic: [
          { letter: 'M', word: 'Magnet', value: 'กล่องคิดถึงบ้าน' },
          { letter: 'A', word: 'Avatar', value: 'คนใต้' },
          { letter: 'G', word: 'Goal', value: 'ขนมใต้โบราณ' },
          { letter: 'I', word: 'Interval', value: 'ส่งด่วน 24 ชม.' },
          { letter: 'C', word: 'Container', value: 'กล่องสำหรับคนใต้ในกรุงเทพ' },
        ],
        valueEq: { dreamOutcome: 5, perceivedLikelihood: 6, timeDelay: 3, effortSacrifice: 5, binding: 'time_delay' },
        price: { value: '฿499', ratio: '3.5:1', anchor: '฿1,750' },
        guarantee: 'สดใหม่หรือเปลี่ยนกล่องฟรีทันที',
        valueStack: [
          'เค้กสามเหลี่ยมมะพร้าวอ่อน (฿180)',
          'เปี๊ยะกุหลาบสูตรโบราณ (฿220)',
          'ค่าส่งด่วนในกรุงเทพ (฿100)',
          'กล่อง premium ของขวัญ (฿250)',
          'คู่มือ "รสชาติหาดใหญ่" (฿100)',
        ],
      }
    },
  ];

  let currentStep = $state(0);
  let isPlaying = $state(false);
  let progress = $state(0);
  let progressTimer: any = null;

  const step = $derived(STEPS[currentStep]);

  onMount(() => {
    // Auto-start
    setTimeout(() => { isPlaying = true; startProgress(); }, 1000);
  });

  onDestroy(() => {
    if (progressTimer) clearInterval(progressTimer);
  });

  function startProgress() {
    if (progressTimer) clearInterval(progressTimer);
    progress = 0;
    progressTimer = setInterval(() => {
      progress += 100 / (step.duration * 10);
      if (progress >= 100) {
        progress = 100;
        next();
      }
    }, 100);
  }

  function next() {
    if (progressTimer) clearInterval(progressTimer);
    if (currentStep < STEPS.length - 1) {
      currentStep++;
      progress = 0;
      if (isPlaying) startProgress();
    } else {
      isPlaying = false;
    }
  }

  function prev() {
    if (progressTimer) clearInterval(progressTimer);
    if (currentStep > 0) {
      currentStep--;
      progress = 0;
      if (isPlaying) startProgress();
    }
  }

  function togglePlay() {
    isPlaying = !isPlaying;
    if (isPlaying) {
      startProgress();
    } else {
      if (progressTimer) clearInterval(progressTimer);
    }
  }

  function goTo(idx: number) {
    currentStep = idx;
    progress = 0;
    if (isPlaying) startProgress();
  }
</script>

<svelte:head>
  <title>BusinessAiOs Demo — Full Flow Pain → Offer</title>
  <meta name="description" content="Self-running demo walkthrough ของ BusinessAiOs full chain Pain Point → Million Dollar Offer" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
  <!-- Top bar -->
  <div class="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/10">
    <div class="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
      <a href="/" class="flex items-center gap-2 hover:opacity-80">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">M</div>
        <span class="font-bold">BusinessAiOs</span>
        <span class="text-xs text-white/50 hidden sm:inline">Demo Walkthrough</span>
      </a>
      <div class="flex items-center gap-3">
        <a href="/tools" class="text-xs text-white/70 hover:text-white font-semibold hidden sm:inline">⚡ ลองใช้เครื่องมือ</a>
        <a href="/register" class="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:opacity-90">+ สมัครฟรี</a>
      </div>
    </div>
  </div>

  <!-- Progress bar -->
  <div class="fixed top-[57px] left-0 right-0 z-40 bg-slate-900/60 backdrop-blur-sm">
    <div class="h-1 bg-white/10">
      <div class="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-amber-500 transition-all" style="width: {((currentStep + progress / 100) / STEPS.length) * 100}%;"></div>
    </div>
  </div>

  <!-- Main canvas -->
  <div class="pt-24 pb-32 px-6">
    <div class="max-w-5xl mx-auto">
      <!-- Tool header -->
      <div class="text-center mb-8">
        <div class="inline-block px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-semibold mb-3">
          Step {currentStep + 1} of {STEPS.length} · {isPlaying ? '▶ Playing' : '⏸ Paused'}
        </div>
        <h1 class="text-4xl sm:text-5xl font-black mb-2 drop-shadow-lg">{step.tool}</h1>
        <p class="text-lg text-white/80">{step.tagline}</p>
      </div>

      <!-- Content card -->
      <div
        class="rounded-3xl p-6 sm:p-10 shadow-2xl mb-8"
        style="background: {step.bg}; min-height: 480px;"
      >
        <div class="bg-white/95 text-dark-900 rounded-2xl p-6 sm:p-8">
          <h2 class="text-2xl font-bold mb-4">{step.content.title}</h2>

          {#if step.content.type === 'pain'}
            <p class="text-sm text-dark-700 mb-4 italic">{step.content.summary}</p>
            <div class="space-y-3">
              {#each step.content.items as p}
                <div class="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                  <div class="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center font-bold flex-shrink-0">#{p.rank}</div>
                  <div class="flex-1">
                    <div class="font-semibold text-red-900">{p.pain}</div>
                    <div class="flex gap-1 mt-1">
                      {#each p.tags as t}
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-red-200 text-red-800 font-semibold">{t}</span>
                      {/each}
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-2xl font-black text-red-600">{p.severity}</div>
                    <div class="text-[10px] text-red-700 font-semibold">/ 10</div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          {#if step.content.type === 'persona'}
            <p class="text-sm text-dark-700 mb-4 italic">{step.content.summary}</p>
            <div class="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 mb-4">
              <div class="text-lg font-bold text-emerald-900">👤 {step.content.name}</div>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {#each step.content.facts as f}
                <div class="bg-white border border-emerald-200 rounded-lg p-3">
                  <div class="text-[10px] text-emerald-700 font-semibold uppercase">{f.label}</div>
                  <div class="text-sm font-bold text-dark-900 mt-1">{f.value}</div>
                </div>
              {/each}
            </div>
          {/if}

          {#if step.content.type === 'jtbd'}
            <div class="bg-orange-50 border-2 border-orange-300 rounded-xl p-4 mb-4">
              <div class="text-xs text-orange-700 font-bold uppercase mb-1">❓ Core Question</div>
              <div class="text-sm font-semibold text-orange-900 italic">"{step.content.coreQuestion}"</div>
            </div>
            <div class="bg-orange-100 border-l-4 border-orange-500 p-3 rounded mb-4">
              <div class="text-xs text-orange-700 font-bold uppercase mb-1">🎯 Primary Job</div>
              <div class="text-sm text-orange-900">{step.content.primaryJob}</div>
            </div>
            <div class="text-xs font-bold text-dark-700 uppercase mb-2">⚖️ Forces of Progress</div>
            <div class="grid grid-cols-2 gap-2">
              {#each step.content.forces as f}
                <div class="bg-white border border-orange-200 rounded-lg p-2.5">
                  <div class="flex items-center justify-between">
                    <div class="text-xs font-semibold text-dark-800">{f.name}</div>
                    <div class="text-base font-black text-orange-600">{f.score}/10</div>
                  </div>
                  <div class="text-[10px] text-dark-600 mt-0.5">{f.desc}</div>
                </div>
              {/each}
            </div>
          {/if}

          {#if step.content.type === 'vpc'}
            <div class="flex items-center gap-3 mb-4">
              <div class="flex-1 bg-purple-50 border-2 border-purple-300 rounded-xl p-4">
                <div class="text-xs text-purple-700 font-bold uppercase mb-1">👥 Customer Profile</div>
                <ul class="text-xs text-purple-900 space-y-1">
                  {#each step.content.customerProfile as cp}
                    <li>• {cp}</li>
                  {/each}
                </ul>
              </div>
              <div class="text-3xl font-black text-purple-600">{step.content.fitScore}</div>
              <div class="text-center">
                <div class="text-xs text-purple-700 font-bold">FIT SCORE</div>
                <div class="text-xs px-2 py-0.5 rounded-full bg-green-500 text-white font-bold">{step.content.fitLabel}</div>
              </div>
              <div class="flex-1 bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
                <div class="text-xs text-amber-700 font-bold uppercase mb-1">💎 Value Map</div>
                <ul class="text-xs text-amber-900 space-y-1">
                  {#each step.content.valueMap as vm}
                    <li>• {vm}</li>
                  {/each}
                </ul>
              </div>
            </div>
            <div class="bg-gradient-to-r from-purple-100 to-amber-100 border-2 border-purple-300 rounded-xl p-4">
              <div class="text-xs text-purple-800 font-bold uppercase mb-1">📜 Value Proposition Statement</div>
              <div class="text-sm text-dark-900 italic leading-relaxed">"{step.content.statement}"</div>
            </div>
          {/if}

          {#if step.content.type === 'bmc'}
            <div class="bg-indigo-50 border-2 border-indigo-300 rounded-xl p-3 mb-3">
              <div class="text-xs text-indigo-700 font-bold uppercase">🏷️ Business Model Pattern</div>
              <div class="text-sm font-semibold text-indigo-900">{step.content.pattern}</div>
            </div>
            <div class="bg-amber-50 border-l-4 border-amber-500 p-3 rounded mb-4">
              <div class="text-xs text-amber-700 font-bold uppercase">💡 Key Insight</div>
              <div class="text-xs text-amber-900">{step.content.insight}</div>
            </div>
            <div class="text-xs font-bold text-dark-700 uppercase mb-2">🧩 9 Building Blocks</div>
            <div class="grid grid-cols-3 gap-1.5">
              {#each step.content.blocks as b}
                <div class="rounded-lg p-2 text-center" style="background: {b.color}20; border: 1.5px solid {b.color};">
                  <div class="text-[9px] font-bold" style="color: {b.color};">{b.name}</div>
                  <div class="text-base font-black mt-0.5" style="color: {b.color};">{b.count}</div>
                </div>
              {/each}
            </div>
          {/if}

          {#if step.content.type === 'offer'}
            <div class="bg-gradient-to-r from-amber-100 to-yellow-100 border-2 border-amber-400 rounded-xl p-4 mb-4">
              <div class="text-xs text-amber-700 font-bold uppercase mb-1">🏆 Offer Name</div>
              <div class="text-base font-black text-amber-900">"{step.content.offerName}"</div>
            </div>
            <div class="text-xs font-bold text-dark-700 uppercase mb-2">✨ MAGIC Formula</div>
            <div class="grid grid-cols-5 gap-1.5 mb-4">
              {#each step.content.magic as m}
                <div class="bg-amber-50 border-2 border-amber-300 rounded-lg p-2 text-center">
                  <div class="text-xl font-black text-amber-600">{m.letter}</div>
                  <div class="text-[9px] text-amber-700 font-bold uppercase">{m.word}</div>
                  <div class="text-[10px] text-dark-800 mt-1 leading-tight">{m.value}</div>
                </div>
              {/each}
            </div>
            <div class="text-xs font-bold text-dark-700 uppercase mb-2">⚖️ Value Equation Audit</div>
            <div class="grid grid-cols-4 gap-2 mb-4">
              <div class="bg-green-50 border-2 border-green-300 rounded-lg p-2 text-center">
                <div class="text-[10px] text-green-700">Dream Outcome</div>
                <div class="text-xl font-black text-green-600">{step.content.valueEq.dreamOutcome}/10</div>
              </div>
              <div class="bg-green-50 border-2 border-green-300 rounded-lg p-2 text-center">
                <div class="text-[10px] text-green-700">Likelihood</div>
                <div class="text-xl font-black text-green-600">{step.content.valueEq.perceivedLikelihood}/10</div>
              </div>
              <div class="bg-red-50 border-2 border-red-300 rounded-lg p-2 text-center">
                <div class="text-[10px] text-red-700">Time Delay</div>
                <div class="text-xl font-black text-red-600">{step.content.valueEq.timeDelay}/10</div>
              </div>
              <div class="bg-red-50 border-2 border-red-300 rounded-lg p-2 text-center">
                <div class="text-[10px] text-red-700">Effort</div>
                <div class="text-xl font-black text-red-600">{step.content.valueEq.effortSacrifice}/10</div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-3">
                <div class="text-xs text-emerald-700 font-bold uppercase mb-1">💰 Price</div>
                <div class="text-2xl font-black text-emerald-900">{step.content.price.value}</div>
                <div class="text-[10px] text-emerald-700 mt-1">Ratio: {step.content.price.ratio} · Anchor: {step.content.price.anchor}</div>
              </div>
              <div class="bg-blue-50 border-2 border-blue-300 rounded-xl p-3">
                <div class="text-xs text-blue-700 font-bold uppercase mb-1">🛡️ Guarantee</div>
                <div class="text-sm font-semibold text-blue-900">"{step.content.guarantee}"</div>
              </div>
            </div>
            <div class="mt-3 bg-amber-50 border-2 border-amber-300 rounded-xl p-3">
              <div class="text-xs text-amber-700 font-bold uppercase mb-1">📚 Value Stack</div>
              <ul class="text-xs text-amber-900 space-y-0.5">
                {#each step.content.valueStack as v, i}
                  <li>{i + 1}. {v}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      </div>

      <!-- Step dots -->
      <div class="flex items-center justify-center gap-2 mb-6">
        {#each STEPS as _, i}
          <button
            onclick={() => goTo(i)}
            class="w-3 h-3 rounded-full transition-all {i === currentStep ? 'bg-white scale-125' : i < currentStep ? 'bg-white/60' : 'bg-white/20'}"
            aria-label="Go to step {i + 1}"
          ></button>
        {/each}
      </div>

      <!-- Controls -->
      <div class="flex items-center justify-center gap-4">
        <button
          onclick={prev}
          disabled={currentStep === 0}
          class="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 border border-white/20 text-xl transition"
          aria-label="Previous"
        >←</button>

        <button
          onclick={togglePlay}
          class="w-16 h-16 rounded-full bg-white text-slate-900 hover:scale-105 transition shadow-2xl flex items-center justify-center text-2xl font-bold"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <button
          onclick={next}
          disabled={currentStep === STEPS.length - 1}
          class="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 border border-white/20 text-xl transition"
          aria-label="Next"
        >→</button>
      </div>

      <!-- CTA at end -->
      {#if currentStep === STEPS.length - 1}
        <div class="text-center mt-8">
          <a
            href="/register"
            class="inline-block px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold text-lg shadow-2xl hover:scale-105 transition"
          >
            🚀 เริ่มใช้ BusinessAiOs ฟรี — 100 credits
          </a>
        </div>
      {/if}
    </div>
  </div>

  <!-- Floating controls (skip) -->
  <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
    <button
      onclick={() => goto('/tools')}
      class="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-xs font-semibold"
    >
      ⚡ ลองเอง
    </button>
  </div>
</div>
