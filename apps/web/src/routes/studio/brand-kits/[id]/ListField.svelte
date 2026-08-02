<script lang="ts">
  let { label, value = $bindable('') } = $props<{
    label: string;
    value: string;
  }>();
</script>

<label class="block">
  <span class="mb-1 block text-sm font-semibold">{label}</span>
  <textarea bind:value rows="4" class="input min-h-28" placeholder="หนึ่งรายการต่อหนึ่งบรรทัด"></textarea>
</label>
