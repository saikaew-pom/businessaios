<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { fullUser, initAuth, isAuthed } from '$lib/auth';
  import { adminListUsers, adminUpdateUser, adminChangeCredits, adminGetStats, adminListEmails, getExportUrl, type AdminUser, type ExportResult, exportProjectFormatted } from '$lib/api';

  let users = $state<AdminUser[]>([]);
  let stats = $state<any>(null);
  let emails = $state<any[]>([]);
  let selectedUser = $state<AdminUser | null>(null);
  let creditDelta = $state(0);
  let creditReason = $state('admin_grant');
  let creditNote = $state('');
  let isLoading = $state(false);
  let tab = $state<'users' | 'stats' | 'emails'>('users');

  onMount(async () => {
    await initAuth();
    if (!$isAuthed) {
      goto('/login');
      return;
    }
    if ($fullUser?.role !== 'admin') {
      goto('/dashboard');
      return;
    }
    await loadAll();
  });

  async function loadAll() {
    isLoading = true;
    try {
      const [u, s, e] = await Promise.all([
        adminListUsers(),
        adminGetStats(),
        adminListEmails().catch(() => ({ emails: [] })),
      ]);
      users = u.users;
      stats = s.stats;
      emails = e.emails;
    } catch (err: any) {
      alert(err.message);
    } finally {
      isLoading = false;
    }
  }

  async function handleRoleChange(user: AdminUser, newRole: string) {
    try {
      await adminUpdateUser(user.id, { role: newRole });
      await loadAll();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleCreditChange() {
    if (!selectedUser || creditDelta === 0) return;
    try {
      await adminChangeCredits(selectedUser.id, creditDelta, creditReason, creditNote || undefined);
      creditDelta = 0;
      creditNote = '';
      await loadAll();
    } catch (err: any) {
      alert(err.message);
    }
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }
</script>

<svelte:head>
  <title>Admin — BusinessAiOs</title>
</svelte:head>

<div class="min-h-screen bg-dark-50">
  <header class="bg-white border-b border-dark-100 sticky top-0 z-10">
    <div class="container-wide flex items-center justify-between h-16">
      <a href="/dashboard" class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
          <span class="text-white font-bold text-sm">🛡️</span>
        </div>
        <span class="font-bold text-lg">Admin Console</span>
      </a>
      <a href="/dashboard" class="text-sm text-primary-600 hover:underline">← กลับ Dashboard</a>
    </div>
  </header>

  <main class="container-wide py-8">
    <!-- Tabs -->
    <div class="flex gap-2 mb-6 border-b border-dark-100">
      <button onclick={() => tab = 'users'} class="px-4 py-2 font-semibold {tab === 'users' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-dark-900/60'}">👥 Users ({users.length})</button>
      <button onclick={() => tab = 'stats'} class="px-4 py-2 font-semibold {tab === 'stats' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-dark-900/60'}">📊 Stats</button>
      <button onclick={() => tab = 'emails'} class="px-4 py-2 font-semibold {tab === 'emails' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-dark-900/60'}">📧 Email Outbox ({emails.length})</button>
    </div>

    {#if isLoading}
      <div class="text-center py-12 text-dark-900/60">กำลังโหลด...</div>
    {:else if tab === 'users'}
      <div class="bg-white rounded-2xl border border-dark-100 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-dark-50 text-xs uppercase tracking-wider text-dark-900/60">
            <tr>
              <th class="text-left p-3">Email</th>
              <th class="text-left p-3">ชื่อ</th>
              <th class="text-left p-3">Role</th>
              <th class="text-right p-3">Credits</th>
              <th class="text-center p-3">Verified</th>
              <th class="text-left p-3">สร้างเมื่อ</th>
              <th class="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {#each users as u}
              <tr class="border-t border-dark-100 hover:bg-dark-50">
                <td class="p-3 font-mono text-xs">{u.email}</td>
                <td class="p-3">{u.first_name || ''} {u.last_name || u.name || ''}</td>
                <td class="p-3">
                  <select value={u.role || 'user'} onchange={(e) => handleRoleChange(u, (e.target as HTMLSelectElement).value)} class="text-xs border border-dark-200 rounded px-2 py-1">
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td class="p-3 text-right font-semibold">{u.credits}</td>
                <td class="p-3 text-center">{u.email_verified ? '✅' : '⏳'}</td>
                <td class="p-3 text-xs text-dark-900/60">{formatDate(u.created_at)}</td>
                <td class="p-3">
                  <button onclick={() => selectedUser = u} class="text-xs text-primary-600 hover:underline">+ เครดิต</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if selectedUser}
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onclick={() => selectedUser = null}>
          <div class="bg-white rounded-2xl p-6 w-full max-w-md" onclick={(e) => e.stopPropagation()}>
            <h3 class="font-bold text-lg mb-4">เติม/หักเครดิต</h3>
            <p class="text-sm text-dark-900/60 mb-4">{selectedUser.email}</p>
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium mb-1">จำนวน (+ เติม, - หัก)</label>
                <input type="number" bind:value={creditDelta} class="w-full px-3 py-2.5 rounded-lg border border-dark-200" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">เหตุผล</label>
                <select bind:value={creditReason} class="w-full px-3 py-2.5 rounded-lg border border-dark-200">
                  <option value="admin_grant">admin_grant</option>
                  <option value="admin_deduct">admin_deduct</option>
                  <option value="refund">refund</option>
                  <option value="promo">promo</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">โน้ต</label>
                <input type="text" bind:value={creditNote} class="w-full px-3 py-2.5 rounded-lg border border-dark-200" placeholder="(optional)" />
              </div>
            </div>
            <div class="flex gap-2 mt-5">
              <button onclick={handleCreditChange} class="btn-primary flex-1">ยืนยัน</button>
              <button onclick={() => selectedUser = null} class="btn-secondary">ยกเลิก</button>
            </div>
          </div>
        </div>
      {/if}
    {:else if tab === 'stats'}
      {#if stats}
        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white rounded-2xl border border-dark-100 p-5">
            <div class="text-xs text-dark-900/60 uppercase">Users</div>
            <div class="text-3xl font-bold mt-1">{stats.total_users}</div>
            <div class="text-xs text-green-600 mt-1">+{stats.new_users_7d} ใน 7 วัน</div>
          </div>
          <div class="bg-white rounded-2xl border border-dark-100 p-5">
            <div class="text-xs text-dark-900/60 uppercase">Projects</div>
            <div class="text-3xl font-bold mt-1">{stats.total_projects}</div>
          </div>
          <div class="bg-white rounded-2xl border border-dark-100 p-5">
            <div class="text-xs text-dark-900/60 uppercase">Generations</div>
            <div class="text-3xl font-bold mt-1">{stats.total_generations}</div>
            <div class="text-xs text-dark-900/60 mt-1">+ {stats.total_tool_runs} tool runs</div>
          </div>
          <div class="bg-white rounded-2xl border border-dark-100 p-5">
            <div class="text-xs text-dark-900/60 uppercase">API Cost (USD)</div>
            <div class="text-3xl font-bold mt-1">${stats.total_api_cost_usd.toFixed(3)}</div>
          </div>
          <div class="bg-white rounded-2xl border border-dark-100 p-5">
            <div class="text-xs text-dark-900/60 uppercase">Total Credits in System</div>
            <div class="text-3xl font-bold mt-1">{stats.total_credits.toLocaleString()}</div>
          </div>
        </div>
      {/if}
    {:else if tab === 'emails'}
      <div class="bg-white rounded-2xl border border-dark-100 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-dark-50 text-xs uppercase tracking-wider text-dark-900/60">
            <tr>
              <th class="text-left p-3">To</th>
              <th class="text-left p-3">Subject</th>
              <th class="text-left p-3">Template</th>
              <th class="text-left p-3">Status</th>
              <th class="text-left p-3">Created</th>
              <th class="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {#each emails as e}
              <tr class="border-t border-dark-100">
                <td class="p-3 font-mono text-xs">{e.to_email}</td>
                <td class="p-3">{e.subject}</td>
                <td class="p-3 text-xs">{e.template}</td>
                <td class="p-3">
                  <span class="text-xs px-2 py-0.5 rounded-full {e.status === 'sent' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}">{e.status}</span>
                </td>
                <td class="p-3 text-xs text-dark-900/60">{formatDate(e.created_at)}</td>
                <td class="p-3">
                  <a href={`/api/admin/emails/${e.id}?format=html`} target="_blank" class="text-xs text-primary-600 hover:underline">ดู</a>
                </td>
              </tr>
            {/each}
            {#if emails.length === 0}
              <tr><td colspan="6" class="p-6 text-center text-dark-900/50 text-sm">ยังไม่มีอีเมลใน outbox</td></tr>
            {/if}
          </tbody>
        </table>
      </div>
    {/if}
  </main>
</div>
