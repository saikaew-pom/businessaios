<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { listSavedTools, updateSavedTool, deleteSavedTool, exportSavedTool, getExportUrl, promoteToolToProject, type ToolSave, getMeFull } from '$lib/api';
  import { PUBLIC_API_URL } from '$env/static/public';

  let saves = $state<ToolSave[]>([]);
  let isLoading = $state(true);
  let showArchived = $state(false);
  let expandedSave = $state<string | null>(null);
  let saveDetails = $state<Record<string, any>>({});
  let loadingDetails = $state<string | null>(null);

  let isGenerating = $state(false);
  let error = $state('');

  onMount(async () => {
    const me = await getMeFull();
    if (!me) { goto('/login'); return; }
    await load();
  });

  async function load() {
    isLoading = true;
    try {
      saves = await listSavedTools({ archived: showArchived });
    } catch (err: any) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  }

  async function handleArchive(save: ToolSave) {
    try {
      await updateSavedTool(save.id, { archived: !save.archived });
      await load();
    } catch (err: any) { alert(err.message); }
  }

  async function handleDelete(save: ToolSave) {
    if (!confirm(`ลบ "${save.title}" ?`)) return;
    try {
      await deleteSavedTool(save.id);
      await load();
    } catch (err: any) { alert(err.message); }
  }

  async function handlePromoteToPlaybook(save: ToolSave) {
    if (!confirm(`สร้าง Playbook จาก "${save.title}"?\n\nเนื้อหาจะถูก import ไปยัง step ที่เกี่ยวข้อง:\n• Pain Point → Step 1-3\n• Brand Voice → Step 1\n• Persona → Step 2`)) return;
    isGenerating = true;
    try {
      const res = await promoteToolToProject(save.id, 'playbook');
      alert(`✓ สร้าง Playbook สำเร็จ!\n\nImport: ${res.steps_imported?.join(', ') || 'ทั้งหมด'}\n\n→ ไปที่โปรเจกต์?`);
      window.location.href = `/projects/${res.project_id}`;
    } catch (err: any) { alert(err.message); }
    finally { isGenerating = false; }
  }

  async function handleExport(save: ToolSave, format: 'md' | 'json') {
    isGenerating = true;
    try {
      const res = await exportSavedTool(save.id, format);
      // Use download_url from server (with Content-Disposition: attachment header)
      const url = res.download_url
        ? `${PUBLIC_API_URL}${res.download_url}`
        : getExportUrl(res.export_id);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${save.title}.${format}`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 100);
    } catch (err: any) { alert(err.message); }
    finally { isGenerating = false; }
  }

  async function openCanvasPDF(save: ToolSave) {
    try {
      isGenerating = true;
      const res = await exportSavedTool(save.id, 'pdf');
      // Open canvas in new tab with auto-print
      const url = `${PUBLIC_API_URL}${res.download_url}?print=1`;
      const win = window.open(url, '_blank');
      if (!win) {
        alert('กรุณาอนุญาต popup เพื่อเปิด Canvas PDF');
      }
    } catch (err: any) { alert(err.message); }
    finally { isGenerating = false; }
  }

  function toolLabel(type: string) {
    return { pain_generator: '🎯 Pain Point', brand_voice: '🎙️ Brand Voice', persona_builder: '👥 Persona', competitor_analysis: '🔍 Competitor', jtbd_generator: '🎯 JTBD', value_proposition_canvas: '💎 VPC', business_model_canvas: '📊 BMC', million_dollar_offer: '💎 Offer', objection_handler: '🛡️ Objections', hook_library: '🎣 Hooks' }[type] || type;
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async function toggleExpand(save: ToolSave) {
    if (expandedSave === save.id) {
      expandedSave = null;
      return;
    }
    expandedSave = save.id;
    // Lazy-load full details
    if (!saveDetails[save.id]) {
      loadingDetails = save.id;
      try {
        const { getSavedTool } = await import('$lib/api');
        const full = await getSavedTool(save.id);
        saveDetails = { ...saveDetails, [save.id]: full };
      } catch (err: any) {
        error = err.message;
      } finally {
        loadingDetails = null;
      }
    }
  }

  function inputSummary(input: any): string {
    if (!input) return '';
    const parts: string[] = [];
    if (input.business_name) parts.push(`ธุรกิจ: ${input.business_name}`);
    if (input.industry) parts.push(`อุตสาหกรรม: ${input.industry}`);
    if (input.business_type) parts.push(`ประเภท: ${input.business_type}`);
    if (input.target_audience) parts.push(`กลุ่มเป้าหมาย: ${String(input.target_audience).slice(0, 80)}`);
    if (input.brand_personality) parts.push(`บุคลิก: ${input.brand_personality}`);
    if (input.dos) parts.push(`Do: ${input.dos}`);
    return parts.slice(0, 3).join(' • ');
  }

  function outputSummary(output: any): string {
    if (!output) return '';
    if (output.voice_summary) return output.voice_summary;
    if (output.summary) return output.summary;
    if (output.disclaimer) return output.disclaimer;
    if (output.personas && output.personas[0]) return output.personas[0].name || output.personas[0].tag;
    if (output.pain_points && output.pain_points[0]) return output.pain_points[0].title;
    return '';
  }

  function outputKey(output: any): string {
    if (!output) return '';
    if (output.personas) return `${output.personas.length} personas`;
    if (output.pain_points) return `${output.pain_points.length} pain points`;
    if (output.voice_summary) return output.personality_archetype || 'Brand voice';
    return '';
  }

  /**
   * Build a printable HTML for the save — opens in new tab for PDF print
   */
  function buildPrintableHTML(save: ToolSave, details: any): string {
    const input = details.input || save.input || {};
    const output = details.output || save.output || {};
    const toolName = toolLabel(save.tool_type);
    const createdAt = formatDate(save.created_at || save.updated_at);

    const css = `
      <style>
        body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; color: #0f172a; line-height: 1.7; }
        h1 { font-size: 32px; margin-bottom: 8px; }
        h2 { font-size: 22px; color: #1d4ed8; margin-top: 32px; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
        h3 { font-size: 17px; color: #1e293b; margin-top: 20px; margin-bottom: 8px; }
        .meta { color: #64748b; font-size: 14px; margin-bottom: 24px; }
        .tag { display: inline-block; padding: 3px 10px; background: #dbeafe; color: #1d4ed8; border-radius: 12px; font-size: 12px; margin-right: 6px; }
        .box { background: #f1f5f9; border-left: 4px solid #1d4ed8; padding: 12px 16px; border-radius: 4px; margin: 12px 0; }
        .ok { background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 4px; font-size: 13px; }
        .no { background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 13px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 12px 0; }
        .phrase { background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin: 6px 0; }
        .bar { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
        .bar-label { width: 130px; font-size: 13px; }
        .bar-track { flex: 1; height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden; }
        .bar-fill { height: 100%; background: #3b82f6; }
        @media print { body { margin: 0; padding: 20px; } }
      </style>`;

    // Build tool-specific body
    let body = '';

    if (save.tool_type === 'brand_voice') {
      const dim = output.voice_dimensions || {};
      body += `
        ${output.voice_summary ? `<h2>Voice Summary</h2><div class="box">${escape(output.voice_summary)}</div>` : ''}
        ${output.personality_archetype || output.tone ? `<h2>Personality</h2>
          ${output.personality_archetype ? `<p><strong>Archetype:</strong> ${escape(output.personality_archetype)}</p>` : ''}
          ${output.tone ? `<p><strong>Tone:</strong> ${escape(output.tone)}</p>` : ''}
        ` : ''}
        ${Object.keys(dim).length ? `<h2>Voice Dimensions</h2>
          ${dim.formal_casual ? bar('Formal (1) → Casual (10)', dim.formal_casual) : ''}
          ${dim.serious_playful ? bar('Serious (1) → Playful (10)', dim.serious_playful) : ''}
          ${dim.factual_emotional ? bar('Factual (1) → Emotional (10)', dim.factual_emotional) : ''}
          ${dim.formal_concise ? bar('Long-form (1) → Concise (10)', dim.formal_concise) : ''}
        ` : ''}
        ${output.do_list?.length ? `<h2>✅ Do (${output.do_list.length})</h2>
          <ul>${output.do_list.map((x: string) => `<li>${escape(x)}</li>`).join('')}</ul>
        ` : ''}
        ${output.dont_list?.length ? `<h2>❌ Don't (${output.dont_list.length})</h2>
          <ul>${output.dont_list.map((x: string) => `<li>${escape(x)}</li>`).join('')}</ul>
        ` : ''}
        ${output.vocabulary ? `<h2>Vocabulary</h2>
          ${output.vocabulary.use_words?.length ? `<h3>ใช้คำว่า</h3>
            <div>${output.vocabulary.use_words.map((w: string) => `<span class="tag">${escape(w)}</span>`).join('')}</div>` : ''}
          ${output.vocabulary.avoid_words?.length ? `<h3>ห้ามใช้</h3>
            <div>${output.vocabulary.avoid_words.map((w: string) => `<span class="tag" style="background:#fee2e2;color:#991b1b;">${escape(w)}</span>`).join('')}</div>` : ''}
        ` : ''}
        ${output.sample_phrases ? `<h2>ตัวอย่างประโยค</h2>
          ${Object.entries(output.sample_phrases).map(([ctx, list]: [string, any]) =>
            Array.isArray(list) && list.length
              ? `<h3>${escape(ctx)}</h3>${list.map((p: string) => `<div class="phrase">"${escape(p)}"</div>`).join('')}`
              : '').join('')}
        ` : ''}
        ${output.content_examples ? `<h2>Content Examples</h2>
          ${Object.entries(output.content_examples).map(([ctx, content]: [string, any]) =>
            content ? `<h3>${escape(ctx)}</h3><div class="box" style="white-space:pre-wrap;">${escape(content)}</div>` : '').join('')}
        ` : ''}
      `;
    } else if (save.tool_type === 'pain_generator') {
      body += `
        ${output.summary ? `<h2>Summary</h2><div class="box">${escape(output.summary)}</div>` : ''}
        ${output.persona_insight ? `<h2>Persona Insight</h2><div class="box">${escape(output.persona_insight)}</div>` : ''}
        ${output.pain_points?.length ? `<h2>Pain Points (${output.pain_points.length})</h2>
          ${output.pain_points.map((pp: any) => `
            <div class="box">
              <h3>#${pp.rank || '?'} ${escape(pp.title || '')}</h3>
              <p>${escape(pp.description || '')}</p>
              <p><strong>Severity:</strong> ${escape(pp.severity || '-')} · <strong>Frequency:</strong> ${escape(pp.frequency || '-')} · <strong>Market:</strong> ${escape(pp.market_size || '-')}</p>
              ${pp.current_solutions?.length ? `<p><strong>Current solutions:</strong> ${pp.current_solutions.map(escape).join(', ')}</p>` : ''}
              ${pp.why_existing_fails ? `<p><strong>Why existing fails:</strong> ${escape(pp.why_existing_fails)}</p>` : ''}
              ${pp.your_opportunity ? `<p><strong>Your opportunity:</strong> ${escape(pp.your_opportunity)}</p>` : ''}
            </div>
          `).join('')}
        ` : ''}
        ${output.quick_wins?.length ? `<h2>Quick Wins</h2><ul>${output.quick_wins.map((x: string) => `<li>${escape(x)}</li>`).join('')}</ul>` : ''}
        ${output.moonshots?.length ? `<h2>Moonshots</h2><ul>${output.moonshots.map((x: string) => `<li>${escape(x)}</li>`).join('')}</ul>` : ''}
      `;
    } else if (save.tool_type === 'persona_builder') {
      body += `
        ${output.disclaimer ? `<div class="box" style="background:#fef3c7;border-left-color:#f59e0b;">⚠️ ${escape(output.disclaimer)}</div>` : ''}
        ${output.personas?.length ? `<h2>Personas (${output.personas.length})</h2>
          ${output.personas.map((p: any) => `
            <div class="box">
              <h3>${escape(p.name || '')}</h3>
              ${p.tag ? `<p style="color:#64748b;">${escape(p.tag)}</p>` : ''}
              ${p.demographics ? `<h3>Demographics</h3>
                <p>อายุ: ${escape(p.demographics.age || '-')} · อาชีพ: ${escape(p.demographics.job || '-')} · รายได้: ${escape(p.demographics.income || '-')}</p>
                <p>ที่อยู่: ${escape(p.demographics.location || '-')} · ครอบครัว: ${escape(p.demographics.family || '-')}</p>
              ` : ''}
              ${p.psychographics ? `<h3>Psychographics</h3>
                <p><strong>Values:</strong> ${escape(p.psychographics.values || '-')}</p>
                <p><strong>Interests:</strong> ${escape(p.psychographics.interests || '-')}</p>
                <p><strong>Fears:</strong> ${escape(p.psychographics.fears || '-')}</p>
                <p><strong>Aspirations:</strong> ${escape(p.psychographics.aspirations || '-')}</p>
              ` : ''}
              ${p.pain_points?.length ? `<h3>Pain Points</h3><ul>${p.pain_points.map((x: string) => `<li>${escape(x)}</li>`).join('')}</ul>` : ''}
              ${p.needs?.length ? `<h3>Needs</h3><ul>${p.needs.map((x: string) => `<li>${escape(x)}</li>`).join('')}</ul>` : ''}
              ${p.preferred_channels?.length ? `<h3>Channels</h3><div>${p.preferred_channels.map((c: string) => `<span class="tag">${escape(c)}</span>`).join('')}</div>` : ''}
              ${p.best_message ? `<h3>Best Message</h3><div class="box">${escape(p.best_message)}</div>` : ''}
              ${p.best_offer ? `<h3>Best Offer</h3><div class="box">${escape(p.best_offer)}</div>` : ''}
              ${p.size_estimate ? `<p><strong>Size estimate:</strong> ${escape(p.size_estimate)}</p>` : ''}
            </div>
          `).join('')}
        ` : ''}
        ${output.how_to_validate?.length ? `<h2>How to Validate</h2><ul>${output.how_to_validate.map((x: string) => `<li>${escape(x)}</li>`).join('')}</ul>` : ''}
      `;
    } else if (save.tool_type === 'competitor_analysis') {
      body += `
        ${output.summary ? `<h2>Market Summary</h2><div class="box">${escape(output.summary)}</div>` : ''}
        ${output.market_dynamics ? `<h2>Market Dynamics</h2><div class="box">${escape(output.market_dynamics)}</div>` : ''}
        ${output.is_estimated ? `<div class="box" style="background:#fef3c7;border-left-color:#f59e0b;">⚠️ ${escape(output.estimation_note || 'คู่แข่งเหล่านี้เป็นการประมาณการณ์')}</div>` : ''}
        ${output.competitors?.length ? `<h2>Competitors (${output.competitors.length})</h2>
          ${output.competitors.map((c: any) => `
            <div class="box">
              <h3>${escape(c.name || '')} ${c.threat_level ? `<span class="tag">${escape(c.threat_level)}</span>` : ''}</h3>
              ${c.tagline ? `<p style="color:#64748b;font-style:italic;">"${escape(c.tagline)}"</p>` : ''}
              ${c.positioning ? `<p><strong>Positioning:</strong> ${escape(c.positioning)}</p>` : ''}
              ${c.price_range ? `<p><strong>Price:</strong> ${escape(c.price_range)}</p>` : ''}
              ${c.strengths?.length ? `<p><strong>Strengths:</strong></p><ul>${c.strengths.map((x: string) => `<li>${escape(x)}</li>`).join('')}</ul>` : ''}
              ${c.weaknesses?.length ? `<p><strong>Weaknesses:</strong></p><ul>${c.weaknesses.map((x: string) => `<li>${escape(x)}</li>`).join('')}</ul>` : ''}
              ${c.marketing_channels?.length ? `<p><strong>Channels:</strong> ${c.marketing_channels.map(escape).join(', ')}</p>` : ''}
              ${c.content_style ? `<p><strong>Content style:</strong> ${escape(c.content_style)}</p>` : ''}
              ${c.why_threat ? `<p><strong>Why threat:</strong> ${escape(c.why_threat)}</p>` : ''}
            </div>
          `).join('')}
        ` : ''}
        ${output.market_gaps?.length ? `<h2>Market Gaps (${output.market_gaps.length})</h2>
          ${output.market_gaps.map((g: any) => `
            <div class="box">
              <h3>${escape(g.gap || '')} ${g.opportunity_size ? `<span class="tag">${escape(g.opportunity_size)}</span>` : ''}</h3>
              ${g.evidence ? `<p><strong>Evidence:</strong> ${escape(g.evidence)}</p>` : ''}
              ${g.your_advantage ? `<p><strong>Your advantage:</strong> ${escape(g.your_advantage)}</p>` : ''}
            </div>
          `).join('')}
        ` : ''}
        ${output.white_space ? `<h2>White Space</h2>
          ${output.white_space.positioning ? `<p><strong>Positioning:</strong> ${escape(output.white_space.positioning)}</p>` : ''}
          ${output.white_space.uvp ? `<p><strong>UVP:</strong> ${escape(output.white_space.uvp)}</p>` : ''}
          ${output.white_space.key_message ? `<div class="box" style="background:#f0f9ff;border-left-color:#3b82f6;font-style:italic;">"${escape(output.white_space.key_message)}"</div>` : ''}
          ${output.white_space.anti_positioning ? `<p><strong>Not for:</strong> ${escape(output.white_space.anti_positioning)}</p>` : ''}
        ` : ''}
        ${output.recommended_strategy ? `<h2>Recommended Strategy</h2>
          ${output.recommended_strategy.now ? `<p><strong>Do now:</strong> ${escape(output.recommended_strategy.now)}</p>` : ''}
          ${output.recommended_strategy.next_30_days?.length ? `<p><strong>30 days:</strong></p><ul>${output.recommended_strategy.next_30_days.map((x: string) => `<li>${escape(x)}</li>`).join('')}</ul>` : ''}
          ${output.recommended_strategy.next_90_days?.length ? `<p><strong>90 days:</strong></p><ul>${output.recommended_strategy.next_90_days.map((x: string) => `<li>${escape(x)}</li>`).join('')}</ul>` : ''}
          ${output.recommended_strategy.avoid ? `<p><strong>Avoid:</strong> ${escape(output.recommended_strategy.avoid)}</p>` : ''}
        ` : ''}
        ${output.reasoning ? `<h2>Reasoning</h2><div class="box">${escape(output.reasoning)}</div>` : ''}
      `;
    } else {
      // Unknown — show raw JSON
      body = `<pre style="white-space:pre-wrap;background:#f1f5f9;padding:16px;border-radius:8px;">${escape(JSON.stringify(output, null, 2))}</pre>`;
    }

    // Input section
    const inputSection = Object.keys(input).length ? `
      <h2>Input</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${Object.entries(input).map(([k, v]) => `
          <tr>
            <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;width:30%;vertical-align:top;">${escape(k)}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">${escape(String(typeof v === 'object' ? JSON.stringify(v) : v))}</td>
          </tr>
        `).join('')}
      </table>
    ` : '';

    return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>${escape(save.title)}</title>
${css}
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:start;">
    <div>
      <h1>${escape(save.title)}</h1>
      <div class="meta">${escape(toolName)} · สร้างเมื่อ ${escape(createdAt)}</div>
    </div>
    <button onclick="window.print()" style="padding:10px 20px;background:#1d4ed8;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">🖨️ Print / Save PDF</button>
  </div>

  ${inputSection}
  <h1 style="margin-top:48px;">Output</h1>
  ${body}

  <div style="margin-top:60px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:12px;">
    สร้างโดย BusinessAiOs
  </div>
</body>
</html>`;
  }

  function escape(s: any): string {
    return String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]!));
  }

  function bar(label: string, value: number) {
    return `<div class="bar"><div class="bar-label">${label}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, Math.max(0, value * 10))}%"></div></div><div style="width:30px;text-align:right;font-size:13px;">${value}/10</div></div>`;
  }

  function openPrintable(save: ToolSave) {
    const details = saveDetails[save.id] || save;
    const html = buildPrintableHTML(save, details);
    // Use Blob URL so popup loads reliably (about:blank + document.write can fail)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) {
      alert('Browser บล็อก popup — กรุณาอนุญาต popup สำหรับเว็บนี้');
      URL.revokeObjectURL(url);
      return;
    }
    // Auto-trigger print dialog after content loads
    setTimeout(() => {
      try { w.focus(); w.print(); } catch (e) { console.error('print failed:', e); }
    }, 1000);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  /**
   * Open the tool with the same input pre-filled
   * Ensures details are loaded first so we have the full input
   */
  async function editSave(save: ToolSave) {
    let details = saveDetails[save.id];
    if (!details) {
      loadingDetails = save.id;
      try {
        const { getSavedTool } = await import('$lib/api');
        details = await getSavedTool(save.id);
        saveDetails = { ...saveDetails, [save.id]: details };
      } catch (err: any) {
        alert('โหลดข้อมูลไม่สำเร็จ: ' + err.message);
        loadingDetails = null;
        return;
      } finally {
        loadingDetails = null;
      }
    }
    const input = details.input || {};
    // Store in sessionStorage to pick up on tool page
    // Include saveId so Save = UPDATE (Option B overwrite) instead of INSERT
    sessionStorage.setItem('tool_edit_input', JSON.stringify({
      tool_type: save.tool_type,
      input,
      save_id: save.id,
    }));
    // Navigate to the right tool
    const path = save.tool_type === 'brand_voice' ? '/tools/brand-voice'
      : save.tool_type === 'pain_generator' ? '/tools/pain-generator'
      : save.tool_type === 'persona_builder' ? '/tools/persona-builder'
      : save.tool_type === 'competitor_analysis' ? '/tools/competitor-analysis'
      : save.tool_type === 'jtbd_generator' ? '/tools/jtbd-generator'
      : save.tool_type === 'value_proposition_canvas' ? '/tools/value-proposition-canvas'
      : save.tool_type === 'business_model_canvas' ? '/tools/business-model-canvas'
      : save.tool_type === 'million_dollar_offer' ? '/tools/million-dollar-offer'
      : save.tool_type === 'objection_handler' ? '/tools/objection-handler'
      : save.tool_type === 'hook_library' ? '/tools/hook-library'
      : '/tools';
    goto(path);
  }
</script>

<svelte:head>
  <title>บันทึกของฉัน — BusinessAiOs</title>
</svelte:head>

<div class="min-h-screen bg-dark-50">
  <header class="bg-white border-b border-dark-100 sticky top-0 z-10">
    <div class="container-narrow flex items-center justify-between h-16">
      <a href="/dashboard" class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
          <span class="text-white font-bold text-sm">M</span>
        </div>
        <span class="font-bold text-lg">📂 บันทึกของฉัน</span>
      </a>
      <a href="/tools" class="text-sm text-primary-600 hover:underline">← กลับไปเครื่องมือ</a>
    </div>
  </header>

  <main class="container-narrow py-8">
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div class="text-sm text-dark-900/60">ทั้งหมด {saves.length} รายการ</div>
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" bind:checked={showArchived} onchange={load} class="rounded" />
        แสดงรายการที่ archive
      </label>
    </div>

    {#if isLoading}
      <div class="text-center py-12 text-dark-900/60">กำลังโหลด...</div>
    {:else if saves.length === 0}
      <div class="bg-white rounded-2xl border border-dark-100 p-12 text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-50 flex items-center justify-center">
          <span class="text-3xl">📂</span>
        </div>
        <h3 class="font-semibold mb-2">{showArchived ? 'ไม่มีรายการที่ archive' : 'ยังไม่มีบันทึก'}</h3>
        <p class="text-sm text-dark-900/60 mb-6">ลองใช้เครื่องมือ AI แล้วกด "💾 บันทึก" เพื่อเก็บไว้ดูภายหลัง</p>
        <a href="/tools" class="btn-primary inline-block">เปิดเครื่องมือ AI</a>
      </div>
    {:else}
      <div class="space-y-3">
        {#each saves as save}
          <div class="bg-white rounded-xl border border-dark-100 hover:border-primary-200 transition overflow-hidden">
            <div class="p-4 flex items-start gap-3">
              <button
                onclick={() => toggleExpand(save)}
                class="flex-1 min-w-0 text-left"
              >
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                  <span class="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">{toolLabel(save.tool_type)}</span>
                  {#if save.archived}
                    <span class="text-xs px-2 py-0.5 rounded-full bg-dark-100 text-dark-900/60">archived</span>
                  {/if}
                </div>
                <h3 class="font-semibold">{save.title}</h3>
                <div class="text-xs text-dark-900/50 mt-1 flex items-center gap-2">
                  <span>อัปเดต {formatDate(save.updated_at)}</span>
                  <span class="text-dark-900/30">•</span>
                  <span class="text-primary-600">{expandedSave === save.id ? '▼ ซ่อน' : '▶ ดูเนื้อหา'}</span>
                </div>
              </button>
              <div class="flex items-center gap-1 flex-shrink-0 flex-wrap">
                <button onclick={() => openPrintable(save)} class="text-xs px-2 py-1 rounded bg-primary-50 text-primary-700 hover:bg-primary-100 font-medium" title="ดาวน์โหลด PDF (เปิด print dialog)">📄 PDF</button>
                {#if save.tool_type === 'value_proposition_canvas' || save.tool_type === 'business_model_canvas' || save.tool_type === 'million_dollar_offer' || save.tool_type === 'objection_handler' || save.tool_type === 'hook_library'}
                  <button onclick={() => openCanvasPDF(save)} class="text-xs px-2 py-1 rounded bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:opacity-90 font-medium" title="One-page A3 Canvas PDF (พิมพ์เป็น poster)">🎨 Canvas PDF</button>
                {/if}
                <button onclick={() => editSave(save)} class="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium" title="แก้ไข input แล้วรันใหม่">✏️ แก้ไข</button>
                <button onclick={() => handleExport(save, 'md')} disabled={isGenerating} class="text-xs px-2 py-1 rounded bg-dark-50 hover:bg-dark-100" title="Markdown">.md</button>
                <button onclick={() => handleExport(save, 'json')} disabled={isGenerating} class="text-xs px-2 py-1 rounded bg-dark-50 hover:bg-dark-100" title="JSON">.json</button>
                <button onclick={() => handleArchive(save)} class="text-xs px-2 py-1 rounded bg-dark-50 hover:bg-dark-100" title={save.archived ? 'Unarchive' : 'Archive'}>
                  {save.archived ? '↩️' : '📦'}
                </button>
                <button onclick={() => handlePromoteToPlaybook(save)} class="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium" title="สร้าง Playbook จาก tool นี้ (import เนื้อหาเข้า step ที่เกี่ยวข้อง)">📋 เป็น Playbook</button>
                <button onclick={() => handleDelete(save)} class="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100" title="ลบ">🗑️</button>
              </div>
            </div>

            <!-- Expanded content -->
            {#if expandedSave === save.id}
              <div class="border-t border-dark-100 bg-dark-50/50 p-4">
                <!-- Action bar: PDF + Edit (prominent) -->
                <div class="flex items-center gap-2 mb-4 flex-wrap">
                  <button
                    onclick={() => openPrintable(save)}
                    class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 shadow-sm"
                  >
                    <span>📄</span> ดาวน์โหลด PDF
                  </button>
                  <button
                    onclick={() => editSave(save)}
                    class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 shadow-sm"
                  >
                    <span>✏️</span> แก้ไข
                  </button>
                  <button
                    onclick={() => handleExport(save, 'md')}
                    disabled={isGenerating}
                    class="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-white border border-dark-200 text-sm hover:bg-dark-50"
                  >
                    📝 Markdown
                  </button>
                  <button
                    onclick={() => handleExport(save, 'json')}
                    disabled={isGenerating}
                    class="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-white border border-dark-200 text-sm hover:bg-dark-50"
                  >
                    📋 JSON
                  </button>
                </div>
                {#if loadingDetails === save.id}
                  <div class="text-center text-sm text-dark-900/60 py-4">กำลังโหลด...</div>
                {:else if saveDetails[save.id]}
                  {@const details = saveDetails[save.id]}
                  {@const input = details.input || save.input}
                  {@const output = details.output || save.output}

                  {#if input && Object.keys(input).length > 0}
                    <details class="mb-4 bg-white border border-dark-200 rounded-lg overflow-hidden">
                      <summary class="px-3 py-2 cursor-pointer text-xs font-semibold text-dark-900/70 hover:bg-dark-50 flex items-center gap-2 select-none">
                        <span>📥</span>
                        <span>Input</span>
                        <span class="text-dark-900/40 font-normal">({Object.keys(input).length} fields)</span>
                        <span class="ml-auto text-dark-900/40">▾</span>
                      </summary>
                      <div class="p-3 text-xs font-mono text-dark-900/80 border-t border-dark-100 max-h-60 overflow-y-auto">
                        <pre class="whitespace-pre-wrap break-words">{JSON.stringify(input, null, 2)}</pre>
                      </div>
                    </details>
                  {/if}

                  {#if output && Object.keys(output).length > 0}
                    <div>
                      <div class="text-sm font-semibold text-dark-900/80 mb-3 flex items-center gap-2">
                        <span>📤</span>
                        <span>Output</span>
                        <span class="text-xs text-dark-900/50 font-normal">({Object.keys(output).length} sections)</span>
                      </div>
                      <div class="space-y-3">

                        {#if save.tool_type === 'brand_voice'}
                          <!-- Voice Summary block -->
                          {#if output.voice_summary}
                            <div class="bg-white border border-dark-200 rounded-lg p-4">
                              <div class="text-xs font-bold text-primary-700 uppercase tracking-wide mb-1.5">Voice Summary</div>
                              <p class="text-sm text-dark-900/90 leading-relaxed">{output.voice_summary}</p>
                            </div>
                          {/if}

                          <!-- Identity card: Archetype + Tone -->
                          {#if output.personality_archetype || output.tone}
                            <div class="bg-gradient-to-br from-primary-50 to-blue-50 border border-primary-200 rounded-lg p-4">
                              <div class="grid grid-cols-2 gap-3">
                                {#if output.personality_archetype}
                                  <div>
                                    <div class="text-xs font-bold text-primary-700 uppercase tracking-wide mb-1">Archetype</div>
                                    <div class="text-base font-semibold text-primary-900">{output.personality_archetype}</div>
                                  </div>
                                {/if}
                                {#if output.tone}
                                  <div>
                                    <div class="text-xs font-bold text-primary-700 uppercase tracking-wide mb-1">Tone</div>
                                    <div class="text-sm text-primary-900">{output.tone}</div>
                                  </div>
                                {/if}
                              </div>
                            </div>
                          {/if}

                          <!-- Voice Dimensions -->
                          {#if output.voice_dimensions}
                            <div class="bg-white border border-dark-200 rounded-lg p-4">
                              <div class="text-xs font-bold text-dark-900/60 uppercase tracking-wide mb-3">Voice Dimensions</div>
                              <div class="space-y-2">
                                {#if output.voice_dimensions.formal_casual}
                                  {@const v = output.voice_dimensions.formal_casual}
                                  <div class="flex items-center gap-2">
                                    <span class="text-xs text-dark-900/60 w-28 flex-shrink-0">Formal ({1}) → Casual ({10})</span>
                                    <div class="flex-1 h-2 bg-dark-100 rounded-full overflow-hidden">
                                      <div class="h-full bg-primary-500 rounded-full" style="width:{v * 10}%"></div>
                                    </div>
                                    <span class="text-xs font-semibold w-8 text-right">{v}/10</span>
                                  </div>
                                {/if}
                                {#if output.voice_dimensions.serious_playful}
                                  {@const v = output.voice_dimensions.serious_playful}
                                  <div class="flex items-center gap-2">
                                    <span class="text-xs text-dark-900/60 w-28 flex-shrink-0">Serious ({1}) → Playful ({10})</span>
                                    <div class="flex-1 h-2 bg-dark-100 rounded-full overflow-hidden">
                                      <div class="h-full bg-primary-500 rounded-full" style="width:{v * 10}%"></div>
                                    </div>
                                    <span class="text-xs font-semibold w-8 text-right">{v}/10</span>
                                  </div>
                                {/if}
                                {#if output.voice_dimensions.factual_emotional}
                                  {@const v = output.voice_dimensions.factual_emotional}
                                  <div class="flex items-center gap-2">
                                    <span class="text-xs text-dark-900/60 w-28 flex-shrink-0">Factual ({1}) → Emotional ({10})</span>
                                    <div class="flex-1 h-2 bg-dark-100 rounded-full overflow-hidden">
                                      <div class="h-full bg-primary-500 rounded-full" style="width:{v * 10}%"></div>
                                    </div>
                                    <span class="text-xs font-semibold w-8 text-right">{v}/10</span>
                                  </div>
                                {/if}
                                {#if output.voice_dimensions.formal_concise}
                                  {@const v = output.voice_dimensions.formal_concise}
                                  <div class="flex items-center gap-2">
                                    <span class="text-xs text-dark-900/60 w-28 flex-shrink-0">Long ({1}) → Concise ({10})</span>
                                    <div class="flex-1 h-2 bg-dark-100 rounded-full overflow-hidden">
                                      <div class="h-full bg-primary-500 rounded-full" style="width:{v * 10}%"></div>
                                    </div>
                                    <span class="text-xs font-semibold w-8 text-right">{v}/10</span>
                                  </div>
                                {/if}
                              </div>
                            </div>
                          {/if}

                          <!-- Do's -->
                          {#if output.do_list?.length}
                            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                              <div class="text-xs font-bold text-green-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                <span>✅</span> Do ({output.do_list.length})
                              </div>
                              <ul class="space-y-1.5 text-sm text-green-900">
                                {#each output.do_list as x}
                                  <li class="flex gap-2"><span class="text-green-600 flex-shrink-0">•</span><span>{x}</span></li>
                                {/each}
                              </ul>
                            </div>
                          {/if}

                          <!-- Don'ts -->
                          {#if output.dont_list?.length}
                            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                              <div class="text-xs font-bold text-red-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                <span>❌</span> Don't ({output.dont_list.length})
                              </div>
                              <ul class="space-y-1.5 text-sm text-red-900">
                                {#each output.dont_list as x}
                                  <li class="flex gap-2"><span class="text-red-600 flex-shrink-0">•</span><span>{x}</span></li>
                                {/each}
                              </ul>
                            </div>
                          {/if}

                          <!-- Vocabulary -->
                          {#if output.vocabulary}
                            {#if output.vocabulary.use_words?.length || output.vocabulary.avoid_words?.length}
                              <div class="bg-white border border-dark-200 rounded-lg p-4">
                                <div class="text-xs font-bold text-dark-900/60 uppercase tracking-wide mb-3">Vocabulary</div>
                                {#if output.vocabulary.use_words?.length}
                                  <div class="mb-3">
                                    <div class="text-xs text-blue-700 font-semibold mb-1.5">ใช้คำว่า</div>
                                    <div class="flex flex-wrap gap-1.5">
                                      {#each output.vocabulary.use_words as w}
                                        <span class="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-medium">{w}</span>
                                      {/each}
                                    </div>
                                  </div>
                                {/if}
                                {#if output.vocabulary.avoid_words?.length}
                                  <div>
                                    <div class="text-xs text-red-700 font-semibold mb-1.5">ห้ามใช้</div>
                                    <div class="flex flex-wrap gap-1.5">
                                      {#each output.vocabulary.avoid_words as w}
                                        <span class="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-medium line-through">{w}</span>
                                      {/each}
                                    </div>
                                  </div>
                                {/if}
                              </div>
                            {/if}
                          {/if}

                          <!-- Sample phrases -->
                          {#if output.sample_phrases}
                            {@const sampleEntries = Object.entries(output.sample_phrases).filter(([_, list]: any) => Array.isArray(list) && list.length)}
                            {#if sampleEntries.length}
                              <div class="bg-white border border-dark-200 rounded-lg p-4">
                                <div class="text-xs font-bold text-dark-900/60 uppercase tracking-wide mb-3">ตัวอย่างประโยค</div>
                                <div class="space-y-3">
                                  {#each sampleEntries as [ctx, list]}
                                    <div>
                                      <div class="text-xs font-semibold text-primary-700 mb-1.5">{ctx}</div>
                                      <div class="space-y-1.5">
                                        {#each list as p}
                                          <div class="text-sm italic text-dark-900/80 pl-3 border-l-2 border-primary-200">"{p}"</div>
                                        {/each}
                                      </div>
                                    </div>
                                  {/each}
                                </div>
                              </div>
                            {/if}
                          {/if}

                          <!-- Content examples -->
                          {#if output.content_examples}
                            {@const exEntries = Object.entries(output.content_examples).filter(([_, c]: any) => c)}
                            {#if exEntries.length}
                              <div class="bg-white border border-dark-200 rounded-lg p-4">
                                <div class="text-xs font-bold text-dark-900/60 uppercase tracking-wide mb-3">Content Examples</div>
                                <div class="space-y-3">
                                  {#each exEntries as [ctx, content]}
                                    <div>
                                      <div class="text-xs font-semibold text-primary-700 mb-1.5">{ctx}</div>
                                      <div class="text-sm text-dark-900/80 whitespace-pre-wrap bg-dark-50 p-2.5 rounded">{content}</div>
                                    </div>
                                  {/each}
                                </div>
                              </div>
                            {/if}
                          {/if}

                        {:else if save.tool_type === 'pain_generator'}
                          {#if output.summary}
                            <div class="bg-white border border-dark-200 rounded-lg p-4">
                              <div class="text-xs font-bold text-primary-700 uppercase tracking-wide mb-1.5">Summary</div>
                              <p class="text-sm text-dark-900/90 leading-relaxed">{output.summary}</p>
                            </div>
                          {/if}
                          {#if output.persona_insight}
                            <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
                              <div class="text-xs font-bold text-purple-800 uppercase tracking-wide mb-1.5">Persona Insight</div>
                              <p class="text-sm text-purple-900 leading-relaxed">{output.persona_insight}</p>
                            </div>
                          {/if}
                          {#if output.pain_points?.length}
                            <div>
                              <div class="text-xs font-bold text-dark-900/60 uppercase tracking-wide mb-2.5">Pain Points ({output.pain_points.length})</div>
                              <div class="space-y-2">
                                {#each output.pain_points as pp}
                                  <div class="bg-white border border-dark-200 rounded-lg p-4">
                                    <div class="flex items-start gap-2 mb-1.5">
                                      <span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex-shrink-0">{pp.rank || '?'}</span>
                                      <div class="font-semibold text-sm text-dark-900">{pp.title}</div>
                                    </div>
                                    <p class="text-sm text-dark-900/80 ml-9 leading-relaxed">{pp.description}</p>
                                    <div class="text-xs text-dark-900/60 ml-9 mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                                      <span><strong>Severity:</strong> {pp.severity}</span>
                                      <span><strong>Frequency:</strong> {pp.frequency}</span>
                                      <span><strong>Market:</strong> {pp.market_size}</span>
                                    </div>
                                    {#if pp.why_existing_fails}
                                      <div class="text-xs ml-9 mt-1.5 text-red-700"><strong>Why existing fails:</strong> {pp.why_existing_fails}</div>
                                    {/if}
                                    {#if pp.your_opportunity}
                                      <div class="text-xs ml-9 mt-1 text-green-700"><strong>Your opportunity:</strong> {pp.your_opportunity}</div>
                                    {/if}
                                  </div>
                                {/each}
                              </div>
                            </div>
                          {/if}
                          {#if output.quick_wins?.length}
                            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                              <div class="text-xs font-bold text-green-800 uppercase tracking-wide mb-2">Quick Wins</div>
                              <ul class="space-y-1.5 text-sm text-green-900">
                                {#each output.quick_wins as x}
                                  <li class="flex gap-2"><span class="text-green-600 flex-shrink-0">•</span><span>{x}</span></li>
                                {/each}
                              </ul>
                            </div>
                          {/if}
                          {#if output.moonshots?.length}
                            <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
                              <div class="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2">Moonshots</div>
                              <ul class="space-y-1.5 text-sm text-amber-900">
                                {#each output.moonshots as x}
                                  <li class="flex gap-2"><span class="text-amber-600 flex-shrink-0">•</span><span>{x}</span></li>
                                {/each}
                              </ul>
                            </div>
                          {/if}

                        {:else if save.tool_type === 'persona_builder'}
                          {#if output.disclaimer}
                            <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex gap-2">
                              <span class="flex-shrink-0">⚠️</span>
                              <span>{output.disclaimer}</span>
                            </div>
                          {/if}
                          {#if output.personas?.length}
                            <div>
                              <div class="text-xs font-bold text-dark-900/60 uppercase tracking-wide mb-2.5">Personas ({output.personas.length})</div>
                              <div class="space-y-3">
                                {#each output.personas as p}
                                  <div class="bg-white border border-dark-200 rounded-lg p-4">
                                    <div class="font-semibold text-base text-dark-900">{p.name}</div>
                                    {#if p.tag}<div class="text-xs text-dark-900/60 mb-2">{p.tag}</div>{/if}
                                    {#if p.demographics}
                                      <div class="text-xs text-dark-900/70 mb-2 grid grid-cols-2 gap-x-3">
                                        <span>อายุ: {p.demographics.age}</span>
                                        <span>อาชีพ: {p.demographics.job}</span>
                                        <span>รายได้: {p.demographics.income}</span>
                                        <span>ที่อยู่: {p.demographics.location}</span>
                                      </div>
                                    {/if}
                                    {#if p.psychographics}
                                      <div class="text-xs text-dark-900/70 mb-2 space-y-0.5">
                                        {#if p.psychographics.values}<div><strong>Values:</strong> {p.psychographics.values}</div>{/if}
                                        {#if p.psychographics.aspirations}<div><strong>Aspirations:</strong> {p.psychographics.aspirations}</div>{/if}
                                        {#if p.psychographics.fears}<div><strong>Fears:</strong> {p.psychographics.fears}</div>{/if}
                                      </div>
                                    {/if}
                                    {#if p.pain_points?.length}
                                      <div class="text-xs mb-2">
                                        <strong class="text-red-700">Pain Points:</strong>
                                        <div class="mt-1 space-y-0.5 text-dark-900/80">
                                          {#each p.pain_points as x}
                                            <div class="flex gap-1.5"><span class="text-red-500">•</span><span>{x}</span></div>
                                          {/each}
                                        </div>
                                      </div>
                                    {/if}
                                    {#if p.preferred_channels?.length}
                                      <div class="text-xs mb-2">
                                        <strong>Channels:</strong>
                                        <div class="flex flex-wrap gap-1 mt-1">
                                          {#each p.preferred_channels as c}
                                            <span class="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">{c}</span>
                                          {/each}
                                        </div>
                                      </div>
                                    {/if}
                                    {#if p.best_message}
                                      <div class="bg-blue-50 border border-blue-200 rounded p-2 text-xs mb-1.5">
                                        <strong class="text-blue-800">Best Message:</strong> {p.best_message}
                                      </div>
                                    {/if}
                                    {#if p.best_offer}
                                      <div class="bg-green-50 border border-green-200 rounded p-2 text-xs">
                                        <strong class="text-green-800">Best Offer:</strong> {p.best_offer}
                                      </div>
                                    {/if}
                                  </div>
                                {/each}
                              </div>
                            </div>
                          {/if}
                          {#if output.how_to_validate?.length}
                            <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
                              <div class="text-xs font-bold text-purple-800 uppercase tracking-wide mb-2">How to Validate</div>
                              <ul class="space-y-1.5 text-sm text-purple-900">
                                {#each output.how_to_validate as x}
                                  <li class="flex gap-2"><span class="text-purple-600 flex-shrink-0">•</span><span>{x}</span></li>
                                {/each}
                              </ul>
                            </div>
                          {/if}

                        {:else if save.tool_type === 'competitor_analysis'}
                          <!-- Competitor Analysis rendering -->
                          {#if output.summary}
                            <div class="bg-white border border-dark-200 rounded-lg p-4">
                              <div class="text-xs font-bold text-primary-700 uppercase tracking-wide mb-1.5">Market Summary</div>
                              <p class="text-sm text-dark-900/90 leading-relaxed">{output.summary}</p>
                            </div>
                          {/if}
                          {#if output.is_estimated}
                            <div class="bg-amber-50 border-l-4 border-amber-500 rounded-r-lg p-3 text-xs text-amber-900">
                              ⚠️ <strong>Auto-find mode:</strong> {output.estimation_note || 'คู่แข่งเป็นการประมาณการณ์ ควรตรวจสอบข้อมูลจริง'}
                            </div>
                          {/if}
                          {#if output.market_dynamics}
                            <div class="bg-white border border-dark-200 rounded-lg p-4">
                              <div class="text-xs font-bold text-dark-900/60 uppercase tracking-wide mb-1.5">Market Dynamics</div>
                              <p class="text-sm text-dark-900/80 leading-relaxed">{output.market_dynamics}</p>
                            </div>
                          {/if}
                          {#if output.competitors?.length}
                            <div>
                              <div class="text-xs font-bold text-dark-900/60 uppercase tracking-wide mb-2.5">Competitors ({output.competitors.length})</div>
                              <div class="space-y-2">
                                {#each output.competitors as c, i}
                                  {@const threatCls = c.threat_level === 'high' ? 'bg-red-100 text-red-800 border-red-300' : c.threat_level === 'medium' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-blue-100 text-blue-800 border-blue-300'}
                                  {@const threatLabel = c.threat_level === 'high' ? '🔴 ภัยสูง' : c.threat_level === 'medium' ? '🟡 ปานกลาง' : '🟢 ต่ำ'}
                                  <div class="bg-white border border-dark-200 rounded-lg p-4">
                                    <div class="flex items-start justify-between gap-2 mb-2">
                                      <div class="font-semibold text-sm text-dark-900">
                                        <span class="text-dark-900/40 mr-1">#{i+1}</span> {c.name}
                                      </div>
                                      <span class="text-xs px-2 py-0.5 rounded-full border {threatCls} whitespace-nowrap">{threatLabel}</span>
                                    </div>
                                    {#if c.tagline}
                                      <div class="text-xs italic text-dark-900/60 mb-2">"{c.tagline}"</div>
                                    {/if}
                                    <div class="text-xs text-dark-900/80 mb-2">
                                      <strong>Positioning:</strong> {c.positioning}
                                      {#if c.price_range}· <strong>Price:</strong> {c.price_range}{/if}
                                    </div>
                                    {#if c.strengths?.length || c.weaknesses?.length}
                                      <div class="grid sm:grid-cols-2 gap-2 text-xs">
                                        {#if c.strengths?.length}
                                          <div class="bg-green-50 border border-green-200 rounded p-2">
                                            <div class="font-bold text-green-800 mb-1">💪 Strengths</div>
                                            <ul class="space-y-0.5 text-green-900">{#each c.strengths as s}<li>• {s}</li>{/each}</ul>
                                          </div>
                                        {/if}
                                        {#if c.weaknesses?.length}
                                          <div class="bg-red-50 border border-red-200 rounded p-2">
                                            <div class="font-bold text-red-800 mb-1">⚠️ Weaknesses</div>
                                            <ul class="space-y-0.5 text-red-900">{#each c.weaknesses as w}<li>• {w}</li>{/each}</ul>
                                          </div>
                                        {/if}
                                      </div>
                                    {/if}
                                    {#if c.marketing_channels?.length}
                                      <div class="text-xs text-dark-900/70 mt-2">
                                        <strong>Channels:</strong>
                                        <div class="flex flex-wrap gap-1 mt-1">
                                          {#each c.marketing_channels as ch}<span class="px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded text-[10px]">{ch}</span>{/each}
                                        </div>
                                      </div>
                                    {/if}
                                    {#if c.why_threat}
                                      <div class="text-xs text-amber-800 bg-amber-50 border-l-2 border-amber-400 rounded-r p-2 mt-2">
                                        <strong>Why threat:</strong> {c.why_threat}
                                      </div>
                                    {/if}
                                  </div>
                                {/each}
                              </div>
                            </div>
                          {/if}
                          {#if output.market_gaps?.length}
                            <div>
                              <div class="text-xs font-bold text-dark-900/60 uppercase tracking-wide mb-2.5">Market Gaps ({output.market_gaps.length})</div>
                              <div class="space-y-2">
                                {#each output.market_gaps as g, i}
                                  {@const szCls = g.opportunity_size === 'big' ? 'bg-green-100 text-green-800' : g.opportunity_size === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}
                                  {@const szLabel = g.opportunity_size === 'big' ? '🟢 โอกาสใหญ่' : g.opportunity_size === 'medium' ? '🟡 กลาง' : '⚪ เล็ก'}
                                  <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                                    <div class="flex items-start justify-between gap-2 mb-1.5">
                                      <div class="font-semibold text-sm text-emerald-900">#{i+1} {g.gap}</div>
                                      <span class="text-xs px-2 py-0.5 rounded-full {szCls} whitespace-nowrap">{szLabel}</span>
                                    </div>
                                    {#if g.evidence}<div class="text-xs text-dark-900/70 mb-1"><strong>Evidence:</strong> {g.evidence}</div>{/if}
                                    {#if g.your_advantage}<div class="text-xs text-emerald-800"><strong>Your advantage:</strong> {g.your_advantage}</div>{/if}
                                  </div>
                                {/each}
                              </div>
                            </div>
                          {/if}
                          {#if output.white_space}
                            <div class="bg-gradient-to-br from-primary-50 to-blue-50 border-2 border-primary-300 rounded-lg p-4">
                              <div class="text-xs font-bold text-primary-700 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                                🚀 White Space
                              </div>
                              <div class="space-y-2 text-sm">
                                {#if output.white_space.positioning}
                                  <div><strong class="text-xs text-primary-700">Positioning:</strong> {output.white_space.positioning}</div>
                                {/if}
                                {#if output.white_space.uvp}
                                  <div><strong class="text-xs text-primary-700">UVP:</strong> {output.white_space.uvp}</div>
                                {/if}
                                {#if output.white_space.key_message}
                                  <div class="bg-white rounded p-2 italic border border-primary-200">"{output.white_space.key_message}"</div>
                                {/if}
                                {#if output.white_space.anti_positioning}
                                  <div class="bg-amber-50 border-l-2 border-amber-400 rounded-r p-2 text-xs">
                                    <strong class="text-amber-800">Not for:</strong> <span class="text-amber-900">{output.white_space.anti_positioning}</span>
                                  </div>
                                {/if}
                              </div>
                            </div>
                          {/if}
                          {#if output.recommended_strategy}
                            <div>
                              <div class="text-xs font-bold text-dark-900/60 uppercase tracking-wide mb-2.5">📋 Recommended Strategy</div>
                              <div class="space-y-2">
                                {#if output.recommended_strategy.now}
                                  <div class="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-3">
                                    <div class="text-xs font-bold text-red-800 uppercase mb-1">🔥 ทำด่วนที่สุด</div>
                                    <div class="text-sm text-red-900">{output.recommended_strategy.now}</div>
                                  </div>
                                {/if}
                                {#if output.recommended_strategy.next_30_days?.length}
                                  <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <div class="text-xs font-bold text-blue-800 uppercase mb-1.5">📅 30 วัน</div>
                                    <ul class="space-y-0.5 text-sm text-blue-900">{#each output.recommended_strategy.next_30_days as a}<li class="flex gap-1.5"><span>→</span>{a}</li>{/each}</ul>
                                  </div>
                                {/if}
                                {#if output.recommended_strategy.next_90_days?.length}
                                  <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                                    <div class="text-xs font-bold text-indigo-800 uppercase mb-1.5">🎯 90 วัน</div>
                                    <ul class="space-y-0.5 text-sm text-indigo-900">{#each output.recommended_strategy.next_90_days as a}<li class="flex gap-1.5"><span>→</span>{a}</li>{/each}</ul>
                                  </div>
                                {/if}
                                {#if output.recommended_strategy.avoid}
                                  <div class="bg-rose-50 border-l-4 border-rose-400 rounded-r-lg p-3 text-sm text-rose-900">
                                    <strong class="text-rose-800 text-xs uppercase">🚫 ห้ามทำ:</strong> {output.recommended_strategy.avoid}
                                  </div>
                                {/if}
                              </div>
                            </div>
                          {/if}
                          {#if output.reasoning}
                            <div class="bg-white border border-dark-200 rounded-lg p-4 text-sm italic text-dark-900/70">
                              💡 {output.reasoning}
                            </div>
                          {/if}

                        {:else if save.tool_type === 'jtbd_generator'}
                          <!-- JTBD rendering -->
                          {#if output.summary}
                            <div class="bg-white border border-dark-200 rounded-lg p-4">
                              <div class="text-xs font-bold text-primary-700 uppercase tracking-wide mb-1.5">Summary</div>
                              <p class="text-sm text-dark-900/90 leading-relaxed">{output.summary}</p>
                            </div>
                          {/if}
                          {#if output.answer_to_core_question}
                            <div class="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
                              <div class="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-1">💡 Core Answer</div>
                              <div class="text-sm italic text-indigo-900">"{output.answer_to_core_question}"</div>
                            </div>
                          {/if}
                          {#if output.primary_job}
                            <div class="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-300 rounded-lg p-4">
                              <div class="text-xs font-bold text-orange-700 uppercase tracking-wide mb-2">🎯 Primary Job</div>
                              {#if output.primary_job.job_statement}
                                <div class="bg-white rounded p-2.5 mb-2 text-sm border border-orange-200">
                                  <div class="text-xs font-bold text-orange-700 mb-1">Job Statement</div>
                                  {output.primary_job.job_statement}
                                </div>
                              {/if}
                              {#if output.primary_job.dimensions}
                                <div class="grid sm:grid-cols-3 gap-2 text-xs">
                                  {#if output.primary_job.dimensions.functional}
                                    <div class="bg-white border border-orange-200 rounded p-2">
                                      <div class="font-bold text-orange-700 mb-0.5">⚙️ Functional</div>
                                      <div class="text-orange-900">{output.primary_job.dimensions.functional}</div>
                                    </div>
                                  {/if}
                                  {#if output.primary_job.dimensions.emotional}
                                    <div class="bg-white border border-orange-200 rounded p-2">
                                      <div class="font-bold text-orange-700 mb-0.5">💗 Emotional</div>
                                      <div class="text-orange-900">{output.primary_job.dimensions.emotional}</div>
                                    </div>
                                  {/if}
                                  {#if output.primary_job.dimensions.social}
                                    <div class="bg-white border border-orange-200 rounded p-2">
                                      <div class="font-bold text-orange-700 mb-0.5">👥 Social</div>
                                      <div class="text-orange-900">{output.primary_job.dimensions.social}</div>
                                    </div>
                                  {/if}
                                </div>
                              {/if}
                            </div>
                          {/if}
                          {#if output.forces_of_progress}
                            {@const f = output.forces_of_progress}
                            <div>
                              <div class="text-xs font-bold text-dark-900/60 uppercase tracking-wide mb-2.5">⚖️ Forces of Progress</div>
                              <div class="grid sm:grid-cols-2 gap-2 text-xs">
                                <div class="bg-red-50 border border-red-200 rounded p-2">
                                  <div class="font-bold text-red-800 mb-1">⬆️ PUSH</div>
                                  <ul class="space-y-0.5 text-red-900">{#each f.push || [] as p}<li>• {p.force} [{p.intensity}]</li>{/each}</ul>
                                </div>
                                <div class="bg-green-50 border border-green-200 rounded p-2">
                                  <div class="font-bold text-green-800 mb-1">🧲 PULL</div>
                                  <ul class="space-y-0.5 text-green-900">{#each f.pull || [] as p}<li>• {p.force} [{p.intensity}]</li>{/each}</ul>
                                </div>
                                <div class="bg-amber-50 border border-amber-200 rounded p-2">
                                  <div class="font-bold text-amber-800 mb-1">😟 ANXIETY</div>
                                  <ul class="space-y-0.5 text-amber-900">{#each f.anxiety || [] as p}<li>• {p.force} [{p.intensity}]</li>{/each}</ul>
                                </div>
                                <div class="bg-blue-50 border border-blue-200 rounded p-2">
                                  <div class="font-bold text-blue-800 mb-1">🛋️ HABIT</div>
                                  <ul class="space-y-0.5 text-blue-900">{#each f.habit || [] as p}<li>• {p.force} [{p.intensity}]</li>{/each}</ul>
                                </div>
                              </div>
                              {#if f.verdict}
                                <div class="mt-2 bg-indigo-50 border-l-2 border-indigo-400 rounded-r p-2 text-xs text-indigo-900">
                                  <b>⚖️ Verdict:</b> {f.verdict}
                                </div>
                              {/if}
                            </div>
                          {/if}
                          {#if output.desired_outcomes?.length}
                            <div>
                              <div class="text-xs font-bold text-dark-900/60 uppercase tracking-wide mb-2.5">📏 Desired Outcomes ({output.desired_outcomes.length})</div>
                              <div class="space-y-1.5">
                                {#each output.desired_outcomes.slice(0, 6) as o}
                                  <div class="bg-white border border-dark-200 rounded p-2.5 text-xs">
                                    <div class="flex items-center gap-2 mb-1">
                                      <span class="px-1.5 py-0.5 rounded text-[10px] bg-dark-100 font-bold">Opp: {o.opportunity_score}/10</span>
                                      <span class="text-dark-900/60">I={o.importance} · S={o.satisfaction_current}</span>
                                    </div>
                                    <div class="font-mono text-sm text-dark-900">{o.outcome}</div>
                                    {#if o.why}<div class="text-dark-900/70 mt-0.5">{o.why}</div>{/if}
                                  </div>
                                {/each}
                              </div>
                            </div>
                          {/if}
                          {#if output.customer_decision_timeline?.length}
                            <div>
                              <div class="text-xs font-bold text-dark-900/60 uppercase tracking-wide mb-2.5">⏱️ Decision Timeline</div>
                              <div class="space-y-1.5">
                                {#each output.customer_decision_timeline as t}
                                  <div class="bg-white border border-dark-200 rounded p-2.5 text-xs">
                                    <div class="font-bold text-primary-700">💡 {t.stage_name_th || t.stage}</div>
                                    {#if t.customer_thinks}<div class="text-dark-900/80">💭 {t.customer_thinks}</div>{/if}
                                    {#if t.marketing_opportunity}
                                      <div class="bg-primary-50 border-l-2 border-primary-400 rounded-r p-1.5 mt-1 text-primary-900">
                                        <b>📣</b> {t.marketing_opportunity}
                                      </div>
                                    {/if}
                                  </div>
                                {/each}
                              </div>
                            </div>
                          {/if}
                          {#if output.triggers?.length}
                            <div>
                              <div class="text-xs font-bold text-dark-900/60 uppercase tracking-wide mb-2.5">⚡ Triggers</div>
                              <div class="grid sm:grid-cols-2 gap-2">
                                {#each output.triggers as t}
                                  <div class="bg-white border border-dark-200 rounded p-2.5 text-xs">
                                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{t.type}</span>
                                    <div class="text-sm font-medium text-dark-900 mt-1">{t.event}</div>
                                  </div>
                                {/each}
                              </div>
                            </div>
                          {/if}
                          {#if output.deep_research_insights?.key_insights?.length}
                            <div class="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-300 rounded-lg p-4">
                              <div class="text-xs font-bold text-purple-700 uppercase tracking-wide mb-2">🧠 Deep Research Insights</div>
                              <div class="space-y-1.5 text-sm text-purple-900">
                                {#each output.deep_research_insights.key_insights as ki}
                                  <div class="bg-white rounded p-2 border border-purple-200">💡 {ki}</div>
                                {/each}
                              </div>
                            </div>
                          {/if}
                          {#if output.next_steps?.length}
                            <div class="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-3">
                              <div class="text-xs font-bold text-emerald-800 uppercase mb-1.5">➡️ Next Steps</div>
                              <ul class="space-y-0.5 text-xs text-emerald-900">{#each output.next_steps as s}<li>• {s}</li>{/each}</ul>
                            </div>
                          {/if}
                          {#if output.reasoning}
                            <div class="bg-white border border-dark-200 rounded-lg p-4 text-sm italic text-dark-900/70">
                              💡 {output.reasoning}
                            </div>
                          {/if}

                        {:else if save.tool_type === 'value_proposition_canvas'}
                          <!-- VPC rendering -->
                          {#if output.summary}
                            <div class="bg-white border border-dark-200 rounded-lg p-4">
                              <div class="text-xs font-bold text-primary-700 uppercase tracking-wide mb-1.5">Summary</div>
                              <p class="text-sm text-dark-900/90 leading-relaxed">{output.summary}</p>
                            </div>
                          {/if}
                          {#if output.customer_segment}
                            <div class="bg-blue-50 border-l-4 border-blue-500 rounded-r p-3">
                              <div class="text-xs font-bold text-blue-700 uppercase mb-1">👤 Customer Segment</div>
                              <div class="text-sm font-semibold text-blue-900">{output.customer_segment.name || '-'}</div>
                              {#if output.customer_segment.description}
                                <div class="text-xs text-blue-800 mt-0.5">{output.customer_segment.description}</div>
                              {/if}
                            </div>
                          {/if}
                          <div class="grid sm:grid-cols-2 gap-3">
                            <!-- Customer Profile -->
                            <div class="space-y-2">
                              <div class="text-xs font-bold text-dark-900/60 uppercase">👤 Customer Profile</div>
                              {#if output.customer_profile?.jobs?.length}
                                <div class="bg-blue-50 border border-blue-200 rounded p-2.5 text-xs">
                                  <div class="font-bold text-blue-800 mb-1">🔧 Jobs ({output.customer_profile.jobs.length})</div>
                                  <ul class="space-y-0.5 text-blue-900">{#each output.customer_profile.jobs as j}<li>• {j.job} <span class="text-[10px] text-blue-700">[{j.importance}]</span></li>{/each}</ul>
                                </div>
                              {/if}
                              {#if output.customer_profile?.pains?.length}
                                <div class="bg-red-50 border border-red-200 rounded p-2.5 text-xs">
                                  <div class="font-bold text-red-800 mb-1">😰 Pains ({output.customer_profile.pains.length})</div>
                                  <ul class="space-y-0.5 text-red-900">{#each output.customer_profile.pains as p}<li>• {p.pain} <span class="text-[10px] text-red-700">[{p.intensity}]</span></li>{/each}</ul>
                                </div>
                              {/if}
                              {#if output.customer_profile?.gains?.length}
                                <div class="bg-emerald-50 border border-emerald-200 rounded p-2.5 text-xs">
                                  <div class="font-bold text-emerald-800 mb-1">✨ Gains ({output.customer_profile.gains.length})</div>
                                  <ul class="space-y-0.5 text-emerald-900">{#each output.customer_profile.gains as g}<li>• {g.gain} <span class="text-[10px] text-emerald-700">[{g.relevance}]</span></li>{/each}</ul>
                                </div>
                              {/if}
                            </div>
                            <!-- Value Map -->
                            <div class="space-y-2">
                              <div class="text-xs font-bold text-dark-900/60 uppercase">🗺️ Value Map</div>
                              {#if output.value_map?.products_services?.length}
                                <div class="bg-purple-50 border border-purple-200 rounded p-2.5 text-xs">
                                  <div class="font-bold text-purple-800 mb-1">📦 Products ({output.value_map.products_services.length})</div>
                                  <ul class="space-y-0.5 text-purple-900">{#each output.value_map.products_services as ps}<li>• <b>{ps.name}</b>: {ps.description}</li>{/each}</ul>
                                </div>
                              {/if}
                              {#if output.value_map?.pain_relievers?.length}
                                <div class="bg-orange-50 border border-orange-200 rounded p-2.5 text-xs">
                                  <div class="font-bold text-orange-800 mb-1">💊 Pain Relievers ({output.value_map.pain_relievers.length})</div>
                                  <ul class="space-y-0.5 text-orange-900">{#each output.value_map.pain_relievers as r}<li>• {r.reliever} <span class="text-[10px] text-orange-700">[{r.pattern}]</span></li>{/each}</ul>
                                </div>
                              {/if}
                              {#if output.value_map?.gain_creators?.length}
                                <div class="bg-teal-50 border border-teal-200 rounded p-2.5 text-xs">
                                  <div class="font-bold text-teal-800 mb-1">🎁 Gain Creators ({output.value_map.gain_creators.length})</div>
                                  <ul class="space-y-0.5 text-teal-900">{#each output.value_map.gain_creators as c}<li>• {c.creator} <span class="text-[10px] text-teal-700">[{c.pattern}]</span></li>{/each}</ul>
                                </div>
                              {/if}
                            </div>
                          </div>
                          {#if output.fit_analysis}
                            {@const fa = output.fit_analysis}
                            <div class="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300 rounded-lg p-3">
                              <div class="flex items-center gap-2 mb-2">
                                <div class="text-xs font-bold text-indigo-700">⚖️ Fit:</div>
                                <span class="px-2 py-0.5 rounded text-sm font-bold {fa.overall_fit_score >= 7 ? 'bg-emerald-100 text-emerald-800' : fa.overall_fit_score >= 5 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}">
                                  {fa.overall_fit_score || '-'}/10 — {fa.fit_verdict || '-'}
                                </span>
                              </div>
                              {#if fa.uncovered_pains?.length}
                                <div class="text-xs text-rose-800 mb-1"><b>⚠️ Uncovered Pains:</b> {fa.uncovered_pains.length} ข้อ</div>
                              {/if}
                              {#if fa.uncovered_gains?.length}
                                <div class="text-xs text-rose-800 mb-1"><b>⚠️ Uncovered Gains:</b> {fa.uncovered_gains.length} ข้อ</div>
                              {/if}
                              {#if fa.orphans?.length}
                                <div class="text-xs text-amber-800"><b>🗑️ Orphans:</b> {fa.orphans.length} ข้อ</div>
                              {/if}
                            </div>
                          {/if}
                          {#if output.value_proposition_statement}
                            <div class="bg-rose-50 border-2 border-rose-300 rounded-lg p-3">
                              <div class="text-xs font-bold text-rose-800 uppercase mb-1">💎 Value Proposition Statement</div>
                              <div class="text-sm italic text-rose-900">"{output.value_proposition_statement}"</div>
                            </div>
                          {/if}
                          {#if output.elevator_pitch}
                            <div class="bg-amber-50 border-l-4 border-amber-400 rounded-r p-2.5 text-xs">
                              <b>⏱️ Elevator Pitch:</b> <span class="italic">{output.elevator_pitch}</span>
                            </div>
                          {/if}
                          {#if output.next_steps?.length}
                            <div class="bg-emerald-50 border border-emerald-200 rounded p-2.5 text-xs">
                              <div class="font-bold text-emerald-800 mb-1">➡️ Next Steps</div>
                              <ul class="text-emerald-900">{#each output.next_steps as s}<li>→ {s}</li>{/each}</ul>
                            </div>
                          {/if}

                        {:else if save.tool_type === 'business_model_canvas'}
                          <!-- BMC rendering -->
                          {#if output.summary}
                            <div class="bg-white border border-dark-200 rounded-lg p-4">
                              <div class="text-xs font-bold text-primary-700 uppercase tracking-wide mb-1.5">Summary</div>
                              <p class="text-sm text-dark-900/90 leading-relaxed">{output.summary}</p>
                            </div>
                          {/if}

                          {#if output.executive_insight}
                            <div class="bg-indigo-50 border-l-4 border-indigo-500 p-3 rounded text-xs italic text-indigo-900">
                              💡 {output.executive_insight}
                            </div>
                          {/if}

                          {#if output.business_model_pattern}
                            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-semibold">
                              🏷️ Pattern: {output.business_model_pattern}
                            </div>
                          {/if}

                          <!-- CS + VP (Desirability) -->
                          <div class="grid md:grid-cols-2 gap-3">
                            <div class="bg-blue-50 border-l-4 border-blue-500 rounded p-3">
                              <div class="text-xs font-bold text-blue-800 uppercase mb-1.5">👥 Customer Segments ({output.customer_segments?.length || 0})</div>
                              <div class="space-y-1.5">
                                {#each (output.customer_segments || []) as s}
                                  <div class="bg-white rounded p-2 text-xs">
                                    <div class="flex items-center gap-1.5 mb-0.5">
                                      <span class="px-1.5 py-0.5 rounded text-[10px] border {s.priority === 'primary' ? 'bg-red-100 text-red-800 border-red-300' : s.priority === 'secondary' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-blue-100 text-blue-800 border-blue-300'}">{s.priority}</span>
                                    </div>
                                    <div class="font-semibold text-blue-900">{s.name}</div>
                                    <div class="text-blue-800 text-[11px] mt-0.5">{s.description}</div>
                                  </div>
                                {/each}
                              </div>
                            </div>
                            <div class="bg-purple-50 border-l-4 border-purple-500 rounded p-3">
                              <div class="text-xs font-bold text-purple-800 uppercase mb-1.5">💎 Value Propositions ({output.value_propositions?.length || 0})</div>
                              <div class="space-y-1.5">
                                {#each (output.value_propositions || []) as v}
                                  <div class="bg-white rounded p-2 text-xs">
                                    <div class="font-semibold text-purple-900">{v.vp_title}</div>
                                    <div class="text-purple-800 text-[11px] italic mt-0.5">"{v.vp_statement}"</div>
                                    {#if v.differentiator}<div class="text-purple-700 text-[10px] mt-0.5">⭐ {v.differentiator}</div>{/if}
                                  </div>
                                {/each}
                              </div>
                            </div>
                          </div>

                          <!-- Channels + CR -->
                          <div class="grid md:grid-cols-2 gap-3">
                            <div class="bg-teal-50 border-l-4 border-teal-500 rounded p-3">
                              <div class="text-xs font-bold text-teal-800 uppercase mb-1.5">📡 Channels ({output.channels?.length || 0})</div>
                              <div class="space-y-1.5">
                                {#each (output.channels || []) as ch}
                                  <div class="bg-white rounded p-2 text-xs">
                                    <div class="flex items-center gap-1.5 mb-0.5">
                                      <span class="px-1.5 py-0.5 rounded text-[10px] border {ch.effectiveness === 'high' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : ch.effectiveness === 'medium' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-red-100 text-red-800 border-red-300'}">{ch.effectiveness}</span>
                                      <span class="text-[10px] text-dark-900/60">[{ch.phase}]</span>
                                    </div>
                                    <div class="font-semibold text-teal-900">{ch.channel_name}</div>
                                    {#if ch.notes}<div class="text-teal-800 text-[10px] mt-0.5">{ch.notes}</div>{/if}
                                  </div>
                                {/each}
                              </div>
                            </div>
                            <div class="bg-cyan-50 border-l-4 border-cyan-500 rounded p-3">
                              <div class="text-xs font-bold text-cyan-800 uppercase mb-1.5">🤝 Customer Relationships ({output.customer_relationships?.length || 0})</div>
                              <div class="space-y-1.5">
                                {#each (output.customer_relationships || []) as r}
                                  <div class="bg-white rounded p-2 text-xs">
                                    <div class="font-semibold text-cyan-900">→ {r.segment}</div>
                                    <div class="text-cyan-800 text-[10px] mt-0.5">[{r.type}] [{r.motivation}] {r.intensity}</div>
                                    {#if r.example}<div class="text-cyan-700 text-[10px] italic mt-0.5">"{r.example}"</div>{/if}
                                  </div>
                                {/each}
                              </div>
                            </div>
                          </div>

                          <!-- KR + KA + KP -->
                          <div class="grid md:grid-cols-3 gap-3">
                            <div class="bg-amber-50 border-l-4 border-amber-500 rounded p-3">
                              <div class="text-xs font-bold text-amber-800 uppercase mb-1.5">🔧 Key Resources ({output.key_resources?.length || 0})</div>
                              <ul class="space-y-0.5 text-xs text-amber-900">
                                {#each (output.key_resources || []) as r}
                                  <li class="bg-white rounded p-1.5 mb-0.5">
                                    <span class="text-[10px] text-amber-700/70">[{r.importance}] [{r.type}]</span><br />
                                    {r.description}
                                  </li>
                                {/each}
                              </ul>
                            </div>
                            <div class="bg-orange-50 border-l-4 border-orange-500 rounded p-3">
                              <div class="text-xs font-bold text-orange-800 uppercase mb-1.5">⚙️ Key Activities ({output.key_activities?.length || 0})</div>
                              <ul class="space-y-0.5 text-xs text-orange-900">
                                {#each (output.key_activities || []) as a}
                                  <li class="bg-white rounded p-1.5 mb-0.5">
                                    <span class="text-[10px] text-orange-700/70">[{a.importance}] [{a.type}]</span><br />
                                    {a.description}
                                  </li>
                                {/each}
                              </ul>
                            </div>
                            <div class="bg-pink-50 border-l-4 border-pink-500 rounded p-3">
                              <div class="text-xs font-bold text-pink-800 uppercase mb-1.5">🤝 Key Partnerships ({output.key_partnerships?.length || 0})</div>
                              <ul class="space-y-0.5 text-xs text-pink-900">
                                {#each (output.key_partnerships || []) as p}
                                  <li class="bg-white rounded p-1.5 mb-0.5">
                                    <div class="font-semibold">{p.partner_type}</div>
                                    <div class="text-[10px] text-pink-700/70">[{p.type}] {p.motivation}</div>
                                    {#if p.value_exchange}<div class="text-[10px] mt-0.5">⇄ {p.value_exchange}</div>{/if}
                                  </li>
                                {/each}
                              </ul>
                            </div>
                          </div>

                          <!-- Revenue + Cost (Viability) -->
                          <div class="grid md:grid-cols-2 gap-3">
                            <div class="bg-emerald-50 border-l-4 border-emerald-500 rounded p-3">
                              <div class="text-xs font-bold text-emerald-800 uppercase mb-1.5">💰 Revenue Streams ({output.revenue_streams?.length || 0})</div>
                              <div class="space-y-1.5">
                                {#each (output.revenue_streams || []) as r}
                                  <div class="bg-white rounded p-2 text-xs">
                                    <div class="font-semibold text-emerald-900">{r.description}</div>
                                    <div class="text-emerald-700 text-[10px] mt-0.5">[{r.type}] [{r.pricing_model}] {r.estimated_share}</div>
                                    <div class="text-emerald-800 text-[10px]">💵 {r.price_range}</div>
                                  </div>
                                {/each}
                              </div>
                            </div>
                            {#if output.cost_structure}
                              {@const cs = output.cost_structure}
                              <div class="bg-red-50 border-l-4 border-red-500 rounded p-3">
                                <div class="text-xs font-bold text-red-800 uppercase mb-1.5">📊 Cost Structure</div>
                                <div class="space-y-1.5">
                                  <div class="flex items-center gap-1.5 flex-wrap text-xs">
                                    <span class="px-1.5 py-0.5 rounded text-[10px] border bg-white">{cs.model}</span>
                                    <span class="px-1.5 py-0.5 rounded text-[10px] border bg-white">Margin: {cs.estimated_margin_profile}</span>
                                    {#if cs.economies_of_scale}<span class="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 border-blue-300">Scale ✓</span>{/if}
                                    {#if cs.economies_of_scope}<span class="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 border-blue-300">Scope ✓</span>{/if}
                                  </div>
                                  {#if cs.major_fixed_costs?.length}
                                    <div>
                                      <div class="text-[10px] font-bold text-red-800 uppercase mb-0.5">Fixed:</div>
                                      {#each cs.major_fixed_costs as c}<div class="bg-white rounded p-1.5 text-xs text-red-900 mb-0.5">{c.description} ({c.estimated_share})</div>{/each}
                                    </div>
                                  {/if}
                                  {#if cs.major_variable_costs?.length}
                                    <div>
                                      <div class="text-[10px] font-bold text-red-800 uppercase mb-0.5">Variable:</div>
                                      {#each cs.major_variable_costs as c}<div class="bg-white rounded p-1.5 text-xs text-red-900 mb-0.5">{c.description} ({c.estimated_share})</div>{/each}
                                    </div>
                                  {/if}
                                </div>
                              </div>
                            {/if}
                          </div>

                          <!-- SWOT -->
                          {#if output.swot_summary}
                            <div class="bg-slate-50 border border-slate-300 rounded p-3">
                              <div class="text-xs font-bold text-slate-800 uppercase mb-1.5">🎯 SWOT</div>
                              <div class="grid grid-cols-2 gap-2 text-xs">
                                <div class="bg-emerald-50 border-l-2 border-emerald-500 rounded p-1.5">
                                  <div class="font-bold text-emerald-800 mb-0.5">💪 Strengths</div>
                                  <ul class="text-emerald-900 space-y-0.5">{#each (output.swot_summary.strengths || []) as s}<li>• {s}</li>{/each}</ul>
                                </div>
                                <div class="bg-amber-50 border-l-2 border-amber-500 rounded p-1.5">
                                  <div class="font-bold text-amber-800 mb-0.5">⚠️ Weaknesses</div>
                                  <ul class="text-amber-900 space-y-0.5">{#each (output.swot_summary.weaknesses || []) as w}<li>• {w}</li>{/each}</ul>
                                </div>
                                <div class="bg-blue-50 border-l-2 border-blue-500 rounded p-1.5">
                                  <div class="font-bold text-blue-800 mb-0.5">🚀 Opportunities</div>
                                  <ul class="text-blue-900 space-y-0.5">{#each (output.swot_summary.opportunities || []) as o}<li>• {o}</li>{/each}</ul>
                                </div>
                                <div class="bg-red-50 border-l-2 border-red-500 rounded p-1.5">
                                  <div class="font-bold text-red-800 mb-0.5">⚡ Threats</div>
                                  <ul class="text-red-900 space-y-0.5">{#each (output.swot_summary.threats || []) as t}<li>• {t}</li>{/each}</ul>
                                </div>
                              </div>
                            </div>
                          {/if}

                          {#if output.key_assumptions?.length}
                            <div class="bg-rose-50 border border-rose-200 rounded p-2.5 text-xs">
                              <div class="font-bold text-rose-800 mb-1">🧪 Key Assumptions</div>
                              <ul class="text-rose-900 space-y-0.5">
                                {#each output.key_assumptions as a}
                                  <li>• <b>{a.assumption}</b> [{a.risk_level}] → ทดสอบ: {a.how_to_test}</li>
                                {/each}
                              </ul>
                            </div>
                          {/if}

                          {#if output.next_steps?.length}
                            <div class="bg-emerald-50 border border-emerald-200 rounded p-2.5 text-xs">
                              <div class="font-bold text-emerald-800 mb-1">➡️ Next Steps</div>
                              <ul class="text-emerald-900">{#each output.next_steps as s}<li>→ {s}</li>{/each}</ul>
                            </div>
                          {/if}

                        {:else if save.tool_type === 'million_dollar_offer'}
                          <!-- Million Dollar Offer rendering -->
                          {#if output.summary}
                            <div class="bg-white border border-dark-200 rounded-lg p-4">
                              <div class="text-xs font-bold text-primary-700 uppercase tracking-wide mb-1.5">Summary</div>
                              <p class="text-sm text-dark-900/90 leading-relaxed">{output.summary}</p>
                            </div>
                          {/if}

                          {#if output.what_makes_it_unbeatable}
                            <div class="bg-amber-50 border-l-4 border-amber-500 p-3 rounded text-xs italic text-amber-900">
                              💎 {output.what_makes_it_unbeatable}
                            </div>
                          {/if}

                          {#if output.value_equation_audit}
                            {@const ve = output.value_equation_audit}
                            <div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
                              <div class="text-xs font-bold text-amber-800 uppercase mb-2">⚖️ Value Equation</div>
                              <div class="grid grid-cols-4 gap-1.5 text-xs">
                                {#each [
                                  { key: 'dream_outcome', label: '🎯 DO', dir: '↑' },
                                  { key: 'perceived_likelihood', label: '💪 PL', dir: '↑' },
                                  { key: 'time_delay', label: '⏱️ TD', dir: '↓' },
                                  { key: 'effort_sacrifice', label: '💪 ES', dir: '↓' },
                                ] as l}
                                  <div class="bg-white rounded p-1.5 text-center">
                                    <div class="text-[10px] text-amber-700">{l.label} {l.dir}</div>
                                    <div class="text-base font-bold {ve[l.key]?.score >= 7 ? 'text-emerald-600' : ve[l.key]?.score >= 5 ? 'text-amber-600' : 'text-red-600'}">{ve[l.key]?.score || '-'}/10</div>
                                  </div>
                                {/each}
                              </div>
                              {#if ve.binding_constraint}
                                <div class="text-xs text-red-800 mt-2">⚠️ <b>Binding:</b> {ve.binding_constraint}</div>
                              {/if}
                            </div>
                          {/if}

                          {#if output.dream_outcome}
                            {@const dr = output.dream_outcome}
                            <div class="bg-amber-50 border border-amber-300 rounded p-3 text-sm">
                              <div class="text-xs font-bold text-amber-800 uppercase mb-1">🎯 Dream Outcome</div>
                              <div class="bg-white rounded p-2 text-amber-900 font-semibold">"{dr.specific_description || '-'}"</div>
                              {#if dr.by_when}<div class="text-xs text-amber-800 mt-1">⏱️ {dr.by_when}</div>{/if}
                            </div>
                          {/if}

                          {#if output.value_stack?.length}
                            <div class="bg-amber-50 border border-amber-200 rounded p-3">
                              <div class="text-xs font-bold text-amber-800 uppercase mb-2">📚 Value Stack ({output.value_stack.length})</div>
                              <div class="space-y-1.5">
                                {#each output.value_stack as v}
                                  <div class="rounded p-2 text-xs {v.is_core ? 'bg-amber-100 border-2 border-amber-400' : 'bg-white'}">
                                    <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                      <span class="px-1.5 py-0.5 rounded text-[10px] border {v.is_core ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 border-amber-300'}">{v.is_core ? '⭐ Core' : '🎁 Bonus'}</span>
                                      <span class="text-[10px] text-amber-700">cost: {v.cost_to_deliver}</span>
                                      <span class="ml-auto text-sm font-bold text-amber-700">{v.perceived_value}</span>
                                    </div>
                                    <div class="font-semibold text-amber-900">{v.name}</div>
                                    {#if v.addresses_obstacle}<div class="text-[10px] text-emerald-700 mt-0.5">→ {v.addresses_obstacle}</div>{/if}
                                  </div>
                                {/each}
                              </div>
                            </div>
                          {/if}

                          {#if output.pricing}
                            {@const pr = output.pricing}
                            <div class="bg-emerald-50 border border-emerald-300 rounded p-3 text-sm">
                              <div class="text-xs font-bold text-emerald-800 uppercase mb-2">💰 Pricing</div>
                              <div class="flex items-center gap-2 flex-wrap">
                                <div class="bg-white rounded p-2 text-center">
                                  <div class="text-[10px] text-emerald-700">Price</div>
                                  <div class="text-base font-bold text-emerald-900">{pr.recommended_price || '-'}</div>
                                </div>
                                <div class="bg-white rounded p-2 text-center border-2 {pr.value_to_price_ratio?.startsWith('5:') || pr.value_to_price_ratio?.startsWith('6:') || pr.value_to_price_ratio?.startsWith('7:') || pr.value_to_price_ratio?.startsWith('8:') || pr.value_to_price_ratio?.startsWith('9:') || pr.value_to_price_ratio?.startsWith('10:') ? 'border-emerald-400' : 'border-amber-300'}">
                                  <div class="text-[10px] text-emerald-700">Ratio</div>
                                  <div class="text-base font-bold text-emerald-900">{pr.value_to_price_ratio || '?'}</div>
                                </div>
                                {#if pr.anchor_price}
                                  <div class="bg-white rounded p-2 text-center">
                                    <div class="text-[10px] text-emerald-700">vs Anchor</div>
                                    <div class="text-sm text-dark-900/60 line-through">{pr.anchor_price}</div>
                                  </div>
                                {/if}
                              </div>
                            </div>
                          {/if}

                          {#if output.guarantee}
                            {@const g = output.guarantee}
                            <div class="bg-blue-50 border border-blue-300 rounded p-3 text-sm">
                              <div class="text-xs font-bold text-blue-800 uppercase mb-1">🛡️ Guarantee</div>
                              <div class="bg-white rounded p-2 border border-blue-200">
                                <div class="text-[10px] text-blue-700 uppercase">{g.type}</div>
                                <div class="font-bold text-blue-900">"{g.name || '-'}"</div>
                                <div class="text-xs text-blue-800 mt-1">{g.terms || '-'}</div>
                                <div class="text-[10px] text-blue-700 mt-1">⏱️ {g.duration || '-'}</div>
                              </div>
                            </div>
                          {/if}

                          {#if output.offer_name}
                            {@const n = output.offer_name}
                            <div class="bg-amber-50 border-2 border-amber-400 rounded-lg p-3 text-center">
                              <div class="text-xs font-bold text-amber-800 uppercase mb-1">🏷️ Offer Name (MAGIC)</div>
                              <div class="text-xl font-bold text-amber-900">"{n.full_name || '-'}"</div>
                              <div class="grid grid-cols-5 gap-1 mt-2 text-[10px]">
                                <div class="bg-white rounded p-1"><b>M</b><br/>{n.magnet || '-'}</div>
                                <div class="bg-white rounded p-1"><b>A</b><br/>{n.avatar || '-'}</div>
                                <div class="bg-white rounded p-1"><b>G</b><br/>{n.goal || '-'}</div>
                                <div class="bg-white rounded p-1"><b>I</b><br/>{n.interval || '-'}</div>
                                <div class="bg-white rounded p-1"><b>C</b><br/>{n.container || '-'}</div>
                              </div>
                            </div>
                          {/if}

                          {#if output.next_steps?.length}
                            <div class="bg-emerald-50 border border-emerald-200 rounded p-2.5 text-xs">
                              <div class="font-bold text-emerald-800 mb-1">➡️ Next Steps</div>
                              <ul class="text-emerald-900">{#each output.next_steps as s}<li>→ {s}</li>{/each}</ul>
                            </div>
                          {/if}

                        {:else if save.tool_type === 'objection_handler'}
                          <!-- Objection Handler rendering -->
                          {#if output.summary}
                            <div class="bg-white border border-dark-200 rounded-lg p-4">
                              <div class="text-xs font-bold text-primary-700 uppercase tracking-wide mb-1.5">Summary</div>
                              <p class="text-sm text-dark-900/90">{output.summary}</p>
                            </div>
                          {/if}

                          {#if output.objections?.length}
                            <div class="space-y-2">
                              <div class="text-xs font-bold text-rose-800 uppercase">🎯 Objections ({output.objections.length})</div>
                              {#each output.objections as o, i}
                                <div class="bg-white border-2 border-rose-200 rounded-lg p-3">
                                  <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                                    <span class="text-[10px] text-rose-700 font-bold">#{i + 1}</span>
                                    <span class="px-1.5 py-0.5 rounded text-[10px] border bg-rose-100 text-rose-800 border-rose-300">{o.category}</span>
                                    <span class="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border-amber-300">{o.reframe_strategy}</span>
                                  </div>
                                  <div class="font-semibold text-rose-900 text-sm mb-1">{o.objection}</div>
                                  <div class="bg-rose-50 rounded p-2 text-xs italic text-rose-800 mb-1">💬 "{o.what_customer_says}"</div>
                                  <div class="bg-emerald-50 border-l-2 border-emerald-500 rounded-r p-2 text-xs text-emerald-900 mb-1">
                                    <b>✅ Response:</b> {o.response_script}
                                  </div>
                                  {#if o.evidence_to_provide?.length}
                                    <div class="text-[10px] text-blue-700 mt-1">📊 <b>Evidence:</b> {o.evidence_to_provide.join(' · ')}</div>
                                  {/if}
                                  {#if o.bridge_to_close}
                                    <div class="text-[10px] text-purple-700 mt-1">🌉 <b>Bridge:</b> {o.bridge_to_close}</div>
                                  {/if}
                                </div>
                              {/each}
                            </div>
                          {/if}

                          {#if output.do_dont}
                            <div class="grid md:grid-cols-2 gap-2 text-xs">
                              <div class="bg-emerald-50 border border-emerald-200 rounded p-2">
                                <div class="font-bold text-emerald-800 mb-1">✅ Do</div>
                                <ul class="text-emerald-900 space-y-0.5">{#each (output.do_dont.do || []) as d}<li>✓ {d}</li>{/each}</ul>
                              </div>
                              <div class="bg-red-50 border border-red-200 rounded p-2">
                                <div class="font-bold text-red-800 mb-1">❌ Don't</div>
                                <ul class="text-red-900 space-y-0.5">{#each (output.do_dont.dont || []) as d}<li>✗ {d}</li>{/each}</ul>
                              </div>
                            </div>
                          {/if}

                          {#if output.faq_top_5?.length}
                            <div class="bg-white border border-rose-200 rounded p-2.5 text-xs">
                              <div class="font-bold text-rose-800 mb-1.5">❓ FAQ Top 5</div>
                              <div class="space-y-1">
                                {#each output.faq_top_5 as f, i}
                                  <div class="border-l-2 border-rose-400 bg-rose-50 rounded-r p-1.5">
                                    <div class="text-rose-900"><b>Q{i + 1}:</b> {f.q}</div>
                                    <div class="text-rose-800 text-[10px] mt-0.5">→ {f.a}</div>
                                  </div>
                                {/each}
                              </div>
                            </div>
                          {/if}

                          {#if output.next_steps?.length}
                            <div class="bg-emerald-50 border border-emerald-200 rounded p-2.5 text-xs">
                              <div class="font-bold text-emerald-800 mb-1">➡️ Next Steps</div>
                              <ul class="text-emerald-900">{#each output.next_steps as s}<li>→ {s}</li>{/each}</ul>
                            </div>
                          {/if}

                        {:else if save.tool_type === 'hook_library'}
                          <!-- Hook Library rendering -->
                          {#if output.summary}
                            <div class="bg-white border border-dark-200 rounded-lg p-4">
                              <div class="text-xs font-bold text-primary-700 uppercase tracking-wide mb-1.5">Summary</div>
                              <p class="text-sm text-dark-900/90">{output.summary}</p>
                            </div>
                          {/if}

                          {#if output.brand_voice_summary}
                            <div class="bg-teal-50 border-l-4 border-teal-500 p-3 rounded text-xs italic text-teal-900">
                              🎙️ {output.brand_voice_summary}
                            </div>
                          {/if}

                          {#if output.headlines_5?.length}
                            <div class="bg-amber-50 border border-amber-200 rounded p-3">
                              <div class="text-xs font-bold text-amber-800 mb-1.5">📰 Headlines A/B Test</div>
                              <div class="space-y-1">
                                {#each output.headlines_5 as h, i}
                                  <div class="bg-white rounded p-1.5 text-xs text-amber-900 border-l-2 border-amber-400">
                                    <span class="font-bold">#{i + 1}:</span> {h}
                                  </div>
                                {/each}
                              </div>
                            </div>
                          {/if}

                          {#if output.hook_categories?.length}
                            <div class="text-xs font-bold text-teal-800 uppercase">🎣 Hook Categories ({output.hook_categories.length})</div>
                            <div class="space-y-2">
                              {#each output.hook_categories as cat}
                                <div class="bg-teal-50 border border-teal-200 rounded p-2.5 text-xs">
                                  <div class="font-bold text-teal-900 mb-1.5">📌 {cat.thai_label || cat.name}</div>
                                  <div class="space-y-1">
                                    {#each (cat.examples || []).slice(0, 3) as ex}
                                      <div class="bg-white rounded p-1.5 border-l-2 border-teal-400">
                                        <div class="text-teal-900 italic">"{ex.hook}"</div>
                                        <div class="text-[10px] text-teal-700 mt-0.5">→ {ex.best_for} · CTA: {ex.cta}</div>
                                      </div>
                                    {/each}
                                  </div>
                                </div>
                              {/each}
                            </div>
                          {/if}

                          {#if output.platform_specific && Object.keys(output.platform_specific).length > 0}
                            <div class="bg-cyan-50 border border-cyan-200 rounded p-3">
                              <div class="text-xs font-bold text-cyan-800 mb-1.5">📱 Platform Hooks</div>
                              <div class="grid grid-cols-2 gap-1.5 text-[10px]">
                                {#each Object.entries(output.platform_specific) as [platform, hooks]}
                                  <div class="bg-white rounded p-1.5">
                                    <div class="font-bold text-cyan-900">{platform}</div>
                                    <ul class="text-cyan-800 mt-0.5">{#each (hooks as string[]).slice(0, 2) as h}<li>• {h.slice(0, 60)}...</li>{/each}</ul>
                                  </div>
                                {/each}
                              </div>
                            </div>
                          {/if}

                          {#if output.ab_testing_tips?.length}
                            <div class="bg-indigo-50 border border-indigo-200 rounded p-2.5 text-xs">
                              <div class="font-bold text-indigo-800 mb-1">🧪 A/B Testing Tips</div>
                              <ul class="text-indigo-900">{#each output.ab_testing_tips as t}<li>✓ {t}</li>{/each}</ul>
                            </div>
                          {/if}

                          {#if output.next_steps?.length}
                            <div class="bg-emerald-50 border border-emerald-200 rounded p-2.5 text-xs">
                              <div class="font-bold text-emerald-800 mb-1">➡️ Next Steps</div>
                              <ul class="text-emerald-900">{#each output.next_steps as s}<li>→ {s}</li>{/each}</ul>
                            </div>
                          {/if}

                        {:else}
                          <pre class="whitespace-pre-wrap break-words font-mono bg-white border border-dark-200 rounded-lg p-3 text-xs">{JSON.stringify(output, null, 2)}</pre>
                        {/if}
                      </div>
                    </div>
                  {/if}
                {:else}
                  <div class="text-center text-sm text-dark-900/60 py-4">ไม่มีข้อมูล</div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>
