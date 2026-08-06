<script lang="ts">
  import { exportSavedTool } from '$lib/api';
  import { PUBLIC_API_URL } from '$env/static/public';

  interface Props {
    saveId: string;
  }
  let { saveId }: Props = $props();

  let isOpening = $state(false);
  let error = $state('');

  async function openCanvas() {
    if (!saveId) return;
    isOpening = true;
    error = '';
    try {
      const res = await exportSavedTool(saveId, 'pdf');
      const url = `${PUBLIC_API_URL}${res.download_url}?print=1`;
      const win = window.open(url, '_blank');
      if (!win) {
        error = 'กรุณาอนุญาต popup';
      }
    } catch (e: any) {
      error = e?.message || 'ไม่สามารถเปิดใบสรุป (PDF) ได้';
    } finally {
      isOpening = false;
    }
  }
</script>

<button
  onclick={openCanvas}
  disabled={isOpening}
  class="text-sm px-3 py-1.5 rounded bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:opacity-90 disabled:opacity-50 font-semibold flex items-center gap-1.5"
  title="ใบสรุปหน้าเดียว ขนาด A3 พิมพ์เป็นโปสเตอร์ได้"
>
  <span>{isOpening ? '⏳' : '🎨'}</span>
  <span>{isOpening ? 'กำลังสร้าง...' : 'ใบสรุป (PDF)'}</span>
</button>

{#if error}
  <span class="text-xs text-red-600 dark:text-red-400">{error}</span>
{/if}
