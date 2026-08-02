<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { fullUser, initAuth, isAuthed } from '$lib/auth';
  import {
    adminGetCreativeStats,
    adminListCreativeModels,
    adminListProviderKeys,
    adminRunCreativeReconcile,
    adminSetProviderKey,
    adminUpdateCreativeModel,
    type AdminCreativeModel,
    type AdminProviderKey,
  } from '$lib/api';

  let isLoading = true;
  let actionBusy = false;
  let schemaReady = false;
  let models: AdminCreativeModel[] = [];
  let stats: any = null;
  let error = '';
  let notice = '';

  // Only providers whose runtime adapter reads platform_provider_keys belong
  // here — MiniMax uses a Worker secret (env.MINIMAX_API_KEY), so a platform
  // key entered for it would be silently ignored at generation time. Keep in
  // sync with KNOWN_MEDIA_PROVIDERS in apps/api/src/adminRoutes.ts.
  const KNOWN_PROVIDERS = ['fal'];
  let providerKeys: AdminProviderKey[] = [];
  let keyFormProvider = 'fal';
  let keyFormValue = '';
  let keyFormBusy = false;

  onMount(async () => {
    await initAuth();
    if (!$isAuthed) {
      goto('/login');
      return;
    }
    if ($fullUser?.role !== 'admin') {
      goto('/dashboard');
      return;
    }
    await loadAll();
  });

  async function loadAll() {
    error = '';
    isLoading = true;
    try {
      const [modelRes, statsRes, providerRes] = await Promise.all([
        adminListCreativeModels(),
        adminGetCreativeStats(),
        adminListProviderKeys(),
      ]);
      schemaReady = modelRes.schema_ready && statsRes.schema_ready;
      models = modelRes.models;
      stats = statsRes.stats;
      providerKeys = providerRes.providers;
    } catch (err) {
      error = err instanceof Error ? err.message : 'โหลด Creative Ops ไม่สำเร็จ';
    } finally {
      isLoading = false;
    }
  }

  function providerKeyHint(provider: string) {
    return providerKeys.find((p) => p.provider === provider)?.key_hint || null;
  }

  async function saveProviderKey() {
    if (!keyFormValue.trim()) return;
    error = '';
    notice = '';
    keyFormBusy = true;
    try {
      const res = await adminSetProviderKey(keyFormProvider, keyFormValue);
      notice = `บันทึก API key ของ ${keyFormProvider} แล้ว (${res.key_hint}) — ปิด maintenance ให้อัตโนมัติ`;
      keyFormValue = '';
      await loadAll();
    } catch (err) {
      error = err instanceof Error ? err.message : 'บันทึก API key ไม่สำเร็จ';
    } finally {
      keyFormBusy = false;
    }
  }

  async function toggleModel(model: AdminCreativeModel, field: 'is_active' | 'is_maintenance') {
    error = '';
    notice = '';
    actionBusy = true;
    try {
      await adminUpdateCreativeModel(model.id, { [field]: !model[field] });
      notice = 'บันทึก model แล้ว';
      await loadAll();
    } catch (err) {
      error = err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ';
    } finally {
      actionBusy = false;
    }
  }

  async function runReconcile() {
    actionBusy = true;
    error = '';
    notice = '';
    try {
      const res = await adminRunCreativeReconcile();
      notice = `Reconcile claimed ${res.result.claimed} work item(s)`;
      await loadAll();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Reconcile ไม่สำเร็จ';
    } finally {
      actionBusy = false;
    }
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(4)}`;
  }
</script>

<svelte:head>
  <title>Creative Ops — Business Smart OS</title>
</svelte:head>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950 dark:text-dark-50">
  <main class="container-narrow max-w-7xl py-8">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <a href="/admin" class="text-sm text-dark-900/60 hover:text-primary-600 dark:text-dark-100/60">กลับ Admin</a>
        <h1 class="mt-2 text-3xl font-bold tracking-tight">Creative Ops</h1>
      </div>
      <div class="flex gap-2">
        <button onclick={loadAll} disabled={isLoading || actionBusy} class="btn-secondary px-4 py-2 text-sm disabled:opacity-50">Refresh</button>
        <button onclick={runReconcile} disabled={!schemaReady || actionBusy} class="btn-primary px-4 py-2 text-sm disabled:opacity-50">Run Reconcile</button>
      </div>
    </div>

    {#if error}
      <div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">{error}</div>
    {/if}
    {#if notice}
      <div class="mb-4 rounded-lg border border-success-100 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">{notice}</div>
    {/if}

    {#if isLoading}
      <div class="rounded-lg border border-dark-100 bg-white p-8 text-center text-sm text-dark-900/60 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-100/60">กำลังโหลด...</div>
    {:else if !schemaReady}
      <div class="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        Creative Studio schema ยังไม่พร้อมบน environment นี้
      </div>
    {:else}
      <section class="mb-5 grid gap-4 md:grid-cols-4">
        <div class="rounded-lg border border-dark-100 bg-white p-4 dark:border-dark-700 dark:bg-dark-800">
          <div class="text-xs text-dark-900/50 dark:text-dark-100/50">Active jobs</div>
          <div class="mt-1 text-2xl font-bold">{(stats.generations_by_status || []).filter((row: any) => ['queued', 'submitting', 'processing', 'delivery_pending'].includes(row.status)).reduce((sum: number, row: any) => sum + row.count, 0)}</div>
        </div>
        <div class="rounded-lg border border-dark-100 bg-white p-4 dark:border-dark-700 dark:bg-dark-800">
          <div class="text-xs text-dark-900/50 dark:text-dark-100/50">Stuck jobs</div>
          <div class="mt-1 text-2xl font-bold">{stats.stuck_generations?.length || 0}</div>
        </div>
        <div class="rounded-lg border border-dark-100 bg-white p-4 dark:border-dark-700 dark:bg-dark-800">
          <div class="text-xs text-dark-900/50 dark:text-dark-100/50">Dead letters</div>
          <div class="mt-1 text-2xl font-bold">{(stats.work_queue || []).filter((row: any) => row.status === 'dead_letter').reduce((sum: number, row: any) => sum + row.count, 0)}</div>
        </div>
        <div class="rounded-lg border border-dark-100 bg-white p-4 dark:border-dark-700 dark:bg-dark-800">
          <div class="text-xs text-dark-900/50 dark:text-dark-100/50">Reserved credits</div>
          <div class="mt-1 text-2xl font-bold">{(stats.holds_by_status || []).filter((row: any) => row.status === 'reserved').reduce((sum: number, row: any) => sum + row.credits, 0)}</div>
        </div>
      </section>

      <section class="mb-5 rounded-lg border border-dark-100 bg-white p-4 dark:border-dark-700 dark:bg-dark-800">
        <h2 class="mb-4 text-base font-bold">Provider API Keys</h2>
        <p class="mb-4 text-xs text-dark-900/50 dark:text-dark-100/50">
          เก็บแบบเข้ารหัสใน database ไม่ใช่ Worker secret — วางแล้วใช้ได้ทันทีโดยไม่ต้อง deploy และจะปิด maintenance ของ provider นั้นให้อัตโนมัติ
        </p>
        <div class="mb-4 flex flex-wrap gap-2">
          {#each KNOWN_PROVIDERS as provider}
            <div class="rounded-md bg-dark-50 px-3 py-2 text-sm dark:bg-dark-900">
              <span class="font-semibold">{provider}</span>:
              {#if providerKeyHint(provider)}
                <span class="text-dark-900/60 dark:text-dark-100/60">{providerKeyHint(provider)}</span>
              {:else}
                <span class="text-amber-700 dark:text-amber-400">ยังไม่ตั้งค่า</span>
              {/if}
            </div>
          {/each}
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <div>
            <label class="mb-1 block text-xs text-dark-900/60 dark:text-dark-100/60" for="key-provider">Provider</label>
            <select id="key-provider" bind:value={keyFormProvider} class="rounded-md border border-dark-200 bg-white px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900">
              {#each KNOWN_PROVIDERS as provider}
                <option value={provider}>{provider}</option>
              {/each}
            </select>
          </div>
          <div class="flex-1 min-w-[240px]">
            <label class="mb-1 block text-xs text-dark-900/60 dark:text-dark-100/60" for="key-value">API key</label>
            <input
              id="key-value"
              type="password"
              bind:value={keyFormValue}
              placeholder="วาง API key ที่นี่"
              class="w-full rounded-md border border-dark-200 bg-white px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900"
            />
          </div>
          <button onclick={saveProviderKey} disabled={keyFormBusy || !keyFormValue.trim()} class="btn-primary px-4 py-1.5 text-sm disabled:opacity-50">Save</button>
        </div>
      </section>

      <section class="mb-5 rounded-lg border border-dark-100 bg-white p-4 dark:border-dark-700 dark:bg-dark-800">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-base font-bold">Models</h2>
          <span class="text-xs text-dark-900/50 dark:text-dark-100/50">{models.length}</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[760px] text-sm">
            <thead class="text-left text-xs uppercase text-dark-900/50 dark:text-dark-100/50">
              <tr class="border-b border-dark-100 dark:border-dark-700">
                <th class="p-3">Model</th>
                <th class="p-3">Provider</th>
                <th class="p-3">Pricing</th>
                <th class="p-3">Version</th>
                <th class="p-3">State</th>
                <th class="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each models as model}
                <tr class="border-b border-dark-100 last:border-0 dark:border-dark-700">
                  <td class="p-3">
                    <div class="font-semibold">{model.display_name}</div>
                    <div class="mt-1 text-xs text-dark-900/50 dark:text-dark-100/50">{model.id} · {model.operation}</div>
                  </td>
                  <td class="p-3">{model.provider}</td>
                  <td class="p-3">{model.pricing?.credits_per_output || '-'} credits/output</td>
                  <td class="p-3">v{model.config_version}</td>
                  <td class="p-3">
                    <div class="flex flex-wrap gap-1">
                      <span class="rounded-full px-2 py-0.5 text-xs {model.is_active ? 'bg-success-50 text-success-700 dark:bg-green-950/30 dark:text-green-300' : 'bg-dark-100 text-dark-900/60 dark:bg-dark-900 dark:text-dark-100/60'}">{model.is_active ? 'active' : 'inactive'}</span>
                      {#if model.is_maintenance}
                        <span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">maintenance</span>
                      {/if}
                    </div>
                  </td>
                  <td class="p-3">
                    <div class="flex justify-end gap-2">
                      <button onclick={() => toggleModel(model, 'is_active')} disabled={actionBusy} class="rounded-md border border-dark-200 px-2.5 py-1 text-xs font-semibold hover:bg-dark-50 disabled:opacity-50 dark:border-dark-600 dark:hover:bg-dark-900">{model.is_active ? 'Disable' : 'Enable'}</button>
                      <button onclick={() => toggleModel(model, 'is_maintenance')} disabled={actionBusy} class="rounded-md border border-dark-200 px-2.5 py-1 text-xs font-semibold hover:bg-dark-50 disabled:opacity-50 dark:border-dark-600 dark:hover:bg-dark-900">{model.is_maintenance ? 'Exit Maintenance' : 'Maintenance'}</button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <div class="grid gap-5 lg:grid-cols-2">
        <section class="rounded-lg border border-dark-100 bg-white p-4 dark:border-dark-700 dark:bg-dark-800">
          <h2 class="mb-4 text-base font-bold">Queue</h2>
          <div class="space-y-2">
            {#each stats.work_queue || [] as row}
              <div class="flex items-center justify-between rounded-md bg-dark-50 px-3 py-2 text-sm dark:bg-dark-900">
                <span>{row.work_type} · {row.status}</span>
                <span class="font-semibold">{row.count}</span>
              </div>
            {:else}
              <div class="text-sm text-dark-900/50 dark:text-dark-100/50">ไม่มี queue</div>
            {/each}
          </div>
        </section>

        <section class="rounded-lg border border-dark-100 bg-white p-4 dark:border-dark-700 dark:bg-dark-800">
          <h2 class="mb-4 text-base font-bold">Provider Attempts</h2>
          <div class="space-y-2">
            {#each stats.attempts_by_provider || [] as row}
              <div class="flex items-center justify-between rounded-md bg-dark-50 px-3 py-2 text-sm dark:bg-dark-900">
                <span>{row.provider} · {row.status}</span>
                <span class="font-semibold">{row.count} · {formatMoney(row.provider_cost_usd)}</span>
              </div>
            {:else}
              <div class="text-sm text-dark-900/50 dark:text-dark-100/50">ยังไม่มี attempt</div>
            {/each}
          </div>
        </section>
      </div>

      <section class="mt-5 rounded-lg border border-dark-100 bg-white p-4 dark:border-dark-700 dark:bg-dark-800">
        <h2 class="mb-4 text-base font-bold">Recent Errors</h2>
        <div class="space-y-2">
          {#each stats.recent_errors || [] as row}
            <div class="rounded-md bg-dark-50 px-3 py-2 text-sm dark:bg-dark-900">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="font-semibold">{row.error_code || row.status}</span>
                <span class="text-xs text-dark-900/50 dark:text-dark-100/50">{formatDate(row.updated_at)}</span>
              </div>
              <div class="mt-1 break-all text-xs text-dark-900/60 dark:text-dark-100/60">{row.id} · {row.model_id}</div>
              {#if row.error_message}
                <div class="mt-1 text-xs text-red-600 dark:text-red-300">{row.error_message}</div>
              {/if}
            </div>
          {:else}
            <div class="text-sm text-dark-900/50 dark:text-dark-100/50">ยังไม่มี error</div>
          {/each}
        </div>
      </section>
    {/if}
  </main>
</div>
