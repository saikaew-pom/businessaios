<script lang="ts">
  /**
   * Step 7: Slide Blueprint
   * For each slide: pick type (Flat/Story/Visual), layout, media, chart
   * User can EDIT system prompt here
   */
  import { onDestroy } from 'svelte';
  import { previewMediaPricing, createMediaGeneration, getMediaGeneration, getMediaAssetContentUrl } from '$lib/api';

  let { project, initialData, step6Data, presets, customSystemPrompt: initialCustomPrompt, onGenerate, isGenerating, onSave, onCreditsUpdated }: {
    project: any;
    initialData: any;
    step6Data: any;
    presets: any;
    customSystemPrompt?: string;
    onGenerate: (input: any, customPrompt?: string) => void;
    isGenerating: boolean;
    onSave?: (output: any) => Promise<any>;
    onCreditsUpdated?: (remaining: number) => void;
  } = $props();

  const IMAGE_MODEL_ID = 'minimax-image-01-t2i';

  let customSystemPrompt = $state(initialCustomPrompt || '');
  let showCustomPrompt = $state(false);

  let slides = $derived<any[]>(initialData?.slides || []);
  let expandedSlide = $state<number | null>(null);

  // Per-slide AI image generation status — the blueprint slides array itself
  // is a read-only $derived from props, so in-flight generation status lives
  // here instead, keyed by slide_number.
  let imageGenState = $state<Record<number, { status: string; assetId?: string; error?: string }>>({});
  const pollTimers: Record<number, ReturnType<typeof setInterval>> = {};

  // Resume polling for any slide whose blueprint already references a
  // generation (e.g. after a page reload mid-generation) that we haven't
  // started tracking locally yet.
  $effect(() => {
    for (const slide of slides) {
      const generationId = slide?.media_suggestion?.generation_id;
      if (generationId && !imageGenState[slide.slide_number]) {
        imageGenState = { ...imageGenState, [slide.slide_number]: { status: 'checking' } };
        pollImageGeneration(slide.slide_number, generationId);
      }
    }
  });

  onDestroy(() => {
    for (const timer of Object.values(pollTimers)) clearInterval(timer);
  });

  async function handleGenerateImage(slide: any) {
    const slideNum = slide.slide_number;
    const current = imageGenState[slideNum]?.status;
    if (current && !['failed'].includes(current)) return;
    // Lock synchronously, in the same tick as the guard above and before any
    // `await` — a double-click (or any re-invocation while the quote fetch
    // and confirm() dialog are still in flight) must see this lock and bail
    // out at the guard, exactly like studio/+page.svelte's handleGenerate()
    // sets `isGenerating = true` synchronously before its own first await.
    // Without this, two clicks landing inside that window both pass the
    // guard (imageGenState[slideNum] is still unset for both), both show a
    // confirm() dialog, and — if confirmed twice — both call
    // createMediaGeneration with their own fresh crypto.randomUUID(), which
    // does NOT dedupe them (each is a distinct idempotency key by design),
    // burning real credits twice for one intended click.
    imageGenState = { ...imageGenState, [slideNum]: { status: 'checking' } };
    try {
      const quote = await previewMediaPricing({ model_id: IMAGE_MODEL_ID, options: { aspect_ratio: '16:9' } });
      const confirmed = confirm(`สร้างภาพจริงด้วย AI ใช้ ${quote.credits} เครดิต ต้องการดำเนินการต่อหรือไม่?`);
      if (!confirmed) {
        // Release the lock — no generation was created, so the button must
        // reappear instead of getting stuck showing a loading state forever.
        const { [slideNum]: _dropped, ...rest } = imageGenState;
        imageGenState = rest;
        return;
      }
      imageGenState = { ...imageGenState, [slideNum]: { status: 'queued' } };
      const res = await createMediaGeneration({
        model_id: IMAGE_MODEL_ID,
        prompt: slide.media_suggestion.image_prompt,
        options: { aspect_ratio: '16:9' },
        references: [],
        quote_id: quote.id,
        expected_pricing_version: quote.pricing_version,
      }, crypto.randomUUID());
      if (res.credits_remaining !== undefined) onCreditsUpdated?.(res.credits_remaining);
      await persistGenerationId(slideNum, res.generation.id);
      pollImageGeneration(slideNum, res.generation.id);
    } catch (err: any) {
      imageGenState = { ...imageGenState, [slideNum]: { status: 'failed', error: err.message || 'สร้างภาพไม่สำเร็จ' } };
    }
  }

  async function persistGenerationId(slideNum: number, generationId: string) {
    if (!onSave) return;
    const updatedSlides = slides.map((s) => s.slide_number === slideNum
      ? { ...s, media_suggestion: { ...s.media_suggestion, generation_id: generationId } }
      : s);
    await onSave({ ...initialData, slides: updatedSlides });
  }

  function pollImageGeneration(slideNum: number, generationId: string) {
    stopPolling(slideNum);
    const tick = async () => {
      try {
        const gen = await getMediaGeneration(generationId);
        if (gen.status === 'completed') {
          imageGenState = { ...imageGenState, [slideNum]: { status: 'completed', assetId: gen.outputs?.[0]?.id } };
          stopPolling(slideNum);
        } else if (['failed', 'cancelled'].includes(gen.status)) {
          imageGenState = { ...imageGenState, [slideNum]: { status: 'failed', error: gen.error_message || 'สร้างภาพไม่สำเร็จ' } };
          stopPolling(slideNum);
        } else {
          imageGenState = { ...imageGenState, [slideNum]: { status: gen.status } };
        }
      } catch (err: any) {
        imageGenState = { ...imageGenState, [slideNum]: { status: 'failed', error: err.message || 'สร้างภาพไม่สำเร็จ' } };
        stopPolling(slideNum);
      }
    };
    pollTimers[slideNum] = setInterval(tick, 2500);
    void tick();
  }

  function stopPolling(slideNum: number) {
    if (pollTimers[slideNum]) {
      clearInterval(pollTimers[slideNum]);
      delete pollTimers[slideNum];
    }
  }

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

                    {#if imageGenState[slide.slide_number]?.status === 'completed' && imageGenState[slide.slide_number]?.assetId}
                      <img
                        src={getMediaAssetContentUrl(imageGenState[slide.slide_number].assetId!)}
                        alt={slide.media_suggestion.description || 'AI generated image'}
                        class="mt-2 w-full max-w-xs rounded-lg border border-dark-200 dark:border-dark-600"
                      />
                    {:else if ['queued', 'submitting', 'processing', 'delivery_pending', 'checking'].includes(imageGenState[slide.slide_number]?.status || '')}
                      <div class="mt-2 text-xs text-primary-600 dark:text-primary-400">⏳ กำลังสร้างภาพ... ({imageGenState[slide.slide_number].status})</div>
                    {:else}
                      <button
                        type="button"
                        onclick={() => handleGenerateImage(slide)}
                        class="mt-2 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700"
                      >
                        🎨 สร้างภาพจริงด้วย AI
                      </button>
                      {#if imageGenState[slide.slide_number]?.status === 'failed'}
                        <div class="mt-1 text-xs text-red-600 dark:text-red-400">{imageGenState[slide.slide_number].error}</div>
                      {/if}
                    {/if}
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
