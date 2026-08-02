<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import {
    attachBrandKitAsset,
    archiveBrandKit,
    deleteBrandKit,
    detachBrandKitAsset,
    exportBrandKitPdf,
    generateBrandKitSmartWriting,
    getBrandKit,
    restoreBrandKit,
    setDefaultBrandKit,
    updateBrandKit,
    uploadMediaAssetWithMetadata,
    type BrandKit,
    type BrandKitAsset,
  } from '$lib/api';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { initAuth, isAuthed } from '$lib/auth';
  import { fetchConfig } from '$lib/config';
  import ColorInput from './ColorInput.svelte';
  import ListField from './ListField.svelte';
  import TextField from './TextField.svelte';

  type LocalizedText = { th: string; en: string };
  type CopySample = {
    id: string;
    channel: string;
    title: string;
    body: LocalizedText;
    cta: LocalizedText;
  };
  type VisualSample = {
    id: string;
    format: string;
    ratio: string;
    concept: LocalizedText;
    prompt: LocalizedText;
    logo_placement: string;
  };

  const templatePresets = [
    { id: 'quote_card', name: 'Quote Card', ratio: '1:1', placeholders: 'headline, author, logo' },
    { id: 'personal_brand_cover', name: 'Personal Brand Cover', ratio: '16:9', placeholders: 'headline, name, title, portrait, logo' },
    { id: 'course_launch_poster', name: 'Course Launch Poster', ratio: '4:5', placeholders: 'course_name, price, date, speaker, cta' },
    { id: 'webinar_banner', name: 'Webinar Banner', ratio: '16:9', placeholders: 'headline, date, time, speaker, cta' },
    { id: 'podcast_cover', name: 'Podcast Cover', ratio: '1:1', placeholders: 'show_name, episode_title, host, logo' },
    { id: 'carousel_cover', name: 'Carousel Cover', ratio: '1:1', placeholders: 'headline, list_count, swipe_hint, logo' },
    { id: 'article_cover', name: 'Article Cover', ratio: '16:9', placeholders: 'headline, category, author, logo' },
    { id: 'line_oa_broadcast', name: 'LINE OA Broadcast', ratio: '1:1', placeholders: 'headline, tip, cta, logo' },
  ];

  const logoPlacementOptions = [
    { value: 'bottom_right', label: 'มุมล่างขวา' },
    { value: 'bottom_center', label: 'ด้านล่างตรงกลาง' },
    { value: 'center', label: 'ตรงกลาง' },
    { value: 'top_right', label: 'มุมบนขวา' },
    { value: 'top_left', label: 'มุมบนซ้าย' },
    { value: 'bottom_left', label: 'มุมล่างซ้าย' },
  ];

  let kitId = $derived($page.params.id || '');
  let isLoading = $state(true);
  let isFeatureEnabled = $state(false);
  let isSaving = $state(false);
  let isUploadingAsset = $state(false);
  let isExporting = $state(false);
  let isSmartWriting = $state(false);
  let kit = $state<BrandKit | null>(null);
  let assets = $state<BrandKitAsset[]>([]);
  let error = $state('');
  let notice = $state('');
  let exportLanguage = $state('th');
  let uploadName = $state('');
  let uploadTags = $state('brandbook');
  let uploadLicenseConfirmed = $state(true);
  let uploadLicenseNote = $state('');
  let pendingUploadFile = $state<File | null>(null);
  let pendingUploadRole = $state<'logo_primary' | 'font' | null>(null);

  let name = $state('');
  let defaultLanguage = $state('th');
  let brandbookStatus = $state('draft');
  let brandNameTh = $state('');
  let brandNameEn = $state('');
  let businessDescriptionTh = $state('');
  let businessDescriptionEn = $state('');
  let positioningTh = $state('');
  let positioningEn = $state('');
  let valuePropositionTh = $state('');
  let valuePropositionEn = $state('');
  let audienceSummaryTh = $state('');
  let audienceSummaryEn = $state('');
  let taglineTh = $state('');
  let taglineEn = $state('');
  let primaryColor = $state('#2563eb');
  let accentColor = $state('#f59e0b');
  let backgroundColor = $state('#ffffff');
  let textColor = $state('#0f172a');
  let headingFont = $state('Prompt');
  let bodyFont = $state('Sarabun');
  let accentFont = $state('Kanit');
  let toneSummaryTh = $state('');
  let toneSummaryEn = $state('');
  let useWordsTh = $state('');
  let useWordsEn = $state('');
  let avoidWordsTh = $state('');
  let avoidWordsEn = $state('');
  let ctaStyleTh = $state('');
  let ctaStyleEn = $state('');
  let visualMood = $state('');
  let lighting = $state('');
  let composition = $state('');
  let peopleStyle = $state('');
  let productStyle = $state('');
  let backgroundStyle = $state('');
  let graphicElements = $state('');
  let avoidStyle = $state('');
  let selectedTemplates = $state<string[]>([]);
  let aiPromptTh = $state('');
  let aiPromptEn = $state('');
  let negativePromptTh = $state('');
  let negativePromptEn = $state('');
  let disclaimer = $state('');
  let logoPlacementDefault = $state('bottom_right');
  let logoPlacementPrint = $state('bottom_center');
  let logoPlacementSocial = $state('bottom_right');
  let logoPlacementAds = $state('bottom_right');
  let logoPlacementLocked = $state(false);
  let moodboardGeneratedAt = $state<number | null>(null);
  let moodboardCopySamples = $state<CopySample[]>([]);
  let moodboardVisualSamples = $state<VisualSample[]>([]);

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
      await loadKit();
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isLoading = false;
    }
  });

  async function loadKit() {
    const res = await getBrandKit(kitId);
    kit = res.brand_kit;
    assets = res.assets;
    hydrateForm(kit);
  }

  function hydrateForm(next: BrandKit) {
    const brandbook = next.rules?.brandbook || {};
    const identity = brandbook.identity || {};
    const colors = Array.isArray(brandbook.colors) && brandbook.colors.length ? brandbook.colors : next.colors || [];
    const typography = brandbook.typography || next.typography || {};
    const tone = brandbook.tone_of_voice || {};
    const creative = brandbook.creative_style || {};
    const layouts = brandbook.layouts || {};
    const promptGuide = brandbook.ai_prompt_guide || {};
    const compliance = brandbook.compliance || {};
    const logo = brandbook.logo || {};
    const placement = logo.placement_presets || {};
    const moodboard = brandbook.moodboard || {};

    name = next.name;
    defaultLanguage = brandbook.language?.default || next.default_language || 'th';
    exportLanguage = defaultLanguage;
    brandbookStatus = next.brandbook_status || brandbook.review?.status || 'draft';
    brandNameTh = localized(identity.brand_name, 'th') || next.name;
    brandNameEn = localized(identity.brand_name, 'en');
    businessDescriptionTh = localized(identity.business_description, 'th');
    businessDescriptionEn = localized(identity.business_description, 'en');
    positioningTh = localized(identity.positioning, 'th');
    positioningEn = localized(identity.positioning, 'en');
    valuePropositionTh = localized(identity.value_proposition, 'th');
    valuePropositionEn = localized(identity.value_proposition, 'en');
    audienceSummaryTh = localized(identity.audience_summary, 'th');
    audienceSummaryEn = localized(identity.audience_summary, 'en');
    taglineTh = localized(identity.tagline, 'th');
    taglineEn = localized(identity.tagline, 'en');
    primaryColor = findColor(colors, 'primary') || '#2563eb';
    accentColor = findColor(colors, 'accent') || '#f59e0b';
    backgroundColor = findColor(colors, 'background') || '#ffffff';
    textColor = findColor(colors, 'text') || '#0f172a';
    headingFont = typography.heading?.family || typography.heading || next.typography?.heading || 'Prompt';
    bodyFont = typography.body?.family || typography.body || next.typography?.body || 'Sarabun';
    accentFont = typography.accent?.family || typography.accent || 'Kanit';
    toneSummaryTh = localized(tone.summary, 'th');
    toneSummaryEn = localized(tone.summary, 'en');
    useWordsTh = arrayText(tone.use_words?.th);
    useWordsEn = arrayText(tone.use_words?.en);
    avoidWordsTh = arrayText(tone.avoid_words?.th);
    avoidWordsEn = arrayText(tone.avoid_words?.en);
    ctaStyleTh = localized(tone.cta_style, 'th');
    ctaStyleEn = localized(tone.cta_style, 'en');
    visualMood = arrayText(creative.visual_mood);
    lighting = creative.lighting || '';
    composition = creative.composition || '';
    peopleStyle = creative.people_style || '';
    productStyle = creative.product_style || '';
    backgroundStyle = creative.background_style || '';
    graphicElements = arrayText(creative.graphic_elements);
    avoidStyle = arrayText(creative.avoid);
    selectedTemplates = Array.isArray(layouts.selected_templates) ? layouts.selected_templates.map((item: any) => typeof item === 'string' ? item : item.id).filter(Boolean) : [];
    aiPromptTh = localized(promptGuide.default_prompt_style, 'th');
    aiPromptEn = localized(promptGuide.default_prompt_style, 'en');
    negativePromptTh = localized(promptGuide.negative_prompt, 'th');
    negativePromptEn = localized(promptGuide.negative_prompt, 'en');
    disclaimer = compliance.disclaimer || '';
    logoPlacementDefault = placement.default || 'bottom_right';
    logoPlacementPrint = placement.print || 'bottom_center';
    logoPlacementSocial = placement.social || 'bottom_right';
    logoPlacementAds = placement.ads || 'bottom_right';
    logoPlacementLocked = Boolean(placement.locked);
    moodboardGeneratedAt = typeof moodboard.generated_at === 'number' ? moodboard.generated_at : null;
    moodboardCopySamples = Array.isArray(moodboard.copy_samples) ? moodboard.copy_samples : [];
    moodboardVisualSamples = Array.isArray(moodboard.visual_samples) ? moodboard.visual_samples : [];
  }

  async function saveKit() {
    if (!kit || isSaving) return;
    isSaving = true;
    error = '';
    try {
      const brandbook = buildBrandbook();
      const updated = await updateBrandKit(kit.id, {
        name: name.trim(),
        default_language: defaultLanguage,
        brandbook_status: brandbookStatus,
        colors: brandbook.colors,
        typography: {
          heading: headingFont.trim(),
          body: bodyFont.trim(),
          accent: accentFont.trim(),
        },
        rules: {
          ...kit.rules,
          brandbook,
        },
      });
      kit = updated;
      notice = 'บันทึก Brandbook แล้ว';
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isSaving = false;
    }
  }

  async function exportPdf() {
    if (!kit || isExporting) return;
    isExporting = true;
    error = '';
    try {
      const exported = await exportBrandKitPdf(kit.id, { language: exportLanguage || defaultLanguage });
      window.open(`${PUBLIC_API_URL}${exported.download_url}`, '_blank', 'noopener,noreferrer');
      notice = 'สร้าง Brandbook export แล้ว เปิดแท็บใหม่เพื่อ Print / Save PDF';
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isExporting = false;
    }
  }

  function chooseBrandAsset(event: Event, role: 'logo_primary' | 'font') {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    pendingUploadFile = file;
    pendingUploadRole = role;
    if (!uploadName.trim()) uploadName = file.name;
    if (!uploadTags.trim() || uploadTags === 'brandbook') {
      uploadTags = role === 'font' ? 'Font, Brandbook' : 'Logo, Brandbook, Primary';
    }
    input.value = '';
  }

  function clearPendingUpload() {
    pendingUploadFile = null;
    pendingUploadRole = null;
  }

  async function finishBrandAssetUpload() {
    if (!kit || isUploadingAsset) return;
    const file = pendingUploadFile;
    const role = pendingUploadRole;
    if (!file || !role) return;
    isUploadingAsset = true;
    error = '';
    try {
      const assetType = role === 'font' ? 'font' : 'logo';
      const uploaded = await uploadMediaAssetWithMetadata(file, {
        filename: uploadName.trim() || file.name,
        asset_type: assetType,
        tags: lines(uploadTags.replaceAll(',', '\n')),
      });
      await attachBrandKitAsset(kit.id, {
        asset_id: uploaded.id,
        role,
        license_confirmed: uploadLicenseConfirmed,
        license_note: uploadLicenseNote.trim(),
        metadata: { source: 'brandbook_builder', upload_name: uploadName.trim() || file.name },
      });
      const previousBrandbook = buildBrandbook();
      const previousAssets = previousBrandbook.assets || {};
      const nextAssets = {
        ...previousAssets,
        logo_asset_ids: role === 'logo_primary'
          ? unique([uploaded.id, ...(previousAssets.logo_asset_ids || [])])
          : previousAssets.logo_asset_ids || [],
        font_asset_ids: role === 'font'
          ? unique([uploaded.id, ...(previousAssets.font_asset_ids || [])])
          : previousAssets.font_asset_ids || [],
      };
      const nextLogo = role === 'logo_primary'
        ? { ...(previousBrandbook.logo || {}), primary_asset_id: uploaded.id }
        : previousBrandbook.logo;
      kit = await updateBrandKit(kit.id, {
        name: name.trim(),
        default_language: defaultLanguage,
        brandbook_status: brandbookStatus,
        colors: previousBrandbook.colors,
        typography: {
          heading: headingFont.trim(),
          body: bodyFont.trim(),
          accent: accentFont.trim(),
        },
        rules: {
          ...kit.rules,
          brandbook: {
            ...previousBrandbook,
            logo: nextLogo,
            assets: nextAssets,
          },
        },
      });
      await loadKit();
      uploadName = '';
      clearPendingUpload();
      notice = role === 'font' ? 'อัปโหลดและผูก font กับ Brandbook แล้ว' : 'อัปโหลดและผูก logo กับ Brandbook แล้ว';
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isUploadingAsset = false;
    }
  }

  async function removeLinkedAsset(asset: BrandKitAsset) {
    if (!kit || !confirm(`Remove "${asset.original_filename || asset.asset_id}" from this Brandbook?`)) return;
    error = '';
    try {
      await detachBrandKitAsset(kit.id, asset.id);
      const current = buildBrandbook();
      const nextAssets = removeAssetFromBrandbookAssets(current.assets || {}, asset.asset_id);
      const nextLogo = {
        ...(current.logo || {}),
        primary_asset_id: current.logo?.primary_asset_id === asset.asset_id ? '' : current.logo?.primary_asset_id,
      };
      kit = await updateBrandKit(kit.id, {
        name: name.trim(),
        default_language: defaultLanguage,
        brandbook_status: brandbookStatus,
        colors: current.colors,
        typography: {
          heading: headingFont.trim(),
          body: bodyFont.trim(),
          accent: accentFont.trim(),
        },
        rules: {
          ...kit.rules,
          brandbook: {
            ...current,
            logo: nextLogo,
            assets: nextAssets,
          },
        },
      });
      await loadKit();
      notice = 'นำ asset ออกจาก Brandbook แล้ว';
    } catch (err) {
      error = humanizeError(err);
    }
  }

  async function runSmartBrandbookWriting() {
    if (!kit) return;
    error = '';
    notice = '';
    isSmartWriting = true;
    try {
      const current = buildBrandbook();
      const res = await generateBrandKitSmartWriting(kit.id, {
        brandbook: current,
        language: defaultLanguage,
        mode: 'complete',
      });
      applySmartWriting(res.output || {});
      notice = `AI เขียน draft ให้แล้ว ใช้ ${res.meta?.credits_used ?? 0} credits เหลือ ${res.meta?.credits_remaining ?? '-'} credits — ตรวจทานแล้วกด Save Brandbook`;
    } catch (err) {
      error = humanizeError(err);
    } finally {
      isSmartWriting = false;
    }
  }

  function applySmartWriting(output: Record<string, any>) {
    const identity = output.identity || {};
    const tone = output.tone_of_voice || {};
    const creative = output.creative_style || {};
    const promptGuide = output.ai_prompt_guide || {};
    const compliance = output.compliance || {};

    brandNameTh = smartText(identity.brand_name?.th, brandNameTh);
    brandNameEn = smartText(identity.brand_name?.en, brandNameEn);
    businessDescriptionTh = smartText(identity.business_description?.th, businessDescriptionTh);
    businessDescriptionEn = smartText(identity.business_description?.en, businessDescriptionEn);
    positioningTh = smartText(identity.positioning?.th, positioningTh);
    positioningEn = smartText(identity.positioning?.en, positioningEn);
    valuePropositionTh = smartText(identity.value_proposition?.th, valuePropositionTh);
    valuePropositionEn = smartText(identity.value_proposition?.en, valuePropositionEn);
    audienceSummaryTh = smartText(identity.audience_summary?.th, audienceSummaryTh);
    audienceSummaryEn = smartText(identity.audience_summary?.en, audienceSummaryEn);
    taglineTh = smartText(identity.tagline?.th, taglineTh);
    taglineEn = smartText(identity.tagline?.en, taglineEn);

    toneSummaryTh = smartText(tone.summary?.th, toneSummaryTh);
    toneSummaryEn = smartText(tone.summary?.en, toneSummaryEn);
    ctaStyleTh = smartText(tone.cta_style?.th, ctaStyleTh);
    ctaStyleEn = smartText(tone.cta_style?.en, ctaStyleEn);
    useWordsTh = smartLines(tone.use_words?.th, useWordsTh);
    useWordsEn = smartLines(tone.use_words?.en, useWordsEn);
    avoidWordsTh = smartLines(tone.avoid_words?.th, avoidWordsTh);
    avoidWordsEn = smartLines(tone.avoid_words?.en, avoidWordsEn);

    visualMood = smartLines(creative.visual_mood, visualMood);
    lighting = smartText(creative.lighting, lighting);
    composition = smartText(creative.composition, composition);
    peopleStyle = smartText(creative.people_style, peopleStyle);
    productStyle = smartText(creative.product_style, productStyle);
    backgroundStyle = smartText(creative.background_style, backgroundStyle);
    graphicElements = smartLines(creative.graphic_elements, graphicElements);
    avoidStyle = smartLines(creative.avoid, avoidStyle);

    aiPromptTh = smartText(promptGuide.default_prompt_style?.th, aiPromptTh);
    aiPromptEn = smartText(promptGuide.default_prompt_style?.en, aiPromptEn);
    negativePromptTh = smartText(promptGuide.negative_prompt?.th, negativePromptTh);
    negativePromptEn = smartText(promptGuide.negative_prompt?.en, negativePromptEn);
    disclaimer = smartText(compliance.disclaimer, disclaimer);
  }

  async function generateBrandMoodboard() {
    const brandTh = brandNameTh || name || 'แบรนด์นี้';
    const brandEn = brandNameEn || brandTh;
    const promiseTh = valuePropositionTh || positioningTh || businessDescriptionTh;
    const promiseEn = valuePropositionEn || positioningEn || businessDescriptionEn;
    const audienceTh = audienceSummaryTh || 'เจ้าของธุรกิจ SMEs ที่ต้องการใช้ AI กับงานจริง';
    const audienceEn = audienceSummaryEn || 'SME owners who want to use AI in real business workflows';
    const audienceLabelTh = compactAudience(audienceTh, 'เจ้าของธุรกิจ SMEs');
    const audienceLabelEn = compactAudience(audienceEn, 'SME owners');
    const thTagline = taglineTh || 'ยกระดับธุรกิจทีละขั้นด้วย AI ที่ใช้ได้จริง';
    const enTagline = taglineEn || 'Step up your business with practical AI workflows';
    const ctaTh = ctaStyleTh || 'ลองเริ่มจาก workflow เล็ก ๆ แล้วดูว่า AI ช่วยงานส่วนไหนได้ก่อน';
    const ctaEn = ctaStyleEn || 'Start with one small workflow and see where AI can help first.';
    const styleWords = cleanStyleWords(lines(visualMood).slice(0, 5).join(', ')) || 'มั่นใจ, ทันสมัย, ลงมือทำจริง';
    const graphicWords = lines(graphicElements).slice(0, 5).join(', ') || 'stair-step shapes, upward arrow, workflow blocks';

    moodboardGeneratedAt = Date.now();
    moodboardCopySamples = [
      {
        id: 'ig_caption',
        channel: 'Instagram photo caption',
        title: 'IG Photo Caption',
        body: pair(
          `${brandTh} ไม่ได้สอนให้คุณใช้ AI ทุกตัว แต่ช่วยให้คุณเห็นว่า workflow ไหนในธุรกิจควรเริ่มก่อน\n\n${promiseTh}\n\nคำถามง่าย ๆ คือ งานซ้ำเรื่องไหนที่ทีมคุณยังเสียเวลาทุกวัน?`,
          `${brandEn} does not try to teach every AI tool. It helps business owners identify which workflow should start first.\n\n${promiseEn}\n\nA useful question: which repetitive task is still taking time from your team every day?`,
        ),
        cta: pair(ctaTh, ctaEn),
      },
      {
        id: 'facebook_post',
        channel: 'Facebook post',
        title: 'Facebook Education Post',
        body: pair(
          `หลายธุรกิจเริ่มใช้ AI จากการลองถาม ChatGPT แต่หยุดอยู่แค่นั้น เพราะยังไม่มีระบบที่ทีมใช้ซ้ำได้\n\n${brandTh} จึงเน้นการทำงานทีละขั้น: เลือก workflow, สร้าง prompt, ทดลองกับงานจริง, แล้วปรับให้ทีมใช้ต่อได้\n\n${thTagline}`,
          `Many businesses start AI by asking ChatGPT a few questions, then stop because there is no repeatable workflow for the team.\n\n${brandEn} focuses on a step-by-step process: choose a workflow, create prompts, test with real work, and make it reusable for the team.\n\n${enTagline}`,
        ),
        cta: pair(ctaTh, ctaEn),
      },
      {
        id: 'line_broadcast',
        channel: 'LINE OA broadcast',
        title: 'LINE OA Broadcast',
        body: pair(
          `สวัสดีครับ วันนี้ลองเลือกงานซ้ำในธุรกิจของคุณมา 1 งาน เช่น ตอบแชท สรุปยอด หรือคิดคอนเทนต์ แล้วถามว่า AI จะช่วยลดเวลาได้ตรงไหน\n\nถ้าคุณยังไม่แน่ใจว่าจะเริ่มจากงานไหน ${brandTh} ช่วยวาง workflow แรกให้ได้`,
          `Hello, today try choosing one repetitive task in your business, such as replying to chats, summarizing sales, or planning content. Then ask where AI can reduce time.\n\nIf you are not sure where to start, ${brandEn} can help map the first workflow.`,
        ),
        cta: pair('ลองเลือก workflow แรกของคุณ', 'Choose your first workflow'),
      },
      {
        id: 'ad_headline',
        channel: 'Ad headline',
        title: 'Ad Headline / CTA',
        body: pair(
          `${thTagline}\nสำหรับเจ้าของธุรกิจที่อยากใช้ AI กับงานจริง ไม่ใช่แค่ลองเล่น`,
          `${enTagline}\nFor business owners who want to use AI in real work, not just experiment with tools.`,
        ),
        cta: pair('ดูว่า AI ควรช่วยธุรกิจคุณตรงไหนก่อน', 'See where AI should help your business first'),
      },
      {
        id: 'brochure_intro',
        channel: 'Brochure intro',
        title: 'Brochure Intro',
        body: pair(
          `${brandTh} คือเวิร์กช็อปและโค้ชแบบจับมือทำสำหรับ${audienceLabelTh}\n\nจุดสำคัญไม่ใช่การรู้จักเครื่องมือให้เยอะที่สุด แต่คือการสร้างระบบเล็ก ๆ ที่ใช้ซ้ำได้จริงในงานขาย คอนเทนต์ แอดมิน และการวิเคราะห์ลูกค้า`,
          `${brandEn} is a hands-on AI coaching and workshop experience for ${audienceLabelEn}.\n\nThe goal is not to know the most tools, but to build small reusable systems for sales, content, admin, and customer analysis.`,
        ),
        cta: pair('เริ่มจากระบบเล็กที่ใช้ได้จริง', 'Start with a small system that works'),
      },
    ];

    moodboardVisualSamples = [
      visualSample(
        'ig_square_photo',
        'IG square post',
        '1:1',
        'โพสต์ให้ความรู้ 1 ประเด็น พร้อมภาพเจ้าของธุรกิจหรือโค้ชในบริบท workshop',
        'Educational square post with one clear idea, showing a business owner or coach in a practical workshop setting',
        logoPlacementSocial,
        brandTh,
        styleWords,
        graphicWords,
      ),
      visualSample(
        'facebook_landscape',
        'Facebook photo post',
        '16:9',
        'ภาพแนวนอนสำหรับเล่า before/after workflow จากงานซ้ำไปสู่ระบบ AI ที่ทีมใช้ต่อได้',
        'Landscape visual showing a before/after workflow from repetitive tasks to a reusable AI system',
        logoPlacementSocial,
        brandTh,
        styleWords,
        graphicWords,
      ),
      visualSample(
        'brochure_cover',
        'Brochure cover',
        'A4',
        'ปก brochure ที่เน้นบันไดการยกระดับธุรกิจ มี headline ใหญ่ พื้นที่โลโก้ชัด และภาพ workshop จริง',
        'A brochure cover built around a step-up business growth metaphor, clear headline, strong logo area, and realistic workshop imagery',
        logoPlacementPrint,
        brandTh,
        styleWords,
        graphicWords,
      ),
      visualSample(
        'ad_creative',
        'Ad creative',
        '4:5',
        'ภาพโฆษณาที่ไม่ขายแรง ใช้ headline สั้น พร้อม visual metaphor ลูกศรขึ้นหรือ workflow blocks',
        'A non-hype ad creative with a short headline and visual metaphor such as an upward arrow or workflow blocks',
        logoPlacementAds,
        brandTh,
        styleWords,
        graphicWords,
      ),
      visualSample(
        'carousel_cover',
        'Carousel cover',
        '1:1',
        'หน้าปก carousel แบบ checklist หรือ step-by-step สำหรับหัวข้อ AI workflow แรกที่ SME ควรเริ่ม',
        'A carousel cover using checklist or step-by-step layout for the first AI workflow an SME should start with',
        logoPlacementSocial,
        brandTh,
        styleWords,
        graphicWords,
      ),
    ];

    if (kit) await saveKit();
    notice = 'สร้าง Brand Moodboard และบันทึกเข้า Brandbook แล้ว';
  }

  async function makeDefault() {
    if (!kit) return;
    try {
      kit = await setDefaultBrandKit(kit.id);
      notice = 'ตั้งเป็น default แล้ว';
    } catch (err) {
      error = humanizeError(err);
    }
  }

  async function archiveCurrentKit() {
    if (!kit || !confirm(`Archive "${kit.name}"?`)) return;
    try {
      kit = await archiveBrandKit(kit.id);
      notice = 'Archive แล้ว';
    } catch (err) {
      error = humanizeError(err);
    }
  }

  async function restoreCurrentKit() {
    if (!kit) return;
    try {
      kit = await restoreBrandKit(kit.id);
      notice = 'Restore แล้ว';
    } catch (err) {
      error = humanizeError(err);
    }
  }

  async function deleteForever() {
    if (!kit || !confirm(`Delete forever "${kit.name}"? การลบนี้ย้อนกลับไม่ได้`)) return;
    try {
      await deleteBrandKit(kit.id);
      goto('/studio/brand-kits');
    } catch (err) {
      error = humanizeError(err);
    }
  }

  function buildBrandbook() {
    const supported = defaultLanguage === 'th-en' ? ['th', 'en'] : [defaultLanguage];
    return {
      schema_version: 1,
      language: {
        default: defaultLanguage,
        supported,
        pdf_export_default: defaultLanguage,
        bilingual_primary: 'th',
      },
      identity: {
        brand_name: pair(brandNameTh || name, brandNameEn),
        business_description: pair(businessDescriptionTh, businessDescriptionEn),
        industry: '',
        positioning: pair(positioningTh, positioningEn),
        value_proposition: pair(valuePropositionTh, valuePropositionEn),
        audience_summary: pair(audienceSummaryTh, audienceSummaryEn),
        personality: [],
        tagline: pair(taglineTh, taglineEn),
      },
      logo: {
        ...(kit?.rules?.brandbook?.logo || { primary_asset_id: '', variants: [], usage_rules: [], donts: [] }),
        placement_presets: {
          default: logoPlacementDefault,
          print: logoPlacementPrint,
          social: logoPlacementSocial,
          ads: logoPlacementAds,
          locked: logoPlacementLocked,
        },
      },
      colors: [
        color('primary', 'Primary', primaryColor, 'สีหลักของแบรนด์'),
        color('accent', 'Accent', accentColor, 'สีเน้นสำหรับ CTA หรือ highlight'),
        color('background', 'Background', backgroundColor, 'สีพื้นหลังหลัก'),
        color('text', 'Text', textColor, 'สีตัวอักษรหลัก'),
      ],
      typography: {
        main: { family: headingFont.trim(), source: 'system_or_google' },
        heading: { family: headingFont.trim(), source: 'system_or_google' },
        body: { family: bodyFont.trim(), source: 'system_or_google' },
        accent: { family: accentFont.trim(), source: 'system_or_google' },
        fallback_stack: ['system-ui', 'sans-serif'],
      },
      tone_of_voice: {
        summary: pair(toneSummaryTh, toneSummaryEn),
        use_words: { th: lines(useWordsTh), en: lines(useWordsEn) },
        avoid_words: { th: lines(avoidWordsTh), en: lines(avoidWordsEn) },
        cta_style: pair(ctaStyleTh, ctaStyleEn),
        sample_captions: { th: [], en: [] },
      },
      creative_style: {
        visual_mood: lines(visualMood),
        lighting,
        composition,
        people_style: peopleStyle,
        product_style: productStyle,
        background_style: backgroundStyle,
        graphic_elements: lines(graphicElements),
        avoid: lines(avoidStyle),
      },
      layouts: {
        selected_templates: selectedTemplates.map((id) => {
          const preset = templatePresets.find((item) => item.id === id);
          return {
            id,
            name: preset?.name || id,
            aspect_ratio: preset?.ratio || '1:1',
            placeholders: preset?.placeholders.split(',').map((item) => item.trim()) || [],
          };
        }),
        placeholder_rules: {},
        platform_rules: {},
        localized_placeholders: { th: {}, en: {} },
      },
      assets: kit?.rules?.brandbook?.assets || {
        logo_asset_ids: [],
        product_asset_ids: [],
        people_asset_ids: [],
        style_reference_asset_ids: [],
        font_asset_ids: [],
      },
      inspiration: kit?.rules?.brandbook?.inspiration || {
        source_type: '',
        source_asset_ids: [],
        style_summary: '',
        similarity_guardrails: [],
      },
      compliance: {
        allowed_claims: [],
        restricted_claims: [],
        disclaimer,
        license_notes: [],
      },
      ai_prompt_guide: {
        default_prompt_style: pair(aiPromptTh, aiPromptEn),
        negative_prompt: pair(negativePromptTh, negativePromptEn),
        reference_rules: [],
        platform_snippets: {},
      },
      moodboard: {
        generated_at: moodboardGeneratedAt,
        copy_samples: moodboardCopySamples,
        visual_samples: moodboardVisualSamples,
      },
      sources: kit?.rules?.brandbook?.sources || [],
      review: {
        status: brandbookStatus,
        reviewed_at: brandbookStatus === 'reviewed' ? Date.now() : null,
      },
    };
  }

  function toggleTemplate(id: string) {
    selectedTemplates = selectedTemplates.includes(id)
      ? selectedTemplates.filter((item) => item !== id)
      : [...selectedTemplates, id];
  }

  function pair(th: string, en: string): LocalizedText {
    return { th: th.trim(), en: en.trim() };
  }

  function color(role: string, label: string, hex: string, usage: string) {
    return { role, name: label, hex, value: hex, usage };
  }

  function visualSample(
    id: string,
    format: string,
    ratio: string,
    conceptTh: string,
    conceptEn: string,
    logoPlacement: string,
    brand: string,
    styleWords: string,
    graphicWords: string,
  ): VisualSample {
    return {
      id,
      format,
      ratio,
      concept: pair(conceptTh, conceptEn),
      prompt: pair(
        `สร้าง ${format} สำหรับแบรนด์ ${brand} โทน ${styleWords} ใช้สี primary ${primaryColor}, accent ${accentColor}, background ${backgroundColor}. แนวภาพ: ${conceptTh}. ใช้องค์ประกอบ ${graphicWords}. วางโลโก้ที่ ${placementLabel(logoPlacement)}${logoPlacementLocked ? ' และล็อกตำแหน่งนี้เสมอ' : ' แต่ปรับได้ตาม composition ถ้าจำเป็น'}. มีพื้นที่ข้อความภาษาไทย อ่านง่าย และไม่ขายฝัน`,
        `Create a ${format} for ${brand}. Mood: ${styleWords}. Use primary ${primaryColor}, accent ${accentColor}, background ${backgroundColor}. Visual direction: ${conceptEn}. Use elements such as ${graphicWords}. Place the logo at ${placementLabel(logoPlacement)}${logoPlacementLocked ? ' and keep this position locked' : ' unless composition requires adjustment'}. Leave clean space for Thai text and avoid hype.`,
      ),
      logo_placement: logoPlacement,
    };
  }

  function placementLabel(value: string) {
    return logoPlacementOptions.find((option) => option.value === value)?.label || value;
  }

  function localized(value: any, lang: 'th' | 'en') {
    if (!value) return '';
    if (typeof value === 'string') return lang === 'th' ? value : '';
    return typeof value[lang] === 'string' ? value[lang] : '';
  }

  function findColor(colors: any[], role: string) {
    const found = colors.find((item) => item.role === role);
    return found?.hex || found?.value || '';
  }

  function lines(value: string) {
    return value.split('\n').map((item) => item.trim()).filter(Boolean);
  }

  function smartText(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  function smartLines(value: unknown, fallback: string) {
    if (Array.isArray(value)) {
      const next = value.map((item) => String(item).trim()).filter(Boolean).join('\n');
      return next || fallback;
    }
    return smartText(value, fallback);
  }

  function compactAudience(value: string, fallback: string) {
    const firstSentence = value
      .replace(/\s+/g, ' ')
      .split(/[.!?\n。]| จุดสำคัญ| ที่รู้ว่า| who know| who want/i)[0]
      .trim();
    if (!firstSentence) return fallback;
    return firstSentence.length > 90 ? `${firstSentence.slice(0, 87).trim()}...` : firstSentence;
  }

  function cleanStyleWords(value: string) {
    return value
      .replaceAll('ติบโต', 'เติบโต')
      .replaceAll('เติบ โต', 'เติบโต')
      .trim();
  }

  function arrayText(value: unknown) {
    return Array.isArray(value) ? value.join('\n') : '';
  }

  function unique(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function removeAssetFromBrandbookAssets(current: Record<string, any>, assetId: string) {
    const next: Record<string, any> = {};
    for (const [key, value] of Object.entries(current)) {
      next[key] = Array.isArray(value) ? value.filter((item) => item !== assetId) : value;
    }
    return next;
  }

  function assetContentUrl(asset: BrandKitAsset) {
    return `${PUBLIC_API_URL}/api/media/assets/${asset.asset_id}/content`;
  }

  function isPreviewableImage(asset: BrandKitAsset) {
    return asset.asset_type === 'image' || asset.mime_type?.startsWith('image/');
  }

  function humanizeError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err || '');
    const map: Record<string, string> = {
      feature_disabled: 'Brand Kit Composition ยังไม่เปิดใช้งานบน environment นี้',
      brand_kit_not_found: 'ไม่พบ Brand Kit นี้',
      brand_kit_not_active: 'Brand Kit นี้ถูก archive อยู่ ต้อง restore ก่อน',
      name_required: 'กรุณาใส่ชื่อ Brand Kit',
      unsupported_mime_type: 'ชนิดไฟล์นี้ยังไม่รองรับ',
      invalid_file_size: 'ไฟล์ใหญ่เกินไปหรือขนาดไม่ถูกต้อง',
      email_not_verified: 'กรุณายืนยันอีเมลก่อนใช้ AI Smart Writing',
      insufficient_credits: 'เครดิตไม่เพียงพอสำหรับ AI Smart Writing',
      ai_error: 'AI Smart Writing ยังทำงานไม่สำเร็จ ลองใหม่อีกครั้ง',
      parse_error: 'AI ส่งผลลัพธ์ไม่ครบรูปแบบ ลอง Generate ใหม่อีกครั้ง',
    };
    return map[message] || message || 'ทำรายการไม่สำเร็จ';
  }
</script>

<svelte:head>
  <title>{kit?.name || 'Brandbook'} — Business Smart OS</title>
</svelte:head>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950">
  <main class="container-narrow py-6 space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <a href="/studio/brand-kits" class="text-sm text-primary-600 dark:text-primary-400 font-semibold">กลับ Brand Kits</a>
        <h1 class="heading-2 mt-1">{kit?.name || 'Brandbook'}</h1>
        {#if kit}
          <p class="text-dark-900/60 dark:text-dark-100/60">{kit.lifecycle_status} · {kit.is_default ? 'Default' : 'Custom'} · {kit.brandbook_status}</p>
        {/if}
      </div>
      {#if kit}
        <div class="flex flex-wrap gap-2">
          {#if kit.lifecycle_status === 'active' && !kit.is_default}
            <button onclick={makeDefault} class="btn-secondary">Set Default</button>
          {/if}
          {#if kit.lifecycle_status === 'active'}
            <button onclick={archiveCurrentKit} class="btn-secondary">Archive</button>
          {:else}
            <button onclick={restoreCurrentKit} class="btn-secondary">Restore</button>
          {/if}
          <button onclick={deleteForever} class="btn-secondary text-red-600 dark:text-red-300">Delete forever</button>
        </div>
      {/if}
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
      </div>
    {:else if kit}
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section class="space-y-5">
          <section class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4 space-y-4">
            <h2 class="font-bold text-dark-900 dark:text-dark-50">Basics</h2>
            <div class="grid md:grid-cols-2 gap-3">
              <label class="block">
                <span class="mb-1 block text-sm font-semibold">Brand Kit name</span>
                <input bind:value={name} class="input" />
              </label>
              <label class="block">
                <span class="mb-1 block text-sm font-semibold">Brandbook language</span>
                <select bind:value={defaultLanguage} class="input">
                  <option value="th">Thai</option>
                  <option value="en">English</option>
                  <option value="th-en">Thai + English</option>
                </select>
              </label>
              <label class="block">
                <span class="mb-1 block text-sm font-semibold">Brand name TH</span>
                <input bind:value={brandNameTh} class="input" />
              </label>
              <label class="block">
                <span class="mb-1 block text-sm font-semibold">Brand name EN</span>
                <input bind:value={brandNameEn} class="input" />
              </label>
            </div>
            <div class="grid md:grid-cols-2 gap-3">
              <label class="block">
                <span class="mb-1 block text-sm font-semibold">คำอธิบายธุรกิจ</span>
                <textarea bind:value={businessDescriptionTh} rows="4" class="input min-h-28"></textarea>
              </label>
              <label class="block">
                <span class="mb-1 block text-sm font-semibold">Business description</span>
                <textarea bind:value={businessDescriptionEn} rows="4" class="input min-h-28"></textarea>
              </label>
            </div>
          </section>

          <section class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4 space-y-4">
            <h2 class="font-bold text-dark-900 dark:text-dark-50">Identity</h2>
            <div class="grid md:grid-cols-2 gap-3">
              <TextField label="Positioning TH" bind:value={positioningTh} />
              <TextField label="Positioning EN" bind:value={positioningEn} />
              <TextField label="Value proposition TH" bind:value={valuePropositionTh} />
              <TextField label="Value proposition EN" bind:value={valuePropositionEn} />
              <TextField label="Audience summary TH" bind:value={audienceSummaryTh} />
              <TextField label="Audience summary EN" bind:value={audienceSummaryEn} />
              <TextField label="Tagline TH" bind:value={taglineTh} rows={2} />
              <TextField label="Tagline EN" bind:value={taglineEn} rows={2} />
            </div>
          </section>

          <section class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4 space-y-4">
            <h2 class="font-bold text-dark-900 dark:text-dark-50">Colors</h2>
            <div class="grid md:grid-cols-4 gap-3">
              <ColorInput label="Primary" bind:value={primaryColor} />
              <ColorInput label="Accent" bind:value={accentColor} />
              <ColorInput label="Background" bind:value={backgroundColor} />
              <ColorInput label="Text" bind:value={textColor} />
            </div>
          </section>

          <section class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4 space-y-4">
            <h2 class="font-bold text-dark-900 dark:text-dark-50">Typography</h2>
            <div class="grid md:grid-cols-3 gap-3">
              <label class="block">
                <span class="mb-1 block text-sm font-semibold">Heading font</span>
                <input bind:value={headingFont} class="input" />
              </label>
              <label class="block">
                <span class="mb-1 block text-sm font-semibold">Body font</span>
                <input bind:value={bodyFont} class="input" />
              </label>
              <label class="block">
                <span class="mb-1 block text-sm font-semibold">Accent font</span>
                <input bind:value={accentFont} class="input" />
              </label>
            </div>
            <p class="text-xs text-dark-900/50 dark:text-dark-100/50">Google Fonts selector, uploaded fonts และ AI font matching จะต่อใน phase ถัดไป</p>
          </section>

          <section class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4 space-y-4">
            <h2 class="font-bold text-dark-900 dark:text-dark-50">Tone of Voice</h2>
            <div class="grid md:grid-cols-2 gap-3">
              <TextField label="Tone summary TH" bind:value={toneSummaryTh} />
              <TextField label="Tone summary EN" bind:value={toneSummaryEn} />
              <TextField label="CTA style TH" bind:value={ctaStyleTh} rows={2} />
              <TextField label="CTA style EN" bind:value={ctaStyleEn} rows={2} />
              <ListField label="Words to use TH" bind:value={useWordsTh} />
              <ListField label="Words to use EN" bind:value={useWordsEn} />
              <ListField label="Words to avoid TH" bind:value={avoidWordsTh} />
              <ListField label="Words to avoid EN" bind:value={avoidWordsEn} />
            </div>
          </section>

          <section class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4 space-y-4">
            <h2 class="font-bold text-dark-900 dark:text-dark-50">Creative Style</h2>
            <div class="grid md:grid-cols-2 gap-3">
              <ListField label="Visual mood" bind:value={visualMood} />
              <ListField label="Graphic elements" bind:value={graphicElements} />
              <TextField label="Lighting" bind:value={lighting} />
              <TextField label="Composition" bind:value={composition} />
              <TextField label="People style" bind:value={peopleStyle} />
              <TextField label="Product style" bind:value={productStyle} />
              <TextField label="Background style" bind:value={backgroundStyle} />
              <ListField label="Avoid / negative style" bind:value={avoidStyle} />
            </div>
          </section>

          <section class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4 space-y-4">
            <h2 class="font-bold text-dark-900 dark:text-dark-50">Layout Templates</h2>
            <div class="grid md:grid-cols-2 gap-3">
              {#each templatePresets as preset}
                <label class="flex cursor-pointer items-start gap-3 rounded-lg border border-dark-100 p-3 dark:border-dark-700">
                  <input type="checkbox" checked={selectedTemplates.includes(preset.id)} onchange={() => toggleTemplate(preset.id)} class="mt-1" />
                  <span>
                    <span class="block text-sm font-semibold">{preset.name} <span class="text-xs text-dark-900/50 dark:text-dark-100/50">{preset.ratio}</span></span>
                    <span class="mt-1 block text-xs text-dark-900/60 dark:text-dark-100/60">{preset.placeholders}</span>
                  </span>
                </label>
              {/each}
            </div>
          </section>

          <section class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4 space-y-4">
            <h2 class="font-bold text-dark-900 dark:text-dark-50">Logo Placement Presets</h2>
            <div class="grid md:grid-cols-2 gap-3">
              <label class="block">
                <span class="mb-1 block text-sm font-semibold">Default</span>
                <select bind:value={logoPlacementDefault} class="input">
                  {#each logoPlacementOptions as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </label>
              <label class="block">
                <span class="mb-1 block text-sm font-semibold">งานพิมพ์</span>
                <select bind:value={logoPlacementPrint} class="input">
                  {#each logoPlacementOptions as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </label>
              <label class="block">
                <span class="mb-1 block text-sm font-semibold">Social media</span>
                <select bind:value={logoPlacementSocial} class="input">
                  {#each logoPlacementOptions as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </label>
              <label class="block">
                <span class="mb-1 block text-sm font-semibold">Ads</span>
                <select bind:value={logoPlacementAds} class="input">
                  {#each logoPlacementOptions as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </label>
            </div>
            <label class="flex items-start gap-2 text-sm">
              <input type="checkbox" bind:checked={logoPlacementLocked} class="mt-1" />
              <span>Lock ตำแหน่งโลโก้ตาม preset เสมอ ถ้าไม่ lock ระบบสามารถปรับตาม composition เพื่อให้งานสมดุลขึ้น</span>
            </label>
          </section>

          <section class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4 space-y-4">
            <h2 class="font-bold text-dark-900 dark:text-dark-50">AI Prompt Guide</h2>
            <div class="grid md:grid-cols-2 gap-3">
              <TextField label="Default prompt style TH" bind:value={aiPromptTh} />
              <TextField label="Default prompt style EN" bind:value={aiPromptEn} />
              <TextField label="Negative prompt TH" bind:value={negativePromptTh} />
              <TextField label="Negative prompt EN" bind:value={negativePromptEn} />
            </div>
          </section>

          <section class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4 space-y-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="font-bold text-dark-900 dark:text-dark-50">Brand Moodboard & Sample Assets</h2>
                <p class="mt-1 text-sm text-dark-900/60 dark:text-dark-100/60">สร้างตัวอย่าง copy และ key visual direction จาก Brandbook ปัจจุบัน แล้วบันทึกเป็น brand assets ใน Brandbook</p>
              </div>
              <button onclick={generateBrandMoodboard} disabled={isSaving} class="btn-primary">
                {isSaving ? 'Generating...' : moodboardCopySamples.length || moodboardVisualSamples.length ? 'Regenerate samples' : 'Generate samples'}
              </button>
            </div>

            {#if moodboardGeneratedAt}
              <div class="text-xs text-dark-900/50 dark:text-dark-100/50">Generated {new Date(moodboardGeneratedAt).toLocaleString('th-TH')}</div>
            {/if}

            {#if moodboardCopySamples.length}
              <div>
                <h3 class="mb-2 text-sm font-bold text-dark-900 dark:text-dark-50">Sample Copy</h3>
                <div class="grid md:grid-cols-2 gap-3">
                  {#each moodboardCopySamples as sample}
                    <div class="rounded-lg border border-dark-100 p-3 dark:border-dark-700">
                      <div class="text-xs font-semibold uppercase text-dark-900/50 dark:text-dark-100/50">{sample.channel}</div>
                      <div class="mt-1 font-bold text-dark-900 dark:text-dark-50">{sample.title}</div>
                      <div class="mt-2 whitespace-pre-wrap text-sm text-dark-900/80 dark:text-dark-100/80">{sample.body.th}</div>
                      {#if sample.cta.th}
                        <div class="mt-2 rounded-md bg-dark-50 px-2 py-1 text-xs font-semibold text-dark-900/70 dark:bg-dark-900 dark:text-dark-100/70">{sample.cta.th}</div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            {#if moodboardVisualSamples.length}
              <div>
                <h3 class="mb-2 text-sm font-bold text-dark-900 dark:text-dark-50">Sample Key Visual Directions</h3>
                <div class="grid md:grid-cols-2 gap-3">
                  {#each moodboardVisualSamples as sample}
                    <div class="overflow-hidden rounded-lg border border-dark-100 dark:border-dark-700">
                      <div class="flex h-24 items-end justify-between p-3" style={`background: linear-gradient(135deg, ${primaryColor}, ${primaryColor} 62%, ${accentColor} 62%); color: ${textColor};`}>
                        <div class="rounded bg-white/90 px-2 py-1 text-xs font-bold text-dark-900">{sample.format}</div>
                        <div class="rounded bg-black/80 px-2 py-1 text-xs font-bold text-white">{sample.ratio}</div>
                      </div>
                      <div class="space-y-2 p-3">
                        <div class="text-sm font-semibold text-dark-900 dark:text-dark-50">{sample.concept.th}</div>
                        <div class="text-xs text-dark-900/50 dark:text-dark-100/50">Logo: {placementLabel(sample.logo_placement)}</div>
                        <div class="max-h-28 overflow-y-auto whitespace-pre-wrap rounded-md bg-dark-50 p-2 text-xs text-dark-900/70 dark:bg-dark-900 dark:text-dark-100/70">{sample.prompt.th}</div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {:else}
              <div class="rounded-lg border border-dashed border-dark-200 p-4 text-center text-sm text-dark-900/50 dark:border-dark-700 dark:text-dark-100/50">
                ยังไม่มี sample assets กด Generate samples เพื่อสร้างตัวอย่างงานที่ใช้ mood, tone, colors และ logo placement ของแบรนด์นี้
              </div>
            {/if}
          </section>

          <section class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4 space-y-4">
            <h2 class="font-bold text-dark-900 dark:text-dark-50">Compliance</h2>
            <TextField label="Disclaimer / legal note" bind:value={disclaimer} />
          </section>
        </section>

        <aside class="space-y-4">
          <div class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
            <h2 class="font-bold text-dark-900 dark:text-dark-50">Actions</h2>
            <div class="mt-3 space-y-2">
              <button onclick={saveKit} disabled={isSaving} class="btn-primary w-full">{isSaving ? 'กำลังบันทึก...' : 'Save Brandbook'}</button>
              <label class="block">
                <span class="mb-1 block text-sm font-semibold">Export language</span>
                <select bind:value={exportLanguage} class="input">
                  <option value="th">Thai</option>
                  <option value="en">English</option>
                  <option value="th-en">Thai + English</option>
                </select>
              </label>
              <button onclick={exportPdf} disabled={isExporting} class="btn-secondary w-full">{isExporting ? 'กำลังสร้าง export...' : 'Export PDF'}</button>
              <button onclick={runSmartBrandbookWriting} disabled={isSmartWriting || isSaving} class="btn-secondary w-full">
                {isSmartWriting ? 'AI กำลังเขียน...' : 'AI Smart Writing'}
              </button>
              <p class="text-xs text-dark-900/50 dark:text-dark-100/50">ให้ AI เติม/ปรับทุกช่องจากข้อมูลที่มี แล้วค่อยตรวจทานก่อน Save</p>
            </div>
          </div>

          <div class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
            <h2 class="font-bold text-dark-900 dark:text-dark-50">Upload Brand Assets</h2>
            <div class="mt-3 space-y-3">
              <label class="block">
                <span class="mb-1 block text-sm font-semibold">Save as filename</span>
                <input bind:value={uploadName} placeholder="เช่น primary-logo.png" class="input" />
              </label>
              <label class="block">
                <span class="mb-1 block text-sm font-semibold">Tags</span>
                <input bind:value={uploadTags} placeholder="Products, People, Styles, Logo" class="input" />
              </label>
              <label class="flex items-start gap-2 text-sm">
                <input type="checkbox" bind:checked={uploadLicenseConfirmed} class="mt-1" />
                <span>ยืนยันว่ามีสิทธิ์ใช้ไฟล์นี้ใน Brandbook</span>
              </label>
              <label class="block">
                <span class="mb-1 block text-sm font-semibold">License note</span>
                <textarea bind:value={uploadLicenseNote} rows="2" class="input"></textarea>
              </label>
              <div class="grid gap-2">
                <label class="btn-secondary w-full cursor-pointer text-center">
                  Choose Logo
                  <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" disabled={isUploadingAsset} onchange={(event) => chooseBrandAsset(event, 'logo_primary')} />
                </label>
                <label class="btn-secondary w-full cursor-pointer text-center">
                  Choose Font
                  <input type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" class="sr-only" disabled={isUploadingAsset} onchange={(event) => chooseBrandAsset(event, 'font')} />
                </label>
                {#if pendingUploadFile}
                  <div class="rounded-lg border border-dark-100 bg-dark-50 p-2 text-xs dark:border-dark-700 dark:bg-dark-900">
                    <div class="font-semibold text-dark-900 dark:text-dark-50">{pendingUploadFile.name}</div>
                    <div class="text-dark-900/50 dark:text-dark-100/50">{pendingUploadRole === 'font' ? 'Font' : 'Logo'} · แก้ชื่อ/แท็กด้านบนก่อนกด Finish upload</div>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <button onclick={finishBrandAssetUpload} disabled={isUploadingAsset} class="btn-primary w-full">
                      {isUploadingAsset ? 'Uploading...' : 'Finish upload'}
                    </button>
                    <button onclick={clearPendingUpload} disabled={isUploadingAsset} class="btn-secondary w-full">Cancel</button>
                  </div>
                {/if}
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
            <h2 class="font-bold text-dark-900 dark:text-dark-50">Linked Assets</h2>
            <div class="mt-3 space-y-2">
              {#each assets as asset}
                <div class="flex gap-3 rounded-lg border border-dark-100 p-2 text-sm dark:border-dark-700">
                  {#if isPreviewableImage(asset)}
                    <img
                      src={assetContentUrl(asset)}
                      alt={asset.original_filename || asset.asset_id}
                      class="h-14 w-14 shrink-0 rounded-md border border-dark-100 bg-white object-contain dark:border-dark-700"
                      loading="lazy"
                    />
                  {:else}
                    <div class="grid h-14 w-14 shrink-0 place-items-center rounded-md border border-dark-100 bg-dark-50 text-xs font-semibold uppercase text-dark-900/50 dark:border-dark-700 dark:bg-dark-900 dark:text-dark-100/50">
                      {asset.asset_type || 'file'}
                    </div>
                  {/if}
                  <div class="min-w-0 flex-1">
                    <div class="truncate font-semibold">{asset.original_filename || asset.asset_id}</div>
                    <div class="text-xs text-dark-900/50 dark:text-dark-100/50">{asset.role} · {asset.asset_type}</div>
                    {#if asset.metadata?.upload_name}
                      <div class="mt-1 truncate text-xs text-dark-900/50 dark:text-dark-100/50">{asset.metadata.upload_name}</div>
                    {/if}
                  </div>
                  <button
                    onclick={() => removeLinkedAsset(asset)}
                    class="shrink-0 rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    Remove
                  </button>
                </div>
              {:else}
                <div class="rounded-lg border border-dashed border-dark-200 p-3 text-center text-sm text-dark-900/50 dark:border-dark-700 dark:text-dark-100/50">
                  ยังไม่มี asset ที่ผูกกับ Brand Kit
                </div>
              {/each}
            </div>
          </div>
        </aside>
      </div>
    {/if}
  </main>
</div>
