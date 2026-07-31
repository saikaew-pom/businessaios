<script lang="ts">
  /**
   * Step 7: Slide Blueprint
   * For each slide: pick type (Flat/Story/Visual), layout, media, chart
   * User can EDIT system prompt here
   */
  let { project, initialData, step6Data, presets, customSystemPrompt: initialCustomPrompt, onGenerate, isGenerating }: {
    project: any;
    initialData: any;
    step6Data: any;
    presets: any;
    customSystemPrompt?: string;
    onGenerate: (input: any, customPrompt?: string) => void;
    isGenerating: boolean;
  } = $props();

  let customSystemPrompt = $state(initialCustomPrompt || '');
  let showCustomPrompt = $state(false);

  let slides = $derived<any[]>(initialData?.slides || []);
  let expandedSlide = $state<number | null>(null);

  function getTypeIcon(type: string) {
    if (type === 'title') return '🎬';
    if (type === 'visual') return '🖼️';
    if (type === 'flat') return '📄';
    return '📖'; // story default
  }

  function getTypeName(type: string) {
    const found = presets?.slide_types?.find((t: any) => t.id === type);
    return found?.name || type;
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    onGenerate({
      framework_variant: project?.framework_variant,
      title: project?.title,
      color_theme: project?.color_theme,
      outline: step6Data,
    }, customSystemPrompt || undefined);
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold mb-2">🎨 Slide Blueprint</h2>
    <p class="text-sm text-dark-900/60 dark:text-dark-100/60">ระบบอัจฉริยะ จะออกแบบ slide แต่ละหน้า — เลือก type, layout, chart, media</p>
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
        <label class="block text-xs font-medium text-dark-700 dark:text-dark-200 mb-1">Custom System Prompt</label>
        <textarea
          bind:value={customSystemPrompt}
          rows="6"
          placeholder="เพิ่มคำสั่งพิเศษ เช่น: ใช้สีโทนอบอุ่น, ทุก slide ต้องมี icon, ห้ามใช้ Visual type, เน้น infographic, ..."
          class="w-full px-3 py-2 text-xs border border-dark-200 dark:border-dark-600 rounded-lg font-mono"
        ></textarea>
        <div class="text-xs text-dark-900/50 dark:text-dark-100/50 mt-1">Default prompt: ทุก slide มี type (flat/story/visual/title) + layout (quadrant/3column/chart_text/full_bleed/comparison/title) + media_suggestion</div>
      </div>
    {/if}

    <button
      type="submit"
      disabled={isGenerating}
      class="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-dark-300 text-white font-semibold py-3 rounded-lg transition"
    >
      {isGenerating ? '⚙️ ระบบอัจฉริยะ กำลังออกแบบ Slide Blueprint...' : '✨ Generate Blueprint → Step 8'}
    </button>
  </form>

  {#if slides.length > 0}
    <div class="mt-8 space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold">🎨 Blueprint ({slides.length} slides)</h3>
        <button
          type="button"
          onclick={handleSubmit}
          disabled={isGenerating}
          class="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium"
        >
          🔄 Regenerate
        </button>
      </div>

      {#each slides as slide}
        <div class="border border-dark-200 dark:border-dark-600 rounded-xl overflow-hidden hover:border-primary-300 transition">
          <button
            type="button"
            onclick={() => (expandedSlide = expandedSlide === slide.slide_number ? null : slide.slide_number)}
            class="w-full px-4 py-3 flex items-center justify-between text-left"
          >
            <div class="flex items-center gap-3 flex-1">
              <span class="text-2xl">{getTypeIcon(slide.type)}</span>
              <div>
                <div class="text-xs text-primary-600 dark:text-primary-400 font-medium">
                  Slide {slide.slide_number} · {getTypeName(slide.type)} · {slide.layout}
                </div>
                <div class="font-semibold text-dark-900 dark:text-dark-50 mt-0.5">{slide.title}</div>
              </div>
            </div>
            <div class="text-xs text-dark-900/50 dark:text-dark-100/50">{expandedSlide === slide.slide_number ? '▼' : '▶'}</div>
          </button>

          {#if expandedSlide === slide.slide_number}
            <div class="border-t border-dark-200 dark:border-dark-600 p-4 space-y-3 bg-dark-50 dark:bg-dark-900">
              {#if slide.subtitle}
                <div class="text-sm text-dark-900/70 dark:text-dark-100/70 italic">"{slide.subtitle}"</div>
              {/if}

              {#if slide.bullet_points?.length || slide.key_points?.length}
                <ul class="text-sm space-y-1">
                  {#each (slide.bullet_points || slide.key_points || []) as point}
                    <li class="flex gap-2"><span class="text-primary-500">•</span> {point}</li>
                  {/each}
                </ul>
              {/if}

              {#if slide.data_table}
                <div class="bg-white dark:bg-dark-800 rounded-lg p-2 text-xs overflow-x-auto">
                  <table class="w-full">
                    <thead><tr>{#each slide.data_table.headers as h}<th class="text-left p-1 font-semibold">{h}</th>{/each}</tr></thead>
                    <tbody>{#each slide.data_table.rows as row}<tr>{#each row as cell}<td class="p-1 border-t">{cell}</td>{/each}</tr>{/each}</tbody>
                  </table>
                </div>
              {/if}

              {#if slide.chart}
                <div class="bg-white dark:bg-dark-800 rounded-lg p-3 text-sm">
                  <div class="font-medium text-dark-900 dark:text-dark-50">📊 Chart: {slide.chart.type}</div>
                  {#if slide.chart.highlight}
                    <div class="text-xs text-dark-900/60 dark:text-dark-100/60 mt-1">Highlight: {slide.chart.highlight}</div>
                  {/if}
                </div>
              {/if}

              {#if slide.media_suggestion}
                <div class="bg-white dark:bg-dark-800 rounded-lg p-3 text-sm">
                  <div class="font-medium text-dark-900 dark:text-dark-50">🎨 Media: {slide.media_suggestion.kind}</div>
                  {#if slide.media_suggestion.description}
                    <div class="text-xs text-dark-900/60 dark:text-dark-100/60 mt-1">{slide.media_suggestion.description}</div>
                  {/if}
                  {#if slide.media_suggestion.image_prompt}
                    <div class="text-xs font-mono bg-dark-100 dark:bg-dark-700 p-2 rounded mt-1 text-dark-900/70 dark:text-dark-100/70">
                      "{slide.media_suggestion.image_prompt}"
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
