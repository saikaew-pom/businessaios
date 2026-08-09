<script lang="ts">
  import { goto } from '$app/navigation';
  import { user, fullUser, logout } from '$lib/auth';
  import { Icon } from '$lib/ui';

  async function handleLogout() {
    await logout();
    goto('/');
  }

  // Stage C4 — "เมนูขั้นสูง (Works/Inbox/Series/Developers) ซ่อนหลัง
  // 'ขั้นสูง' ... มือโปรเปิดได้": mirrors MobileNav's own "ขั้นสูง" sheet
  // pattern (collapsed by default for everyone, one click reveals it — not
  // gated on account history, matching the mobile version's own behavior).
  let advancedOpen = $state(false);
</script>

<header class="bg-white dark:bg-dark-800 border-b border-dark-200 dark:border-dark-700 sticky top-0 z-10">
  <div class="container-narrow flex items-center justify-between h-16 gap-4">
    <a href="/today" class="flex items-center gap-2 shrink-0">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shrink-0">
        <span class="text-white font-bold text-sm">B</span>
      </div>
      <span class="font-bold text-lg whitespace-nowrap">Business Smart OS</span>
    </a>

    <!--
      There are enough items here (credits, Admin, 7 links, email, logout)
      that they no longer fit on one row within container-narrow's max-w-6xl
      at ordinary desktop widths. Logout must never be the thing that scrolls
      out of view when that happens (it did — a hidden overflow with no
      visible scroll affordance just reads as "the button disappeared"), so
      it's pinned outside the scrollable region: only the middle nav-links
      group scrolls (flex-1 min-w-0 overflow-x-auto), while logout sits in
      its own shrink-0 group that the scrollable sibling yields space to.
      shrink-0 + whitespace-nowrap on every item keeps text from wrapping
      mid-phrase instead of the row overflowing/scrolling as intended.

      Link SET (the desktop-only middle group below) is still the full
      legacy list, deliberately NOT trimmed by the Stage C3 IA cutover —
      desktop has room for direct links where mobile's bottom nav doesn't,
      so only the logo (→ /today, the new home) was repointed. Recolors to
      the warm identity and swaps emoji-as-icon for the system icon set
      (commitment 4.3) — icons are the mechanism (kept small, alongside the
      text, not replacing it), emoji stay for genuine feeling elsewhere in
      the app, not as this header's chrome.
    -->
    <div class="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto whitespace-nowrap">
      {#if $fullUser}
        <a href="/billing" class="shrink-0 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 font-semibold" title="เครดิต ระบบอัจฉริยะ คงเหลือ — คลิกเพื่อเติม">
          <Icon name="zap" size={13} /> {$fullUser.credits} เครดิต
        </a>
      {/if}
      {#if $fullUser?.role === 'admin'}
        <a href="/admin" class="shrink-0 inline-flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-semibold"><Icon name="shield" size={15} /> Admin</a>
      {/if}
      <!-- Everything below is also reachable via the mobile bottom nav's "ขั้นสูง" sheet -->
      <div class="hidden sm:flex items-center gap-3">
        <a href="/calendar" class="shrink-0 inline-flex items-center gap-1.5 text-sm text-dark-700 dark:text-dark-200 hover:text-dark-900 dark:hover:text-dark-50 font-semibold"><Icon name="calendar" size={15} /> Calendar</a>
        <a href="/shop" class="shrink-0 inline-flex items-center gap-1.5 text-sm text-dark-700 dark:text-dark-200 hover:text-dark-900 dark:hover:text-dark-50 font-semibold"><Icon name="store" size={15} /> ร้านของฉัน</a>
        <a href="/billing" class="shrink-0 inline-flex items-center gap-1.5 text-sm text-dark-700 dark:text-dark-200 hover:text-dark-900 dark:hover:text-dark-50 font-semibold"><Icon name="wallet" size={15} /> เติมเงิน</a>
        <a href="/profile" class="shrink-0 inline-flex items-center gap-1.5 text-sm text-dark-700 dark:text-dark-200 hover:text-dark-900 dark:hover:text-dark-50"><Icon name="user" size={15} /> โปรไฟล์</a>
        <button type="button" onclick={() => (advancedOpen = !advancedOpen)} aria-expanded={advancedOpen} aria-controls="advanced-nav-links" class="shrink-0 inline-flex items-center gap-1.5 text-sm text-dark-700 dark:text-dark-200 hover:text-dark-900 dark:hover:text-dark-50">
          <Icon name="more-horizontal" size={15} /> ขั้นสูง
        </button>
        {#if advancedOpen}
          <span id="advanced-nav-links" class="contents">
            <a href="/studio" class="shrink-0 inline-flex items-center gap-1.5 text-sm text-dark-700 dark:text-dark-200 hover:text-dark-900 dark:hover:text-dark-50 font-semibold"><Icon name="image" size={15} /> Studio</a>
            <a href="/inbox" class="shrink-0 inline-flex items-center gap-1.5 text-sm text-dark-700 dark:text-dark-200 hover:text-dark-900 dark:hover:text-dark-50 font-semibold"><Icon name="inbox" size={15} /> Inbox</a>
            <a href="/works" class="shrink-0 inline-flex items-center gap-1.5 text-sm text-dark-700 dark:text-dark-200 hover:text-dark-900 dark:hover:text-dark-50 font-semibold"><Icon name="layout-grid" size={15} /> Works</a>
            <a href="/tools/saved" class="shrink-0 inline-flex items-center gap-1.5 text-sm text-dark-700 dark:text-dark-200 hover:text-dark-900 dark:hover:text-dark-50"><Icon name="folder" size={15} /> บันทึก</a>
            <a href="/developers" class="shrink-0 inline-flex items-center gap-1.5 text-sm text-dark-700 dark:text-dark-200 hover:text-dark-900 dark:hover:text-dark-50"><Icon name="terminal" size={15} /> Developers</a>
          </span>
        {/if}
        {#if $user}
          <span class="shrink-0 text-sm text-dark-500 dark:text-dark-400">{$user.email}</span>
        {/if}
      </div>
    </div>
    {#if $user}
      <button onclick={handleLogout} class="hidden sm:inline-flex items-center gap-1.5 shrink-0 text-sm text-dark-700 dark:text-dark-200 hover:text-dark-900 dark:hover:text-dark-50"><Icon name="log-out" size={15} /> ออกจากระบบ</button>
    {/if}
  </div>
</header>
