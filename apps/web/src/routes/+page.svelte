<script lang="ts">
  import { locale, toggleLocale } from '$lib/stores';
  import { t, type StringKey } from '$lib/i18n';

  // ============================================
  // State
  // ============================================
  // FAQ accordion
  let openFaq = $state<number | null>(0);

  // ============================================
  // Computed (using $derived)
  // ============================================
  let currentLocale = $derived($locale);

  // ============================================
  // FAQ data
  // ============================================
  const faqs = $derived([
    { q: t(currentLocale, 'faq.q1'), a: t(currentLocale, 'faq.a1') },
    { q: t(currentLocale, 'faq.q2'), a: t(currentLocale, 'faq.a2') },
    { q: t(currentLocale, 'faq.q3'), a: t(currentLocale, 'faq.a3') },
    { q: t(currentLocale, 'faq.q4'), a: t(currentLocale, 'faq.a4') },
    { q: t(currentLocale, 'faq.q5'), a: t(currentLocale, 'faq.a5') },
    { q: t(currentLocale, 'faq.q6'), a: t(currentLocale, 'faq.a6') },
  ]);
</script>

<svelte:head>
  <title>Business Smart OS — ระบบปฏิบัติการอัจฉริยะสำหรับธุรกิจ</title>
  <meta name="description" content="Fill 7 steps. Get a complete business plan. Generate a Brand Card, personas, content, and workflow with a Smart Engine. Export as PDF, Word, Excel." />
  <meta property="og:title" content="Business Smart OS — ระบบปฏิบัติการอัจฉริยะสำหรับธุรกิจ" />
  <meta property="og:description" content="Fill 7 steps. Get a complete business plan with a Smart Engine." />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<!-- =========================== NAV =========================== -->
<nav class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-dark-100">
  <div class="container-narrow flex items-center justify-between h-16">
    <a href="/" class="flex items-center gap-2">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
        <span class="text-white font-bold text-sm">B</span>
      </div>
      <span class="font-bold text-lg">Business Smart OS</span>
    </a>

    <div class="hidden md:flex items-center gap-8">
      <a href="#features" class="text-sm text-dark-900/70 hover:text-dark-900 transition">{t(currentLocale, 'nav.features')}</a>
      <a href="#how" class="text-sm text-dark-900/70 hover:text-dark-900 transition">{t(currentLocale, 'nav.how')}</a>
      <a href="#pricing" class="text-sm text-dark-900/70 hover:text-dark-900 transition">{t(currentLocale, 'nav.pricing')}</a>
      <a href="#faq" class="text-sm text-dark-900/70 hover:text-dark-900 transition">{t(currentLocale, 'nav.faq')}</a>
    </div>

    <div class="flex items-center gap-3">
      <button
        onclick={toggleLocale}
        class="text-xs font-semibold px-2.5 py-1 rounded border border-dark-200 hover:bg-dark-50 transition"
        aria-label="Toggle language"
      >
        {currentLocale === 'th' ? 'EN' : 'TH'}
      </button>
      <a href="/login" class="text-sm text-dark-900/70 hover:text-dark-900 transition hidden sm:block">
        {t(currentLocale, 'nav.signin')}
      </a>
      <a href="/register" class="btn-primary text-sm py-2 px-4">
        {t(currentLocale, 'nav.cta')}
      </a>
      <a href="/tools" class="text-sm text-dark-900/70 hover:text-dark-900 transition hidden sm:block" title="เครื่องมือ AI แยกต่างหาก">
        ⚡ Tools
      </a>
    </div>
  </div>
</nav>

<!-- =========================== HERO =========================== -->
<section class="section relative overflow-hidden">
  <!-- Background gradient -->
  <div class="absolute inset-0 -z-10">
    <div class="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-primary-500/10 rounded-full blur-3xl"></div>
    <div class="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-primary-500/5 rounded-full blur-3xl"></div>
  </div>

  <div class="container-narrow text-center">
    <!-- Badge -->
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 border border-primary-100 mb-8 animate-fade-in">
      <span class="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
      <span class="text-xs font-medium text-primary-700">{t(currentLocale, 'hero.badge')}</span>
    </div>

    <!-- Title -->
    <h1 class="heading-1 mb-6 animate-slide-up">
      <span class="block">{t(currentLocale, 'hero.title.1')}</span>
      <span class="block bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
        {t(currentLocale, 'hero.title.2')}
      </span>
      <span class="block">{t(currentLocale, 'hero.title.3')}</span>
    </h1>

    <!-- Subtitle -->
    <p class="text-lg sm:text-xl text-dark-900/70 max-w-2xl mx-auto mb-10 leading-relaxed">
      {t(currentLocale, 'hero.subtitle')}
    </p>

    <!-- CTAs -->
    <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
      <a href="/register" class="btn-primary text-base px-8 py-4 w-full sm:w-auto">
        {t(currentLocale, 'hero.cta.primary')}
        <svg class="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
      </a>
      <a href="#how" class="btn-secondary text-base px-8 py-4 w-full sm:w-auto">
        {t(currentLocale, 'hero.cta.secondary')}
      </a>
    </div>

    <!-- Social proof -->
    <div class="flex items-center justify-center gap-2 text-sm text-dark-900/60">
      <svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
      <span>{t(currentLocale, 'hero.proof')}</span>
    </div>
  </div>
</section>

<!-- =========================== FEATURES =========================== -->
<section id="features" class="section bg-dark-50">
  <div class="container-narrow">
    <div class="text-center max-w-2xl mx-auto mb-16">
      <h2 class="heading-2 mb-4">{t(currentLocale, 'features.title')}</h2>
      <p class="text-lg text-dark-900/70">{t(currentLocale, 'features.subtitle')}</p>
    </div>

    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each [1, 2, 3, 4, 5, 6] as i}
        <div class="bg-white rounded-2xl p-8 border border-dark-100 hover:border-primary-200 hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-300">
          <div class="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center mb-5">
            <span class="text-2xl">⚡</span>
          </div>
          <h3 class="heading-3 mb-2">{t(currentLocale, `features.${i}.title` as StringKey)}</h3>
          <p class="text-dark-900/70 leading-relaxed">{t(currentLocale, `features.${i}.desc` as StringKey)}</p>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- =========================== HOW IT WORKS =========================== -->
<section id="how" class="section">
  <div class="container-narrow">
    <div class="text-center max-w-2xl mx-auto mb-16">
      <h2 class="heading-2 mb-4">{t(currentLocale, 'how.title')}</h2>
      <p class="text-lg text-dark-900/70">{t(currentLocale, 'how.subtitle')}</p>
    </div>

    <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {#each [1, 2, 3, 4] as i}
        <div class="relative">
          <div class="text-6xl font-bold text-primary-100 mb-4">0{i}</div>
          <h3 class="heading-3 mb-2">{t(currentLocale, `how.${i}.title` as StringKey)}</h3>
          <p class="text-dark-900/70 leading-relaxed">{t(currentLocale, `how.${i}.desc` as StringKey)}</p>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- =========================== PRICING =========================== -->
<section id="pricing" class="section bg-dark-50">
  <div class="container-narrow">
    <div class="text-center max-w-2xl mx-auto mb-16">
      <h2 class="heading-2 mb-4">{t(currentLocale, 'pricing.title')}</h2>
      <p class="text-lg text-dark-900/70">{t(currentLocale, 'pricing.subtitle')}</p>
    </div>

    <div class="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
      <!-- Free -->
      <div class="bg-white rounded-2xl p-8 border border-dark-100">
        <h3 class="text-lg font-semibold mb-2">{t(currentLocale, 'pricing.free.name')}</h3>
        <p class="text-sm text-dark-900/60 mb-6">{t(currentLocale, 'pricing.free.desc')}</p>
        <div class="mb-6">
          <span class="text-5xl font-bold">{t(currentLocale, 'pricing.free.price')}</span>
          <span class="text-dark-900/60">{t(currentLocale, 'pricing.oneTime')}</span>
        </div>
        <ul class="space-y-3 mb-8 text-sm">
          <li class="flex items-start gap-2">
            <svg class="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
            {t(currentLocale, 'pricing.free.f1')}
          </li>
          <li class="flex items-start gap-2">
            <svg class="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
            {t(currentLocale, 'pricing.free.f2')}
          </li>
          <li class="flex items-start gap-2">
            <svg class="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
            {t(currentLocale, 'pricing.free.f3')}
          </li>
          <li class="flex items-start gap-2">
            <svg class="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
            {t(currentLocale, 'pricing.free.f4')}
          </li>
        </ul>
        <a href="/register" class="btn-secondary w-full block text-center">
          {t(currentLocale, 'pricing.free.cta')}
        </a>
      </div>

      <!-- Pro (Highlighted) -->
      <div class="bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl p-8 text-white relative shadow-2xl shadow-primary-500/30 scale-105">
        <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-dark-900 text-white text-xs font-semibold rounded-full">
          {t(currentLocale, 'pricing.pro.badge')}
        </div>
        <h3 class="text-lg font-semibold mb-2">{t(currentLocale, 'pricing.pro.name')}</h3>
        <p class="text-sm text-white/80 mb-6">{t(currentLocale, 'pricing.pro.desc')}</p>
        <div class="mb-6">
          <span class="text-5xl font-bold">{t(currentLocale, 'pricing.pro.price')}</span>
          <span class="text-white/80">{t(currentLocale, 'pricing.oneTime')}</span>
        </div>
        <ul class="space-y-3 mb-8 text-sm">
          {#each [1, 2, 3, 4, 5] as i}
            <li class="flex items-start gap-2">
              <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
              {t(currentLocale, `pricing.pro.f${i}` as StringKey)}
            </li>
          {/each}
        </ul>
        <a href="/register" class="block w-full bg-white text-primary-700 font-semibold py-3 rounded-lg hover:bg-white/90 transition text-center">
          {t(currentLocale, 'pricing.pro.cta')}
        </a>
      </div>

      <!-- Team -->
      <div class="bg-white rounded-2xl p-8 border border-dark-100">
        <h3 class="text-lg font-semibold mb-2">{t(currentLocale, 'pricing.team.name')}</h3>
        <p class="text-sm text-dark-900/60 mb-6">{t(currentLocale, 'pricing.team.desc')}</p>
        <div class="mb-6">
          <span class="text-5xl font-bold">{t(currentLocale, 'pricing.team.price')}</span>
          <span class="text-dark-900/60">{t(currentLocale, 'pricing.oneTime')}</span>
        </div>
        <ul class="space-y-3 mb-8 text-sm">
          {#each [1, 2, 3, 4, 5] as i}
            <li class="flex items-start gap-2">
              <svg class="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
              {t(currentLocale, `pricing.team.f${i}` as StringKey)}
            </li>
          {/each}
        </ul>
        <a href="mailto:hello@businesssmartos.com" class="btn-secondary w-full">
          {t(currentLocale, 'pricing.team.cta')}
        </a>
      </div>
    </div>
  </div>
</section>

<!-- =========================== GET STARTED =========================== -->
<section id="waitlist" class="section">
  <div class="container-narrow max-w-2xl">
    <div class="bg-gradient-to-br from-dark-900 to-dark-950 rounded-3xl p-8 sm:p-12 text-center">
      <h2 class="heading-2 text-white mb-3">{t(currentLocale, 'waitlist.title')}</h2>
      <p class="text-white/70 mb-8">{t(currentLocale, 'waitlist.subtitle')}</p>

      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <a
          href="/register"
          class="bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-8 rounded-lg transition inline-block"
        >
          {t(currentLocale, 'waitlist.button')}
        </a>
        <a
          href="/login"
          class="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold py-3 px-8 rounded-lg transition inline-block"
        >
          {t(currentLocale, 'nav.signin')}
        </a>
      </div>

      <p class="mt-6 text-xs text-white/50">{t(currentLocale, 'waitlist.privacy')}</p>
    </div>
  </div>
</section>

<!-- =========================== FAQ =========================== -->
<section id="faq" class="section bg-dark-50">
  <div class="container-narrow max-w-3xl">
    <h2 class="heading-2 text-center mb-12">{t(currentLocale, 'faq.title')}</h2>

    <div class="space-y-3">
      {#each faqs as faq, i}
        <div class="bg-white rounded-xl border border-dark-100 overflow-hidden">
          <button
            onclick={() => openFaq = openFaq === i ? null : i}
            class="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-dark-50 transition"
          >
            <span class="font-semibold">{faq.q}</span>
            <svg
              class="w-5 h-5 text-dark-900/40 transition-transform"
              class:rotate-180={openFaq === i}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          {#if openFaq === i}
            <div class="px-6 pb-4 text-dark-900/70 leading-relaxed">
              {faq.a}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- =========================== FINAL CTA =========================== -->
<section class="section">
  <div class="container-narrow text-center max-w-2xl">
    <h2 class="heading-2 mb-4">{t(currentLocale, 'cta.title')}</h2>
    <p class="text-lg text-dark-900/70 mb-8">{t(currentLocale, 'cta.subtitle')}</p>
    <a href="/register" class="btn-primary text-base px-8 py-4 inline-block">
      {t(currentLocale, 'cta.button')}
    </a>
  </div>
</section>

<!-- =========================== FOOTER =========================== -->
<footer class="border-t border-dark-100 py-12">
  <div class="container-narrow">
    <div class="grid md:grid-cols-4 gap-8 mb-8">
      <div>
        <div class="flex items-center gap-2 mb-3">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <span class="text-white font-bold text-sm">B</span>
          </div>
          <span class="font-bold">Business Smart OS</span>
        </div>
        <p class="text-sm text-dark-900/60">{t(currentLocale, 'footer.tagline')}</p>
      </div>

      <div>
        <h4 class="font-semibold text-sm mb-3">{t(currentLocale, 'footer.product')}</h4>
        <ul class="space-y-2 text-sm text-dark-900/60">
          <li><a href="#features" class="hover:text-dark-900 transition">{t(currentLocale, 'footer.features')}</a></li>
          <li><a href="#pricing" class="hover:text-dark-900 transition">{t(currentLocale, 'footer.pricing')}</a></li>
          <li><a href="/changelog" class="hover:text-dark-900 transition">{t(currentLocale, 'footer.changelog')}</a></li>
        </ul>
      </div>

      <div>
        <h4 class="font-semibold text-sm mb-3">{t(currentLocale, 'footer.company')}</h4>
        <ul class="space-y-2 text-sm text-dark-900/60">
          <li><a href="/about" class="hover:text-dark-900 transition">{t(currentLocale, 'footer.about')}</a></li>
          <li><a href="/blog" class="hover:text-dark-900 transition">{t(currentLocale, 'footer.blog')}</a></li>
          <li><a href="mailto:hello@businesssmartos.com" class="hover:text-dark-900 transition">{t(currentLocale, 'footer.contact')}</a></li>
        </ul>
      </div>

      <div>
        <h4 class="font-semibold text-sm mb-3">{t(currentLocale, 'footer.legal')}</h4>
        <ul class="space-y-2 text-sm text-dark-900/60">
          <li><a href="/privacy" class="hover:text-dark-900 transition">{t(currentLocale, 'footer.privacy')}</a></li>
          <li><a href="/terms" class="hover:text-dark-900 transition">{t(currentLocale, 'footer.terms')}</a></li>
        </ul>
      </div>
    </div>

    <div class="pt-8 border-t border-dark-100 text-sm text-dark-900/60 text-center">
      {t(currentLocale, 'footer.copyright')}
    </div>
  </div>
</footer>
