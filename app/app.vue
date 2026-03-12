<template>
  <div id="app">
    <AppHeader />
    <NuxtPage />
    <footer class="site-footer">
      <span class="footer-text">
        {{ locale === 'ru' ? 'Сделано с' : 'Made with' }}
        <svg class="heart" width="16" height="16" viewBox="0 0 24 24" fill="var(--red)" xmlns="http://www.w3.org/2000/svg">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <a href="https://t.me/ZuckerigProd" target="_blank" rel="noopener" class="footer-link">ZuckerigProd</a>
      </span>
    </footer>
  </div>
</template>

<script setup lang="ts">
const { locale } = useI18n()
</script>

<style scoped>
.site-footer {
  padding: 18px 24px;
  border-top: 1px solid var(--border);
  background: var(--bg2);
  text-align: center;
}
.footer-text {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: .75rem;
  color: var(--text3);
  font-family: var(--font-mono);
}
.heart { animation: heartbeat 1.2s ease-in-out infinite; }
@keyframes heartbeat {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.25); opacity: .7; }
}
.footer-link { color: var(--orange); text-decoration: none; font-weight: 600; transition: color .2s; }
.footer-link:hover { text-decoration: underline; }
</style>
