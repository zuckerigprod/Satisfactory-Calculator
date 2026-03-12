<template>
  <div class="container page-machines">
    <h1 class="page-title">{{ $t('nav.machines') }}</h1>
    <div class="filters">
      <input type="search" v-model="search" :placeholder="$t('machines.search')" />
    </div>
    <div class="machines-grid">
      <div v-for="m in filtered" :key="m.Name" class="machine-card">
        <div class="mc-header">
          <img :src="getIconPath(m.Name)" :alt="m.Name" class="mc-icon" />
          <div>
            <span class="mc-name">{{ tm(m.Name) }}</span>
            <span class="mc-tier">T{{ m.Tier }}</span>
          </div>
        </div>
        <div class="mc-power" v-if="m.AveragePower && m.AveragePower !== '0'">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          <span :class="parseFraction(m.AveragePower) < 0 ? 'consumption' : 'generation'">
            {{ parseFraction(m.AveragePower) }} MW
          </span>
        </div>
        <div class="mc-cost" v-if="m.Cost && m.Cost.length">
          <div class="cost-title">{{ $t('machines.buildCost') }}</div>
          <div v-for="c in m.Cost" :key="c.Part" class="cost-item">
            <img :src="getIconPath(c.Part)" :alt="c.Part" class="cost-icon" />
            <span class="cost-part">{{ tp(c.Part) }}</span>
            <span class="cost-amount">x{{ c.Amount }}</span>
          </div>
        </div>
        <div class="mc-footer">
          <span v-if="getRecipeCount(m.Name)" class="badge badge-orange">{{ $t('machines.recipesCount') }}: {{ getRecipeCount(m.Name) }}</span>
          <span v-if="m.MaxProductionShards" class="badge badge-cyan">{{ $t('machines.shards') }}: {{ m.MaxProductionShards }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { machines, recipesByMachine, parseFraction } = useGameData()
const { translateMachine, translatePart, getIconPath } = useTranslations()
const { locale, t } = useI18n()

const tm = (name: string) => translateMachine(name, locale.value)
const tp = (name: string) => translatePart(name, locale.value)

const search = ref('')

const filtered = computed(() => {
  if (!search.value.trim()) return machines.value
  const s = search.value.toLowerCase()
  return machines.value.filter(m =>
    m.Name.toLowerCase().includes(s) ||
    translateMachine(m.Name, 'ru').toLowerCase().includes(s)
  )
})

function getRecipeCount(machineName: string) {
  return recipesByMachine.value.get(machineName)?.length || 0
}

useSeoMeta({
  title: () => `${t('nav.machines')} — Satisfactory Calculator`,
})
</script>

<style scoped>
.page-machines { padding: 24px; }
.page-title { font-family: var(--font-display); font-size: 1.4rem; color: var(--orange); margin-bottom: 20px; }
.filters { margin-bottom: 20px; }
.filters input[type="search"] { max-width: 300px; }

.machines-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.machine-card {
  background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
  padding: 14px; transition: all .15s;
}
.machine-card:hover { border-color: var(--border2); }
.mc-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.mc-icon { width: 36px; height: 36px; object-fit: contain; }
.mc-name { font-size: .85rem; font-weight: 600; display: block; }
.mc-tier { font-size: .58rem; color: var(--text3); }
.mc-power { display: flex; align-items: center; gap: 4px; font-size: .75rem; margin-bottom: 10px; }
.mc-power .consumption { color: var(--amber); }
.mc-power .generation { color: var(--green); }
.mc-cost { margin-bottom: 10px; }
.cost-title { font-size: .6rem; color: var(--text3); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
.cost-item { display: flex; align-items: center; gap: 6px; font-size: .68rem; padding: 2px 0; }
.cost-icon { width: 18px; height: 18px; object-fit: contain; }
.cost-part { color: var(--text2); flex: 1; }
.cost-amount { color: var(--orange); }
.mc-footer { display: flex; gap: 6px; flex-wrap: wrap; }
</style>
