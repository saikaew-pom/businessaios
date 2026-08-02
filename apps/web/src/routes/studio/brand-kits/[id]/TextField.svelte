<script lang="ts">
  let { label, value = $bindable(''), rows = 3 } = $props<{
    label: string;
    value: string;
    rows?: number;
  }>();
</script>

<label class="block">
  <span class="mb-1 block text-sm font-semibold">{label}</span>
  <textarea bind:value rows={rows} class="input min-h-24"></textarea>
</label>
