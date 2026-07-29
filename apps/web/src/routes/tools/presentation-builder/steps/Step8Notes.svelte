<script lang="ts">
  /**
   * Step 8: Speaker Notes
   * Per-slide script 30-90 sec
   * Handles audience concerns
   */
  let { project, initialData, step6Data, step7Data, step2Data, onGenerate, isGenerating }: {
    project: any;
    initialData: any;
    step6Data: any;
    step7Data: any;
    step2Data: any;
    onGenerate: (input: any) => void;
    isGenerating: boolean;
  } = $props();

  let slideNotes = $derived<any[]>(initialData?.slide_notes || []);
  let globalNotes = $derived(initialData?.global_notes || {});

  function handleSubmit(e: Event) {
    e.preventDefault();
    onGenerate({
      framework_variant: project?.framework_variant,
      title: project?.title,
      audience_persona: step2Data,
      concerns_responses: step2Data?.concerns_responses,
      outline: step6Data,
      blueprint: step7Data,
    });
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold mb-2">🎤 Speaker Notes</h2>
    <p class="text-sm text-dark-900/60">ระบบอัจฉริยะ จะเขียน script 30-90 วินาทีต่อ slide + handle audience concerns</p>
  </div>

  <form onsubmit={handleSubmit} class="space-y-3">
    <button
      type="submit"
      disabled={isGenerating}
      class="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-dark-300 text-white font-semibold py-3 rounded-lg transition"
    >
      {isGenerating ? '⚙️ ระบบอัจฉริยะ กำลังเขียน Speaker Notes...' : '✨ Generate Notes → Step 9 (Export)'}
    </button>
  </form>

  {#if globalNotes?.opening_hook}
    <div class="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div class="text-xs font-semibold text-amber-800 uppercase mb-2">🎬 Opening Hook</div>
      <div class="text-sm text-amber-900 italic">"{globalNotes.opening_hook}"</div>
    </div>
  {/if}

  {#if globalNotes?.transition_phrases?.length}
    <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <div class="text-xs font-semibold text-blue-800 uppercase mb-2">🔗 Transition Phrases</div>
      <div class="flex flex-wrap gap-2">
        {#each globalNotes.transition_phrases as phrase}
          <span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{phrase}</span>
        {/each}
      </div>
    </div>
  {/if}

  {#if slideNotes.length > 0}
    <div class="mt-8 space-y-3">
      <h3 class="font-semibold">🎤 Notes ({slideNotes.length} slides)</h3>

      {#each slideNotes as note}
        <div class="border border-dark-200 rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <div class="text-xs font-semibold text-primary-600 uppercase">Slide {note.slide_number}</div>
            <div class="flex items-center gap-2 text-xs">
              <span class="px-2 py-0.5 rounded bg-dark-100">{note.energy_level}</span>
              <span class="px-2 py-0.5 rounded bg-dark-100">{note.pacing}</span>
              {#if note.script}
                <span class="px-2 py-0.5 rounded bg-green-100 text-green-700">~{Math.max(1, Math.round(note.script.length / 200))} นาที</span>
              {/if}
            </div>
          </div>

          {#if note.script}
            <div class="bg-amber-50 border-l-4 border-amber-500 px-3 py-2 text-sm text-amber-900 rounded mb-2">
              {note.script}
            </div>
          {/if}

          {#if note.talking_points?.length}
            <div class="text-xs text-dark-900/60 mb-1">📌 Key points:</div>
            <ul class="text-sm space-y-0.5 mb-2">
              {#each note.talking_points as tp}
                <li>• {tp}</li>
              {/each}
            </ul>
          {/if}

          {#if note.transition_to_next}
            <div class="text-xs text-primary-700 mt-2">→ "{note.transition_to_next}"</div>
          {/if}

          {#if note.concerns_addressed?.length}
            <div class="flex flex-wrap gap-1 mt-2">
              {#each note.concerns_addressed as c}
                <span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">✓ {c}</span>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  {#if globalNotes?.closing_line}
    <div class="bg-green-50 border border-green-200 rounded-xl p-4">
      <div class="text-xs font-semibold text-green-800 uppercase mb-2">🎬 Closing Line</div>
      <div class="text-sm text-green-900 italic">"{globalNotes.closing_line}"</div>
    </div>
  {/if}
</div>
