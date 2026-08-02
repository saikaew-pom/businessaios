<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import {
    archiveBrandKit,
    createBrandKit,
    deleteBrandKit,
    listBrandKits,
    restoreBrandKit,
    setDefaultBrandKit,
    type BrandKit
  } from '$lib/api';
  import { initAuth, isAuthed } from '$lib/auth';
  import { fetchConfig } from '$lib/config';

  let isLoading = true;
  let isFeatureEnabled = false;
  let kits: BrandKit[] = [];
  let error = '';
  let notice = '';
  let name = '';
  let primaryColor = '#2563eb';
  let accentColor = '#f59e0b';
  let headingFont = 'Prompt';
  let bodyFont = 'Inter';
  let defaultLanguage = 'th';
  let statusFilter: 'active' | 'archived' = 'active';
  let isSaving = false;

  onMount(async () => {
    await initAuth();
    if (!$isAuthed) {
      goto('/login');
      return;
    }
    try {
      const config = await fetchConfig();
      isFeatureEnabled = Boolean(config.features.brand_composition);
      if (!isFeatureEnabled) return;
      await loadKits();
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isLoading = false;
    }
  });

  async function loadKits() {
    kits = await listBrandKits(statusFilter);
  }

  async function createKit(e: Event) {
    e.preventDefault();
    if (!name.trim() || isSaving) return;
    isSaving = true;
    error = '';
    try {
      const created = await createBrandKit({
        name: name.trim(),
        colors: [
          { role: 'primary', value: primaryColor },
          { role: 'accent', value: accentColor },
        ],
        typography: { heading: headingFont.trim(), body: bodyFont.trim() },
        rules: {
          safe_area: 'keep text inside platform safe zones',
          logo_usage: 'use only confirmed logo assets',
          brandbook: createEmptyBrandbook(name.trim(), defaultLanguage, headingFont.trim(), bodyFont.trim(), primaryColor, accentColor),
        },
        is_default: kits.length === 0,
        default_language: defaultLanguage,
        brandbook_status: 'draft',
      });
      name = '';
      notice = 'สร้าง Brand Kit แล้ว กำลังเปิด Brandbook Builder';
      await goto(`/studio/brand-kits/${created.id}`);
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isSaving = false;
    }
  }

  async function makeDefault(kit: BrandKit) {
    error = '';
    try {
      await setDefaultBrandKit(kit.id);
      notice = 'ตั้งเป็นค่าเริ่มต้นแล้ว';
      await loadKits();
    } catch (err) {
      error = humanizeError(err);
    }
  }

  async function switchStatus(next: 'active' | 'archived') {
    statusFilter = next;
    await loadKits();
  }

  async function archiveKit(kit: BrandKit) {
    if (!confirm(`Archive Brand Kit "${kit.name}"?`)) return;
    error = '';
    try {
      await archiveBrandKit(kit.id);
      notice = 'Archive Brand Kit แล้ว';
      await loadKits();
    } catch (err) {
      error = humanizeError(err);
    }
  }

  async function restoreKit(kit: BrandKit) {
    error = '';
    try {
      await restoreBrandKit(kit.id);
      notice = 'Restore Brand Kit แล้ว';
      await loadKits();
    } catch (err) {
      error = humanizeError(err);
    }
  }

  async function deleteKitForever(kit: BrandKit) {
    if (!confirm(`Delete forever "${kit.name}"? การลบนี้ย้อนกลับไม่ได้`)) return;
    error = '';
    try {
      await deleteBrandKit(kit.id);
      notice = 'ลบ Brand Kit ถาวรแล้ว';
      await loadKits();
    } catch (err) {
      error = humanizeError(err);
    }
  }

  function createEmptyBrandbook(brandName: string, language: string, heading: string, body: string, primary: string, accent: string) {
    return {
      schema_version: 1,
      language: {
        default: language,
        supported: language === 'th-en' ? ['th', 'en'] : [language],
        pdf_export_default: language,
        bilingual_primary: 'th',
      },
      identity: {
        brand_name: { th: brandName, en: '' },
        business_description: { th: '', en: '' },
        positioning: { th: '', en: '' },
        value_proposition: { th: '', en: '' },
        audience_summary: { th: '', en: '' },
        tagline: { th: '', en: '' },
        personality: [],
      },
      colors: [
        { role: 'primary', name: 'Primary', hex: primary, usage: 'สีหลักของแบรนด์' },
        { role: 'accent', name: 'Accent', hex: accent, usage: 'สีเน้นสำหรับ CTA หรือ highlight' },
      ],
      typography: {
        main: { family: heading, source: 'system_or_google' },
        heading: { family: heading, source: 'system_or_google' },
        body: { family: body, source: 'system_or_google' },
        accent: { family: heading, source: 'system_or_google' },
        fallback_stack: ['system-ui', 'sans-serif'],
      },
      tone_of_voice: {
        summary: { th: '', en: '' },
        use_words: { th: [], en: [] },
        avoid_words: { th: [], en: [] },
        cta_style: { th: '', en: '' },
        sample_captions: { th: [], en: [] },
      },
      creative_style: {
        visual_mood: [],
        lighting: '',
        composition: '',
        people_style: '',
        product_style: '',
        background_style: '',
        graphic_elements: [],
        avoid: [],
      },
      layouts: {
        selected_templates: [],
        placeholder_rules: {},
        platform_rules: {},
        localized_placeholders: { th: {}, en: {} },
      },
      assets: {
        logo_asset_ids: [],
        product_asset_ids: [],
        people_asset_ids: [],
        style_reference_asset_ids: [],
        font_asset_ids: [],
      },
      compliance: {
        allowed_claims: [],
        restricted_claims: [],
        disclaimer: '',
        license_notes: [],
      },
      ai_prompt_guide: {
        default_prompt_style: { th: '', en: '' },
        negative_prompt: { th: '', en: '' },
        reference_rules: [],
        platform_snippets: {},
      },
      sources: [],
      review: { status: 'draft', reviewed_at: null },
    };
  }

  function languageLabel(value: string) {
    return ({ th: 'ไทย', en: 'English', 'th-en': 'ไทย + English' } as Record<string, string>)[value] || value;
  }

  function humanizeError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err || '');
    const map: Record<string, string> = {
      feature_disabled: 'Brand Kit Composition ยังไม่เปิดใช้งานบน environment นี้',
      name_required: 'กรุณาใส่ชื่อ Brand Kit',
      brand_kit_not_active: 'Brand Kit นี้ถูก archive อยู่ ต้อง restore ก่อนตั้งเป็น default',
    };
    return map[message] || message || 'ทำรายการไม่สำเร็จ';
  }
</script>

<svelte:head>
  <title>Brand Kits — Business Smart OS</title>
</svelte:head>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950">
  <main class="container-narrow py-6 space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div class="text-sm text-primary-600 dark:text-primary-400 font-semibold">Creative Studio</div>
        <h1 class="heading-2">Brand Kits</h1>
        <p class="text-dark-900/60 dark:text-dark-100/60">เก็บสี ฟอนต์ และกฎแบรนด์สำหรับใช้กับ composition/creative ต่อไป</p>
      </div>
      <a href="/studio" class="btn-secondary">กลับ Studio</a>
    </div>

    {#if error}
      <div class="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>
    {/if}
    {#if notice}
      <div class="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 p-3 text-sm text-green-700 dark:text-green-300">{notice}</div>
    {/if}

    {#if isLoading}
      <div class="py-16 text-center text-dark-900/60 dark:text-dark-100/60">กำลังโหลด...</div>
    {:else if !isFeatureEnabled}
      <div class="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-5">
        <div class="font-semibold text-amber-900 dark:text-amber-200">Brand Kit ยังปิดอยู่</div>
        <div class="text-sm text-amber-800 dark:text-amber-300 mt-1">เปิด `BRAND_COMPOSITION_ENABLED=true` หลัง apply migration Phase 9 แล้วจึงเริ่มใช้งานได้</div>
      </div>
    {:else}
      <form onsubmit={createKit} class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4 space-y-4">
        <div>
          <h2 class="font-bold text-dark-900 dark:text-dark-50">สร้าง Brandbook</h2>
          <p class="mt-1 text-sm text-dark-900/60 dark:text-dark-100/60">สร้างแล้วระบบจะพาเข้า Brandbook Builder เพื่ออัปโหลด logo/font, เติมรายละเอียด และ export PDF</p>
        </div>
        <div class="grid md:grid-cols-2 gap-3">
          <input bind:value={name} class="input" placeholder="ชื่อ Brand Kit" />
          <select bind:value={defaultLanguage} class="input">
            <option value="th">Brandbook ภาษาไทย</option>
            <option value="en">Brandbook English</option>
            <option value="th-en">Brandbook ไทย + English</option>
          </select>
          <div class="grid grid-cols-2 gap-3 md:col-span-2">
            <input bind:value={headingFont} class="input" placeholder="Heading font" />
            <input bind:value={bodyFont} class="input" placeholder="Body font" />
          </div>
          <label class="flex items-center gap-3 rounded-lg border border-dark-100 dark:border-dark-700 p-3">
            <input type="color" bind:value={primaryColor} class="h-9 w-12" />
            <span class="text-sm font-semibold">Primary {primaryColor}</span>
          </label>
          <label class="flex items-center gap-3 rounded-lg border border-dark-100 dark:border-dark-700 p-3">
            <input type="color" bind:value={accentColor} class="h-9 w-12" />
            <span class="text-sm font-semibold">Accent {accentColor}</span>
          </label>
        </div>
        <button type="submit" disabled={isSaving} class="btn-primary">{isSaving ? 'กำลังเปิด Builder...' : 'Create & Open Builder'}</button>
      </form>

      <div class="flex flex-wrap items-center gap-2">
        <button onclick={() => switchStatus('active')} class={statusFilter === 'active' ? 'btn-primary py-2 text-sm' : 'btn-secondary py-2 text-sm'}>Active</button>
        <button onclick={() => switchStatus('archived')} class={statusFilter === 'archived' ? 'btn-primary py-2 text-sm' : 'btn-secondary py-2 text-sm'}>Archived</button>
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        {#each kits as kit}
          <article class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="text-lg font-bold text-dark-900 dark:text-dark-50">{kit.name}</h2>
                <p class="text-sm text-dark-900/60 dark:text-dark-100/60">
                  {kit.asset_count || 0} assets · {kit.is_default ? 'Default' : 'Custom'} · {languageLabel(kit.default_language)} · {kit.brandbook_status || 'draft'}
                </p>
              </div>
              <a href={`/studio/brand-kits/${kit.id}`} class="btn-secondary">Open Builder</a>
            </div>
            <p class="mt-3 text-sm text-dark-900/60 dark:text-dark-100/60">
              เปิด Builder เพื่ออัปโหลด logo/font, ผูก asset, แก้ Brandbook และ export PDF
            </p>
            <div class="mt-4 flex gap-2">
              {#each kit.colors || [] as color}
                <div class="h-10 w-16 rounded-lg border border-dark-100 dark:border-dark-700" style={`background: ${color.value}`}></div>
              {/each}
            </div>
            <div class="mt-3 text-sm text-dark-900/60 dark:text-dark-100/60">
              Heading: {kit.typography?.heading || '-'} · Body: {kit.typography?.body || '-'}
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              {#if statusFilter === 'active'}
                {#if !kit.is_default}
                  <button onclick={() => makeDefault(kit)} class="btn-secondary py-2 text-sm">Set Default</button>
                {/if}
                <button onclick={() => archiveKit(kit)} class="btn-secondary py-2 text-sm">Archive</button>
              {:else}
                <button onclick={() => restoreKit(kit)} class="btn-secondary py-2 text-sm">Restore</button>
              {/if}
              <button onclick={() => deleteKitForever(kit)} class="btn-secondary py-2 text-sm text-red-600 dark:text-red-300">Delete forever</button>
            </div>
          </article>
        {:else}
          <div class="rounded-xl border border-dashed border-dark-200 p-8 text-center text-sm text-dark-900/50 dark:border-dark-700 dark:text-dark-100/50 md:col-span-2">
            ยังไม่มี Brand Kit ในหมวดนี้
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>
