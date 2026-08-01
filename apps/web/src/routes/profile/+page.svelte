<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { fullUser, initAuth, isAuthed, refreshFullUser, logout } from '$lib/auth';
  import { theme, toggleTheme } from '$lib/theme';
  import { updateProfile, uploadAvatar, changePassword, getCredits, sendVerification, toggle2FA } from '$lib/api';

  let first_name = $state('');
  let last_name = $state('');
  let phone = $state('');
  let isSaving = $state(false);
  let saveMsg = $state('');

  let oldPwd = $state('');
  let newPwd = $state('');
  let pwdMsg = $state('');
  let isChangingPwd = $state(false);

  let balance = $state(0);
  let history = $state<any[]>([]);

  let avatarFile = $state<HTMLInputElement | null>(null);
  let isUploadingAvatar = $state(false);
  let avatarMsg = $state('');

  onMount(async () => {
    await initAuth();
    if (!$isAuthed) {
      goto('/login');
      return;
    }
    if ($fullUser) {
      first_name = $fullUser.first_name || '';
      last_name = $fullUser.last_name || '';
      phone = $fullUser.phone || '';
    }
    await loadCredits();
  });

  async function loadCredits() {
    const res = await getCredits();
    balance = res.balance;
    history = res.history;
  }

  async function handleSaveProfile(e: Event) {
    e.preventDefault();
    if (isSaving) return;
    isSaving = true;
    saveMsg = '';
    try {
      await updateProfile({ first_name, last_name, phone });
      await refreshFullUser();
      saveMsg = '✓ บันทึกเรียบร้อย';
    } catch (err: any) {
      saveMsg = '✗ ' + err.message;
    } finally {
      isSaving = false;
      setTimeout(() => saveMsg = '', 3000);
    }
  }

  async function handleChangePassword(e: Event) {
    e.preventDefault();
    if (isChangingPwd) return;
    pwdMsg = '';
    if (newPwd.length < 8) {
      pwdMsg = '✗ รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัว';
      return;
    }
    isChangingPwd = true;
    try {
      await changePassword(oldPwd, newPwd);
      pwdMsg = '✓ เปลี่ยนรหัสผ่านเรียบร้อย';
      oldPwd = '';
      newPwd = '';
    } catch (err: any) {
      pwdMsg = '✗ ' + err.message;
    } finally {
      isChangingPwd = false;
    }
  }

  async function handleAvatarChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      avatarMsg = '✗ รูปต้องไม่เกิน 1MB';
      return;
    }
    isUploadingAvatar = true;
    avatarMsg = '';
    try {
      // Resize via canvas
      const img = new Image();
      const reader = new FileReader();
      reader.onload = async () => {
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const max = 256;
          let w = img.width, h = img.height;
          if (w > h) { h = (h / w) * max; w = max; }
          else { w = (w / h) * max; h = max; }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, w, h);
          const data_url = canvas.toDataURL('image/jpeg', 0.85);
          await uploadAvatar(data_url);
          await refreshFullUser();
          avatarMsg = '✓ อัปโหลดรูปโปรไฟล์เรียบร้อย';
          isUploadingAvatar = false;
          setTimeout(() => avatarMsg = '', 3000);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      avatarMsg = '✗ ' + err.message;
      isUploadingAvatar = false;
    }
  }

  async function handleToggle2FA() {
    if (!$fullUser) return;
    try {
      await toggle2FA(!$fullUser.two_factor_enabled);
      await refreshFullUser();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async function handleLogout() {
    await logout();
    goto('/');
  }
</script>

<svelte:head>
  <title>โปรไฟล์ — Business Smart OS</title>
</svelte:head>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950 dark:text-dark-50">
  <main class="container-narrow py-10 space-y-6 max-w-2xl">
    <a href="/dashboard" class="text-sm text-primary-600 hover:underline">← กลับ Dashboard</a>
    <h1 class="heading-2">โปรไฟล์</h1>

    <!-- Profile card -->
    <div class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-6">
      <h2 class="font-semibold mb-4">ข้อมูลส่วนตัว</h2>

      <div class="flex items-center gap-4 mb-6 pb-6 border-b border-dark-100 dark:border-dark-700">
        <div class="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
          {#if $fullUser?.avatar_url}
            <img src={`${(typeof window !== 'undefined' ? window.location.origin : '')}/api/me/avatar?nocache=${$fullUser.updated_at || Date.now()}`} alt="avatar" class="w-full h-full object-cover" />
          {:else}
            {($fullUser?.first_name || $fullUser?.name || $fullUser?.email || '?').charAt(0).toUpperCase()}
          {/if}
        </div>
        <div class="flex-1">
          <input type="file" accept="image/*" class="hidden" bind:this={avatarFile} onchange={handleAvatarChange} />
          <button onclick={() => avatarFile?.click()} disabled={isUploadingAvatar} class="text-sm btn-secondary disabled:opacity-50">
            {isUploadingAvatar ? 'กำลังอัปโหลด...' : '📷 เปลี่ยนรูป'}
          </button>
          <p class="text-xs text-dark-900/50 dark:text-dark-100/50 mt-1">สูงสุด 1MB · จะถูก resize อัตโนมัติ</p>
          {#if avatarMsg}
            <p class="text-xs mt-1 {avatarMsg.startsWith('✓') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}">{avatarMsg}</p>
          {/if}
        </div>
      </div>

      <form onsubmit={handleSaveProfile} class="space-y-4">
        <div class="grid sm:grid-cols-2 gap-3">
          <div>
            <label for="first_name" class="block text-sm font-medium mb-1.5">ชื่อ</label>
            <input id="first_name" type="text" bind:value={first_name} class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 dark:bg-dark-900 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label for="last_name" class="block text-sm font-medium mb-1.5">นามสกุล</label>
            <input id="last_name" type="text" bind:value={last_name} class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 dark:bg-dark-900 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
        <div>
          <label for="email" class="block text-sm font-medium mb-1.5">อีเมล</label>
          <input id="email" type="email" value={$fullUser?.email || ''} disabled class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 bg-dark-50 dark:bg-dark-900 text-dark-900/60 dark:text-dark-100/60" />
          <p class="text-xs text-dark-900/50 dark:text-dark-100/50 mt-1">เปลี่ยนอีเมลไม่ได้ในเวอร์ชันนี้</p>
        </div>
        <div>
          <label for="phone" class="block text-sm font-medium mb-1.5">เบอร์โทร</label>
          <input id="phone" type="tel" bind:value={phone} placeholder="08x-xxx-xxxx" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 dark:bg-dark-900 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>

        <div class="flex items-center justify-between pt-2">
          <div class="text-sm">
            {#if $fullUser?.email_verified}
              <span class="text-green-700 dark:text-green-400">✓ ยืนยันอีเมลแล้ว</span>
            {:else}
              <button type="button" onclick={() => sendVerification().then(() => alert('ส่งอีเมลยืนยันแล้ว'))} class="text-amber-700 dark:text-amber-400 hover:underline font-semibold">
                ⚠️ ยังไม่ยืนยันอีเมล — ส่งลิงก์ใหม่
              </button>
            {/if}
          </div>
          <button type="submit" disabled={isSaving} class="btn-primary disabled:opacity-50">
            {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
        {#if saveMsg}
          <div class="text-sm {saveMsg.startsWith('✓') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}">{saveMsg}</div>
        {/if}
      </form>
    </div>

    <!-- Credits -->
    <div class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-6">
      <h2 class="font-semibold mb-1">⚡ เครดิต ระบบอัจฉริยะ</h2>
      <p class="text-sm text-dark-900/60 dark:text-dark-100/60 mb-4">1 credit ≈ $0.001 (≈ 1K input tokens)</p>
      <div class="bg-gradient-to-r from-primary-500 to-primary-700 text-white rounded-xl p-5 mb-4">
        <div class="text-xs uppercase tracking-wider opacity-80">คงเหลือ</div>
        <div class="text-4xl font-bold mt-1">{balance} <span class="text-base font-normal opacity-80">credits</span></div>
      </div>
      <details class="text-sm">
        <summary class="cursor-pointer text-primary-600 font-semibold">ประวัติ ({history.length})</summary>
        <div class="mt-3 space-y-2 max-h-64 overflow-y-auto">
          {#each history as tx}
            <div class="flex items-center justify-between p-2 rounded bg-dark-50 dark:bg-dark-900 text-xs">
              <div>
                <div class="font-semibold {tx.delta > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}">
                  {tx.delta > 0 ? '+' : ''}{tx.delta}
                </div>
                <div class="text-dark-900/60 dark:text-dark-100/60">{tx.reason}</div>
              </div>
              <div class="text-right">
                <div class="text-dark-900/60 dark:text-dark-100/60">→ {tx.balance_after}</div>
                <div class="text-dark-900/40 dark:text-dark-100/40">{formatDate(tx.created_at)}</div>
              </div>
            </div>
          {/each}
        </div>
      </details>
    </div>

    <!-- Security -->
    <div class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-6">
      <h2 class="font-semibold mb-4">🔒 ความปลอดภัย</h2>

      <form onsubmit={handleChangePassword} class="space-y-3 mb-6 pb-6 border-b border-dark-100 dark:border-dark-700">
        <h3 class="text-sm font-semibold">เปลี่ยนรหัสผ่าน</h3>
        <input type="password" bind:value={oldPwd} placeholder="รหัสผ่านเดิม" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 dark:bg-dark-900" />
        <input type="password" bind:value={newPwd} placeholder="รหัสผ่านใหม่ (≥ 8 ตัว)" class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 dark:bg-dark-900" />
        {#if pwdMsg}
          <div class="text-sm {pwdMsg.startsWith('✓') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}">{pwdMsg}</div>
        {/if}
        <button type="submit" disabled={isChangingPwd} class="btn-primary disabled:opacity-50">
          {isChangingPwd ? 'กำลังเปลี่ยน...' : 'เปลี่ยนรหัสผ่าน'}
        </button>
      </form>

      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold">🔐 2-Factor Authentication (OTP ทางอีเมล)</h3>
          <p class="text-xs text-dark-900/60 dark:text-dark-100/60 mt-0.5">เมื่อเปิด ระบบจะส่งรหัส OTP ไปทางอีเมลทุกครั้งที่ login</p>
        </div>
        <button
          onclick={handleToggle2FA}
          class="relative inline-flex h-6 w-11 items-center rounded-full transition {$fullUser?.two_factor_enabled ? 'bg-primary-600' : 'bg-dark-200 dark:bg-dark-600'}"
        >
          <span class="inline-block h-4 w-4 transform rounded-full bg-white transition {$fullUser?.two_factor_enabled ? 'translate-x-6' : 'translate-x-1'}" />
        </button>
      </div>
    </div>

    <!-- Display -->
    <div class="bg-white dark:bg-dark-800 border border-dark-100 dark:border-dark-700 rounded-2xl p-6">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold">🌙 โหมดมืด (Dark Mode)</h3>
          <p class="text-xs text-dark-900/60 dark:text-dark-100/60 mt-0.5">ปรับให้เข้ากับแสงรอบตัวคุณ</p>
        </div>
        <button
          onclick={toggleTheme}
          aria-label="สลับโหมดมืด"
          class="relative inline-flex h-6 w-11 items-center rounded-full transition {$theme === 'dark' ? 'bg-primary-600' : 'bg-dark-200 dark:bg-dark-600'}"
        >
          <span class="inline-block h-4 w-4 transform rounded-full bg-white transition {$theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}" />
        </button>
      </div>
    </div>

    <!-- Account links — the catch-all for things that don't fit the mobile bottom nav -->
    <div class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-6">
      <h2 class="font-semibold mb-4">บัญชี</h2>
      <div class="space-y-1">
        <a href="/tools/saved" class="flex items-center justify-between py-2.5 text-sm hover:text-primary-600">
          <span>📂 เครื่องมือที่บันทึกไว้</span>
          <span class="text-dark-900/30 dark:text-dark-100/30">›</span>
        </a>
        <a href="/developers" class="flex items-center justify-between py-2.5 text-sm hover:text-primary-600">
          <span>🔌 Developers (เชื่อมต่อ Claude Code)</span>
          <span class="text-dark-900/30 dark:text-dark-100/30">›</span>
        </a>
        {#if $fullUser?.role === 'admin'}
          <a href="/admin" class="flex items-center justify-between py-2.5 text-sm hover:text-primary-600">
            <span>🛡️ Admin Console</span>
            <span class="text-dark-900/30 dark:text-dark-100/30">›</span>
          </a>
        {/if}
        <button onclick={handleLogout} class="flex items-center justify-between py-2.5 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 w-full">
          <span>ออกจากระบบ</span>
          <span class="text-red-300 dark:text-red-400/50">›</span>
        </button>
      </div>
    </div>
  </main>
</div>
