<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { initAuth, isAuthed } from '$lib/auth';
  import { getMcpServerUrl } from '$lib/api';

  onMount(async () => {
    await initAuth();
    if (!$isAuthed) goto('/login');
  });

  const mcpUrl = getMcpServerUrl();

  const tools = [
    {
      name: 'list_projects',
      desc: 'ดูรายการแผนทั้งหมดของบัญชีนี้',
      credits: false,
      params: [
        { name: 'kind', type: 'string', required: false, note: 'กรองตามประเภท: playbook / brand_voice / pain_points / persona' },
        { name: 'status', type: 'string', required: false, note: 'กรองตามสถานะ: draft / completed / archived' },
      ],
      example: '{}',
      response: `{
  "projects": [
    {
      "id": "8f2a...",
      "name": "ร้านกาแฟลุงมี",
      "current_step": 3,
      "status": "draft",
      "kind": "playbook",
      "created_at": 1785200000000,
      "updated_at": 1785280000000
    }
  ]
}`,
    },
    {
      name: 'create_project',
      desc: 'สร้างแผนใหม่ — คืนค่า id ที่ต้องใช้กับ generate_step และ get_export ต่อ',
      credits: false,
      params: [
        { name: 'name', type: 'string', required: true, note: 'ชื่อธุรกิจ/แผน' },
        { name: 'industry', type: 'string', required: false, note: '' },
        { name: 'kind', type: 'string', required: false, note: 'default: playbook — หรือ brand_voice / pain_points / persona' },
      ],
      example: `{
  "name": "ร้านกาแฟลุงมี",
  "industry": "F&B"
}`,
      response: `{
  "ok": true,
  "project": {
    "id": "8f2a...",
    "name": "ร้านกาแฟลุงมี",
    "current_step": 1,
    "status": "draft",
    "kind": "playbook"
  }
}`,
    },
    {
      name: 'generate_step',
      desc: 'ให้ระบบอัจฉริยะสร้างเนื้อหา 1 ใน 7 ขั้นของแผน (ใช้เครดิต)',
      credits: true,
      params: [
        { name: 'project_id', type: 'string', required: true, note: '' },
        { name: 'step', type: 'integer (1-7)', required: true, note: 'ขั้นที่ 1=ตัวตนธุรกิจ ... 7=วัดผล (KPI) — ดูรายละเอียดที่หน้าแผนของคุณ' },
        { name: 'input', type: 'object', required: true, note: 'ฟิลด์ขึ้นกับขั้นตอน เช่น ขั้น 1 ต้องการ business_name, business_type, industry, pain_point_1-3' },
      ],
      example: `{
  "project_id": "8f2a...",
  "step": 1,
  "input": {
    "business_name": "ร้านกาแฟลุงมี",
    "business_type": "ร้านกาแฟ",
    "industry": "F&B",
    "pain_point_1": "หากาแฟดีแถวบ้านไม่ได้"
  }
}`,
      response: `{
  "ok": true,
  "step": 1,
  "output": { "...": "ผลลัพธ์ของขั้นนี้ (โครงสร้างต่างกันไปตาม step)" },
  "meta": {
    "model": "MiniMax-M3",
    "duration_ms": 8200,
    "tokens": { "prompt_tokens": 512, "completion_tokens": 3400 },
    "cost_usd": 0.0074,
    "credits_used": 8,
    "credits_remaining": 192
  }
}`,
    },
    {
      name: 'run_tool',
      desc: 'รันเครื่องมือเดี่ยว 1 ใน 10 ตัว โดยไม่ต้องมีแผน (ใช้เครดิต)',
      credits: true,
      params: [
        {
          name: 'tool_name',
          type: 'string (enum)',
          required: true,
          note: 'pain-generator, brand-voice, persona-builder, competitor-analysis, jtbd-generator, value-proposition-canvas, business-model-canvas, million-dollar-offer, objection-handler, hook-library',
        },
        { name: 'input', type: 'object', required: true, note: 'ทุกตัวต้องการอย่างน้อย business_name, business_type, industry — ที่เหลือขึ้นกับเครื่องมือ' },
      ],
      example: `{
  "tool_name": "pain-generator",
  "input": {
    "business_name": "ร้านกาแฟลุงมี",
    "business_type": "ร้านกาแฟ",
    "industry": "F&B"
  }
}`,
      response: `{
  "ok": true,
  "tool": "pain-generator",
  "output": { "...": "ผลลัพธ์ของเครื่องมือ" },
  "meta": {
    "model": "MiniMax-M3",
    "duration_ms": 7100,
    "tokens": { "prompt_tokens": 480, "completion_tokens": 2100 },
    "cost_usd": 0.0062,
    "credits_used": 12,
    "credits_remaining": 180
  }
}`,
    },
    {
      name: 'get_export',
      desc: 'Export แผนเป็นไฟล์ และคืนลิงก์ดาวน์โหลด',
      credits: false,
      params: [
        { name: 'project_id', type: 'string', required: true, note: '' },
        { name: 'format', type: 'string', required: false, note: 'default: html — หรือ md / json / csv / doc' },
      ],
      example: `{
  "project_id": "8f2a...",
  "format": "md"
}`,
      response: `{
  "ok": true,
  "export_id": "e93c...",
  "format": "markdown",
  "download_url": "https://businessaios-api.pskspace.workers.dev/api/exports/e93c...",
  "note": "กดดาวน์โหลดจาก URL"
}`,
    },
    {
      name: 'check_credits',
      desc: 'เช็คเครดิตคงเหลือ + ประวัติล่าสุด',
      credits: false,
      params: [],
      example: '{}',
      response: `{
  "ok": true,
  "balance": 180,
  "history": [
    { "delta": -12, "reason": "generation_reserve", "balance_after": 180, "created_at": 1785290000000 }
  ]
}`,
    },
  ];

  const errors = [
    { code: '-32001 (unauthorized)', meaning: 'Token ไม่ถูกต้อง หมดอายุ หรือถูกเพิกถอนแล้ว', fix: 'สร้าง token ใหม่ที่หน้า Developers' },
    { code: 'insufficient_credits', meaning: 'เครดิตในบัญชีไม่พอ', fix: 'เติมเครดิตที่หน้า เครดิต/Billing' },
    { code: 'email_not_verified', meaning: 'บัญชียังไม่ยืนยันอีเมล — generate_step/run_tool ต้องยืนยันก่อน', fix: 'ยืนยันอีเมลจากลิงก์ที่ส่งไปตอนสมัคร' },
    { code: 'not_found', meaning: 'project_id ไม่มีอยู่ หรือไม่ใช่ของบัญชีนี้', fix: 'เช็ค project_id จาก list_projects อีกครั้ง' },
    { code: 'unknown_tool', meaning: 'tool_name สะกดผิด หรือไม่อยู่ใน 10 ตัวที่รองรับ', fix: 'ดูรายชื่อที่ถูกต้องในตาราง run_tool ด้านบน' },
    { code: 'missing_fields', meaning: 'ขาด parameter ที่จำเป็นของ generate_step / run_tool / get_export', fix: 'เช็คว่าใส่ครบตามตารางของแต่ละ tool' },
    { code: 'name_required', meaning: 'create_project ไม่ได้ใส่ name (หรือใส่แต่เป็นค่าว่าง)', fix: 'ใส่ name ที่ไม่ว่างเปล่าใน arguments' },
  ];
</script>

<svelte:head>
  <title>คู่มือ MCP — Business Smart OS</title>
</svelte:head>

<div class="min-h-screen bg-dark-50 dark:bg-dark-950">
  <main class="container-narrow py-10 space-y-8 max-w-3xl">
    <a href="/developers" class="text-sm text-primary-600 dark:text-primary-400 hover:underline">← กลับ Developers</a>
    <div>
      <h1 class="heading-2 mb-1">📖 คู่มือ MCP</h1>
      <p class="text-dark-900/60 dark:text-dark-100/60">รายละเอียดครบสำหรับต่อ Claude Code / Claude Desktop เข้ากับ Business Smart OS — ทุก tool call ใช้เครดิตเดียวกับบัญชีเว็บของคุณ</p>
    </div>

    <!-- Quickstart -->
    <div class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-6">
      <h2 class="font-semibold mb-4">เริ่มต้นใน 3 ขั้น</h2>
      <ol class="space-y-3 text-sm">
        <li class="flex gap-3">
          <span class="shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-bold flex items-center justify-center text-xs">1</span>
          <span>ไปที่ <a href="/developers" class="text-primary-600 dark:text-primary-400 hover:underline">หน้า Developers</a> → กด "+ สร้าง token" → คัดลอก token ไว้ (แสดงครั้งเดียว)</span>
        </li>
        <li class="flex gap-3">
          <span class="shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-bold flex items-center justify-center text-xs">2</span>
          <span>รันคำสั่งที่คัดลอกมา (หรือแปะ config JSON ใน Claude Desktop) — ดูตัวอย่างคำสั่งได้ตอนสร้าง token</span>
        </li>
        <li class="flex gap-3">
          <span class="shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-bold flex items-center justify-center text-xs">3</span>
          <span>ลองพิมพ์กับ Claude เช่น <em>"เช็คเครดิตของฉันหน่อย"</em> หรือ <em>"สร้างแผนใหม่ชื่อร้านกาแฟลุงมี"</em></span>
        </li>
      </ol>
      <p class="text-xs text-dark-900/50 dark:text-dark-100/50 mt-4">MCP server URL: <code class="bg-dark-50 dark:bg-dark-950 px-1.5 py-0.5 rounded">{mcpUrl}</code></p>
    </div>

    <!-- How responses work -->
    <div class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-6">
      <h2 class="font-semibold mb-2">รูปแบบผลลัพธ์</h2>
      <p class="text-sm text-dark-900/70 dark:text-dark-100/70">
        ทุก tool call ตอบกลับผ่าน MCP มาตรฐาน: <code class="bg-dark-50 dark:bg-dark-950 px-1.5 py-0.5 rounded text-xs">content[0].text</code> เป็นสตริง JSON (ตัวอย่าง response ด้านล่างคือ JSON ที่อยู่ข้างในนั้น หลัง parse แล้ว) — ถ้าเกิด error ระหว่างทำงาน จะได้ <code class="bg-dark-50 dark:bg-dark-950 px-1.5 py-0.5 rounded text-xs">isError: true</code> พร้อมข้อความอธิบายในเนื้อหาเดียวกัน
      </p>
    </div>

    <!-- Tool reference -->
    <div>
      <h2 class="text-sm font-bold uppercase tracking-wider text-dark-900/50 dark:text-dark-100/50 mb-4">รายละเอียดแต่ละ Tool</h2>
      <div class="space-y-4">
        {#each tools as tool}
          <div class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-6">
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <code class="text-base font-bold text-primary-700 dark:text-primary-300">{tool.name}</code>
              {#if tool.credits}
                <span class="text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-semibold">⚡ ใช้เครดิต</span>
              {/if}
            </div>
            <p class="text-sm text-dark-900/70 dark:text-dark-100/70 mb-4">{tool.desc}</p>

            {#if tool.params.length > 0}
              <!-- List, not a <table> — a rigid table forces horizontal scroll and
                   clips the "หมายเหตุ" notes column on a 375px screen; this reflows naturally at any width. -->
              <div class="mb-4 divide-y divide-dark-100 dark:divide-dark-700 border-t border-dark-100 dark:border-dark-700">
                {#each tool.params as p}
                  <div class="py-2.5 text-xs">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                      <code class="font-semibold">{p.name}</code>
                      <span class="text-dark-900/50 dark:text-dark-100/50">{p.type}</span>
                      {#if p.required}
                        <span class="px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 font-semibold">required</span>
                      {/if}
                    </div>
                    {#if p.note}
                      <p class="text-dark-900/60 dark:text-dark-100/60">{p.note}</p>
                    {/if}
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-xs text-dark-900/40 dark:text-dark-100/40 mb-4">ไม่ต้องใส่ parameter</p>
            {/if}

            <div class="grid sm:grid-cols-2 gap-4">
              <div>
                <div class="text-xs font-semibold text-dark-900/50 dark:text-dark-100/50 uppercase mb-1">arguments ตัวอย่าง</div>
                <pre class="bg-dark-50 dark:bg-dark-950 rounded-lg p-3 text-xs overflow-x-auto">{tool.example}</pre>
              </div>
              <div>
                <div class="text-xs font-semibold text-dark-900/50 dark:text-dark-100/50 uppercase mb-1">response ตัวอย่าง</div>
                <pre class="bg-dark-50 dark:bg-dark-950 rounded-lg p-3 text-xs overflow-x-auto">{tool.response}</pre>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Error reference -->
    <div class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-6">
      <h2 class="font-semibold mb-4">Error ที่เจอบ่อย</h2>
      <div class="divide-y divide-dark-100 dark:divide-dark-700 border-t border-dark-100 dark:border-dark-700">
        {#each errors as e}
          <div class="py-3 text-sm">
            <code class="text-xs font-semibold text-primary-700 dark:text-primary-300">{e.code}</code>
            <p class="text-dark-900/70 dark:text-dark-100/70 mt-0.5">{e.meaning}</p>
            <p class="text-dark-900/50 dark:text-dark-100/50 text-xs mt-0.5">→ {e.fix}</p>
          </div>
        {/each}
      </div>
    </div>

    <!-- FAQ -->
    <div class="bg-white dark:bg-dark-800 rounded-2xl border border-dark-100 dark:border-dark-700 p-6">
      <h2 class="font-semibold mb-4">คำถามที่พบบ่อย</h2>
      <div class="space-y-4 text-sm">
        <div>
          <p class="font-semibold mb-1">เครดิตที่ใช้ผ่าน MCP แยกจากที่ใช้บนเว็บไหม?</p>
          <p class="text-dark-900/70 dark:text-dark-100/70">ไม่แยก — ใช้เครดิตก้อนเดียวกับบัญชีของคุณ เช็คยอดได้ทั้งจากเว็บและจาก check_credits</p>
        </div>
        <div>
          <p class="font-semibold mb-1">Token ปลอดภัยแค่ไหน?</p>
          <p class="text-dark-900/70 dark:text-dark-100/70">ระบบเก็บแค่ hash ของ token ไม่เก็บค่าจริง — token ตัวจริงแสดงให้เห็นครั้งเดียวตอนสร้าง เพิกถอนได้ทันทีที่หน้า Developers</p>
        </div>
        <div>
          <p class="font-semibold mb-1">ทำไม generate_step / run_tool ถึงใช้เวลานาน?</p>
          <p class="text-dark-900/70 dark:text-dark-100/70">เป็นการเรียกระบบอัจฉริยะจริง (ไม่ใช่ mock) ปกติใช้เวลา 5-15 วินาทีต่อครั้ง ขึ้นกับความยาวของผลลัพธ์</p>
        </div>
        <div>
          <p class="font-semibold mb-1">ลืมคัดลอก token ตอนสร้างทำไง?</p>
          <p class="text-dark-900/70 dark:text-dark-100/70">ดูค่าเดิมไม่ได้แล้ว ต้องเพิกถอนแล้วสร้างใหม่ที่หน้า Developers</p>
        </div>
      </div>
    </div>
  </main>
</div>
