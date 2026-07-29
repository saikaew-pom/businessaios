<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { initAuth, isAuthed } from '$lib/auth';
  import { mcpListTokens, mcpCreateToken, mcpRevokeToken, getMcpServerUrl, type McpToken } from '$lib/api';

  let tokens = $state<McpToken[]>([]);
  let isLoading = $state(true);
  let newLabel = $state('');
  let creating = $state(false);
  let revealedToken = $state<{ token: string; token_hint: string } | null>(null);
  let copiedWhat = $state<string | null>(null);

  const mcpUrl = getMcpServerUrl();

  onMount(async () => {
    await initAuth();
    if (!$isAuthed) {
      goto('/login');
      return;
    }
    await loadTokens();
  });

  async function loadTokens() {
    isLoading = true;
    try {
      const res = await mcpListTokens();
      tokens = res.tokens;
    } catch (err: any) {
      alert(err.message);
    } finally {
      isLoading = false;
    }
  }

  async function handleCreate() {
    creating = true;
    try {
      const res = await mcpCreateToken(newLabel.trim() || undefined);
      revealedToken = { token: res.token, token_hint: res.token_hint };
      newLabel = '';
      await loadTokens();
    } catch (err: any) {
      alert(err.message);
    } finally {
      creating = false;
    }
  }

  async function handleRevoke(t: McpToken) {
    if (!confirm(`เพิกถอน token "${t.label || t.token_hint}"? Claude Code ที่ตั้งค่าไว้ด้วย token นี้จะเชื่อมต่อไม่ได้อีก`)) return;
    try {
      await mcpRevokeToken(t.id);
      await loadTokens();
    } catch (err: any) {
      alert(err.message);
    }
  }

  function cliCommand(token: string) {
    return `claude mcp add --transport http business-smart-os ${mcpUrl} --header "Authorization: Bearer ${token}"`;
  }

  function jsonConfig(token: string) {
    return JSON.stringify({
      mcpServers: {
        'business-smart-os': {
          url: mcpUrl,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    }, null, 2);
  }

  async function copy(text: string, what: string) {
    await navigator.clipboard.writeText(text);
    copiedWhat = what;
    setTimeout(() => { if (copiedWhat === what) copiedWhat = null; }, 2000);
  }

  function formatDate(ts: number | null) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }
</script>

<svelte:head>
  <title>Developers — Business Smart OS</title>
</svelte:head>

<div class="min-h-screen bg-dark-50">
  <header class="bg-white border-b border-dark-100 sticky top-0 z-10">
    <div class="container-narrow flex items-center justify-between h-16">
      <a href="/dashboard" class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
          <span class="text-white font-bold text-sm">B</span>
        </div>
        <span class="font-bold text-lg">Business Smart OS</span>
      </a>
      <a href="/dashboard" class="text-sm text-primary-600 hover:underline">← กลับ Dashboard</a>
    </div>
  </header>

  <main class="container-narrow py-10 space-y-8">
    <div>
      <h1 class="heading-2 mb-1">🔌 Developers</h1>
      <p class="text-dark-900/60">เชื่อมต่อ Claude Code หรือ Claude Desktop เข้ากับ Business Smart OS — สร้างแผน, รันเครื่องมือ, export ได้โดยตรงจาก Claude โดยใช้เครดิตเดียวกับบัญชีของคุณ</p>
    </div>

    <!-- Reveal modal for a freshly created token -->
    {#if revealedToken}
      <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onclick={() => revealedToken = null}>
        <div class="bg-white rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto" onclick={(e) => e.stopPropagation()}>
          <h3 class="font-bold text-lg mb-1">Token สร้างแล้ว ✅</h3>
          <p class="text-sm text-amber-600 font-semibold mb-4">⚠️ จะแสดงครั้งเดียวเท่านั้น — คัดลอกเก็บไว้ตอนนี้ ปิดหน้าต่างนี้แล้วจะดูอีกไม่ได้</p>

          <div class="mb-4">
            <label class="block text-sm font-medium mb-1">Token</label>
            <div class="flex gap-2">
              <input readonly value={revealedToken.token} class="flex-1 px-3 py-2 rounded-lg border border-dark-200 font-mono text-xs" />
              <button onclick={() => copy(revealedToken!.token, 'token')} class="btn-secondary text-xs px-3">
                {copiedWhat === 'token' ? '✅ คัดลอกแล้ว' : 'คัดลอก'}
              </button>
            </div>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium mb-1">คำสั่ง Claude Code CLI</label>
            <div class="flex gap-2">
              <pre class="flex-1 px-3 py-2 rounded-lg border border-dark-200 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all">{cliCommand(revealedToken.token)}</pre>
              <button onclick={() => copy(cliCommand(revealedToken!.token), 'cli')} class="btn-secondary text-xs px-3 shrink-0">
                {copiedWhat === 'cli' ? '✅ คัดลอกแล้ว' : 'คัดลอก'}
              </button>
            </div>
          </div>

          <div class="mb-5">
            <label class="block text-sm font-medium mb-1">หรือ config JSON (Claude Desktop / manual config)</label>
            <div class="flex gap-2">
              <pre class="flex-1 px-3 py-2 rounded-lg border border-dark-200 font-mono text-xs overflow-x-auto">{jsonConfig(revealedToken.token)}</pre>
              <button onclick={() => copy(jsonConfig(revealedToken!.token), 'json')} class="btn-secondary text-xs px-3 shrink-0">
                {copiedWhat === 'json' ? '✅ คัดลอกแล้ว' : 'คัดลอก'}
              </button>
            </div>
          </div>

          <button onclick={() => revealedToken = null} class="btn-primary w-full">คัดลอกเรียบร้อย ปิดหน้าต่างนี้</button>
        </div>
      </div>
    {/if}

    <!-- Create token -->
    <div class="bg-white rounded-2xl border border-dark-100 p-5">
      <h2 class="font-semibold mb-3">สร้าง token ใหม่</h2>
      <div class="flex gap-2">
        <input
          type="text"
          bind:value={newLabel}
          placeholder="ชื่อ token เช่น 'MacBook ที่ทำงาน' (optional)"
          class="flex-1 px-3 py-2.5 rounded-lg border border-dark-200 text-sm"
        />
        <button onclick={handleCreate} disabled={creating} class="btn-primary disabled:opacity-50">
          {creating ? 'กำลังสร้าง...' : '+ สร้าง token'}
        </button>
      </div>
    </div>

    <!-- Token list -->
    <div class="bg-white rounded-2xl border border-dark-100 overflow-hidden">
      <div class="p-4 border-b border-dark-100 font-semibold text-sm">Token ของคุณ ({tokens.length})</div>
      <table class="w-full text-sm">
        <thead class="bg-dark-50 text-xs uppercase tracking-wider text-dark-900/60">
          <tr>
            <th class="text-left p-3">ชื่อ</th>
            <th class="text-left p-3">Token</th>
            <th class="text-left p-3">สถานะ</th>
            <th class="text-left p-3">สร้างเมื่อ</th>
            <th class="text-left p-3">ใช้ล่าสุด</th>
            <th class="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {#if isLoading}
            <tr><td colspan="6" class="p-6 text-center text-dark-900/50">กำลังโหลด...</td></tr>
          {:else if tokens.length === 0}
            <tr><td colspan="6" class="p-6 text-center text-dark-900/50">ยังไม่มี token — สร้างอันแรกด้านบน</td></tr>
          {:else}
            {#each tokens as t}
              <tr class="border-t border-dark-100">
                <td class="p-3">{t.label || '(ไม่มีชื่อ)'}</td>
                <td class="p-3 font-mono text-xs">...{t.token_hint}</td>
                <td class="p-3">
                  {#if t.is_active}
                    <span class="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">ใช้งานอยู่</span>
                  {:else}
                    <span class="text-xs px-2 py-0.5 rounded-full bg-dark-50 text-dark-900/50">เพิกถอนแล้ว</span>
                  {/if}
                </td>
                <td class="p-3 text-xs text-dark-900/60">{formatDate(t.created_at)}</td>
                <td class="p-3 text-xs text-dark-900/60">{formatDate(t.last_used_at)}</td>
                <td class="p-3">
                  {#if t.is_active}
                    <button onclick={() => handleRevoke(t)} class="text-xs text-red-600 hover:underline">เพิกถอน</button>
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Reference: available tools -->
    <div class="bg-white rounded-2xl border border-dark-100 p-5">
      <h2 class="font-semibold mb-3">เครื่องมือที่ใช้ผ่าน MCP ได้</h2>
      <ul class="text-sm text-dark-900/70 space-y-1.5">
        <li><code class="text-xs bg-dark-50 px-1.5 py-0.5 rounded">list_projects</code> — ดูรายการแผนทั้งหมด</li>
        <li><code class="text-xs bg-dark-50 px-1.5 py-0.5 rounded">create_project</code> — สร้างแผนใหม่</li>
        <li><code class="text-xs bg-dark-50 px-1.5 py-0.5 rounded">generate_step</code> — สร้างเนื้อหาแต่ละขั้นตอนด้วยระบบอัจฉริยะ (ใช้เครดิต)</li>
        <li><code class="text-xs bg-dark-50 px-1.5 py-0.5 rounded">run_tool</code> — รันเครื่องมือเดี่ยวทั้ง 10 ตัว (ใช้เครดิต)</li>
        <li><code class="text-xs bg-dark-50 px-1.5 py-0.5 rounded">get_export</code> — export แผนเป็นไฟล์</li>
        <li><code class="text-xs bg-dark-50 px-1.5 py-0.5 rounded">check_credits</code> — เช็คเครดิตคงเหลือ</li>
      </ul>
      <p class="text-xs text-dark-900/50 mt-3">MCP server URL: <code class="bg-dark-50 px-1.5 py-0.5 rounded">{mcpUrl}</code></p>
    </div>
  </main>
</div>
