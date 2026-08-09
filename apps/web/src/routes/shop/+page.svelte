<script lang="ts">
  /**
   * OS Redesign Master Plan §3/§5 "🏪 ร้านของฉัน" — Stage E1. The 4th "ที่"
   * (destination), replacing the placeholder MobileNav's "ร้านของฉัน" tab
   * used to point at (plain /profile) with a real hub that consolidates
   * everything "of the shop" into one place, per the plan's 5-section brief.
   *
   * Scope decision (stated, not silently dropped): the plan's routing table
   * says this section "absorbs studio/brand-kits" — but brand-kits is a
   * brandbook builder (logos/fonts/moodboards) that is architecturally
   * disconnected from the brand_profiles system every content-generation
   * page in this app actually reads from (/create, /create/sales,
   * /studio/series all call listBrandProfiles()). NOTE: BRAND_COMPOSITION_
   * ENABLED is actually "true" in apps/api/wrangler.toml (both the default/
   * production [vars] and [env.staging.vars]) and in .dev.vars — it is
   * live and reachable today via Creative Studio's "Brand Kits" button
   * (/studio → /studio/brand-kits), NOT disabled-by-default as an earlier
   * draft of this comment claimed. The exclusion from this hub is about the
   * data model, not the flag: brand-kits data never feeds /create,
   * /create/sales, or /studio/series, so surfacing it under "ข้อมูลร้าน"
   * would be misleading regardless of the flag's state. The plan's own
   * prose calls this section "ข้อมูลร้าน+ลูกค้า 1 คน (brand profile)" — i.e.
   * it means the real brand_profiles system, not brand-kits. This page
   * shows the active brand_profile instead. No edit-existing-profile UI
   * exists yet anywhere in the app (only bootstrap-and-create) — out of
   * scope here, flagged as a follow-up, not silently worked around.
   *
   * The other 4 sections deliberately stay as links to their existing full
   * pages rather than being inlined (studio/library and billing especially
   * are mature, complex pages — the plan's own note calls billing "the best
   * page in the system already, keep it").
   */
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { isAuthed, fullUser, logout } from '$lib/auth';
  import { listBrandProfiles, type BrandProfile } from '$lib/api';
  import { fetchConfig } from '$lib/config';
  import { Card, ListItem, Icon, EmptyState, Button } from '$lib/ui';

  let loading = $state(true);
  let brandProfile = $state<BrandProfile | null>(null);
  let socialEnabled = $state(false);

  onMount(async () => {
    await import('$lib/auth').then((m) => m.initAuth());
    if (!$isAuthed) { goto('/login'); return; }
    try {
      const [{ active_profile, profiles }, config] = await Promise.all([
        listBrandProfiles(),
        fetchConfig(),
      ]);
      brandProfile = active_profile || profiles[0] || null;
      socialEnabled = config.features.social_publishing;
    } finally {
      loading = false;
    }
  });

  async function handleLogout() {
    await logout();
    goto('/');
  }
</script>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950 pb-24">
  <main class="container-narrow py-8 max-w-2xl space-y-4">
    <h1 class="t-title mb-1">ร้านของฉัน</h1>

    {#if loading}
      <p class="t-caption text-dark-500 dark:text-dark-400">กำลังโหลด...</p>
    {:else}
      <Card>
        <div class="t-heading mb-2">ข้อมูลร้าน</div>
        {#if brandProfile}
          <div class="t-body font-semibold">{brandProfile.name}</div>
          {#if brandProfile.business_summary}<p class="t-caption mt-1">{brandProfile.business_summary}</p>{/if}
          <a href="/studio/brand-profile/new" class="t-caption text-primary-600 dark:text-primary-400 font-semibold mt-3 block">+ สร้างข้อมูลร้านใหม่</a>
        {:else}
          <EmptyState emoji="🏪" title="ยังไม่มีข้อมูลร้าน" subtitle="สร้างครั้งเดียว ใช้กับ content ทุกชิ้นต่อจากนี้" actionLabel="สร้างข้อมูลร้าน" onaction={() => goto('/studio/brand-profile/new')} />
        {/if}
      </Card>

      <Card>
        <ListItem href="/dashboard" title="แผนร้าน" subtitle="wizard 7 ขั้น: ตัวตนธุรกิจ, ลูกค้า, จุดขาย, ปฏิทิน ฯลฯ">
          {#snippet icon()}<Icon name="layout-grid" size={18} />{/snippet}
        </ListItem>
        <ListItem href="/studio/library" title="คลังรูปของร้าน" subtitle="รูปที่สร้าง/อัปโหลดไว้ทั้งหมด">
          {#snippet icon()}<Icon name="image" size={18} />{/snippet}
        </ListItem>
        <ListItem href="/billing" title="เครดิต + เติมเงิน" subtitle={$fullUser ? `เหลือ ${$fullUser.credits} เครดิต` : ''}>
          {#snippet icon()}<Icon name="wallet" size={18} />{/snippet}
        </ListItem>
        <ListItem href="/profile" title="ตั้งค่าบัญชี" subtitle="ข้อมูลส่วนตัว, รหัสผ่าน, โหมดมืด" last={!socialEnabled}>
          {#snippet icon()}<Icon name="user" size={18} />{/snippet}
        </ListItem>
        {#if socialEnabled}
          <ListItem href="/settings/social" title="เชื่อมต่อโซเชียล" subtitle="Facebook, Instagram, LINE ฯลฯ" last>
            {#snippet icon()}<Icon name="terminal" size={18} />{/snippet}
          </ListItem>
        {/if}
      </Card>

      <Button variant="ghost" onclick={handleLogout}>
        <span class="inline-flex items-center gap-1.5"><Icon name="log-out" size={15} /> ออกจากระบบ</span>
      </Button>
    {/if}
  </main>
</div>
