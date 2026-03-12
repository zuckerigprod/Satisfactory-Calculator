const siteUrl = process.env.SITE_URL || 'https://satisfactory.gameassistants.ru'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@nuxtjs/i18n', '@nuxtjs/sitemap'],
  css: ['~/assets/css/main.css'],
  site: {
    url: siteUrl,
  },
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'Satisfactory — Production Calculator',
      link: [
        { rel: 'icon', type: 'image/png', sizes: '256x256', href: '/window.png' },
        { rel: 'apple-touch-icon', href: '/window.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Dela+Gothic+One&display=swap' },
      ],
      meta: [
        { name: 'theme-color', content: '#070709' },
        { name: 'color-scheme', content: 'dark' },
        { name: 'description', content: 'Satisfactory Production Calculator — калькулятор производственных цепочек. Рассчитывайте рецепты, ресурсы и энергопотребление.' },
        { name: 'keywords', content: 'Satisfactory, calculator, production, калькулятор, производство, рецепты, ресурсы, фабрика' },
        { name: 'author', content: 'ZuckerigProd' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'Satisfactory — Production Calculator' },
        { property: 'og:description', content: 'Калькулятор производственных цепочек для Satisfactory — рецепты, ресурсы, энергопотребление.' },
        { property: 'og:url', content: siteUrl },
        { property: 'og:site_name', content: 'Satisfactory Calculator' },
        { property: 'og:locale', content: 'ru_RU' },
        { property: 'og:locale:alternate', content: 'en_US' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Satisfactory — Production Calculator' },
        { name: 'twitter:description', content: 'Калькулятор производственных цепочек для Satisfactory.' },
      ],
    },
  },
  i18n: {
    locales: [
      { code: 'ru', name: 'Русский', file: 'ru.json' },
      { code: 'en', name: 'English', file: 'en.json' },
    ],
    defaultLocale: 'ru',
    langDir: '../i18n/locales',
    strategy: 'no_prefix',
  },
})
