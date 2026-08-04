<script lang="ts">
  import {
    createVisualTemplate,
    deleteVisualTemplate,
    generateCompositionCopy,
    listVisualTemplates,
    renderCompositionFromTemplate,
    type MediaAsset,
    type TemplateLayout,
    type VisualTemplate,
  } from '$lib/api';
  import { fullUser } from '$lib/auth';

  const COPY_TONES = [
    { value: '', label: 'โทนอัตโนมัติ' },
    { value: 'professional', label: 'มืออาชีพ' },
    { value: 'warm', label: 'อบอุ่น เป็นกันเอง' },
    { value: 'premium', label: 'พรีเมียม หรูหรา' },
    { value: 'clean', label: 'มินิมอล สะอาดตา' },
  ];

  export let assetId: string;
  export let onClose: () => void;
  export let onApplied: (asset: MediaAsset) => void;

  const PILLARS = ['awareness', 'education', 'social_proof', 'conversion'] as const;

  let isLoading = true;
  let error = '';
  let templates: VisualTemplate[] = [];
  let selectedTemplateId = '';
  let headline = '';
  let subheadline = '';
  let badge = '';
  let isApplying = false;
  let isAdmin = false;

  let copyBrief = '';
  let copyTone = '';
  let isGeneratingCopy = false;

  let showCreateForm = false;
  let newName = '';
  let newDescription = '';
  let isSavingTemplate = false;

  $: selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || null;
  $: isAdmin = $fullUser?.role === 'admin';

  load();

  async function load() {
    isLoading = true;
    error = '';
    try {
      templates = await listVisualTemplates();
      if (templates.length && !selectedTemplateId) selectedTemplateId = templates[0].id;
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isLoading = false;
    }
  }

  async function apply() {
    if (!selectedTemplateId || isApplying || isGeneratingCopy) return;
    if (!headline.trim() && !subheadline.trim() && !badge.trim()) {
      error = 'ใส่ข้อความอย่างน้อย 1 ช่อง (headline, subheadline หรือ badge)';
      return;
    }
    isApplying = true;
    error = '';
    try {
      const result = await renderCompositionFromTemplate({
        base_asset_id: assetId,
        template_id: selectedTemplateId,
        headline: headline.trim() || undefined,
        subheadline: subheadline.trim() || undefined,
        badge: badge.trim() || undefined,
      });
      onApplied(result.asset);
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isApplying = false;
    }
  }

  async function generateCopy() {
    if (!copyBrief.trim() || isGeneratingCopy || isApplying) return;
    isGeneratingCopy = true;
    error = '';
    try {
      const result = await generateCompositionCopy({ brief: copyBrief.trim(), tone: copyTone || undefined });
      headline = result.headline;
      subheadline = result.subheadline;
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isGeneratingCopy = false;
    }
  }

  async function removeTemplate(t: VisualTemplate, e: Event) {
    e.stopPropagation();
    if (!confirm(`ลบ template "${t.name}"?`)) return;
    try {
      await deleteVisualTemplate(t.id);
      if (selectedTemplateId === t.id) selectedTemplateId = '';
      await load();
    } catch (err) {
      error = humanizeError(err);
    }
  }

  function canEditTemplate(t: VisualTemplate): boolean {
    return t.owner_type === 'admin' ? isAdmin : true;
  }

  function buildDefaultLayout(): TemplateLayout {
    return {
      canvas: { width: 1080, height: 1080 },
      background: { overlay_gradient: { direction: '180deg', stops: [{ offset: '45%', color: 'rgba(0,0,0,0)' }, { offset: '100%', color: 'rgba(0,0,0,0.82)' }] } },
      blocks: [
        { type: 'headline', anchor: 'bottom-left', font_size: 58, font_weight: 700, color: '#ffffff', max_width_pct: 88 },
        { type: 'subheadline', anchor: 'bottom-left', font_size: 26, font_weight: 400, color: '#e2e8f0', max_width_pct: 88 },
      ],
    };
  }

  async function saveNewTemplate(e: Event) {
    e.preventDefault();
    if (!newName.trim() || isSavingTemplate) return;
    isSavingTemplate = true;
    error = '';
    try {
      await createVisualTemplate({ name: newName.trim(), description: newDescription.trim(), layout: buildDefaultLayout() });
      newName = '';
      newDescription = '';
      showCreateForm = false;
      await load();
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isSavingTemplate = false;
    }
  }

  // Lightweight CSS approximation of the real satori-rendered layout, just
  // for the picker thumbnail — not pixel-accurate, just enough to tell the
  // 9-anchor grid + background treatment apart at a glance.
  const ANCHOR_CLASS: Record<string, string> = {
    'top-left': 'items-start justify-start text-left',
    'top-center': 'items-start justify-center text-center',
    'top-right': 'items-start justify-end text-right',
    'center-left': 'items-center justify-start text-left',
    center: 'items-center justify-center text-center',
    'center-right': 'items-center justify-end text-right',
    'bottom-left': 'items-end justify-start text-left',
    'bottom-center': 'items-end justify-center text-center',
    'bottom-right': 'items-end justify-end text-right',
  };

  function previewBackgroundStyle(layout: TemplateLayout): string {
    if (layout.background?.side_bar) {
      const pct = layout.background.side_bar.width_pct;
      return `background: linear-gradient(90deg, ${layout.background.side_bar.color} ${pct}%, #d97757 ${pct}%);`;
    }
    if (layout.background?.overlay_gradient) {
      const { direction, stops } = layout.background.overlay_gradient;
      const stopStr = stops.map((s) => `${s.color} ${s.offset}`).join(', ');
      return `background: linear-gradient(${direction}, ${stopStr}), #d97757;`;
    }
    return 'background: #d97757;';
  }

  function humanizeError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err || '');
    const map: Record<string, string> = {
      feature_disabled: 'Brand Kit Composition ยังไม่เปิดใช้งานบน environment นี้',
      asset_not_found: 'ไม่พบภาพต้นฉบับ',
      template_not_found: 'ไม่พบ template ที่เลือก',
      storage_quota_exceeded: 'พื้นที่จัดเก็บเต็มแล้ว',
      forbidden: 'ไม่มีสิทธิ์ทำรายการนี้',
      name_required: 'กรุณาใส่ชื่อ template',
      render_failed: 'สร้างภาพไม่สำเร็จ',
    };
    return map[message] || message || 'ทำรายการไม่สำเร็จ';
  }
</script>

<div
  role="button"
  tabindex="-1"
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
  onclick={onClose}
  onkeydown={(e) => e.key === 'Escape' && onClose()}
>
  <div
    role="dialog"
    aria-modal="true"
    aria-label="เลือก Visual Template"
    tabindex="-1"
    class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-dark-100 bg-white p-5 dark:border-dark-700 dark:bg-dark-800"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === 'Escape' && onClose()}
  >
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-bold text-dark-900 dark:text-dark-50">เลือก Visual Template</h2>
      <button onclick={onClose} class="btn-secondary py-1.5 px-3 text-sm">ปิด</button>
    </div>

    {#if error}
      <div class="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>
    {/if}

    {#if isLoading}
      <div class="py-10 text-center text-sm text-dark-900/60 dark:text-dark-100/60">กำลังโหลด...</div>
    {:else}
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {#each templates as t}
          <div
            role="button"
            tabindex="0"
            onclick={() => (selectedTemplateId = t.id)}
            onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (selectedTemplateId = t.id)}
            class="relative overflow-hidden rounded-lg border-2 text-left transition {selectedTemplateId === t.id ? 'border-primary-500' : 'border-dark-100 dark:border-dark-700'}"
          >
            <div class="flex aspect-square w-full flex-col p-3" style={previewBackgroundStyle(t.layout)}>
              {#each t.layout.blocks as block}
                <div class="flex flex-1 {ANCHOR_CLASS[block.anchor] || 'items-end justify-start text-left'}">
                  <span
                    class="text-[9px] font-bold leading-tight"
                    style="color: {block.color}; {block.background_color ? `background:${block.background_color}; padding:2px 6px; border-radius:999px;` : ''} {block.card_background ? `background:${block.card_background}; padding:4px 8px; border-radius:6px; color:#0f172a;` : ''}"
                  >
                    {block.type === 'headline' ? 'Headline' : block.type === 'subheadline' ? 'Subheadline' : 'Badge'}
                  </span>
                </div>
              {/each}
            </div>
            <div class="flex items-center justify-between gap-1 bg-dark-50 px-2 py-1.5 dark:bg-dark-900">
              <span class="truncate text-xs font-semibold text-dark-900 dark:text-dark-50">
                {t.owner_type === 'admin' ? '🌐 ' : ''}{t.name}
              </span>
              {#if canEditTemplate(t)}
                <button onclick={(e) => removeTemplate(t, e)} class="shrink-0 text-[10px] text-red-600 dark:text-red-300">ลบ</button>
              {/if}
            </div>
          </div>
        {/each}
        <button
          onclick={() => (showCreateForm = !showCreateForm)}
          class="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-dark-200 text-sm text-dark-900/50 hover:border-primary-300 dark:border-dark-700 dark:text-dark-100/50"
        >
          <span class="text-2xl">+</span>
          <span>Template ใหม่</span>
        </button>
      </div>

      {#if showCreateForm}
        <form onsubmit={saveNewTemplate} class="mt-4 space-y-2 rounded-lg border border-dark-100 p-3 dark:border-dark-700">
          <input bind:value={newName} class="input w-full" placeholder="ชื่อ template" />
          <input bind:value={newDescription} class="input w-full" placeholder="คำอธิบายสั้น ๆ (ไม่บังคับ)" />
          <p class="text-xs text-dark-900/50 dark:text-dark-100/50">สร้างจาก layout เริ่มต้น (bottom gradient) — แก้ไข field รายละเอียดเพิ่มเติมได้ทีหลัง</p>
          <button type="submit" disabled={isSavingTemplate || !newName.trim()} class="btn-primary py-1.5 px-3 text-sm">
            {isSavingTemplate ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </form>
      {/if}

      {#if selectedTemplate}
        <div class="mt-5 space-y-3 border-t border-dark-100 pt-4 dark:border-dark-700">
          <div class="space-y-2 rounded-lg border border-dark-100 p-3 dark:border-dark-700">
            <label class="block text-xs font-semibold text-dark-900/70 dark:text-dark-100/70" for="copy-brief">✨ ให้ AI เขียน Headline/Subheadline ให้</label>
            <input id="copy-brief" bind:value={copyBrief} class="input w-full" placeholder="บรีฟสั้น ๆ เช่น โปรโมชั่นเปิดร้านกาแฟ ลด 20% เดือนแรก" />
            <div class="flex flex-wrap gap-2">
              <select bind:value={copyTone} class="input min-w-[140px] flex-1">
                {#each COPY_TONES as t}
                  <option value={t.value}>{t.label}</option>
                {/each}
              </select>
              <button type="button" onclick={generateCopy} disabled={!copyBrief.trim() || isGeneratingCopy || isApplying} class="btn-secondary whitespace-nowrap">
                {isGeneratingCopy ? 'กำลังเขียน...' : '✨ Generate'}
              </button>
            </div>
          </div>
          <textarea bind:value={headline} rows="2" class="input w-full" placeholder="Headline"></textarea>
          <textarea bind:value={subheadline} rows="2" class="input w-full" placeholder="Subheadline (ไม่บังคับ)"></textarea>
          {#if selectedTemplate.layout.blocks.some((b) => b.type === 'badge')}
            <input bind:value={badge} class="input w-full" placeholder="Badge (ไม่บังคับ)" />
          {/if}
          <button onclick={apply} disabled={isApplying || isGeneratingCopy} class="btn-primary w-full">
            {isApplying ? 'กำลังสร้าง...' : 'สร้าง Composed Creative'}
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>
