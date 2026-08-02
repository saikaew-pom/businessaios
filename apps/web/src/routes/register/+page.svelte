<script lang="ts">
  import { goto } from '$app/navigation';
  import { register } from '$lib/auth';
  import TurnstileWidget from '$lib/TurnstileWidget.svelte';
  import { fetchConfig, type PublicConfig } from '$lib/config';
  import { onMount } from 'svelte';
  import { PUBLIC_API_URL } from '$env/static/public';

  let first_name = $state('');
  let last_name = $state('');
  let email = $state('');
  let password = $state('');
  let isSubmitting = $state(false);
  let error = $state('');
  let turnstileToken = $state<string | null>(null);
  let config = $state<PublicConfig | null>(null);
  let showPassword = $state(false);

  onMount(async () => {
    config = await fetchConfig();
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (isSubmitting) return;
    error = '';

    if (config?.turnstile.required && !turnstileToken) {
      error = 'กรุณายืนยันว่าคุณไม่ใช่บอท';
      return;
    }

    isSubmitting = true;
    try {
      await register(email, password, { first_name, last_name, turnstile_token: turnstileToken || undefined });
      goto('/dashboard');
    } catch (err: any) {
      error = err.message || 'สมัครสมาชิกไม่สำเร็จ';
    } finally {
      isSubmitting = false;
    }
  }

  function signupWithGoogle() {
    window.location.href = `${PUBLIC_API_URL}/api/auth/google`;
  }
</script>

<svelte:head>
  <title>สมัครสมาชิก — Business Smart OS</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-dark-950 dark:via-dark-900 dark:to-dark-950 flex items-center justify-center p-4">
  <div class="w-full max-w-md">
    <a href="/" class="flex items-center gap-2 justify-center mb-8">
      <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
        <span class="text-white font-bold">B</span>
      </div>
      <span class="font-bold text-xl">Business Smart OS</span>
    </a>

    <div class="bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-dark-100 dark:border-dark-700 p-8">
      <h1 class="text-2xl font-bold mb-2">สมัครสมาชิก</h1>
      <p class="text-sm text-dark-900/60 dark:text-dark-100/60 mb-6">ฟรี 200 เครดิต เริ่มต้น · ไม่ต้องใส่บัตรเครดิต</p>

      <button
        type="button"
        onclick={signupWithGoogle}
        disabled={!config?.features.google_oauth}
        class="w-full mb-2 flex items-center justify-center gap-3 px-4 py-2.5 border border-dark-200 dark:border-dark-600 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition font-medium text-sm disabled:cursor-not-allowed disabled:opacity-50"
        title={config?.features.google_oauth ? 'สมัครด้วย Google' : 'Google OAuth ยังไม่ได้ตั้งค่าบน environment นี้'}
      >
        <svg class="w-5 h-5" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
          <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
          <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
        </svg>
        สมัครด้วย Google
      </button>
      {#if config && !config.features.google_oauth}
        <p class="mb-4 text-center text-xs text-amber-700 dark:text-amber-300">Google OAuth ยังไม่ได้ตั้งค่าบน environment นี้</p>
      {/if}

      <div class="flex items-center gap-3 my-4">
        <div class="flex-1 h-px bg-dark-200 dark:bg-dark-700"></div>
        <span class="text-xs text-dark-900/50 dark:text-dark-100/50">หรือสมัครด้วยอีเมล</span>
        <div class="flex-1 h-px bg-dark-200 dark:bg-dark-700"></div>
      </div>

      <form onsubmit={handleSubmit} class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="first_name" class="block text-sm font-medium mb-1.5">ชื่อ</label>
            <input
              id="first_name"
              type="text"
              bind:value={first_name}
              required
              class="w-full px-4 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label for="last_name" class="block text-sm font-medium mb-1.5">นามสกุล</label>
            <input
              id="last_name"
              type="text"
              bind:value={last_name}
              class="w-full px-4 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div>
          <label for="email" class="block text-sm font-medium mb-1.5">อีเมล</label>
          <input
            id="email"
            type="email"
            bind:value={email}
            required
            class="w-full px-4 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium mb-1.5">รหัสผ่าน</label>
          <div class="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              bind:value={password}
              required
              minlength="8"
              class="w-full px-4 py-2.5 pr-11 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="อย่างน้อย 8 ตัวอักษร"
            />
            <button
              type="button"
              onclick={() => (showPassword = !showPassword)}
              class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-dark-900/50 dark:text-dark-100/50 hover:text-dark-900 dark:hover:text-dark-50 transition"
              aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              tabindex="-1"
            >
              {#if showPassword}
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                </svg>
              {:else}
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              {/if}
            </button>
          </div>
          <div class="text-xs text-dark-900/50 dark:text-dark-100/50 mt-1">ตัวอักษร a-z, A-Z, 0-9, อักขระพิเศษ</div>
        </div>

        {#if config?.turnstile.required && config?.turnstile.site_key}
          <TurnstileWidget
            siteKey={config.turnstile.site_key}
            onTokenChange={(t) => turnstileToken = t}
          />
        {/if}

        {#if error}
          <div class="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        {/if}

        <button
          type="submit"
          disabled={isSubmitting}
          class="btn-primary w-full disabled:opacity-50"
        >
          {isSubmitting ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิก'}
        </button>
      </form>

      <p class="text-sm text-center text-dark-900/60 dark:text-dark-100/60 mt-6">
        มีบัญชีอยู่แล้ว?
        <a href="/login" class="text-primary-600 dark:text-primary-400 font-semibold hover:underline">เข้าสู่ระบบ</a>
      </p>
    </div>
  </div>
</div>
