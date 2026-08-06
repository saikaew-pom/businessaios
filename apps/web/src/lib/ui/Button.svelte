<script lang="ts">
  /**
   * Component canon #2 — Button. Three variants, each with one meaning
   * (commitment 4.4): primary = the one action on this screen, secondary =
   * an alternative action, ghost = a low-emphasis/dismissive action. Never
   * pick a variant for how it looks — pick it for what it means, then let
   * the variant look the way it looks.
   */
  let {
    variant = 'primary',
    type = 'button',
    disabled = false,
    fullWidth = true,
    onclick,
    children,
  }: {
    variant?: 'primary' | 'secondary' | 'ghost';
    type?: 'button' | 'submit';
    disabled?: boolean;
    fullWidth?: boolean;
    onclick?: (event: MouseEvent) => void;
    children?: import('svelte').Snippet;
  } = $props();

  const base = 'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-bold transition-transform duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100';
  const variants = {
    primary: 'bg-primary-500 text-white shadow-sm hover:bg-primary-600',
    secondary: 'bg-dark-100 dark:bg-dark-900 text-dark-900 dark:text-dark-50 hover:bg-dark-200 dark:hover:bg-dark-700',
    ghost: 'text-dark-600 dark:text-dark-300 font-semibold hover:text-dark-900 dark:hover:text-dark-50',
  };
</script>

<button
  {type}
  {disabled}
  onclick={disabled ? undefined : onclick}
  class="{base} {variants[variant]} {fullWidth ? 'w-full' : ''}"
>
  {@render children?.()}
</button>
