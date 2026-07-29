<script lang="ts">
  import { page } from '$app/stores';

  const items = [
    { href: '/dashboard', icon: '🏠', label: 'หน้าแรก' },
    { href: '/tools', icon: '⚡', label: 'เครื่องมือ' },
    { href: '/billing', icon: '💰', label: 'เครดิต' },
    { href: '/profile', icon: '👤', label: 'โปรไฟล์' },
  ];

  function isActive(href: string) {
    const path = $page.url.pathname;
    return path === href || path.startsWith(href + '/');
  }
</script>

<nav class="sm:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-dark-100 pb-[env(safe-area-inset-bottom)]">
  <div class="flex items-stretch">
    {#each items as item}
      <a
        href={item.href}
        class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-xs font-medium {isActive(item.href) ? 'text-primary-600' : 'text-dark-900/50'}"
      >
        <span class="text-lg leading-none">{item.icon}</span>
        {item.label}
      </a>
    {/each}
  </div>
</nav>
