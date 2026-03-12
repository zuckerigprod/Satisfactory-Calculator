<template>
  <div class="container page-parts">
    <h1 class="page-title">{{ $t('nav.parts') }}</h1>
    <div class="filters">
      <input type="search" v-model="search" :placeholder="$t('parts.search')" />
      <select v-model="tierFilter">
        <option value="">{{ $t('parts.allTiers') }}</option>
        <option v-for="t in tiers" :key="t" :value="t">Tier {{ t }}</option>
      </select>
    </div>
    <div class="parts-table">
      <div class="table-header">
        <span class="col-icon"></span>
        <span class="col-name" @click="sortBy('Name')">{{ $t('calc.part') }} {{ sortIcon('Name') }}</span>
        <span class="col-tier" @click="sortBy('Tier')">{{ $t('parts.tier') }} {{ sortIcon('Tier') }}</span>
        <span class="col-sink" @click="sortBy('SinkPoints')">{{ $t('parts.sinkPoints') }} {{ sortIcon('SinkPoints') }}</span>
        <span class="col-recipes">{{ $t('parts.recipesCount') }}</span>
      </div>
      <div v-for="p in filtered" :key="p.Name" class="table-row" @click="goToCalc(p.Name)">
        <span class="col-icon"><img :src="getIconPath(p.Name)" :alt="p.Name" /></span>
        <span class="col-name">{{ tp(p.Name) }}</span>
        <span class="col-tier"><span class="tier-badge">{{ p.Tier }}</span></span>
        <span class="col-sink">{{ p.SinkPoints > 0 ? p.SinkPoints.toLocaleString() : '-' }}</span>
        <span class="col-recipes">{{ getRecipeCount(p.Name) }}</span>
      </div>
      <div v-if="!filtered.length" class="no-results">{{ $t('common.noResults') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { parts, recipesByOutput, getTierNumber } = useGameData()
const { translatePart, getIconPath } = useTranslations()
const { locale, t } = useI18n()
const router = useRouter()

const tp = (name: string) => translatePart(name, locale.value)

const search = ref('')
const tierFilter = ref('')
const sortKey = ref<'Name' | 'Tier' | 'SinkPoints'>('Tier')
const sortAsc = ref(true)

const tiers = computed(() => {
  const set = new Set(parts.value.map(p => p.Tier.split('-')[0]))
  return Array.from(set).sort((a, b) => Number(a) - Number(b))
})

function sortBy(key: 'Name' | 'Tier' | 'SinkPoints') {
  if (sortKey.value === key) sortAsc.value = !sortAsc.value
  else { sortKey.value = key; sortAsc.value = true }
}

function sortIcon(key: string) { return sortKey.value === key ? (sortAsc.value ? '^' : 'v') : '' }

const filtered = computed(() => {
  let list = [...parts.value]
  if (search.value.trim()) {
    const s = search.value.toLowerCase()
    list = list.filter(p =>
      p.Name.toLowerCase().includes(s) ||
      translatePart(p.Name, 'ru').toLowerCase().includes(s)
    )
  }
  if (tierFilter.value) list = list.filter(p => p.Tier.startsWith(tierFilter.value + '-'))

  list.sort((a, b) => {
    let cmp = 0
    if (sortKey.value === 'Name') {
      const an = translatePart(a.Name, locale.value)
      const bn = translatePart(b.Name, locale.value)
      cmp = an.localeCompare(bn)
    }
    else if (sortKey.value === 'Tier') cmp = getTierNumber(a.Tier) - getTierNumber(b.Tier)
    else cmp = a.SinkPoints - b.SinkPoints
    return sortAsc.value ? cmp : -cmp
  })
  return list
})

function getRecipeCount(partName: string) {
  return recipesByOutput.value.get(partName)?.length || 0
}

function goToCalc(partName: string) {
  router.push({ path: '/', query: { part: partName } })
}

useSeoMeta({
  title: () => `${t('nav.parts')} — Satisfactory Calculator`,
})
</script>

<style scoped>
.page-parts { padding: 24px; }
.page-title { font-family: var(--font-display); font-size: 1.4rem; color: var(--orange); margin-bottom: 20px; }
.filters { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.filters input[type="search"] { max-width: 300px; }
.filters select {
  background: var(--bg); border: 1px solid var(--border2); border-radius: 4px;
  color: var(--text); font-family: var(--font-mono); font-size: .8rem; padding: 7px 12px; cursor: pointer;
}
.filters select:focus { border-color: var(--orange); outline: none; }

.parts-table { border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.table-header, .table-row { display: grid; grid-template-columns: 36px 1fr 80px 100px 80px; padding: 8px 14px; align-items: center; }
.table-header {
  background: var(--bg3); font-size: .65rem; color: var(--text3);
  letter-spacing: 1px; text-transform: uppercase; cursor: pointer; user-select: none;
}
.table-header span:hover { color: var(--orange); }
.table-row {
  font-size: .75rem; border-top: 1px solid var(--border); background: var(--bg);
  cursor: pointer; transition: all .15s;
}
.table-row:hover { background: var(--bg3); }
.col-icon img { width: 24px; height: 24px; object-fit: contain; }
.col-tier, .col-sink, .col-recipes { text-align: center; }
.tier-badge {
  font-size: .6rem; padding: 2px 6px; border-radius: 3px;
  background: var(--orange-dim); color: var(--orange);
}
.no-results { text-align: center; color: var(--text3); padding: 40px; font-style: italic; border-top: 1px solid var(--border); }
</style>
