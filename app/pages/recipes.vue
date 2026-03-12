<template>
  <div class="container page-recipes">
    <h1 class="page-title">{{ $t('nav.recipes') }}</h1>
    <div class="filters">
      <input type="search" v-model="search" :placeholder="$t('recipes.search')" />
      <select v-model="machineFilter">
        <option value="">{{ $t('recipes.allMachines') }}</option>
        <option v-for="m in machineNames" :key="m" :value="m">{{ tm(m) }}</option>
      </select>
      <label class="toggle-alt">
        <input type="checkbox" v-model="showAlternate" />
        <span>{{ $t('recipes.showAlt') }}</span>
      </label>
    </div>
    <div class="recipes-count">{{ $t('common.found') }}: {{ filtered.length }}</div>
    <div class="recipes-grid">
      <RecipeCard v-for="r in filtered" :key="r.Name" :recipe="r" />
    </div>
    <div v-if="!filtered.length" class="no-results">{{ $t('common.noResults') }}</div>
  </div>
</template>

<script setup lang="ts">
const { recipes } = useGameData()
const { translateMachine, translateRecipe, translatePart } = useTranslations()
const { locale, t } = useI18n()

const tm = (name: string) => translateMachine(name, locale.value)

const search = ref('')
const machineFilter = ref('')
const showAlternate = ref(true)

const machineNames = computed(() => {
  const set = new Set(recipes.value.map(r => r.Machine))
  return Array.from(set).sort()
})

const filtered = computed(() => {
  let list = recipes.value
  if (!showAlternate.value) list = list.filter(r => !r.Alternate)
  if (machineFilter.value) list = list.filter(r => r.Machine === machineFilter.value)
  if (search.value.trim()) {
    const s = search.value.toLowerCase()
    list = list.filter(r =>
      r.Name.toLowerCase().includes(s) ||
      translateRecipe(r.Name, 'ru').toLowerCase().includes(s) ||
      r.Parts.some(p => p.Part.toLowerCase().includes(s) || translatePart(p.Part, 'ru').toLowerCase().includes(s))
    )
  }
  return list
})

useSeoMeta({
  title: () => `${t('nav.recipes')} — Satisfactory Calculator`,
})
</script>

<style scoped>
.page-recipes { padding: 24px; }
.page-title { font-family: var(--font-display); font-size: 1.4rem; color: var(--orange); margin-bottom: 20px; }
.filters { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.filters input[type="search"] { max-width: 300px; }
.filters select {
  background: var(--bg); border: 1px solid var(--border2); border-radius: 4px;
  color: var(--text); font-family: var(--font-mono); font-size: .8rem;
  padding: 7px 12px; cursor: pointer;
}
.filters select:focus { border-color: var(--orange); outline: none; }
.toggle-alt { display: flex; align-items: center; gap: 6px; font-size: .75rem; color: var(--text2); cursor: pointer; }
.toggle-alt input { accent-color: var(--orange); }
.recipes-count { font-size: .68rem; color: var(--text3); margin-bottom: 12px; }
.recipes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 10px; }
.no-results { text-align: center; color: var(--text3); padding: 40px; font-style: italic; }
</style>
