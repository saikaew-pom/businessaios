<script lang="ts">
  /**
   * Bottom nav — the "4 ที่" architecture (docs/OS_REDESIGN_MASTER_PLAN.md
   * §3), Stage A version: the shell and the 4 places are real, but three of
   * them still point at the closest existing page rather than a purpose-built
   * destination (that's Stage C/E work) — exactly what §8's roadmap calls
   * "bottom nav 4 ที่ (ยังชี้หน้าเดิมได้ระหว่างเปลี่ยนผ่าน)". Only the
   * "สร้าง" (create) center item is a real behavior change today.
   *
   * Replaces the previous 5-item nav (หน้าแรก/เครื่องมือ/Studio/เครดิต/
   * โปรไฟล์, emoji icons) — that IA mirrored the old header's link list,
   * not the "what does the user actually do here" framing this nav uses.
   */
  import { page } from '$app/stores';
  import { fullUser } from '$lib/auth';
  import { Icon, Sheet, ListItem } from '$lib/ui';

  const PLACES = [
    { href: '/dashboard', icon: 'home' as const, label: 'วันนี้' },
    { href: '/studio/series', icon: 'edit' as const, label: 'สร้าง', center: true },
    { href: '/calendar', icon: 'calendar' as const, label: 'ปฏิทิน' },
    { href: '/profile', icon: 'store' as const, label: 'ร้านของฉัน' },
  ];

  function isActive(href: string) {
    const path = $page.url.pathname;
    return path === href || path.startsWith(href + '/');
  }

  let advancedOpen = $state(false);
</script>

<nav
  class="sm:hidden fixed bottom-0 inset-x-0 z-20 bg-white dark:bg-dark-800 border-t border-dark-200 dark:border-dark-700 pb-[env(safe-area-inset-bottom)]"
>
  <div class="flex items-stretch">
    {#each PLACES as place}
      {#if place.center}
        <a href={place.href} class="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 min-h-[56px] text-[11px] font-bold {isActive(place.href) ? 'text-primary-600 dark:text-primary-400' : 'text-dark-600 dark:text-dark-300'}">
          <span class="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg shadow-primary-500/30 border-4 border-white dark:border-dark-800">
            <Icon name={place.icon} size={22} />
          </span>
          {place.label}
        </a>
      {:else}
        <a
          href={place.href}
          class="flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-[11px] font-bold {isActive(place.href) ? 'text-primary-600 dark:text-primary-400' : 'text-dark-600 dark:text-dark-300'}"
        >
          <Icon name={place.icon} size={21} />
          {place.label}
        </a>
      {/if}
    {/each}
    <button
      type="button"
      onclick={() => (advancedOpen = true)}
      class="flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-[11px] font-bold text-dark-600 dark:text-dark-300"
    >
      <Icon name="more-horizontal" size={21} />
      ขั้นสูง
    </button>
  </div>
</nav>

<Sheet open={advancedOpen} onclose={() => (advancedOpen = false)}>
  <div class="t-heading mb-1">โหมดขั้นสูง</div>
  <div class="t-caption mb-3">เครื่องมือเดิมทั้งหมดยังอยู่ครบ — ย้ายมาไว้ที่นี่</div>
  <ListItem href="/studio" title="Creative Studio เต็มรูป" subtitle="เลือกโมเดล AI, aspect ratio, ภาพอ้างอิงเอง">
    {#snippet icon()}<Icon name="image" size={18} />{/snippet}
  </ListItem>
  <ListItem href="/works" title="Works" subtitle="ตารางโพสต์ทั้งหมด">
    {#snippet icon()}<Icon name="layout-grid" size={18} />{/snippet}
  </ListItem>
  <ListItem href="/inbox" title="Inbox" subtitle="งานรอตรวจ">
    {#snippet icon()}<Icon name="inbox" size={18} />{/snippet}
  </ListItem>
  <ListItem href="/tools" title="เครื่องมือเดี่ยว" subtitle="เครื่องมือคิดกลยุทธ์แบบละเอียด">
    {#snippet icon()}<Icon name="zap" size={18} />{/snippet}
  </ListItem>
  <ListItem href="/billing" title="เครดิต + เติมเงิน" subtitle={$fullUser ? `เหลือ ${$fullUser.credits} เครดิต` : ''}>
    {#snippet icon()}<Icon name="wallet" size={18} />{/snippet}
  </ListItem>
  <ListItem href="/developers" title="Developers" subtitle="API">
    {#snippet icon()}<Icon name="terminal" size={18} />{/snippet}
  </ListItem>
  {#if $fullUser?.role === 'admin'}
    <ListItem href="/admin" title="Admin" subtitle="จัดการระบบ">
      {#snippet icon()}<Icon name="shield" size={18} />{/snippet}
    </ListItem>
  {/if}
  <ListItem href="/profile" title="โปรไฟล์ + ตั้งค่า" last>
    {#snippet icon()}<Icon name="user" size={18} />{/snippet}
  </ListItem>
</Sheet>
