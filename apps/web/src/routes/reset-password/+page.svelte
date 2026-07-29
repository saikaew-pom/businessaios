<script lang="ts">
  import { goto } from '$app/navigation';
  import { requestPasswordReset, resetPassword } from '$lib/api';

  let step = $state<'email' | 'otp' | 'done'>('email');
  let email = $state('');
  let otp = $state('');
  let newPwd = $state('');
  let isLoading = $state(false);
  let error = $state('');

  async function handleEmail(e: Event) {
    e.preventDefault();
    if (isLoading) return;
    error = '';
    isLoading = true;
    try {
      await requestPasswordReset(email);
      step = 'otp';
    } catch (err: any) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  }

  async function handleOtp(e: Event) {
    e.preventDefault();
    if (isLoading) return;
    error = '';
    isLoading = true;
    try {
      await resetPassword(email, otp, newPwd);
      step = 'done';
    } catch (err: any) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>รีเซ็ตรหัสผ่าน — Business Smart OS</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center p-4">
  <div class="w-full max-w-md">
    <a href="/" class="flex items-center gap-2 justify-center mb-8">
      <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
        <span class="text-white font-bold">B</span>
      </div>
      <span class="font-bold text-xl">Business Smart OS</span>
    </a>

    <div class="bg-white rounded-2xl shadow-xl border border-dark-100 p-8">
      {#if step === 'email'}
        <h1 class="text-2xl font-bold mb-2">🔑 รีเซ็ตรหัสผ่าน</h1>
        <p class="text-sm text-dark-900/60 mb-6">กรอกอีเมลที่ใช้สมัคร ระบบจะส่งรหัส OTP ไปให้</p>
        <form onsubmit={handleEmail} class="space-y-4">
          <div>
            <label for="email" class="block text-sm font-medium mb-1.5">อีเมล</label>
            <input id="email" type="email" bind:value={email} required class="w-full px-4 py-2.5 rounded-lg border border-dark-200 focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="you@example.com" />
          </div>
          {#if error}<div class="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>{/if}
          <button type="submit" disabled={isLoading} class="btn-primary w-full disabled:opacity-50">
            {isLoading ? 'กำลังส่ง...' : 'ส่งรหัส OTP'}
          </button>
        </form>
        <p class="text-sm text-center text-dark-900/60 mt-6">
          <a href="/login" class="text-primary-600 hover:underline">← กลับไปหน้า Login</a>
        </p>
      {:else if step === 'otp'}
        <h1 class="text-2xl font-bold mb-2">📬 ใส่รหัส OTP</h1>
        <p class="text-sm text-dark-900/60 mb-6">ส่งรหัส OTP ไปที่ <b>{email}</b> แล้ว กรุณาเช็คอีเมล</p>
        <form onsubmit={handleOtp} class="space-y-4">
          <div>
            <label for="otp" class="block text-sm font-medium mb-1.5">รหัส OTP 6 หลัก</label>
            <input id="otp" type="text" bind:value={otp} required maxlength="6" pattern="[0-9]{6}" class="w-full px-4 py-3 text-center text-2xl font-bold tracking-widest rounded-lg border border-dark-200 focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="000000" />
          </div>
          <div>
            <label for="newPwd" class="block text-sm font-medium mb-1.5">รหัสผ่านใหม่ (≥ 8 ตัว)</label>
            <input id="newPwd" type="password" bind:value={newPwd} required minlength="8" class="w-full px-4 py-2.5 rounded-lg border border-dark-200 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          {#if error}<div class="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>{/if}
          <button type="submit" disabled={isLoading} class="btn-primary w-full disabled:opacity-50">
            {isLoading ? 'กำลังเปลี่ยน...' : 'เปลี่ยนรหัสผ่าน'}
          </button>
        </form>
        <button onclick={() => step = 'email'} class="block w-full mt-3 text-sm text-dark-900/60 hover:underline">
          ← เปลี่ยนอีเมล
        </button>
      {:else}
        <div class="text-center">
          <div class="text-5xl mb-4">✅</div>
          <h1 class="text-xl font-bold mb-2 text-green-700">เปลี่ยนรหัสผ่านเรียบร้อย</h1>
          <p class="text-sm text-dark-900/60 mb-6">กรุณา login ใหม่ด้วยรหัสผ่านใหม่</p>
          <a href="/login" class="btn-primary inline-block">ไปหน้า Login</a>
        </div>
      {/if}
    </div>
  </div>
</div>
