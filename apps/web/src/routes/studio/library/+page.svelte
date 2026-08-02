<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import {
    deleteMediaAsset,
    favoriteMediaAsset,
    getMediaAssetContentUrl,
    listMediaAssets,
    listMediaGenerations,
    listMediaModels,
    updateMediaAsset,
    uploadMediaAssetWithMetadata,
    type MediaAsset,
    type MediaGeneration,
    type MediaModel,
    type MediaReferenceInput,
  } from '$lib/api';
  import { initAuth, isAuthed } from '$lib/auth';
  import { fetchConfig } from '$lib/config';

  type TabId = 'generated' | 'uploads' | 'products' | 'people' | 'styles' | 'logos' | 'templates' | 'favorites';
  type UploadState = { name: string; status: 'uploading' | 'done' | 'failed'; message?: string };

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'generated', label: 'Generated' },
    { id: 'uploads', label: 'Uploads' },
    { id: 'products', label: 'Products' },
    { id: 'people', label: 'People' },
    { id: 'styles', label: 'Styles' },
    { id: 'logos', label: 'Logos' },
    { id: 'templates', label: 'Templates' },
    { id: 'favorites', label: 'Favorites' },
  ];

  let isLoading = true;
  let isFeatureEnabled = false;
  let error = '';
  let notice = '';
  let assets: MediaAsset[] = [];
  let generations: MediaGeneration[] = [];
  let models: MediaModel[] = [];
  let activeTab: TabId = 'generated';
  let query = '';
  let assetType = '';
  let status = 'active';
  let modelId = '';
  let dateRange = 'all';
  let isUploading = false;
  let uploadName = '';
  let uploadAssetType = 'image';
  let uploadTags = '';
  let uploadStates: UploadState[] = [];
  let editingAssetId = '';
  let editName = '';
  let editAssetType = 'image';
  let editTags = '';

  $: activeAssets = assets.filter((asset) => status === 'all' || asset.lifecycle_status === status);
  $: filteredAssets = activeAssets.filter(matchesAssetFilters);
  $: filteredGenerations = generations.filter(matchesGenerationFilters);

  onMount(async () => {
    await initAuth();
    if (!$isAuthed) {
      goto('/login');
      return;
    }

    try {
      const config = await fetchConfig();
      isFeatureEnabled = Boolean(config.features.creative_studio);
      if (!isFeatureEnabled) return;
      const [assetRows, generationRows, modelRows] = await Promise.all([
        listMediaAssets(),
        listMediaGenerations(),
        listMediaModels(),
      ]);
      assets = assetRows;
      generations = generationRows;
      models = modelRows;
    } catch (err) {
      error = err instanceof Error ? err.message : 'โหลด Library ไม่สำเร็จ';
    } finally {
      isLoading = false;
    }
  });

  function matchesAssetFilters(asset: MediaAsset) {
    if (activeTab === 'generated' && asset.source !== 'generation') return false;
    if (activeTab === 'uploads' && asset.source !== 'upload') return false;
    if (activeTab === 'products' && asset.asset_type !== 'product') return false;
    if (activeTab === 'people' && !['person', 'people', 'character'].includes(asset.asset_type)) return false;
    if (activeTab === 'styles' && asset.asset_type !== 'style') return false;
    if (activeTab === 'logos' && asset.asset_type !== 'logo') return false;
    if (activeTab === 'templates' && asset.asset_type !== 'template') return false;
    if (activeTab === 'favorites' && !asset.favorite) return false;
    if (assetType && asset.asset_type !== assetType) return false;
    if (!matchesDate(asset.created_at)) return false;
    const text = `${asset.original_filename || ''} ${asset.asset_type} ${asset.source} ${assetTags(asset).join(' ')}`.toLowerCase();
    return !query.trim() || text.includes(query.trim().toLowerCase());
  }

  async function handleLibraryFiles(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) return;

    error = '';
    notice = '';
    isUploading = true;
    uploadStates = files.map((file) => ({ name: file.name, status: 'uploading' }));
    try {
      const tags = parseTags(uploadTags);
      for (const file of files) {
        try {
          const filename = files.length === 1 && uploadName.trim() ? uploadName.trim() : file.name;
          const uploaded = await uploadMediaAssetWithMetadata(file, {
            filename,
            asset_type: uploadAssetType,
            tags,
          });
          assets = [uploaded, ...assets.filter((asset) => asset.id !== uploaded.id)];
          uploadStates = uploadStates.map((item) => item.name === file.name ? { ...item, status: 'done' } : item);
        } catch (err) {
          uploadStates = uploadStates.map((item) => item.name === file.name
            ? { ...item, status: 'failed', message: humanizeError(err) }
            : item);
        }
      }
      notice = 'Upload เสร็จแล้ว';
      activeTab = 'uploads';
      uploadName = '';
    } finally {
      isUploading = false;
      input.value = '';
    }
  }

  function matchesGenerationFilters(generation: MediaGeneration) {
    if (modelId && generation.model_id !== modelId) return false;
    if (!matchesDate(generation.created_at)) return false;
    const text = `${generation.prompt} ${generation.model_id} ${generation.status}`.toLowerCase();
    return !query.trim() || text.includes(query.trim().toLowerCase());
  }

  function matchesDate(ts: number) {
    const now = Date.now();
    if (dateRange === '7d') return ts >= now - 7 * 24 * 60 * 60 * 1000;
    if (dateRange === '30d') return ts >= now - 30 * 24 * 60 * 60 * 1000;
    return true;
  }

  async function toggleFavorite(asset: MediaAsset) {
    try {
      const updated = await favoriteMediaAsset(asset.id, !asset.favorite);
      assets = assets.map((item) => item.id === updated.id ? updated : item);
    } catch (err) {
      error = humanizeError(err);
    }
  }

  async function archiveAsset(asset: MediaAsset) {
    try {
      const updated = await updateMediaAsset(asset.id, { lifecycle_status: 'archived' });
      assets = assets.map((item) => item.id === updated.id ? updated : item);
      notice = 'Archive แล้ว';
    } catch (err) {
      error = humanizeError(err);
    }
  }

  async function permanentlyDeleteAsset(asset: MediaAsset) {
    const ok = confirm(`ลบ "${asset.original_filename || asset.id}" ถาวร? การลบนี้เอากลับคืนไม่ได้`);
    if (!ok) return;
    try {
      await deleteMediaAsset(asset.id);
      assets = assets.filter((item) => item.id !== asset.id);
      notice = 'ลบถาวรแล้ว';
    } catch (err) {
      error = humanizeError(err);
    }
  }

  function beginEdit(asset: MediaAsset) {
    editingAssetId = asset.id;
    editName = asset.original_filename || '';
    editAssetType = asset.asset_type || 'image';
    editTags = assetTags(asset).join(', ');
  }

  function cancelEdit() {
    editingAssetId = '';
    editName = '';
    editTags = '';
    editAssetType = 'image';
  }

  async function saveEdit(asset: MediaAsset) {
    try {
      const updated = await updateMediaAsset(asset.id, {
        original_filename: editName,
        asset_type: editAssetType,
        tags: parseTags(editTags),
      });
      assets = assets.map((item) => item.id === updated.id ? updated : item);
      notice = 'บันทึก asset แล้ว';
      cancelEdit();
    } catch (err) {
      error = humanizeError(err);
    }
  }

  function reuseGeneration(generation: MediaGeneration) {
    localStorage.setItem('creativeStudioDraft', JSON.stringify({
      model_id: generation.model_id,
      prompt: generation.prompt,
      options: generation.options,
      references: [],
    }));
    goto('/studio');
  }

  function retryGeneration(generation: MediaGeneration) {
    reuseGeneration(generation);
  }

  function useAsReference(asset: MediaAsset) {
    const model = models.find((item) => (item.capabilities.references?.max || 0) > 0) || models[0];
    const mentionName = sanitizeMention(asset.original_filename?.replace(/\.[^.]+$/, '') || asset.asset_type || 'ref');
    const references: MediaReferenceInput[] = [{
      asset_id: asset.id,
      mention_name: mentionName,
      reference_role: model?.capabilities.references?.roles?.[0] || 'subject',
      influence_level: 'balanced',
      sort_order: 0,
    }];
    localStorage.setItem('creativeStudioDraft', JSON.stringify({
      model_id: model?.id,
      prompt: `สร้างภาพใหม่โดยอ้างอิง @${mentionName}`,
      options: { aspect_ratio: model?.capabilities.aspectRatios?.[0] || '1:1', response_format: 'url', num_images: 1 },
      references,
    }));
    goto('/studio');
  }

  function downloadUrl(asset: MediaAsset) {
    return getMediaAssetContentUrl(asset.id);
  }

  function modelName(id: string) {
    return models.find((model) => model.id === id)?.display_name || id;
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function sanitizeMention(value: string) {
    return value.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 28) || 'ref';
  }

  function parseTags(value: string) {
    return Array.from(new Set(value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)))
      .slice(0, 12);
  }

  function assetTags(asset: MediaAsset) {
    const tags = asset.metadata?.tags;
    return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [];
  }

  function humanizeError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err || '');
    const map: Record<string, string> = {
      feature_disabled: 'Creative Studio ยังไม่เปิดใช้งานบน environment นี้',
      asset_not_found: 'ไม่พบ asset หรือคุณไม่มีสิทธิ์เข้าถึง',
      invalid_lifecycle_status: 'สถานะ asset ไม่ถูกต้อง',
    };
    return map[message] || message || 'เกิดข้อผิดพลาด';
  }
</script>

<svelte:head>
  <title>Studio Library — Business Smart OS</title>
</svelte:head>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950 dark:text-dark-50">
  <main class="container-narrow max-w-7xl py-8">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <a href="/studio" class="text-sm text-dark-900/60 hover:text-primary-600 dark:text-dark-100/60">กลับ Studio</a>
        <h1 class="mt-2 text-3xl font-bold tracking-tight">Studio Library</h1>
      </div>
      <a href="/studio" class="btn-primary px-4 py-2 text-sm">New Generation</a>
    </div>

    {#if isLoading}
      <div class="rounded-lg border border-dark-100 bg-white p-8 text-center text-sm text-dark-900/60 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-100/60">
        กำลังโหลด Library...
      </div>
    {:else if !isFeatureEnabled}
      <div class="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        Creative Studio ยังไม่เปิดบน environment นี้
      </div>
    {:else}
      {#if error}
        <div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">{error}</div>
      {/if}
      {#if notice}
        <div class="mb-4 rounded-lg border border-success-100 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">{notice}</div>
      {/if}

      <section class="mb-5 rounded-lg border border-dark-100 bg-white p-4 dark:border-dark-700 dark:bg-dark-800">
        <div class="flex flex-wrap gap-2">
          {#each tabs as tab}
            <button
              onclick={() => activeTab = tab.id}
              class="rounded-full px-3 py-1.5 text-sm font-semibold {activeTab === tab.id ? 'bg-primary-600 text-white' : 'bg-dark-50 text-dark-900/70 hover:bg-dark-100 dark:bg-dark-900 dark:text-dark-100/70 dark:hover:bg-dark-700'}"
            >
              {tab.label}
            </button>
          {/each}
        </div>

        <div class="mt-4 grid gap-3 md:grid-cols-[1fr_10rem_10rem_12rem]">
          <input bind:value={query} type="search" placeholder="ค้นหา prompt, filename, model..." class="rounded-lg border border-dark-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-900" />
          <select bind:value={assetType} class="rounded-lg border border-dark-200 bg-white px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
            <option value="">Asset type</option>
            <option value="image">Image</option>
            <option value="product">Product</option>
            <option value="person">People</option>
            <option value="style">Style</option>
            <option value="logo">Logo</option>
            <option value="template">Template</option>
          </select>
          <select bind:value={dateRange} class="rounded-lg border border-dark-200 bg-white px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
            <option value="all">All dates</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <select bind:value={modelId} class="rounded-lg border border-dark-200 bg-white px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
            <option value="">All models</option>
            {#each models as model}
              <option value={model.id}>{model.display_name}</option>
            {/each}
          </select>
        </div>

        <div class="mt-4 rounded-lg border border-dashed border-dark-200 bg-dark-50 p-3 dark:border-dark-700 dark:bg-dark-900">
          <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_9rem_12rem_auto]">
            <input bind:value={uploadName} type="text" placeholder="ชื่อไฟล์ก่อน save (optional สำหรับ 1 ไฟล์)" class="rounded-lg border border-dark-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-950" />
            <select bind:value={uploadAssetType} class="rounded-lg border border-dark-200 bg-white px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-950">
              <option value="image">Image</option>
              <option value="product">Product</option>
              <option value="person">People</option>
              <option value="style">Style</option>
              <option value="logo">Logo</option>
              <option value="template">Template</option>
            </select>
            <input bind:value={uploadTags} type="text" placeholder="tags: ads, workshop, brand" class="rounded-lg border border-dark-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-950" />
            <label class="btn-primary cursor-pointer px-4 py-2 text-center text-sm">
              {isUploading ? 'Uploading...' : 'Upload'}
              <input type="file" accept="image/png,image/jpeg,image/webp" multiple onchange={handleLibraryFiles} class="sr-only" disabled={isUploading} />
            </label>
          </div>
          {#if uploadStates.length}
            <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {#each uploadStates as upload}
                <div class="flex items-center justify-between gap-3 rounded-md bg-white px-2 py-1.5 text-xs dark:bg-dark-950">
                  <span class="truncate">{upload.name}</span>
                  <span class={upload.status === 'failed' ? 'text-red-600' : upload.status === 'done' ? 'text-success-700 dark:text-green-300' : 'text-dark-900/50 dark:text-dark-100/50'}>
                    {upload.status === 'uploading' ? 'uploading' : upload.status === 'done' ? 'done' : upload.message || 'failed'}
                  </span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </section>

      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section class="rounded-lg border border-dark-100 bg-white p-4 dark:border-dark-700 dark:bg-dark-800">
          <div class="mb-4 flex items-center justify-between gap-3">
            <h2 class="text-base font-bold">Assets</h2>
            <span class="text-xs text-dark-900/50 dark:text-dark-100/50">{filteredAssets.length} items</span>
          </div>

          {#if filteredAssets.length}
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {#each filteredAssets as asset}
                <article class="overflow-hidden rounded-lg border border-dark-100 bg-dark-50 dark:border-dark-700 dark:bg-dark-900">
                  <a href={downloadUrl(asset)} target="_blank" rel="noreferrer" title="Open asset">
                    <img src={getMediaAssetContentUrl(asset.id)} alt={asset.original_filename || asset.id} class="aspect-square w-full object-cover" />
                  </a>
                  <div class="space-y-3 p-3">
                    {#if editingAssetId === asset.id}
                      <div class="space-y-2">
                        <input bind:value={editName} class="w-full rounded-md border border-dark-200 bg-white px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-800" />
                        <div class="grid grid-cols-2 gap-2">
                          <select bind:value={editAssetType} class="rounded-md border border-dark-200 bg-white px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-800">
                            <option value="image">Image</option>
                            <option value="product">Product</option>
                            <option value="person">People</option>
                            <option value="style">Style</option>
                            <option value="logo">Logo</option>
                            <option value="template">Template</option>
                          </select>
                          <input bind:value={editTags} placeholder="tags comma-separated" class="rounded-md border border-dark-200 bg-white px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-800" />
                        </div>
                        <div class="flex flex-wrap gap-2">
                          <button onclick={() => saveEdit(asset)} class="rounded-md bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white">Save</button>
                          <button onclick={cancelEdit} class="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-dark-900/70 dark:bg-dark-800 dark:text-dark-100/70">Cancel</button>
                        </div>
                      </div>
                    {:else}
                      <div>
                        <div class="truncate text-sm font-semibold">{asset.original_filename || asset.id}</div>
                        <div class="mt-1 text-xs text-dark-900/50 dark:text-dark-100/50">{asset.asset_type} · {asset.source} · {formatBytes(asset.file_size)}</div>
                        {#if assetTags(asset).length}
                          <div class="mt-2 flex flex-wrap gap-1">
                            {#each assetTags(asset) as tag}
                              <span class="rounded-full bg-dark-100 px-2 py-0.5 text-[11px] text-dark-900/70 dark:bg-dark-800 dark:text-dark-100/70">{tag}</span>
                            {/each}
                          </div>
                        {/if}
                      </div>
                      <div class="flex flex-wrap gap-2">
                        <button onclick={() => useAsReference(asset)} class="rounded-md bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-100 dark:bg-primary-900/40 dark:text-primary-300">Use as Reference</button>
                        <a href={downloadUrl(asset)} download class="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-dark-900/70 hover:bg-dark-100 dark:bg-dark-800 dark:text-dark-100/70 dark:hover:bg-dark-700">Download</a>
                        <button onclick={() => beginEdit(asset)} class="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-dark-900/70 hover:bg-dark-100 dark:bg-dark-800 dark:text-dark-100/70 dark:hover:bg-dark-700">Edit</button>
                        <button onclick={() => toggleFavorite(asset)} class="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-dark-900/70 hover:bg-dark-100 dark:bg-dark-800 dark:text-dark-100/70 dark:hover:bg-dark-700">{asset.favorite ? 'Unfavorite' : 'Favorite'}</button>
                        <button onclick={() => archiveAsset(asset)} class="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:bg-dark-800 dark:hover:bg-red-950/40">Archive</button>
                        <button onclick={() => permanentlyDeleteAsset(asset)} class="rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300">Delete forever</button>
                      </div>
                    {/if}
                  </div>
                </article>
              {/each}
            </div>
          {:else}
            <div class="rounded-lg border border-dashed border-dark-200 p-8 text-center text-sm text-dark-900/50 dark:border-dark-700 dark:text-dark-100/50">
              ยังไม่มี asset ใน filter นี้
            </div>
          {/if}
        </section>

        <aside class="rounded-lg border border-dark-100 bg-white p-4 dark:border-dark-700 dark:bg-dark-800">
          <div class="mb-4 flex items-center justify-between gap-3">
            <h2 class="text-base font-bold">Generations</h2>
            <span class="text-xs text-dark-900/50 dark:text-dark-100/50">{filteredGenerations.length}</span>
          </div>

          <div class="max-h-[44rem] space-y-3 overflow-y-auto pr-1">
            {#each filteredGenerations as generation}
              <article class="rounded-lg border border-dark-100 p-3 dark:border-dark-700">
                {#if generation.outputs?.length}
                  <div class="mb-3 grid grid-cols-3 gap-2">
                    {#each generation.outputs.slice(0, 3) as output}
                      <img src={getMediaAssetContentUrl(output.id)} alt={output.original_filename || output.id} class="aspect-square rounded-md object-cover" />
                    {/each}
                  </div>
                {/if}
                <div class="flex items-center justify-between gap-3">
                  <div class="truncate text-sm font-semibold">{modelName(generation.model_id)}</div>
                  <span class="rounded-full bg-dark-50 px-2 py-0.5 text-xs dark:bg-dark-900">{generation.status}</span>
                </div>
                <p class="mt-2 line-clamp-3 text-xs text-dark-900/60 dark:text-dark-100/60">{generation.prompt}</p>
                <div class="mt-2 text-xs text-dark-900/40 dark:text-dark-100/40">{formatDate(generation.created_at)} · {generation.estimated_credits} credits</div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <button onclick={() => reuseGeneration(generation)} class="rounded-md bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-100 dark:bg-primary-900/40 dark:text-primary-300">Reuse Prompt</button>
                  {#if generation.status === 'failed'}
                    <button onclick={() => retryGeneration(generation)} class="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-dark-900/70 hover:bg-dark-100 dark:bg-dark-900 dark:text-dark-100/70 dark:hover:bg-dark-700">Retry</button>
                  {/if}
                </div>
              </article>
            {:else}
              <div class="rounded-lg border border-dashed border-dark-200 p-5 text-center text-sm text-dark-900/50 dark:border-dark-700 dark:text-dark-100/50">
                ยังไม่มี generation
              </div>
            {/each}
          </div>
        </aside>
      </div>
    {/if}
  </main>
</div>
