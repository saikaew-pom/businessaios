<script lang="ts">
  /**
   * AI Presentation Builder — 9-step wizard
   * Step 1: Quick Brief (objective, slides, time)
   * Step 2: Audience Profile (style + concerns)
   * Step 3: ATR Canvas (Before/After 4x2)
   * Step 4: Source Content (paste/upload)
   * Step 5: Content Triage (Must/Maybe/Kill)
   * Step 6: Story Outline (framework-specific)
   * Step 7: Slide Blueprint (type, layout, media, chart)
   * Step 8: Speaker Notes
   * Step 9: Export
   */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import ToolLayout from '$lib/ToolLayout.svelte';
  import { user, isAuthed } from '$lib/auth';
  import {
    getPresentationPresets,
    listPresentationProjects,
    createPresentationProject,
    getPresentationProject,
    updatePresentationProject,
    deletePresentationProject,
    generatePresentationStep,
    savePresentationStepInput,
    exportPresentation,
    type PresentationProject,
    type PresentationStep,
  } from '$lib/api';

  // Steps
  import Step1Brief from './steps/Step1Brief.svelte';
  import Step2Audience from './steps/Step2Audience.svelte';
  import Step3ATR from './steps/Step3ATR.svelte';
  import Step4Source from './steps/Step4Source.svelte';
  import Step5Triage from './steps/Step5Triage.svelte';
  import Step6Outline from './steps/Step6Outline.svelte';
  import Step7Blueprint from './steps/Step7Blueprint.svelte';
  import Step8Notes from './steps/Step8Notes.svelte';
  import Step9Export from './steps/Step9Export.svelte';

  // State
  let currentStep = $state(1);
  let project = $state<any>(null);
  let steps = $state<PresentationStep[]>([]);
  let presets = $state<any>(null);
  let projects = $state<PresentationProject[]>([]);
  let showProjectList = $state(true);
  let isLoading = $state(false);
  let isGenerating = $state(false);
  let error = $state('');
  let creditsRemaining = $state(0);
  let lastCreditsUsed = $state(0);

  onMount(async () => {
    const { initAuth } = await import('$lib/auth');
    await initAuth();
    if (!$isAuthed) {
      goto('/login');
      return;
    }
    await loadPresets();
    await loadProjects();
    await loadUserCredits();
  });

  async function loadPresets() {
    try {
      presets = await getPresentationPresets();
    } catch (err: any) {
      error = 'Failed to load presets: ' + err.message;
    }
  }

  async function loadProjects() {
    try {
      const res = await listPresentationProjects('draft');
      projects = res.projects || [];
    } catch (err) {
      // silent
    }
  }

  async function loadUserCredits() {
    try {
      const res = await fetch('/api/me/credits', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        creditsRemaining = data.credits ?? 0;
      }
    } catch {}
  }

  async function handleCreate(data: { title: string; objective: 'informative' | 'persuasive' | 'story'; target_slides: number; time_minutes: number; color_theme: string; language: 'th' | 'en' }) {
    isLoading = true;
    error = '';
    try {
      const res = await createPresentationProject(data);
      await openProject(res.project.id);
    } catch (err: any) {
      error = err.message || 'Failed to create';
    } finally {
      isLoading = false;
    }
  }

  async function openProject(id: string) {
    isLoading = true;
    error = '';
    try {
      const res = await getPresentationProject(id);
      project = res.project;
      steps = res.steps || [];
      currentStep = project.current_step || 1;
      showProjectList = false;
    } catch (err: any) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('ลบ presentation นี้?')) return;
    try {
      await deletePresentationProject(id);
      await loadProjects();
    } catch (err: any) {
      error = err.message;
    }
  }

  async function goToStep(step: number) {
    if (step < 1 || step > 9) return;
    currentStep = step;
    await updatePresentationProject(project.id, {});
  }

  async function handleStepGenerate(step: number, input: any, customSystemPrompt?: string) {
    isGenerating = true;
    error = '';
    try {
      const res = await generatePresentationStep(project.id, step, input, customSystemPrompt);
      // Reload project to get latest step data
      const updated = await getPresentationProject(project.id);
      steps = updated.steps || [];
      // Move to next step
      if (step < 9) {
        currentStep = step + 1;
      }
      // Update credits
      if (res.meta?.credits_used) {
        lastCreditsUsed = res.meta.credits_used;
        creditsRemaining = res.meta.credits_remaining ?? creditsRemaining;
      }
    } catch (err: any) {
      error = err.message || 'AI error';
    } finally {
      isGenerating = false;
    }
  }

  async function handleStepSave(step: number, data: { input?: any; output?: any }) {
    isLoading = true;
    try {
      await savePresentationStepInput(project.id, step, data);
      const updated = await getPresentationProject(project.id);
      steps = updated.steps || [];
    } catch (err: any) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  }

  async function handleExport(format: 'html' | 'md' | 'json' | 'csv' | 'pptx' | 'gsheet') {
    isLoading = true;
    error = '';
    try {
      const res = await exportPresentation(project.id, format);
      // Open in new tab or trigger download
      if (format === 'gsheet') {
        // Special: gsheet returns JSON with CSV + URL
        const exportUrl = `${PUBLIC_API_URL}/api/presentation/exports/${res.export_id}`;
        const r = await fetch(exportUrl, { credentials: 'include' });
        const data = await r.json();
        // Trigger CSV download
        const blob = new Blob([data.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.title}.csv`;
        a.click();
        // Open Google Sheets
        window.open(data.google_sheets_url, '_blank');
        alert('ดาวน์โหลด CSV แล้ว! ใน Google Sheets: File > Import > Upload > เลือกไฟล์ CSV ที่ดาวน์โหลด');
      } else {
        const downloadUrl = `${PUBLIC_API_URL}/api/presentation/exports/${res.export_id}`;
        if (format === 'html') {
          window.open(downloadUrl, '_blank');
        } else {
          // Force download
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `${project.title}.${format}`;
          a.click();
        }
      }
    } catch (err: any) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  }

  function getStepData(stepNumber: number): any {
    const s = steps.find((x) => x.step_number === stepNumber);
    if (!s) return null;
    // Prefer output_json, but fall back to input_json (for non-AI steps like 1, 4)
    const raw = s.output_json || s.input_json;
    if (!raw) return null;
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
  }

  function getStepInput(stepNumber: number): any {
    // For steps with editable input (step 1, 4)
    const s = steps.find((x) => x.step_number === stepNumber);
    if (!s) return null;
    try {
      const out = typeof s.output_json === 'string' ? JSON.parse(s.output_json) : s.output_json;
      return out;
    } catch {
      return null;
    }
  }

  function getCustomPrompt(stepNumber: number): string | undefined {
    return steps.find((x) => x.step_number === stepNumber)?.custom_system_prompt || undefined;
  }

  import { PUBLIC_API_URL } from '$env/static/public';
</script>

<ToolLayout
  title="AI Presentation Builder"
  subtitle="สร้าง presentation มืออาชีพ 9 steps — ใช้ framework จาก McKinsey, Dan Roam, Phil Waknell"
  icon="🎤"
  color="purple"
>
  {#if showProjectList}
    <!-- Project list / create new -->
    <div class="space-y-6">
      <!-- Credits bar -->
      <div class="flex items-center justify-between bg-primary-50 border border-primary-200 rounded-xl px-4 py-3">
        <div class="text-sm">
          <span class="text-dark-900/60">เครดิตคงเหลือ:</span>
          <span class="font-bold text-primary-700 ml-1">{creditsRemaining.toLocaleString()}</span>
        </div>
        <a href="/pricing" class="text-xs text-primary-600 hover:text-primary-700">เติมเครดิต →</a>
      </div>

      <!-- New project form -->
      <div class="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-2xl p-6">
        <h2 class="font-bold text-lg mb-4">🚀 สร้าง Presentation ใหม่</h2>
        <form
          onsubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const fd = new FormData(form);
            const data = {
              title: fd.get('title') as string,
              objective: fd.get('objective') as any,
              target_slides: parseInt(fd.get('target_slides') as string) || 10,
              time_minutes: parseInt(fd.get('time_minutes') as string) || 15,
              color_theme: fd.get('color_theme') as string,
              language: (fd.get('language') as string) || 'th',
            };
            if (data.title.trim()) handleCreate(data);
          }}
          class="space-y-3"
        >
          <div>
            <label class="block text-sm font-medium text-dark-700 mb-1">หัวข้อ Presentation *</label>
            <input
              name="title"
              type="text"
              required
              placeholder="เช่น Q3 Marketing Plan, Series A Pitch, Brand Story"
              class="w-full px-4 py-2.5 border border-dark-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-dark-700 mb-1">Objective *</label>
              <select name="objective" required class="w-full px-4 py-2.5 border border-dark-200 rounded-lg">
                <option value="informative">📊 Informative (รายงาน/อธิบาย)</option>
                <option value="persuasive">🎯 Persuasive (Pitch/โน้มน้าว)</option>
                <option value="story">🎤 Story (Keynote/TED Talk)</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-dark-700 mb-1">Theme</label>
              <select name="color_theme" class="w-full px-4 py-2.5 border border-dark-200 rounded-lg">
                {#if presets}
                  {#each presets.color_themes as theme}
                    <option value={theme.id}>{theme.icon || ''} {theme.name}</option>
                  {/each}
                {/if}
              </select>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-sm font-medium text-dark-700 mb-1">จำนวน Slides</label>
              <input name="target_slides" type="number" value="10" min="5" max="25" class="w-full px-4 py-2.5 border border-dark-200 rounded-lg" />
            </div>
            <div>
              <label class="block text-sm font-medium text-dark-700 mb-1">เวลา (นาที)</label>
              <input name="time_minutes" type="number" value="15" min="3" max="60" class="w-full px-4 py-2.5 border border-dark-200 rounded-lg" />
            </div>
            <div>
              <label class="block text-sm font-medium text-dark-700 mb-1">ภาษา</label>
              <select name="language" class="w-full px-4 py-2.5 border border-dark-200 rounded-lg">
                <option value="th">ไทย</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            class="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-dark-300 text-white font-semibold py-3 rounded-lg transition"
          >
            {isLoading ? 'กำลังสร้าง...' : '✨ สร้าง Presentation'}
          </button>
        </form>
      </div>

      <!-- Existing projects -->
      {#if projects.length > 0}
        <div>
          <h3 class="font-semibold mb-3">📁 Presentation ของคุณ ({projects.length})</h3>
          <div class="space-y-2">
            {#each projects as p}
              <div class="bg-white border border-dark-200 rounded-xl p-4 hover:shadow-md transition">
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <div class="font-semibold text-dark-900">{p.title}</div>
                    <div class="text-sm text-dark-900/60 mt-1">
                      {p.objective === 'informative' ? '📊 Informative' : p.objective === 'persuasive' ? '🎯 Persuasive' : '🎤 Story'}
                      · {p.target_slides} slides
                      · {p.time_minutes} นาที
                      · step {p.current_step}/9
                      · {p.steps_completed || 0} done
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      onclick={() => openProject(p.id)}
                      class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg"
                    >
                      เปิด
                    </button>
                    <button
                      onclick={() => handleDelete(p.id)}
                      class="px-3 py-2 text-dark-900/50 hover:text-red-600 text-sm"
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if error}
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      {/if}
    </div>
  {:else}
    <!-- Wizard -->
    {#if project}
      <!-- Step indicator -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <div>
            <div class="text-xs text-dark-900/50">Project: <span class="font-medium text-dark-900">{project.title}</span></div>
            <div class="text-xs text-dark-900/50 mt-0.5">
              Framework: <span class="font-medium text-primary-700">{project.framework_variant || (project.objective === 'informative' ? 'SCQA + Minto' : project.objective === 'story' ? 'Pop-Up Pitch' : '5M Mission')}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              onclick={() => { showProjectList = true; project = null; loadProjects(); }}
              class="text-sm text-dark-900/60 hover:text-dark-900"
            >
              ← กลับ
            </button>
            <div class="text-sm font-medium text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg">
              เครดิต: {creditsRemaining.toLocaleString()}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1">
          {#each [1,2,3,4,5,6,7,8,9] as s}
            <button
              onclick={() => goToStep(s)}
              class="flex-1 text-xs py-2 rounded-md transition {s === currentStep ? 'bg-primary-600 text-white font-bold' : getStepData(s) ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-dark-100 text-dark-900/50 hover:bg-dark-200'}"
              title={presets?.step_names?.[s] || `Step ${s}`}
            >
              {getStepData(s) ? '✓' : s}
            </button>
          {/each}
        </div>
        <div class="text-xs text-dark-900/50 mt-2">Step {currentStep}: {presets?.step_names?.[currentStep] || '...'}</div>
      </div>

      {#if error}
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
      {/if}

      <!-- Step content -->
      <div class="min-h-[400px]">
        {#if currentStep === 1}
          <Step1Brief
            project={project}
            initialData={getStepData(1)}
            presets={presets}
            onGenerate={(input) => handleStepGenerate(1, input)}
            onUpdate={(data) => updatePresentationProject(project.id, data)}
            isGenerating={isGenerating}
          />
        {:else if currentStep === 2}
          <Step2Audience
            project={project}
            initialData={getStepData(2)}
            presets={presets}
            onGenerate={(input) => handleStepGenerate(2, input)}
            isGenerating={isGenerating}
          />
        {:else if currentStep === 3}
          <Step3ATR
            project={project}
            initialData={getStepData(3)}
            presets={presets}
            step2Data={getStepData(2)}
            onGenerate={(input) => handleStepGenerate(3, input)}
            isGenerating={isGenerating}
          />
        {:else if currentStep === 4}
          <Step4Source
            project={project}
            initialData={getStepData(4)}
            step3Data={getStepData(3)}
            onSave={(input) => handleStepSave(4, { input })}
            onContinue={() => goToStep(5)}
            isSaving={isLoading}
          />
        {:else if currentStep === 5}
          <Step5Triage
            project={project}
            initialData={getStepData(5)}
            sourceData={getStepData(4)}
            step3Data={getStepData(3)}
            presets={presets}
            onGenerate={(input) => handleStepGenerate(5, input)}
            isGenerating={isGenerating}
          />
        {:else if currentStep === 6}
          <Step6Outline
            project={project}
            initialData={getStepData(6)}
            step3Data={getStepData(3)}
            step5Data={getStepData(5)}
            presets={presets}
            onGenerate={(input, customPrompt) => handleStepGenerate(6, input, customPrompt)}
            isGenerating={isGenerating}
          />
        {:else if currentStep === 7}
          <Step7Blueprint
            project={project}
            initialData={getStepData(7)}
            step6Data={getStepData(6)}
            presets={presets}
            customSystemPrompt={getCustomPrompt(7)}
            onGenerate={(input, customPrompt) => handleStepGenerate(7, input, customPrompt)}
            isGenerating={isGenerating}
          />
        {:else if currentStep === 8}
          <Step8Notes
            project={project}
            initialData={getStepData(8)}
            step6Data={getStepData(6)}
            step7Data={getStepData(7)}
            step2Data={getStepData(2)}
            onGenerate={(input) => handleStepGenerate(8, input)}
            isGenerating={isGenerating}
          />
        {:else if currentStep === 9}
          <Step9Export
            project={project}
            step6Data={getStepData(6)}
            step7Data={getStepData(7)}
            step8Data={getStepData(8)}
            onExport={handleExport}
            isExporting={isLoading}
          />
        {/if}
      </div>
    {/if}
  {/if}
</ToolLayout>
