<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { locale, toggleLocale } from '$lib/stores';
  import { t } from '$lib/i18n';
  import { isAuthed } from '$lib/auth';

  onMount(async () => {
    const { initAuth } = await import('$lib/auth');
    await initAuth();
    if (!$isAuthed) goto('/login');
  });

  const tools = [
    {
      icon: '🎤',
      title: 'Smart Presentation Builder',
      subtitle: 'สร้าง Presentation 9 steps — framework จาก McKinsey, Dan Roam, Phil Waknell',
      desc: 'Brief → Audience → ATR → Triage → Outline (SCQA/5M/Pop-Up) → Blueprint → Notes → Export (PPTX/Google Sheet)',
      href: '/tools/presentation-builder',
      color: 'purple',
      keywords: 'Presentation · Slide · PPTX · Story outline',
      isNew: true,
    },
    {
      icon: '💎',
      title: 'Million Dollar Offer',
      subtitle: 'ออกแบบ Offer ระดับพรีเมียม — Value Equation + 7 Components + MAGIC naming',
      desc: 'Dream Outcome + Value Stack + Trim & Stack + Pricing (5:1-10:1 ratio) + Guarantee + Scarcity/Urgency + Name',
      href: '/tools/million-dollar-offer',
      color: 'amber',
      keywords: 'Offer · Value Equation · Pricing · Guarantee · MAGIC',
      isNew: true,
    },
    {
      icon: '🛡️',
      title: 'Objection Handler',
      subtitle: 'จัดการข้อโต้แย้งลูกค้า — 7 Categories + LAER + Reframing',
      desc: '5-8 objections + response scripts + evidence + bridge to close + FAQ Top 5 + Do/Don\'t',
      href: '/tools/objection-handler',
      color: 'rose',
      keywords: 'Objection · Sales · LAER · Reframing · FAQ',
      isNew: true,
    },
    {
      icon: '🎣',
      title: 'Hook Library',
      subtitle: 'สร้าง Hook และ Headlines ดึงดูดความสนใจ — 10 Formulas + Platform-specific',
      desc: '30-50 hooks + 5 headlines A/B test + 6 platforms (FB/IG/YT/TikTok/Email/Landing) + A/B testing tips',
      href: '/tools/hook-library',
      color: 'teal',
      keywords: 'Hook · Headline · A/B Test · Facebook · Instagram · TikTok',
      isNew: true,
    },
    {
      icon: '📊',
      title: 'Business Model Canvas',
      subtitle: 'ออกแบบ Business Model ครบ 9 Building Blocks (Osterwalder)',
      desc: 'CS + VP + Channels + CR + Revenue + KR + KA + KP + Cost + SWOT + Key Assumptions → Business Model Pattern',
      href: '/tools/business-model-canvas',
      color: 'indigo',
      keywords: 'BMC · 9 blocks · Business Model · Desirability + Feasibility + Viability',
      isNew: true,
    },
    {
      icon: '🔍',
      title: 'Competitor Analysis',
      subtitle: 'วิเคราะห์คู่แข่ง + หา White Space — ใช้ Auto-find ได้',
      desc: 'รู้ว่าใครกำลังชนะลูกค้าไปจากเรา + โอกาสที่คู่แข่งทำไม่ดี + แผนรุก',
      href: '/tools/competitor-analysis',
      color: 'red',
      keywords: 'คู่แข่ง · White space · Market gap',
      isNew: true,
    },
    {
      icon: '🎯',
      title: 'Job-to-be-Done (JTBD)',
      subtitle: 'หา "Job" ที่ลูกค้าจ้างเราทำ — 4 Forces + Timeline + ODI Outcomes',
      desc: 'Christensen + Moesta + Ulwick: ใช้แล้วต่อยอด Value Proposition Canvas + Business Model Canvas',
      href: '/tools/jtbd-generator',
      color: 'orange',
      keywords: 'JTBD · Jobs Theory · Progress',
      isNew: true,
    },
    {
      icon: '💎',
      title: 'Value Proposition Canvas',
      subtitle: 'ออกแบบ Value Prop ที่ match กับลูกค้า — Problem-Solution Fit (Osterwalder)',
      desc: 'Customer Profile (Jobs/Pains/Gains) ↔ Value Map (Products/Pain Relievers/Gain Creators) → Fit Analysis',
      href: '/tools/value-proposition-canvas',
      color: 'purple',
      keywords: 'VPC · Value Prop · Product-Market Fit',
      isNew: true,
    },
    {
      icon: '🎯',
      title: 'Pain Point Generator',
      subtitle: 'หา Pain Point + Unmet Need ด้วย SPICE Framework',
      desc: 'วิเคราะห์ Pain Points เรียงตามความรุนแรง ความถี่ และโอกาสทางธุรกิจ',
      href: '/tools/pain-generator',
      color: 'blue',
      keywords: 'Pain · Unmet Need · Customer research',
    },
    {
      icon: '🎙️',
      title: 'Brand Voice Generator',
      subtitle: 'สร้าง Brand Voice & Tone ที่จำง่าย ใช้ได้จริง',
      desc: 'ได้ Voice dimensions, Do/Don\'t, vocabulary, ตัวอย่างประโยคจริง 5 บริบท',
      href: '/tools/brand-voice',
      color: 'purple',
      keywords: 'Voice · Tone · Brand personality',
    },
    {
      icon: '👥',
      title: 'Persona Builder (ธุรกิจใหม่)',
      subtitle: 'สร้าง Persona จากสมมติฐาน สำหรับธุรกิจที่ยังไม่มีรีวิว',
      desc: 'ระบบอัจฉริยะ สร้าง Persona จากข้อมูลอุตสาหกรรม + แนะนำวิธี validate ด้วยข้อมูลจริง',
      href: '/tools/persona-builder',
      color: 'green',
      keywords: 'Persona · Customer profile · New business',
    },
  ];
</script>

<div class="min-h-screen bg-dark-50">
  <header class="bg-white border-b border-dark-100 sticky top-0 z-10">
    <div class="container-narrow flex items-center justify-between h-16">
      <div class="flex items-center gap-3">
        <a href="/dashboard" class="text-dark-900/60 hover:text-dark-900">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </a>
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <span class="text-white font-bold text-sm">B</span>
          </div>
          <span class="font-bold">เครื่องมือ</span>
        </div>
      </div>
      <button onclick={toggleLocale} class="text-xs font-semibold px-2.5 py-1 rounded border border-dark-200 hover:bg-dark-50 transition">
        {$locale === 'th' ? 'EN' : 'TH'}
      </button>
    </div>
  </header>

  <main class="container-narrow py-8 max-w-5xl">
    <div class="mb-8 text-center">
      <div class="inline-block px-3 py-1 rounded-full bg-primary-50 border border-primary-200 text-xs font-semibold text-primary-700 mb-3">
        ⚡ เครื่องมือ ระบบอัจฉริยะ แยกต่างหาก
      </div>
      <h1 class="text-3xl sm:text-4xl font-bold mb-2">เครื่องมือ ระบบอัจฉริยะ Marketing</h1>
      <p class="text-dark-900/70 max-w-2xl mx-auto">
        ใช้ได้โดยไม่ต้องสร้างโปรเจกต์ — เหมาะกับงานเฉพาะจุด เช่น หา Pain Point, สร้าง Brand Voice, สร้าง Persona
      </p>
    </div>

    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {#each tools as tool}
        <a href={tool.href} class="group block bg-white border border-dark-100 rounded-2xl p-6 hover:border-primary-300 hover:shadow-xl hover:-translate-y-1 transition-all relative">
          {#if tool.isNew}
            <span class="absolute top-3 right-3 px-2 py-0.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold rounded-full">NEW</span>
          {/if}
          <div class="text-5xl mb-3">{tool.icon}</div>
          <h3 class="text-lg font-bold mb-1 group-hover:text-primary-600 transition">{tool.title}</h3>
          <div class="text-sm font-medium text-primary-600 mb-2">{tool.subtitle}</div>
          <p class="text-sm text-dark-900/70 leading-relaxed mb-3">{tool.desc}</p>
          <div class="text-xs text-dark-900/50">{tool.keywords}</div>
          <div class="mt-4 text-sm text-primary-600 font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
            เปิดเครื่องมือ
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
          </div>
        </a>
      {/each}
    </div>

    <div class="mt-10 bg-gradient-to-br from-primary-50 to-white border border-primary-200 rounded-2xl p-6 text-center">
      <h2 class="text-xl font-bold mb-2">💡 ต้องการ Marketing System ครบทั้ง 7 ขั้น?</h2>
      <p class="text-sm text-dark-900/70 mb-4">สร้างโปรเจกต์ใหม่ใน Dashboard เพื่อใช้ Wizard 7 ขั้น (Brand Card, Persona, Journey, Positioning, Content Calendar, Workflow, KPI)</p>
      <a href="/dashboard" class="btn-primary inline-block">ไปที่ Dashboard</a>
    </div>
  </main>
</div>
