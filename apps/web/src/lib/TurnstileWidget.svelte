<script lang="ts">
  /**
   * Cloudflare Turnstile widget
   * https://developers.cloudflare.com/turnstile/
   *
   * Renders the Turnstile widget and provides the token via callback.
   * If site_key is null (mock mode), renders nothing and token stays null.
   */
  import { onMount } from 'svelte';

  let {
    siteKey = '',
    onTokenChange = (_t: string | null) => {},
    theme = 'light',
  }: {
    siteKey: string;
    onTokenChange?: (token: string | null) => void;
    theme?: 'light' | 'dark' | 'auto';
  } = $props();

  let container: HTMLDivElement;
  let widgetId: string | null = null;
  let currentToken: string | null = null;
  let loaded = $state(false);
  let error = $state<string | null>(null);

  // Turnstile callback functions need to be globally accessible
  function onTurnstileSuccess(token: string) {
    currentToken = token;
    onTokenChange(token);
  }

  function onTurnstileExpired() {
    currentToken = null;
    onTokenChange(null);
  }

  function onTurnstileError() {
    currentToken = null;
    onTokenChange(null);
    error = 'Turnstile error — refresh page';
  }

  onMount(() => {
    if (!siteKey) return; // mock mode

    // Make callbacks globally accessible
    (window as any).onTurnstileSuccess = onTurnstileSuccess;
    (window as any).onTurnstileExpired = onTurnstileExpired;
    (window as any).onTurnstileError = onTurnstileError;

    // Load Turnstile script if not already loaded
    if (!(window as any).turnstile) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => renderWidget();
      script.onerror = () => { error = 'Failed to load Turnstile script'; };
      document.head.appendChild(script);
    } else {
      renderWidget();
    }

    return () => {
      if (widgetId && (window as any).turnstile) {
        try { (window as any).turnstile.remove(widgetId); } catch {}
      }
    };
  });

  function renderWidget() {
    if (!container || !(window as any).turnstile) return;
    try {
      widgetId = (window as any).turnstile.render(container, {
        sitekey: siteKey,
        callback: 'onTurnstileSuccess',
        'expired-callback': 'onTurnstileExpired',
        'error-callback': 'onTurnstileError',
        theme,
      });
      loaded = true;
    } catch (e: any) {
      error = e.message;
    }
  }

  export function getToken(): string | null {
    return currentToken;
  }
</script>

{#if siteKey}
  <div class="turnstile-wrapper">
    <div bind:this={container} class="cf-turnstile"></div>
    {#if error}
      <div class="text-xs text-red-600 mt-1">{error}</div>
    {/if}
  </div>
{:else}
  <!-- Mock mode: no widget, no token -->
{/if}

<style>
  .turnstile-wrapper {
    display: flex;
    justify-content: center;
    margin: 0.5rem 0;
  }
</style>
