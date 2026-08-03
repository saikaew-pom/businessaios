/**
 * Server-side Presentation Export
 * - PPTX (PptxGenJS)
 * - Google Sheet (CSV + URL)
 * - HTML / Markdown / JSON / CSV
 */

import PptxGenJS from 'pptxgenjs';
import { getColorTheme, ColorTheme } from './presentationPresets';
import { EMBEDDED_THAI_FONT_CSS, EXPORT_FONT_STACK } from './exportFonts';
import { pptxChartSpec, renderChartSvg } from './presentationCharts';

// =====================================================
// Resolved AI image helpers
// -----------------------------------------------------
// `resolved_image_base64` / `resolved_image_mime` arrive on a slide object
// that was populated upstream (resolveSlideImages() in presentationRoutes.ts
// fetches the bytes from R2). From this module's point of view they are just
// optional strings that may be absent, empty, truncated, or outright
// adversarial — never trust them blindly before splicing them into an HTML
// attribute or handing them to pptxgenjs.
// =====================================================

// Base64's own alphabet (A-Z a-z 0-9 + /) plus padding contains none of
// & < > " ' — so a string that actually matches this shape can never break
// out of an HTML attribute or a CSS url('...') on its own. This is a cheap,
// good-enough gate against garbage/adversarial payloads; it is not a full
// base64 semantic validator (e.g. it won't catch a value which is
// syntactically valid base64 but decodes to non-image bytes), so callers
// still HTML-escape the resulting data: URI as defense in depth.
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
function isValidBase64Image(b64?: unknown): b64 is string {
  return typeof b64 === 'string' && b64.length > 0 && b64.length % 4 === 0 && BASE64_RE.test(b64);
}

// Restrict the mime type to a known-safe allowlist. This closes two holes at
// once: (1) an unexpected mime string can no longer carry characters like
// `"` or `'` into the `data:` URI we build (the primary HTML/CSS injection
// vector), and (2) pptxgenjs's background-image path derives its embedded
// media file's *extension* from a hardcoded 'preencoded.png' default rather
// than from the mime in `data` — normalizing here lets callers pick the
// matching real extension instead of silently mislabeling e.g. a JPEG as
// .png in the exported .pptx (verified via zip inspection: bytes were real
// JPEG magic numbers under a `.png` name/content-type).
const SAFE_IMAGE_MIME_RE = /^image\/(png|jpeg|jpg|webp|gif)$/;
function normalizeImageMime(mime?: unknown): string {
  const m = String(mime || '').toLowerCase().trim();
  if (SAFE_IMAGE_MIME_RE.test(m)) return m === 'image/jpg' ? 'image/jpeg' : m;
  return 'image/png';
}
function imageExtnFromMime(mime: string): string {
  return mime.split('/')[1] || 'png';
}
// A slide's media_suggestion resolves to a usable image only when both the
// mime normalizes cleanly (always true — normalizeImageMime never fails)
// and the base64 payload looks well-formed. Returns null otherwise so every
// call site falls back to its existing placeholder/flat-background behavior
// exactly as if the image had never resolved.
function resolvedImageOf(media?: SlideOutline['media_suggestion']): { mime: string; base64: string } | null {
  if (!media?.resolved_image_base64 || !isValidBase64Image(media.resolved_image_base64)) return null;
  return { mime: normalizeImageMime(media.resolved_image_mime), base64: media.resolved_image_base64 };
}

export interface SlideOutline {
  slide_number: number;
  section?: string;
  section_label?: string;
  title: string;
  subtitle?: string;
  key_points?: string[];
  bullet_points?: string[];
  body?: string;
  data_table?: { headers: string[]; rows: string[][] };
  chart?: { type: string; data?: any; highlight?: string };
  media_suggestion?: {
    kind: string;
    description?: string;
    image_prompt?: string;
    generation_id?: string;
    resolved_image_base64?: string;
    resolved_image_mime?: string;
  };
  color_emphasis?: string;
  speaker_note?: string;
  duration_seconds?: number;
  audience_emotion_target?: string;
  emotional_trigger?: string;
  key_message?: string;
  call_to_action?: string;
  supporting_data?: string;
  transition_to_next?: string;
  type?: string;
  layout?: string;
}

export interface PresentationExportData {
  project: { id: string; title: string; objective: string };
  outline: { outline: SlideOutline[]; framework: string };
  blueprint?: { slides: any[] };
  notes?: { slide_notes: any[]; global_notes?: any };
  colorTheme: ColorTheme;
}

// =====================================================
// HTML Export (printable, with embedded CSS for color theme)
// =====================================================
export function buildPresentationHTML(data: PresentationExportData): string {
  const { project, outline, blueprint, notes, colorTheme } = data;
  const slides = blueprint?.slides || outline.outline;
  const slideNotes = notes?.slide_notes || [];

  const escape = (s: any) => String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]!));

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>${escape(project.title)}</title>
<style>
  ${EMBEDDED_THAI_FONT_CSS}
  :root {
    --primary: ${colorTheme.primary};
    --secondary: ${colorTheme.secondary};
    --accent: ${colorTheme.accent};
    --bg: ${colorTheme.background};
    --text: ${colorTheme.text};
    --muted: ${colorTheme.textMuted};
    --chart1: ${colorTheme.chart1};
    --chart2: ${colorTheme.chart2};
    --chart3: ${colorTheme.chart3};
    --chart4: ${colorTheme.chart4};
    --chart5: ${colorTheme.chart5};
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ${EXPORT_FONT_STACK}; background: #f1f5f9; color: var(--text); line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .slide-title, .slide-subtitle, .slide-bullets li, .quadrant-cell p, .three-col-cell p, .data-table td, .data-table th { overflow-wrap: anywhere; word-break: break-word; }
  .slide { width: 960px; min-height: 540px; margin: 24px auto; background: var(--bg); border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); padding: 56px 64px; page-break-after: always; position: relative; overflow: hidden; }
  .slide-num { position: absolute; top: 24px; right: 32px; font-size: 12px; color: var(--muted); }
  .slide-framework { position: absolute; top: 24px; left: 32px; font-size: 11px; padding: 4px 10px; border-radius: 12px; background: var(--primary); color: white; }
  .slide-title { font-size: 32px; font-weight: 800; color: var(--text); margin-bottom: 8px; line-height: 1.25; }
  .slide-subtitle { font-size: 18px; color: var(--muted); margin-bottom: 24px; }
  .slide-section-label { font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--primary); margin-bottom: 8px; }
  .slide-bullets { list-style: none; padding: 0; }
  .slide-bullets li { font-size: 18px; padding: 8px 0 8px 28px; position: relative; }
  .slide-bullets li::before { content: "●"; color: var(--primary); position: absolute; left: 0; font-size: 14px; }
  .key-message-box { background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white; padding: 24px 32px; border-radius: 8px; font-size: 22px; font-weight: 700; margin: 24px 0; }
  .slide-cta { background: var(--accent); color: var(--text); padding: 16px 24px; border-radius: 8px; font-size: 20px; font-weight: 700; margin-top: 24px; text-align: center; }
  .data-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  .data-table th, .data-table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
  .data-table th { background: var(--primary); color: white; font-weight: 600; }
  .data-table tbody tr:nth-child(even) { background: #f8fafc; }
  .quadrant { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; }
  .quadrant-cell { background: #f8fafc; border-left: 4px solid var(--primary); padding: 16px 20px; border-radius: 6px; }
  .quadrant-cell h4 { font-size: 16px; color: var(--primary); margin-bottom: 6px; }
  .quadrant-cell p { font-size: 14px; color: var(--text); }
  .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 24px; }
  .three-col-cell { background: #f8fafc; padding: 24px 20px; border-radius: 8px; text-align: center; border-top: 4px solid var(--secondary); }
  .three-col-cell .icon { font-size: 36px; margin-bottom: 12px; }
  .three-col-cell h4 { font-size: 16px; color: var(--text); margin-bottom: 8px; }
  .three-col-cell p { font-size: 13px; color: var(--muted); }
  .chart-text { display: grid; grid-template-columns: 1.4fr 1fr; gap: 32px; margin-top: 24px; }
  .chart-area { background: #f8fafc; border-radius: 8px; padding: 20px; min-height: 280px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text); }
  .chart-area .placeholder { color: var(--muted); font-size: 13px; text-align: center; }
  .chart-area svg { flex: 1; width: 100%; }
  .chart-area .chart-caption { color: var(--muted); font-size: 12px; margin-top: 8px; text-align: center; }
  .full-bleed { background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white; padding: 80px 64px; }
  .full-bleed .slide-title, .full-bleed .slide-subtitle { color: white; }
  .full-bleed .slide-section-label { color: rgba(255,255,255,0.8); }
  .comparison { display: grid; grid-template-columns: 1fr auto 1fr; gap: 24px; margin-top: 24px; align-items: center; }
  .vs-label { font-size: 32px; font-weight: 800; color: var(--accent); }
  .speaker-notes { background: #fef3c7; border-left: 4px solid var(--accent); padding: 12px 16px; margin-top: 24px; border-radius: 4px; font-size: 13px; }
  .speaker-notes .label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--accent); margin-bottom: 4px; }
  @media print {
    body { background: white; }
    /* One slide = one printed page, sized exactly to the 960x540 (16:9)
       slide so nothing is scaled or clipped. The old "size: 16:9" was an
       invalid @page value -- browsers ignored it and fell back to A4
       portrait, which is why landscape slides printed clipped/off the edge. */
    .slide { box-shadow: none; margin: 0; border-radius: 0; width: 100%; min-height: 0; height: 540px; page-break-after: always; }
  }
  @page { size: 960px 540px; margin: 0; }
</style>
</head>
<body>
${slides.map((s, idx) => {
  const note = slideNotes.find((n: any) => n.slide_number === s.slide_number);
  const isTitle = idx === 0 || s.section === 'title' || s.type === 'title';
  const isFullBleed = s.layout === 'full_bleed' || s.type === 'visual';
  const frameworkLabel = outline.framework === 'scqa_minto' ? 'SCQA + Minto' : outline.framework === '5m_mission' ? '5M Mission' : 'Pop-Up Pitch';

  const sectionLabel = s.section_label || s.section?.replace(/_/g, ' ');
  const bullets = s.bullet_points || s.key_points || [];
  const resolvedMedia = resolvedImageOf(s.media_suggestion);
  const resolvedImage = resolvedMedia ? `data:${resolvedMedia.mime};base64,${resolvedMedia.base64}` : null;
  // A dark gradient composited under the real photo keeps the existing
  // white title/subtitle/CTA text readable regardless of the AI image's own
  // brightness -- same reasoning as scrimming a hero photo behind text on a
  // landing page.
  // The data: URI is HTML-escaped (same `escape()` used for every other
  // interpolated field in this template) before going into the style
  // attribute: mime/base64 are validated upstream in resolvedImageOf(), but
  // escaping here is defense in depth against anything that slips through,
  // since a raw `"` or `'` would otherwise break out of either the url('...')
  // or the surrounding style="..." attribute.
  const fullBleedStyle = isFullBleed && resolvedImage
    ? ` style="background-image: linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url('${escape(resolvedImage)}'); background-size: cover; background-position: center;"`
    : '';

  return `
  <section class="slide ${isFullBleed ? 'full-bleed' : ''}"${fullBleedStyle}>

    <div class="slide-framework">${frameworkLabel}</div>
    <div class="slide-num">${s.slide_number} / ${slides.length}</div>
    ${sectionLabel && !isTitle ? `<div class="slide-section-label">${escape(sectionLabel)}</div>` : ''}
    <h1 class="slide-title">${escape(s.title)}</h1>
    ${s.subtitle ? `<p class="slide-subtitle">${escape(s.subtitle)}</p>` : ''}

    ${s.key_message ? `<div class="key-message-box">${escape(s.key_message)}</div>` : ''}

    ${bullets.length > 0 ? `<ul class="slide-bullets">${bullets.map((b: string) => `<li>${escape(b)}</li>`).join('')}</ul>` : ''}

    ${s.body && bullets.length === 0 ? `<p style="font-size: 18px; line-height: 1.7; margin-top: 16px;">${escape(s.body)}</p>` : ''}

    ${s.supporting_data ? `<p style="font-size: 14px; color: var(--muted); margin-top: 16px; font-style: italic;">📊 ${escape(s.supporting_data)}</p>` : ''}

    ${s.data_table ? `
      <table class="data-table">
        <thead><tr>${s.data_table.headers.map((h: string) => `<th>${escape(h)}</th>`).join('')}</tr></thead>
        <tbody>${s.data_table.rows.map((row: string[]) => `<tr>${row.map((c: string) => `<td>${escape(c)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    ` : ''}

    ${s.layout === 'quadrant' && bullets.length >= 4 ? `
      <div class="quadrant">
        ${bullets.slice(0, 4).map((b: string, i: number) => {
          const parts = b.split(':');
          const title = parts.length > 1 ? parts[0] : `ข้อ ${i + 1}`;
          const body = parts.length > 1 ? parts.slice(1).join(':') : b;
          return `<div class="quadrant-cell"><h4>${escape(title)}</h4><p>${escape(body)}</p></div>`;
        }).join('')}
      </div>
    ` : ''}

    ${s.layout === '3column' && bullets.length >= 3 ? `
      <div class="three-col">
        ${bullets.slice(0, 3).map((b: string, i: number) => {
          const icons = ['⭐', '🔥', '💡'];
          return `<div class="three-col-cell"><div class="icon">${icons[i]}</div><h4>${escape(b)}</h4></div>`;
        }).join('')}
      </div>
    ` : ''}

    ${s.layout === 'chart_text' ? (() => {
      const svg = renderChartSvg(s.chart, colorTheme);
      return `
      <div class="chart-text">
        <div class="chart-area">
          ${svg || `<div class="placeholder">📊 ${escape(s.chart?.type || 'chart')}<br><small>${escape(s.chart?.highlight || '')}</small></div>`}
          ${svg && s.chart?.highlight ? `<div class="chart-caption">${escape(s.chart.highlight)}</div>` : ''}
        </div>
        <div>${bullets.map((b: string) => `<p style="font-size: 16px; margin-bottom: 12px;">• ${escape(b)}</p>`).join('')}</div>
      </div>
    `;
    })() : ''}

    ${s.call_to_action ? `<div class="slide-cta">${escape(s.call_to_action)}</div>` : ''}

    ${s.media_suggestion && s.media_suggestion.kind === 'image' && !isFullBleed ? (
      resolvedImage
        ? `<img src="${escape(resolvedImage)}" alt="${escape(s.media_suggestion.description || '')}" style="width: 100%; max-height: 260px; object-fit: cover; border-radius: 8px; margin-top: 16px;" />`
        : `
      <div style="background: rgba(0,0,0,0.04); padding: 16px; border-radius: 8px; margin-top: 16px; font-size: 13px; color: var(--muted);">
        🎨 ${escape(s.media_suggestion.description || s.media_suggestion.image_prompt || 'image')}
      </div>
    `
    ) : ''}

    ${note ? `
      <div class="speaker-notes">
        <div class="label">🎤 Speaker Notes (${note.script ? '~' + Math.round((note.script.length / 15) / 60 * 60) + 's' : ''})</div>
        <div>${escape(note.script || note.talking_points?.join(' / ') || '')}</div>
      </div>
    ` : ''}
  </section>
  `;
}).join('\n')}
</body>
</html>`;
}

// =====================================================
// Markdown Export
// =====================================================
export function buildPresentationMarkdown(data: PresentationExportData): string {
  const { project, outline, blueprint, notes, colorTheme } = data;
  const slides = blueprint?.slides || outline.outline;
  const slideNotes = notes?.slide_notes || [];

  const lines: string[] = [];
  lines.push(`# ${project.title}`);
  lines.push('');
  lines.push(`**Framework:** ${outline.framework}`);
  lines.push(`**Objective:** ${project.objective}`);
  lines.push(`**Color theme:** ${colorTheme.name}`);
  lines.push(`**Total slides:** ${slides.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  slides.forEach((s) => {
    const note = slideNotes.find((n: any) => n.slide_number === s.slide_number);
    lines.push(`## Slide ${s.slide_number}: ${s.title || ''}`);
    if (s.section_label || s.section) {
      lines.push(`*${s.section_label || s.section}*`);
    }
    if (s.subtitle) {
      lines.push('');
      lines.push(`> ${s.subtitle}`);
    }
    if (s.key_message) {
      lines.push('');
      lines.push(`**🎯 Key Message:** ${s.key_message}`);
    }
    const bullets = s.bullet_points || s.key_points || [];
    if (bullets.length) {
      lines.push('');
      bullets.forEach((b: string) => lines.push(`- ${b}`));
    }
    if (s.body && bullets.length === 0) {
      lines.push('');
      lines.push(s.body);
    }
    if (s.supporting_data) {
      lines.push('');
      lines.push(`📊 *${s.supporting_data}*`);
    }
    if (s.data_table) {
      lines.push('');
      lines.push('| ' + s.data_table.headers.join(' | ') + ' |');
      lines.push('| ' + s.data_table.headers.map(() => '---').join(' | ') + ' |');
      s.data_table.rows.forEach((row: string[]) => lines.push('| ' + row.join(' | ') + ' |'));
    }
    if (s.call_to_action) {
      lines.push('');
      lines.push(`**📣 CTA:** ${s.call_to_action}`);
    }
    if (s.media_suggestion) {
      lines.push('');
      lines.push(`🎨 *Media: ${s.media_suggestion.description || s.media_suggestion.kind}*`);
    }
    if (note?.script) {
      lines.push('');
      lines.push(`> 🎤 **Speaker:** ${note.script}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

// =====================================================
// JSON Export
// =====================================================
export function buildPresentationJSON(data: PresentationExportData): string {
  return JSON.stringify(data, null, 2);
}

// =====================================================
// CSV Export (slide-by-slide)
// =====================================================
export function buildPresentationCSV(data: PresentationExportData): string {
  const { project, outline, blueprint, notes } = data;
  const slides = blueprint?.slides || outline.outline;
  const slideNotes = notes?.slide_notes || [];

  const rows: string[][] = [
    ['Slide#', 'Section', 'Title', 'Subtitle', 'Key Message', 'Body (joined)', 'CTA', 'Media', 'Speaker Note'],
  ];

  slides.forEach((s) => {
    const note = slideNotes.find((n: any) => n.slide_number === s.slide_number);
    const bullets = (s.bullet_points || s.key_points || []).join(' | ');
    const esc = (v: any) => {
      const str = String(v || '').replace(/"/g, '""');
      return /[",\n]/.test(str) ? `"${str}"` : str;
    };
    rows.push([
      String(s.slide_number),
      esc(s.section_label || s.section || ''),
      esc(s.title),
      esc(s.subtitle),
      esc(s.key_message),
      esc(bullets),
      esc(s.call_to_action),
      esc(s.media_suggestion?.description || ''),
      esc(note?.script || ''),
    ]);
  });

  return rows.map((r) => r.join(',')).join('\n');
}

// =====================================================
// PPTX Export (using PptxGenJS — true PowerPoint file)
// =====================================================
export async function buildPresentationPPTX(data: PresentationExportData): Promise<ArrayBuffer> {
  const { project, outline, blueprint, notes, colorTheme } = data;
  const slides = blueprint?.slides || outline.outline;
  const slideNotes = notes?.slide_notes || [];

  const pptx = new PptxGenJS();
  pptx.author = 'Business Smart OS';
  pptx.company = 'Business Smart OS';
  pptx.title = project.title;
  pptx.subject = `Smart Engine-Generated Presentation (${outline.framework})`;

  // Slide layout: 16:9 widescreen
  pptx.layout = 'LAYOUT_WIDE'; // 13.333" x 7.5"
  pptx.defineLayout({ name: 'BAIOS_169', width: 13.333, height: 7.5 });
  pptx.layout = 'BAIOS_169';

  const colorHex = (c: string) => c.replace('#', '');

  slides.forEach((s, idx) => {
    const note = slideNotes.find((n: any) => n.slide_number === s.slide_number);
    const isTitle = idx === 0 || s.section === 'title' || s.type === 'title';
    const isFullBleed = s.layout === 'full_bleed' || s.type === 'visual';

    const slide = pptx.addSlide();

    if (isFullBleed) {
      // Full-bleed background — a real generated image when Step 7's "generate
      // image" flow resolved one, the flat theme-color gradient otherwise.
      const resolvedMedia = resolvedImageOf(s.media_suggestion);
      if (resolvedMedia) {
        // pptxgenjs's addBackgroundDefinition derives the embedded media
        // file's extension from `path` (defaulting to 'preencoded.png' when
        // only `data` is given) rather than from the mime inside `data` --
        // verified by unzipping a real .pptx: a JPEG background came out
        // named/typed as .png in the package while the bytes were still
        // genuinely JPEG. Passing an explicit `path` with the correct
        // extension keeps the zip's media file and [Content_Types].xml entry
        // truthful for non-PNG mimes.
        slide.background = {
          data: `${resolvedMedia.mime};base64,${resolvedMedia.base64}`,
          path: `preencoded.${imageExtnFromMime(resolvedMedia.mime)}`,
        };
        // Same reasoning as the HTML export's gradient scrim: a semi-transparent
        // dark rectangle over the photo keeps the white title/subtitle/body
        // text readable regardless of the AI image's own brightness.
        slide.addShape('rect', {
          x: 0, y: 0, w: 13.333, h: 7.5,
          fill: { color: '000000', transparency: 45 }, line: { type: 'none' },
        });
      } else {
        slide.background = { color: colorHex(colorTheme.primary) };
      }
      slide.addText(s.title || '', {
        x: 0.8, y: 2.2, w: 11.7, h: 1.5,
        fontSize: 40, fontFace: 'Sarabun', color: 'FFFFFF', bold: true, align: 'center', valign: 'middle',
      });
      if (s.subtitle) {
        slide.addText(s.subtitle, {
          x: 0.8, y: 3.8, w: 11.7, h: 0.8,
          fontSize: 22, fontFace: 'Sarabun', color: 'FFFFFF', align: 'center', valign: 'middle',
        });
      }
      if (s.body) {
        slide.addText(s.body, {
          x: 1.5, y: 5.0, w: 10.3, h: 1.5,
          fontSize: 18, fontFace: 'Sarabun', color: 'FFFFFF', align: 'center', valign: 'middle',
        });
      }
    } else {
      slide.background = { color: colorHex(colorTheme.background) };

      // Framework badge
      const frameworkLabel = outline.framework === 'scqa_minto' ? 'SCQA + Minto' : outline.framework === '5m_mission' ? '5M' : 'Pop-Up';
      slide.addShape('roundRect', {
        x: 0.5, y: 0.3, w: 1.8, h: 0.3,
        fill: { color: colorHex(colorTheme.primary) }, line: { color: colorHex(colorTheme.primary) },
        rectRadius: 0.15,
      });
      slide.addText(frameworkLabel, {
        x: 0.5, y: 0.3, w: 1.8, h: 0.3,
        fontSize: 10, color: 'FFFFFF', bold: true, align: 'center', valign: 'middle', fontFace: 'Sarabun',
      });

      // Slide number
      slide.addText(`${s.slide_number} / ${slides.length}`, {
        x: 11.5, y: 0.3, w: 1.3, h: 0.3,
        fontSize: 10, color: colorHex(colorTheme.textMuted), align: 'right', fontFace: 'Sarabun',
      });

      // Section label
      if (s.section_label || s.section) {
        const sectionLabel = s.section_label || s.section?.replace(/_/g, ' ');
        slide.addText(String(sectionLabel).toUpperCase(), {
          x: 0.6, y: 0.9, w: 12, h: 0.3,
          fontSize: 10, color: colorHex(colorTheme.primary), bold: true, fontFace: 'Sarabun', charSpacing: 2,
        });
      }

      // Title
      slide.addText(s.title || '', {
        x: 0.6, y: 1.3, w: 12.1, h: 0.9,
        fontSize: isTitle ? 44 : 30, fontFace: 'Sarabun', color: colorHex(colorTheme.text), bold: true, valign: 'top',
      });

      // Subtitle
      if (s.subtitle) {
        slide.addText(s.subtitle, {
          x: 0.6, y: 2.2, w: 12.1, h: 0.5,
          fontSize: 18, fontFace: 'Sarabun', color: colorHex(colorTheme.textMuted), valign: 'top',
        });
      }

      // Key message box
      if (s.key_message) {
        slide.addShape('rect', {
          x: 0.6, y: 2.9, w: 12.1, h: 0.9,
          fill: { color: colorHex(colorTheme.primary) }, line: { color: colorHex(colorTheme.primary) },
        });
        slide.addText(s.key_message, {
          x: 0.8, y: 2.9, w: 11.7, h: 0.9,
          fontSize: 18, fontFace: 'Sarabun', color: 'FFFFFF', bold: true, valign: 'middle',
        });
      }

      // Bullets — narrowed to the right column when a chart occupies the left
      // column (chart_text layout), full-width otherwise.
      const isChartText = s.layout === 'chart_text' && !!s.chart;
      const bullets = s.bullet_points || s.key_points || [];
      const contentStartY = s.key_message ? 4.0 : 2.9;
      if (bullets.length > 0) {
        const bulletText = bullets.map((b: string) => ({ text: b, options: { bullet: { code: '25CF' } } }));
        slide.addText(bulletText as any, {
          x: isChartText ? 7.3 : 0.8, y: contentStartY, w: isChartText ? 5.4 : 11.9, h: 6.7 - contentStartY,
          fontSize: 16, fontFace: 'Sarabun', color: colorHex(colorTheme.text), paraSpaceAfter: 8, valign: 'top',
        });
      } else if (s.body) {
        slide.addText(s.body, {
          x: isChartText ? 7.3 : 0.8, y: 3.0, w: isChartText ? 5.4 : 11.9, h: 3.5,
          fontSize: 18, fontFace: 'Sarabun', color: colorHex(colorTheme.text), valign: 'top',
        });
      }

      // Real chart (chart_text layout) — native PPTX chart from Step 7's
      // structured chart.data when it normalizes; a labeled placeholder box
      // when the AI output doesn't normalize cleanly, same fallback the HTML
      // export uses.
      if (isChartText) {
        const chartH = 6.7 - contentStartY;
        const spec = pptxChartSpec(s.chart, colorTheme);
        if (spec) {
          // pptxgenjs's own typings disagree with themselves here: addChart's
          // signature wants the string-literal CHART_NAME union, but the
          // library also exports a same-named ChartType *enum* whose members
          // aren't structurally assignable to it. Passing the literal directly
          // (spec.family already is 'bar' | 'line' | 'area' | 'pie') satisfies
          // CHART_NAME without a cast.
          slide.addChart(spec.family, spec.data as any, {
            x: 0.6, y: contentStartY, w: 6.5, h: chartH,
            chartColors: [colorTheme.chart1, colorTheme.chart2, colorTheme.chart3, colorTheme.chart4, colorTheme.chart5].map(colorHex),
            barGrouping: spec.barGrouping,
            showLegend: spec.data.length > 1,
            showTitle: false,
            dataLabelColor: colorHex(colorTheme.textMuted),
          });
        } else {
          slide.addShape('rect', {
            x: 0.6, y: contentStartY, w: 6.5, h: chartH,
            fill: { color: 'F8FAFC' }, line: { color: 'E2E8F0' },
          });
          slide.addText(`📊 ${s.chart?.type || 'chart'}${s.chart?.highlight ? '\n' + s.chart.highlight : ''}`, {
            x: 0.6, y: contentStartY, w: 6.5, h: chartH,
            align: 'center', valign: 'middle', fontSize: 12, fontFace: 'Sarabun', color: colorHex(colorTheme.textMuted),
          });
        }
      }

      // Media image — non-chart_text slides whose media_suggestion resolved to
      // a real generated image (chart_text already uses this same left-column
      // slot for its chart, so skip there to avoid overlapping it).
      if (!isChartText && s.media_suggestion?.kind === 'image') {
        const resolvedMedia = resolvedImageOf(s.media_suggestion);
        if (resolvedMedia) {
          slide.addImage({
            data: `${resolvedMedia.mime};base64,${resolvedMedia.base64}`,
            x: 0.6, y: contentStartY, w: 6.5, h: 6.7 - contentStartY,
            sizing: { type: 'cover', w: 6.5, h: 6.7 - contentStartY },
          });
        }
      }

      // Data table
      if (s.data_table && s.data_table.rows?.length) {
        const tableData = [
          s.data_table.headers.map((h: string) => ({
            text: h,
            options: { bold: true, color: 'FFFFFF', fill: { color: colorHex(colorTheme.primary) }, fontFace: 'Sarabun', fontSize: 12 },
          })),
          ...s.data_table.rows.map((row: string[]) => row.map((c: string) => ({
            text: c,
            options: { fontFace: 'Sarabun', fontSize: 12, color: colorHex(colorTheme.text) },
          }))),
        ];
        slide.addTable(tableData as any, {
          x: 0.6, y: 4.0, w: 12.1, h: 2.5,
          border: { type: 'solid', pt: 0.5, color: 'D1D5DB' },
          valign: 'middle',
        });
      }

      // CTA
      if (s.call_to_action) {
        slide.addShape('rect', {
          x: 3.0, y: 6.5, w: 7.3, h: 0.7,
          fill: { color: colorHex(colorTheme.accent) }, line: { color: colorHex(colorTheme.accent) },
        });
        slide.addText(s.call_to_action, {
          x: 3.0, y: 6.5, w: 7.3, h: 0.7,
          fontSize: 18, fontFace: 'Sarabun', color: 'FFFFFF', bold: true, align: 'center', valign: 'middle',
        });
      }

      // Footer line
      slide.addShape('line', {
        x: 0.6, y: 7.0, w: 12.1, h: 0,
        line: { color: colorHex(colorTheme.textMuted), width: 0.5 },
      });
      slide.addText(`${project.title} · ${frameworkLabel}`, {
        x: 0.6, y: 7.1, w: 8, h: 0.3,
        fontSize: 9, color: colorHex(colorTheme.textMuted), fontFace: 'Sarabun',
      });
    }

    // Speaker notes
    if (note?.script) {
      slide.addNotes(note.script);
    }
  });

  // Final slide: Thank you / Q&A
  const thankYou = pptx.addSlide();
  thankYou.background = { color: colorHex(colorTheme.primary) };
  thankYou.addText('ขอบคุณครับ/ค่ะ', {
    x: 1, y: 2.5, w: 11.3, h: 1.5,
    fontSize: 60, fontFace: 'Sarabun', color: 'FFFFFF', bold: true, align: 'center', valign: 'middle',
  });
  thankYou.addText('Q&A', {
    x: 1, y: 4.2, w: 11.3, h: 0.8,
    fontSize: 32, fontFace: 'Sarabun', color: 'FFFFFF', align: 'center', valign: 'middle',
  });
  if (notes?.global_notes?.closing_line) {
    thankYou.addText(notes.global_notes.closing_line, {
      x: 1.5, y: 5.5, w: 10.3, h: 0.8,
      fontSize: 18, fontFace: 'Sarabun', color: 'FFFFFF', italic: true, align: 'center', valign: 'middle',
    });
  }

  return await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer;
}

// =====================================================
// Google Sheet Export
// Returns CSV + the "Open in Google Sheets" URL template
// =====================================================
export function buildGoogleSheetExport(data: PresentationExportData): { csv: string; googleSheetsUrl: string; rowsAdded: number } {
  // For Google Sheets, we send CSV that user imports manually OR use direct URL
  // The URL https://docs.google.com/spreadsheets/create?usp=sheets_home creates new sheet
  // The simplest reliable path: serve CSV + show button "Open in Google Sheets"
  const csv = buildPresentationCSV(data);
  const rowCount = csv.split('\n').length - 1;
  // The user can upload the CSV via File > Import in Google Sheets
  // or use https://docs.google.com/spreadsheets/create?usp=sheets_home then File > Import
  return {
    csv,
    googleSheetsUrl: 'https://docs.google.com/spreadsheets/create?usp=sheets_home',
    rowsAdded: rowCount,
  };
}
