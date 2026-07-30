<script lang="ts">
  /**
   * BusinessContextFields — shared dependent form fields
   * - Business Type (preset dropdown)
   * - Industry (dependent dropdown)
   * - Target Audience (checkboxes max 2 + custom)
   *
   * Used in: Brand Voice, Pain Point, Persona Builder
   */
  import { BUSINESS_TYPES, getIndustriesForType } from '$lib/presets/businessTypePresets';
  import { TARGET_AUDIENCES, getAudiencesByCategory, AUDIENCE_CATEGORY_LABELS } from '$lib/presets/targetAudiencePresets';

  let {
    businessType = $bindable(''),
    industry = $bindable(''),
    industryCustom = $bindable(''),
    targetAudiences = $bindable<string[]>([]),
    customAudience = $bindable(''),
    businessTypeError = '',
    industryError = '',
  }: {
    businessType?: string;
    industry?: string;
    industryCustom?: string;
    targetAudiences?: string[];
    customAudience?: string;
    businessTypeError?: string;
    industryError?: string;
  } = $props();

  // Derived: industries for current business type
  let availableIndustries = $derived(getIndustriesForType(businessType));
  let audiencesByCategory = $derived(getAudiencesByCategory());

  // When business type changes, reset industry
  $effect(() => {
    if (businessType && industry) {
      const inds = getIndustriesForType(businessType);
      if (!inds.includes(industry) && industry !== '__custom__') {
        industry = '';
        industryCustom = '';
      }
    }
  });

  function getAudienceCategory(id: string): string | null {
    const a = TARGET_AUDIENCES.find(x => x.id === id);
    return a?.category ?? null;
  }

  function toggleAudience(id: string) {
    if (targetAudiences.includes(id)) {
      // unselect
      targetAudiences = targetAudiences.filter(x => x !== id);
      return;
    }
    const newCat = getAudienceCategory(id);
    if (!newCat) {
      targetAudiences = [...targetAudiences, id];
      return;
    }
    // 1 per category: remove any existing selection in the same category
    targetAudiences = targetAudiences.filter(x => getAudienceCategory(x) !== newCat);
    targetAudiences = [...targetAudiences, id];
  }

  function getAudienceLabel(id: string): string {
    return TARGET_AUDIENCES.find(a => a.id === id)?.label ?? id;
  }
</script>

<div class="space-y-5">
  <!-- Business Type (preset dropdown) -->
  <div>
    <label class="block text-sm font-semibold mb-1.5">ประเภทธุรกิจ *</label>
    <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
      {#each BUSINESS_TYPES as type}
        <button
          type="button"
          onclick={() => { businessType = type.id; industry = ''; industryCustom = ''; }}
          class="text-left p-2.5 rounded-lg border-2 transition {businessType === type.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/40 shadow-sm' : 'border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-800 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50/30 dark:hover:bg-primary-900/20'}"
          title={type.description}
        >
          <div class="text-2xl mb-1">{type.icon}</div>
          <div class="text-xs font-semibold text-dark-900 dark:text-dark-50 leading-tight">{type.label}</div>
        </button>
      {/each}
    </div>
    {#if businessTypeError}
      <div class="text-xs text-red-600 dark:text-red-400 mt-1">{businessTypeError}</div>
    {/if}
    {#if businessType}
      {@const bt = BUSINESS_TYPES.find(t => t.id === businessType)}
      {#if bt}
        <div class="mt-2 text-xs text-dark-900/60 dark:text-dark-100/60">
          <span class="font-semibold">{bt.icon} {bt.label}:</span> {bt.description}
        </div>
      {/if}
    {/if}
  </div>

  <!-- Industry (dependent dropdown) -->
  {#if businessType}
    <div>
      <label class="block text-sm font-semibold mb-1.5">อุตสาหกรรม *</label>
      <select
        bind:value={industry}
        class="w-full px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-800"
      >
        <option value="">— เลือกอุตสาหกรรม —</option>
        {#each availableIndustries as ind}
          <option value={ind}>{ind}</option>
        {/each}
        <option value="__custom__">อื่น ๆ (พิมพ์เอง)</option>
      </select>
      {#if industry === '__custom__'}
        <input
          type="text"
          bind:value={industryCustom}
          placeholder="เช่น ร้านก๋วยเตี๋ยวลุงใบหยก"
          class="w-full mt-2 px-3 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-dark-800"
        />
      {/if}
      {#if industryError}
        <div class="text-xs text-red-600 dark:text-red-400 mt-1">{industryError}</div>
      {/if}
      {#if !industry}
        <div class="text-xs text-dark-900/50 dark:text-dark-100/50 mt-1">เลือกจาก {availableIndustries.length} ตัวเลือก หรือพิมพ์เอง</div>
      {/if}
    </div>
  {/if}

  <!-- Target Audience (1 per category + custom) -->
  <div>
    <div class="flex items-center justify-between mb-1.5">
      <label class="block text-sm font-semibold">กลุ่มเป้าหมาย <span class="text-dark-900/50 dark:text-dark-100/50 font-normal">(เลือกได้ 1 ต่อหมวด · ไม่บังคับทุกหมวด)</span></label>
      {#if targetAudiences.length > 0}
        <span class="text-xs text-primary-700 dark:text-primary-300 font-semibold">เลือก {targetAudiences.length} กลุ่ม</span>
      {/if}
    </div>

    {#if targetAudiences.length > 0}
      <div class="mb-3 flex flex-wrap gap-1.5">
        {#each targetAudiences as id}
          <button
            type="button"
            onclick={() => toggleAudience(id)}
            class="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-300 text-xs rounded-full hover:bg-primary-200 dark:hover:bg-primary-900/60"
          >
            <span>{TARGET_AUDIENCES.find(a => a.id === id)?.icon}</span>
            <span>{getAudienceLabel(id)}</span>
            <span class="text-primary-600 dark:text-primary-400 ml-1">✕</span>
          </button>
        {/each}
      </div>
    {/if}

    <div class="bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-600 rounded-lg p-3 space-y-3 max-h-72 overflow-y-auto">
      {#each Object.keys(audiencesByCategory) as catKey}
        <div>
          <div class="text-xs font-bold text-dark-900/70 dark:text-dark-100/70 mb-1.5">{AUDIENCE_CATEGORY_LABELS[catKey]}</div>
          <div class="flex flex-wrap gap-1.5">
            {#each audiencesByCategory[catKey] as a}
              {@const isSelected = targetAudiences.includes(a.id)}
              <button
                type="button"
                onclick={() => toggleAudience(a.id)}
                class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition {isSelected ? 'bg-primary-500 text-white border-primary-500' : 'bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50 border-dark-200 dark:border-dark-600 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30'}"
                title={a.description}
              >
                <span>{a.icon}</span>
                <span>{a.label}</span>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <input
      type="text"
      bind:value={customAudience}
      placeholder="+ เพิ่มกลุ่มเป้าหมายเอง (เช่น แม่ค้าออนไลน์ย่านบางนา)"
      class="w-full mt-2 px-3 py-2 text-sm rounded-lg border border-dashed border-dark-300 dark:border-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-800"
    />
  </div>
</div>
