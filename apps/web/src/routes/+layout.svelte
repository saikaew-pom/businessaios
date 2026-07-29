<script lang="ts">
  import '../app.css';
  import { locale } from '$lib/stores';
  import { t } from '$lib/i18n';
  import { onMount } from 'svelte';
  import { initAuth } from '$lib/auth';

  let { children } = $props();

  onMount(() => {
    initAuth();
  });
</script>

{@render children()}
