<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { fullUser, initAuth, isAuthed, refreshFullUser } from '$lib/auth';
  import { listProjects, createProject, deleteProject, restoreProject, resetProject, sendVerification, type Project } from '$lib/api';
  import StrategicToolsWidget from '$lib/StrategicToolsWidget.svelte';

  let projects = $state<Project[]>([]);
  let archivedProjects = $state<Project[]>([]);
  let showArchive = $state(false);
  let isLoading = $state(true);
  let isCreating = $state(false);
  let newName = $state('');
  let newIndustry = $state('');
  let newKind = $state('playbook');
  let showCreate = $state(false);
  let createFormEl = $state<HTMLDivElement | null>(null);
  let createNameInput = $state<HTMLInputElement | null>(null);
  let kindFilter = $state<string>('');
  let error = $state('');
  let verificationBanner = $state(false);
  let sendingVerify = $state(false);
  let verifySent = $state(false);
  let projectMenu = $state<string | null>(null); // open menu for project id
  let actionMessage = $state('');

  onMount(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      await initAuth();
      if (!$isAuthed) {
        goto('/login');
        return;
      }
      if ($page.url.searchParams.get('verify') === '1') {
        verificationBanner = true;
      }
      const kindParam = $page.url.searchParams.get('kind');
      if (kindParam) kindFilter = kindParam;
      await loadProjects();
      // Close action menu on outside click
      const handler = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-action-menu]')) {
          projectMenu = null;
        }
      };
      document.addEventListener('click', handler);
      cleanup = () => document.removeEventListener('click', handler);
    })();
    return () => cleanup?.();
  });

  async function loadProjects() {
    isLoading = true;
    try {
      projects = await listProjects(kindFilter ? { kind: kindFilter } : undefined);
      archivedProjects = await listProjects({ status: 'archived' });
    } catch (err: any) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  }

  async function handleArchive(id: string) {
    if (!confirm('Archive project นี้? สามารถ restore กลับมาได้จากหน้า Archive')) return;
    projectMenu = null;
    try {
      await deleteProject(id, false);
      actionMessage = '✓ Archive แล้ว';
      await loadProjects();
      setTimeout(() => actionMessage = '', 3000);
    } catch (err: any) {
      error = err.message;
    }
  }

  async function handleRestore(id: string) {
    projectMenu = null;
    try {
      await restoreProject(id);
      actionMessage = '✓ Restore แล้ว — กลับมาเป็น draft';
      await loadProjects();
      setTimeout(() => actionMessage = '', 3000);
    } catch (err: any) {
      error = err.message;
    }
  }

  async function handleReset(id: string, name: string) {
    if (!confirm(`Reset "${name}"?\n\nข้อมูลทั้งหมด (step 1-7) จะถูกลบ แต่ชื่อโปรเจกต์และ exports จะยังอยู่\n\nลบแล้วลบเลย ไม่สามารถ undo ได้`)) return;
    projectMenu = null;
    try {
      await resetProject(id);
      actionMessage = '✓ Reset แล้ว — เริ่ม step 1 ใหม่';
      await loadProjects();
      setTimeout(() => actionMessage = '', 3000);
    } catch (err: any) {
      error = err.message;
    }
  }

  async function handlePermanentDelete(id: string, name: string) {
    if (!confirm(`⚠️ ลบ "${name}" ถาวร?\n\nข้อมูลทั้งหมด (project, generations, exports) จะถูกลบออกจากระบบ\n\nลบแล้วลบเลย ไม่สามารถ undo ได้`)) return;
    try {
      await deleteProject(id, true);
      actionMessage = '✓ ลบถาวรแล้ว';
      await loadProjects();
      setTimeout(() => actionMessage = '', 3000);
    } catch (err: any) {
      error = err.message;
    }
  }

  // The create form renders after the returning-user gradient banner/tools
  // widget, so for anyone with existing plans it's off-screen below the
  // hero button that opens it — clicking that button looked like it did
  // nothing. Scrolling it into view + focusing the name field makes the
  // result of the click visible immediately instead of requiring a manual
  // scroll to discover the form appeared at all.
  async function openCreate() {
    showCreate = true;
    await tick();
    const scrollToForm = () => createFormEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    scrollToForm();
    createNameInput?.focus();

    // StrategicToolsWidget (and this page's own project list) load their data
    // asynchronously and can grow/shrink shortly after the scroll above
    // already ran — on a slow connection this leaves the form no longer at
    // the top of the viewport, silently reintroducing the "nothing visibly
    // happened" bug this function exists to fix. Re-run the scroll once if
    // the page's layout changes within the next couple seconds, then stop
    // watching so this doesn't fight the user's own subsequent scrolling.
    let corrected = false;
    let firstCallback = true;
    const ro = new ResizeObserver(() => {
      // ResizeObserver invokes its callback once immediately upon observe()
      // with the current size — that first call isn't a layout shift, so it
      // must not count as the one correction this is allowed to make.
      if (firstCallback) { firstCallback = false; return; }
      if (corrected || !showCreate) { ro.disconnect(); return; }
      corrected = true;
      scrollToForm();
      ro.disconnect();
    });
    ro.observe(document.body);
    setTimeout(() => ro.disconnect(), 2000);
  }

  async function handleCreate(e: Event) {
    e.preventDefault();
    if (!newName.trim() || isCreating) return;
    isCreating = true;
    error = '';
    try {
      const res = await createProject(newName.trim(), newIndustry.trim() || undefined, newKind);
      goto(`/projects/${res.project.id}`);
    } catch (err: any) {
      error = err.message;
      isCreating = false;
    }
  }

  async function handleResendVerify() {
    if (sendingVerify) return;
    sendingVerify = true;
    try {
      await sendVerification();
      verifySent = true;
    } catch (err: any) {
      error = err.message;
    } finally {
      sendingVerify = false;
    }
  }

  function stepLabel(step: number) {
    // Kept in sync with the wizard's own STEP_NAMES (apps/web/src/routes/projects/[id]/+page.svelte) — Phase B translated that one to Thai but missed this sibling copy, so project cards briefly showed English step names while the wizard itself showed Thai.
    const names = ['', 'ตัวตนธุรกิจ', 'ลูกค้าของเรา', 'เส้นทางลูกค้า', 'จุดขาย', 'ปฏิทินคอนเทนต์', 'ขั้นตอนทำงาน', 'วัดผล (KPI)'];
    return names[step] || '-';
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }
</script>

<svelte:head>
  <title>Dashboard — Business Smart OS</title>
</svelte:head>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950 dark:text-dark-50">
  <main class="container-narrow py-10">
    {#if false && $fullUser?.email_verified === 0}
      <div class="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
        <span class="text-2xl">📧</span>
        <div class="flex-1">
          <div class="font-semibold text-amber-900 dark:text-amber-200">กรุณายืนยันอีเมล</div>
          <div class="text-sm text-amber-800 dark:text-amber-300 mt-1">
            ส่งลิงก์ยืนยันไปที่ <b>{$fullUser?.email}</b> แล้ว กรุณาคลิกลิงก์ในอีเมลเพื่อเริ่มใช้งาน
            {#if verifySent}
              <span class="text-green-700 dark:text-green-400 ml-2">✓ ส่งใหม่แล้ว</span>
            {/if}
          </div>
          <button onclick={handleResendVerify} disabled={sendingVerify} class="mt-2 text-sm text-amber-700 dark:text-amber-400 hover:underline font-semibold disabled:opacity-50">
            {sendingVerify ? 'กำลังส่ง...' : 'ส่งอีเมลยืนยันอีกครั้ง'}
          </button>
        </div>
      </div>
    {/if}

    <!-- Hero — one primary action; the tools link is a plain secondary link,
         not a second button competing for the same first click. -->
    <div class="flex items-center justify-between mb-8 flex-wrap gap-4">
      <div>
        <h1 class="heading-2 mb-1">แผนของฉัน</h1>
        <p class="text-dark-900/60 dark:text-dark-100/60">แต่ละแผนคือชุดการตลาดครบของธุรกิจหนึ่ง สร้างด้วยระบบอัจฉริยะใน 7 ขั้นตอน</p>
      </div>
      <div class="flex items-center gap-4 flex-wrap">
        <a href="/tools" class="text-sm text-dark-900/60 dark:text-dark-100/60 hover:text-primary-600 font-medium">⚡ หรือลองเครื่องมือเดี่ยว</a>
        <a href="/studio" class="text-sm text-dark-900/60 dark:text-dark-100/60 hover:text-primary-600 font-medium">🎨 เปิด Creative Studio</a>
        <button onclick={() => showCreate ? (showCreate = false) : openCreate()} class="btn-primary">+ สร้างแผนใหม่</button>
      </div>
    </div>

    <!-- Returning users get the full strategic-tools surface; a brand-new
         user with zero plans sees one focused empty state below instead —
         these were previously shown to everyone at once, competing with
         the actual first task before a new user had even created anything. -->
    {#if projects.length > 0 || archivedProjects.length > 0}
      <a href="/tools" class="block mb-6 bg-gradient-to-r from-primary-500 to-primary-700 text-white rounded-2xl p-5 hover:shadow-lg transition group">
        <div class="flex items-center gap-4">
          <div class="text-4xl">⚡</div>
          <div class="flex-1">
            <div class="font-bold text-lg">เครื่องมือระบบอัจฉริยะแยกต่างหาก</div>
            <div class="text-sm text-white/80">หาจุดขาย · เข้าใจลูกค้า · คิดประโยคโฆษณา และอีก 7 เครื่องมือ · ใช้ได้โดยไม่ต้องสร้างแผน</div>
          </div>
          <svg class="w-5 h-5 group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
        </div>
      </a>

      <a href="/studio" class="block mb-6 rounded-2xl border border-dark-100 bg-white p-5 transition hover:border-primary-200 hover:shadow-lg dark:border-dark-700 dark:bg-dark-800 group">
        <div class="flex items-center gap-4">
          <div class="text-4xl">🎨</div>
          <div class="flex-1">
            <div class="font-bold text-lg">Creative Studio</div>
            <div class="text-sm text-dark-900/60 dark:text-dark-100/60">สร้างภาพแคมเปญ เก็บ reference image และใช้เครดิตเดียวกับบัญชี</div>
          </div>
          <svg class="w-5 h-5 text-dark-900/40 transition group-hover:translate-x-1 dark:text-dark-100/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
        </div>
      </a>

      <div class="grid md:grid-cols-2 gap-4 mb-6">
        <a href="/inbox" class="rounded-2xl border border-dark-100 bg-white p-5 transition hover:border-primary-200 hover:shadow-lg dark:border-dark-700 dark:bg-dark-800 group">
          <div class="flex items-center gap-4">
            <div class="text-3xl">📥</div>
            <div class="flex-1">
              <div class="font-bold text-lg">Content Inbox</div>
              <div class="text-sm text-dark-900/60 dark:text-dark-100/60">รีวิวโพสต์จาก calendar ก่อนส่งไปสร้าง creative หรือ schedule</div>
            </div>
            <svg class="w-5 h-5 text-dark-900/40 transition group-hover:translate-x-1 dark:text-dark-100/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
          </div>
        </a>
        <a href="/works" class="rounded-2xl border border-dark-100 bg-white p-5 transition hover:border-primary-200 hover:shadow-lg dark:border-dark-700 dark:bg-dark-800 group">
          <div class="flex items-center gap-4">
            <div class="text-3xl">🗂️</div>
            <div class="flex-1">
              <div class="font-bold text-lg">Works</div>
              <div class="text-sm text-dark-900/60 dark:text-dark-100/60">ดูสถานะงาน creative และคอนเทนต์ทั้งหมดในที่เดียว</div>
            </div>
            <svg class="w-5 h-5 text-dark-900/40 transition group-hover:translate-x-1 dark:text-dark-100/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
          </div>
        </a>
      </div>

      <StrategicToolsWidget />
    {/if}

    {#if error}
      <div class="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
        {error}
      </div>
    {/if}

    {#if showCreate}
      <div bind:this={createFormEl} class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-6 mb-8 scroll-mt-20">
        <h2 class="font-semibold mb-4">สร้างโปรเจกต์ใหม่</h2>
        <form onsubmit={handleCreate} class="space-y-3">
          <input
            bind:this={createNameInput}
            type="text"
            bind:value={newName}
            required
            placeholder="ชื่อธุรกิจ (เช่น ก๋วยเตี๋ยวบ้านหมู)"
            class="w-full px-4 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <input
            type="text"
            bind:value={newIndustry}
            placeholder="อุตสาหกรรม (เช่น F&B, คลินิก, อสังหา) — ไม่บังคับ"
            class="w-full px-4 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div>
            <label class="block text-sm font-medium mb-1.5">ประเภทโปรเจกต์</label>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {#each [
                { value: 'playbook', label: '📊 Playbook', desc: '7-step ครบ' },
                { value: 'brand_voice', label: '🎙️ Brand Voice', desc: 'เสียงแบรนด์' },
                { value: 'pain_points', label: '🎯 Pain Points', desc: 'Pain point' },
                { value: 'persona', label: '👥 Persona', desc: 'Customer persona' },
              ] as opt}
                <button
                  type="button"
                  onclick={() => newKind = opt.value}
                  class="text-left px-3 py-2 rounded-lg border-2 transition text-sm {newKind === opt.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/40' : 'border-dark-200 dark:border-dark-600 hover:border-dark-300 dark:hover:border-dark-500'}"
                >
                  <div class="font-semibold">{opt.label}</div>
                  <div class="text-xs text-dark-900/60 dark:text-dark-100/60">{opt.desc}</div>
                </button>
              {/each}
            </div>
          </div>
          <div class="flex gap-2">
            <button type="submit" disabled={isCreating} class="btn-primary disabled:opacity-50">
              {isCreating ? 'กำลังสร้าง...' : 'สร้าง'}
            </button>
            <button type="button" onclick={() => showCreate = false} class="btn-secondary">ยกเลิก</button>
          </div>
        </form>
      </div>
    {/if}

    {#if isLoading}
      <div class="text-center py-20 text-dark-900/60 dark:text-dark-100/60">กำลังโหลด...</div>
    {:else if projects.length === 0 && archivedProjects.length === 0 && !kindFilter}
      <!-- True first-time state: one focused message, one button, and a
           lighter-weight secondary path for someone who just wants to try
           one thing quickly instead of committing to the full 7-step plan. -->
      <div class="bg-white dark:bg-dark-800 rounded-2xl border-2 border-dashed border-dark-200 dark:border-dark-600 p-12 text-center">
        <div class="text-4xl mb-3">🌱</div>
        <h3 class="font-semibold text-lg mb-1">ยังไม่มีแผน — มาสร้างแผนแรกกัน</h3>
        <p class="text-sm text-dark-900/60 dark:text-dark-100/60 mb-6">กดปุ่มด้านล่าง แล้วตอบคำถามทีละขั้น ใช้เวลาประมาณ 45 นาที</p>
        <button onclick={openCreate} class="btn-primary">+ สร้างแผนแรกของฉัน</button>
      </div>

      <div class="mt-6">
        <div class="text-sm font-semibold text-dark-900/70 dark:text-dark-100/70 mb-3">หรือลองเครื่องมือเดี่ยว</div>
        <div class="grid sm:grid-cols-3 gap-3">
          <a href="/tools/value-proposition-canvas" class="bg-white dark:bg-dark-800 rounded-xl border border-dark-100 dark:border-dark-700 p-4 hover:border-primary-200 hover:shadow-md transition">
            <div class="text-xl mb-1.5">🎯</div>
            <div class="text-sm font-semibold mb-0.5">หาจุดขาย</div>
            <div class="text-xs text-dark-900/60 dark:text-dark-100/60">ค้นว่าธุรกิจคุณเด่นกว่าคู่แข่งตรงไหน</div>
          </a>
          <a href="/tools/hook-library" class="bg-white dark:bg-dark-800 rounded-xl border border-dark-100 dark:border-dark-700 p-4 hover:border-primary-200 hover:shadow-md transition">
            <div class="text-xl mb-1.5">🗣️</div>
            <div class="text-sm font-semibold mb-0.5">คิดประโยคโฆษณา</div>
            <div class="text-xs text-dark-900/60 dark:text-dark-100/60">หาประโยคเปิดที่คนหยุดอ่าน</div>
          </a>
          <a href="/tools/persona-builder" class="bg-white dark:bg-dark-800 rounded-xl border border-dark-100 dark:border-dark-700 p-4 hover:border-primary-200 hover:shadow-md transition">
            <div class="text-xl mb-1.5">👥</div>
            <div class="text-sm font-semibold mb-0.5">เข้าใจลูกค้า</div>
            <div class="text-xs text-dark-900/60 dark:text-dark-100/60">วาดภาพลูกค้าในฝันของคุณ</div>
          </a>
        </div>
      </div>
    {:else if projects.length === 0}
      <div class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-12 text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-50 dark:bg-primary-900/40 flex items-center justify-center">
          <span class="text-3xl">{kindFilter ? ({ brand_voice: '🎙️', pain_points: '🎯', persona: '👥', competitor_analysis: '🔍', jtbd_generator: '🎯', value_proposition_canvas: '💎', business_model_canvas: '📊', million_dollar_offer: '💎', objection_handler: '🛡️', hook_library: '🎣' } as any)[kindFilter] || '📋' : '📋'}</span>
        </div>
        <h3 class="font-semibold mb-2">ยังไม่มีโปรเจกต์{kindFilter ? `ประเภท ${({ brand_voice: 'Brand Voice', pain_points: 'Pain Points', persona: 'Persona', competitor_analysis: 'Competitor', jtbd_generator: 'JTBD', value_proposition_canvas: 'VPC', business_model_canvas: 'BMC', million_dollar_offer: 'Offer', objection_handler: 'Objections', hook_library: 'Hooks' } as any)[kindFilter] || ''}` : ''}</h3>
        <p class="text-sm text-dark-900/60 dark:text-dark-100/60 mb-6">เริ่มสร้างโปรเจกต์แรกของคุณ</p>
        <button onclick={openCreate} class="btn-primary">+ สร้างโปรเจกต์แรก</button>
      </div>
    {:else}
      <!-- Kind filter -->
      <div class="flex items-center gap-2 mb-4 flex-wrap">
        <button onclick={() => { kindFilter = ''; loadProjects(); }} class="text-sm px-3 py-1.5 rounded-full {kindFilter === '' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 hover:border-primary-300'}">
          ทั้งหมด
        </button>
        <button onclick={() => { kindFilter = 'playbook'; loadProjects(); }} class="text-sm px-3 py-1.5 rounded-full {kindFilter === 'playbook' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 hover:border-primary-300'}">
          📊 Playbook
        </button>
        <button onclick={() => { kindFilter = 'brand_voice'; loadProjects(); }} class="text-sm px-3 py-1.5 rounded-full {kindFilter === 'brand_voice' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 hover:border-primary-300'}">
          🎙️ Brand Voice
        </button>
        <button onclick={() => { kindFilter = 'pain_points'; loadProjects(); }} class="text-sm px-3 py-1.5 rounded-full {kindFilter === 'pain_points' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 hover:border-primary-300'}">
          🎯 Pain Points
        </button>
        <button onclick={() => { kindFilter = 'persona'; loadProjects(); }} class="text-sm px-3 py-1.5 rounded-full {kindFilter === 'persona' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 hover:border-primary-300'}">
          👥 Persona
        </button>
        <button onclick={() => { kindFilter = 'competitor_analysis'; loadProjects(); }} class="text-sm px-3 py-1.5 rounded-full {kindFilter === 'competitor_analysis' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 hover:border-primary-300'}">
          🔍 Competitor
        </button>
        <button onclick={() => { kindFilter = 'jtbd_generator'; loadProjects(); }} class="text-sm px-3 py-1.5 rounded-full {kindFilter === 'jtbd_generator' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 hover:border-primary-300'}">
          🎯 JTBD
        </button>
        <button onclick={() => { kindFilter = 'value_proposition_canvas'; loadProjects(); }} class="text-sm px-3 py-1.5 rounded-full {kindFilter === 'value_proposition_canvas' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 hover:border-primary-300'}">
          💎 VPC
        </button>
        <button onclick={() => { kindFilter = 'business_model_canvas'; loadProjects(); }} class="text-sm px-3 py-1.5 rounded-full {kindFilter === 'business_model_canvas' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 hover:border-primary-300'}">
          📊 BMC
        </button>
        <button onclick={() => { kindFilter = 'million_dollar_offer'; loadProjects(); }} class="text-sm px-3 py-1.5 rounded-full {kindFilter === 'million_dollar_offer' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 hover:border-primary-300'}">
          💎 Offer
        </button>
        <button onclick={() => { kindFilter = 'objection_handler'; loadProjects(); }} class="text-sm px-3 py-1.5 rounded-full {kindFilter === 'objection_handler' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 hover:border-primary-300'}">
          🛡️ Objections
        </button>
        <button onclick={() => { kindFilter = 'hook_library'; loadProjects(); }} class="text-sm px-3 py-1.5 rounded-full {kindFilter === 'hook_library' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 hover:border-primary-300'}">
          🎣 Hooks
        </button>
      </div>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each projects as project}
          {@const kindMeta = ({ playbook: { icon: '📊', color: 'primary' }, brand_voice: { icon: '🎙️', color: 'purple' }, pain_points: { icon: '🎯', color: 'red' }, persona: { icon: '👥', color: 'green' }, competitor_analysis: { icon: '🔍', color: 'orange' }, jtbd_generator: { icon: '🎯', color: 'purple' }, value_proposition_canvas: { icon: '💎', color: 'pink' }, business_model_canvas: { icon: '📊', color: 'indigo' } } as any)[project.kind || 'playbook']}
          <div class="relative bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-5 hover:border-primary-200 hover:shadow-lg transition group">
            <a href={`/projects/${project.id}`} class="block">
              <div class="flex items-start justify-between mb-3 pr-8">
                <div class="w-10 h-10 rounded-lg bg-{kindMeta.color}-50 flex items-center justify-center text-xl">
                  {kindMeta.icon}
                </div>
                <div class="flex flex-col items-end gap-1">
                  <span class="text-xs px-2 py-0.5 rounded-full bg-{kindMeta.color}-50 text-{kindMeta.color}-700">{({ playbook: 'Playbook', brand_voice: 'Brand Voice', pain_points: 'Pain Points', persona: 'Persona', competitor_analysis: 'Competitor', jtbd_generator: 'JTBD', value_proposition_canvas: 'VPC', business_model_canvas: 'BMC' } as any)[project.kind || 'playbook']}</span>
                  {#if project.status === 'completed'}
                    <span class="text-xs px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400">เสร็จ</span>
                  {:else}
                    <span class="text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">ร่าง</span>
                  {/if}
                </div>
              </div>
              <h3 class="font-semibold mb-1 group-hover:text-primary-600 transition">{project.name}</h3>
              <p class="text-sm text-dark-900/60 dark:text-dark-100/60 mb-3">{project.industry || 'ไม่ระบุอุตสาหกรรม'}</p>
              <div class="flex items-center justify-between text-xs text-dark-900/50 dark:text-dark-100/50">
                <span>ขั้นที่ {project.current_step} / 7 · {stepLabel(project.current_step)}</span>
                <span>{formatDate(project.updated_at)}</span>
              </div>
              <!-- Progress bar -->
              {#if (project.kind || 'playbook') === 'playbook'}
                <div class="mt-3 h-1.5 bg-dark-100 dark:bg-dark-600 rounded-full overflow-hidden">
                  <div class="h-full bg-primary-500 transition-all" style="width: {((project.current_step - 1) / 7) * 100}%"></div>
                </div>
              {/if}
            </a>
            <!-- Actions menu button (top-right corner, z-20) -->
            <div data-action-menu class="absolute top-2 right-2 z-20">
              <button
                onclick={(e) => { e.preventDefault(); e.stopPropagation(); projectMenu = projectMenu === project.id ? null : project.id; }}
                class="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-900/40 dark:text-dark-100/40 hover:text-dark-900 dark:hover:text-dark-50 transition-colors"
                title="Actions"
                aria-label="Project actions"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                </svg>
              </button>
              {#if projectMenu === project.id}
                <div class="absolute right-0 mt-1 w-48 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 rounded-lg shadow-xl z-30 py-1 text-sm">
                  <button
                    onclick={(e) => { e.stopPropagation(); handleReset(project.id, project.name); }}
                    class="w-full text-left px-3 py-2 hover:bg-dark-50 dark:hover:bg-dark-700 flex items-center gap-2"
                  >
                    <span>🔄</span> Reset ใหม่
                  </button>
                  <button
                    onclick={(e) => { e.stopPropagation(); handleArchive(project.id); }}
                    class="w-full text-left px-3 py-2 hover:bg-dark-50 dark:hover:bg-dark-700 flex items-center gap-2 text-amber-700 dark:text-amber-400"
                  >
                    <span>📦</span> Archive
                  </button>
                  <button
                    onclick={(e) => { e.stopPropagation(); if (confirm('ลบถาวร "' + project.name + '" ?\n\n⚠️ ลบแล้วไม่สามารถ undo')) handlePermanentDelete(project.id, project.name); }}
                    class="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2 text-red-700 dark:text-red-400 border-t border-dark-100 dark:border-dark-700"
                  >
                    <span>🗑️</span> ลบถาวร
                  </button>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- Action message -->
      {#if actionMessage}
        <div class="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-400 text-center">
          {actionMessage}
        </div>
      {/if}

      <!-- Archive section -->
      {#if archivedProjects.length > 0}
        <div class="mt-8 pt-6 border-t border-dark-200 dark:border-dark-600">
          <button
            onclick={() => (showArchive = !showArchive)}
            class="flex items-center gap-2 text-sm font-semibold text-dark-900/70 dark:text-dark-100/70 hover:text-dark-900 dark:hover:text-dark-50"
          >
            <span>{showArchive ? '▼' : '▶'}</span>
            <span>📦 Archive ({archivedProjects.length})</span>
          </button>

          {#if showArchive}
            <div class="mt-3 grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {#each archivedProjects as p}
                <div class="bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-600 rounded-xl p-4 opacity-80">
                  <div class="flex items-start justify-between mb-2">
                    <h4 class="font-medium text-dark-900 dark:text-dark-50 line-clamp-1">{p.name}</h4>
                    <span class="text-xs text-dark-900/50 dark:text-dark-100/50">📦</span>
                  </div>
                  <p class="text-xs text-dark-900/60 dark:text-dark-100/60 mb-3">{p.industry || 'ไม่ระบุอุตสาหกรรม'}</p>
                  <div class="text-xs text-dark-900/50 dark:text-dark-100/50 mb-3">
                    Archived {formatDate(p.updated_at)}
                  </div>
                  <div class="flex gap-2">
                    <button
                      onclick={() => handleRestore(p.id)}
                      class="flex-1 text-xs px-2 py-1.5 rounded bg-primary-600 text-white hover:bg-primary-700"
                    >
                      ↩ Restore
                    </button>
                    <button
                      onclick={() => handlePermanentDelete(p.id, p.name)}
                      class="flex-1 text-xs px-2 py-1.5 rounded bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800"
                    >
                      🗑️ ลบถาวร
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </main>
</div>
