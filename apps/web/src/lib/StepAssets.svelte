<script lang="ts">
  /**
   * StepAssets — per-step context: notes + uploaded files + linked projects
   * Used in wizard step forms
   */
  import { listStepAssets, addStepAsset, updateStepAsset, deleteStepAsset, uploadTextFile, listProjectLinks, addProjectLink, deleteProjectLink, listProjects, listSavedTools, type ToolSave } from '$lib/api';

  let { projectId, stepNumber, canLink = true, compact = false }: {
    projectId: string;
    stepNumber: number;
    canLink?: boolean;
    compact?: boolean;
  } = $props();

  let assets = $state<any[]>([]);
  let links = $state<any[]>([]);
  let projects = $state<any[]>([]);
  let toolSaves = $state<ToolSave[]>([]);
  let isLoading = $state(true);
  let isExpanded = $state(false);
  let activeTab = $state<'notes' | 'files' | 'links'>('notes');

  // New note form
  let newNoteTitle = $state('');
  let newNoteContent = $state('');
  let isAddingNote = $state(false);

  // New file form
  let newFileTitle = $state('');
  let isUploadingFile = $state(false);

  // New link form
  let linkProjectId = $state('');
  let linkToolSaveId = $state('');
  let isAddingLink = $state(false);

  $effect(() => {
    if (projectId) {
      loadAll();
    }
  });

  async function loadAll() {
    isLoading = true;
    try {
      assets = (await listStepAssets(projectId, stepNumber)).assets;
      if (canLink) {
        links = (await listProjectLinks(projectId)).links;
        projects = (await listProjects()).projects.filter(p => p.id !== projectId);
        toolSaves = await listSavedTools();
      }
    } catch (err) {
      console.error('Failed to load step assets:', err);
    } finally {
      isLoading = false;
    }
  }

  async function handleAddNote() {
    if (!newNoteContent.trim() || isAddingNote) return;
    isAddingNote = true;
    try {
      await addStepAsset(projectId, stepNumber, {
        kind: 'note',
        title: newNoteTitle.trim() || 'Note',
        content: newNoteContent.trim(),
      });
      newNoteTitle = '';
      newNoteContent = '';
      await loadAll();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      isAddingNote = false;
    }
  }

  async function handleFileUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || isUploadingFile) return;
    if (file.size > 200_000) {
      alert('ไฟล์ต้องไม่เกิน 200KB (text/csv/json เท่านั้น)');
      return;
    }
    const allowedMimes = ['text/', 'application/json', 'application/csv'];
    if (!allowedMimes.some(m => file.type.startsWith(m))) {
      alert('รองรับเฉพาะ text, csv, json เท่านั้น');
      return;
    }
    isUploadingFile = true;
    try {
      const content = await file.text();
      await uploadTextFile(projectId, stepNumber, {
        title: newFileTitle.trim() || file.name,
        file_name: file.name,
        content,
        mime_type: file.type || 'text/plain',
      });
      newFileTitle = '';
      await loadAll();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      isUploadingFile = false;
    }
  }

  async function handleAddLink(kind: 'project' | 'tool_save') {
    const targetId = kind === 'project' ? linkProjectId : linkToolSaveId;
    if (!targetId || isAddingLink) return;
    isAddingLink = true;
    try {
      await addProjectLink(projectId, {
        target_kind: kind,
        target_id: targetId,
        link_purpose: 'context',
        step_number: stepNumber,
      });
      linkProjectId = '';
      linkToolSaveId = '';
      await loadAll();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      isAddingLink = false;
    }
  }

  async function handleDeleteAsset(id: string) {
    if (!confirm('ลบ?')) return;
    try {
      await deleteStepAsset(projectId, stepNumber, id);
      await loadAll();
    } catch (err: any) { alert(err.message); }
  }

  async function handleDeleteLink(id: string) {
    if (!confirm('ลบ link?')) return;
    try {
      await deleteProjectLink(projectId, id);
      await loadAll();
    } catch (err: any) { alert(err.message); }
  }

  function fileIcon(name: string) {
    if (name.endsWith('.csv')) return '📊';
    if (name.endsWith('.json')) return '{}';
    if (name.endsWith('.md')) return '📝';
    return '📄';
  }

  function toolLabel(type: string) {
    return ({ pain_generator: '🎯 Pain', brand_voice: '🎙️ Voice', persona_builder: '👥 Persona' } as any)[type] || type;
  }
</script>

<div class="border border-dark-100 rounded-xl bg-white">
  <!-- Header -->
  <button
    type="button"
    onclick={() => isExpanded = !isExpanded}
    class="w-full px-4 py-3 flex items-center justify-between hover:bg-dark-50/50 transition"
  >
    <div class="flex items-center gap-2 text-sm font-semibold">
      <span>💬 โน้ต + 📎 ไฟล์แนบ + 🔗 ลิงก์</span>
      {#if assets.length + links.length > 0}
        <span class="text-xs px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700">{assets.length + links.length}</span>
      {/if}
    </div>
    <span class="text-dark-900/40 text-sm">{isExpanded ? '▼' : '▶'}</span>
  </button>

  {#if isExpanded}
    <div class="border-t border-dark-100 p-4">
      <!-- Tabs -->
      <div class="flex gap-1 mb-4 border-b border-dark-100">
        <button type="button" onclick={() => activeTab = 'notes'} class="px-3 py-1.5 text-sm {activeTab === 'notes' ? 'border-b-2 border-primary-500 font-semibold text-primary-700' : 'text-dark-900/60'}">
          💬 โน้ต ({assets.filter(a => a.kind === 'note').length})
        </button>
        <button type="button" onclick={() => activeTab = 'files'} class="px-3 py-1.5 text-sm {activeTab === 'files' ? 'border-b-2 border-primary-500 font-semibold text-primary-700' : 'text-dark-900/60'}">
          📎 ไฟล์ ({assets.filter(a => a.kind === 'file').length})
        </button>
        {#if canLink}
          <button type="button" onclick={() => activeTab = 'links'} class="px-3 py-1.5 text-sm {activeTab === 'links' ? 'border-b-2 border-primary-500 font-semibold text-primary-700' : 'text-dark-900/60'}">
            🔗 ลิงก์ ({links.length})
          </button>
        {/if}
      </div>

      {#if activeTab === 'notes'}
        <!-- Notes tab -->
        <div class="space-y-3">
          {#if assets.filter(a => a.kind === 'note').length > 0}
            {#each assets.filter(a => a.kind === 'note') as note}
              <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg group">
                <div class="flex items-start justify-between gap-2">
                  <div class="font-semibold text-sm text-amber-900">📝 {note.title || 'Note'}</div>
                  <button onclick={() => handleDeleteAsset(note.id)} class="text-xs text-red-600 opacity-0 group-hover:opacity-100">🗑️</button>
                </div>
                <div class="text-sm text-dark-900/80 mt-1 whitespace-pre-wrap">{note.content}</div>
              </div>
            {/each}
          {/if}
          <details class="bg-dark-50 rounded-lg p-3">
            <summary class="text-sm font-semibold cursor-pointer">+ เพิ่มโน้ต</summary>
            <div class="mt-2 space-y-2">
              <input type="text" bind:value={newNoteTitle} placeholder="ชื่อโน้ต (เช่น 'Focus group feedback')" class="w-full px-3 py-2 text-sm rounded border border-dark-200" />
              <textarea bind:value={newNoteContent} rows="3" placeholder="โน้ต/บริบทเพิ่มเติม เช่น pain point ที่ค้นพบ, ข้อจำกัด, ตัวอย่าง" class="w-full px-3 py-2 text-sm rounded border border-dark-200"></textarea>
              <button type="button" onclick={handleAddNote} disabled={isAddingNote || !newNoteContent.trim()} class="btn-secondary text-sm disabled:opacity-50">
                {isAddingNote ? '...' : '💾 บันทึกโน้ต'}
              </button>
            </div>
          </details>
        </div>
      {:else if activeTab === 'files'}
        <!-- Files tab -->
        <div class="space-y-3">
          {#if assets.filter(a => a.kind === 'file').length > 0}
            {#each assets.filter(a => a.kind === 'file') as file}
              <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3 group">
                <span class="text-2xl">{fileIcon(file.file_name)}</span>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-sm truncate">{file.title || file.file_name}</div>
                  <div class="text-xs text-dark-900/60">
                    {file.file_name} · {(file.file_size / 1024).toFixed(1)}KB
                  </div>
                </div>
                <button onclick={() => handleDeleteAsset(file.id)} class="text-xs text-red-600 opacity-0 group-hover:opacity-100">🗑️</button>
              </div>
            {/each}
          {/if}
          <details class="bg-dark-50 rounded-lg p-3">
            <summary class="text-sm font-semibold cursor-pointer">+ อัปโหลดไฟล์ context (text/csv/json ≤ 200KB)</summary>
            <div class="mt-2 space-y-2">
              <input type="text" bind:value={newFileTitle} placeholder="ชื่อ (optional)" class="w-full px-3 py-2 text-sm rounded border border-dark-200" />
              <input type="file" accept=".txt,.csv,.json,.md,text/*" onchange={handleFileUpload} disabled={isUploadingFile} class="text-sm" />
              <p class="text-xs text-dark-900/50">รองรับ text, csv, json — เนื้อหาจะถูกส่งให้ระบบอัจฉริยะเป็น context</p>
            </div>
          </details>
        </div>
      {:else if activeTab === 'links' && canLink}
        <!-- Links tab -->
        <div class="space-y-3">
          <div class="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-900">
            💡 ใช้ข้อมูลจาก project อื่น (เช่น Brand Voice, Pain Points) หรือ saved tool result เป็น context ตอน generate
          </div>
          {#if links.length > 0}
            {#each links as link}
              <div class="p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-3 group">
                <span class="text-xl">{link.target_kind === 'project' ? '📊' : '🛠️'}</span>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-sm truncate">{link.target?.name || link.target_id}</div>
                  <div class="text-xs text-dark-900/60">
                    {link.target_kind === 'project' ? (link.target?.kind || 'project') : toolLabel(link.target?.tool_type || '')}
                    · ใช้ใน step {link.step_number}
                  </div>
                </div>
                <button onclick={() => handleDeleteLink(link.id)} class="text-xs text-red-600 opacity-0 group-hover:opacity-100">🗑️</button>
              </div>
            {/each}
          {/if}
          <details class="bg-dark-50 rounded-lg p-3">
            <summary class="text-sm font-semibold cursor-pointer">+ เพิ่ม link</summary>
            <div class="mt-2 space-y-2">
              <div>
                <label class="text-xs text-dark-900/60">จาก Project (Brand Voice, Pain Points, Persona, หรือ Playbook)</label>
                <div class="flex gap-2">
                  <select bind:value={linkProjectId} class="flex-1 px-2 py-1.5 text-sm rounded border border-dark-200">
                    <option value="">— เลือก —</option>
                    {#each projects as p}
                      <option value={p.id}>{p.name} ({p.kind || 'playbook'})</option>
                    {/each}
                  </select>
                  <button type="button" onclick={() => handleAddLink('project')} disabled={!linkProjectId || isAddingLink} class="btn-secondary text-xs disabled:opacity-50">+ Project</button>
                </div>
              </div>
              <div>
                <label class="text-xs text-dark-900/60">จาก Saved Tool Result</label>
                <div class="flex gap-2">
                  <select bind:value={linkToolSaveId} class="flex-1 px-2 py-1.5 text-sm rounded border border-dark-200">
                    <option value="">— เลือก —</option>
                    {#each toolSaves as t}
                      <option value={t.id}>{t.title} ({toolLabel(t.tool_type)})</option>
                    {/each}
                  </select>
                  <button type="button" onclick={() => handleAddLink('tool_save')} disabled={!linkToolSaveId || isAddingLink} class="btn-secondary text-xs disabled:opacity-50">+ Tool</button>
                </div>
              </div>
            </div>
          </details>
        </div>
      {/if}
    </div>
  {/if}
</div>
