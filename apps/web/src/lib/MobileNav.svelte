<script lang="ts">
  import { page } from '$app/stores';

  const items = [
    { href: '/dashboard', icon: '🏠', label: 'หน้าแรก' },
    { href: '/tools', icon: '⚡', label: 'เครื่องมือ' },
    { href: '/studio', icon: '🎨', label: 'Studio' },
    { href: '/billing', icon: '💰', label: 'เครดิต' },
    { href: '/profile', icon: '👤', label: 'โปรไฟล์' },
  ];

  function isActive(href: string) {
    const path = $page.url.pathname;
    return path === href || path.startsWith(href + '/');
  }
</script>

<nav class="sm:hidden fixed bottom-0 inset-x-0 z-20 bg-white dark:bg-dark-800 border-t border-dark-100 dark:border-dark-700 pb-[env(safe-area-inset-bottom)]">
  <div class="flex items-stretch">
    {#each items as item}
      <a
        href={item.href}
        class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-xs font-medium {isActive(item.href) ? 'text-primary-600 dark:text-primary-400' : 'text-dark-900/50 dark:text-dark-100/50'}"
      >
        <span class="text-lg leading-none">{item.icon}</span>
        {item.label}
      </a>
    {/each}
  </div>
</nav>
