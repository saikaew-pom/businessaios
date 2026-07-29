<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { listPackages, createTopupIntent, getPaymentStatus, getPaymentHistory, devMockSuccess, type CreditPackage, type CreateIntentResult, type PaymentHistoryItem } from '$lib/api';
  import { fullUser, refreshFullUser, isAuthed, user, initAuth } from '$lib/auth';

  let packages = $state<CreditPackage[]>([]);
  let signupBonus = $state(200);
  let isLoading = $state(true);
  let selectedPkg = $state<string | null>(null);
  let activeIntent = $state<CreateIntentResult | null>(null);
  let pollTimer: any = null;
  let error = $state('');
  let success = $state('');
  let isMockMode = $state(false);
  let isProcessing = $state(false);
  let history = $state<PaymentHistoryItem[]>([]);

  onMount(async () => {
    // Wait for auth to be ready (if not already)
    if (!$user) {
      await initAuth();
    }
    if (!$user) {
      goto('/login?next=/billing');
      return;
    }
    try {
      const data = await listPackages();
      packages = data.packages;
      signupBonus = data.signup_bonus;
      const hist = await getPaymentHistory();
      history = hist.payments || [];
    } catch (e: any) {
      error = e.message || 'โหลดข้อมูลไม่สำเร็จ';
    } finally {
      isLoading = false;
    }
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
  });

  async function selectPackage(pkg: CreditPackage) {
    error = '';
    success = '';
    selectedPkg = pkg.id;
    isProcessing = true;
    try {
      activeIntent = await createTopupIntent(pkg.id);
      isMockMode = activeIntent.mode === 'mock';
      if (!isMockMode) {
        startPolling();
      }
    } catch (e: any) {
      error = e.message || 'สร้าง payment ไม่สำเร็จ';
      selectedPkg = null;
    } finally {
      isProcessing = false;
    }
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (!activeIntent) return;
      try {
        const status = await getPaymentStatus(activeIntent.payment_intent_id);
        if (status.status === 'succeeded') {
          if (pollTimer) clearInterval(pollTimer);
          await refreshFullUser();
          success = `✅ เติม ${status.credits_added} credits สำเร็จ!`;
          selectedPkg = null;
          activeIntent = null;
          // Refresh history
          const hist = await getPaymentHistory();
          history = hist.payments || [];
        }
      } catch (e) {
        console.error('poll error', e);
      }
    }, 3000);
  }

  async function mockSuccess() {
    if (!selectedPkg) return;
    isProcessing = true;
    try {
      const res = await devMockSuccess(selectedPkg);
      if (res.success) {
        await refreshFullUser();
        success = `✅ Mock topup สำเร็จ! เพิ่ม ${res.credits_added} credits (ยอดใหม่: ${res.new_balance})`;
        selectedPkg = null;
        activeIntent = null;
        const hist = await getPaymentHistory();
        history = hist.payments || [];
      }
    } catch (e: any) {
      error = e.message || 'Mock success ไม่สำเร็จ';
    } finally {
      isProcessing = false;
    }
  }

  function cancelPayment() {
    if (pollTimer) clearInterval(pollTimer);
    activeIntent = null;
    selectedPkg = null;
  }

  function formatTHB(satang: number): string {
    return (satang / 100).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function statusBadge(status: string): { color: string; label: string } {
    const map: Record<string, { color: string; label: string }> = {
      pending: { color: 'bg-yellow-100 text-yellow-800', label: '⏳ รอชำระ' },
      succeeded: { color: 'bg-green-100 text-green-800', label: '✅ สำเร็จ' },
      failed: { color: 'bg-red-100 text-red-800', label: '❌ ล้มเหลว' },
      refunded: { color: 'bg-gray-100 text-gray-800', label: '↩️ คืนเงิน' },
    };
    return map[status] || { color: 'bg-gray-100 text-gray-800', label: status };
  }
</script>

<svelte:head>
  <title>เติม Credits · BusinessAiOs</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-6 py-10">
  <!-- Header -->
  <div class="mb-8">
    <a href="/dashboard" class="text-sm text-dark-900/60 hover:text-primary-600">← กลับไป Dashboard</a>
    <h1 class="text-3xl font-black mt-2 mb-1">💰 เติม Credits</h1>
    <p class="text-dark-900/60">ใช้ PromptPay QR (ธนาคารไทย) — ปลอดภัย รวดเร็ว ไม่มีค่าธรรมเนียม</p>
  </div>

  <!-- Current credits -->
  <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl p-5 mb-6 flex items-center justify-between">
    <div>
      <div class="text-xs uppercase tracking-wider opacity-80">เครดิตคงเหลือ</div>
      <div class="text-3xl font-black mt-1">⚡ {$fullUser?.credits ?? 0}</div>
    </div>
    <div class="text-right text-sm opacity-90">
      <div>Free tier = {signupBonus} credits</div>
      <div>เมื่อสมัครใหม่</div>
    </div>
  </div>

  {#if success}
    <div class="mb-6 p-4 rounded-xl bg-green-50 border-2 border-green-300 text-green-900 font-semibold flex items-center gap-2">
      <span class="text-2xl">🎉</span>
      <span>{success}</span>
      <button onclick={() => success = ''} class="ml-auto text-sm opacity-60 hover:opacity-100">✕</button>
    </div>
  {/if}

  {#if error}
    <div class="mb-6 p-4 rounded-xl bg-red-50 border-2 border-red-300 text-red-900 text-sm flex items-center gap-2">
      <span>❌ {error}</span>
      <button onclick={() => error = ''} class="ml-auto opacity-60 hover:opacity-100">✕</button>
    </div>
  {/if}

  {#if isMockMode}
    <div class="mb-6 p-4 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-900 text-sm">
      <div class="font-semibold mb-1">⚠️ Stripe ยังไม่ได้ตั้งค่า (Mock Mode)</div>
      <div>ระบบใช้ mock flow เพื่อทดสอบ — กดปุ่ม "จำลองการชำระเงินสำเร็จ" เพื่อเติม credits ทันที</div>
      <div class="text-xs mt-1 opacity-75">ตั้งค่า STRIPE_SECRET_KEY ใน wrangler เพื่อใช้ QR PromptPay จริง</div>
    </div>
  {/if}

  <!-- Active payment modal -->
  {#if activeIntent && selectedPkg}
    {@const pkg = packages.find(p => p.id === selectedPkg)!}
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
        <div class="text-center mb-4">
          <div class="text-4xl mb-2">💎</div>
          <h2 class="text-2xl font-bold">เติม {pkg.credits} Credits</h2>
          <div class="text-3xl font-black text-primary-600 mt-2">฿{formatTHB(pkg.price_satang)}</div>
        </div>

        {#if isMockMode}
          <div class="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mb-4">
            <div class="text-xs text-amber-700 font-bold uppercase mb-1">🎭 Mock PromptPay QR</div>
            <div class="font-mono text-[10px] text-amber-900 break-all">{activeIntent.next_action?.qr_data}</div>
          </div>
        {:else if activeIntent.next_action?.promptpay_display_qr_code}
          <div class="bg-white border-2 border-dark-200 rounded-xl p-4 mb-4 flex flex-col items-center">
            <div class="text-xs text-dark-700 font-bold uppercase mb-2">📱 สแกน QR ด้วยแอปธนาคาร</div>
            <img
              src={activeIntent.next_action.promptpay_display_qr_code.image_url_svg}
              alt="PromptPay QR"
              class="w-64 h-64"
            />
            <div class="text-xs text-dark-500 mt-2">PaymentIntent: {activeIntent.payment_intent_id}</div>
          </div>
        {/if}

        <div class="text-center text-xs text-dark-500 mb-4">
          {#if isMockMode}
            🧪 โหมดทดสอบ — ไม่มีการเรียกเก็บเงินจริง
          {:else}
            ⏳ รอการชำระเงิน... (ระบบจะเช็คอัตโนมัติทุก 3 วินาที)
          {/if}
        </div>

        <div class="flex gap-2">
          {#if isMockMode}
            <button onclick={mockSuccess} disabled={isProcessing} class="flex-1 px-4 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 disabled:opacity-50">
              {isProcessing ? '⏳' : '✅'} จำลองการชำระเงินสำเร็จ
            </button>
          {/if}
          <button onclick={cancelPayment} class="px-4 py-3 rounded-xl bg-dark-100 hover:bg-dark-200 font-semibold">
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if isLoading}
    <div class="text-center py-20 text-dark-900/60">กำลังโหลด...</div>
  {:else}
    <!-- Package cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      {#each packages as pkg (pkg.id)}
        <button
          onclick={() => selectPackage(pkg)}
          disabled={isProcessing}
          class="relative text-left bg-white rounded-2xl border-2 transition-all hover:shadow-xl p-6 disabled:opacity-50 {pkg.popular ? 'border-primary-500 shadow-md' : 'border-dark-200 hover:border-primary-300'}"
        >
          {#if pkg.popular}
            <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-primary-500 to-purple-600 text-white text-[10px] font-bold uppercase tracking-wider">
              ⭐ แนะนำ
            </div>
          {/if}
          {#if pkg.save_pct}
            <div class="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-bold">
              ประหยัด {pkg.save_pct}%
            </div>
          {/if}

          <div class="text-xs font-bold uppercase tracking-wider {pkg.popular ? 'text-primary-600' : 'text-dark-900/60'}">
            {pkg.tagline}
          </div>
          <h3 class="text-2xl font-black mt-1 mb-3">{pkg.name}</h3>

          <div class="mb-4">
            <div class="text-4xl font-black text-dark-900">฿{pkg.price_thb}</div>
            <div class="text-xs text-dark-900/60 mt-1">฿{pkg.per_credit_thb.toFixed(2)} / credit</div>
          </div>

          <div class="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-3 mb-3">
            <div class="text-3xl font-black text-primary-700">⚡ {pkg.credits}</div>
            <div class="text-[10px] text-dark-700 uppercase font-semibold">credits</div>
          </div>

          <div class="text-xs text-dark-700">{pkg.best_for}</div>
        </button>
      {/each}
    </div>

    <!-- How it works -->
    <div class="bg-white rounded-2xl border border-dark-200 p-6 mb-8">
      <h3 class="font-bold text-lg mb-4">📋 วิธีเติมเงิน</h3>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div class="flex gap-3">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">1</div>
          <div>
            <div class="font-semibold mb-0.5">เลือกแพ็กเกจ</div>
            <div class="text-xs text-dark-700">คลิกแพ็กเกจที่ต้องการ</div>
          </div>
        </div>
        <div class="flex gap-3">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">2</div>
          <div>
            <div class="font-semibold mb-0.5">สแกน QR PromptPay</div>
            <div class="text-xs text-dark-700">ด้วยแอปธนาคารไทยทุกแห่ง</div>
          </div>
        </div>
        <div class="flex gap-3">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">3</div>
          <div>
            <div class="font-semibold mb-0.5">Credits เข้าทันที</div>
            <div class="text-xs text-dark-700">ระบบจะเติมอัตโนมัติหลังชำระ</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Payment history -->
    {#if history.length > 0}
      <div class="bg-white rounded-2xl border border-dark-200 p-6">
        <h3 class="font-bold text-lg mb-4">📜 ประวัติการเติมเงิน</h3>
        <div class="space-y-2">
          {#each history as p}
            {@const badge = statusBadge(p.status)}
            <div class="flex items-center justify-between p-3 rounded-lg bg-dark-50 hover:bg-dark-100">
              <div>
                <div class="font-semibold text-sm">⚡ {p.credits} credits</div>
                <div class="text-xs text-dark-700">{new Date(p.created_at).toLocaleString('th-TH')}</div>
              </div>
              <div class="text-right">
                <div class="font-bold text-sm">฿{formatTHB(p.amount_satang)}</div>
                <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold {badge.color}">{badge.label}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>
