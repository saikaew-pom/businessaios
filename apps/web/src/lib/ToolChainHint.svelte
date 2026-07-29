<script lang="ts">
  import { getNextTools, getChainPosition, type ChainTool } from './toolChain';

  interface Props {
    current: string;  // current tool_type
  }
  let { current }: Props = $props();

  const next = $derived(getNextTools(current));
  const pos = $derived(getChainPosition(current));
</script>

{#if pos && next.length > 0}
  <div class="mt-4 rounded-xl border-2 border-dashed border-dark-200 bg-gradient-to-br from-slate-50 to-blue-50/40 p-4">
    <div class="flex items-center gap-2 mb-2">
      <span class="text-base">🧭</span>
      <div class="text-xs font-bold text-dark-700 uppercase tracking-wide">Strategic Tool Chain</div>
      <span class="text-[10px] text-dark-500 ml-1">ขั้น {pos.index + 1}/{pos.total} — {pos.current.emoji} {pos.current.label}</span>
    </div>

    <div class="text-xs text-dark-600 mb-3">
      ผ่าน {pos.current.label} แล้ว — ต่อไปทำเครื่องมือเหล่านี้เพื่อต่อยอด:
    </div>

    <div class="flex items-center gap-2 flex-wrap">
      {#each next as tool, i (tool.id)}
        <a
          href={`/tools/${tool.slug}`}
          class="group flex items-center gap-2 px-3 py-2 rounded-lg border-2 bg-white hover:shadow-md transition-all"
          style="border-color: {tool.color}40;"
        >
          <div
            class="w-7 h-7 rounded-md flex items-center justify-center text-base text-white"
            style="background: {tool.color};"
          >
            {tool.emoji}
          </div>
          <div>
            <div class="text-xs font-bold text-dark-800 group-hover:underline">
              {i + 1}. {tool.label}
            </div>
            <div class="text-[10px] text-dark-500 leading-tight">{tool.hint}</div>
          </div>
          <span class="text-dark-400 group-hover:text-dark-700 text-sm">→</span>
        </a>
        {#if i < next.length - 1}
          <span class="text-dark-300 text-sm">→</span>
        {/if}
      {/each}
    </div>

    <div class="mt-3 pt-3 border-t border-dark-100 text-[10px] text-dark-500 leading-relaxed">
      💡 <b>Tips:</b> ทุก output ของ {pos.current.label} จะกลายเป็น input อัตโนมัติของ tool ถัดไป — ไม่ต้องกรอกใหม่
    </div>
  </div>
{/if}
