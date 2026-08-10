<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { fullUser, initAuth, isAuthed } from '$lib/auth';
  import { Card, Button, Chip, Field, ListItem, EmptyState, Icon, Sheet, showToast } from '$lib/ui';
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
  let error = $state('');

  let detail = $state<AdminUserDetail | null>(null);
  let detailLoading = $state(false);
  let detailError = $state('');
  let creditDelta = $state(0);
  let creditReason = $state('admin_grant');
  let creditNote = $state('');
  let noteText = $state('');
  let actionBusy = $state(false);

  // Inline confirm — replaces window.confirm() for the "ย้อนกลับไม่ได้"
  // actions §2.6 calls out (role change, credit deduction, force-verify,
  // password reset): a small in-place warning block instead of a native
  // dialog the user can't act on comfortably from a phone.
  let pendingConfirm = $state<{ message: string; run: () => void } | null>(null);
  let confirmBlockEl = $state<HTMLDivElement | null>(null);
  function requestConfirm(message: string, run: () => void) {
    pendingConfirm = { message, run };
  }

  // The confirm block renders at the top of the Sheet body, but the action
  // that triggers it (e.g. credit deduction) can be scrolled far below —
  // without this, confirming from a scrolled position leaves the block
  // rendered off-screen with no visible feedback that anything happened.
  // The Sheet's scroll container (`<div role="dialog">`) has default CSS
  // scroll anchoring, which fights a plain scrollIntoView() call here: as
  // soon as this block is inserted above the visible viewport, the browser
  // auto-compensates scrollTop to keep the below-the-fold content visually
  // anchored in place, silently undoing the scroll. Disabling anchoring on
  // that container first is what makes the scroll actually stick.
  $effect(() => {
    if (!pendingConfirm || !confirmBlockEl) return;
    const scrollContainer = confirmBlockEl.closest('[role="dialog"]') as HTMLElement | null;
    if (scrollContainer) scrollContainer.style.overflowAnchor = 'none';
    confirmBlockEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  function confirmYes() {
    const p = pendingConfirm;
    pendingConfirm = null;
    p?.run();
  }
  function confirmNo() {
    pendingConfirm = null;
  }

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
    error = '';
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
      error = err.message || 'โหลดรายชื่อผู้ใช้ไม่สำเร็จ';
    } finally {
      isLoading = false;
    }
  }

  async function loadStats() {
    try {
      const s = await adminGetStats();
      stats = s.stats;
    } catch (err: any) {
      error = err.message || 'โหลดสถิติไม่สำเร็จ';
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
    detailError = '';
    detailLoading = true;
    creditDelta = 0;
    creditNote = '';
    noteText = '';
    pendingConfirm = null;
    try {
      detail = await adminGetUserDetail(user.id);
    } catch (err: any) {
      error = err.message || 'โหลดข้อมูลผู้ใช้ไม่สำเร็จ';
    } finally {
      detailLoading = false;
    }
  }

  function closeDetail() {
    detail = null;
    pendingConfirm = null;
  }

  async function refreshDetail() {
    if (!detail) return;
    detail = await adminGetUserDetail(detail.user.id);
  }

  function onRoleSelect(newRole: string) {
    if (!detail || newRole === (detail.user.role || 'user')) return;
    if (newRole === 'admin') {
      requestConfirm(`ให้สิทธิ์ admin กับ ${detail.user.email}? ผู้ใช้นี้จะเข้าถึงข้อมูลผู้ใช้ทุกคนในระบบได้`, () => doRoleChange(newRole));
    } else {
      doRoleChange(newRole);
    }
  }

  async function doRoleChange(newRole: string) {
    if (!detail) return;
    detailError = '';
    try {
      await adminUpdateUser(detail.user.id, { role: newRole });
      await Promise.all([refreshDetail(), loadUsers()]);
      showToast('เปลี่ยน role แล้ว');
    } catch (err: any) {
      detailError = err.message || 'เปลี่ยน role ไม่สำเร็จ';
    }
  }

  function onCreditSubmit() {
    if (!detail || creditDelta === 0) return;
    if (creditDelta < 0) {
      requestConfirm(`หักเครดิต ${Math.abs(creditDelta)} จาก ${detail.user.email}? การกระทำนี้ย้อนกลับไม่ได้`, doCreditChange);
    } else {
      doCreditChange();
    }
  }

  async function doCreditChange() {
    if (!detail || creditDelta === 0) return;
    detailError = '';
    actionBusy = true;
    try {
      await adminChangeCredits(detail.user.id, creditDelta, creditReason, creditNote || undefined);
      creditDelta = 0;
      creditNote = '';
      await Promise.all([refreshDetail(), loadUsers()]);
      showToast('ปรับเครดิตแล้ว');
    } catch (err: any) {
      detailError = err.message || 'ปรับเครดิตไม่สำเร็จ';
    } finally {
      actionBusy = false;
    }
  }

  async function handleResendVerification() {
    if (!detail) return;
    detailError = '';
    actionBusy = true;
    try {
      await adminResendVerification(detail.user.id);
      await refreshDetail();
      showToast('ส่งอีเมลยืนยันอีกครั้งแล้ว');
    } catch (err: any) {
      detailError = err.message || 'ส่งอีเมลไม่สำเร็จ';
    } finally {
      actionBusy = false;
    }
  }

  function onMarkVerifiedClick() {
    if (!detail) return;
    requestConfirm(`ยืนยันอีเมล ${detail.user.email} ให้เลยโดยไม่ต้องรออีเมล? ใช้เมื่ออีเมลยืนยันส่งไม่ถึง user`, doMarkVerified);
  }

  async function doMarkVerified() {
    if (!detail) return;
    detailError = '';
    actionBusy = true;
    try {
      await adminMarkVerified(detail.user.id);
      await Promise.all([refreshDetail(), loadUsers()]);
      showToast('ยืนยันอีเมลให้ user แล้ว ใช้งานระบบได้ทันที');
    } catch (err: any) {
      detailError = err.message || 'ยืนยันอีเมลไม่สำเร็จ';
    } finally {
      actionBusy = false;
    }
  }

  function onSendPasswordResetClick() {
    if (!detail) return;
    requestConfirm(`ส่งรหัส OTP รีเซ็ตรหัสผ่านไปที่ ${detail.user.email}?`, doSendPasswordReset);
  }

  async function doSendPasswordReset() {
    if (!detail) return;
    detailError = '';
    actionBusy = true;
    try {
      await adminSendPasswordReset(detail.user.id);
      await refreshDetail();
      showToast('ส่งรหัส OTP รีเซ็ตรหัสผ่านแล้ว');
    } catch (err: any) {
      detailError = err.message || 'ส่งรหัสไม่สำเร็จ';
    } finally {
      actionBusy = false;
    }
  }

  async function handleAddNote() {
    if (!detail || !noteText.trim()) return;
    detailError = '';
    actionBusy = true;
    try {
      await adminAddNote(detail.user.id, noteText.trim());
      noteText = '';
      await refreshDetail();
    } catch (err: any) {
      detailError = err.message || 'บันทึกโน้ตไม่สำเร็จ';
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
      note: 'บันทึกโน้ต',
      credit_change: 'ปรับเครดิต',
      user_update: 'แก้ไขบัญชี',
      resend_verification: 'ส่งอีเมลยืนยันซ้ำ',
      mark_verified: 'ยืนยันอีเมลให้โดยแอดมิน',
      send_password_reset: 'ส่งรีเซ็ตรหัสผ่าน',
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
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div class="flex items-center gap-2.5">
        <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white">
          <Icon name="shield" size={18} />
        </div>
        <h1 class="t-title font-bold">Operations Console</h1>
      </div>
      <div class="flex items-center gap-3">
        <a href="/admin/creative" class="btn-secondary">Creative Ops</a>
        <a href="/today" class="btn-secondary">← กลับวันนี้</a>
      </div>
    </div>

    {#if error}
      <div class="mb-4 rounded-lg border border-danger-100 dark:border-danger-600/40 bg-danger-50 dark:bg-danger-600/15 p-3 text-sm text-danger-700 dark:text-danger-100">{error}</div>
    {/if}

    <!-- Tabs -->
    <div class="flex flex-wrap gap-2 mb-6">
      <Chip active={tab === 'overview'} onclick={() => (tab = 'overview')}>
        <span class="inline-flex items-center gap-1.5"><Icon name="bar-chart" size={14} />ภาพรวม</span>
      </Chip>
      <Chip active={tab === 'users'} onclick={() => (tab = 'users')}>
        <span class="inline-flex items-center gap-1.5"><Icon name="users" size={14} />Users ({usersTotal})</span>
      </Chip>
      <Chip active={tab === 'emails'} onclick={() => (tab = 'emails')}>
        <span class="inline-flex items-center gap-1.5"><Icon name="mail" size={14} />Email Outbox ({emails.length})</span>
      </Chip>
    </div>

    {#if tab === 'overview'}
      {#if stats}
        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <div class="flex items-center gap-1.5 text-xs uppercase text-dark-900/60 dark:text-dark-100/60"><Icon name="users" size={14} />Users</div>
            <div class="text-3xl font-bold mt-1">{stats.total_users}</div>
            <div class="text-xs text-success-600 dark:text-success-100 mt-1">+{stats.new_users_7d} ใน 7 วัน</div>
          </Card>
          <Card>
            <div class="flex items-center gap-1.5 text-xs uppercase text-dark-900/60 dark:text-dark-100/60"><Icon name="layout-grid" size={14} />แผน + Generations</div>
            <div class="text-3xl font-bold mt-1">{stats.total_projects}</div>
            <div class="text-xs text-dark-900/60 dark:text-dark-100/60 mt-1">{stats.total_generations} generations · {stats.total_tool_runs} tool runs</div>
          </Card>
          <Card>
            <div class="flex items-center gap-1.5 text-xs uppercase text-dark-900/60 dark:text-dark-100/60"><Icon name="bar-chart" size={14} />ต้นทุนระบบอัจฉริยะ (USD)</div>
            <div class="text-3xl font-bold mt-1">${stats.total_api_cost_usd.toFixed(3)}</div>
            <div class="text-xs text-dark-900/60 dark:text-dark-100/60 mt-1">รายได้ ฿{(stats.revenue_satang / 100).toLocaleString()}</div>
          </Card>
          <Card>
            <div class="flex items-center gap-1.5 text-xs uppercase text-dark-900/60 dark:text-dark-100/60"><Icon name="wallet" size={14} />เครดิตคงเหลือรวม</div>
            <div class="text-3xl font-bold mt-1">{stats.total_credits.toLocaleString()}</div>
          </Card>
        </div>

        <!-- Funnel -->
        <Card padding="normal">
          <div class="t-heading mb-4">Funnel: สมัคร → ยืนยันอีเมล → สร้างแผน → จ่ายเงิน</div>
          <div class="grid grid-cols-4 gap-3">
            {#each [
              { label: 'สมัคร', value: stats.funnel.signed_up },
              { label: 'ยืนยันอีเมล', value: stats.funnel.verified },
              { label: 'สร้างแผน', value: stats.funnel.created_a_plan },
              { label: 'จ่ายเงิน', value: stats.funnel.paid },
            ] as step}
              <div class="text-center">
                <div class="text-2xl font-bold">{step.value}</div>
                <div class="t-caption mt-1">{step.label}</div>
                <div class="text-xs text-dark-900/40 dark:text-dark-100/40 mt-0.5">
                  {stats.funnel.signed_up > 0 ? Math.round((step.value / stats.funnel.signed_up) * 100) : 0}%
                </div>
              </div>
            {/each}
          </div>
        </Card>

        <!-- Signups sparkline -->
        {#if stats.signups_by_day?.length}
          <div class="mt-6">
            <Card padding="normal">
              <div class="t-heading mb-4">ผู้สมัครใหม่ต่อวัน (14 วันล่าสุด)</div>
              <div class="flex items-end gap-1.5 h-24">
                {#each stats.signups_by_day as d}
                  {@const max = Math.max(...stats.signups_by_day.map((x: any) => x.c), 1)}
                  <div class="flex-1 h-full flex flex-col items-center justify-end gap-1 group relative">
                    <div class="text-[10px] text-dark-900/50 dark:text-dark-100/50 opacity-0 group-hover:opacity-100 absolute -top-4">{d.c}</div>
                    <div class="w-full bg-primary-500 rounded-t" style="height: {Math.max(4, (d.c / max) * 100)}%"></div>
                    <div class="text-[9px] text-dark-900/40 dark:text-dark-100/40">{d.day.slice(5)}</div>
                  </div>
                {/each}
              </div>
            </Card>
          </div>
        {/if}
      {/if}
    {:else if tab === 'users'}
      <!-- Search + filters -->
      <div class="flex flex-wrap items-end gap-3 mb-4">
        <div class="flex-1 min-w-[220px]">
          <label class="mb-3.5 block">
            <span class="t-micro mb-1.5 flex items-center gap-1 text-dark-600 dark:text-dark-300"><Icon name="search" size={13} />ค้นหา</span>
            <input
              type="text"
              placeholder="email หรือชื่อ..."
              bind:value={searchQuery}
              oninput={onSearchInput}
              class="input w-full"
            />
          </label>
        </div>
        <select bind:value={roleFilter} onchange={onFilterChange} class="input">
          <option value="">ทุก role</option>
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        <select bind:value={verifiedFilter} onchange={onFilterChange} class="input">
          <option value="">ยืนยันอีเมล: ทั้งหมด</option>
          <option value="1">ยืนยันแล้ว</option>
          <option value="0">ยังไม่ยืนยัน</option>
        </select>
      </div>

      <Card padding="none">
        {#if isLoading}
          <div class="p-6 text-center t-caption">กำลังโหลด...</div>
        {:else if users.length === 0}
          <div class="p-2">
            <EmptyState emoji="🔍" title="ไม่พบผู้ใช้ที่ตรงเงื่อนไข" subtitle="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" />
          </div>
        {:else}
          <div class="px-4">
            {#each users as u, i}
              <ListItem
                title={u.email}
                subtitle={`${u.first_name || u.name || ''} ${u.last_name || ''} · role: ${u.role || 'user'} · ${u.credits} เครดิต · ${u.email_verified ? 'ยืนยันแล้ว' : 'รอยืนยัน'} · สมัคร ${formatDate(u.created_at)}`.trim()}
                onclick={() => openDetail(u)}
                last={i === users.length - 1}
              >
                {#snippet icon()}<Icon name={u.role === 'admin' ? 'shield' : 'user'} size={16} />{/snippet}
              </ListItem>
            {/each}
          </div>
        {/if}
      </Card>

      <!-- Pagination -->
      <div class="flex items-center justify-between mt-4 text-sm">
        <div class="t-caption">ทั้งหมด {usersTotal.toLocaleString()} คน</div>
        <div class="flex items-center gap-3">
          <Button variant="secondary" fullWidth={false} disabled={usersPage <= 1} onclick={() => goToPage(-1)}>← ก่อนหน้า</Button>
          <span class="t-caption">หน้า {usersPage} / {totalPages}</span>
          <Button variant="secondary" fullWidth={false} disabled={usersPage >= totalPages} onclick={() => goToPage(1)}>ถัดไป →</Button>
        </div>
      </div>
    {:else if tab === 'emails'}
      <Card padding="none">
        {#if emails.length === 0}
          <div class="p-2">
            <EmptyState emoji="📭" title="ยังไม่มีอีเมลใน outbox" />
          </div>
        {:else}
          <div class="divide-y divide-dark-100 dark:divide-dark-700">
            {#each emails as e}
              <a
                href={`/api/admin/emails/${e.id}?format=html`}
                target="_blank"
                rel="noopener"
                class="flex items-center gap-3 px-4 py-3 hover:bg-dark-50 dark:hover:bg-dark-900/50"
              >
                <div class="min-w-0 flex-1">
                  <div class="t-heading truncate">{e.subject}</div>
                  <div class="t-caption truncate">{e.to_email} · {e.template} · {formatDate(e.created_at)}</div>
                </div>
                <span class="shrink-0 text-xs px-2 py-0.5 rounded-full {e.status === 'sent' ? 'bg-success-50 dark:bg-success-600/20 text-success-700 dark:text-success-100' : 'bg-warning-50 dark:bg-warning-600/20 text-warning-700 dark:text-warning-100'}">{e.status}</span>
                <Icon name="chevron-right" size={16} />
              </a>
            {/each}
          </div>
        {/if}
      </Card>
    {/if}
  </main>
</div>

<!-- User Detail sheet -->
<Sheet open={Boolean(detailLoading || detail)} onclose={closeDetail}>
  {#if detailLoading}
    <div class="p-6 text-center t-caption">กำลังโหลดข้อมูลผู้ใช้...</div>
  {:else if detail}
    <div class="flex items-center justify-between mb-4">
      <div class="min-w-0">
        <h3 class="t-title truncate">{detail.user.first_name || ''} {detail.user.last_name || detail.user.name || ''}</h3>
        <p class="t-caption truncate font-mono">{detail.user.email}</p>
      </div>
      <button type="button" onclick={closeDetail} aria-label="ปิด" class="shrink-0 text-dark-900/40 hover:text-dark-900 dark:text-dark-100/40 dark:hover:text-dark-50">
        <Icon name="x" size={20} />
      </button>
    </div>

    <div class="space-y-6">
      {#if detailError}
            <div class="rounded-lg border border-danger-100 dark:border-danger-600/40 bg-danger-50 dark:bg-danger-600/15 p-3 text-sm text-danger-700 dark:text-danger-100">{detailError}</div>
          {/if}

          {#if pendingConfirm}
            <div bind:this={confirmBlockEl} class="rounded-xl border-[1.5px] border-warning-600/40 bg-warning-50 p-4 dark:bg-warning-600/10">
              <p class="t-body mb-3 text-warning-700 dark:text-warning-100">{pendingConfirm.message}</p>
              <div class="flex gap-2">
                <Button variant="ghost" fullWidth={false} onclick={confirmNo}>ยกเลิก</Button>
                <Button variant="danger" fullWidth={false} onclick={confirmYes}>ยืนยัน</Button>
              </div>
            </div>
          {/if}

          <!-- Profile summary -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <div class="t-micro text-dark-900/50 dark:text-dark-100/50">Role</div>
              <select value={detail.user.role || 'user'} onchange={(e) => onRoleSelect((e.target as HTMLSelectElement).value)} class="input mt-1 w-full text-sm">
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div>
              <div class="t-micro text-dark-900/50 dark:text-dark-100/50">Credits</div>
              <div class="font-semibold mt-1">{detail.user.credits}</div>
            </div>
            <div>
              <div class="t-micro text-dark-900/50 dark:text-dark-100/50">ยืนยันอีเมล</div>
              <div class="mt-1 flex items-center gap-1">
                <Icon name={detail.user.email_verified ? 'check' : 'clock'} size={14} />
                {detail.user.email_verified ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน'}
              </div>
            </div>
            <div>
              <div class="t-micro text-dark-900/50 dark:text-dark-100/50">สมัครเมื่อ</div>
              <div class="mt-1 text-xs">{formatDate(detail.user.created_at)}</div>
            </div>
          </div>

          <!-- Help-user actions -->
          <div>
            <div class="t-micro mb-2 text-dark-900/60 dark:text-dark-100/60">ช่วย user</div>
            <div class="flex flex-wrap gap-2">
              <Button variant="secondary" fullWidth={false} disabled={actionBusy || !!detail.user.email_verified} onclick={handleResendVerification}>
                <Icon name="mail" size={14} />ส่งอีเมลยืนยันอีกครั้ง
              </Button>
              <Button variant="secondary" fullWidth={false} disabled={actionBusy || !!detail.user.email_verified} onclick={onMarkVerifiedClick}>
                <Icon name="check" size={14} />ยืนยันอีเมลให้เลย
              </Button>
              <Button variant="secondary" fullWidth={false} disabled={actionBusy} onclick={onSendPasswordResetClick}>
                <Icon name="key" size={14} />ส่งรหัส OTP รีเซ็ตรหัสผ่าน
              </Button>
            </div>
          </div>

          <!-- Credit adjust -->
          <Card tinted>
            <div class="t-micro mb-3 text-dark-900/60 dark:text-dark-100/60">เติม/หักเครดิต</div>
            <div class="grid sm:grid-cols-3 gap-3">
              <input type="number" bind:value={creditDelta} placeholder="+ เติม, - หัก" class="input" />
              <select bind:value={creditReason} class="input">
                <option value="admin_grant">admin_grant</option>
                <option value="admin_deduct">admin_deduct</option>
                <option value="refund">refund</option>
                <option value="promo">promo</option>
              </select>
              <Field label="โน้ต (optional)" bind:value={creditNote} placeholder="เหตุผล..." />
            </div>
            <Button fullWidth={false} disabled={actionBusy || creditDelta === 0} onclick={onCreditSubmit}>ยืนยัน</Button>
          </Card>

          <!-- Projects -->
          <div>
            <div class="t-micro mb-2 text-dark-900/60 dark:text-dark-100/60">แผนของ user ({detail.projects.length})</div>
            {#if detail.projects.length === 0}
              <p class="t-caption">ยังไม่มีแผน</p>
            {:else}
              <div class="space-y-1.5">
                {#each detail.projects as p}
                  <div class="flex items-center justify-between text-sm py-1.5 border-b border-dark-100 dark:border-dark-700 last:border-0">
                    <span>{p.name}</span>
                    <span class="t-caption">{p.status} · ขั้นตอน {p.current_step} · {formatDate(p.updated_at)}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Activity -->
          <div class="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div class="t-micro text-dark-900/50 dark:text-dark-100/50">Generations</div>
              <div class="mt-1">{detail.generations_summary.count} ครั้ง · ${detail.generations_summary.cost_usd.toFixed(4)}</div>
            </div>
            <div>
              <div class="t-micro text-dark-900/50 dark:text-dark-100/50">Tool runs ล่าสุด</div>
              <div class="mt-1">{detail.tool_runs.length ? detail.tool_runs.map(t => t.tool_name).join(', ') : '—'}</div>
            </div>
          </div>

          <!-- Credit history -->
          {#if detail.credit_transactions.length > 0}
            <div>
              <div class="t-micro mb-2 text-dark-900/60 dark:text-dark-100/60">ประวัติเครดิต</div>
              <div class="space-y-1">
                {#each detail.credit_transactions as t}
                  <div class="flex items-center justify-between text-xs py-1">
                    <span class="{t.delta > 0 ? 'text-success-600 dark:text-success-100' : 'text-danger-600 dark:text-danger-100'} font-semibold">{t.delta > 0 ? '+' : ''}{t.delta}</span>
                    <span class="text-dark-900/60 dark:text-dark-100/60">{t.reason}{t.note ? ` — ${t.note}` : ''}</span>
                    <span class="text-dark-900/40 dark:text-dark-100/40">{formatDate(t.created_at)}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Notes / admin action log -->
          <div>
            <div class="t-micro mb-2 text-dark-900/60 dark:text-dark-100/60">โน้ตทีม + ประวัติการช่วยเหลือ</div>
            <div class="flex items-end gap-2 mb-1">
              <div class="flex-1">
                <Field label="บันทึกโน้ตถึงทีม" bind:value={noteText} placeholder="เช่น: ติดต่อทางไลน์แล้ว รอ user ยืนยันตัวตน" />
              </div>
              <Button fullWidth={false} disabled={actionBusy || !noteText.trim()} onclick={handleAddNote}>บันทึก</Button>
            </div>
            {#if detail.admin_actions.length === 0}
              <p class="t-caption">ยังไม่มีประวัติ</p>
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
</Sheet>
