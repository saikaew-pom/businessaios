<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { verifyEmail, sendVerification } from '$lib/api';
  import { fullUser, initAuth, isAuthed, refreshFullUser } from '$lib/auth';

  let status = $state<'idle' | 'verifying' | 'success' | 'error'>('idle');
  let message = $state('');

  onMount(async () => {
    await initAuth();
    if (!$isAuthed) {
      goto('/login');
      return;
    }
    const token = $page.url.searchParams.get('token');
    if (token) {
      await doVerify(token);
    }
  });

  async function doVerify(token: string) {
    status = 'verifying';
    try {
      await verifyEmail(token);
      await refreshFullUser();
      status = 'success';
      message = 'ยืนยันอีเมลสำเร็จ!';
      setTimeout(() => goto('/dashboard'), 2000);
    } catch (err: any) {
      status = 'error';
      message = err.message;
    }
  }

  async function handleResend() {
    try {
      await sendVerification();
      message = 'ส่งอีเมลยืนยันใหม่แล้ว กรุณาเช็คอีเมล';
    } catch (err: any) {
      message = err.message;
    }
  }
</script>

<svelte:head>
  <title>ยืนยันอีเมล — Business Smart OS</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center p-4">
  <div class="w-full max-w-md">
    <a href="/dashboard" class="flex items-center gap-2 justify-center mb-8">
      <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
        <span class="text-white font-bold">B</span>
      </div>
      <span class="font-bold text-xl">Business Smart OS</span>
    </a>

    <div class="bg-white rounded-2xl shadow-xl border border-dark-100 p-8 text-center">
      {#if status === 'verifying'}
        <div class="text-5xl mb-4">⏳</div>
        <h1 class="text-xl font-bold mb-2">กำลังยืนยันอีเมล...</h1>
      {:else if status === 'success'}
        <div class="text-5xl mb-4">✅</div>
        <h1 class="text-xl font-bold mb-2 text-green-700">ยืนยันอีเมลสำเร็จ!</h1>
        <p class="text-sm text-dark-900/60">กำลังพากลับไปยัง Dashboard...</p>
      {:else if status === 'error'}
        <div class="text-5xl mb-4">❌</div>
        <h1 class="text-xl font-bold mb-2 text-red-700">ยืนยันไม่สำเร็จ</h1>
        <p class="text-sm text-dark-900/60 mb-4">{message}</p>
        <button onclick={handleResend} class="btn-primary">ส่งอีเมลยืนยันใหม่</button>
        <a href="/dashboard" class="block mt-3 text-sm text-dark-900/60 hover:underline">กลับไป Dashboard</a>
      {:else}
        <div class="text-5xl mb-4">📧</div>
        <h1 class="text-xl font-bold mb-2">ยืนยันอีเมล</h1>
        <p class="text-sm text-dark-900/60 mb-6">
          กรุณาคลิกลิงก์ในอีเมลที่ส่งไป เพื่อยืนยันการสมัคร
        </p>
        <button onclick={handleResend} class="btn-primary">ส่งอีเมลยืนยันอีกครั้ง</button>
        <a href="/dashboard" class="block mt-3 text-sm text-dark-900/60 hover:underline">กลับไป Dashboard</a>
      {/if}
    </div>
  </div>
</div>
