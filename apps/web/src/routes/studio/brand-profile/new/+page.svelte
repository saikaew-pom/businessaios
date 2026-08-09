<script lang="ts">
  /**
   * Content Playbook Upgrade Plan ขั้นที่ 1 — Brand Bootstrap
   * (docs/CONTENT_PLAYBOOK_UPGRADE_PLAN.md §6). First-ever UI for creating a
   * brand profile — built with the Stage A component canon ($lib/ui) rather
   * than the older ToolLayout hero-gradient pattern, since this is new
   * screen, not a reskin of an existing one.
   *
   * Two entry paths converge on the same review-and-confirm card (user
   * journey step B: "ปรับ/ยืนยันเป็นการ์ด") — nothing is saved until the
   * user confirms; both bootstrap endpoints only ever return a draft.
   */
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { isAuthed } from '$lib/auth';
  import {
    listProjects,
    bootstrapBrandFromProject,
    bootstrapBrandFromAnswers,
    createBrandProfile,
    type Project,
    type BrandProfileDraft,
  } from '$lib/api';
  import { Card, Button, Field, TapCard, showToast } from '$lib/ui';

  onMount(async () => {
    const { initAuth } = await import('$lib/auth');
    await initAuth();
    if (!$isAuthed) { goto('/login'); return; }
    projects = await listProjects().catch(() => []);
  });

  type Phase = 'choose' | 'from-project' | 'from-answers' | 'review';
  let phase = $state<Phase>('choose');
  let projects = $state<Project[]>([]);
  let selectedProjectId = $state('');
  let loading = $state(false);
  let error = $state('');

  let qBusiness = $state('');
  let qCustomer = $state('');
  let qComplaint = $state('');

  // Flattened, editable fields for the review card — arrays become
  // comma/newline text so a plain <textarea>-backed Field can edit them.
  let profileName = $state('');
  let businessSummary = $state('');
  let toneText = $state('');
  let audienceText = $state('');
  let offersText = $state('');
  let voiceSamplesText = $state('');
  // Content Playbook ขั้นที่ 4 — คำลงท้ายประโยคระดับแบรนด์ (นะคะ/ครับ), ฉีด
  // เข้าทุก prompt ที่ generate content ให้แบรนด์นี้ (brandContext.ts's
  // formatBrandContextBlock). '' = ไม่ใช้คำลงท้าย (ค่าเริ่มต้น, พฤติกรรมเดิม).
  const VOICE_PARTICLE_OPTIONS = [
    { value: '', label: 'ไม่ใช้คำลงท้าย' },
    { value: 'ครับ', label: 'ครับ' },
    { value: 'ค่ะ', label: 'ค่ะ / คะ' },
  ];
  let voiceParticle = $state('');
  let personaName = $state('');
  let personaAge = $state('');
  let personaJob = $state('');
  let personaDailyLife = $state('');
  let complaint1 = $state('');
  let complaint2 = $state('');
  let complaint3 = $state('');

  const complaintsFilled = $derived([complaint1, complaint2, complaint3].filter((c) => c.trim()).length);

  function loadDraftIntoForm(d: BrandProfileDraft) {
    profileName = d.name;
    businessSummary = d.business_summary;
    toneText = (d.tone_of_voice || []).join(', ');
    audienceText = (d.audience || []).join(', ');
    offersText = (d.offers || []).join(', ');
    voiceSamplesText = (d.voice_samples || []).join('\n');
    voiceParticle = d.voice_particle || '';
    personaName = d.persona?.name || '';
    personaAge = d.persona?.age || '';
    personaJob = d.persona?.job || '';
    personaDailyLife = d.persona?.daily_life || '';
    complaint1 = d.persona?.complaints?.[0] || '';
    complaint2 = d.persona?.complaints?.[1] || '';
    complaint3 = d.persona?.complaints?.[2] || '';
    phase = 'review';
  }

  async function startFromProject() {
    if (!selectedProjectId || loading) return;
    loading = true; error = '';
    try {
      const { draft } = await bootstrapBrandFromProject(selectedProjectId);
      loadDraftIntoForm(draft);
    } catch (err) {
      error = humanizeError(err);
    } finally {
      loading = false;
    }
  }

  async function startFromAnswers() {
    if (!qBusiness.trim() || !qCustomer.trim() || !qComplaint.trim() || loading) return;
    loading = true; error = '';
    try {
      const { draft } = await bootstrapBrandFromAnswers({
        business: qBusiness.trim(), customer: qCustomer.trim(), complaint: qComplaint.trim(),
      });
      loadDraftIntoForm(draft);
    } catch (err) {
      error = humanizeError(err);
    } finally {
      loading = false;
    }
  }

  async function confirmSave() {
    if (complaintsFilled !== 3 || loading) return;
    loading = true; error = '';
    try {
      await createBrandProfile({
        name: profileName.trim() || 'แบรนด์ของฉัน',
        business_summary: businessSummary.trim(),
        tone_of_voice: toneText.split(',').map((s) => s.trim()).filter(Boolean),
        audience: audienceText.split(',').map((s) => s.trim()).filter(Boolean),
        offers: offersText.split(',').map((s) => s.trim()).filter(Boolean),
        content_pillars: [],
        rules: {},
        voice_samples: voiceSamplesText.split('\n').map((s) => s.trim()).filter(Boolean),
        voice_particle: voiceParticle || null,
        persona: {
          name: personaName.trim() || 'ลูกค้าตัวแทน',
          age: personaAge.trim(),
          job: personaJob.trim(),
          daily_life: personaDailyLife.trim(),
          complaints: [complaint1.trim(), complaint2.trim(), complaint3.trim()],
        },
        is_default: true,
      });
      showToast('บันทึก Brand Profile แล้ว — ใช้กับ content ทุกชิ้นได้เลย');
      goto('/studio/series');
    } catch (err) {
      error = humanizeError(err);
    } finally {
      loading = false;
    }
  }

  function humanizeError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err || '');
    const map: Record<string, string> = {
      feature_disabled: 'ฟีเจอร์นี้ยังไม่เปิดใช้งานบน environment นี้',
      project_id_required: 'กรุณาเลือกแผน',
      not_found: 'ไม่พบแผนที่เลือก',
      answers_required: 'กรุณาตอบให้ครบทั้ง 3 ข้อ',
      insufficient_credits: 'เครดิตไม่เพียงพอ กรุณาเติมเครดิต',
      email_not_verified: 'กรุณายืนยันอีเมลก่อน',
      invalid_brand_profile: 'ข้อมูลไม่ครบ กรุณาตรวจสอบอีกครั้ง',
    };
    if (map[message]) return map[message];
    return message || 'ทำรายการไม่สำเร็จ';
  }
</script>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950 pb-24">
  <main class="container-narrow py-8 max-w-2xl">
    <a href="/studio/series" class="inline-flex items-center gap-1 text-sm text-dark-600 dark:text-dark-300 hover:text-dark-900 dark:hover:text-dark-50 mb-4">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
      กลับ
    </a>
    <h1 class="t-title mb-1">สร้าง Brand Profile</h1>
    <p class="t-body text-dark-600 dark:text-dark-300 mb-6">
      ตอบครั้งเดียว ใช้ได้กับ content ทุกชิ้นต่อจากนี้ — ไม่ต้องพิมพ์บอกทุกครั้งว่าแบรนด์คุณเป็นใคร
    </p>

    {#if error}
      <div class="mb-4 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-4 py-3 t-caption">{error}</div>
    {/if}

    {#if phase === 'choose'}
      <div class="space-y-3">
        <TapCard
          emoji="📋"
          title="มีแผนอยู่แล้ว"
          subtitle="ให้ระบบอ่านจากแผนที่คุณทำไว้ ไม่ต้องตอบอะไรเพิ่ม"
          disabled={!projects.length}
          onclick={() => (phase = 'from-project')}
        />
        {#if !projects.length}
          <p class="t-caption text-dark-500 dark:text-dark-400 pl-1">— ยังไม่มีแผนที่ทำไว้</p>
        {/if}
        <TapCard
          emoji="💬"
          title="ยังไม่มีแผน"
          subtitle="ตอบ 3 คำถามสั้น ๆ ให้ระบบร่างให้"
          onclick={() => (phase = 'from-answers')}
        />
      </div>
    {/if}

    {#if phase === 'from-project'}
      <Card>
        <div class="t-heading mb-3">เลือกแผนที่จะใช้</div>
        <div class="space-y-2 mb-4">
          {#each projects as p}
            <TapCard title={p.name} selected={selectedProjectId === p.id} onclick={() => (selectedProjectId = p.id)} />
          {/each}
        </div>
        <div class="flex gap-2">
          <Button variant="ghost" fullWidth={false} onclick={() => (phase = 'choose')}>ย้อนกลับ</Button>
          <div class="flex-1">
            <Button disabled={!selectedProjectId || loading} onclick={startFromProject}>
              {loading ? 'กำลังอ่านแผน...' : 'ร่างให้เลย'}
            </Button>
          </div>
        </div>
      </Card>
    {/if}

    {#if phase === 'from-answers'}
      <Card>
        <Field label="ร้าน/ธุรกิจของคุณชื่ออะไร ขายอะไร" bind:value={qBusiness} placeholder="เช่น ร้านแกงถุงป้าน้อย ขายแกงถุงส่งเดลิเวอรี่" multiline rows={2} />
        <Field label="ลูกค้าหลักของคุณคือใคร" bind:value={qCustomer} placeholder="เช่น พนักงานออฟฟิศแถวนี้ที่ไม่มีเวลาทำอาหาร" multiline rows={2} />
        <Field label="ลูกค้าบ่นอะไรบ่อยที่สุด ก่อนมาเจอร้านคุณ" bind:value={qComplaint} placeholder="เช่น หาของกินสายที่เปิดดึกไม่ได้" multiline rows={2} />
        <p class="t-caption text-dark-500 dark:text-dark-400 mb-4">ใช้เครดิตประมาณ 10-20 เครดิต ต่อการร่าง 1 ครั้ง</p>
        <div class="flex gap-2">
          <Button variant="ghost" fullWidth={false} onclick={() => (phase = 'choose')}>ย้อนกลับ</Button>
          <div class="flex-1">
            <Button disabled={!qBusiness.trim() || !qCustomer.trim() || !qComplaint.trim() || loading} onclick={startFromAnswers}>
              {loading ? 'กำลังร่าง...' : 'ร่างให้เลย'}
            </Button>
          </div>
        </div>
      </Card>
    {/if}

    {#if phase === 'review'}
      <Card>
        <div class="t-heading mb-1">ตรวจสอบก่อนบันทึก</div>
        <p class="t-caption text-dark-500 dark:text-dark-400 mb-4">แก้ตรงไหนก็ได้ก่อนกดยืนยัน</p>

        <Field label="ชื่อแบรนด์" bind:value={profileName} />
        <Field label="สรุปธุรกิจ" bind:value={businessSummary} multiline rows={2} />
        <Field label="โทนเสียงแบรนด์ (คั่นด้วยจุลภาค)" bind:value={toneText} placeholder="อบอุ่น, จริงใจ" />
        <label class="mb-3.5 block">
          <span class="t-micro mb-1.5 block text-dark-600 dark:text-dark-300">คำลงท้ายประโยค</span>
          <div class="flex flex-wrap gap-2">
            {#each VOICE_PARTICLE_OPTIONS as opt}
              <button
                type="button"
                onclick={() => (voiceParticle = opt.value)}
                class="rounded-full px-3 py-1.5 text-sm font-semibold {voiceParticle === opt.value ? 'bg-primary-600 text-white' : 'bg-dark-50 text-dark-900/70 hover:bg-dark-100 dark:bg-dark-900 dark:text-dark-100/70'}"
              >
                {opt.label}
              </button>
            {/each}
          </div>
        </label>
        <Field label="กลุ่มเป้าหมาย (คั่นด้วยจุลภาค)" bind:value={audienceText} />
        <Field label="จุดขาย/ข้อเสนอ (คั่นด้วยจุลภาค)" bind:value={offersText} />

        <div class="t-heading mt-6 mb-1">ลูกค้าตัวแทน 1 คน</div>
        <p class="t-caption text-dark-500 dark:text-dark-400 mb-3">ใช้เป็นหลักยึดเวลาเขียน content ทุกชิ้น</p>
        <div class="grid grid-cols-2 gap-x-3">
          <Field label="ชื่อ" bind:value={personaName} />
          <Field label="อายุ" bind:value={personaAge} />
        </div>
        <Field label="อาชีพ" bind:value={personaJob} />
        <Field label="ชีวิตประจำวันโดยย่อ" bind:value={personaDailyLife} multiline rows={2} />

        <div class="t-caption text-dark-600 dark:text-dark-300 mb-1">คำบ่นที่พบบ่อย (ต้องครบ 3 ข้อ — ตอนนี้ {complaintsFilled}/3)</div>
        <Field label="คำบ่นข้อ 1" bind:value={complaint1} />
        <Field label="คำบ่นข้อ 2" bind:value={complaint2} />
        <Field label="คำบ่นข้อ 3" bind:value={complaint3} />

        <Field label="ตัวอย่างโพสต์เก่าที่เคยเวิร์ก (ไม่บังคับ — 1 บรรทัดต่อ 1 ตัวอย่าง)" bind:value={voiceSamplesText} multiline rows={3} />

        <div class="flex gap-2 mt-2">
          <Button variant="ghost" fullWidth={false} onclick={() => (phase = 'choose')}>เริ่มใหม่</Button>
          <div class="flex-1">
            <Button disabled={complaintsFilled !== 3 || loading} onclick={confirmSave}>
              {loading ? 'กำลังบันทึก...' : 'ยืนยันและบันทึก'}
            </Button>
          </div>
        </div>
      </Card>
    {/if}
  </main>
</div>
