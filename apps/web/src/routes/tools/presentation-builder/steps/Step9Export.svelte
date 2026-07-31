<script lang="ts">
  /**
   * Step 9: Export
   * Multiple formats: HTML (print→PDF), Markdown, JSON, CSV, PPTX (server), Google Sheet (server)
   */
  let { project, step6Data, step7Data, step8Data, onExport, isExporting }: {
    project: any;
    step6Data: any;
    step7Data: any;
    step8Data: any;
    onExport: (format: 'html' | 'md' | 'json' | 'csv' | 'pptx' | 'gsheet') => void;
    isExporting: boolean;
  } = $props();

  let hasOutline = $derived(!!(step6Data?.outline?.length || step7Data?.slides?.length));

  const formats = [
    { id: 'html', name: 'HTML (Print → PDF)', icon: '🌐', desc: 'เปิดใน browser แล้วกด Cmd/Ctrl+P > Save as PDF', color: 'blue' },
    { id: 'md', name: 'Markdown', icon: '📝', desc: 'Outline + notes ในรูปแบบ .md', color: 'slate' },
    { id: 'json', name: 'JSON', icon: '🔧', desc: 'ข้อมูลดิบทั้งหมด สำหรับ integration', color: 'amber' },
    { id: 'csv', name: 'CSV', icon: '📊', desc: '1 row ต่อ slide สำหรับ spreadsheet', color: 'green' },
    { id: 'pptx', name: 'PowerPoint (PPTX)', icon: '📊', desc: 'ไฟล์ .pptx แท้ — เปิดใน PowerPoint/Keynote ได้', color: 'orange' },
    { id: 'gsheet', name: 'Google Sheets', icon: '🟢', desc: 'ส่งออก CSV + เปิด Google Sheets (Import)', color: 'emerald' },
  ];
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold mb-2">📤 Export</h2>
    <p class="text-sm text-dark-900/60 dark:text-dark-100/60">เลือก format — ทุก format generate ฝั่ง server</p>
  </div>

  {#if !hasOutline}
    <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
      ⚠️ ต้อง generate Step 6 (Outline) ก่อน export
    </div>
  {/if}

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {#each formats as fmt}
      <button
        onclick={() => onExport(fmt.id as any)}
        disabled={isExporting || !hasOutline}
        class="text-left p-4 border-2 border-dark-200 dark:border-dark-600 rounded-xl hover:border-{fmt.color}-500 hover:bg-{fmt.color}-50 disabled:opacity-50 disabled:cursor-not-allowed transition group"
      >
        <div class="flex items-center gap-3">
          <span class="text-3xl">{fmt.icon}</span>
          <div>
            <div class="font-semibold text-dark-900 dark:text-dark-50 group-hover:text-{fmt.color}-700">{fmt.name}</div>
            <div class="text-xs text-dark-900/60 dark:text-dark-100/60 mt-0.5">{fmt.desc}</div>
          </div>
        </div>
      </button>
    {/each}
  </div>

  <div class="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
    💡 <strong>Tips:</strong>
    <ul class="mt-1 ml-4 list-disc text-xs space-y-0.5">
      <li><strong>HTML</strong> — ใช้สำหรับพรีเซนต์จริง (เปิด browser, กด F11 เต็มจอ, ใช้ลูกศรเลื่อน)</li>
      <li><strong>PPTX</strong> — แก้ไขต่อใน PowerPoint/Keynote ได้</li>
      <li><strong>Google Sheets</strong> — ดาวน์โหลด CSV → ใน Google Sheets: File > Import > Upload</li>
      <li><strong>Markdown</strong> — เก็บไว้อ่าน/แชร์ใน Slack/Notion</li>
    </ul>
  </div>

  <!-- Slide preview -->
  <div class="mt-8 border-t pt-6">
    <h3 class="font-semibold mb-3">🎬 Slide Preview ({step6Data?.outline?.length || 0} slides)</h3>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {#each (step7Data?.slides || step6Data?.outline || []) as slide, i}
        <div class="border border-dark-200 dark:border-dark-600 rounded-lg p-3 bg-white dark:bg-dark-800 aspect-video flex flex-col justify-between">
          <div>
            <div class="text-xs text-primary-600 dark:text-primary-400 font-medium">Slide {slide.slide_number || i + 1}</div>
            <div class="text-sm font-semibold text-dark-900 dark:text-dark-50 mt-1 line-clamp-2">{slide.title}</div>
            {#if slide.subtitle}
              <div class="text-xs text-dark-900/60 dark:text-dark-100/60 mt-0.5 line-clamp-1">{slide.subtitle}</div>
            {/if}
          </div>
          <div class="text-xs text-dark-900/50 dark:text-dark-100/50 mt-2">
            {slide.type || 'story'} · {slide.layout || 'flat'}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
