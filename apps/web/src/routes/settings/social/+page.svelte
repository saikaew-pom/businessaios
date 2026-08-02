<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import {
    createManualSocialAccount,
    getSocialCapabilities,
    listSocialAccounts,
    type SocialAccount,
  } from '$lib/api';
  import { initAuth, isAuthed } from '$lib/auth';
  import { fetchConfig } from '$lib/config';

  let isLoading = true;
  let isFeatureEnabled = false;
  let capabilities: Awaited<ReturnType<typeof getSocialCapabilities>> | null = null;
  let accounts: SocialAccount[] = [];
  let error = '';
  let notice = '';
  let provider = 'meta';
  let displayName = '';
  let providerAccountId = '';
  let isSaving = false;

  onMount(async () => {
    await initAuth();
    if (!$isAuthed) {
      goto('/login');
      return;
    }
    try {
      const config = await fetchConfig();
      isFeatureEnabled = Boolean(config.features.social_publishing);
      if (!isFeatureEnabled) return;
      await loadSocial();
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isLoading = false;
    }
  });

  async function loadSocial() {
    [capabilities, accounts] = await Promise.all([
      getSocialCapabilities(),
      listSocialAccounts(),
    ]);
  }

  async function createManualAccount(e: Event) {
    e.preventDefault();
    if (!displayName.trim() || isSaving) return;
    isSaving = true;
    error = '';
    try {
      await createManualSocialAccount({
        provider,
        display_name: displayName.trim(),
        provider_account_id: providerAccountId.trim() || undefined,
      });
      displayName = '';
      providerAccountId = '';
      notice = 'เพิ่ม manual account แล้ว';
      await loadSocial();
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isSaving = false;
    }
  }

  function humanizeError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err || '');
    const map: Record<string, string> = {
      feature_disabled: 'Social Publishing ยังไม่เปิดใช้งานบน environment นี้',
      provider_required: 'กรุณาเลือก provider',
      display_name_required: 'กรุณาใส่ชื่อ account',
    };
    return map[message] || message || 'ทำรายการไม่สำเร็จ';
  }
</script>

<svelte:head>
  <title>Social Connections — Business Smart OS</title>
</svelte:head>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950">
  <main class="container-narrow py-6 space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div class="text-sm text-primary-600 dark:text-primary-400 font-semibold">Settings</div>
        <h1 class="heading-2">Social Connections</h1>
        <p class="text-dark-900/60 dark:text-dark-100/60">สถานะ direct publishing และ manual publishing accounts</p>
      </div>
      <a href="/works" class="btn-secondary">เปิด Works</a>
    </div>

    {#if error}
      <div class="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>
    {/if}
    {#if notice}
      <div class="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 p-3 text-sm text-green-700 dark:text-green-300">{notice}</div>
    {/if}

    {#if isLoading}
      <div class="py-16 text-center text-dark-900/60 dark:text-dark-100/60">กำลังโหลด...</div>
    {:else if !isFeatureEnabled}
      <div class="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-5">
        <div class="font-semibold text-amber-900 dark:text-amber-200">Social Publishing ยังปิดอยู่</div>
        <div class="text-sm text-amber-800 dark:text-amber-300 mt-1">เปิด `SOCIAL_PUBLISHING_ENABLED=true` หลัง apply migration Phase 10 แล้วจึงเริ่มทดสอบ manual publishing ได้</div>
      </div>
    {:else}
      <section class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
        <h2 class="font-bold text-dark-900 dark:text-dark-50">Provider Capability</h2>
        <p class="mt-1 text-sm text-dark-900/60 dark:text-dark-100/60">{capabilities?.note}</p>
        <div class="mt-4 grid md:grid-cols-3 gap-3">
          {#each capabilities?.providers || [] as item}
            <div class="rounded-lg border border-dark-100 dark:border-dark-700 p-3">
              <div class="font-semibold text-dark-900 dark:text-dark-50">{item.label}</div>
              <div class="mt-1 text-sm {item.configured ? 'text-amber-700 dark:text-amber-300' : 'text-dark-900/50 dark:text-dark-100/50'}">
                {item.setup_state}
              </div>
              <div class="mt-2 text-xs text-dark-900/50 dark:text-dark-100/50">Direct publish: {item.direct_publish_enabled ? 'enabled' : 'locked'}</div>
            </div>
          {/each}
        </div>
      </section>

      <form onsubmit={createManualAccount} class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4 space-y-4">
        <h2 class="font-bold text-dark-900 dark:text-dark-50">เพิ่ม Manual Account</h2>
        <div class="grid md:grid-cols-[180px_1fr_1fr] gap-3">
          <select bind:value={provider} class="input">
            <option value="meta">Facebook / Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="line">LINE OA</option>
          </select>
          <input bind:value={displayName} class="input" placeholder="ชื่อเพจ / account" />
          <input bind:value={providerAccountId} class="input" placeholder="Account ID ถ้ามี" />
        </div>
        <button type="submit" disabled={isSaving} class="btn-primary">{isSaving ? 'กำลังบันทึก...' : 'Add Account'}</button>
      </form>

      <section class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
        <h2 class="font-bold text-dark-900 dark:text-dark-50">Accounts</h2>
        {#if !accounts.length}
          <p class="mt-2 text-sm text-dark-900/60 dark:text-dark-100/60">ยังไม่มี account</p>
        {:else}
          <div class="mt-3 divide-y divide-dark-100 dark:divide-dark-700">
            {#each accounts as account}
              <div class="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div class="font-semibold text-dark-900 dark:text-dark-50">{account.display_name}</div>
                  <div class="text-sm text-dark-900/50 dark:text-dark-100/50">{account.provider} · {account.connection_status}</div>
                </div>
                <span class="rounded-full bg-dark-100 dark:bg-dark-700 px-3 py-1 text-xs font-semibold text-dark-900 dark:text-dark-50">{account.provider_account_id}</span>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  </main>
</div>
