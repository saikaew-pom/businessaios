<script lang="ts">
  import { goto } from '$app/navigation';
  import { user, fullUser, logout } from '$lib/auth';

  async function handleLogout() {
    await logout();
    goto('/');
  }
</script>

<header class="bg-white dark:bg-dark-800 border-b border-dark-100 dark:border-dark-700 sticky top-0 z-10">
  <div class="container-narrow flex items-center justify-between h-16 gap-4">
    <a href="/dashboard" class="flex items-center gap-2 shrink-0">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shrink-0">
        <span class="text-white font-bold text-sm">B</span>
      </div>
      <span class="font-bold text-lg whitespace-nowrap">Business Smart OS</span>
    </a>

    <!--
      There are now enough items here (credits, Admin, 7 links, email, logout)
      that they no longer fit on one row within container-narrow's max-w-6xl
      at ordinary desktop widths -- without shrink-0 + whitespace-nowrap on
      every item, the flex row was letting individual text (the title, the
      email) wrap mid-phrase instead of the row overflowing, which read as
      "the menu is broken" rather than "there are a lot of links". min-w-0 is
      required for overflow-x-auto to actually take effect on a flex child
      instead of the row just forcing the header wider.
    -->
    <div class="flex items-center gap-3 min-w-0 overflow-x-auto whitespace-nowrap">
      {#if $fullUser}
        <a href="/billing" class="shrink-0 text-xs px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 font-semibold" title="เครดิต ระบบอัจฉริยะ คงเหลือ — คลิกเพื่อเติม">
          ⚡ {$fullUser.credits} credits
        </a>
      {/if}
      {#if $fullUser?.role === 'admin'}
        <a href="/admin" class="shrink-0 text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-semibold">🛡️ Admin</a>
      {/if}
      <!-- Everything below is reachable via the mobile bottom nav (โปรไฟล์ → account links, logout) -->
      <div class="hidden sm:flex items-center gap-3">
        <a href="/studio" class="shrink-0 text-sm text-dark-900/70 dark:text-dark-100/70 hover:text-dark-900 dark:hover:text-dark-50 font-semibold">🎨 Studio</a>
        <a href="/inbox" class="shrink-0 text-sm text-dark-900/70 dark:text-dark-100/70 hover:text-dark-900 dark:hover:text-dark-50 font-semibold">Inbox</a>
        <a href="/works" class="shrink-0 text-sm text-dark-900/70 dark:text-dark-100/70 hover:text-dark-900 dark:hover:text-dark-50 font-semibold">Works</a>
        <a href="/calendar" class="shrink-0 text-sm text-dark-900/70 dark:text-dark-100/70 hover:text-dark-900 dark:hover:text-dark-50 font-semibold">Calendar</a>
        <a href="/billing" class="shrink-0 text-sm text-dark-900/70 dark:text-dark-100/70 hover:text-dark-900 dark:hover:text-dark-50 font-semibold">💰 เติมเงิน</a>
        <a href="/profile" class="shrink-0 text-sm text-dark-900/70 dark:text-dark-100/70 hover:text-dark-900 dark:hover:text-dark-50">โปรไฟล์</a>
        <a href="/tools/saved" class="shrink-0 text-sm text-dark-900/70 dark:text-dark-100/70 hover:text-dark-900 dark:hover:text-dark-50">📂 บันทึก</a>
        <a href="/developers" class="shrink-0 text-sm text-dark-900/70 dark:text-dark-100/70 hover:text-dark-900 dark:hover:text-dark-50">🔌 Developers</a>
        {#if $user}
          <span class="shrink-0 text-sm text-dark-900/60 dark:text-dark-100/60">{$user.email}</span>
          <button onclick={handleLogout} class="shrink-0 text-sm text-dark-900/70 dark:text-dark-100/70 hover:text-dark-900 dark:hover:text-dark-50">ออกจากระบบ</button>
        {/if}
      </div>
    </div>
  </div>
</header>
