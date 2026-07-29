<script lang="ts">
  import '../app.css';
  import { locale } from '$lib/stores';
  import { t } from '$lib/i18n';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { initAuth, isAuthed } from '$lib/auth';
  import MobileNav from '$lib/MobileNav.svelte';

  let { children } = $props();

  onMount(() => {
    initAuth();
  });

  // Public/marketing/auth routes never show the app's bottom nav, even if
  // $isAuthed happens to be true — e.g. an authenticated user who lands here
  // via the back button or a stray link. $isAuthed is a route-independent
  // store (it doesn't reset on client-side navigation), so without this check
  // the nav would render on top of the login form, the marketing landing
  // page, etc. for anyone with an active session.
  const PUBLIC_ROUTES = ['/', '/login', '/register', '/reset-password', '/verify-email', '/demo'];
  let isPublicRoute = $derived(PUBLIC_ROUTES.includes($page.url.pathname));
  let showMobileNav = $derived($isAuthed && !isPublicRoute);
</script>

{@render children()}

{#if showMobileNav}
  <!-- Reserves room so the fixed bottom nav (which also pads itself by
       env(safe-area-inset-bottom) for the home-indicator area) never covers
       the last bit of page content on mobile. -->
  <div class="sm:hidden h-[calc(3.5rem+env(safe-area-inset-bottom))]" aria-hidden="true"></div>
  <MobileNav />
{/if}
