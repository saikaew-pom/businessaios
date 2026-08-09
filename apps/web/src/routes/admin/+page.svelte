<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { fullUser, initAuth, isAuthed } from '$lib/auth';
  import {
    adminListUsers, adminUpdateUser, adminChangeCredits, adminGetStats, adminListEmails,
    adminGetUserDetail, adminResendVerification, adminMarkVerified, adminSendPasswordReset, adminAddNote,
    type AdminUser, type AdminUserDetail,
  } from '$lib/api';

  let users = $state<AdminUser[]>([]);
  let usersTotal = $state(0);
  let usersPage = $state(1);
  const PAGE_SIZE = 20;

  let searchQuery = $state('');
  let roleFilter = $state('');
  let verifiedFilter = $state('');
  let searchDebounce: ReturnType<typeof setTimeout>;

  let stats = $state<any>(null);
  let emails = $state<any[]>([]);
  let isLoading = $state(false);
  let tab = $state<'overview' | 'users' | 'emails'>('overview');

  let detail = $state<AdminUserDetail | null>(null);
  let detailLoading = $state(false);
  let creditDelta = $state(0);
  let creditReason = $state('admin_grant');
  let creditNote = $state('');
  let noteText = $state('');
  let actionBusy = $state(false);

  onMount(async () => {
    await initAuth();
    if (!$isAuthed) {
      goto('/login');
      return;
    }
    if ($fullUser?.role !== 'admin') {
      goto('/today');
      return;
    }
    await Promise.all([loadUsers(), loadStats(), loadEmails()]);
  });

  async function loadUsers() {
    isLoading = true;
    try {
      const res = await adminListUsers({
        q: searchQuery || undefined,
        role: roleFilter || undefined,
        verified: verifiedFilter === '' ? undefined : (verifiedFilter as '0' | '1'),
        page: usersPage,
        pageSize: PAGE_SIZE,
      });
      users = res.users;
      usersTotal = res.total;
    } catch (err: any) {
      alert(err.message);
    } finally {
      isLoading = false;
    }
  }

  async function loadStats() {
    try {
      const s = await adminGetStats();
      stats = s.stats;
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function loadEmails() {
    try {
      const e = await adminListEmails();
      emails = e.emails;
    } catch {
      emails = [];
    }
  }

  function onFilterChange() {
    usersPage = 1;
    loadUsers();
  }

  function onSearchInput() {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(onFilterChange, 300);
  }

  function goToPage(delta: number) {
    const maxPage = Math.max(1, Math.ceil(usersTotal / PAGE_SIZE));
    usersPage = Math.min(maxPage, Math.max(1, usersPage + delta));
    loadUsers();
  }

  async function openDetail(user: AdminUser) {
    detail = null;
    detailLoading = true;
    creditDelta = 0;
    creditNote = '';
    noteText = '';
    try {
      detail = await adminGetUserDetail(user.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      detailLoading = false;
    }
  }

  function closeDetail() {
    detail = null;
  }

  async function refreshDetail() {
    if (!detail) return;
    detail = await adminGetUserDetail(detail.user.id);
  }

  async function handleRoleChange(newRole: string) {
    if (!detail) return;
    if (newRole === 'admin' && !confirm(`ให้สิทธิ์ admin กับ ${detail.user.email}? ผู้ใช้นี้จะเข้าถึงข้อมูลผู้ใช้ทุกคนในระบบได้`)) {
      return;
    }
    try {
      await adminUpdateUser(detail.user.id, { role: newRole });
      await Promise.all([refreshDetail(), loadUsers()]);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleCreditChange() {
    if (!detail || creditDelta === 0) return;
    if (creditDelta < 0 && !confirm(`หักเครดิต ${Math.abs(creditDelta)} จาก ${detail.user.email}? การกระทำนี้ย้อนกลับไม่ได้`)) {
      return;
    }
    actionBusy = true;
    try {
      await adminChangeCredits(detail.user.id, creditDelta, creditReason, creditNote || undefined);
      creditDelta = 0;
      creditNote = '';
      await Promise.all([refreshDetail(), loadUsers()]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      actionBusy = false;
    }
  }

  async function handleResendVerification() {
    if (!detail) return;
    actionBusy = true;
    try {
      await adminResendVerification(detail.user.id);
      await refreshDetail();
      alert('ส่งอีเมลยืนยันอีกครั้งแล้ว');
    } catch (err: any) {
      alert(err.message);
    } finally {
      actionBusy = false;
    }
  }

  async function handleMarkVerified() {
    if (!detail) return;
    if (!confirm(`ยืนยันอีเมล ${detail.user.email} ให้เลยโดยไม่ต้องรออีเมล? ใช้เมื่ออีเมลยืนยันส่งไม่ถึง user`)) return;
    actionBusy = true;
    try {
      await adminMarkVerified(detail.user.id);
      await Promise.all([refreshDetail(), loadUsers()]);
      alert('ยืนยันอีเมลให้ user แล้ว ใช้งานระบบได้ทันที');
    } catch (err: any) {
      alert(err.message);
    } finally {
      actionBusy = false;
    }
  }

  async function handleSendPasswordReset() {
    if (!detail) return;
    if (!confirm(`ส่งรหัส OTP รีเซ็ตรหัสผ่านไปที่ ${detail.user.email}?`)) return;
    actionBusy = true;
    try {
      await adminSendPasswordReset(detail.user.id);
      await refreshDetail();
      alert('ส่งรหัส OTP รีเซ็ตรหัสผ่านแล้ว');
    } catch (err: any) {
      alert(err.message);
    } finally {
      actionBusy = false;
    }
  }

  async function handleAddNote() {
    if (!detail || !noteText.trim()) return;
    actionBusy = true;
    try {
      await adminAddNote(detail.user.id, noteText.trim());
      noteText = '';
      await refreshDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      actionBusy = false;
    }
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatDateTime(ts: number) {
    return new Date(ts).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function actionLabel(action: string) {
    const labels: Record<string, string> = {
      note: '📝 บันทึกโน้ต',
      credit_change: '💳 ปรับเครดิต',
      user_update: '⚙️ แก้ไขบัญชี',
      resend_verification: '📧 ส่งอีเมลยืนยันซ้ำ',
      mark_verified: '✅ ยืนยันอีเมลให้โดยแอดมิน',
      send_password_reset: '🔑 ส่งรีเซ็ตรหัสผ่าน',
    };
    return labels[action] || action;
  }

  let totalPages = $derived(Math.max(1, Math.ceil(usersTotal / PAGE_SIZE)));
</script>

<svelte:head>
  <title>Admin — Business Smart OS</title>
</svelte:head>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950">
  <main class="container-wide py-8">
    <div class="flex items-center justify-between gap-2 mb-6">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
          <span class="text-white font-bold text-sm">🛡️</span>
        </div>
        <h1 class="font-bold text-lg">Operations Console</h1>
      </div>
      <div class="flex items-center gap-3">
        <a href="/admin/creative" class="text-sm text-primary-600 dark:text-primary-400 hover:underline">Creative Ops</a>
        <a href="/today" class="text-sm text-primary-600 dark:text-primary-400 hover:underline">← กลับวันนี้</a>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 mb-6 border-b border-dark-100 dark:border-dark-700">
      <button onclick={() => tab = 'overview'} class="px-4 py-2 font-semibold {tab === 'overview' ? 'border-b-2 border-primary-600 dark:border-primary-400 text-primary-600 dark:text-primary-400' : 'text-dark-900/60 dark:text-dark-100/60'}">📊 ภาพรวม</button>
      <button onclick={() => tab = 'users'} class="px-4 py-2 font-semibold {tab === 'users' ? 'border-b-2 border-primary-600 dark:border-primary-400 text-primary-600 dark:text-primary-400' : 'text-dark-900/60 dark:text-dark-100/60'}">👥 Users ({usersTotal})</button>
      <button onclick={() => tab = 'emails'} class="px-4 py-2 font-semibold {tab === 'emails' ? 'border-b-2 border-primary-600 dark:border-primary-400 text-primary-600 dark:text-primary-400' : 'text-dark-900/60 dark:text-dark-100/60'}">📧 Email Outbox ({emails.length})</button>
    </div>

    {#if tab === 'overview'}
      {#if stats}
        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-5">
            <div class="text-xs text-dark-900/60 dark:text-dark-100/60 uppercase">Users</div>
            <div class="text-3xl font-bold mt-1">{stats.total_users}</div>
            <div class="text-xs text-green-600 dark:text-green-400 mt-1">+{stats.new_users_7d} ใน 7 วัน</div>
          </div>
          <div class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-5">
            <div class="text-xs text-dark-900/60 dark:text-dark-100/60 uppercase">แผน + Generations</div>
            <div class="text-3xl font-bold mt-1">{stats.total_projects}</div>
            <div class="text-xs text-dark-900/60 dark:text-dark-100/60 mt-1">{stats.total_generations} generations · {stats.total_tool_runs} tool runs</div>
          </div>
          <div class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-5">
            <div class="text-xs text-dark-900/60 dark:text-dark-100/60 uppercase">ต้นทุนระบบอัจฉริยะ (USD)</div>
            <div class="text-3xl font-bold mt-1">${stats.total_api_cost_usd.toFixed(3)}</div>
            <div class="text-xs text-dark-900/60 dark:text-dark-100/60 mt-1">รายได้ ฿{(stats.revenue_satang / 100).toLocaleString()}</div>
          </div>
          <div class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-5">
            <div class="text-xs text-dark-900/60 dark:text-dark-100/60 uppercase">เครดิตคงเหลือรวม</div>
            <div class="text-3xl font-bold mt-1">{stats.total_credits.toLocaleString()}</div>
          </div>
        </div>

        <!-- Funnel -->
        <div class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-5 mb-6">
          <div class="text-sm font-semibold mb-4">Funnel: สมัคร → ยืนยันอีเมล → สร้างแผน → จ่ายเงิน</div>
          <div class="grid grid-cols-4 gap-3">
            {#each [
              { label: 'สมัคร', value: stats.funnel.signed_up },
              { label: 'ยืนยันอีเมล', value: stats.funnel.verified },
              { label: 'สร้างแผน', value: stats.funnel.created_a_plan },
              { label: 'จ่ายเงิน', value: stats.funnel.paid },
            ] as step, i}
              <div class="text-center">
                <div class="text-2xl font-bold">{step.value}</div>
                <div class="text-xs text-dark-900/60 dark:text-dark-100/60 mt-1">{step.label}</div>
                <div class="text-xs text-dark-900/40 dark:text-dark-100/40 mt-0.5">
                  {stats.funnel.signed_up > 0 ? Math.round((step.value / stats.funnel.signed_up) * 100) : 0}%
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Signups sparkline -->
        {#if stats.signups_by_day?.length}
          <div class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-5">
            <div class="text-sm font-semibold mb-4">ผู้สมัครใหม่ต่อวัน (14 วันล่าสุด)</div>
            <div class="flex items-end gap-1.5 h-24">
              {#each stats.signups_by_day as d}
                {@const max = Math.max(...stats.signups_by_day.map((x: any) => x.c), 1)}
                <div class="flex-1 flex flex-col items-center justify-end gap-1 group relative">
                  <div class="text-[10px] text-dark-900/50 dark:text-dark-100/50 opacity-0 group-hover:opacity-100 absolute -top-4">{d.c}</div>
                  <div class="w-full bg-primary-500 rounded-t" style="height: {Math.max(4, (d.c / max) * 100)}%"></div>
                  <div class="text-[9px] text-dark-900/40 dark:text-dark-100/40">{d.day.slice(5)}</div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {/if}
    {:else if tab === 'users'}
      <!-- Search + filters -->
      <div class="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="ค้นหา email หรือชื่อ..."
          bind:value={searchQuery}
          oninput={onSearchInput}
          class="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 text-sm"
        />
        <select bind:value={roleFilter} onchange={onFilterChange} class="px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 text-sm">
          <option value="">ทุก role</option>
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        <select bind:value={verifiedFilter} onchange={onFilterChange} class="px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 text-sm">
          <option value="">ยืนยันอีเมล: ทั้งหมด</option>
          <option value="1">ยืนยันแล้ว</option>
          <option value="0">ยังไม่ยืนยัน</option>
        </select>
      </div>

      <div class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-dark-50 dark:bg-dark-950 text-xs uppercase tracking-wider text-dark-900/60 dark:text-dark-100/60">
            <tr>
              <th class="text-left p-3">Email</th>
              <th class="text-left p-3">ชื่อ</th>
              <th class="text-left p-3">Role</th>
              <th class="text-right p-3">Credits</th>
              <th class="text-center p-3">Verified</th>
              <th class="text-left p-3">สร้างเมื่อ</th>
            </tr>
          </thead>
          <tbody>
            {#if isLoading}
              <tr><td colspan="6" class="p-6 text-center text-dark-900/50 dark:text-dark-100/50">กำลังโหลด...</td></tr>
            {:else if users.length === 0}
              <tr><td colspan="6" class="p-6 text-center text-dark-900/50 dark:text-dark-100/50">ไม่พบผู้ใช้ที่ตรงเงื่อนไข</td></tr>
            {:else}
              {#each users as u}
                <tr class="border-t border-dark-100 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-900/50 cursor-pointer" onclick={() => openDetail(u)}>
                  <td class="p-3 font-mono text-xs">{u.email}</td>
                  <td class="p-3">{u.first_name || ''} {u.last_name || u.name || ''}</td>
                  <td class="p-3">
                    <span class="text-xs px-2 py-0.5 rounded-full {u.role === 'admin' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400' : 'bg-dark-50 dark:bg-dark-950 text-dark-900/60 dark:text-dark-100/60'}">{u.role || 'user'}</span>
                  </td>
                  <td class="p-3 text-right font-semibold">{u.credits}</td>
                  <td class="p-3 text-center">{u.email_verified ? '✅' : '⏳'}</td>
                  <td class="p-3 text-xs text-dark-900/60 dark:text-dark-100/60">{formatDate(u.created_at)}</td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between mt-4 text-sm">
        <div class="text-dark-900/60 dark:text-dark-100/60">ทั้งหมด {usersTotal.toLocaleString()} คน</div>
        <div class="flex items-center gap-3">
          <button onclick={() => goToPage(-1)} disabled={usersPage <= 1} class="btn-secondary px-3 py-1.5 disabled:opacity-40">← ก่อนหน้า</button>
          <span class="text-dark-900/60 dark:text-dark-100/60">หน้า {usersPage} / {totalPages}</span>
          <button onclick={() => goToPage(1)} disabled={usersPage >= totalPages} class="btn-secondary px-3 py-1.5 disabled:opacity-40">ถัดไป →</button>
        </div>
      </div>
    {:else if tab === 'emails'}
      <div class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-dark-50 dark:bg-dark-950 text-xs uppercase tracking-wider text-dark-900/60 dark:text-dark-100/60">
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
              <tr class="border-t border-dark-100 dark:border-dark-700">
                <td class="p-3 font-mono text-xs">{e.to_email}</td>
                <td class="p-3">{e.subject}</td>
                <td class="p-3 text-xs">{e.template}</td>
                <td class="p-3">
                  <span class="text-xs px-2 py-0.5 rounded-full {e.status === 'sent' ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'}">{e.status}</span>
                </td>
                <td class="p-3 text-xs text-dark-900/60 dark:text-dark-100/60">{formatDate(e.created_at)}</td>
                <td class="p-3">
                  <a href={`/api/admin/emails/${e.id}?format=html`} target="_blank" class="text-xs text-primary-600 dark:text-primary-400 hover:underline">ดู</a>
                </td>
              </tr>
            {/each}
            {#if emails.length === 0}
              <tr><td colspan="6" class="p-6 text-center text-dark-900/50 dark:text-dark-100/50 text-sm">ยังไม่มีอีเมลใน outbox</td></tr>
            {/if}
          </tbody>
        </table>
      </div>
    {/if}
  </main>
</div>

<!-- User Detail panel -->
{#if detailLoading || detail}
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onclick={closeDetail}>
    <div class="bg-white dark:bg-dark-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onclick={(e) => e.stopPropagation()}>
      {#if detailLoading}
        <div class="p-12 text-center text-dark-900/60 dark:text-dark-100/60">กำลังโหลดข้อมูลผู้ใช้...</div>
      {:else if detail}
        <div class="p-6 border-b border-dark-100 dark:border-dark-700 flex items-center justify-between sticky top-0 bg-white dark:bg-dark-800">
          <div>
            <h3 class="font-bold text-lg">{detail.user.first_name || ''} {detail.user.last_name || detail.user.name || ''}</h3>
            <p class="text-sm text-dark-900/60 dark:text-dark-100/60 font-mono">{detail.user.email}</p>
          </div>
          <button onclick={closeDetail} class="text-dark-900/40 dark:text-dark-100/40 hover:text-dark-900 text-xl leading-none">✕</button>
        </div>

        <div class="p-6 space-y-6">
          <!-- Profile summary -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <div class="text-xs text-dark-900/50 dark:text-dark-100/50 uppercase">Role</div>
              <select value={detail.user.role || 'user'} onchange={(e) => handleRoleChange((e.target as HTMLSelectElement).value)} class="mt-1 text-sm border border-dark-200 dark:border-dark-600 rounded px-2 py-1 w-full">
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div>
              <div class="text-xs text-dark-900/50 dark:text-dark-100/50 uppercase">Credits</div>
              <div class="font-semibold mt-1">{detail.user.credits}</div>
            </div>
            <div>
              <div class="text-xs text-dark-900/50 dark:text-dark-100/50 uppercase">ยืนยันอีเมล</div>
              <div class="mt-1">{detail.user.email_verified ? '✅ ยืนยันแล้ว' : '⏳ ยังไม่ยืนยัน'}</div>
            </div>
            <div>
              <div class="text-xs text-dark-900/50 dark:text-dark-100/50 uppercase">สมัครเมื่อ</div>
              <div class="mt-1 text-xs">{formatDate(detail.user.created_at)}</div>
            </div>
          </div>

          <!-- Help-user actions -->
          <div>
            <div class="text-xs font-semibold text-dark-900/60 dark:text-dark-100/60 uppercase mb-2">ช่วย user</div>
            <div class="flex flex-wrap gap-2">
              <button onclick={handleResendVerification} disabled={actionBusy || !!detail.user.email_verified} class="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">
                📧 ส่งอีเมลยืนยันอีกครั้ง
              </button>
              <button onclick={handleMarkVerified} disabled={actionBusy || !!detail.user.email_verified} class="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">
                ✅ ยืนยันอีเมลให้เลย
              </button>
              <button onclick={handleSendPasswordReset} disabled={actionBusy} class="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">
                🔑 ส่งรหัส OTP รีเซ็ตรหัสผ่าน
              </button>
            </div>
          </div>

          <!-- Credit adjust -->
          <div class="bg-dark-50 dark:bg-dark-950 rounded-xl p-4">
            <div class="text-xs font-semibold text-dark-900/60 dark:text-dark-100/60 uppercase mb-3">เติม/หักเครดิต</div>
            <div class="grid sm:grid-cols-3 gap-3">
              <input type="number" bind:value={creditDelta} placeholder="+ เติม, - หัก" class="px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 text-sm" />
              <select bind:value={creditReason} class="px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 text-sm">
                <option value="admin_grant">admin_grant</option>
                <option value="admin_deduct">admin_deduct</option>
                <option value="refund">refund</option>
                <option value="promo">promo</option>
              </select>
              <input type="text" bind:value={creditNote} placeholder="โน้ต (optional)" class="px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 text-sm" />
            </div>
            <button onclick={handleCreditChange} disabled={actionBusy || creditDelta === 0} class="btn-primary text-sm mt-3 disabled:opacity-40">ยืนยัน</button>
          </div>

          <!-- Projects -->
          <div>
            <div class="text-xs font-semibold text-dark-900/60 dark:text-dark-100/60 uppercase mb-2">แผนของ user ({detail.projects.length})</div>
            {#if detail.projects.length === 0}
              <p class="text-sm text-dark-900/50 dark:text-dark-100/50">ยังไม่มีแผน</p>
            {:else}
              <div class="space-y-1.5">
                {#each detail.projects as p}
                  <div class="flex items-center justify-between text-sm py-1.5 border-b border-dark-100 dark:border-dark-700 last:border-0">
                    <span>{p.name}</span>
                    <span class="text-xs text-dark-900/50 dark:text-dark-100/50">{p.status} · ขั้นตอน {p.current_step} · {formatDate(p.updated_at)}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Activity -->
          <div class="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div class="text-xs text-dark-900/50 dark:text-dark-100/50 uppercase">Generations</div>
              <div class="mt-1">{detail.generations_summary.count} ครั้ง · ${detail.generations_summary.cost_usd.toFixed(4)}</div>
            </div>
            <div>
              <div class="text-xs text-dark-900/50 dark:text-dark-100/50 uppercase">Tool runs ล่าสุด</div>
              <div class="mt-1">{detail.tool_runs.length ? detail.tool_runs.map(t => t.tool_name).join(', ') : '—'}</div>
            </div>
          </div>

          <!-- Credit history -->
          {#if detail.credit_transactions.length > 0}
            <div>
              <div class="text-xs font-semibold text-dark-900/60 dark:text-dark-100/60 uppercase mb-2">ประวัติเครดิต</div>
              <div class="space-y-1">
                {#each detail.credit_transactions as t}
                  <div class="flex items-center justify-between text-xs py-1">
                    <span class="{t.delta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} font-semibold">{t.delta > 0 ? '+' : ''}{t.delta}</span>
                    <span class="text-dark-900/60 dark:text-dark-100/60">{t.reason}{t.note ? ` — ${t.note}` : ''}</span>
                    <span class="text-dark-900/40 dark:text-dark-100/40">{formatDate(t.created_at)}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Notes / admin action log -->
          <div>
            <div class="text-xs font-semibold text-dark-900/60 dark:text-dark-100/60 uppercase mb-2">โน้ตทีม + ประวัติการช่วยเหลือ</div>
            <div class="flex gap-2 mb-3">
              <input type="text" bind:value={noteText} placeholder="บันทึกโน้ตถึงทีม..." class="flex-1 px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 text-sm" />
              <button onclick={handleAddNote} disabled={actionBusy || !noteText.trim()} class="btn-secondary text-sm px-3 disabled:opacity-40">บันทึก</button>
            </div>
            {#if detail.admin_actions.length === 0}
              <p class="text-sm text-dark-900/50 dark:text-dark-100/50">ยังไม่มีประวัติ</p>
            {:else}
              <div class="space-y-2">
                {#each detail.admin_actions as a}
                  <div class="text-xs bg-dark-50 dark:bg-dark-950 rounded-lg p-2.5">
                    <div class="flex items-center justify-between">
                      <span class="font-semibold">{actionLabel(a.action)}</span>
                      <span class="text-dark-900/40 dark:text-dark-100/40">{formatDateTime(a.created_at)}</span>
                    </div>
                    {#if a.action === 'note'}
                      <div class="mt-1 text-dark-900/70 dark:text-dark-100/70">{JSON.parse(a.details).text}</div>
                    {/if}
                    <div class="mt-1 text-dark-900/40 dark:text-dark-100/40">โดย {a.admin_email || 'ระบบ'}</div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
