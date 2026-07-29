/**
 * Project (wizard) export builders — HTML, Markdown, CSV, and a
 * Word-openable HTML-as-.doc file, for the 7-step playbook wizard.
 * Extracted out of index.ts (M1 refactor, 2026-07-29) — same pattern as
 * lib/presentationExport.ts for the presentation builder.
 */
import { STEPS, PROMPT_TEMPLATES } from './prompts';
import { EMBEDDED_THAI_FONT_CSS, EXPORT_FONT_STACK } from './exportFonts';


// =====================================================
// HTML Builder (for export) — Beautiful PDF-ready layout
// =====================================================

export function buildProjectHTML(project: any, stepData: any): string {
  const escape = (s: any) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeArr = (v: any): any[] => Array.isArray(v) ? v : [];
  const safeStr = (v: any) => v ? escape(v) : '—';
  const stepName = (n: number) => PROMPT_TEMPLATES[n]?.name || `Step ${n}`;
  const stepHasData = (n: number) => !!stepData[`step${n}`];

  // 🔧 Normalize: some old entries stored `{input, output}` while new ones store output directly.
  // Unwrap so renderers see flat output object.
  const normalize = (d: any): any => {
    if (!d) return d;
    if (d.output && typeof d.output === 'object') return d.output;
    return d;
  };

  // Format a date in Thai
  const thaiDate = (ts: number) => new Date(ts).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  // Render Step 1 (Brand Card)
  const renderStep1 = (d: any) => {
    if (!d) return '';
    return `
      <div class="hero-card">
        <div class="hero-label">POSITIONING</div>
        <div class="hero-text">${safeStr(d.positioning)}</div>
      </div>
      <div class="card-grid">
        <div class="card">
          <div class="card-label">UVP — Unique Value Proposition</div>
          <div class="card-text">${safeStr(d.uvp)}</div>
        </div>
        <div class="card">
          <div class="card-label">Voice & Tone</div>
          <div class="card-text">${safeStr(d.voice_tone)}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-label">Target Audience</div>
        <div class="card-text">${safeStr(d.target_audience)}</div>
      </div>
      ${d.anti_positioning ? `<div class="card warning">
        <div class="card-label">⚠️ ไม่ใช่ลูกค้าเรา</div>
        <div class="card-text">${safeStr(d.anti_positioning)}</div>
      </div>` : ''}
    `;
  };

  // Render Step 2 (Persona)
  const renderStep2 = (d: any) => {
    const personas = safeArr(d.personas);
    if (!personas.length) return `<div class="empty">ยังไม่มีข้อมูล</div>`;
    return personas.map((p: any, i: number) => `
      <div class="persona">
        <div class="persona-header">
          <div class="persona-avatar">${(p.name || '?')[0]}</div>
          <div>
            <div class="persona-name">${safeStr(p.name)}</div>
            ${p.size_estimate ? `<div class="persona-meta">≈ ${safeStr(p.size_estimate)}</div>` : ''}
          </div>
        </div>
        ${p.demographics ? `<div class="persona-section">
          <div class="persona-section-label">ข้อมูลส่วนตัว</div>
          <div class="persona-grid">
            ${p.demographics.age ? `<div><span class="lbl">อายุ</span> ${safeStr(p.demographics.age)}</div>` : ''}
            ${p.demographics.job ? `<div><span class="lbl">อาชีพ</span> ${safeStr(p.demographics.job)}</div>` : ''}
            ${p.demographics.income ? `<div><span class="lbl">รายได้</span> ${safeStr(p.demographics.income)}</div>` : ''}
            ${p.demographics.location ? `<div><span class="lbl">ที่อยู่</span> ${safeStr(p.demographics.location)}</div>` : ''}
          </div>
        </div>` : ''}
        ${p.psychographics ? `<div class="persona-section">
          <div class="persona-section-label">จิตวิทยา</div>
          <div class="persona-grid">
            ${p.psychographics.values ? `<div><span class="lbl">ค่านิยม</span> ${safeStr(p.psychographics.values)}</div>` : ''}
            ${p.psychographics.fears ? `<div><span class="lbl">กลัว</span> ${safeStr(p.psychographics.fears)}</div>` : ''}
          </div>
        </div>` : ''}
        ${p.pain_points?.length ? `<div class="persona-section">
          <div class="persona-section-label pain">😣 Pain Points</div>
          <ul class="bullet-list">${p.pain_points.map((x: string) => `<li>${safeStr(x)}</li>`).join('')}</ul>
        </div>` : ''}
        ${p.preferred_channels?.length ? `<div class="persona-section">
          <div class="persona-section-label">📱 ช่องทาง</div>
          <div class="tag-list">${p.preferred_channels.map((c: string) => `<span class="tag">${safeStr(c)}</span>`).join('')}</div>
        </div>` : ''}
        ${p.best_offer ? `<div class="best-offer">
          <div class="best-offer-label">🎯 ข้อเสนอที่ตรงใจ</div>
          <div>${safeStr(p.best_offer)}</div>
        </div>` : ''}
      </div>
    `).join('');
  };

  // Render Step 3 (Journey)
  const renderStep3 = (d: any) => {
    const journey = safeArr(d.journey);
    return `
      ${journey.map((s: any, i: number) => `
        <div class="journey-stage">
          <div class="journey-num">${i + 1}</div>
          <div class="journey-content">
            <div class="journey-header">
              <div class="journey-title">${safeStr(s.stage_name_th || s.stage)}</div>
              <div class="journey-subtitle">${safeStr(s.stage)}</div>
            </div>
            ${s.emotions ? `<div class="journey-emotion">
              <strong>อารมณ์:</strong> ${safeStr(s.emotions.primary)}
              ${s.emotions.secondary ? ` · ${safeStr(s.emotions.secondary)}` : ''}
              ${s.emotions.quote ? `<div class="quote">"${safeStr(s.emotions.quote)}"</div>` : ''}
            </div>` : ''}
            ${s.touchpoints?.length ? `<div class="tag-list">${s.touchpoints.map((t: string) => `<span class="tag">${safeStr(t)}</span>`).join('')}</div>` : ''}
            ${s.key_message ? `<div class="key-message"><strong>ข้อความหลัก:</strong> ${safeStr(s.key_message)}</div>` : ''}
            ${s.content_types?.length ? `<div class="meta-line">📝 ${s.content_types.map(safeStr).join(' · ')}</div>` : ''}
          </div>
        </div>
      `).join('')}
      ${safeArr(d.pain_points).length ? `
        <div class="card warning">
          <div class="card-label">⚠️ จุดเจ็บที่ต้องระวัง</div>
          ${d.pain_points.map((p: any) => `
            <div class="pain-item">
              <div class="pain-stage">${safeStr(p.stage)}</div>
              <div><strong>ปัญหา:</strong> ${safeStr(p.pain)}</div>
              <div><strong>วิธีแก้:</strong> ${safeStr(p.solution)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  };

  // Render Step 4 (Positioning)
  const renderStep4 = (d: any) => {
    return `
      <div class="hero-card">
        <div class="hero-label">POSITIONING STATEMENT</div>
        <div class="hero-text">${safeStr(d.positioning_statement)}</div>
      </div>
      ${d.positioning_one_liner ? `<div class="one-liner">"${safeStr(d.positioning_one_liner)}"</div>` : ''}
      ${safeArr(d.uvp_bullets).length ? `
        <div class="card">
          <div class="card-label">Value Bullets</div>
          <ul class="check-list">${d.uvp_bullets.map((b: string) => `<li>${safeStr(b)}</li>`).join('')}</ul>
        </div>
      ` : ''}
      ${safeArr(d.tagline_options).length ? `
        <div class="card">
          <div class="card-label">Tagline Options</div>
          ${d.tagline_options.map((t: string, i: number) => `<div class="tagline">#${i+1} "${safeStr(t)}"</div>`).join('')}
        </div>
      ` : ''}
      ${d.competitive_frame ? `
        <div class="card">
          <div class="card-label">vs คู่แข่ง</div>
          ${Object.entries(d.competitive_frame).map(([k, v], i) => {
            // Map vs_competitor_N → "คู่แข่งที่ N"
            const m = k.match(/vs_competitor[_]?(\d+)/i) || k.match(/competitor[_]?(\d+)/i);
            const label = m ? `คู่แข่งที่ ${m[1]}` : safeStr(k);
            return `<div class="vs-item"><span class="lbl">${label}:</span> ${safeStr(v)}</div>`;
          }).join('')}
        </div>
      ` : ''}
      ${d.elevator_pitch ? `<div class="card warning">
        <div class="card-label">⏱️ 30-Second Elevator Pitch</div>
        <div class="card-text">${safeStr(d.elevator_pitch)}</div>
      </div>` : ''}
    `;
  };

  // Render Step 5 (Content Calendar)
  const renderStep5 = (d: any) => {
    const cal = safeArr(d.calendar);
    if (!cal.length) return '<div class="empty">ยังไม่มีข้อมูล</div>';
    return `
      <div class="meta-line" style="font-weight: 600; margin-bottom: 16px;">
        📅 ${cal.length} โพสต์ · ${cal.filter((p: any) => p.pillar === 'awareness').length} awareness · ${cal.filter((p: any) => p.pillar === 'education').length} education · ${cal.filter((p: any) => p.pillar === 'social_proof').length} social proof · ${cal.filter((p: any) => p.pillar === 'conversion').length} conversion
      </div>
      <div class="calendar-grid">
        ${cal.map((p: any) => `
          <div class="calendar-item">
            <div class="cal-header">
              <span class="cal-day">Day ${p.day}</span>
              <span class="cal-pillar pillar-${p.pillar}">${p.pillar}</span>
            </div>
            <div class="cal-meta">${p.platform} · ${p.format}</div>
            <div class="cal-hook">"${safeStr(p.hook)}"</div>
            <div class="cal-caption">${safeStr(p.caption)}</div>
            <div class="cal-cta">→ ${safeStr(p.cta)}</div>
            ${p.hashtags?.length ? `<div class="cal-hashtags">${p.hashtags.map(safeStr).join(' ')}</div>` : ''}
            ${p.visual_suggestion ? `<div class="cal-visual">🎨 ${safeStr(p.visual_suggestion)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  };

  // Render Step 6 (Marketing Workflow)
  const renderStep6 = (d: any) => {
    const workflows = safeArr(d.workflows);
    return `
      ${workflows.map((wf: any) => `
        <div class="workflow">
          <div class="workflow-header">
            <div>
              <div class="workflow-name">${safeStr(wf.name)}</div>
              <div class="workflow-meta">ID: ${safeStr(wf.id)} · ${safeStr(wf.type)}</div>
            </div>
            <div class="workflow-saved">
              <div class="big-num">-${wf.time_saved_pct}%</div>
              <div class="small-lbl">เวลา</div>
            </div>
          </div>
          <div class="time-row">
            <div class="time-before">ก่อน: ${safeStr(wf.time_before)}</div>
            <div class="time-after">หลัง: ${safeStr(wf.time_after)}</div>
          </div>
          ${safeArr(wf.steps).length ? `
            <div class="steps-list">
              <div class="card-label">ขั้นตอน</div>
              ${wf.steps.map((s: any) => `
                <div class="step-item">
                  <span class="step-num">${s.step}</span>
                  <div>
                    <div class="step-action">${safeStr(s.action)}</div>
                    <div class="step-meta">⏱ ${safeStr(s.duration)} · 📦 ${safeStr(s.output)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
          ${wf.tools_used?.length ? `<div class="meta-line">🛠 <strong>เครื่องมือ:</strong> ${wf.tools_used.map(safeStr).join(', ')} (~${wf.tools_cost_monthly} บาท/เดือน)</div>` : ''}
          <div class="meta-line">📊 <strong>KPI:</strong> ${safeStr(wf.kpi)} · <strong>ความถี่:</strong> ${safeStr(wf.frequency)}</div>
        </div>
      `).join('')}
      ${d.voice_guide ? `
        <div class="voice-guide">
          <div class="card-label">🎙️ Voice Guide</div>
          <div class="voice-tone">${safeStr(d.voice_guide.tone)}</div>
          <div class="voice-grid">
            <div>
              <div class="card-label" style="color: #16a34a;">✅ ควรทำ</div>
              <ul class="bullet-list">${safeArr(d.voice_guide.do).map((x: string) => `<li>${safeStr(x)}</li>`).join('')}</ul>
            </div>
            <div>
              <div class="card-label" style="color: #dc2626;">❌ ไม่ควรทำ</div>
              <ul class="bullet-list">${safeArr(d.voice_guide.dont).map((x: string) => `<li>${safeStr(x)}</li>`).join('')}</ul>
            </div>
          </div>
          ${safeArr(d.voice_guide.sample_phrases).length ? `
            <div class="sample-phrases">
              <div class="card-label">ตัวอย่างประโยค</div>
              ${d.voice_guide.sample_phrases.map((p: string) => `<div class="sample-phrase">"${safeStr(p)}"</div>`).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}
    `;
  };

  // Render Step 7 (KPI Dashboard)
  const renderStep7 = (d: any) => {
    const kpis = safeArr(d.kpis);
    return `
      <div class="kpi-grid">
        ${kpis.map((k: any) => `
          <div class="kpi-card">
            <div class="kpi-id">${safeStr(k.id)}</div>
            <div class="kpi-name">${safeStr(k.name)}</div>
            <div class="kpi-progress">
              <div class="kpi-current">
                <div class="kpi-num">${k.current || 0}</div>
                <div class="kpi-lbl">ปัจจุบัน</div>
              </div>
              <div class="kpi-arrow">→</div>
              <div class="kpi-30d">
                <div class="kpi-num green">${k.target_30d || 0}</div>
                <div class="kpi-lbl">30 วัน</div>
              </div>
              <div class="kpi-arrow">→</div>
              <div class="kpi-90d">
                <div class="kpi-num blue">${k.target_90d || 0}</div>
                <div class="kpi-lbl">90 วัน</div>
              </div>
            </div>
            <div class="kpi-meta">
              <div><span class="lbl">หน่วย:</span> ${safeStr(k.unit)}</div>
              <div><span class="lbl">เครื่องมือ:</span> ${safeStr(k.tool)}</div>
              <div><span class="lbl">ความถี่:</span> ${safeStr(k.frequency)}</div>
              <div><span class="lbl">คนดูแล:</span> ${safeStr(k.owner)}</div>
            </div>
            ${k.action_if_below ? `<div class="kpi-action">⚠️ ถ้าต่ำกว่าเป้า: ${safeStr(k.action_if_below)}</div>` : ''}
          </div>
        `).join('')}
      </div>
      ${d.action_plan_30d ? `
        <div class="card">
          <div class="card-label">📅 Action Plan 30 วัน</div>
          ${Object.entries(d.action_plan_30d).map(([week, plan]: [string, any]) => `
            <div class="week-block">
              <div class="week-label">${week}</div>
              <div class="week-theme">${safeStr(plan.theme)}</div>
              ${plan.tasks?.length ? `<ul class="bullet-list">${plan.tasks.map((t: string) => `<li>${safeStr(t)}</li>`).join('')}</ul>` : ''}
              ${plan.outcome ? `<div class="meta-line">🎯 ${safeStr(plan.outcome)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${d.review_ritual ? `
        <div class="card warning">
          <div class="card-label">🔁 Review Ritual</div>
          ${d.review_ritual.daily ? `<div><strong>ทุกวัน:</strong> ${safeStr(d.review_ritual.daily)}</div>` : ''}
          ${d.review_ritual.weekly ? `<div><strong>ทุกสัปดาห์:</strong> ${safeStr(d.review_ritual.weekly)}</div>` : ''}
          ${d.review_ritual.monthly ? `<div><strong>ทุกเดือน:</strong> ${safeStr(d.review_ritual.monthly)}</div>` : ''}
        </div>
      ` : ''}
    `;
  };

  const renderers: Record<number, (d: any) => string> = {
    1: renderStep1, 2: renderStep2, 3: renderStep3, 4: renderStep4,
    5: renderStep5, 6: renderStep6, 7: renderStep7,
  };

  const completedSteps = STEPS.filter(n => stepHasData(n));

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>${escape(project.name)} — Marketing System</title>
<style>
  ${EMBEDDED_THAI_FONT_CSS}
  * { box-sizing: border-box; }
  :root {
    --primary: #3b82f6;
    --primary-dark: #1d4ed8;
    --primary-light: #eff6ff;
    --warning: #fef3c7;
    --warning-border: #fbbf24;
    --success: #dcfce7;
    --success-border: #22c55e;
    --danger: #fee2e2;
    --text: #0f172a;
    --text-muted: #64748b;
    --border: #e2e8f0;
  }
  body {
    font-family: ${EXPORT_FONT_STACK};
    /* A4 printable width at 96dpi is ~794px; keep content inside a safe
       column so nothing bleeds off the right edge when printed. On screen
       this also centers the document nicely. */
    max-width: 720px; margin: 0 auto; padding: 0;
    color: var(--text); line-height: 1.6;
    background: white;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  /* Overflow safety net — long Thai runs (no spaces), long URLs, wide tables
     must wrap/scroll instead of bleeding off the printable area. */
  p, li, td, th, div, span, h1, h2, h3, h4 { overflow-wrap: anywhere; word-break: break-word; }
  img, svg { max-width: 100%; height: auto; }
  table { width: 100%; table-layout: fixed; border-collapse: collapse; }
  .cover {
    height: 100vh; min-height: 700px;
    background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 50%, #60a5fa 100%);
    color: white;
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    padding: 60px 40px;
    text-align: center;
    page-break-after: always;
    position: relative;
  }
  .cover::after {
    content: 'Business Smart OS'; position: absolute; bottom: 30px;
    font-size: 14px; opacity: 0.7; letter-spacing: 2px;
  }
  .cover-badge {
    display: inline-block; padding: 6px 16px; background: rgba(255,255,255,0.2);
    border-radius: 99px; font-size: 13px; font-weight: 500;
    margin-bottom: 24px; backdrop-filter: blur(10px);
  }
  .cover h1 {
    font-size: 48px; font-weight: 800; margin: 0 0 20px; line-height: 1.2;
    max-width: 700px;
  }
  .cover-subtitle {
    font-size: 20px; opacity: 0.95; max-width: 600px; line-height: 1.5;
    margin-bottom: 40px;
  }
  .cover-meta {
    display: flex; gap: 32px; flex-wrap: wrap; justify-content: center;
    font-size: 14px; opacity: 0.9;
  }
  .cover-meta-item {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
  }
  .cover-meta-label { opacity: 0.7; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
  .cover-meta-value { font-weight: 600; font-size: 16px; }

  .toc {
    page-break-after: always;
    padding: 60px 40px;
  }
  .toc h2 {
    color: var(--primary-dark); font-size: 28px; margin: 0 0 32px;
    padding-bottom: 12px; border-bottom: 2px solid var(--primary);
  }
  .toc-item {
    display: flex; align-items: center; padding: 14px 16px;
    border-radius: 10px; margin-bottom: 8px;
    background: #f8fafc; border-left: 4px solid var(--primary);
  }
  .toc-item.pending { opacity: 0.4; border-left-color: var(--border); background: #fafafa; }
  .toc-num {
    width: 32px; height: 32px; border-radius: 50%;
    background: var(--primary); color: white;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; margin-right: 16px; font-size: 14px;
  }
  .toc-item.pending .toc-num { background: #cbd5e1; }
  .toc-name { font-weight: 600; font-size: 16px; flex: 1; }
  .toc-status { font-size: 12px; color: var(--text-muted); padding: 4px 10px; background: white; border-radius: 99px; }
  .toc-status.done { color: #16a34a; background: var(--success); }
  .toc-status.pending { color: #64748b; }

  .section {
    padding: 40px 40px 60px;
    page-break-before: always;
  }
  .section-header {
    display: flex; align-items: center; gap: 16px;
    margin-bottom: 32px; padding-bottom: 16px;
    border-bottom: 2px solid var(--primary);
  }
  .section-num {
    width: 56px; height: 56px; border-radius: 14px;
    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
    color: white; display: flex; align-items: center; justify-content: center;
    font-size: 24px; font-weight: 700;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
  }
  .section-title { font-size: 32px; font-weight: 700; color: var(--text); margin: 0; }
  .section-subtitle { font-size: 14px; color: var(--text-muted); margin-top: 4px; }

  .empty {
    text-align: center; padding: 40px; color: var(--text-muted);
    background: #f8fafc; border-radius: 12px; font-style: italic;
  }

  /* Cards */
  .hero-card {
    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
    color: white; padding: 32px; border-radius: 16px;
    margin-bottom: 24px; box-shadow: 0 8px 24px rgba(29, 78, 216, 0.15);
  }
  .hero-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; opacity: 0.85; margin-bottom: 12px; }
  .hero-text { font-size: 22px; font-weight: 600; line-height: 1.4; }
  .one-liner {
    background: white; border: 3px solid var(--primary);
    padding: 24px; border-radius: 12px; margin-bottom: 24px;
    text-align: center; font-size: 20px; font-weight: 600;
    color: var(--primary-dark);
  }
  .card {
    background: white; border: 1px solid var(--border);
    padding: 20px 24px; border-radius: 12px; margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .card.warning { background: var(--warning); border-color: var(--warning-border); border-left: 6px solid var(--warning-border); }
  .card.success { background: var(--success); border-color: var(--success-border); border-left: 6px solid var(--success-border); }
  .card-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1.5px; color: var(--primary); margin-bottom: 8px;
  }
  .card.warning .card-label { color: #b45309; }
  .card.success .card-label { color: #15803d; }
  .card-text { font-size: 15px; line-height: 1.6; color: var(--text); }
  .card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .card-grid .card { margin-bottom: 0; }

  /* Persona */
  .persona {
    background: white; border: 1px solid var(--border);
    border-radius: 16px; padding: 24px; margin-bottom: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  }
  .persona-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
  .persona-avatar {
    width: 56px; height: 56px; border-radius: 50%;
    background: linear-gradient(135deg, var(--primary), #60a5fa);
    color: white; display: flex; align-items: center; justify-content: center;
    font-size: 24px; font-weight: 700;
  }
  .persona-name { font-size: 18px; font-weight: 700; color: var(--text); }
  .persona-meta { font-size: 12px; color: var(--text-muted); }
  .persona-section { margin: 16px 0; padding-top: 16px; border-top: 1px solid var(--border); }
  .persona-section-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1px; color: var(--primary); margin-bottom: 8px;
  }
  .persona-section-label.pain { color: #dc2626; }
  .persona-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px; }
  .persona-grid > div { padding: 4px 0; }
  .persona-grid .lbl { color: var(--text-muted); margin-right: 6px; }
  .tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .tag {
    background: var(--primary-light); color: var(--primary-dark);
    padding: 4px 10px; border-radius: 99px; font-size: 12px; font-weight: 500;
  }
  .best-offer {
    background: var(--success); border-left: 6px solid var(--success-border);
    padding: 16px; border-radius: 8px; margin-top: 16px;
    font-size: 14px; line-height: 1.5;
  }
  .best-offer-label {
    font-size: 11px; font-weight: 700; color: #15803d;
    text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;
  }
  .bullet-list, .check-list { margin: 8px 0; padding-left: 20px; font-size: 14px; }
  .check-list { list-style: none; padding-left: 0; }
  .check-list li { padding: 4px 0 4px 24px; position: relative; }
  .check-list li::before { content: '✓'; color: var(--primary); font-weight: 700; position: absolute; left: 0; }

  /* Journey */
  .journey-stage { display: flex; gap: 20px; margin-bottom: 20px; page-break-inside: avoid; }
  .journey-num {
    flex-shrink: 0; width: 48px; height: 48px; border-radius: 50%;
    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
    color: white; display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 700;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
  }
  .journey-content { flex: 1; background: white; border: 1px solid var(--border); padding: 20px; border-radius: 12px; }
  .journey-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px; }
  .journey-title { font-size: 18px; font-weight: 700; color: var(--text); }
  .journey-subtitle { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
  .journey-emotion { font-size: 14px; color: var(--text-muted); margin: 8px 0; }
  .quote { font-style: italic; color: var(--text-muted); padding-left: 12px; border-left: 3px solid var(--border); margin-top: 8px; }
  .key-message { background: var(--primary-light); border-left: 4px solid var(--primary); padding: 12px 16px; border-radius: 6px; margin: 12px 0; font-size: 14px; }
  .meta-line { font-size: 13px; color: var(--text-muted); margin-top: 8px; }
  .pain-item { padding: 12px 0; border-bottom: 1px solid rgba(0,0,0,0.08); }
  .pain-item:last-child { border-bottom: none; }
  .pain-stage { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--primary); letter-spacing: 1px; margin-bottom: 4px; }

  /* Tagline */
  .tagline { padding: 10px 16px; background: #f1f5f9; border-radius: 8px; margin: 6px 0; font-style: italic; font-size: 15px; }
  .vs-item { font-size: 14px; padding: 4px 0; }
  .vs-item .lbl { color: var(--text-muted); font-family: monospace; font-size: 12px; margin-right: 8px; }

  /* Calendar */
  .calendar-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .calendar-item {
    background: white; border: 1px solid var(--border);
    padding: 14px; border-radius: 10px; page-break-inside: avoid;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .cal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .cal-day { font-size: 11px; font-weight: 700; color: var(--primary); }
  .cal-pillar { font-size: 10px; padding: 2px 8px; border-radius: 99px; font-weight: 600; text-transform: uppercase; }
  .pillar-awareness { background: #dbeafe; color: #1e40af; }
  .pillar-education { background: #f3e8ff; color: #6b21a8; }
  .pillar-social_proof { background: #dcfce7; color: #15803d; }
  .pillar-conversion { background: #fef3c7; color: #b45309; }
  .cal-meta { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .cal-hook { font-size: 14px; font-weight: 600; margin-bottom: 6px; line-height: 1.4; }
  .cal-caption { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; line-height: 1.5; white-space: pre-line; }
  .cal-cta { font-size: 12px; font-weight: 600; color: var(--primary); margin-bottom: 6px; }
  .cal-hashtags { font-size: 11px; color: var(--primary); margin-top: 6px; }
  .cal-visual { font-size: 11px; color: var(--text-muted); font-style: italic; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); }

  /* Workflow */
  .workflow {
    background: white; border: 1px solid var(--border);
    padding: 20px; border-radius: 12px; margin-bottom: 16px;
    page-break-inside: avoid;
  }
  .workflow-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .workflow-name { font-size: 17px; font-weight: 700; }
  .workflow-meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
  .workflow-saved { text-align: center; }
  .big-num { font-size: 32px; font-weight: 800; color: #16a34a; line-height: 1; }
  .small-lbl { font-size: 11px; color: var(--text-muted); }
  .time-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; }
  .time-before, .time-after { padding: 8px 12px; border-radius: 6px; text-align: center; font-size: 13px; }
  .time-before { background: var(--danger); color: #b91c1c; }
  .time-after { background: var(--success); color: #15803d; }
  .steps-list { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
  .step-item { display: flex; gap: 12px; padding: 8px 0; }
  .step-num {
    flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%;
    background: var(--primary-light); color: var(--primary);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700;
  }
  .step-action { font-size: 14px; font-weight: 500; }
  .step-meta { font-size: 11px; color: var(--text-muted); }
  .voice-guide {
    background: linear-gradient(135deg, var(--primary-light), white);
    border: 1px solid var(--primary);
    padding: 20px; border-radius: 12px; margin-top: 16px;
  }
  .voice-tone { font-size: 16px; font-weight: 600; color: var(--primary-dark); margin-bottom: 12px; }
  .voice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .sample-phrases { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--primary); }
  .sample-phrase { font-style: italic; padding: 6px 0; color: var(--text); font-size: 14px; }

  /* KPI */
  .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .kpi-card {
    background: white; border: 1px solid var(--border);
    padding: 16px; border-radius: 10px; page-break-inside: avoid;
  }
  .kpi-id { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
  .kpi-name { font-size: 14px; font-weight: 700; margin: 4px 0 12px; }
  .kpi-progress { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .kpi-current, .kpi-30d, .kpi-90d { flex: 1; text-align: center; }
  .kpi-num { font-size: 22px; font-weight: 800; color: var(--text-muted); }
  .kpi-num.green { color: #16a34a; }
  .kpi-num.blue { color: var(--primary); }
  .kpi-lbl { font-size: 10px; color: var(--text-muted); }
  .kpi-arrow { color: var(--text-muted); font-size: 14px; }
  .kpi-meta { font-size: 11px; color: var(--text-muted); }
  .kpi-meta > div { padding: 2px 0; }
  .kpi-meta .lbl { color: var(--text-muted); margin-right: 4px; }
  .kpi-action {
    margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border);
    font-size: 11px; color: #b45309;
  }
  .week-block { padding: 12px 0; border-bottom: 1px solid var(--border); }
  .week-block:last-child { border-bottom: none; }
  .week-label { font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; }
  .week-theme { font-size: 15px; font-weight: 700; margin: 4px 0; }

  .footer-page {
    page-break-before: always;
    background: linear-gradient(135deg, #1d4ed8, #3b82f6);
    color: white; min-height: 100vh;
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    text-align: center; padding: 60px 40px;
  }
  .footer-page h2 { font-size: 36px; margin-bottom: 16px; }
  .footer-page p { font-size: 18px; opacity: 0.95; max-width: 600px; line-height: 1.6; }
  .footer-brand { margin-top: 60px; font-size: 14px; opacity: 0.7; }

  /* Print styles — real A4 margins so nothing is clipped by the printer's
     unprintable edge, and page heights in mm (not 100vh, which print engines
     don't map to a physical page and which caused blank/overflowing pages). */
  @page {
    size: A4;
    margin: 15mm;
  }
  @media print {
    body { max-width: none; padding: 0; }
    /* Fill one A4 page minus the @page margins (297mm − 2×15mm ≈ 267mm). */
    .cover, .footer-page { min-height: 255mm; border-radius: 0; }
    .section { padding: 8mm 0 12mm; }
    .toc { padding: 8mm 0; }
    /* Keep headings from being orphaned at the bottom of a page. */
    h1, h2, h3 { break-after: avoid; }
  }
  @media screen {
    body { padding: 0 0 60px; }
    .cover, .footer-page { min-height: 100vh; }
  }

  /* No-print controls (for browser print) */
  .print-bar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    background: var(--primary); color: white; padding: 12px 24px;
    display: flex; align-items: center; justify-content: space-between;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  .print-bar button {
    background: white; color: var(--primary); border: none;
    padding: 8px 20px; border-radius: 6px; font-weight: 600; cursor: pointer;
  }
  .print-bar button:hover { background: #f1f5f9; }
  @media print { .print-bar { display: none; } }
  .print-bar-spacer { height: 60px; }
  @media print { .print-bar-spacer { display: none; } }
</style>
</head>
<body>
  <div class="print-bar">
    <div>📄 ${escape(project.name)} — Marketing System</div>
    <button onclick="window.print()">🖨️ Save as PDF (Cmd/Ctrl+P)</button>
  </div>
  <div class="print-bar-spacer"></div>

  <!-- COVER -->
  <div class="cover">
    <div class="cover-badge">✨ Marketing System</div>
    <h1>${escape(project.name)}</h1>
    <div class="cover-subtitle">${escape(project.industry || 'Business')} · Marketing Playbook</div>
    <div class="cover-meta">
      <div class="cover-meta-item">
        <div class="cover-meta-label">Generated</div>
        <div class="cover-meta-value">${thaiDate(project.created_at)}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Steps Completed</div>
        <div class="cover-meta-value">${completedSteps.length} / 7</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Status</div>
        <div class="cover-meta-value">${escape(project.status)}</div>
      </div>
    </div>
  </div>

  <!-- TABLE OF CONTENTS -->
  <div class="toc">
    <h2>📑 สารบัญ</h2>
    ${STEPS.map(n => {
      const done = stepHasData(n);
      const cls = done ? '' : 'pending';
      return `<div class="toc-item ${cls}">
        <div class="toc-num">${n}</div>
        <div class="toc-name">${escape(stepName(n))}</div>
        <div class="toc-status ${done ? 'done' : 'pending'}">${done ? '✓ เสร็จ' : 'ยังไม่สร้าง'}</div>
      </div>`;
    }).join('')}
  </div>

  <!-- SECTIONS -->
  ${STEPS.map(n => {
    const data = normalize(stepData[`step${n}`]);
    const content = data ? renderers[n](data) : `<div class="empty">ยังไม่ได้สร้าง — กลับไปที่ Step ${n} ใน Business Smart OS เพื่อสร้างเนื้อหา</div>`;
    return `<div class="section">
      <div class="section-header">
        <div class="section-num">${n}</div>
        <div>
          <div class="section-title">${escape(stepName(n))}</div>
          <div class="section-subtitle">Step ${n} of 7</div>
        </div>
      </div>
      ${content}
    </div>`;
  }).join('\n')}

  <!-- FOOTER PAGE -->
  <div class="footer-page">
    <h2>🚀 พร้อมใช้งานแล้ว!</h2>
    <p>คุณได้ Marketing System ครบชุด พร้อมวางแผนและลงมือทำ</p>
    <div class="footer-brand">Business Smart OS</div>
  </div>
</body>
</html>`;
}

// Multi-format Export (Markdown, JSON, CSV, HTML-as-DOCX)
// =====================================================

export function buildProjectMarkdown(project: any, stepData: any): string {
  const safeStr = (v: any) => v ? String(v).trim() : '';
  const normalize = (d: any) => d?.output || d;
  const lines: string[] = [];

  lines.push(`# ${project.name} — Marketing System`);
  lines.push('');
  lines.push(`**อุตสาหกรรม:** ${project.industry || '—'}`);
  lines.push(`**สร้างเมื่อ:** ${new Date(project.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const n of STEPS) {
    const data = normalize(stepData[`step${n}`]);
    if (!data) continue;
    const name = PROMPT_TEMPLATES[n]?.name || `Step ${n}`;
    lines.push(`## ${n}. ${name}`);
    lines.push('');

    if (n === 1) {
      lines.push(`### Positioning`);
      lines.push(safeStr(data.positioning) || '—');
      lines.push('');
      lines.push(`### UVP`);
      lines.push(safeStr(data.uvp) || '—');
      lines.push('');
      lines.push(`### Voice & Tone`);
      lines.push(safeStr(data.voice_tone) || '—');
      lines.push('');
      lines.push(`### Target Audience`);
      lines.push(safeStr(data.target_audience) || '—');
      lines.push('');
      if (data.anti_positioning) {
        lines.push(`### ไม่ใช่ลูกค้าเรา`);
        lines.push(safeStr(data.anti_positioning));
        lines.push('');
      }
    } else if (n === 2) {
      const personas = data.personas || [];
      personas.forEach((p: any, i: number) => {
        lines.push(`### Persona ${i + 1}: ${safeStr(p.name)}`);
        if (p.size_estimate) lines.push(`*≈ ${safeStr(p.size_estimate)}*`);
        lines.push('');
        if (p.demographics) {
          lines.push('**ข้อมูลส่วนตัว:**');
          Object.entries(p.demographics).forEach(([k, v]) => {
            if (v) lines.push(`- **${k}**: ${v}`);
          });
          lines.push('');
        }
        if (p.psychographics) {
          lines.push('**จิตวิทยา:**');
          Object.entries(p.psychographics).forEach(([k, v]) => {
            if (v) lines.push(`- **${k}**: ${v}`);
          });
          lines.push('');
        }
        if (p.pain_points?.length) {
          lines.push('**Pain Points:**');
          p.pain_points.forEach((x: string) => lines.push(`- ${x}`));
          lines.push('');
        }
        if (p.preferred_channels?.length) {
          lines.push(`**ช่องทาง:** ${p.preferred_channels.join(', ')}`);
          lines.push('');
        }
        if (p.best_offer) {
          lines.push(`**🎯 ข้อเสนอที่ตรงใจ:** ${p.best_offer}`);
          lines.push('');
        }
      });
    } else if (n === 3) {
      (data.journey || []).forEach((s: any, i: number) => {
        lines.push(`### Stage ${i + 1}: ${safeStr(s.stage_name_th || s.stage)}`);
        if (s.emotions) {
          lines.push(`- **อารมณ์:** ${safeStr(s.emotions.primary)} ${s.emotions.secondary ? '/ ' + safeStr(s.emotions.secondary) : ''}`);
          if (s.emotions.quote) lines.push(`> "${safeStr(s.emotions.quote)}"`);
        }
        if (s.touchpoints?.length) lines.push(`- **ช่องทาง:** ${s.touchpoints.join(', ')}`);
        if (s.key_message) lines.push(`- **ข้อความหลัก:** ${safeStr(s.key_message)}`);
        if (s.content_types?.length) lines.push(`- **Content:** ${s.content_types.join(', ')}`);
        lines.push('');
      });
    } else if (n === 4) {
      lines.push(`### Positioning Statement`);
      lines.push(safeStr(data.positioning_statement) || '—');
      lines.push('');
      if (data.positioning_one_liner) {
        lines.push(`### One-Liner`);
        lines.push(`> ${safeStr(data.positioning_one_liner)}`);
        lines.push('');
      }
      if (data.uvp_bullets?.length) {
        lines.push('### Value Bullets');
        data.uvp_bullets.forEach((b: string) => lines.push(`- ✓ ${b}`));
        lines.push('');
      }
      if (data.tagline_options?.length) {
        lines.push('### Tagline Options');
        data.tagline_options.forEach((t: string, i: number) => lines.push(`${i + 1}. "${t}"`));
        lines.push('');
      }
      if (data.competitive_frame) {
        lines.push('### vs คู่แข่ง');
        Object.entries(data.competitive_frame).forEach(([k, v], i) => {
          lines.push(`- **คู่แข่งที่ ${i + 1}:** ${v}`);
        });
        lines.push('');
      }
      if (data.elevator_pitch) {
        lines.push(`### ⏱️ 30-Second Pitch`);
        lines.push(safeStr(data.elevator_pitch));
        lines.push('');
      }
    } else if (n === 5) {
      const cal = data.calendar || [];
      lines.push(`**${cal.length} โพสต์** — ${cal.filter((p: any) => p.pillar === 'awareness').length} awareness, ${cal.filter((p: any) => p.pillar === 'education').length} education, ${cal.filter((p: any) => p.pillar === 'social_proof').length} social proof, ${cal.filter((p: any) => p.pillar === 'conversion').length} conversion`);
      lines.push('');
      cal.forEach((p: any) => {
        lines.push(`#### Day ${p.day} — ${p.pillar} (${p.platform}, ${p.format})`);
        lines.push(`**Hook:** ${safeStr(p.hook)}`);
        lines.push('');
        lines.push(safeStr(p.caption));
        lines.push('');
        lines.push(`→ **CTA:** ${safeStr(p.cta)}`);
        if (p.hashtags?.length) lines.push(`\n${p.hashtags.map((h: string) => `#${h.replace(/^#/, '')}`).join(' ')}`);
        if (p.visual_suggestion) lines.push(`\n🎨 ${safeStr(p.visual_suggestion)}`);
        lines.push('');
      });
    } else if (n === 6) {
      (data.workflows || []).forEach((wf: any) => {
        lines.push(`### ${safeStr(wf.name)} (-${wf.time_saved_pct}% เวลา)`);
        lines.push(`**${safeStr(wf.time_before)} → ${safeStr(wf.time_after)}**`);
        lines.push('');
        if (wf.steps?.length) {
          wf.steps.forEach((s: any) => {
            lines.push(`${s.step}. ${safeStr(s.action)} _(⏱ ${s.duration}, 📦 ${s.output})_`);
          });
          lines.push('');
        }
        if (wf.tools_used?.length) lines.push(`**เครื่องมือ:** ${wf.tools_used.join(', ')} (~${wf.tools_cost_monthly} บาท/เดือน)`);
        if (wf.kpi) lines.push(`**KPI:** ${safeStr(wf.kpi)} · **ความถี่:** ${safeStr(wf.frequency)}`);
        lines.push('');
      });
      if (data.voice_guide) {
        lines.push('### 🎙️ Voice Guide');
        lines.push(safeStr(data.voice_guide.tone));
        lines.push('');
        if (data.voice_guide.do?.length) {
          lines.push('**ควรทำ:**');
          data.voice_guide.do.forEach((d: string) => lines.push(`- ✅ ${d}`));
          lines.push('');
        }
        if (data.voice_guide.dont?.length) {
          lines.push('**ไม่ควรทำ:**');
          data.voice_guide.dont.forEach((d: string) => lines.push(`- ❌ ${d}`));
          lines.push('');
        }
      }
    } else if (n === 7) {
      (data.kpis || []).forEach((k: any) => {
        lines.push(`### ${safeStr(k.name)} (${k.id})`);
        lines.push(`**ปัจจุบัน:** ${k.current} → **30 วัน:** ${k.target_30d} → **90 วัน:** ${k.target_90d} ${safeStr(k.unit)}`);
        lines.push('');
        if (k.tool) lines.push(`- **เครื่องมือ:** ${safeStr(k.tool)}`);
        if (k.frequency) lines.push(`- **ความถี่:** ${safeStr(k.frequency)}`);
        if (k.owner) lines.push(`- **คนดูแล:** ${safeStr(k.owner)}`);
        if (k.action_if_below) lines.push(`- **ถ้าต่ำกว่าเป้า:** ${safeStr(k.action_if_below)}`);
        lines.push('');
      });
      if (data.action_plan_30d) {
        lines.push('### 📅 Action Plan 30 วัน');
        Object.entries(data.action_plan_30d).forEach(([week, plan]: [string, any]) => {
          lines.push(`**${week}** — ${safeStr(plan.theme)}`);
          (plan.tasks || []).forEach((t: string) => lines.push(`- ${t}`));
          if (plan.outcome) lines.push(`🎯 ${safeStr(plan.outcome)}`);
          lines.push('');
        });
      }
    }
    lines.push('---');
    lines.push('');
  }

  lines.push('*สร้างโดย Business Smart OS*');
  return lines.join('\n');
}

export function buildProjectCSV(project: any, stepData: any): string {
  const normalize = (d: any) => d?.output || d;
  const rows: string[] = [['Step', 'Field', 'Value']];

  for (const n of STEPS) {
    const data = normalize(stepData[`step${n}`]);
    if (!data) continue;
    const name = PROMPT_TEMPLATES[n]?.name || `Step ${n}`;

    if (n === 1) {
      rows.push([String(n), 'positioning', data.positioning || '']);
      rows.push([String(n), 'uvp', data.uvp || '']);
      rows.push([String(n), 'voice_tone', data.voice_tone || '']);
      rows.push([String(n), 'target_audience', data.target_audience || '']);
    } else if (n === 2) {
      (data.personas || []).forEach((p: any, i: number) => {
        rows.push([String(n), `persona_${i+1}_name`, p.name || '']);
        rows.push([String(n), `persona_${i+1}_demographics`, JSON.stringify(p.demographics || {})]);
        rows.push([String(n), `persona_${i+1}_pain_points`, (p.pain_points || []).join('; ')]);
      });
    } else if (n === 4) {
      rows.push([String(n), 'positioning_statement', data.positioning_statement || '']);
      rows.push([String(n), 'positioning_one_liner', data.positioning_one_liner || '']);
      (data.uvp_bullets || []).forEach((b: string, i: number) => rows.push([String(n), `uvp_bullet_${i+1}`, b]));
    } else if (n === 5) {
      (data.calendar || []).forEach((p: any) => {
        rows.push([String(n), `day_${p.day}`, `${p.platform}/${p.format}: ${p.hook}`]);
      });
    } else if (n === 7) {
      (data.kpis || []).forEach((k: any) => {
        rows.push([String(n), `kpi_${k.id}`, `${k.name}: ${k.current}→${k.target_30d}→${k.target_90d}`]);
      });
    }
  }

  return rows.map(r => r.map(cell => {
    const v = String(cell || '').replace(/"/g, '""');
    return `"${v}"`;
  }).join(',')).join('\n');
}


export function escapeHtmlForDoc(s: any): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Generate an HTML file that Word can open natively as a .doc
 * Word's HTML import is more limited than browser HTML, but for clean structured content it works.
 * The .doc extension is the key — Word treats it as a Word document.
 */
export function buildProjectDocx(project: any, stepData: any): string {
  // Use the same structure as the printable HTML but with Word-friendly CSS
  const safeStr = (v: any) => v ? String(v).trim() : '—';
  const normalize = (d: any) => d?.output || d;
  const sections: string[] = [];

  sections.push(`<h1 style="text-align: center; color: #1d4ed8;">${escapeHtmlForDoc(project.name)}</h1>`);
  sections.push(`<p style="text-align: center; color: #64748b;">Marketing System · ${escapeHtmlForDoc(project.industry || 'Business')}</p>`);
  sections.push(`<hr/>`);

  for (const n of STEPS) {
    const data = normalize(stepData[`step${n}`]);
    if (!data) continue;
    const name = PROMPT_TEMPLATES[n]?.name || `Step ${n}`;

    sections.push(`<h1>${n}. ${escapeHtmlForDoc(name)}</h1>`);

    if (n === 1) {
      sections.push(`<h2>Positioning</h2><p>${escapeHtmlForDoc(data.positioning)}</p>`);
      sections.push(`<h2>UVP</h2><p>${escapeHtmlForDoc(data.uvp)}</p>`);
      sections.push(`<h2>Voice & Tone</h2><p>${escapeHtmlForDoc(data.voice_tone)}</p>`);
      sections.push(`<h2>Target Audience</h2><p>${escapeHtmlForDoc(data.target_audience)}</p>`);
      if (data.anti_positioning) {
        sections.push(`<h2>ไม่ใช่ลูกค้าเรา</h2><p>${escapeHtmlForDoc(data.anti_positioning)}</p>`);
      }
    } else if (n === 2) {
      (data.personas || []).forEach((p: any, i: number) => {
        sections.push(`<h2>Persona ${i+1}: ${escapeHtmlForDoc(p.name)}</h2>`);
        if (p.demographics) {
          sections.push('<h3>ข้อมูลส่วนตัว</h3>');
          sections.push('<ul>');
          Object.entries(p.demographics).forEach(([k, v]) => {
            if (v) sections.push(`<li><b>${k}:</b> ${escapeHtmlForDoc(v)}</li>`);
          });
          sections.push('</ul>');
        }
        if (p.pain_points?.length) {
          sections.push('<h3>Pain Points</h3><ul>');
          p.pain_points.forEach((x: string) => sections.push(`<li>${escapeHtmlForDoc(x)}</li>`));
          sections.push('</ul>');
        }
        if (p.best_offer) {
          sections.push(`<p><b>🎯 ข้อเสนอที่ตรงใจ:</b> ${escapeHtmlForDoc(p.best_offer)}</p>`);
        }
      });
    } else if (n === 4) {
      sections.push(`<h2>Positioning Statement</h2><p>${escapeHtmlForDoc(data.positioning_statement)}</p>`);
      if (data.positioning_one_liner) {
        sections.push(`<h2>One-Liner</h2><p><i>${escapeHtmlForDoc(data.positioning_one_liner)}</i></p>`);
      }
      if (data.uvp_bullets?.length) {
        sections.push('<h2>Value Bullets</h2><ul>');
        data.uvp_bullets.forEach((b: string) => sections.push(`<li>✓ ${escapeHtmlForDoc(b)}</li>`));
        sections.push('</ul>');
      }
      if (data.tagline_options?.length) {
        sections.push('<h2>Tagline Options</h2><ol>');
        data.tagline_options.forEach((t: string) => sections.push(`<li><i>"${escapeHtmlForDoc(t)}"</i></li>`));
        sections.push('</ol>');
      }
    } else if (n === 5) {
      (data.calendar || []).forEach((p: any) => {
        sections.push(`<h3>Day ${p.day} — ${p.pillar} (${p.platform})</h3>`);
        sections.push(`<p><b>Hook:</b> ${escapeHtmlForDoc(p.hook)}</p>`);
        sections.push(`<p>${escapeHtmlForDoc(p.caption)}</p>`);
        sections.push(`<p><b>CTA:</b> ${escapeHtmlForDoc(p.cta)}</p>`);
      });
    } else if (n === 7) {
      sections.push('<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse;">');
      sections.push('<tr><th>KPI</th><th>ปัจจุบัน</th><th>30 วัน</th><th>90 วัน</th><th>หน่วย</th></tr>');
      (data.kpis || []).forEach((k: any) => {
        sections.push(`<tr><td>${escapeHtmlForDoc(k.name)}</td><td>${k.current}</td><td>${k.target_30d}</td><td>${k.target_90d}</td><td>${escapeHtmlForDoc(k.unit)}</td></tr>`);
      });
      sections.push('</table>');
    }
  }

  sections.push(`<hr/><p style="text-align: center; color: #94a3b8; font-size: 12px;">Business Smart OS</p>`);

  return sections.join('\n');
}

