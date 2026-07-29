<script lang="ts">
  /**
   * ToolLayout — Shared layout for standalone tools
   */
  import { goto } from '$app/navigation';
  import { user, logout, isAuthed } from '$lib/auth';
  import { onMount } from 'svelte';
  import { locale, toggleLocale } from '$lib/stores';
  import { t } from '$lib/i18n';

  let { title, subtitle, icon, color = 'blue', children }: {
    title: string;
    subtitle: string;
    icon: string;
    color?: 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'indigo' | 'amber' | 'rose' | 'teal';
    children?: any;
  } = $props();

  onMount(async () => {
    const { initAuth } = await import('$lib/auth');
    await initAuth();
    if (!$isAuthed) goto('/login');
  });

  async function handleLogout() {
    await logout();
    goto('/');
  }

  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500 to-blue-700',
    purple: 'from-purple-500 to-purple-700',
    green: 'from-green-500 to-green-700',
    orange: 'from-orange-500 to-orange-700',
    red: 'from-red-500 to-red-700',
    indigo: 'from-indigo-500 to-indigo-700',
    amber: 'from-amber-500 to-amber-700',
    rose: 'from-rose-500 to-rose-700',
    teal: 'from-teal-500 to-teal-700',
  };
</script>

<div class="min-h-screen bg-dark-50">
  <!-- Header -->
  <header class="bg-white border-b border-dark-100 sticky top-0 z-10">
    <div class="container-narrow flex items-center justify-between h-16">
      <div class="flex items-center gap-3">
        <a href="/dashboard" class="text-dark-900/60 hover:text-dark-900">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </a>
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <span class="text-white font-bold text-sm">M</span>
          </div>
          <span class="font-bold">{title}</span>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button
          onclick={toggleLocale}
          class="text-xs font-semibold px-2.5 py-1 rounded border border-dark-200 hover:bg-dark-50 transition"
          aria-label="Toggle language"
        >
          {$locale === 'th' ? 'EN' : 'TH'}
        </button>
        {#if $user}
          <span class="text-sm text-dark-900/60 hidden sm:block">{$user.email}</span>
        {/if}
        <button onclick={handleLogout} class="text-sm text-dark-900/60 hover:text-dark-900">ออก</button>
      </div>
    </div>
  </header>

  <main class="container-narrow py-8 max-w-4xl">
    <!-- Hero -->
    <div class={`bg-gradient-to-br ${colorClasses[color]} text-white rounded-3xl p-8 sm:p-10 mb-6 shadow-xl`}>
      <div class="text-6xl mb-4">{icon}</div>
      <h1 class="text-3xl sm:text-4xl font-bold mb-3">{title}</h1>
      <p class="text-lg text-white/90 max-w-2xl">{subtitle}</p>
    </div>

    <!-- Content slot -->
    <div class="bg-white rounded-2xl border border-dark-100 p-6 sm:p-8">
      {@render children?.()}
    </div>

    <!-- Footer -->
    <div class="mt-8 text-center text-sm text-dark-900/50">
      <a href="/dashboard" class="hover:text-primary-600">← กลับไป Dashboard</a>
    </div>
  </main>
</div>
