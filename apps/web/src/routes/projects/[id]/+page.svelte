<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { initAuth, isAuthed } from '$lib/auth';
  import StepAssets from '$lib/StepAssets.svelte';
  import { getProject, updateProject, generateStep, exportProject, exportProjectFormatted, getExportUrl, materializeStep5ContentItems, type ProjectWithData, type ExportFormat } from '$lib/api';
  import OutputRenderer from '$lib/OutputRenderer.svelte';

  // Reactive project ID from URL params
  let projectId = $derived($page.params.id || '');

  let project = $state<ProjectWithData | null>(null);
  let currentStep = $state(1);
  let isLoading = $state(true);
  let isGenerating = $state(false);
  let isExporting = $state(false);
  let isMaterializingContent = $state(false);
  let error = $state('');
  let success = $state('');
  let exportUrl = $state('');

  // Step 1 form data
  let s1 = $state({
    business_name: '',
    business_type: '',
    industry: '',
    location: '',
    customer_age: '',
    customer_job: '',
    customer_income: '',
    pain_point_1: '',
    pain_point_2: '',
    pain_point_3: '',
    competitor_1: '',
    competitor_2: '',
    competitor_3: '',
    differentiation: '',
    price_range: '',
    goal: '',
  });

  // Step 2 form data
  let s2 = $state({ reviews_text: '' });

  // Step 5 form data
  let s5 = $state({
    channels: 'Facebook, Instagram, LINE',
    posts_per_week: '5',
  });

  // Step 6 form data
  let s6 = $state({
    current_work: 'ทำ content 3-5 ชิ้น/สัปดาห์, ตอบแชท, ทำรายงาน',
    team_size: '1',
    budget: '1000',
    tools_available: 'ChatGPT, Canva, LINE OA',
  });

  // Step 7 form data
  let s7 = $state({
    business_type: '',
    monthly_revenue: '50000',
    goal_30: 'Lead 50 / เดือน',
    goal_90: 'Lead 150 / เดือน',
    current_metrics: '',
  });

  $effect(() => {
    console.log('[WIZARD] $effect: projectId=', JSON.stringify(projectId), 'project=', project, 'error=', error);
    if (projectId && !project && !error) {
      console.log('[WIZARD] calling loadProject with', projectId);
      loadProject();
    }
  });

  onMount(async () => {
    console.log('[WIZARD] onMount start, $page.params =', JSON.stringify($page.params));
    await initAuth();
    if (!$isAuthed) {
      goto('/login');
      return;
    }
    console.log('[WIZARD] auth OK, projectId=', projectId, 'window.location=', window.location.pathname);
  });

  async function loadProject() {
    if (!projectId) return;
    isLoading = true;
    error = '';
    try {
      const p = await getProject(projectId);
      project = p;
      currentStep = p.current_step || 1;
      // Pre-fill step 1 with project name
      s1.business_name = p.name;
      s1.industry = p.industry || '';
      // Restore any saved step data
      const stepData = p.step_data || {};
      if (stepData.step1?.input) Object.assign(s1, stepData.step1.input);
      if (stepData.step2?.input) Object.assign(s2, stepData.step2.input);
      if (stepData.step5?.input) Object.assign(s5, stepData.step5.input);
      if (stepData.step6?.input) Object.assign(s6, stepData.step6.input);
      if (stepData.step7?.input) Object.assign(s7, stepData.step7.input);
    } catch (err: any) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  }

  function getStepInput(step: number) {
    switch (step) {
      case 1: return s1;
      case 2: return s2;
      case 5: return s5;
      case 6: return s6;
      case 7: return s7;
      default: return {};
    }
  }

  async function handleGenerate() {
    if (!project || isGenerating) return;
    error = '';
    success = '';
    isGenerating = true;

    try {
      // Save input to project first
      const input = getStepInput(currentStep);
      const newStepData = { ...(project.step_data || {}), [`step${currentStep}`]: { input } };
      await updateProject(project.id, { step_data: newStepData });
      project.step_data = newStepData;

      // Generate
      const res = await generateStep(project.id, currentStep, input);
      const newStepData2 = { ...(project.step_data || {}), [`step${currentStep}`]: { input, output: res.output } };
      await updateProject(project.id, { step_data: newStepData2 });
      project.step_data = newStepData2;
      project.current_step = Math.max(currentStep + 1, project.current_step);

      success = `✅ Step ${currentStep} เสร็จแล้ว`;
    } catch (err: any) {
      error = err.message;
    } finally {
      isGenerating = false;
    }
  }

  async function handleExport(format: ExportFormat = 'html') {
    if (!project || isExporting) return;
    error = '';
    isExporting = true;
    try {
      const res = await exportProjectFormatted(project.id, format);
      exportUrl = getExportUrl(res.export_id);
      if (format === 'html') {
        success = '✅ HTML พร้อมแล้ว — เปิดลิงก์แล้วกด Cmd/Ctrl+P เพื่อ Save as PDF';
        window.open(exportUrl, '_blank');
      } else {
        success = `✅ Export .${format} พร้อมแล้ว — กำลังดาวน์โหลด...`;
        const a = document.createElement('a');
        a.href = exportUrl;
        a.download = `${project.name}.${format}`;
        a.target = '_blank';
        a.click();
      }
    } catch (err: any) {
      error = err.message;
    } finally {
      isExporting = false;
    }
  }

  async function handleMaterializeContent() {
    if (!project || isMaterializingContent) return;
    error = '';
    success = '';
    isMaterializingContent = true;
    try {
      const res = await materializeStep5ContentItems(project.id);
      success = `สร้าง Content Inbox แล้ว ${res.materialized} รายการ`;
      goto('/inbox');
    } catch (err: any) {
      error = err.message;
    } finally {
      isMaterializingContent = false;
    }
  }

  function goToStep(n: number) {
    if (n >= 1 && n <= 7) {
      currentStep = n;
      success = '';
      error = '';
    }
  }

  const STEP_NAMES = [
    null,
    { th: 'ตัวตนธุรกิจ', en: 'Business DNA', icon: '1️⃣' },
    { th: 'ลูกค้าของเรา', en: 'Customer Persona', icon: '2️⃣' },
    { th: 'เส้นทางลูกค้า', en: 'Customer Journey', icon: '3️⃣' },
    { th: 'จุดขาย', en: 'Positioning', icon: '4️⃣' },
    { th: 'ปฏิทินคอนเทนต์', en: 'Content Calendar', icon: '5️⃣' },
    { th: 'ขั้นตอนทำงาน', en: 'Marketing Workflow', icon: '6️⃣' },
    { th: 'วัดผล (KPI)', en: 'KPI Dashboard', icon: '7️⃣' },
  ];

  // Credit ceiling shown before generating, so a step never surprises the
  // user with a cost. Computed the same way apps/api/src/lib/credit.ts's
  // calculateCredits() does — ceil(prompt_tokens/1000 * 1 + completion_tokens/1000 * 2)
  // — using each step's real maxTokensByStep reserve cap from apps/api/src/index.ts
  // (1:8000, 2:12000, 3:10000, 4:8000, 5:20000, 6:12000, 7:14000) plus a small
  // buffer for prompt tokens. This matches the actual reserve the backend
  // deducts up front (verified live: step 1 reserved 17, step 5 reserved 41 —
  // both match this formula), so it's a true "at most" ceiling, never a
  // point-guess that the real charge can exceed. Earlier this used
  // maxCompletionTokens/1000 directly (no ×2 weighting, no prompt buffer),
  // which under-quoted long steps by ~2x — e.g. step 5 showed "~20" while a
  // real generation that used its full 20k-token budget charged 42.
  const CREDIT_ESTIMATE: Record<number, number> = { 1: 18, 2: 26, 3: 22, 4: 18, 5: 42, 6: 26, 7: 30 };

  function getOutput(step: number) {
    return project?.step_data?.[`step${step}`]?.output;
  }
</script>

<svelte:head>
  <title>{project?.name || 'Project'} — Business Smart OS</title>
</svelte:head>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950">
  <main class="container-narrow py-6">
    <div class="flex items-center gap-3 mb-4">
      <a href="/dashboard" class="text-dark-900/60 dark:text-dark-100/60 hover:text-dark-900 dark:hover:text-dark-50">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
      </a>
      <span class="font-bold">{project?.name || 'Loading...'}</span>
    </div>
    {#if isLoading}
      <div class="text-center py-20 text-dark-900/60 dark:text-dark-100/60">กำลังโหลด...</div>
    {:else if !project}
      <div class="text-center py-20">
        <p class="text-red-600 dark:text-red-400 mb-4">{error || 'ไม่พบโปรเจกต์'}</p>
        <a href="/dashboard" class="btn-primary">กลับไป Dashboard</a>
      </div>
    {:else}
      <!-- Step tabs (desktop) -->
      <div class="mb-6 bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-2 overflow-x-auto hidden sm:block">
        <div class="flex gap-1">
          {#each STEP_NAMES.slice(1) as step, i}
            {@const stepNum = i + 1}
            {@const isDone = getOutput(stepNum)}
            <button
              onclick={() => goToStep(stepNum)}
              class="px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition flex items-center gap-2 {currentStep === stepNum ? 'bg-primary-500 text-white' : isDone ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40' : 'text-dark-900/60 dark:text-dark-100/60 hover:bg-dark-50 dark:hover:bg-dark-700'}"
            >
              <span class="w-5 h-5 rounded-full flex items-center justify-center text-xs {currentStep === stepNum ? 'bg-white dark:bg-dark-800 text-primary-600 dark:text-primary-400' : isDone ? 'bg-green-500 text-white' : 'bg-dark-100 dark:bg-dark-700'}">
                {isDone && currentStep !== stepNum ? '✓' : stepNum}
              </span>
              {step?.th}
            </button>
          {/each}
        </div>
      </div>

      <!-- Step progress (mobile) — dots + current step name only, the full tab row overflows a 375px screen -->
      <div class="mb-6 bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-4 sm:hidden">
        <div class="flex items-center justify-center gap-1.5 mb-2">
          {#each STEP_NAMES.slice(1) as step, i}
            {@const stepNum = i + 1}
            {@const isDone = getOutput(stepNum)}
            <button
              onclick={() => goToStep(stepNum)}
              aria-label={`ไปขั้นที่ ${stepNum}: ${step?.th}`}
              class="w-2.5 h-2.5 rounded-full transition {currentStep === stepNum ? 'bg-primary-500 w-6' : isDone ? 'bg-green-500' : 'bg-dark-200 dark:bg-dark-600'}"
            ></button>
          {/each}
        </div>
        <div class="text-center text-sm font-semibold">
          ขั้นที่ {currentStep}/7 · {STEP_NAMES[currentStep]?.icon} {STEP_NAMES[currentStep]?.th}
        </div>
      </div>

      <!-- Error / Success -->
      {#if error}
        <div class="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      {/if}
      {#if success}
        <div class="mb-4 p-4 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-400">
          {success}
          {#if exportUrl}
            <a href={exportUrl} target="_blank" class="ml-2 underline font-semibold">เปิดหน้า Export</a>
          {/if}
        </div>
      {/if}

      <!-- Step content -->
      <div class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-6 sm:p-8">
        <div class="mb-6">
          <div class="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-1">ขั้นที่ {currentStep} จาก 7</div>
          <h2 class="heading-3 mb-1">{STEP_NAMES[currentStep]?.icon} {STEP_NAMES[currentStep]?.th}</h2>
          <p class="text-xs text-dark-900/40 dark:text-dark-100/40">{STEP_NAMES[currentStep]?.en}</p>
        </div>

        <!-- Per-step context (notes + files + links) -->
        <div class="mb-6">
          <StepAssets projectId={project.id} stepNumber={currentStep} canLink={currentStep === 2} />
        </div>

        <!-- Step 1: Business DNA -->
        {#if currentStep === 1}
          <div class="grid md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1.5">ชื่อธุรกิจ *</label>
              <input type="text" bind:value={s1.business_name} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" placeholder="ก๋วยเตี๋ยวบ้านหมู" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">ประเภท *</label>
              <input type="text" bind:value={s1.business_type} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" placeholder="ร้านอาหาร" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">อุตสาหกรรม</label>
              <input type="text" bind:value={s1.industry} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" placeholder="F&B" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">ที่ตั้ง</label>
              <input type="text" bind:value={s1.location} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" placeholder="Bangkok" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">อายุลูกค้า</label>
              <input type="text" bind:value={s1.customer_age} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" placeholder="28-40" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">อาชีพลูกค้า</label>
              <input type="text" bind:value={s1.customer_job} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" placeholder="พนักงานออฟฟิศ" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">รายได้ลูกค้า</label>
              <input type="text" bind:value={s1.customer_income} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" placeholder="40,000-70,000" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">ช่วงราคา</label>
              <input type="text" bind:value={s1.price_range} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" placeholder="กลาง" />
            </div>
            <div class="md:col-span-2">
              <p class="text-xs text-dark-900/60 dark:text-dark-100/60 -mb-1">
                💡 <strong>ปัญหาลูกค้า (Pain Point)</strong> = ปัญหาที่ลูกค้าเจอจริง เช่น "หาของกินสายที่เปิดดึกไม่ได้"
              </p>
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium mb-1.5">ปัญหาลูกค้า 1 *</label>
              <input type="text" bind:value={s1.pain_point_1} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" placeholder="อยากกิน comfort food แต่กลัวอ้วน" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">ปัญหาลูกค้า 2 *</label>
              <input type="text" bind:value={s1.pain_point_2} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">ปัญหาลูกค้า 3 *</label>
              <input type="text" bind:value={s1.pain_point_3} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">คู่แข่ง 1</label>
              <input type="text" bind:value={s1.competitor_1} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">คู่แข่ง 2</label>
              <input type="text" bind:value={s1.competitor_2} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">คู่แข่ง 3</label>
              <input type="text" bind:value={s1.competitor_3} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium mb-1.5">จุดต่างจากคู่แข่ง</label>
              <input type="text" bind:value={s1.differentiation} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium mb-1.5">เป้าหมาย 3 เดือน</label>
              <input type="text" bind:value={s1.goal} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" placeholder="Lead 100/เดือน" />
            </div>
          </div>

        <!-- Step 2: Customer Persona -->
        {:else if currentStep === 2}
          <div>
            <label class="block text-sm font-medium mb-1.5">รีวิว/ข้อความจากลูกค้าจริง (50-100 รีวิว)</label>
            <p class="text-xs text-dark-900/60 dark:text-dark-100/60 mb-2">
              Paste รีวิวจาก Google/Facebook/Wongnai มาให้ ระบบอัจฉริยะ วิเคราะห์
              <span class="block mt-1 text-primary-600 dark:text-primary-400">💡 ถ้ามี Brand Voice project / Pain Points project / saved tool result → กดแท็บ "🔗 ลิงก์" ด้านบนเพื่อดึงข้อมูลมาใช้</span>
            </p>
            <textarea
              bind:value={s2.reviews_text}
              rows="12"
              class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 font-mono text-sm"
              placeholder="รีวิว 1: อร่อยมาก แต่แพงไปนิด&#10;รีวิว 2: เส้น shirataki เจ๋ง ลดน้ำหนักได้จริง&#10;..."
            ></textarea>
          </div>

        <!-- Step 3: Customer Journey (uses step 1+2) -->
        {:else if currentStep === 3}
          <p class="text-sm text-dark-900/60 dark:text-dark-100/60 mb-4">
            Step 3 จะใช้ข้อมูลจาก Brand Card (Step 1) และ Persona (Step 2) มาออกแบบ Journey 5 จุด
            ไม่ต้องกรอกเพิ่ม — กดปุ่ม Generate ได้เลย
          </p>

        <!-- Step 4: Positioning (uses step 1+2) -->
        {:else if currentStep === 4}
          <p class="text-sm text-dark-900/60 dark:text-dark-100/60 mb-4">
            Step 4 จะใช้ข้อมูลจาก Brand Card (Step 1) และ Persona (Step 2) มาสร้าง Positioning
            ไม่ต้องกรอกเพิ่ม — กดปุ่ม Generate ได้เลย
          </p>

        <!-- Step 5: Content Calendar -->
        {:else if currentStep === 5}
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1.5">ช่องทาง (คั่นด้วยจุลภาค)</label>
              <input type="text" bind:value={s5.channels} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">โพสต์ต่อสัปดาห์</label>
              <input type="number" bind:value={s5.posts_per_week} min="1" max="20" class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" />
            </div>
          </div>

        <!-- Step 6: Marketing Workflow -->
        {:else if currentStep === 6}
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1.5">งาน marketing ที่ทำเป็นประจำ</label>
              <textarea bind:value={s6.current_work} rows="3" class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600"></textarea>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">ขนาดทีม (คน)</label>
              <input type="number" bind:value={s6.team_size} min="1" class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">งบ ระบบอัจฉริยะ tools (บาท/เดือน)</label>
              <input type="number" bind:value={s6.budget} min="0" class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">เครื่องมือที่มี</label>
              <input type="text" bind:value={s6.tools_available} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" />
            </div>
          </div>

        <!-- Step 7: KPI Dashboard -->
        {:else if currentStep === 7}
          <div class="grid md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1.5">ประเภทธุรกิจ</label>
              <input type="text" bind:value={s7.business_type} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" placeholder="ร้านอาหาร" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">รายได้ต่อเดือนปัจจุบัน (บาท)</label>
              <input type="number" bind:value={s7.monthly_revenue} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">เป้า 30 วัน</label>
              <input type="text" bind:value={s7.goal_30} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" placeholder="Lead 50" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">เป้า 90 วัน</label>
              <input type="text" bind:value={s7.goal_90} class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" placeholder="Lead 150" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium mb-1.5">ตัวเลขปัจจุบัน (ถ้ามี)</label>
              <textarea bind:value={s7.current_metrics} rows="3" class="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600" placeholder="Lead 5/สัปดาห์, Conversion 8%, Revenue 35,000 บาท/สัปดาห์"></textarea>
            </div>
          </div>
        {/if}

        <!-- Generate button -->
        <div class="mt-6 pt-6 border-t border-dark-100 dark:border-dark-700 flex items-center justify-between flex-wrap gap-3">
          <span class="text-xs text-dark-900/50 dark:text-dark-100/50">ใช้สูงสุด ~{CREDIT_ESTIMATE[currentStep]} เครดิต</span>
          <button
            onclick={handleGenerate}
            disabled={isGenerating}
            class="btn-primary disabled:opacity-50"
          >
            {isGenerating ? '⏳ ระบบอัจฉริยะกำลังคิด...' : '✨ ให้ระบบอัจฉริยะช่วยคิด'}
          </button>
        </div>

        <!-- Output display -->
        {#if getOutput(currentStep)}
          <div class="mt-6 pt-6 border-t border-dark-100 dark:border-dark-700">
            <h3 class="font-semibold mb-4 flex items-center gap-2">
              <span class="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 flex items-center justify-center">✓</span>
              <span class="text-lg">ผลลัพธ์: {STEP_NAMES[currentStep]?.th}</span>
              <button
                onclick={() => {
                  const o = getOutput(currentStep);
                  navigator.clipboard.writeText(JSON.stringify(o, null, 2));
                  alert('คัดลอก JSON แล้ว');
                }}
                class="ml-auto text-xs text-dark-900/60 dark:text-dark-100/60 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1"
                title="คัดลอก JSON"
              >
                📋 Copy JSON
              </button>
            </h3>
            <OutputRenderer step={currentStep} output={getOutput(currentStep)} />
            {#if currentStep === 5}
              <div class="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950/30 p-4">
                <div class="flex-1 min-w-[220px]">
                  <div class="font-semibold text-dark-900 dark:text-dark-50">ส่งปฏิทินนี้เข้า Content Inbox</div>
                  <div class="text-sm text-dark-900/60 dark:text-dark-100/60">แยกโพสต์เป็นงานรายชิ้น เพื่อ approve, schedule และส่งต่อไปสร้างภาพใน Studio</div>
                </div>
                <button onclick={handleMaterializeContent} disabled={isMaterializingContent} class="btn-primary">
                  {isMaterializingContent ? 'กำลังสร้าง...' : 'เปิดใน Inbox'}
                </button>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Next button -->
        {#if getOutput(currentStep) && currentStep < 7}
          <div class="mt-4 text-right">
            <button onclick={() => goToStep(currentStep + 1)} class="btn-secondary">
              ขั้นต่อไป: {STEP_NAMES[currentStep + 1]?.th} →
            </button>
          </div>
        {/if}
      </div>

      <!-- Export panel (sticky) -->
      {#if project.current_step > 1}
        <div class="mt-6 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl p-6 text-white">
          <h3 class="font-semibold mb-1">📄 Export Marketing System</h3>
          <p class="text-sm text-white/80 mb-4">
            Generate จากข้อมูล {project.current_step - 1} ขั้นที่เสร็จแล้ว — เลือก format ที่ต้องการ
          </p>
          <div class="flex flex-wrap gap-2">
            <button onclick={() => handleExport('html')} disabled={isExporting} class="bg-white dark:bg-dark-800 text-primary-700 dark:text-primary-300 font-semibold px-4 py-2.5 rounded-lg hover:bg-white/90 transition disabled:opacity-50 text-sm">
              {isExporting ? '...' : '🖨️ HTML (Print→PDF)'}
            </button>
            <button onclick={() => handleExport('md')} disabled={isExporting} class="bg-white/10 backdrop-blur text-white font-semibold px-4 py-2.5 rounded-lg hover:bg-white/20 transition disabled:opacity-50 text-sm border border-white/20">
              📝 Markdown
            </button>
            <button onclick={() => handleExport('json')} disabled={isExporting} class="bg-white/10 backdrop-blur text-white font-semibold px-4 py-2.5 rounded-lg hover:bg-white/20 transition disabled:opacity-50 text-sm border border-white/20">
              {'{}'} JSON
            </button>
            <button onclick={() => handleExport('csv')} disabled={isExporting} class="bg-white/10 backdrop-blur text-white font-semibold px-4 py-2.5 rounded-lg hover:bg-white/20 transition disabled:opacity-50 text-sm border border-white/20">
              📊 CSV
            </button>
            <button onclick={() => handleExport('doc')} disabled={isExporting} class="bg-white/10 backdrop-blur text-white font-semibold px-4 py-2.5 rounded-lg hover:bg-white/20 transition disabled:opacity-50 text-sm border border-white/20">
              📄 Word (.doc)
            </button>
          </div>
          {#if exportUrl}
            <div class="mt-3 text-sm">
              <a href={exportUrl} target="_blank" class="underline">เปิดลิงก์ Export →</a>
              <span class="ml-3 text-xs opacity-70">💡 CSV → เปิด Google Sheets ได้: <a href="https://sheets.google.com/create" target="_blank" class="underline">sheets.google.com/create</a> แล้ว File > Import</span>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </main>
</div>
