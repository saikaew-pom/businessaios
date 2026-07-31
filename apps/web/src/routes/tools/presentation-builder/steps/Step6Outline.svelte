<script lang="ts">
  /**
   * Step 6: Story Outline
   * Smart Engine generates slide-by-slide outline using framework
   * Shows framework structure
   */
  let { project, initialData, step3Data, step5Data, presets, onGenerate, isGenerating }: {
    project: any;
    initialData: any;
    step3Data: any;
    step5Data: any;
    presets: any;
    onGenerate: (input: any, customPrompt?: string) => void;
    isGenerating: boolean;
  } = $props();

  let customSystemPrompt = $state('');
  let showCustomPrompt = $state(false);

  let frameworkName = $derived(() => {
    if (project?.objective === 'informative') return 'SCQA + Minto Pyramid';
    if (project?.objective === 'story') return 'Pop-Up Pitch (10 slides fixed)';
    return '5M Mission Flow';
  });

  let outline = $derived<any[]>(initialData?.outline || []);
  let totalDuration = $derived(outline.reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0));

  function handleSubmit(e: Event) {
    e.preventDefault();
    onGenerate({
      framework_variant: project?.framework_variant,
      title: project?.title,
      objective: project?.objective,
      target_slides: project?.target_slides,
      time_minutes: project?.time_minutes,
      audience_persona: step3Data,
      atr: step3Data,
      must_have: step5Data?.must_have,
      maybe: step5Data?.maybe,
    }, customSystemPrompt || undefined);
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold mb-2">📖 Story Outline</h2>
    <p class="text-sm text-dark-900/60 dark:text-dark-100/60">ระบบอัจฉริยะ จะสร้าง outline {project?.target_slides} slides ตาม <strong>{frameworkName()}</strong></p>
  </div>

  <div class="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg p-3 text-sm text-purple-800 dark:text-purple-300">
    🎯 Framework: <strong>{frameworkName()}</strong>
    <div class="text-xs mt-1">
      {#if project?.objective === 'informative'}
        SCQA = Situation, Complication, Question, Answer → Minto Pyramid (Key Message + 3-5 Supporting Arguments + Data)
      {:else if project?.objective === 'story'}
        10 slides ตายตัว: Title, Common Ground, Coming Problem, Emotional Win, False Hope, Audacious Reality, We Can Do This, Call to Action, Early Benefits, The Long Win
      {:else}
        5M = Message, Matter, Momentum, Mindshift, Move (Persuasive)
      {/if}
    </div>
  </div>

  <form onsubmit={handleSubmit} class="space-y-4">
    <button
      type="button"
      onclick={() => (showCustomPrompt = !showCustomPrompt)}
      class="text-sm text-dark-900/60 dark:text-dark-100/60 hover:text-primary-600"
    >
      {showCustomPrompt ? '▼' : '▶'} แก้ System Prompt (ขั้นสูง)
    </button>

    {#if showCustomPrompt}
      <div>
        <label class="block text-xs font-medium text-dark-700 dark:text-dark-200 mb-1">Custom System Prompt (จะถูก merge กับ default)</label>
        <textarea
          bind:value={customSystemPrompt}
          rows="4"
          placeholder="เพิ่มคำสั่งพิเศษ เช่น: ใช้ภาษากันเอง, เน้น case study, ห้ามใช้ bullet points, ..."
          class="w-full px-3 py-2 text-xs border border-dark-200 dark:border-dark-600 rounded-lg font-mono"
        ></textarea>
      </div>
    {/if}

    <button
      type="submit"
      disabled={isGenerating}
      class="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-dark-300 text-white font-semibold py-3 rounded-lg transition"
    >
      {isGenerating ? '⚙️ ระบบอัจฉริยะ กำลังสร้าง Outline...' : '✨ Generate Outline → Step 7'}
    </button>
  </form>

  {#if outline.length > 0}
    <div class="mt-8 space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold">📋 Outline ({outline.length} slides · ~{Math.round(totalDuration / 60)} นาที)</h3>
        <button
          type="button"
          onclick={handleSubmit}
          disabled={isGenerating}
          class="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium"
        >
          🔄 Regenerate
        </button>
      </div>

      {#each outline as slide}
        <div class="border border-dark-200 dark:border-dark-600 rounded-xl p-4 hover:border-primary-300 transition">
          <div class="flex items-start justify-between mb-2">
            <div>
              <div class="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase">
                Slide {slide.slide_number} · {slide.section_label || slide.section || 'slide'}
              </div>
              <div class="font-semibold text-dark-900 dark:text-dark-50 mt-1">{slide.title}</div>
            </div>
            <div class="text-xs text-dark-900/50 dark:text-dark-100/50">{slide.duration_seconds}s</div>
          </div>

          {#if slide.subtitle}
            <div class="text-sm text-dark-900/70 dark:text-dark-100/70 italic mb-2">{slide.subtitle}</div>
          {/if}

          {#if slide.key_message}
            <div class="bg-primary-50 dark:bg-primary-900/40 border-l-4 border-primary-500 px-3 py-2 text-sm text-primary-900 dark:text-primary-200 mb-2 rounded">
              🎯 {slide.key_message}
            </div>
          {/if}

          {#if slide.key_points?.length || slide.bullet_points?.length}
            <ul class="text-sm space-y-1 mb-2">
              {#each (slide.bullet_points || slide.key_points || []) as point}
                <li class="flex gap-2"><span class="text-primary-500">•</span> {point}</li>
              {/each}
            </ul>
          {/if}

          {#if slide.supporting_data}
            <div class="text-xs text-dark-900/60 dark:text-dark-100/60 mt-1">📊 {slide.supporting_data}</div>
          {/if}

          {#if slide.call_to_action}
            <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-2 rounded text-sm font-medium text-amber-900 dark:text-amber-200 mt-2">
              📣 {slide.call_to_action}
            </div>
          {/if}

          {#if slide.emotional_trigger || slide.audience_emotion_target}
            <div class="text-xs text-dark-900/50 dark:text-dark-100/50 mt-2">
              {slide.emotional_trigger ? `💫 ${slide.emotional_trigger}` : ''}
              {slide.audience_emotion_target ? ` · 🎭 ${slide.audience_emotion_target}` : ''}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
