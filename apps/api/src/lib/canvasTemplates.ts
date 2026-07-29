/**
 * Canvas Templates — One-page printable PDF canvases
 * Format: A3 Landscape, designed to print as a single page poster
 *
 * Each tool gets its own visual design:
 * - VPC: Customer Profile (left circle) + Value Map (right square) + Fit Score
 * - BMC: 9 Building Blocks in standard Strategyzer layout
 * - Pain Point: List of 5 pains with severity
 * - Persona: Full persona card
 * - Brand Voice: Voice dimensions + Do/Don't
 *
 * All templates are print-ready and auto-trigger window.print() on load.
 */

import { EMBEDDED_THAI_FONT_CSS, EXPORT_FONT_STACK } from './exportFonts';

const PRINT_CSS = `
  ${EMBEDDED_THAI_FONT_CSS}
  @page { size: A3 landscape; margin: 0.8cm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: ${EXPORT_FONT_STACK}; color: #241A14; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { padding: 0.8cm; }
  h1, h2, h3, h4, p, td, th, li, span, div { overflow-wrap: anywhere; word-break: break-word; }
  .no-print { display: none; }
  @media print {
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
  }
  .toolbar {
    position: fixed; top: 0; right: 0; padding: 8px 12px; z-index: 9999;
    background: #2A5A6B; color: white; border-radius: 0 0 0 8px;
    font-size: 13px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  .toolbar button {
    background: white; color: #2A5A6B; border: none; padding: 6px 12px;
    border-radius: 4px; font-weight: 600; cursor: pointer; margin-left: 6px;
  }
  .toolbar button:hover { background: #f0f0f0; }
`;

const AUTO_PRINT_SCRIPT = `
  <script>
    // Auto-trigger print when page loads (after small delay for fonts/images)
    window.addEventListener('load', () => {
      setTimeout(() => {
        // Only auto-print if URL has ?print=1 or if opened in popup
        const url = new URL(window.location.href);
        if (url.searchParams.get('print') === '1' || window.opener) {
          window.print();
        }
      }, 500);
    });
  </script>
`;

function escape(s: any): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getInput(input: any, ...keys: string[]): string {
  for (const k of keys) {
    if (input?.[k]) return input[k];
  }
  return '';
}

/**
 * Value Proposition Canvas (VPC) — One-page A3
 * Layout: Customer Profile (left) + Value Map (right) + Fit Score (center)
 */
export function renderVPCCanvas(title: string, input: any, output: any): string {
  const businessName = getInput(input, 'business_name', 'businessName') || title;
  const createdAt = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  const cp = output.customer_profile || {};
  const vm = output.value_map || {};
  const fa = output.fit_analysis || {};
  const segment = output.customer_segment || {};

  const jobs = (cp.jobs || []).map((j: any) => `
    <li class="job">
      <span class="badge ${escape(j.importance || 'important')}">${escape(j.importance || '')}</span>
      <span class="text">${escape(j.job || '')}</span>
    </li>
  `).join('');

  const pains = (cp.pains || []).map((p: any) => `
    <li class="pain">
      <span class="badge ${escape(p.intensity || 'high')}">${escape(p.intensity || '')}</span>
      <span class="text">${escape(p.pain || '')}</span>
    </li>
  `).join('');

  const gains = (cp.gains || []).map((g: any) => `
    <li class="gain">
      <span class="badge ${escape(g.relevance || 'high')}">${escape(g.relevance || '')}</span>
      <span class="text">${escape(g.gain || '')}</span>
    </li>
  `).join('');

  const products = (vm.products_services || []).map((p: any) => `
    <li class="product">
      <span class="badge type">${escape(p.type || '')}</span>
      <span class="title">${escape(p.name || '')}</span>
      ${p.description ? `<div class="desc">${escape(p.description)}</div>` : ''}
    </li>
  `).join('');

  const relievers = (vm.pain_relievers || []).map((r: any) => `
    <li class="reliever">
      <span class="badge ${escape(r.intensity || 'strong')}">${escape(r.intensity || '')}</span>
      <span class="badge pattern">${escape(r.pattern || '')}</span>
      <span class="text">${escape(r.reliever || '')}</span>
    </li>
  `).join('');

  const creators = (vm.gain_creators || []).map((c: any) => `
    <li class="creator">
      <span class="badge ${escape(c.strength || 'strong')}">${escape(c.strength || '')}</span>
      <span class="badge pattern">${escape(c.pattern || '')}</span>
      <span class="text">${escape(c.creator || '')}</span>
    </li>
  `).join('');

  const fitScore = fa.overall_fit_score || 0;
  const fitVerdict = fa.fit_verdict || '';
  const fitColor = fitScore >= 8 ? '#10B981' : fitScore >= 6 ? '#F59E0B' : fitScore >= 4 ? '#F97316' : '#EF4444';

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>Value Proposition Canvas — ${escape(businessName)}</title>
<style>
  ${PRINT_CSS}

  .header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 12px; padding-bottom: 8px; border-bottom: 3px solid #2A5A6B;
  }
  .header h1 { font-size: 22px; color: #2A5A6B; }
  .header .meta { font-size: 11px; color: #666; text-align: right; }
  .header .business { font-size: 14px; color: #444; font-weight: 600; }

  .canvas-grid {
    display: grid;
    grid-template-columns: 1fr 110px 1fr;
    gap: 12px;
    height: calc(100vh - 130px);
  }

  /* Customer Profile (left circle) */
  .profile {
    background: #EFF6FF;
    border: 2px solid #3B82F6;
    border-radius: 16px;
    padding: 12px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .profile h2 {
    color: #1E40AF; font-size: 16px; text-align: center;
    padding-bottom: 6px; border-bottom: 1px dashed #3B82F6;
  }
  .profile .segment {
    background: #DBEAFE; padding: 6px 10px; border-radius: 8px;
    text-align: center; font-size: 11px; color: #1E3A8A;
  }
  .profile .segment b { font-size: 12px; display: block; }
  .profile ul { list-style: none; flex: 1; }
  .profile li {
    background: white; border-radius: 6px; padding: 5px 8px;
    margin-bottom: 5px; display: flex; align-items: flex-start; gap: 6px;
    font-size: 10.5px; line-height: 1.35;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }
  .profile li .text { flex: 1; }
  .profile h3 { font-size: 12px; margin-bottom: 4px; }

  .section-block { flex: 1; display: flex; flex-direction: column; }
  .section-block h3 {
    color: #1E40AF; font-size: 12px; margin-bottom: 4px;
    padding: 2px 6px; background: #DBEAFE; border-radius: 4px;
  }

  /* Center Fit Score */
  .fit {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: white; border-radius: 16px; padding: 8px; text-align: center;
  }
  .fit-circle {
    width: 90px; height: 90px; border-radius: 50%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: white; font-weight: 700; font-size: 28px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }
  .fit-circle .score { font-size: 32px; line-height: 1; }
  .fit-circle .out-of { font-size: 12px; opacity: 0.8; }
  .fit-verdict { font-size: 11px; color: #444; margin-top: 6px; font-weight: 600; }

  /* Value Map (right square) */
  .valuemap {
    background: #FAF5FF;
    border: 2px solid #8B5CF6;
    border-radius: 16px;
    padding: 12px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .valuemap h2 {
    color: #6D28D9; font-size: 16px; text-align: center;
    padding-bottom: 6px; border-bottom: 1px dashed #8B5CF6;
  }
  .valuemap ul { list-style: none; flex: 1; }
  .valuemap li {
    background: white; border-radius: 6px; padding: 5px 8px;
    margin-bottom: 5px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px;
    font-size: 10.5px; line-height: 1.35;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }
  .valuemap li .text { flex: 1; }
  .valuemap li .title { font-weight: 600; }
  .valuemap li .desc { font-size: 10px; color: #666; margin-top: 2px; }
  .valuemap h3 { font-size: 12px; margin-bottom: 4px; color: #6D28D9; }

  .badge {
    font-size: 8.5px; padding: 1px 5px; border-radius: 8px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.2px; white-space: nowrap;
  }
  .badge.extreme, .badge.essential, .badge.strong { background: #FEE2E2; color: #991B1B; }
  .badge.high, .badge.important { background: #FEF3C7; color: #92400E; }
  .badge.medium, .badge.nice_to_have, .badge.weak { background: #DBEAFE; color: #1E40AF; }
  .badge.low { background: #D1FAE5; color: #065F46; }
  .badge.type { background: #E9D5FF; color: #6B21A8; }
  .badge.pattern { background: #FED7AA; color: #9A3412; }

  .vp-statement {
    margin-top: 8px; padding: 8px 12px; background: linear-gradient(135deg, #2A5A6B 0%, #4A7A8B 100%);
    color: white; border-radius: 8px; font-size: 11px; line-height: 1.4;
    font-style: italic; text-align: center;
  }
</style>
</head>
<body>
<div class="toolbar no-print">
  🎨 Value Proposition Canvas
  <button onclick="window.print()">🖨️ Print / Save PDF</button>
  <button onclick="window.close()">✕ ปิด</button>
</div>

<div class="header">
  <h1>💎 Value Proposition Canvas</h1>
  <div class="meta">
    <div class="business">${escape(businessName)}</div>
    <div>สร้างเมื่อ ${createdAt}</div>
  </div>
</div>

<div class="canvas-grid">
  <!-- Customer Profile (left) -->
  <div class="profile">
    <h2>👤 Customer Profile (right circle)</h2>
    ${segment.name ? `<div class="segment"><b>${escape(segment.name)}</b>${escape(segment.description || '')}</div>` : ''}
    <div class="section-block">
      <h3>🔧 Jobs (งานที่ลูกค้าต้องทำ)</h3>
      <ul>${jobs || '<li><span class="text">-</span></li>'}</ul>
    </div>
    <div class="section-block">
      <h3>😰 Pains (ความเจ็บปวด)</h3>
      <ul>${pains || '<li><span class="text">-</span></li>'}</ul>
    </div>
    <div class="section-block">
      <h3>✨ Gains (สิ่งที่อยากได้)</h3>
      <ul>${gains || '<li><span class="text">-</span></li>'}</ul>
    </div>
  </div>

  <!-- Center Fit -->
  <div class="fit">
    <div style="font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">FIT</div>
    <div class="fit-circle" style="background: ${fitColor};">
      <div class="score">${fitScore}</div>
      <div class="out-of">/10</div>
    </div>
    <div class="fit-verdict">${escape(fitVerdict)}</div>
  </div>

  <!-- Value Map (right) -->
  <div class="valuemap">
    <h2>🗺️ Value Map (left square)</h2>
    <div class="section-block">
      <h3>📦 Products & Services</h3>
      <ul>${products || '<li><span class="text">-</span></li>'}</ul>
    </div>
    <div class="section-block">
      <h3>💊 Pain Relievers</h3>
      <ul>${relievers || '<li><span class="text">-</span></li>'}</ul>
    </div>
    <div class="section-block">
      <h3>🎁 Gain Creators</h3>
      <ul>${creators || '<li><span class="text">-</span></li>'}</ul>
    </div>
  </div>
</div>

${output.value_proposition_statement ? `
<div class="vp-statement">
  💎 ${escape(output.value_proposition_statement)}
</div>
` : ''}

${AUTO_PRINT_SCRIPT}
</body>
</html>`;
}

/**
 * Business Model Canvas (BMC) — One-page A3
 * Standard Strategyzer layout:
 *   Top:    [KP] [KA+KR] [VP] [CR+CH] [CS]
 *   Bottom: [Cost Structure] [Revenue Streams]
 */
export function renderBMCCanvas(title: string, input: any, output: any): string {
  const businessName = getInput(input, 'business_name', 'businessName') || title;
  const createdAt = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  const cs = output.customer_segments || [];
  const vps = output.value_propositions || [];
  const channels = output.channels || [];
  const relationships = output.customer_relationships || [];
  const revenues = output.revenue_streams || [];
  const resources = output.key_resources || [];
  const activities = output.key_activities || [];
  const partnerships = output.key_partnerships || [];
  const costs = output.cost_structure || {};
  const pattern = output.business_model_pattern || '';
  const swot = output.swot_summary || {};

  const renderList = (arr: any[], className: string, limit = 5) => arr.slice(0, limit).map((item: any) => {
    if (className === 'cs') {
      return `<li><span class="text"><b>${escape(item.name || '')}</b><br><span class="sub">${escape(item.description || '')}</span></span></li>`;
    }
    if (className === 'vp') {
      return `<li><span class="text"><b>${escape(item.vp_title || item.name || '')}</b><br><span class="sub">${escape(item.vp_statement || item.description || '')}</span></span></li>`;
    }
    if (className === 'cr') {
      // CR: show segment + type + example
      return `<li><span class="text"><b>${escape(item.segment || '')}</b> [${escape(item.type || '')}]<br><span class="sub">${escape(item.example || '')}</span></span></li>`;
    }
    if (className === 'ch') {
      // CH: show channel_name + phase + notes
      return `<li><span class="text"><b>${escape(item.channel_name || '')}</b> [${escape(item.phase || '')}]<br><span class="sub">${escape(item.notes || '')}</span></span></li>`;
    }
    if (className === 'kp') {
      // KP: show partner_type + type + value_exchange
      return `<li><span class="text"><b>${escape(item.partner_type || '')}</b><br><span class="sub">${escape(item.value_exchange || '')}</span></span></li>`;
    }
    if (className === 'ka' || className === 'kr') {
      return `<li><span class="text">${escape(item.description || '')}</span></li>`;
    }
    if (className === 'rev') {
      return `<li><span class="text"><b>${escape(item.description || '')}</b><br><span class="sub">${escape(item.price_range || '')} · ${escape(item.estimated_share || '')}</span></span></li>`;
    }
    return `<li><span class="text">${escape(item.description || item.name || '')}</span></li>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>Business Model Canvas — ${escape(businessName)}</title>
<style>
  ${PRINT_CSS}

  body { padding: 0.6cm; }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 8px; padding-bottom: 6px; border-bottom: 3px solid #4F46E5;
  }
  .header h1 { font-size: 20px; color: #4F46E5; }
  .header .meta { font-size: 10.5px; color: #666; text-align: right; }
  .header .business { font-size: 13px; color: #444; font-weight: 600; }
  .header .pattern {
    display: inline-block; margin-top: 2px; padding: 2px 8px;
    background: linear-gradient(90deg, #4F46E5, #7C3AED);
    color: white; border-radius: 8px; font-size: 10px; font-weight: 600;
  }

  .bmc-grid {
    display: grid;
    grid-template-columns: 0.7fr 0.8fr 1.2fr 0.8fr 0.7fr;
    grid-template-rows: 1fr 1fr auto;
    gap: 6px;
    height: auto;
  }
  .bottom-row {
    grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
  }

  .block {
    border-radius: 6px; padding: 6px 8px; display: flex; flex-direction: column;
    overflow: hidden;
  }
  .block h2 {
    font-size: 11px; margin-bottom: 4px; padding: 2px 6px;
    border-radius: 3px; text-align: center; text-transform: uppercase;
    letter-spacing: 0.3px; font-weight: 700;
  }
  .block ul {
    list-style: none; flex: 1; overflow: hidden;
  }
  .block li {
    font-size: 9px; line-height: 1.3; padding: 2px 0;
    border-bottom: 1px dotted rgba(0,0,0,0.1);
  }
  .block li:last-child { border-bottom: none; }
  .block li .sub { font-size: 8.5px; color: #555; font-style: italic; }

  /* Color blocks per Osterwalder coloring */
  .kp { background: #FCE7F3; border: 1.5px solid #EC4899; grid-column: 1; grid-row: 1; }
  .kp h2 { background: #EC4899; color: white; }
  .ka { background: #FFEDD5; border: 1.5px solid #F97316; grid-column: 2; grid-row: 1; }
  .ka h2 { background: #F97316; color: white; }
  .vp { background: #EDE9FE; border: 1.5px solid #8B5CF6; grid-column: 3; grid-row: 1; }
  .vp h2 { background: #8B5CF6; color: white; }
  .cr { background: #CFFAFE; border: 1.5px solid #06B6D4; grid-column: 4; grid-row: 1; }
  .cr h2 { background: #06B6D4; color: white; }
  .cs { background: #DBEAFE; border: 1.5px solid #3B82F6; grid-column: 5; grid-row: 1; }
  .cs h2 { background: #3B82F6; color: white; }
  .kr { background: #FEF3C7; border: 1.5px solid #F59E0B; grid-column: 2; grid-row: 2; }
  .kr h2 { background: #F59E0B; color: white; }
  .ch { background: #CCFBF1; border: 1.5px solid #14B8A6; grid-column: 4; grid-row: 2; }
  .ch h2 { background: #14B8A6; color: white; }

  .cost {
    background: #FEE2E2; border: 1.5px solid #EF4444;
    padding: 6px 8px; border-radius: 6px; display: flex; flex-direction: column;
  }
  .cost h2 {
    background: #EF4444; color: white; font-size: 11px; padding: 2px 6px;
    border-radius: 3px; text-align: center; margin-bottom: 4px;
  }
  .cost-content { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; flex: 1; }
  .cost-section { background: white; border-radius: 4px; padding: 4px 6px; }
  .cost-section h3 { font-size: 9px; color: #991B1B; margin-bottom: 2px; }
  .cost-section li { font-size: 8.5px; }

  .rev {
    background: #D1FAE5; border: 1.5px solid #10B981;
    padding: 6px 8px; border-radius: 6px;
  }
  .rev h2 {
    background: #10B981; color: white; font-size: 11px; padding: 2px 6px;
    border-radius: 3px; text-align: center; margin-bottom: 4px;
  }

  .insight {
    margin-top: 8px; padding: 6px 12px;
    background: linear-gradient(90deg, #4F46E5 0%, #7C3AED 100%);
    color: white; border-radius: 6px;
    font-size: 10px; line-height: 1.3; font-style: italic;
    display: flex; align-items: center; gap: 8px;
  }
  .insight b { font-style: normal; }

  /* Print: ensure no overflow */
  @media print {
    body { padding: 0.4cm; }
    .bmc-grid { height: auto; min-height: 0; }
  }
</style>
</head>
<body>
<div class="toolbar no-print">
  📊 Business Model Canvas
  <button onclick="window.print()">🖨️ Print / Save PDF</button>
  <button onclick="window.close()">✕ ปิด</button>
</div>

<div class="header">
  <div>
    <h1>📊 Business Model Canvas</h1>
    ${pattern ? `<div class="pattern">🏷️ ${escape(pattern)}</div>` : ''}
  </div>
  <div class="meta">
    <div class="business">${escape(businessName)}</div>
    <div>สร้างเมื่อ ${createdAt}</div>
  </div>
</div>

<div class="bmc-grid">
  <div class="block kp">
    <h2>🤝 Key Partnerships</h2>
    <ul>${renderList(partnerships, 'kp') || '<li>-</li>'}</ul>
  </div>
  <div class="block ka">
    <h2>⚙️ Key Activities</h2>
    <ul>${renderList(activities, 'ka') || '<li>-</li>'}</ul>
  </div>
  <div class="block vp">
    <h2>💎 Value Propositions</h2>
    <ul>${renderList(vps, 'vp') || '<li>-</li>'}</ul>
  </div>
  <div class="block cr">
    <h2>🤝 Customer Relationships</h2>
    <ul>${renderList(relationships, 'cr') || '<li>-</li>'}</ul>
  </div>
  <div class="block cs">
    <h2>👥 Customer Segments</h2>
    <ul>${renderList(cs, 'cs') || '<li>-</li>'}</ul>
  </div>

  <div class="block kr" style="grid-column: 2; grid-row: 2;">
    <h2>🔧 Key Resources</h2>
    <ul>${renderList(resources, 'kr') || '<li>-</li>'}</ul>
  </div>
  <div class="block ch" style="grid-column: 4; grid-row: 2;">
    <h2>📡 Channels</h2>
    <ul>${renderList(channels, 'ch') || '<li>-</li>'}</ul>
  </div>

  <div class="bottom-row" style="grid-row: 3;">
    <div class="cost">
      <h2>📊 Cost Structure</h2>
      <div class="cost-content">
        <div class="cost-section">
          <h3>Fixed</h3>
          <ul>${(costs.major_fixed_costs || []).slice(0, 3).map((c: any) => `<li>${escape(c.description || '')}</li>`).join('') || '<li>-</li>'}</ul>
        </div>
        <div class="cost-section">
          <h3>Variable</h3>
          <ul>${(costs.major_variable_costs || []).slice(0, 3).map((c: any) => `<li>${escape(c.description || '')}</li>`).join('') || '<li>-</li>'}</ul>
        </div>
      </div>
    </div>
    <div class="rev">
      <h2>💰 Revenue Streams</h2>
      <ul>${renderList(revenues, 'rev') || '<li>-</li>'}</ul>
    </div>
  </div>
</div>

${output.executive_insight ? `
<div class="insight">
  <b>💡 Insight:</b> ${escape(output.executive_insight)}
</div>
` : ''}

${AUTO_PRINT_SCRIPT}
</body>
</html>`;
}

/**
 * Million Dollar Offer Canvas — One-page A3
 * Layout: Offer Name (hero) + Value Equation + Value Stack + Pricing + Guarantee + Scarcity
 */
export function renderOfferCanvas(title: string, input: any, output: any): string {
  const businessName = getInput(input, 'business_name', 'businessName') || title;
  const createdAt = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  const ve = output.value_equation_audit || {};
  const dr = output.dream_outcome || {};
  const stack = output.value_stack || [];
  const pr = output.pricing || {};
  const g = output.guarantee || {};
  const su = output.scarcity_urgency || {};
  const n = output.offer_name || {};
  const tr = output.trim_stack_summary || {};

  const leverScoreColor = (s: number) => s >= 8 ? '#10B981' : s >= 6 ? '#F59E0B' : s >= 4 ? '#F97316' : '#EF4444';

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>Million Dollar Offer — ${escape(businessName)}</title>
<style>
  ${PRINT_CSS}

  body { padding: 0.6cm; }
  .header {
    background: linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #92400E 100%);
    color: white; padding: 14px 18px; border-radius: 12px;
    margin-bottom: 10px; box-shadow: 0 4px 12px rgba(245,158,11,0.3);
  }
  .header .label { font-size: 10px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px; }
  .header h1 { font-size: 26px; font-weight: 800; margin: 4px 0 6px; line-height: 1.15; }
  .header .meta { font-size: 10px; opacity: 0.85; }
  .header .magic {
    display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap;
  }
  .header .magic span {
    background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 10px;
    font-size: 9px; font-weight: 600;
  }
  .header .magic span b { color: #FEF3C7; }

  .grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;
  }
  .grid-3 {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;
  }

  .block {
    border-radius: 8px; padding: 8px 10px; border: 1.5px solid;
  }
  .block h2 {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;
    margin-bottom: 6px; display: flex; align-items: center; gap: 4px;
  }
  .block ul { list-style: none; }
  .block li { font-size: 9.5px; line-height: 1.35; margin-bottom: 3px; }

  /* Value Equation */
  .ve { background: #FEF3C7; border-color: #F59E0B; }
  .ve h2 { color: #92400E; }
  .levers { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-bottom: 6px; }
  .lever {
    background: white; border-radius: 6px; padding: 5px; text-align: center;
  }
  .lever .name { font-size: 9px; color: #666; }
  .lever .score {
    display: inline-block; padding: 1px 6px; border-radius: 10px;
    color: white; font-weight: 700; font-size: 12px; margin: 2px 0;
  }
  .lever .dir { font-size: 8px; color: #666; }
  .binding {
    background: #FEE2E2; border-left: 3px solid #EF4444; padding: 4px 8px;
    border-radius: 3px; font-size: 9px; color: #991B1B;
  }

  /* What makes it unbeatable */
  .unbeatable {
    background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
    border-color: #D97706; padding: 10px 12px;
  }
  .unbeatable h2 { color: #92400E; }
  .unbeatable .quote {
    font-style: italic; font-size: 11px; color: #78350F; line-height: 1.4;
    background: rgba(255,255,255,0.4); padding: 6px 8px; border-radius: 4px;
  }

  /* Value Stack */
  .stack { background: #FEF3C7; border-color: #F59E0B; }
  .stack h2 { color: #92400E; }
  .stack .item {
    background: white; border-radius: 4px; padding: 4px 6px; margin-bottom: 4px;
    display: flex; align-items: center; gap: 4px;
  }
  .stack .item.core { border-left: 3px solid #F59E0B; background: #FFFBEB; }
  .stack .item.bonus { border-left: 3px solid #FED7AA; }
  .stack .item .tag {
    font-size: 8px; padding: 1px 4px; border-radius: 6px; font-weight: 700; flex-shrink: 0;
  }
  .stack .item .tag.core { background: #F59E0B; color: white; }
  .stack .item .tag.bonus { background: #FED7AA; color: #9A3412; }
  .stack .item .name { font-weight: 600; font-size: 9.5px; color: #78350F; flex: 1; }
  .stack .item .value { font-weight: 700; font-size: 10px; color: #B45309; }

  /* Pricing */
  .pricing { background: #D1FAE5; border-color: #10B981; }
  .pricing h2 { color: #065F46; }
  .price-display {
    background: white; border-radius: 6px; padding: 8px; text-align: center;
    margin-bottom: 6px;
  }
  .price-display .recommended {
    font-size: 24px; font-weight: 800; color: #047857; line-height: 1;
  }
  .price-display .ratio {
    display: inline-block; background: #10B981; color: white;
    padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 700;
    margin-top: 3px;
  }
  .price-display .anchor {
    font-size: 9px; color: #666; margin-top: 3px; text-decoration: line-through;
  }
  .payment { font-size: 9px; color: #047857; }
  .payment div { background: white; padding: 2px 5px; border-radius: 3px; margin-bottom: 2px; }

  /* Guarantee */
  .guarantee { background: #DBEAFE; border-color: #3B82F6; }
  .guarantee h2 { color: #1E3A8A; }
  .guarantee .name {
    background: white; border-radius: 4px; padding: 4px 6px;
    font-weight: 700; font-size: 10px; color: #1E3A8A; margin-bottom: 4px;
  }
  .guarantee .terms { font-size: 9px; color: #1E40AF; line-height: 1.35; }
  .guarantee .meta { font-size: 8.5px; color: #3B82F6; margin-top: 3px; }

  /* Scarcity */
  .scarcity { background: #FFEDD5; border-color: #F97316; }
  .scarcity h2 { color: #9A3412; }
  .scarcity div { font-size: 9px; color: #7C2D12; margin-bottom: 3px; }
  .scarcity .ethical {
    display: inline-block; background: #D1FAE5; color: #065F46;
    padding: 1px 6px; border-radius: 6px; font-size: 8px; font-weight: 600;
    margin-top: 3px;
  }

  /* Total perceived value */
  .tally {
    background: linear-gradient(135deg, #92400E 0%, #78350F 100%);
    color: white; padding: 6px 10px; border-radius: 6px; text-align: center;
    margin-top: 4px; font-size: 10px;
  }
  .tally b { font-size: 13px; }
</style>
</head>
<body>
<div class="toolbar no-print">
  💎 Million Dollar Offer
  <button onclick="window.print()">🖨️ Print / Save PDF</button>
  <button onclick="window.close()">✕ ปิด</button>
</div>

<div class="header">
  <div class="label">🏷️ Offer Name (MAGIC)</div>
  <h1>"${escape(n.full_name || '-')}"</h1>
  <div class="magic">
    <span><b>M</b>agnet: ${escape(n.magnet || '-')}</span>
    <span><b>A</b>vatar: ${escape(n.avatar || '-')}</span>
    <span><b>G</b>oal: ${escape(n.goal || '-')}</span>
    <span><b>I</b>nterval: ${escape(n.interval || '-')}</span>
    <span><b>C</b>ontainer: ${escape(n.container || '-')}</span>
  </div>
  <div class="meta" style="margin-top: 4px;">${escape(businessName)} · ${createdAt}</div>
</div>

<div class="grid">
  <!-- Value Equation -->
  <div class="block ve">
    <h2>⚖️ Value Equation</h2>
    <div class="levers">
      <div class="lever">
        <div class="name">🎯 Dream Outcome</div>
        <div class="score" style="background: ${leverScoreColor(ve.dream_outcome?.score || 0)}">${ve.dream_outcome?.score || '-'}/10</div>
        <div class="dir">↑ เพิ่ม</div>
      </div>
      <div class="lever">
        <div class="name">💪 Perceived Likelihood</div>
        <div class="score" style="background: ${leverScoreColor(ve.perceived_likelihood?.score || 0)}">${ve.perceived_likelihood?.score || '-'}/10</div>
        <div class="dir">↑ เพิ่ม</div>
      </div>
      <div class="lever">
        <div class="name">⏱️ Time Delay</div>
        <div class="score" style="background: ${leverScoreColor(ve.time_delay?.score || 0)}">${ve.time_delay?.score || '-'}/10</div>
        <div class="dir">↓ ลด</div>
      </div>
      <div class="lever">
        <div class="name">💪 Effort & Sacrifice</div>
        <div class="score" style="background: ${leverScoreColor(ve.effort_sacrifice?.score || 0)}">${ve.effort_sacrifice?.score || '-'}/10</div>
        <div class="dir">↓ ลด</div>
      </div>
    </div>
    ${ve.binding_constraint ? `<div class="binding"><b>⚠️ Binding:</b> ${escape(ve.binding_constraint)}</div>` : ''}
  </div>

  <!-- What makes it unbeatable -->
  <div class="block unbeatable">
    <h2>💎 ทำไมปฏิเสธไม่ลง</h2>
    <div class="quote">"${escape(output.what_makes_it_unbeatable || '-')}"</div>
    ${dr.specific_description ? `<div style="font-size: 9.5px; color: #78350F; margin-top: 6px;"><b>🎯 Dream:</b> ${escape(dr.specific_description)}</div>` : ''}
  </div>
</div>

<div class="grid">
  <!-- Value Stack -->
  <div class="block stack">
    <h2>📚 Value Stack (${stack.length})</h2>
    <div>
      ${stack.map((v: any) => `
        <div class="item ${v.is_core ? 'core' : 'bonus'}">
          <span class="tag ${v.is_core ? 'core' : 'bonus'}">${v.is_core ? '⭐' : '🎁'}</span>
          <span class="name">${escape(v.name || '')}</span>
          <span class="value">${escape(v.perceived_value || '')}</span>
        </div>
      `).join('')}
    </div>
    ${tr.total_perceived_value ? `<div class="tally">Total Perceived Value: <b>${escape(tr.total_perceived_value)}</b></div>` : ''}
  </div>

  <!-- Pricing + Payment -->
  <div class="block pricing">
    <h2>💰 Pricing & Guarantee</h2>
    <div class="price-display">
      <div class="recommended">${escape(pr.recommended_price || '-')}</div>
      <div class="ratio">Ratio: ${escape(pr.value_to_price_ratio || '?')}</div>
      ${pr.anchor_price ? `<div class="anchor">vs Anchor: ${escape(pr.anchor_price)}</div>` : ''}
    </div>
    ${pr.payment_options?.length ? `
      <div class="payment">
        ${pr.payment_options.map((o: any) => `<div><b>${escape(o.structure)}:</b> ${escape(o.amount || '')}</div>`).join('')}
      </div>
    ` : ''}
    ${g.name ? `
      <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #10B981;">
        <div style="font-size: 9px; color: #047857; font-weight: 700; margin-bottom: 3px;">🛡️ ${escape(g.type?.toUpperCase() || '')}</div>
        <div class="name" style="background: #DBEAFE; color: #1E3A8A; padding: 4px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">"${escape(g.name)}"</div>
        <div class="terms" style="color: #1E40AF; font-size: 8.5px; line-height: 1.3; margin-top: 2px;">${escape(g.terms || '')}</div>
        <div class="meta" style="color: #3B82F6; font-size: 8px; margin-top: 2px;">⏱️ ${escape(g.duration || '-')} · Risk: ${escape(g.risk_to_us || '-')}</div>
      </div>
    ` : ''}
  </div>
</div>

<div class="grid-3" style="grid-template-columns: 1fr 1fr 1fr;">
  <!-- Scarcity -->
  <div class="block scarcity">
    <h2>⏰ Scarcity & Urgency</h2>
    <div><b>Scarcity:</b> ${escape(su.scarcity_type || '-')}</div>
    <div>${escape(su.scarcity_details || '-')}</div>
    <div style="margin-top: 4px;"><b>Urgency:</b> ${escape(su.urgency_type || '-')}</div>
    <div>${escape(su.urgency_details || '-')}</div>
    ${su.is_ethical ? `<div class="ethical">✅ Ethical — ${escape(su.ethical_note || 'จริง')}</div>` : ''}
  </div>

  <!-- Pricing rationale -->
  <div class="block pricing" style="background: #ECFDF5;">
    <h2>💡 ทำไมราคานี้ Make Sense</h2>
    <div style="font-size: 9.5px; color: #064E3B; line-height: 1.4;">${escape(pr.pricing_rationale || '-')}</div>
  </div>

  <!-- Next Steps -->
  <div class="block" style="background: #F0FDF4; border-color: #10B981;">
    <h2 style="color: #065F46;">➡️ Next Steps</h2>
    <ul style="font-size: 9.5px; color: #064E3B; line-height: 1.4;">
      ${(output.next_steps || []).map((s: string) => `<li>→ ${escape(s)}</li>`).join('')}
    </ul>
  </div>
</div>

${AUTO_PRINT_SCRIPT}
</body>
</html>`;
}

/**
 * Route a tool save to its canvas renderer
 */
/**
 * Objection Handler Canvas — Sales Defense Playbook Poster
 * 7 Objection Categories + LAER scripts in a single A3 page
 */
export function renderObjectionCanvas(title: string, input: any, output: any): string {
  const businessName = getInput(input, 'business_name', 'businessName') || title;
  const createdAt = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  const objections = output.objections || [];
  const cats = output.objection_categories_covered || [];
  const faqs = output.faq_top_5 || [];
  const dd = output.do_dont || {};
  const dos = dd.do || [];
  const donts = dd.dont || [];

  // Category colors
  const catColor = (c: string) => {
    const m: Record<string, string> = {
      price: '#EF4444', trust: '#F59E0B', need: '#8B5CF6', time: '#3B82F6',
      authority: '#10B981', comparison: '#EC4899', risk: '#F97316',
    };
    return m[c] || '#6B7280';
  };

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>Objection Handler — ${escape(businessName)}</title>
<style>
  ${PRINT_CSS}
  body { padding: 0.6cm; }
  .header {
    background: linear-gradient(135deg, #F43F5E 0%, #BE123C 50%, #881337 100%);
    color: white; padding: 14px 18px; border-radius: 12px;
    margin-bottom: 10px; box-shadow: 0 4px 12px rgba(244,63,94,0.3);
  }
  .header .label { font-size: 10px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px; }
  .header h1 { font-size: 24px; font-weight: 800; margin: 4px 0 6px; line-height: 1.2; }
  .header .meta { font-size: 10px; opacity: 0.85; }
  .header .cats { display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap; }
  .header .cats span {
    background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 10px;
    font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;
  }
  .stats {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px;
  }
  .stat {
    background: #FFF1F2; border: 1.5px solid #F43F5E; border-radius: 8px;
    padding: 6px 8px; text-align: center;
  }
  .stat .num { font-size: 20px; font-weight: 800; color: #BE123C; line-height: 1; }
  .stat .lbl { font-size: 9px; color: #881337; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.3px; }

  .grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;
  }
  .block {
    border-radius: 8px; padding: 8px 10px; border: 1.5px solid;
  }
  .block h2 {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;
    margin-bottom: 5px; display: flex; align-items: center; gap: 4px;
  }
  .block ul { list-style: none; }
  .block li { font-size: 9px; line-height: 1.3; margin-bottom: 2px; }

  .obj-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
  }
  .obj {
    background: white; border: 1.5px solid #FECDD3; border-radius: 6px;
    padding: 6px 8px; page-break-inside: avoid;
  }
  .obj-head {
    display: flex; align-items: center; gap: 4px; margin-bottom: 3px;
    padding-bottom: 3px; border-bottom: 1px solid #FFE4E6;
  }
  .obj-badge {
    font-size: 7.5px; padding: 1px 5px; border-radius: 8px;
    color: white; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;
  }
  .obj-title { font-size: 10.5px; font-weight: 700; color: #881337; flex: 1; line-height: 1.2; }
  .obj-field { font-size: 8.5px; line-height: 1.3; margin-bottom: 2px; }
  .obj-label { font-weight: 700; color: #BE123C; }
  .obj-script {
    background: #FEF2F2; border-left: 3px solid #F43F5E; padding: 4px 6px;
    border-radius: 3px; font-style: italic; color: #881337; font-size: 9px;
    line-height: 1.35; margin-top: 3px;
  }
  .obj-bridge {
    background: linear-gradient(135deg, #F43F5E 0%, #BE123C 100%);
    color: white; padding: 3px 6px; border-radius: 3px;
    font-size: 9px; font-weight: 600; margin-top: 3px; line-height: 1.3;
  }

  /* Do/Don't */
  .do-block { background: #ECFDF5; border-color: #10B981; }
  .do-block h2 { color: #065F46; }
  .do-block li { color: #064E3B; padding-left: 12px; position: relative; }
  .do-block li:before { content: "✓"; position: absolute; left: 0; color: #10B981; font-weight: 700; }
  .dont-block { background: #FEF2F2; border-color: #EF4444; }
  .dont-block h2 { color: #991B1B; }
  .dont-block li { color: #7F1D1D; padding-left: 12px; position: relative; }
  .dont-block li:before { content: "✗"; position: absolute; left: 0; color: #EF4444; font-weight: 700; }

  /* FAQ */
  .faq-block { background: #FFFBEB; border-color: #F59E0B; }
  .faq-block h2 { color: #92400E; }
  .faq-item { font-size: 8.5px; line-height: 1.3; margin-bottom: 3px; padding-left: 18px; position: relative; }
  .faq-item:before {
    content: "Q"; position: absolute; left: 0; top: 0;
    background: #F59E0B; color: white; font-weight: 700; font-size: 8px;
    width: 14px; height: 14px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
  }
  .faq-q { font-weight: 700; color: #78350F; }
  .faq-a { color: #92400E; font-style: italic; margin-top: 1px; }

  /* Next steps */
  .next-block { background: #EFF6FF; border-color: #3B82F6; }
  .next-block h2 { color: #1E3A8A; }
  .next-block li { color: #1E40AF; padding-left: 14px; position: relative; }
  .next-block li:before { content: "→"; position: absolute; left: 0; color: #3B82F6; font-weight: 700; }
</style>
</head>
<body>
<div class="toolbar no-print">
  🛡️ Objection Handler
  <button onclick="window.print()">🖨️ Print / Save PDF</button>
  <button onclick="window.close()">✕ ปิด</button>
</div>

<div class="header">
  <div class="label">🛡️ Sales Defense Playbook (LAER Framework)</div>
  <h1>${escape(businessName)} — ${objections.length} Objections Handled</h1>
  <div class="cats">
    ${cats.map((c: string) => `<span style="background: ${catColor(c)}; color: white;">${escape(c)}</span>`).join('')}
  </div>
  <div class="meta" style="margin-top: 4px;">${createdAt} · Framework: Listen → Acknowledge → Explore → Respond</div>
</div>

<div class="stats">
  <div class="stat"><div class="num">${objections.length}</div><div class="lbl">Objections</div></div>
  <div class="stat"><div class="num">${cats.length}</div><div class="lbl">Categories</div></div>
  <div class="stat"><div class="num">${faqs.length}</div><div class="lbl">FAQ</div></div>
  <div class="stat"><div class="num">${dos.length + donts.length}</div><div class="lbl">Do/Don't</div></div>
</div>

<div class="block" style="background: #FFF1F2; border-color: #F43F5E; margin-bottom: 10px;">
  <h2 style="color: #BE123C;">📋 Summary</h2>
  <div style="font-size: 9.5px; color: #881337; line-height: 1.4;">${escape(output.summary || '')}</div>
</div>

<div class="obj-grid">
  ${objections.slice(0, 6).map((o: any) => `
    <div class="obj">
      <div class="obj-head">
        <span class="obj-badge" style="background: ${catColor(o.category)}">${escape(o.category)}</span>
        <span class="obj-title">${escape(o.objection)}</span>
      </div>
      <div class="obj-field"><span class="obj-label">🗣️ Customer:</span> "${escape(o.what_customer_says || '')}"</div>
      <div class="obj-field"><span class="obj-label">🧠 Why:</span> ${escape(o.why_they_say_it || '')}</div>
      <div class="obj-field"><span class="obj-label">🎯 Reframe:</span> ${escape(o.reframe_strategy || '')}</div>
      <div class="obj-script">💬 "${escape(o.response_script || '')}"</div>
      ${o.bridge_to_close ? `<div class="obj-bridge">🌉 ${escape(o.bridge_to_close)}</div>` : ''}
    </div>
  `).join('')}
</div>

${objections.length > 6 ? `
<div class="obj-grid" style="margin-top: 6px;">
  ${objections.slice(6).map((o: any) => `
    <div class="obj">
      <div class="obj-head">
        <span class="obj-badge" style="background: ${catColor(o.category)}">${escape(o.category)}</span>
        <span class="obj-title">${escape(o.objection)}</span>
      </div>
      <div class="obj-field"><span class="obj-label">🗣️ Customer:</span> "${escape(o.what_customer_says || '')}"</div>
      <div class="obj-field"><span class="obj-label">🎯 Reframe:</span> ${escape(o.reframe_strategy || '')}</div>
      <div class="obj-script">💬 "${escape(o.response_script || '')}"</div>
      ${o.bridge_to_close ? `<div class="obj-bridge">🌉 ${escape(o.bridge_to_close)}</div>` : ''}
    </div>
  `).join('')}
</div>
` : ''}

<div class="grid" style="margin-top: 8px;">
  <div class="block do-block">
    <h2>✅ Do This (${dos.length})</h2>
    <ul>
      ${dos.map((d: string) => `<li>${escape(d)}</li>`).join('')}
    </ul>
  </div>
  <div class="block dont-block">
    <h2>❌ Don't Do This (${donts.length})</h2>
    <ul>
      ${donts.map((d: string) => `<li>${escape(d)}</li>`).join('')}
    </ul>
  </div>
</div>

<div class="grid" style="grid-template-columns: 2fr 1fr;">
  <div class="block faq-block">
    <h2>❓ FAQ Top ${faqs.length}</h2>
    ${faqs.map((f: any) => `
      <div class="faq-item">
        <div class="faq-q">${escape(typeof f === 'string' ? f : (f.q || f.question || ''))}</div>
        ${typeof f === 'object' && (f.a || f.answer) ? `<div class="faq-a">${escape(f.a || f.answer)}</div>` : ''}
      </div>
    `).join('')}
  </div>
  <div class="block next-block">
    <h2>➡️ Next Steps</h2>
    <ul>
      ${(output.next_steps || []).map((s: string) => `<li>${escape(s)}</li>`).join('')}
    </ul>
  </div>
</div>

${AUTO_PRINT_SCRIPT}
</body>
</html>`;
}

/**
 * Hook Library Canvas — Creative Brief Poster
 * 10 Hook Formulas + 6 platforms + 5 A/B headlines in a single A3 page
 */
export function renderHookCanvas(title: string, input: any, output: any): string {
  const businessName = getInput(input, 'business_name', 'businessName') || title;
  const createdAt = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  const cats = output.hook_categories || [];
  const platforms = output.platform_specific || {};
  const headlines = output.headlines_5 || [];
  const abTips = output.ab_testing_tips || [];

  const platKeys = ['facebook', 'instagram', 'youtube', 'tiktok', 'email', 'landing_page'];
  const platEmoji: Record<string, string> = {
    facebook: '📘', instagram: '📷', youtube: '▶️', tiktok: '🎵', email: '📧', landing_page: '🌐'
  };
  const platLabel: Record<string, string> = {
    facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok', email: 'Email', landing_page: 'Landing Page'
  };

  // Hook category colors
  const catColors: Record<string, string> = {
    curiosity: '#3B82F6', pain: '#EF4444', story: '#F59E0B', stat: '#10B981',
    question: '#8B5CF6', contrarian: '#EC4899', listicle: '#06B6D4',
    pattern_interrupt: '#F97316', big_promise: '#EAB308', identity: '#14B8A6',
  };

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>Hook Library — ${escape(businessName)}</title>
<style>
  ${PRINT_CSS}
  body { padding: 0.6cm; }
  .header {
    background: linear-gradient(135deg, #14B8A6 0%, #0D9488 50%, #115E59 100%);
    color: white; padding: 14px 18px; border-radius: 12px;
    margin-bottom: 10px; box-shadow: 0 4px 12px rgba(20,184,166,0.3);
  }
  .header .label { font-size: 10px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px; }
  .header h1 { font-size: 24px; font-weight: 800; margin: 4px 0 4px; line-height: 1.2; }
  .header .voice {
    display: inline-block; background: rgba(255,255,255,0.2); padding: 3px 10px;
    border-radius: 12px; font-size: 10px; font-weight: 600; margin-top: 4px;
  }
  .header .meta { font-size: 10px; opacity: 0.85; margin-top: 4px; }

  .stats {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px;
  }
  .stat {
    background: #F0FDFA; border: 1.5px solid #14B8A6; border-radius: 8px;
    padding: 6px 8px; text-align: center;
  }
  .stat .num { font-size: 20px; font-weight: 800; color: #0D9488; line-height: 1; }
  .stat .lbl { font-size: 9px; color: #115E59; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.3px; }

  /* Headlines A/B test - prominent at top */
  .headlines-block {
    background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
    border: 2px solid #F59E0B; border-radius: 10px; padding: 10px 12px;
    margin-bottom: 10px; page-break-inside: avoid;
  }
  .headlines-block h2 {
    font-size: 13px; font-weight: 800; color: #92400E; margin-bottom: 8px;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .headlines-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .headline-item {
    background: white; border-radius: 4px; padding: 4px 8px;
    display: flex; align-items: flex-start; gap: 6px;
  }
  .headline-item .rank {
    background: #F59E0B; color: white; font-weight: 800; font-size: 10px;
    width: 20px; height: 20px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .headline-item .text { font-size: 10px; color: #78350F; line-height: 1.3; font-weight: 600; }

  /* Hook Categories - 2 columns */
  .cats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px; }
  .cat-block {
    background: white; border-radius: 6px; padding: 6px 8px;
    border-left: 4px solid; page-break-inside: avoid;
  }
  .cat-block h3 {
    font-size: 10px; font-weight: 700; margin-bottom: 3px;
    display: flex; align-items: center; gap: 4px;
  }
  .cat-block h3 .badge {
    color: white; font-size: 7.5px; padding: 1px 5px; border-radius: 8px;
    text-transform: uppercase; letter-spacing: 0.3px; font-weight: 700;
  }
  .cat-block h3 .thai { color: #134E4A; font-size: 10px; }
  .cat-block .hook-item {
    font-size: 8.5px; line-height: 1.3; padding: 2px 0;
    color: #134E4A; border-bottom: 1px dashed #CCFBF1;
  }
  .cat-block .hook-item:last-child { border-bottom: none; }
  .cat-block .hook-item .hook-text { font-weight: 600; }
  .cat-block .hook-item .hook-meta {
    font-size: 7.5px; color: #0F766E; margin-top: 1px;
    display: flex; gap: 6px;
  }

  /* Platform-specific */
  .plat-block { background: #F0FDFA; border: 1.5px solid #14B8A6; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; }
  .plat-block h2 { font-size: 11px; font-weight: 700; color: #0D9488; margin-bottom: 6px; text-transform: uppercase; }
  .plat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .plat-item {
    background: white; border-radius: 4px; padding: 4px 6px;
  }
  .plat-item .name {
    font-size: 9px; font-weight: 700; color: #0D9488; margin-bottom: 3px;
    display: flex; align-items: center; gap: 3px;
  }
  .plat-item ul { list-style: none; }
  .plat-item li {
    font-size: 8px; line-height: 1.3; margin-bottom: 2px;
    padding-left: 10px; position: relative; color: #134E4A;
  }
  .plat-item li:before {
    content: "▸"; position: absolute; left: 0; color: #14B8A6; font-weight: 700;
  }

  /* A/B tips + Next steps */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .block { border-radius: 8px; padding: 8px 10px; border: 1.5px solid; }
  .block h2 {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;
    margin-bottom: 5px;
  }
  .block ul { list-style: none; }
  .block li { font-size: 9px; line-height: 1.35; margin-bottom: 2px; }

  .ab-block { background: #FAF5FF; border-color: #A855F7; }
  .ab-block h2 { color: #6B21A8; }
  .ab-block li { color: #581C87; padding-left: 14px; position: relative; }
  .ab-block li:before { content: "🧪"; position: absolute; left: 0; font-size: 8px; }

  .next-block { background: #F0FDF4; border-color: #10B981; }
  .next-block h2 { color: #065F46; }
  .next-block li { color: #064E3B; padding-left: 14px; position: relative; }
  .next-block li:before { content: "→"; position: absolute; left: 0; color: #10B981; font-weight: 700; }
</style>
</head>
<body>
<div class="toolbar no-print">
  🎣 Hook Library
  <button onclick="window.print()">🖨️ Print / Save PDF</button>
  <button onclick="window.close()">✕ ปิด</button>
</div>

<div class="header">
  <div class="label">🎣 Creative Brief — Hooks & Headlines</div>
  <h1>${escape(businessName)} — ${cats.length} Formulas × ${Object.keys(platforms).length} Platforms</h1>
  ${output.brand_voice_summary ? `<div class="voice">🎙️ ${escape(output.brand_voice_summary)}</div>` : ''}
  <div class="meta" style="margin-top: 4px;">${createdAt} · ${headlines.length} A/B Headlines</div>
</div>

<div class="stats">
  <div class="stat"><div class="num">${cats.length}</div><div class="lbl">Formulas</div></div>
  <div class="stat"><div class="num">${cats.reduce((s: number, c: any) => s + (c.examples?.length || 0), 0)}</div><div class="lbl">Hooks</div></div>
  <div class="stat"><div class="num">${Object.keys(platforms).length}</div><div class="lbl">Platforms</div></div>
  <div class="stat"><div class="num">${headlines.length}</div><div class="lbl">A/B Tests</div></div>
</div>

<div class="headlines-block">
  <h2>🅰️🅱️ Headlines 5 (A/B Test Variants)</h2>
  <div class="headlines-grid">
    ${headlines.slice(0, 5).map((h: string, i: number) => `
      <div class="headline-item">
        <div class="rank">${i + 1}</div>
        <div class="text">"${escape(h)}"</div>
      </div>
    `).join('')}
  </div>
</div>

<div class="cats-grid">
  ${cats.map((c: any) => {
    const catName = c.name || c.category || 'unknown';
    const color = catColors[catName] || '#14B8A6';
    const examples = c.examples || c.hooks || [];
    return `
    <div class="cat-block" style="border-left-color: ${color};">
      <h3>
        <span class="badge" style="background: ${color};">${escape(catName)}</span>
        <span class="thai">${escape(c.thai_label || catName)}</span>
      </h3>
      ${examples.slice(0, 2).map((e: any) => `
        <div class="hook-item">
          <div class="hook-text">"${escape(e.hook || e.text || '')}"</div>
          ${e.best_for ? `<div class="hook-meta"><span>📱 ${escape(e.best_for)}</span>${e.cta ? `<span>👉 ${escape(e.cta)}</span>` : ''}</div>` : ''}
        </div>
      `).join('')}
    </div>`;
  }).join('')}
</div>

<div class="plat-block">
  <h2>📱 Platform-Specific Hooks</h2>
  <div class="plat-grid">
    ${platKeys.filter(k => platforms[k]?.length).map(k => `
      <div class="plat-item">
        <div class="name">${platEmoji[k]} ${platLabel[k]} (${platforms[k].length})</div>
        <ul>
          ${platforms[k].slice(0, 3).map((h: string) => `<li>${escape(typeof h === 'string' ? h : h.hook || '')}</li>`).join('')}
        </ul>
      </div>
    `).join('')}
  </div>
</div>

<div class="grid-2">
  <div class="block ab-block">
    <h2>🧪 A/B Testing Tips</h2>
    <ul>
      ${abTips.map((t: string) => `<li>${escape(t)}</li>`).join('')}
    </ul>
  </div>
  <div class="block next-block">
    <h2>➡️ Next Steps</h2>
    <ul>
      ${(output.next_steps || []).map((s: string) => `<li>${escape(s)}</li>`).join('')}
    </ul>
  </div>
</div>

${AUTO_PRINT_SCRIPT}
</body>
</html>`;
}

export function renderCanvasPDF(toolType: string, title: string, input: any, output: any): string | null {
  if (toolType === 'value_proposition_canvas') {
    return renderVPCCanvas(title, input, output);
  }
  if (toolType === 'business_model_canvas') {
    return renderBMCCanvas(title, input, output);
  }
  if (toolType === 'million_dollar_offer') {
    return renderOfferCanvas(title, input, output);
  }
  if (toolType === 'objection_handler') {
    return renderObjectionCanvas(title, input, output);
  }
  if (toolType === 'hook_library') {
    return renderHookCanvas(title, input, output);
  }
  return null;
}
