<script lang="ts">
  /**
   * Step 4: Source Content
   * Paste text or upload file (PDF/DOCX/MD)
   * No ระบบอัจฉริยะ — just save
   */
  let { project, initialData, step3Data, onSave, onContinue, isSaving }: {
    project: any;
    initialData: any;
    step3Data: any;
    onSave: (input: any) => void;
    onContinue: () => void;
    isSaving: boolean;
  } = $props();

  let sourceText = $state(initialData?.source_text || '');
  let uploadedFiles = $state<any[]>(initialData?.uploaded_files || []);
  let useAutoFromATR = $state(!initialData?.source_text && (initialData?.auto_use_atr ?? true));

  function addSourceItem() {
    sourceText = sourceText + (sourceText ? '\n\n' : '');
  }

  function handleFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;
    for (const f of Array.from(files)) {
      // For text files, read content
      if (f.type.startsWith('text/') || /\.(md|txt|csv|json)$/i.test(f.name)) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          uploadedFiles = [
            ...uploadedFiles,
            { name: f.name, size: f.size, mime: f.type || 'text/plain', content: content.slice(0, 50000) },
          ];
        };
        reader.readAsText(f);
      } else {
        uploadedFiles = [
          ...uploadedFiles,
          { name: f.name, size: f.size, mime: f.type || 'application/octet-stream', content: null },
        ];
      }
    }
  }

  function removeFile(idx: number) {
    uploadedFiles = uploadedFiles.filter((_, i) => i !== idx);
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    const items: any[] = [];

    if (useAutoFromATR && step3Data) {
      // Use content_gap as pseudo source
      if (step3Data.content_gap) {
        items.push({
          title: 'Content Gap จาก ATR',
          content: Array.isArray(step3Data.content_gap) ? step3Data.content_gap.join('\n') : String(step3Data.content_gap),
        });
      }
      if (step3Data.transformation_summary) {
        items.push({
          title: 'Transformation Summary',
          content: step3Data.transformation_summary,
        });
      }
    }

    if (sourceText.trim()) {
      // Split by double newlines
      sourceText.split(/\n\n+/).forEach((block, i) => {
        if (block.trim()) {
          items.push({
            title: `Source ${i + 1}`,
            content: block.trim(),
          });
        }
      });
    }

    uploadedFiles.forEach((f) => {
      if (f.content) {
        items.push({
          title: f.name,
          content: f.content,
        });
      } else {
        items.push({
          title: f.name,
          content: `[Binary file: ${f.name} (${f.mime}, ${Math.round(f.size / 1024)}KB)]`,
        });
      }
    });

    onSave({ source_text: sourceText, uploaded_files: uploadedFiles, source_items: items, auto_use_atr: useAutoFromATR });
    onContinue();
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold mb-2">📚 Source Content</h2>
    <p class="text-sm text-dark-900/60 dark:text-dark-100/60">ใส่เนื้อหาต้นทาง — ระบบอัจฉริยะ จะใช้ข้อมูลนี้ตอน Triage (Step 5)</p>
  </div>

  <form onsubmit={(e) => { e.preventDefault(); handleSubmit(e); }} class="space-y-4">
    <div class="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-300">
      💡 ถ้าไม่มีเนื้อหาต้นทาง — ระบบอัจฉริยะ จะใช้ <strong>Content Gap จาก ATR (Step 3)</strong> เป็นฐาน
    </div>

    <label class="flex items-center gap-2 text-sm">
      <input type="checkbox" bind:checked={useAutoFromATR} class="rounded" />
      <span>ใช้ Content Gap จาก ATR เป็นข้อมูลต้นทางอัตโนมัติ</span>
    </label>

    <div>
      <label class="block text-sm font-medium text-dark-700 dark:text-dark-200 mb-1">📝 Paste เนื้อหา</label>
      <textarea
        bind:value={sourceText}
        rows="10"
        placeholder={`วางเนื้อหาที่นี่ — เช่น:

- รายงาน Q3
- บทความอ้างอิง
- ร่าง slide เก่า
- ข้อมูลดิบที่ต้องการนำเสนอ
- Notes จากการประชุม

(แต่ละ paragraph คั่นด้วย blank line)`}
        class="w-full px-4 py-2.5 border border-dark-200 dark:border-dark-600 rounded-lg font-mono text-sm"
      ></textarea>
      <div class="text-xs text-dark-900/50 dark:text-dark-100/50 mt-1">{sourceText.length.toLocaleString()} ตัวอักษร</div>
    </div>

    <div>
      <label class="block text-sm font-medium text-dark-700 dark:text-dark-200 mb-1">📎 หรืออัปโหลดไฟล์ (text/md/csv/json)</label>
      <input
        type="file"
        multiple
        accept=".txt,.md,.csv,.json,text/*"
        onchange={handleFileUpload}
        class="w-full text-sm text-dark-900/60 dark:text-dark-100/60 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
      />
      {#if uploadedFiles.length > 0}
        <div class="mt-2 space-y-1">
          {#each uploadedFiles as f, i}
            <div class="flex items-center justify-between bg-dark-50 dark:bg-dark-900 px-3 py-2 rounded text-sm">
              <span>📄 {f.name} ({Math.round(f.size / 1024)}KB)</span>
              <button type="button" onclick={() => removeFile(i)} class="text-red-600 dark:text-red-400 hover:text-red-700">✕</button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <button
      type="submit"
      disabled={isSaving}
      class="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-dark-300 text-white font-semibold py-3 rounded-lg transition"
    >
      {isSaving ? '💾 Saving...' : '💾 Save Source → Step 5'}
    </button>
  </form>
</div>
