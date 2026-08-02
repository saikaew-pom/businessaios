import { EMBEDDED_THAI_FONT_CSS, EXPORT_FONT_STACK } from './exportFonts';

type Localized = { th?: string; en?: string };

export function buildBrandbookHTML(input: {
  brandKit: any;
  assets: any[];
  language: string;
  apiBaseUrl?: string;
}) {
  const brandbook = safeObject(input.brandKit.rules?.brandbook);
  const language = normalizeExportLanguage(input.language || brandbook.language?.default || input.brandKit.default_language);
  const identity = safeObject(brandbook.identity);
  const colors = normalizeColors(Array.isArray(brandbook.colors) && brandbook.colors.length ? brandbook.colors : input.brandKit.colors || []);
  const typography = safeObject(brandbook.typography || input.brandKit.typography);
  const tone = safeObject(brandbook.tone_of_voice);
  const creative = safeObject(brandbook.creative_style);
  const layouts = safeObject(brandbook.layouts);
  const promptGuide = safeObject(brandbook.ai_prompt_guide);
  const moodboard = safeObject(brandbook.moodboard);
  const compliance = safeObject(brandbook.compliance);
  const primary = colorValue(colors, 'primary', '#2563eb');
  const accent = colorValue(colors, 'accent', '#f59e0b');
  const background = colorValue(colors, 'background', '#ffffff');
  const text = colorValue(colors, 'text', '#0f172a');
  const display = isLightColor(primary) ? (isLightColor(accent) ? text : accent) : primary;
  const highlight = isLightColor(accent) ? accent : (isLightColor(primary) ? primary : accent);
  const logoId = brandbook.logo?.primary_asset_id || brandbook.assets?.logo_asset_ids?.[0] || findAssetId(input.assets, 'logo_primary', 'logo');
  const brandName = pick(identity.brand_name, language, input.brandKit.name);
  const generatedAt = new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const baseUrl = (input.apiBaseUrl || '').replace(/\/$/, '');

  return `<!doctype html>
<html lang="${language === 'en' ? 'en' : 'th'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(brandName)} Brandbook</title>
  <style>
    ${EMBEDDED_THAI_FONT_CSS}
    :root {
      --brand-primary: ${primary};
      --brand-accent: ${accent};
      --brand-bg: ${background};
      --brand-text: ${text};
      --brand-display: ${display};
      --brand-highlight: ${highlight};
      --ink: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --paper: #ffffff;
    }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; }
    body {
      background: #f3f4f6;
      color: var(--ink);
      font-family: ${EXPORT_FONT_STACK};
      line-height: 1.55;
    }
    .sheet {
      width: 210mm;
      min-height: 297mm;
      margin: 18px auto;
      background: var(--paper);
      box-shadow: 0 12px 40px rgba(15, 23, 42, 0.14);
      overflow: hidden;
    }
    .cover {
      min-height: 297mm;
      display: grid;
      align-content: space-between;
      padding: 28mm 22mm;
      background:
        linear-gradient(135deg, var(--brand-display) 0%, var(--brand-display) 70%, var(--brand-highlight) 70%, var(--brand-highlight) 100%);
      color: white;
    }
    .cover-mark {
      width: 118px;
      height: 118px;
      border-radius: 10px;
      background: var(--brand-highlight);
      border: 1px solid rgba(255,255,255,0.24);
      display: grid;
      place-items: center;
      overflow: hidden;
    }
    .cover-mark img { width: 100%; height: 100%; object-fit: contain; padding: 10px; background: var(--brand-highlight); }
    .cover h1 { margin: 26px 0 14px; max-width: 138mm; font-size: 54px; line-height: 1.02; letter-spacing: 0; }
    .cover p { max-width: 132mm; font-size: 18px; opacity: 0.92; white-space: pre-wrap; }
    .cover-meta { font-size: 13px; opacity: 0.78; }
    .cover-kicker {
      display: inline-block;
      margin-top: 28px;
      border-radius: 999px;
      background: var(--brand-highlight);
      color: var(--brand-display);
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .page { padding: 18mm 20mm; page-break-before: always; }
    .section-kicker { color: var(--brand-display); font-size: 12px; font-weight: 800; text-transform: uppercase; }
    h2 { margin: 0 0 10px; font-size: 30px; line-height: 1.15; color: var(--brand-display); letter-spacing: 0; }
    h2::after { content: ""; display: block; width: 34mm; height: 4px; margin-top: 8px; background: var(--brand-highlight); border-radius: 999px; }
    h3 { margin: 20px 0 8px; font-size: 15px; text-transform: uppercase; color: var(--brand-display); letter-spacing: 0; }
    p { margin: 0 0 8px; }
    .lead { color: var(--muted); font-size: 15px; white-space: pre-wrap; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .card { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: #fff; break-inside: avoid; page-break-inside: avoid; }
    .label { display: block; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; margin-bottom: 5px; }
    .value { font-size: 15px; white-space: pre-wrap; }
    .swatches { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .swatch { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    .swatch-color { height: 82px; border-bottom: 1px solid var(--line); }
    .swatch-body { padding: 10px; font-size: 12px; }
    .font-sample { font-size: 26px; font-weight: 700; color: var(--brand-display); }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { border-radius: 999px; border: 1px solid var(--line); padding: 5px 10px; font-size: 12px; }
    .prompt { background: #0f172a; color: #f8fafc; border-radius: 8px; padding: 14px; white-space: pre-wrap; break-inside: avoid; page-break-inside: avoid; }
    .sample-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: start; }
    .sample-card { border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: #fff; break-inside: avoid; page-break-inside: avoid; }
    .sample-card strong { display: block; margin-bottom: 6px; line-height: 1.25; }
    .sample-body { font-size: 12.5px; }
    .sample-section { white-space: pre-wrap; }
    .sample-section + .sample-section { margin-top: 10px; padding-top: 9px; border-top: 1px solid var(--line); }
    .sample-lang { display: block; margin-bottom: 3px; font-size: 10px; font-weight: 800; color: var(--muted); text-transform: uppercase; }
    .sample-cta-row { display: grid; gap: 5px; margin-top: 9px; }
    .sample-cta { display: block; border-radius: 8px; background: var(--brand-highlight); color: var(--brand-display); padding: 5px 8px; font-size: 10.5px; line-height: 1.35; font-weight: 800; }
    .sample-prompt { margin-top: 8px; border: 1px solid var(--line); border-radius: 8px; background: #f9fafb; padding: 8px; color: #374151; font-size: 10.5px; line-height: 1.45; }
    .visual-preview { height: 72px; border-radius: 8px; margin-bottom: 10px; background: linear-gradient(135deg, var(--brand-display) 0%, var(--brand-display) 64%, var(--brand-highlight) 64%, var(--brand-highlight) 100%); display: flex; align-items: end; justify-content: space-between; padding: 8px; }
    .visual-pill { border-radius: 999px; background: rgba(255,255,255,0.92); color: #111827; padding: 3px 8px; font-size: 10px; font-weight: 800; }
    .asset-gallery { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start; }
    .asset-card { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: #fff; break-inside: avoid; page-break-inside: avoid; }
    .asset-preview { height: 128px; display: grid; place-items: center; padding: 16px; background: linear-gradient(135deg, #f9fafb 0%, #f9fafb 72%, var(--brand-highlight) 72%, var(--brand-highlight) 100%); border-bottom: 1px solid var(--line); }
    .asset-preview img { max-width: 100%; max-height: 96px; object-fit: contain; filter: drop-shadow(0 10px 18px rgba(17,24,39,0.10)); }
    .asset-placeholder { width: 96px; height: 96px; border: 1px solid var(--line); border-radius: 8px; display: grid; place-items: center; color: var(--muted); font-size: 12px; font-weight: 800; background: white; text-transform: uppercase; }
    .asset-body { padding: 12px; }
    .asset-title { margin: 0 0 8px; font-size: 15px; line-height: 1.3; font-weight: 800; overflow-wrap: anywhere; }
    .asset-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line); font-size: 11px; color: var(--muted); }
    .asset-note { margin-top: 9px; color: #374151; font-size: 11.5px; line-height: 1.45; }
    .asset-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .asset-chip { border-radius: 999px; background: #f3f4f6; color: #374151; padding: 4px 8px; font-size: 10px; font-weight: 800; }
    .asset-chip.primary { background: var(--brand-display); color: white; }
    .asset-chip.accent { background: var(--brand-highlight); color: var(--brand-display); }
    .printbar { position: sticky; top: 0; display: flex; justify-content: center; gap: 8px; padding: 10px; background: rgba(17,24,39,0.9); z-index: 10; }
    .printbar button { border: 0; border-radius: 8px; padding: 8px 14px; color: white; background: var(--brand-primary); font: inherit; font-weight: 700; cursor: pointer; }
    @page { size: A4; margin: 0; }
    @media print {
      body { background: white; }
      .sheet { margin: 0; box-shadow: none; width: 210mm; min-height: 297mm; }
      .printbar { display: none; }
    }
  </style>
</head>
<body>
  <div class="printbar"><button onclick="window.print()">${language === 'en' ? 'Print / Save PDF' : 'พิมพ์ / บันทึก PDF'}</button></div>
  <section class="sheet cover">
    <div>
      <div class="cover-mark">${logoId ? `<img src="${baseUrl}/api/media/assets/${escAttr(logoId)}/content" alt="${escAttr(brandName)} logo" />` : esc(initials(brandName))}</div>
      <div class="cover-kicker">${esc(language === 'en' ? 'Brand System' : 'Brand System')}</div>
      <h1>${esc(brandName)}<br />Brandbook</h1>
      <p>${esc(pick(identity.business_description, language, language === 'en' ? 'Brand identity, creative direction, and AI generation guidelines.' : 'แนวทางแบรนด์ อัตลักษณ์ งานภาพ และกติกาสำหรับ AI generation'))}</p>
    </div>
    <div class="cover-meta">${esc(language === 'en' ? `Generated ${generatedAt}` : `สร้างเมื่อ ${generatedAt}`)} · ${esc(languageLabel(language))}</div>
  </section>

  <section class="sheet page">
    <div class="section-kicker">01</div>
    <h2>${language === 'en' ? 'Brand Overview' : 'ภาพรวมแบรนด์'}</h2>
    <p class="lead">${esc(pick(identity.positioning, language, ''))}</p>
    <div class="grid">
      ${infoCard(language === 'en' ? 'Value Proposition' : 'คุณค่าหลัก', pick(identity.value_proposition, language, ''))}
      ${infoCard(language === 'en' ? 'Audience' : 'กลุ่มเป้าหมาย', pick(identity.audience_summary, language, ''))}
      ${infoCard(language === 'en' ? 'Tagline' : 'Tagline', pick(identity.tagline, language, ''))}
      ${infoCard(language === 'en' ? 'Business Description' : 'คำอธิบายธุรกิจ', pick(identity.business_description, language, ''))}
    </div>
  </section>

  <section class="sheet page">
    <div class="section-kicker">02</div>
    <h2>${language === 'en' ? 'Visual Identity' : 'Visual Identity'}</h2>
    <h3>${language === 'en' ? 'Color System' : 'ระบบสี'}</h3>
    <div class="swatches">${colors.map((item) => `
      <div class="swatch">
        <div class="swatch-color" style="background:${escAttr(item.hex)}"></div>
        <div class="swatch-body"><strong>${esc(item.name || item.role)}</strong><br />${esc(item.hex)}<br />${esc(item.usage || '')}</div>
      </div>
    `).join('')}</div>
    <h3>${language === 'en' ? 'Typography' : 'ฟอนต์'}</h3>
    <div class="grid">
      ${fontCard('Heading', typography.heading?.family || typography.heading || '')}
      ${fontCard('Body', typography.body?.family || typography.body || '')}
      ${fontCard('Accent', typography.accent?.family || typography.accent || '')}
      ${fontCard('Fallback', Array.isArray(typography.fallback_stack) ? typography.fallback_stack.join(', ') : EXPORT_FONT_STACK)}
    </div>
  </section>

  <section class="sheet page">
    <div class="section-kicker">03</div>
    <h2>${language === 'en' ? 'Voice and Creative Direction' : 'น้ำเสียงและแนวทางงานสร้างสรรค์'}</h2>
    <div class="grid">
      ${infoCard(language === 'en' ? 'Tone Summary' : 'สรุปน้ำเสียง', pick(tone.summary, language, ''))}
      ${infoCard('CTA Style', pick(tone.cta_style, language, ''))}
    </div>
    <h3>${language === 'en' ? 'Words to Use' : 'คำที่ควรใช้'}</h3>
    ${chips(tone.use_words?.[language] || tone.use_words?.th || [])}
    <h3>${language === 'en' ? 'Words to Avoid' : 'คำที่ควรเลี่ยง'}</h3>
    ${chips(tone.avoid_words?.[language] || tone.avoid_words?.th || [])}
  </section>

  <section class="sheet page">
    <div class="section-kicker">04</div>
    <h3>${language === 'en' ? 'Creative Style' : 'Creative Style'}</h3>
    <div class="grid">
      ${infoCard('Visual Mood', listText(creative.visual_mood))}
      ${infoCard('Composition', creative.composition || '')}
      ${infoCard('People Style', creative.people_style || '')}
      ${infoCard('Product Style', creative.product_style || '')}
      ${infoCard('Graphic Elements', listText(creative.graphic_elements))}
      ${infoCard('Avoid', listText(creative.avoid))}
    </div>
  </section>

  <section class="sheet page">
    <div class="section-kicker">05</div>
    <h2>${language === 'en' ? 'Layouts and AI Prompt Guide' : 'Layout และ AI Prompt Guide'}</h2>
    <h3>${language === 'en' ? 'Selected Templates' : 'Template ที่เลือกใช้'}</h3>
    <div class="grid">${(layouts.selected_templates || []).map((template: any) => infoCard(template.name || template.id, `${template.aspect_ratio || ''}\n${(template.placeholders || []).join(', ')}`)).join('') || infoCard('-', language === 'en' ? 'No templates selected yet.' : 'ยังไม่ได้เลือก template')}</div>
    <h3>${language === 'en' ? 'Default Prompt Style' : 'แนว prompt หลัก'}</h3>
    <div class="prompt">${esc(pick(promptGuide.default_prompt_style, language, ''))}</div>
    <h3>${language === 'en' ? 'Negative Prompt' : 'Negative prompt'}</h3>
    <div class="prompt">${esc(pick(promptGuide.negative_prompt, language, ''))}</div>
    ${compliance.disclaimer ? `<h3>${language === 'en' ? 'Compliance Note' : 'ข้อควรระวัง'}</h3><p>${esc(compliance.disclaimer)}</p>` : ''}
  </section>

  <section class="sheet page">
    <div class="section-kicker">06</div>
    <h2>${language === 'en' ? 'Brand in Use' : 'Brand in Use'}</h2>
    <p class="lead">${language === 'en' ? 'Sample copy and key visual directions generated from this brandbook.' : 'ตัวอย่าง copy และ key visual direction ที่สร้างจาก brandbook นี้'}</p>
    <h3>${language === 'en' ? 'Sample Copy' : 'Sample Copy'}</h3>
    <div class="sample-grid">${sampleCopyCards(moodboard.copy_samples, language)}</div>
    <h3>${language === 'en' ? 'Key Visual Directions' : 'Key Visual Directions'}</h3>
    <div class="sample-grid">${sampleVisualCards(moodboard.visual_samples, language)}</div>
  </section>

  <section class="sheet page">
    <div class="section-kicker">07</div>
    <h2>${language === 'en' ? 'Brand Assets' : 'Brand Assets'}</h2>
    <p class="lead">${language === 'en'
    ? 'Approved files attached to this brand system. Use these assets as the source of truth for logo, visual references, fonts, and future AI-generated creative.'
    : 'ไฟล์ที่อนุมัติให้ใช้กับระบบแบรนด์นี้ ใช้เป็น source of truth สำหรับโลโก้ ภาพอ้างอิง ฟอนต์ และงานสร้างสรรค์จาก AI ต่อไป'}</p>
    ${assetGallery(input.assets, baseUrl, language)}
  </section>
</body>
</html>`;
}

function normalizeExportLanguage(value: string) {
  if (value === 'en' || value === 'th-en') return value;
  return 'th';
}

function pick(value: string | Localized | undefined, language: string, fallback: string) {
  if (typeof value === 'string') return value || fallback;
  if (!value || typeof value !== 'object') return fallback;
  if (language === 'en') return value.en || value.th || fallback;
  if (language === 'th-en') {
    const th = value.th || '';
    const en = value.en || '';
    return uniqueText([th, en]).join('\n\n');
  }
  return value.th || value.en || fallback;
}

function uniqueText(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function safeObject(value: any) {
  return value && typeof value === 'object' ? value : {};
}

function normalizeColors(colors: any[]) {
  const normalized = colors.map((item) => ({
    role: String(item.role || item.name || 'color'),
    name: String(item.name || item.role || 'Color'),
    hex: String(item.hex || item.value || '#111827'),
    usage: String(item.usage || ''),
  }));
  return normalized.length ? normalized : [
    { role: 'primary', name: 'Primary', hex: '#2563eb', usage: '' },
    { role: 'accent', name: 'Accent', hex: '#f59e0b', usage: '' },
    { role: 'background', name: 'Background', hex: '#ffffff', usage: '' },
    { role: 'text', name: 'Text', hex: '#0f172a', usage: '' },
  ];
}

function colorValue(colors: any[], role: string, fallback: string) {
  return colors.find((item) => item.role === role)?.hex || fallback;
}

function isLightColor(value: string) {
  const hex = value.replace('#', '').trim();
  const normalized = hex.length === 3
    ? hex.split('').map((char) => char + char).join('')
    : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return false;
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.68;
}

function infoCard(label: string, value: string) {
  return `<div class="card"><span class="label">${esc(label)}</span><div class="value">${esc(value || '-')}</div></div>`;
}

function fontCard(label: string, value: string) {
  return `<div class="card"><span class="label">${esc(label)}</span><div class="font-sample">Aa กข</div><div class="value">${esc(value || '-')}</div></div>`;
}

function chips(values: unknown) {
  const items = Array.isArray(values) ? values : [];
  return `<div class="chips">${items.map((item) => `<span class="chip">${esc(String(item))}</span>`).join('') || '<span class="chip">-</span>'}</div>`;
}

function sampleCopyCards(values: unknown, language: string) {
  const items = Array.isArray(values) ? values.slice(0, 6) : [];
  if (!items.length) return infoCard('-', language === 'en' ? 'No sample copy generated yet.' : 'ยังไม่มี sample copy');
  return items.map((item: any) => {
    const bodyParts = localizedParts(item.body, language);
    const ctaParts = localizedParts(item.cta, language);
    return `
    <div class="sample-card">
      <span class="label">${esc(item.channel || item.title || 'Copy')}</span>
      <strong>${esc(item.title || item.id || 'Sample')}</strong>
      <div class="sample-body">${bodyParts.map((part) => `<div class="sample-section"><span class="sample-lang">${part.lang}</span>${esc(part.text)}</div>`).join('')}</div>
      ${ctaParts.length ? `<div class="sample-cta-row">${ctaParts.map((part) => `<span class="sample-cta">${language === 'th-en' ? `<span class="sample-lang">${part.lang}</span>` : ''}${esc(part.text)}</span>`).join('')}</div>` : ''}
    </div>
  `;
  }).join('');
}

function sampleVisualCards(values: unknown, language: string) {
  const items = Array.isArray(values) ? values.slice(0, 6) : [];
  if (!items.length) return infoCard('-', language === 'en' ? 'No key visual directions generated yet.' : 'ยังไม่มี key visual direction');
  return items.map((item: any) => {
    const conceptParts = localizedParts(item.concept, language);
    const promptParts = localizedParts(item.prompt, language).map((part) => ({
      ...part,
      text: truncateText(part.text, language === 'th-en' ? 230 : 300),
    }));
    return `
    <div class="sample-card">
      <div class="visual-preview">
        <span class="visual-pill">${esc(item.format || 'Visual')}</span>
        <span class="visual-pill">${esc(item.ratio || '')}</span>
      </div>
      <span class="label">${esc(item.logo_placement ? `Logo ${item.logo_placement}` : 'Key Visual')}</span>
      <div class="sample-body">${conceptParts.map((part) => `<div class="sample-section"><span class="sample-lang">${part.lang}</span><strong>${esc(part.text)}</strong></div>`).join('')}</div>
      ${promptParts.length ? `<div class="sample-prompt">${promptParts.map((part) => `<div class="sample-section"><span class="sample-lang">${part.lang} prompt preview</span>${esc(part.text)}</div>`).join('')}</div>` : ''}
    </div>
  `;
  }).join('');
}

function localizedParts(value: string | Localized | undefined, language: string) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [{ lang: language === 'en' ? 'EN' : 'TH', text: trimmed }] : [];
  }
  if (!value || typeof value !== 'object') return [];
  const parts = language === 'en'
    ? [{ lang: 'EN', text: value.en || value.th || '' }]
    : language === 'th-en'
      ? [{ lang: 'TH', text: value.th || '' }, { lang: 'EN', text: value.en || '' }]
      : [{ lang: 'TH', text: value.th || value.en || '' }];
  return uniqueText(parts.map((part) => part.text)).map((text) => {
    const found = parts.find((part) => part.text.trim() === text);
    return { lang: found?.lang || 'TH', text };
  });
}

function truncateText(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1).trim()}...`;
}

function listText(values: unknown) {
  return Array.isArray(values) ? values.join('\n') : String(values || '');
}

function findAssetId(assets: any[], ...roles: string[]) {
  return assets.find((asset) => roles.includes(asset.role) || roles.includes(asset.asset_type))?.asset_id || '';
}

function assetPreview(asset: any, baseUrl: string) {
  const isImage = asset.asset_type === 'image' || String(asset.mime_type || '').startsWith('image/');
  if (!isImage) return `<div class="asset-placeholder">${esc(asset.asset_type || 'file')}</div>`;
  return `<img src="${baseUrl}/api/media/assets/${escAttr(asset.asset_id)}/content" alt="${escAttr(asset.original_filename || asset.asset_id)}" />`;
}

function assetGallery(assets: any[], baseUrl: string, language: string) {
  if (!assets.length) return `<p class="lead">${language === 'en' ? 'No approved assets have been linked yet.' : 'ยังไม่มี asset ที่ผูกไว้'}</p>`;
  return `<div class="asset-gallery">${assets.map((asset) => assetCard(asset, baseUrl, language)).join('')}</div>`;
}

function assetCard(asset: any, baseUrl: string, language: string) {
  const tags = normalizeTags(asset.metadata?.tags);
  const role = roleLabel(asset.role || 'reference', language);
  const type = assetKindLabel(asset.asset_type || asset.mime_type || 'file', language);
  const note = assetUsageNote(asset.role || asset.asset_type || 'reference', language);
  return `
    <article class="asset-card">
      <div class="asset-preview">${assetPreview(asset, baseUrl)}</div>
      <div class="asset-body">
        <div class="asset-chip-row">
          <span class="asset-chip primary">${esc(role)}</span>
          <span class="asset-chip accent">${esc(type)}</span>
          ${tags.slice(0, 4).map((tag) => `<span class="asset-chip">${esc(tag)}</span>`).join('')}
        </div>
        <h3 class="asset-title">${esc(asset.original_filename || asset.asset_id)}</h3>
        <p class="asset-note">${esc(note)}</p>
        <div class="asset-meta">
          <div><span class="label">${language === 'en' ? 'Role' : 'บทบาท'}</span>${esc(asset.role || 'reference')}</div>
          <div><span class="label">${language === 'en' ? 'File type' : 'ชนิดไฟล์'}</span>${esc(asset.mime_type || asset.asset_type || '-')}</div>
        </div>
      </div>
    </article>
  `;
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

function roleLabel(role: string, language: string) {
  const normalized = role.toLowerCase();
  const labels: Record<string, { th: string; en: string }> = {
    logo_primary: { th: 'Primary logo', en: 'Primary logo' },
    logo: { th: 'Logo', en: 'Logo' },
    font: { th: 'Font', en: 'Font' },
    reference: { th: 'Reference', en: 'Reference' },
    product: { th: 'Product', en: 'Product' },
    people: { th: 'People', en: 'People' },
    style: { th: 'Style reference', en: 'Style reference' },
    template: { th: 'Template', en: 'Template' },
  };
  const label = labels[normalized];
  return label ? (language === 'en' ? label.en : label.th) : role.replace(/_/g, ' ');
}

function assetKindLabel(value: string, language: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('image')) return language === 'en' ? 'Image asset' : 'Image asset';
  if (normalized.includes('font')) return language === 'en' ? 'Font file' : 'Font file';
  if (normalized.includes('pdf')) return language === 'en' ? 'Document' : 'Document';
  return language === 'en' ? 'Brand file' : 'Brand file';
}

function assetUsageNote(role: string, language: string) {
  const normalized = role.toLowerCase();
  if (normalized.includes('logo')) {
    return language === 'en'
      ? 'Use this as the primary mark. Keep clear space around the logo and avoid stretching, recoloring, or placing it on low-contrast backgrounds.'
      : 'ใช้เป็นโลโก้หลักของแบรนด์ เว้นพื้นที่รอบโลโก้ให้หายใจ และหลีกเลี่ยงการยืด บิด เปลี่ยนสี หรือวางบนพื้นหลังที่ contrast ต่ำ';
  }
  if (normalized.includes('font')) {
    return language === 'en'
      ? 'Use this font only when licensing is confirmed. Pair it with the typography rules in this brandbook.'
      : 'ใช้ฟอนต์นี้เมื่อยืนยันสิทธิ์การใช้งานแล้ว และจับคู่กับระบบ typography ที่กำหนดไว้ใน brandbook';
  }
  return language === 'en'
    ? 'Use as an approved reference for future creative direction, composition, and AI generation consistency.'
    : 'ใช้เป็น reference ที่ผ่านการเลือกแล้วสำหรับคุมทิศทางภาพ composition และความสม่ำเสมอของงาน AI รุ่นถัดไป';
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((item) => item[0]).join('').toUpperCase() || 'B';
}

function languageLabel(language: string) {
  if (language === 'en') return 'English';
  if (language === 'th-en') return 'Thai + English';
  return 'Thai';
}

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(value: unknown) {
  return esc(value).replace(/`/g, '&#96;');
}
