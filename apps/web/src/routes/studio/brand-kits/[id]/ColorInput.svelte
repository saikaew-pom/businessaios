<script lang="ts">
  let { label, value = $bindable('#000000') } = $props<{
    label: string;
    value: string;
  }>();
</script>

<label class="flex items-center gap-3 rounded-lg border border-dark-100 dark:border-dark-700 p-3">
  <input type="color" bind:value class="h-9 w-12" />
  <span class="text-sm font-semibold">{label} {value}</span>
</label>
