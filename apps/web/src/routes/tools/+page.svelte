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

  // Copy rewritten per docs/UX_REDESIGN_PLAN.md §2.4 — lead with "ช่วยคุณ___"
  // plain language; framework jargon (MAGIC, LAER, SCQA, Osterwalder, ...) moves
  // into `principle`, shown only behind a "ดูหลักการ" toggle, not the main copy.
  // `isNew` kept only on the tool that's genuinely newest (was on all 8 before).
  // `principle` holds the framework citation (SPICE/JTBD/LAER/etc) — kept out
  // of the main card copy per commitment 3, revealed only via "ดูหลักการ".
  let expandedPrinciples = $state(new Set<string>());
  function togglePrinciple(e: MouseEvent, href: string) {
    e.preventDefault();
    e.stopPropagation();
    const next = new Set(expandedPrinciples);
    if (next.has(href)) next.delete(href);
    else next.add(href);
    expandedPrinciples = next;
  }

  const categories = [
    {
      name: 'คิดกลยุทธ์',
      tools: [
        {
          icon: '🎯',
          title: 'หาปัญหาลูกค้า',
          subtitle: 'ช่วยคุณหาว่าลูกค้าเจอปัญหาอะไรที่ยังไม่มีใครแก้ให้ดีพอ',
          principle: 'SPICE Framework — จัดอันดับตามความรุนแรง ความถี่ และโอกาสทางธุรกิจ',
          href: '/tools/pain-generator',
          color: 'blue',
        },
        {
          icon: '👥',
          title: 'วาดภาพลูกค้าในฝัน',
          subtitle: 'ช่วยคุณจินตนาการลูกค้าในฝัน — เหมาะกับธุรกิจใหม่ที่ยังไม่มีลูกค้าจริง',
          principle: 'สร้างจากข้อมูลอุตสาหกรรม + แนะนำวิธี validate ด้วยข้อมูลจริงภายหลัง',
          href: '/tools/persona-builder',
          color: 'green',
        },
        {
          icon: '🔍',
          title: 'ส่องคู่แข่ง',
          subtitle: 'ช่วยคุณรู้ว่าคู่แข่งเก่งอะไร แล้วหาช่องว่างที่เราชนะได้',
          principle: 'วิเคราะห์จุดแข็ง/จุดอ่อนคู่แข่ง + หา White Space ที่ยังไม่มีใครทำดี',
          href: '/tools/competitor-analysis',
          color: 'red',
        },
        {
          icon: '💡',
          title: 'เข้าใจว่าลูกค้า "จ้าง" เราทำอะไร',
          subtitle: 'ช่วยคุณมองข้ามฟีเจอร์ ไปหาว่าลูกค้าอยากให้ "งาน" อะไรสำเร็จจริง ๆ',
          principle: 'Jobs-to-be-Done (Christensen/Moesta/Ulwick) — ต่อยอดเป็น Value Proposition ได้',
          href: '/tools/jtbd-generator',
          color: 'orange',
        },
        {
          icon: '🧩',
          title: 'เช็คว่าสินค้าตรงใจลูกค้าไหม',
          subtitle: 'ช่วยคุณเทียบสิ่งที่ลูกค้าต้องการ กับสิ่งที่สินค้าคุณให้ได้จริง',
          principle: 'Value Proposition Canvas (Osterwalder) — Customer Profile ↔ Value Map → Fit Analysis',
          href: '/tools/value-proposition-canvas',
          color: 'purple',
        },
        {
          icon: '📊',
          title: 'วางแผนธุรกิจทั้งระบบ',
          subtitle: 'ช่วยคุณมองภาพรวมธุรกิจทั้งหมดในหน้าเดียว ไม่ใช่แค่ไอเดียเดียว',
          principle: 'Business Model Canvas — ครบ 9 Building Blocks + SWOT + Key Assumptions',
          href: '/tools/business-model-canvas',
          color: 'indigo',
        },
      ],
    },
    {
      name: 'เขียนคอนเทนต์',
      tools: [
        {
          icon: '🎙️',
          title: 'หาโทนเสียงแบรนด์',
          subtitle: 'ช่วยคุณหาโทนการพูดของแบรนด์ที่จำง่าย ใช้ได้ทุกช่องทาง',
          principle: 'ได้ Voice dimensions, Do/Don\'t, คำศัพท์ที่ควรใช้/เลี่ยง, ตัวอย่างประโยคจริง 5 บริบท',
          href: '/tools/brand-voice',
          color: 'purple',
        },
        {
          icon: '🎣',
          title: 'หาประโยคเปิดที่คนหยุดอ่าน',
          subtitle: 'ช่วยคุณหาประโยคแรกที่ทำให้คนหยุดเลื่อนจอ',
          principle: '10 สูตร Hook + เหมาะกับ 6 แพลตฟอร์ม (FB/IG/YT/TikTok/Email/Landing) + เทคนิค A/B test',
          href: '/tools/hook-library',
          color: 'teal',
        },
        {
          icon: '🎤',
          title: 'ทำสไลด์นำเสนอ',
          subtitle: 'ช่วยคุณทำสไลด์นำเสนอเป็นเรื่องราวที่คนฟังไม่หลับ',
          principle: 'framework จาก McKinsey/Dan Roam/Phil Waknell — Brief → Audience → Outline → Export (PPTX)',
          href: '/tools/presentation-builder',
          color: 'purple',
          isNew: true,
        },
      ],
    },
    {
      name: 'ขาย',
      tools: [
        {
          icon: '💎',
          title: 'ออกแบบข้อเสนอที่ปฏิเสธยาก',
          subtitle: 'ช่วยคุณออกแบบข้อเสนอที่ลูกค้าปฏิเสธยาก',
          principle: 'Value Equation + 7 Components + ตั้งราคาด้วยอัตราส่วน 5:1-10:1 + การรับประกัน',
          href: '/tools/million-dollar-offer',
          color: 'amber',
        },
        {
          icon: '🛡️',
          title: 'เตรียมคำตอบลูกค้าลังเล',
          subtitle: 'ช่วยคุณเตรียมคำตอบเวลาลูกค้าต่อรอง/ลังเล',
          principle: '7 กลุ่มข้อโต้แย้ง + เทคนิค LAER + สคริปต์ตอบ + FAQ Top 5',
          href: '/tools/objection-handler',
          color: 'rose',
        },
      ],
    },
  ];
</script>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950">
  <main class="container-narrow py-8 max-w-5xl">
    <div class="flex items-center justify-between mb-4">
      <a href="/today" class="flex items-center gap-1 text-sm text-dark-900/60 dark:text-dark-100/60 hover:text-dark-900 dark:hover:text-dark-50">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        กลับวันนี้
      </a>
      <button onclick={toggleLocale} class="text-xs font-semibold px-2.5 py-1 rounded border border-dark-200 dark:border-dark-600 hover:bg-dark-50 dark:hover:bg-dark-700 transition">
        {$locale === 'th' ? 'EN' : 'TH'}
      </button>
    </div>
    <div class="mb-8 text-center">
      <div class="inline-block px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-900/40 border border-primary-200 dark:border-primary-800 text-xs font-semibold text-primary-700 dark:text-primary-300 mb-3">
        ⚡ เครื่องมือ ระบบอัจฉริยะ แยกต่างหาก
      </div>
      <h1 class="text-3xl sm:text-4xl font-bold mb-2">เครื่องมือ ระบบอัจฉริยะ Marketing</h1>
      <p class="text-dark-900/70 dark:text-dark-100/70 max-w-2xl mx-auto">
        ใช้ได้โดยไม่ต้องสร้างโปรเจกต์ — เหมาะกับงานเฉพาะจุด เช่น หาปัญหาลูกค้า สร้างโทนแบรนด์ วาดภาพลูกค้าในฝัน
      </p>
    </div>

    <a href="/studio" class="mb-10 block rounded-2xl border border-dark-100 bg-white p-5 transition hover:border-primary-300 hover:shadow-xl dark:border-dark-700 dark:bg-dark-800 group">
      <div class="flex flex-wrap items-center gap-4">
        <div class="text-5xl">🎨</div>
        <div class="min-w-0 flex-1">
          <div class="text-lg font-bold group-hover:text-primary-600 dark:group-hover:text-primary-400">Creative Studio</div>
          <div class="mt-1 text-sm text-dark-900/70 dark:text-dark-100/70">ต่อยอด insight จาก tools เป็นภาพแคมเปญ ใช้ reference image และจ่ายด้วย credits</div>
        </div>
        <div class="text-sm font-semibold text-primary-600 dark:text-primary-400">เปิด Studio →</div>
      </div>
    </a>

    {#each categories as cat}
      <div class="mb-10">
        <h2 class="text-sm font-bold uppercase tracking-wider text-dark-900/50 dark:text-dark-100/50 mb-4">{cat.name}</h2>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {#each cat.tools as tool}
            <a href={tool.href} class="group block bg-white dark:bg-dark-800 border border-dark-100 dark:border-dark-700 rounded-2xl p-6 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-xl hover:-translate-y-1 transition-all relative">
              {#if tool.isNew}
                <span class="absolute top-3 right-3 px-2 py-0.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold rounded-full">NEW</span>
              {/if}
              <div class="text-5xl mb-3">{tool.icon}</div>
              <h3 class="text-lg font-bold mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition">{tool.title}</h3>
              <p class="text-sm text-dark-900/70 dark:text-dark-100/70 leading-relaxed mb-3">{tool.subtitle}</p>
              <button
                type="button"
                onclick={(e) => togglePrinciple(e, tool.href)}
                class="text-xs text-dark-900/40 dark:text-dark-100/40 underline decoration-dotted hover:text-dark-900/60 dark:hover:text-dark-100/60"
              >
                {expandedPrinciples.has(tool.href) ? 'ซ่อนหลักการ' : 'ดูหลักการ'}
              </button>
              {#if expandedPrinciples.has(tool.href)}
                <p class="mt-1 text-xs text-dark-900/50 dark:text-dark-100/50">{tool.principle}</p>
              {/if}
              <div class="mt-4 text-sm text-primary-600 dark:text-primary-400 font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                เปิดเครื่องมือ
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
              </div>
            </a>
          {/each}
        </div>
      </div>
    {/each}

    <div class="mt-10 bg-gradient-to-br from-primary-50 to-white dark:from-primary-900/40 dark:to-dark-900 border border-primary-200 dark:border-primary-800 rounded-2xl p-6 text-center">
      <h2 class="text-xl font-bold mb-2">💡 ต้องการ Marketing System ครบทั้ง 7 ขั้น?</h2>
      <p class="text-sm text-dark-900/70 dark:text-dark-100/70 mb-4">สร้างโปรเจกต์ใหม่ใน Dashboard เพื่อใช้ Wizard 7 ขั้น (Brand Card, Persona, Journey, Positioning, Content Calendar, Workflow, KPI)</p>
      <a href="/dashboard" class="btn-primary inline-block">ไปที่ Dashboard</a>
    </div>
  </main>
</div>
