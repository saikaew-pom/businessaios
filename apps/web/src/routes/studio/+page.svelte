<script lang="ts">
  import { goto } from '$app/navigation';
  import { onDestroy, onMount } from 'svelte';
  import {
    cancelMediaGeneration,
    createMediaGeneration,
    favoriteMediaAsset,
    fulfillCreativeRequest,
    getMediaAssetContentUrl,
    getMediaGeneration,
    listMediaAssets,
    listMediaModels,
    previewMediaPricing,
    uploadMediaAsset,
    validateMediaReferences,
    type MediaAsset,
    type MediaGeneration,
    type MediaModel,
    type MediaPricingQuote,
    type MediaReferenceInput,
  } from '$lib/api';
  import { initAuth, isAuthed } from '$lib/auth';
  import { fetchConfig } from '$lib/config';
  import ApplyTemplateModal from './ApplyTemplateModal.svelte';

  type UploadState = { name: string; status: 'uploading' | 'done' | 'failed'; message?: string };

  let isLoading = true;
  let isFeatureEnabled = false;
  let isCompositionEnabled = false;
  let templateModalAssetId: string | null = null;
  let error = '';
  let notice = '';
  let models: MediaModel[] = [];
  let assets: MediaAsset[] = [];
  let generations: MediaGeneration[] = [];
  let sessionAssetIds: string[] = [];
  let sessionGenerationIds: string[] = [];
  let selectedModelId = '';
  let prompt = '';
  let aspectRatio = '1:1';
  let numImages = 1;
  let responseFormat = 'url';
  let promptOptimizer = true;
  let references: MediaReferenceInput[] = [];
  let quote: MediaPricingQuote | null = null;
  let validationWarnings: string[] = [];
  let activeGeneration: MediaGeneration | null = null;
  let isQuoting = false;
  let isGenerating = false;
  let isUploading = false;
  let uploadStates: UploadState[] = [];
  let assetType = 'image';
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let promptTextarea: HTMLTextAreaElement | null = null;
  let mentionQuery: string | null = null;
  let mentionMatches: MediaAsset[] = [];
  let mentionActiveIndex = 0;
  // Set when this generation was launched from a content item's "Create
  // Creative" button (Works/Inbox) — on completion, the first output gets
  // auto-attached back to that content item so the user never has to
  // manually re-link it. Cleared once fulfilled so a later regeneration in
  // the same Studio session doesn't re-attach to a stale content item.
  let pendingCreativeRequestId: string | null = null;
  let fulfilledReturnRoute: string | null = null;

  $: selectedModel = models.find((model) => model.id === selectedModelId) || null;
  $: aspectRatios = selectedModel?.capabilities.aspectRatios || ['1:1'];
  $: maxOutputCount = selectedModel?.capabilities.maxOutputCount || 1;
  $: referenceMin = selectedModel?.capabilities.references?.min || 0;
  $: referenceMax = selectedModel?.capabilities.references?.max || 0;
  $: canUseReferences = referenceMax > 0;
  $: readyToGenerate = Boolean(selectedModel && prompt.trim() && references.length >= referenceMin && references.length <= referenceMax && !isGenerating);
  $: sessionAssets = assets.filter((asset) => sessionAssetIds.includes(asset.id));
  $: sessionGenerations = generations.filter((generation) => sessionGenerationIds.includes(generation.id));

  onMount(async () => {
    await initAuth();
    if (!$isAuthed) {
      goto('/login');
      return;
    }

    try {
      const config = await fetchConfig();
      isFeatureEnabled = Boolean(config.features.creative_studio);
      isCompositionEnabled = Boolean(config.features.brand_composition);
      if (!isFeatureEnabled) return;

      const [modelRows, assetRows] = await Promise.all([
        listMediaModels(),
        listMediaAssets(),
      ]);
      models = modelRows;
      assets = assetRows.filter((asset) => asset.lifecycle_status === 'active');
      generations = [];
      selectedModelId = models[0]?.id || '';
      syncDefaultsFromModel();
      hydrateDraftFromLibrary();
    } catch (err) {
      error = err instanceof Error ? err.message : 'โหลด Studio ไม่สำเร็จ';
    } finally {
      isLoading = false;
    }
  });

  onDestroy(() => {
    stopPolling();
  });

  function syncDefaultsFromModel() {
    if (!selectedModel) return;
    aspectRatio = selectedModel.capabilities.aspectRatios?.[0] || '1:1';
    numImages = Math.min(numImages, selectedModel.capabilities.maxOutputCount || 1);
    if (referenceMax === 0) references = [];
    quote = null;
    validationWarnings = [];
  }

  function hydrateDraftFromLibrary() {
    const raw = localStorage.getItem('creativeStudioDraft');
    if (!raw) return;
    localStorage.removeItem('creativeStudioDraft');
    try {
      const draft = JSON.parse(raw) as {
        model_id?: string;
        prompt?: string;
        options?: Record<string, any>;
        references?: MediaReferenceInput[];
        creative_request_id?: string;
      };
      if (draft.model_id && models.some((model) => model.id === draft.model_id)) {
        selectedModelId = draft.model_id;
        syncDefaultsFromModel();
      }
      if (draft.prompt) prompt = draft.prompt;
      if (draft.options?.aspect_ratio) aspectRatio = String(draft.options.aspect_ratio);
      if (draft.options?.response_format) responseFormat = String(draft.options.response_format);
      if (draft.options?.num_images) numImages = Number(draft.options.num_images);
      if (draft.creative_request_id) pendingCreativeRequestId = draft.creative_request_id;
      const availableAssetIds = new Set(assets.map((asset) => asset.id));
      references = (draft.references || [])
        .filter((reference) => availableAssetIds.has(reference.asset_id))
        .slice(0, referenceMax || 0)
        .map((reference, index) => ({ ...reference, sort_order: index }));
      rememberSessionAssets(references.map((reference) => reference.asset_id));
    } catch {
      error = 'ไม่สามารถโหลด draft จาก Library ได้';
    }
  }

  function invalidateQuote() {
    quote = null;
    validationWarnings = [];
    notice = '';
  }

  // Optional "เลือกแนวรูป" style presets — purely a prompt-text shortcut, not
  // a separate API param. Clicking a card appends a short style descriptor to
  // whatever the user has already typed; clicking the same card again (or a
  // different one) removes the previously-injected fragment first so
  // switching presets doesn't stack multiple style descriptions in the
  // prompt. This is best-effort text matching, not tracked state — if the
  // user hand-edits the fragment after selecting it, un-selecting won't
  // perfectly clean it back out. That's an acceptable trade-off for an
  // optional shortcut the user can otherwise just ignore and type freely.
  type StylePreset = { id: string; label: string; emoji: string; fragment: string };
  const STYLE_PRESETS: StylePreset[] = [
    { id: 'professional', label: 'มืออาชีพ', emoji: '🧭', fragment: 'โทนมืออาชีพ น่าเชื่อถือ แสงนุ่มนวล สไตล์คอร์ปอเรท' },
    { id: 'warm', label: 'อบอุ่น เป็นกันเอง', emoji: '☀️', fragment: 'โทนอบอุ่น เป็นกันเอง เข้าถึงง่าย สีโทนพาสเทล' },
    { id: 'premium', label: 'พรีเมียม หรูหรา', emoji: '✨', fragment: 'โทนพรีเมียม หรูหรา โทนมืด มีประกาย' },
    { id: 'clean', label: 'มินิมอล สะอาดตา', emoji: '🤍', fragment: 'โทนมินิมอล สะอาดตา สีขาว-เทา เรียบง่ายทันสมัย' },
  ];
  let selectedStyleId: string | null = null;

  function stripEdgeCommas(text: string): string {
    return text.replace(/^[,\s]+|[,\s]+$/g, '').trim();
  }

  function removeStyleFragment(text: string, fragment: string): string {
    return stripEdgeCommas(
      text
        .split(fragment).join('')
        .replace(/,\s*,/g, ',')
    );
  }

  function toggleStylePreset(preset: StylePreset) {
    const previous = STYLE_PRESETS.find((p) => p.id === selectedStyleId);
    if (selectedStyleId === preset.id) {
      prompt = removeStyleFragment(prompt, preset.fragment);
      selectedStyleId = null;
    } else {
      // Strip edge commas here too (not just .trim()) — otherwise a base
      // prompt that already ends with a comma (e.g. "..., ") produces a
      // double comma once ", <fragment>" is appended below.
      const withoutPrevious = previous ? removeStyleFragment(prompt, previous.fragment) : stripEdgeCommas(prompt);
      prompt = withoutPrevious ? `${withoutPrevious}, ${preset.fragment}` : preset.fragment;
      selectedStyleId = preset.id;
    }
    invalidateQuote();
  }

  function generationOptions() {
    return {
      aspect_ratio: aspectRatio,
      response_format: responseFormat,
      num_images: numImages,
      prompt_optimizer: promptOptimizer,
    };
  }

  async function refreshQuote() {
    if (!selectedModel) return null;
    error = '';
    notice = '';
    isQuoting = true;
    try {
      const resolved = await validateMediaReferences({
        model_id: selectedModel.id,
        prompt,
        references,
      });
      validationWarnings = resolved.warnings || [];
      quote = await previewMediaPricing({
        model_id: selectedModel.id,
        operation: selectedModel.operation,
        options: generationOptions(),
        reference_count: references.length,
      });
      return quote;
    } catch (err) {
      error = humanizeError(err);
      quote = null;
      return null;
    } finally {
      isQuoting = false;
    }
  }

  async function handleGenerate() {
    if (!readyToGenerate || !selectedModel) return;
    error = '';
    notice = '';
    isGenerating = true;
    try {
      const priced = await refreshQuote();
      if (!priced) return;
      const idempotencyKey = crypto.randomUUID();
      const payload = {
        model_id: selectedModel.id,
        prompt: prompt.trim(),
        options: generationOptions(),
        references,
        quote_id: priced.id || priced.quote_id || '',
        expected_pricing_version: priced.pricing_version,
      };
      let res: Awaited<ReturnType<typeof createMediaGeneration>>;
      try {
        res = await createMediaGeneration(payload, idempotencyKey);
      } catch (err) {
        if ((err instanceof Error ? err.message : '') !== 'price_changed') throw err;
        const nextQuote = await refreshQuote();
        if (!nextQuote) return;
        res = await createMediaGeneration({
          ...payload,
          quote_id: nextQuote.id || nextQuote.quote_id || '',
          expected_pricing_version: nextQuote.pricing_version,
        }, crypto.randomUUID());
      }
      activeGeneration = res.generation;
      rememberSessionGenerations([res.generation.id]);
      generations = [res.generation, ...generations.filter((item) => item.id !== res.generation.id)];
      startPolling(res.generation.id);
      notice = res.credits_remaining !== undefined
        ? `สร้างงานแล้ว เหลือ ${res.credits_remaining.toLocaleString()} credits`
        : 'สร้างงานแล้ว';
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isGenerating = false;
    }
  }

  async function handleCancel() {
    if (!activeGeneration) return;
    try {
      activeGeneration = await cancelMediaGeneration(activeGeneration.id);
      replaceGeneration(activeGeneration);
      stopPolling();
    } catch (err) {
      error = humanizeError(err);
    }
  }

  async function pollGeneration(id: string) {
    try {
      const next = await getMediaGeneration(id);
      activeGeneration = next;
      replaceGeneration(next);
      if (isTerminal(next.status)) {
        stopPolling();
        if (next.status === 'completed') {
          assets = await listMediaAssets().then((rows) => rows.filter((asset) => asset.lifecycle_status === 'active'));
          rememberSessionAssets(next.outputs.map((output) => output.id));
          notice = `เสร็จแล้ว ${next.delivered_output_count} output`;
          await attachToContentItemIfPending(next);
        }
      }
    } catch (err) {
      error = humanizeError(err);
      stopPolling();
    }
  }

  /**
   * If this generation was launched from a content item's "Create Creative"
   * button, attach the first output back to that content item automatically
   * — the whole point of carrying `creative_request_id` through is that the
   * user never has to manually re-link the image afterward. A failure here
   * doesn't touch `error` (the generation itself still succeeded and its
   * asset is safely in the library either way) — it surfaces as a distinct
   * notice so it's visible without masking the generation-succeeded state.
   *
   * `pendingCreativeRequestId` is captured and cleared up front (before the
   * await), not after the fulfill call resolves. Clearing it only on success
   * left it dangling on failure, so a later, completely unrelated generation
   * completing in the same Studio session would replay this function against
   * the stale request id and auto-attach the wrong asset to it. There's no
   * retry UI for a failed attach anyway, so once an attempt has been made
   * (pass or fail) the pending state is done being pending.
   */
  async function attachToContentItemIfPending(generation: MediaGeneration) {
    if (!pendingCreativeRequestId) return;
    const requestId = pendingCreativeRequestId;
    pendingCreativeRequestId = null;
    const output = generation.outputs[0];
    if (!output) return;
    try {
      const result = await fulfillCreativeRequest(requestId, output.id);
      fulfilledReturnRoute = result.return_route;
      notice = `${notice} · แนบเข้า content แล้ว`;
    } catch (err) {
      notice = `${notice} · แนบเข้า content ไม่สำเร็จ: ${humanizeError(err)}`;
    }
  }

  function startPolling(id: string) {
    stopPolling();
    pollTimer = setInterval(() => pollGeneration(id), 2500);
    void pollGeneration(id);
  }

  function stopPolling() {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  function replaceGeneration(generation: MediaGeneration) {
    rememberSessionGenerations([generation.id]);
    generations = [generation, ...generations.filter((item) => item.id !== generation.id)];
  }

  async function uploadFiles(files: File[]) {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (!imageFiles.length) return;

    error = '';
    isUploading = true;
    uploadStates = [...uploadStates, ...imageFiles.map((file) => ({ name: file.name, status: 'uploading' as const }))];
    try {
      for (const file of imageFiles) {
        try {
          const uploaded = await uploadMediaAsset(file, assetType);
          assets = [uploaded, ...assets.filter((asset) => asset.id !== uploaded.id)];
          rememberSessionAssets([uploaded.id]);
          uploadStates = uploadStates.map((item) => item.name === file.name ? { ...item, status: 'done' } : item);
          if (canUseReferences) addReference(uploaded);
        } catch (err) {
          uploadStates = uploadStates.map((item) => item.name === file.name
            ? { ...item, status: 'failed', message: humanizeError(err) }
            : item);
        }
      }
    } finally {
      isUploading = false;
    }
  }

  async function handleFiles(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files || []);
    await uploadFiles(files);
    input.value = '';
  }

  let isDragOver = false;

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
    void uploadFiles(Array.from(event.dataTransfer?.files || []));
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave() {
    isDragOver = false;
  }

  function handlePaste(event: ClipboardEvent) {
    const items = Array.from(event.clipboardData?.items || []);
    const files = items
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (!files.length) return;
    event.preventDefault();
    void uploadFiles(files);
  }

  function addReference(asset: MediaAsset) {
    if (!canUseReferences) return;
    rememberSessionAssets([asset.id]);
    const mentionName = uniqueMentionName(asset);
    const nextReference = {
      asset_id: asset.id,
      mention_name: mentionName,
      reference_role: selectedModel?.capabilities.references?.roles?.[0] || 'subject',
      influence_level: 'balanced',
      sort_order: 0,
    };
    const nextReferences = referenceMax <= 1 ? [nextReference] : [...references, nextReference].slice(0, referenceMax);
    references = nextReferences.map((reference, index) => ({ ...reference, sort_order: index }));
    if (!prompt.includes(`@${mentionName}`)) {
      prompt = `${prompt.trim()} ${prompt.trim() ? '' : ''}@${mentionName}`.trim();
    }
    invalidateQuote();
  }

  function toggleReference(asset: MediaAsset) {
    if (isReferenceSelected(asset.id)) {
      removeReference(asset.id);
      return;
    }
    addReference(asset);
  }

  function removeReference(assetId: string) {
    references = references
      .filter((reference) => reference.asset_id !== assetId)
      .map((reference, index) => ({ ...reference, sort_order: index }));
    invalidateQuote();
  }

  function moveReference(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= references.length) return;
    const next = [...references];
    [next[index], next[target]] = [next[target], next[index]];
    references = next.map((reference, i) => ({ ...reference, sort_order: i }));
    invalidateQuote();
  }

  function closeMentionMenu() {
    mentionQuery = null;
    mentionMatches = [];
    mentionActiveIndex = 0;
  }

  // Scans back from the given cursor position to the nearest unbroken
  // `@word` token (no whitespace since the `@`), and forward from the cursor
  // to the end of that same token (next whitespace or end of string). Shared
  // by updateMentionState (for live filtering, which only cares about the
  // `query` up to the cursor) and insertMentionAtCursor (for the actual
  // splice, which must replace the WHOLE token — `start` through `end` —
  // not just up to the cursor, otherwise clicking/arrow-keying into the
  // middle of an already-typed "@alice" and accepting a suggestion would
  // splice in the replacement but leave the trailing "ice" dangling after
  // it, e.g. "@alice" -> "@someone ice").
  function currentMentionRange(): { start: number; end: number; query: string } | null {
    if (!promptTextarea) return null;
    const cursor = promptTextarea.selectionStart ?? prompt.length;
    const upToCursor = prompt.slice(0, cursor);
    const atIndex = upToCursor.lastIndexOf('@');
    if (atIndex === -1 || /\s/.test(upToCursor.slice(atIndex + 1))) return null;
    const rest = prompt.slice(cursor);
    const wsMatch = rest.match(/\s/);
    const end = wsMatch ? cursor + (wsMatch.index ?? 0) : prompt.length;
    return { start: atIndex, end, query: upToCursor.slice(atIndex + 1) };
  }

  // Scans back from the cursor to the nearest unbroken `@word` token (no
  // whitespace since the `@`) and, if found, lists matching library assets —
  // powers the live autocomplete dropdown while typing a mention.
  function updateMentionState() {
    const range = currentMentionRange();
    if (!range) {
      closeMentionMenu();
      return;
    }
    mentionQuery = range.query;
    const query = mentionQuery.toLowerCase();
    const pool = sessionAssets.length ? sessionAssets : assets;
    mentionMatches = pool
      .filter((asset) => {
        const name = sanitizeMention(asset.original_filename?.replace(/\.[^.]+$/, '') || asset.asset_type || 'ref').toLowerCase();
        return !query || name.includes(query);
      })
      .slice(0, 6);
    mentionActiveIndex = 0;
  }

  function insertMentionAtCursor(asset: MediaAsset) {
    if (!promptTextarea || mentionQuery === null) return;
    // Recompute the token range from the LIVE cursor position rather than
    // trusting mentionQuery (cached from the last keystroke): the cursor can
    // move (e.g. ArrowLeft/ArrowRight/Home/End) without the textarea's
    // `oninput` firing, which would otherwise splice against a stale range
    // and corrupt the prompt (verified via a standalone repro of this exact
    // logic before this fix).
    const range = currentMentionRange();
    if (!range) {
      closeMentionMenu();
      return;
    }

    const existing = references.find((reference) => reference.asset_id === asset.id);
    let mentionName: string;
    if (existing) {
      mentionName = existing.mention_name;
    } else {
      if (!canUseReferences || references.length >= referenceMax) {
        closeMentionMenu();
        return;
      }
      mentionName = uniqueMentionName(asset);
      const nextReference = {
        asset_id: asset.id,
        mention_name: mentionName,
        reference_role: selectedModel?.capabilities.references?.roles?.[0] || 'subject',
        influence_level: 'balanced',
        sort_order: references.length,
      };
      references = [...references, nextReference].map((reference, i) => ({ ...reference, sort_order: i }));
      rememberSessionAssets([asset.id]);
    }

    const before = prompt.slice(0, range.start);
    const after = prompt.slice(range.end);
    // Only add a separating space when `after` doesn't already start with
    // whitespace (or is empty) — otherwise inserting a mention that has
    // trailing text right after it (e.g. "@ali foo" -> select "alice")
    // would double up the space: "@alice " + " foo".
    const insertion = after.length === 0 || !/^\s/.test(after) ? `@${mentionName} ` : `@${mentionName}`;
    prompt = `${before}${insertion}${after}`;
    const newCursor = before.length + insertion.length;
    closeMentionMenu();
    invalidateQuote();
    requestAnimationFrame(() => {
      promptTextarea?.focus();
      promptTextarea?.setSelectionRange(newCursor, newCursor);
    });
  }

  function handlePromptKeydown(event: KeyboardEvent) {
    // Only intercept arrows/Enter/Tab while a *usable* mention menu is open.
    // On a text-to-image model (canUseReferences === false) the picker is
    // never shown, so keys like Enter must fall through to their normal
    // textarea behaviour (newline) instead of being swallowed here.
    if (mentionQuery === null || !canUseReferences || !mentionMatches.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      mentionActiveIndex = (mentionActiveIndex + 1) % mentionMatches.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      mentionActiveIndex = (mentionActiveIndex - 1 + mentionMatches.length) % mentionMatches.length;
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      insertMentionAtCursor(mentionMatches[mentionActiveIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeMentionMenu();
    }
  }

  function isReferenceSelected(assetId: string) {
    return references.some((reference) => reference.asset_id === assetId);
  }

  async function toggleFavorite(asset: MediaAsset) {
    try {
      const updated = await favoriteMediaAsset(asset.id, !asset.favorite);
      assets = assets.map((item) => item.id === updated.id ? updated : item);
    } catch (err) {
      error = humanizeError(err);
    }
  }

  function handleTemplateApplied(newAsset: MediaAsset) {
    assets = [newAsset, ...assets.filter((asset) => asset.id !== newAsset.id)];
    sessionAssetIds = [newAsset.id, ...sessionAssetIds];
    templateModalAssetId = null;
    notice = 'สร้าง Composed Creative แล้ว — ดูได้ใน Asset Library';
  }

  function uniqueMentionName(asset: MediaAsset) {
    const base = sanitizeMention(asset.original_filename?.replace(/\.[^.]+$/, '') || asset.asset_type || 'ref');
    const used = new Set(references.map((reference) => reference.mention_name));
    if (!used.has(base)) return base;
    let index = 2;
    while (used.has(`${base}${index}`)) index += 1;
    return `${base}${index}`;
  }

  function sanitizeMention(value: string) {
    return value.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 28) || 'ref';
  }

  function referenceAsset(assetId: string) {
    return assets.find((asset) => asset.id === assetId) || null;
  }

  function rememberSessionAssets(ids: string[]) {
    const next = new Set(sessionAssetIds);
    ids.filter(Boolean).forEach((id) => next.add(id));
    sessionAssetIds = Array.from(next);
  }

  function rememberSessionGenerations(ids: string[]) {
    const next = new Set(sessionGenerationIds);
    ids.filter(Boolean).forEach((id) => next.add(id));
    sessionGenerationIds = Array.from(next);
  }

  function isTerminal(status: string) {
    return ['completed', 'failed', 'cancelled'].includes(status);
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function humanizeError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err || '');
    const map: Record<string, string> = {
      feature_disabled: 'Creative Studio ยังไม่เปิดใช้งานบน environment นี้',
      reference_count_not_supported: 'จำนวน reference image ไม่ตรงกับโมเดลที่เลือก',
      unresolved_prompt_mentions: 'มี @reference ใน prompt ที่ยังไม่ได้เลือกภาพอ้างอิง',
      unsupported_mime_type: 'รองรับเฉพาะ JPEG, PNG และ WebP ใน phase นี้',
      invalid_file_size: 'ไฟล์ต้องมีขนาดไม่เกิน 10MB',
      insufficient_credits: 'เครดิตไม่พอสำหรับงานนี้',
      price_changed: 'quote หมดอายุหรือไม่ตรงกับงานนี้ ลองกด Generate อีกครั้ง',
      active_job_limit_reached: 'มีงานกำลังรันครบ limit แล้ว รอสักครู่แล้วลองใหม่',
      daily_media_credit_limit_reached: 'ถึง limit เครดิตภาพต่อวันของบัญชีนี้แล้ว',
    };
    return map[message] || message || 'เกิดข้อผิดพลาด';
  }
</script>

<svelte:head>
  <title>Creative Studio — Business Smart OS</title>
</svelte:head>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950 dark:text-dark-50" onpaste={handlePaste}>
  <main class="container-narrow py-8 max-w-7xl">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <a href="/today" class="text-sm text-dark-900/60 dark:text-dark-100/60 hover:text-primary-600">กลับวันนี้</a>
        <h1 class="mt-2 text-3xl font-bold tracking-tight">Creative Studio</h1>
      </div>
      <div class="flex items-center gap-2">
        <a href="/studio/library" class="btn-secondary py-2 px-4 text-sm">Library</a>
        <a href="/studio/brand-kits" class="btn-secondary py-2 px-4 text-sm">Brand Kits</a>
        <a href="/studio/series" class="btn-secondary py-2 px-4 text-sm">Series</a>
        <a href="/inbox" class="btn-secondary py-2 px-4 text-sm">Inbox</a>
        <a href="/works" class="btn-secondary py-2 px-4 text-sm">Works</a>
        <a href="/settings/social" class="btn-secondary py-2 px-4 text-sm">Social</a>
        <a href="/billing" class="btn-secondary py-2 px-4 text-sm">เครดิต</a>
        <a href="/tools" class="btn-secondary py-2 px-4 text-sm">Tools</a>
      </div>
    </div>

    {#if isLoading}
      <div class="rounded-lg border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-8 text-center text-dark-900/60 dark:text-dark-100/60">
        กำลังโหลด Studio...
      </div>
    {:else if !isFeatureEnabled}
      <div class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-6">
        <div class="text-sm font-semibold text-amber-900 dark:text-amber-200">Creative Studio ยังไม่เปิดบน environment นี้</div>
        <div class="mt-1 text-sm text-amber-800 dark:text-amber-300">Frontend พร้อมแล้ว เปิด flag `CREATIVE_STUDIO_ENABLED=true` ที่ API staging/production เพื่อเริ่มทดสอบ live flow</div>
      </div>
    {:else}
      {#if error}
        <div class="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      {/if}
      {#if notice}
        <div class="mb-4 rounded-lg border border-success-100 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300 flex items-center justify-between gap-3">
          <span>{notice}</span>
          {#if fulfilledReturnRoute}
            <a href={fulfilledReturnRoute} class="shrink-0 font-semibold underline hover:no-underline">← กลับไป Content</a>
          {/if}
        </div>
      {/if}

      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section class="space-y-5">
          <div class="rounded-lg border border-dark-100 bg-white p-5 dark:border-dark-700 dark:bg-dark-800">
            <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-base font-bold">Generate</h2>
                <p class="text-sm text-dark-900/60 dark:text-dark-100/60">{selectedModel?.display_name || 'เลือกโมเดล'}</p>
              </div>
              {#if quote}
                <div class="rounded-lg bg-dark-50 px-3 py-2 text-right dark:bg-dark-900">
                  <div class="text-xs text-dark-900/50 dark:text-dark-100/50">Quote</div>
                  <div class="font-bold text-primary-600 dark:text-primary-300">{quote.credits} credits</div>
                </div>
              {/if}
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <label class="block">
                <span class="mb-1.5 block text-sm font-semibold">Model</span>
                <select
                  bind:value={selectedModelId}
                  onchange={() => syncDefaultsFromModel()}
                  class="w-full rounded-lg border border-dark-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-900"
                >
                  {#each models as model}
                    <option value={model.id}>{model.display_name}</option>
                  {/each}
                </select>
              </label>

              <label class="block">
                <span class="mb-1.5 block text-sm font-semibold">Aspect ratio</span>
                <select
                  bind:value={aspectRatio}
                  onchange={invalidateQuote}
                  class="w-full rounded-lg border border-dark-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-900"
                >
                  {#each aspectRatios as ratio}
                    <option value={ratio}>{ratio}</option>
                  {/each}
                </select>
              </label>
            </div>

            <div class="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_1fr]">
              <label class="block">
                <span class="mb-1.5 block text-sm font-semibold">Outputs</span>
                <input
                  type="number"
                  min="1"
                  max={maxOutputCount}
                  bind:value={numImages}
                  oninput={invalidateQuote}
                  class="w-full rounded-lg border border-dark-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-900"
                />
              </label>

              <label class="block">
                <span class="mb-1.5 block text-sm font-semibold">Format</span>
                <select
                  bind:value={responseFormat}
                  onchange={invalidateQuote}
                  class="w-full rounded-lg border border-dark-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-900"
                >
                  <option value="url">URL</option>
                  <option value="base64">Base64</option>
                </select>
              </label>

              <label class="flex items-end">
                <span class="flex h-[42px] w-full items-center justify-between gap-3 rounded-lg border border-dark-200 px-3 text-sm dark:border-dark-600">
                  <span class="font-semibold">Prompt optimizer</span>
                  <input type="checkbox" bind:checked={promptOptimizer} onchange={invalidateQuote} class="h-4 w-4" />
                </span>
              </label>
            </div>

            <div class="mt-4">
              <div class="mb-2 flex items-center justify-between gap-2">
                <span class="text-sm font-semibold">เลือกแนวภาพ <span class="font-normal text-dark-900/50 dark:text-dark-100/50">(ไม่บังคับ)</span></span>
                {#if selectedStyleId}
                  <span class="text-xs text-dark-900/50 dark:text-dark-100/50">เติมลง prompt แล้ว — กดซ้ำเพื่อเอาออก</span>
                {/if}
              </div>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {#each STYLE_PRESETS as preset}
                  <button
                    type="button"
                    onclick={() => toggleStylePreset(preset)}
                    aria-pressed={selectedStyleId === preset.id}
                    class="rounded-lg border px-3 py-2.5 text-left text-sm transition {selectedStyleId === preset.id ? 'border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-500 dark:bg-primary-900/40 dark:text-primary-300' : 'border-dark-200 text-dark-900 hover:border-primary-300 dark:border-dark-600 dark:text-dark-50'}"
                  >
                    <span class="block text-lg leading-none">{preset.emoji}</span>
                    <span class="mt-1 block font-semibold">{preset.label}</span>
                  </button>
                {/each}
              </div>
            </div>

            <label class="mt-4 block">
              <span class="mb-1.5 block text-sm font-semibold">Prompt</span>
              <div class="relative">
                <textarea
                  bind:this={promptTextarea}
                  bind:value={prompt}
                  oninput={() => { invalidateQuote(); updateMentionState(); }}
                  onkeydown={handlePromptKeydown}
                  onkeyup={(event) => {
                    // ArrowUp/Down/Enter/Tab/Escape are handled (and, when the
                    // menu is open, preventDefault'd) in handlePromptKeydown.
                    // Left/Right/Home/End move the caret without an `oninput`
                    // or `onclick` firing, so re-sync the mention token here —
                    // otherwise the dropdown can keep showing matches for a
                    // token the cursor has since moved out of.
                    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) updateMentionState();
                  }}
                  onclick={updateMentionState}
                  onblur={() => { setTimeout(closeMentionMenu, 120); }}
                  rows="7"
                  placeholder={canUseReferences
                    ? 'เช่น ทำภาพใหม่โดยรักษาใบหน้าคนใน @ชื่อภาพ ให้ดูมืออาชีพขึ้น — พิมพ์ @ เพื่อเลือกภาพอ้างอิง'
                    : 'เช่น สร้างภาพโฆษณา workshop AI สำหรับเจ้าของธุรกิจ SME โทนมืออาชีพ อบอุ่น เห็นคนกำลังใช้ AI วางแผนคอนเทนต์'}
                  class="w-full resize-y rounded-lg border border-dark-200 bg-white px-4 py-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-900"
                ></textarea>
                {#if mentionQuery !== null && canUseReferences && mentionMatches.length}
                  <ul role="listbox" class="absolute z-20 mt-1 w-full max-w-sm overflow-hidden rounded-lg border border-dark-200 bg-white shadow-lg dark:border-dark-600 dark:bg-dark-900">
                    {#each mentionMatches as match, index}
                      <li role="option" aria-selected={index === mentionActiveIndex}>
                        <button
                          type="button"
                          onmousedown={(event) => { event.preventDefault(); insertMentionAtCursor(match); }}
                          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm {index === mentionActiveIndex ? 'bg-primary-50 dark:bg-primary-950/40' : 'hover:bg-dark-50 dark:hover:bg-dark-800'}"
                        >
                          <img src={getMediaAssetContentUrl(match.id)} alt="" class="h-8 w-8 shrink-0 rounded object-cover" />
                          <span class="truncate">@{sanitizeMention(match.original_filename?.replace(/\.[^.]+$/, '') || 'ref')}</span>
                        </button>
                      </li>
                    {/each}
                  </ul>
                {:else if mentionQuery !== null && !canUseReferences}
                  <!-- The user typed @ to attach a reference, but the selected model
                       is text-to-image and has no reference capability — so the asset
                       picker would only offer options that silently do nothing on
                       click. Explain why and point them at the fix instead. -->
                  <div class="absolute z-20 mt-1 w-full max-w-sm rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 shadow-lg dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                    โมเดลนี้สร้างภาพจากข้อความล้วน ยังแนบภาพอ้างอิงไม่ได้ — เลือกโมเดลที่มีคำว่า “ภาพอ้างอิง” หรือ “Subject Reference” ในช่อง Model ก่อน แล้วค่อยพิมพ์ @ เพื่อเลือกภาพ
                  </div>
                {/if}
              </div>
            </label>

            {#if canUseReferences}
              <div class="mt-4">
                <div class="mb-2 flex items-center justify-between gap-3">
                  <div class="text-sm font-semibold">References {references.length}/{referenceMax}</div>
                  <div class="text-xs text-dark-900/50 dark:text-dark-100/50">ขั้นต่ำ {referenceMin}</div>
                </div>
                {#if references.length}
                  <div class="grid gap-3 sm:grid-cols-2">
                    {#each references as reference, index}
                      {@const asset = referenceAsset(reference.asset_id)}
                      <div class="flex items-center gap-3 rounded-lg border border-dark-100 bg-dark-50 p-2 dark:border-dark-700 dark:bg-dark-900">
                        {#if asset}
                          <img src={getMediaAssetContentUrl(asset.id)} alt={asset.original_filename || reference.mention_name} class="h-14 w-14 rounded-md object-cover" />
                        {/if}
                        <div class="min-w-0 flex-1">
                          <div class="truncate text-sm font-semibold">@{reference.mention_name}</div>
                          <div class="text-xs text-dark-900/50 dark:text-dark-100/50">{reference.reference_role}</div>
                        </div>
                        <div class="flex shrink-0 flex-col">
                          <button
                            onclick={() => moveReference(index, -1)}
                            disabled={index === 0}
                            aria-label="เลื่อนขึ้น"
                            class="rounded px-1 text-xs text-dark-900/50 hover:bg-dark-100 disabled:opacity-30 dark:text-dark-100/50 dark:hover:bg-dark-700"
                          >▲</button>
                          <button
                            onclick={() => moveReference(index, 1)}
                            disabled={index === references.length - 1}
                            aria-label="เลื่อนลง"
                            class="rounded px-1 text-xs text-dark-900/50 hover:bg-dark-100 disabled:opacity-30 dark:text-dark-100/50 dark:hover:bg-dark-700"
                          >▼</button>
                        </div>
                        <button onclick={() => removeReference(reference.asset_id)} class="shrink-0 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">ลบ</button>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <div class="rounded-lg border border-dashed border-dark-200 p-4 text-sm text-dark-900/50 dark:border-dark-700 dark:text-dark-100/50">
                    เลือกภาพจาก Asset Library หรือ upload ภาพใหม่
                  </div>
                {/if}
              </div>
            {/if}

            {#if validationWarnings.length}
              <div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                {validationWarnings.join(', ')}
              </div>
            {/if}

            <div class="mt-5 flex flex-wrap items-center gap-3">
              <button onclick={handleGenerate} disabled={!readyToGenerate} class="btn-primary disabled:opacity-50">
                {isGenerating ? 'กำลังเริ่มงาน...' : 'Generate'}
              </button>
              <button onclick={refreshQuote} disabled={!selectedModel || !prompt.trim() || isQuoting} class="btn-secondary disabled:opacity-50">
                {isQuoting ? 'กำลังประเมิน...' : 'ประเมิน credits'}
              </button>
              {#if activeGeneration && !isTerminal(activeGeneration.status)}
                <button onclick={handleCancel} class="btn-secondary py-3 text-sm text-red-600">Cancel</button>
              {/if}
            </div>
          </div>

          <div class="rounded-lg border border-dark-100 bg-white p-5 dark:border-dark-700 dark:bg-dark-800">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-base font-bold">Output</h2>
              {#if activeGeneration}
                <span class="rounded-full bg-dark-50 px-2.5 py-1 text-xs font-semibold text-dark-900/70 dark:bg-dark-900 dark:text-dark-100/70">{activeGeneration.status}</span>
              {/if}
            </div>

            {#if activeGeneration?.outputs?.length}
              <div class="grid gap-4 sm:grid-cols-2">
                {#each activeGeneration.outputs as output}
                  <div class="group overflow-hidden rounded-lg border border-dark-100 bg-dark-50 dark:border-dark-700 dark:bg-dark-900">
                    <a href={getMediaAssetContentUrl(output.id)} target="_blank" rel="noreferrer" class="block">
                      <img src={getMediaAssetContentUrl(output.id)} alt={output.original_filename || output.id} class="aspect-square w-full object-cover transition group-hover:scale-[1.02]" />
                    </a>
                    <div class="flex items-center justify-between gap-3 p-3 text-xs text-dark-900/60 dark:text-dark-100/60">
                      <span>{output.width || '-'} x {output.height || '-'}</span>
                      <span>{formatBytes(output.file_size)}</span>
                    </div>
                    {#if isCompositionEnabled}
                      <div class="border-t border-dark-100 p-2 dark:border-dark-700">
                        <button onclick={() => (templateModalAssetId = output.id)} class="btn-secondary w-full py-1.5 text-xs">
                          + ใส่ Template (headline/text)
                        </button>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {:else if activeGeneration && !isTerminal(activeGeneration.status)}
              <div class="rounded-lg border border-dashed border-dark-200 p-8 text-center text-sm text-dark-900/60 dark:border-dark-700 dark:text-dark-100/60">
                งานกำลังประมวลผล...
              </div>
            {:else if activeGeneration?.status === 'failed'}
              <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                {activeGeneration.error_message || activeGeneration.error_code || 'Generation failed'}
              </div>
            {:else}
              <div class="rounded-lg border border-dashed border-dark-200 p-8 text-center text-sm text-dark-900/50 dark:border-dark-700 dark:text-dark-100/50">
                ยังไม่มี output ในรอบนี้
              </div>
            {/if}
          </div>
        </section>

        <aside class="space-y-5">
          <div class="rounded-lg border border-dark-100 bg-white p-4 dark:border-dark-700 dark:bg-dark-800">
            <div class="mb-3 flex items-center justify-between">
              <h2 class="text-base font-bold">Asset Library</h2>
              <select bind:value={assetType} class="rounded-md border border-dark-200 bg-white px-2 py-1 text-xs dark:border-dark-600 dark:bg-dark-900">
                <option value="image">Image</option>
                <option value="product">Product</option>
                <option value="logo">Logo</option>
              </select>
            </div>
            <label
              ondrop={handleDrop}
              ondragover={handleDragOver}
              ondragleave={handleDragLeave}
              class="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-5 text-center text-sm transition-colors {isDragOver ? 'border-primary-400 bg-primary-50 dark:border-primary-600 dark:bg-primary-950/30' : 'border-dark-200 bg-dark-50 hover:border-primary-300 dark:border-dark-700 dark:bg-dark-900'}"
            >
              <span class="font-semibold">{isUploading ? 'กำลัง upload...' : isDragOver ? 'ปล่อยไฟล์ที่นี่' : 'Upload images'}</span>
              <span class="mt-1 text-xs text-dark-900/50 dark:text-dark-100/50">JPEG, PNG, WebP ไม่เกิน 10MB — ลาก, วาง, หรือ paste ได้</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" multiple onchange={handleFiles} class="sr-only" disabled={isUploading} />
            </label>

            {#if uploadStates.length}
              <div class="mt-3 space-y-2">
                {#each uploadStates as upload}
                  <div class="flex items-center justify-between gap-3 rounded-md bg-dark-50 px-2 py-1.5 text-xs dark:bg-dark-900">
                    <span class="truncate">{upload.name}</span>
                    <span class={upload.status === 'failed' ? 'text-red-600' : upload.status === 'done' ? 'text-success-700 dark:text-green-300' : 'text-dark-900/50 dark:text-dark-100/50'}>
                      {upload.status === 'uploading' ? 'uploading' : upload.status === 'done' ? 'done' : upload.message || 'failed'}
                    </span>
                  </div>
                {/each}
              </div>
            {/if}

            <div class="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
              {#each sessionAssets as asset}
                {@const selectedAsReference = isReferenceSelected(asset.id)}
                <div class="rounded-lg border p-2 transition {selectedAsReference ? 'border-primary-300 bg-primary-50 dark:border-primary-800 dark:bg-primary-950/30' : 'border-dark-100 dark:border-dark-700'}">
                  <div class="flex gap-3">
                    <img src={getMediaAssetContentUrl(asset.id)} alt={asset.original_filename || asset.id} class="h-16 w-16 rounded-md object-cover" />
                    <div class="min-w-0 flex-1">
                      <div class="flex items-start justify-between gap-2">
                        <div class="truncate text-sm font-semibold">{asset.original_filename || asset.id}</div>
                        {#if selectedAsReference}
                          <span class="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-semibold text-primary-700 dark:bg-primary-900/70 dark:text-primary-200">Selected</span>
                        {/if}
                      </div>
                      <div class="mt-0.5 text-xs text-dark-900/50 dark:text-dark-100/50">{asset.asset_type} · {asset.width || '-'}x{asset.height || '-'}</div>
                      <div class="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          onclick={() => toggleReference(asset)}
                          disabled={!canUseReferences}
                          class="max-w-full truncate rounded-md px-2 py-1 text-xs font-semibold disabled:opacity-40 {selectedAsReference ? 'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:text-dark-950' : 'bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-900/40 dark:text-primary-300'}"
                        >
                          {selectedAsReference ? 'เอาออกจาก reference' : 'ใช้เป็น reference'}
                        </button>
                        <button
                          onclick={() => toggleReference(asset)}
                          disabled={!canUseReferences}
                          class="max-w-full truncate rounded-md bg-dark-50 px-2 py-1 text-xs font-semibold text-dark-900/70 hover:bg-dark-100 disabled:opacity-40 dark:bg-dark-900 dark:text-dark-100/70 dark:hover:bg-dark-700"
                          title="Mention name ที่จะถูกใส่ใน prompt"
                        >
                          @{sanitizeMention(asset.original_filename?.replace(/\.[^.]+$/, '') || 'ref')}
                        </button>
                        <button onclick={() => toggleFavorite(asset)} class="max-w-full truncate rounded-md px-2 py-1 text-xs text-dark-900/60 hover:bg-dark-50 dark:text-dark-100/60 dark:hover:bg-dark-900">
                          {asset.favorite ? 'Favorited' : 'Favorite'}
                        </button>
                        {#if isCompositionEnabled}
                          <button onclick={() => (templateModalAssetId = asset.id)} class="max-w-full truncate rounded-md px-2 py-1 text-xs text-dark-900/60 hover:bg-dark-50 dark:text-dark-100/60 dark:hover:bg-dark-900">
                            + Template
                          </button>
                        {/if}
                      </div>
                    </div>
                  </div>
                </div>
              {:else}
                <div class="rounded-lg border border-dashed border-dark-200 p-4 text-center text-sm text-dark-900/50 dark:border-dark-700 dark:text-dark-100/50">ยังไม่มี asset ในรอบนี้</div>
              {/each}
            </div>
          </div>

          <div class="rounded-lg border border-dark-100 bg-white p-4 dark:border-dark-700 dark:bg-dark-800">
            <div class="mb-3 flex items-center justify-between">
              <h2 class="text-base font-bold">History</h2>
              <span class="text-xs text-dark-900/50 dark:text-dark-100/50">{sessionGenerations.length}</span>
            </div>
            <div class="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
              {#each sessionGenerations as generation}
                <button
                  onclick={() => {
                    activeGeneration = generation;
                    if (!isTerminal(generation.status)) startPolling(generation.id);
                  }}
                  class="w-full rounded-lg border p-3 text-left transition {activeGeneration?.id === generation.id ? 'border-primary-300 bg-primary-50 dark:border-primary-800 dark:bg-primary-950/30' : 'border-dark-100 hover:border-dark-200 dark:border-dark-700 dark:hover:border-dark-600'}"
                >
                  <div class="flex items-center justify-between gap-3">
                    <span class="truncate text-sm font-semibold">{generation.model_id}</span>
                    <span class="rounded-full bg-dark-50 px-2 py-0.5 text-xs dark:bg-dark-900">{generation.status}</span>
                  </div>
                  <div class="mt-1 line-clamp-2 text-xs text-dark-900/60 dark:text-dark-100/60">{generation.prompt}</div>
                  <div class="mt-2 text-xs text-dark-900/40 dark:text-dark-100/40">{formatDate(generation.created_at)} · {generation.estimated_credits} credits</div>
                </button>
              {:else}
                <div class="rounded-lg border border-dashed border-dark-200 p-4 text-center text-sm text-dark-900/50 dark:border-dark-700 dark:text-dark-100/50">ยังไม่มี history ในรอบนี้</div>
              {/each}
            </div>
          </div>
        </aside>
      </div>
    {/if}
  </main>

  {#if templateModalAssetId}
    <ApplyTemplateModal
      assetId={templateModalAssetId}
      onClose={() => (templateModalAssetId = null)}
      onApplied={handleTemplateApplied}
    />
  {/if}
</div>
