<template>
  <div class="calc-layout">
    <!-- ЛЕВО: Выбор детали -->
    <aside class="panel panel-left">
      <section class="panel-section">
        <div class="panel-title">{{ $t('calc.selectTarget') }}</div>
        <input type="search" v-model="partSearch" :placeholder="$t('calc.searchPart')" class="search-input" />
        <div class="part-list">
          <div
            v-for="part in filteredParts"
            :key="part.Name"
            class="part-item"
            @click="selectTarget(part.Name)"
          >
            <img :src="getIconPath(part.Name)" :alt="part.Name" class="part-icon" />
            <div class="part-info">
              <div class="part-name">{{ tp(part.Name) }}</div>
              <div class="part-tier">T{{ part.Tier }}</div>
            </div>
            <div class="part-sink" v-if="part.SinkPoints > 0">
              {{ part.SinkPoints.toLocaleString() }}
            </div>
          </div>
        </div>
      </section>
    </aside>

    <!-- ЦЕНТР: Калькулятор -->
    <main class="panel panel-center">
      <div v-if="!selectedPart" class="empty-state">
        <img src="/window.png" alt="" class="empty-logo" />
        <p>{{ $t('calc.selectPartHint') }}</p>
      </div>

      <div v-else class="calculator-main">
        <div class="calc-header">
          <div class="calc-target">
            <img :src="getIconPath(selectedPart)" :alt="selectedPart" class="target-icon" />
            <div>
              <span class="target-label">{{ $t('calc.target') }}:</span>
              <span class="target-name">{{ tp(selectedPart) }}</span>
            </div>
          </div>
          <div class="rate-input">
            <label>{{ $t('calc.itemsPerMin') }}:</label>
            <input type="number" v-model.number="targetRate" min="0.1" step="1" @change="recalculate" />
          </div>
          <button class="btn btn-danger btn-sm" @click="clearCalc">{{ $t('calc.clear') }}</button>
        </div>

        <ProductionTree
          v-if="chainResult"
          :result="chainResult"
          :selected-recipes="selectedRecipes"
          @select-recipe="onSelectRecipe"
        />
      </div>
    </main>

    <!-- ПРАВО: Сохранённые цепочки -->
    <aside class="panel panel-right">
      <section class="panel-section">
        <div class="panel-title">{{ $t('calc.savedChains') }}</div>
        <button class="btn btn-primary btn-sm save-btn" :disabled="!selectedPart" @click="saveCurrentChain">
          {{ $t('calc.saveChain') }}
        </button>
        <div class="saved-list">
          <div v-for="(chain, i) in chains" :key="i" class="saved-item" @click="loadChain(chain)">
            <img :src="getIconPath(chain.targetPart)" :alt="chain.targetPart" class="saved-icon" />
            <div>
              <div class="saved-name">{{ tp(chain.targetPart) }}</div>
              <div class="saved-detail">{{ chain.targetRate }}/{{ $t('common.min') }}</div>
            </div>
            <button class="rdel" @click.stop="removeChain(i)">x</button>
          </div>
          <div v-if="!chains.length" class="no-items">{{ $t('calc.noSavedChains') }}</div>
        </div>
      </section>

      <!-- Быстрый выбор рецептов для выбранной детали -->
      <section class="panel-section" v-if="selectedPart && availableRecipes.length">
        <div class="panel-title">{{ $t('calc.availableRecipes') }}</div>
        <div class="recipe-list-small">
          <div v-for="r in availableRecipes" :key="r.Name" class="recipe-mini"
            :class="{ active: selectedRecipes[selectedPart] === r.Name || (!selectedRecipes[selectedPart] && r === availableRecipes[0]) }"
            @click="onSelectRecipe(selectedPart!, r.Name)"
          >
            <div class="rm-name">{{ tr(r.Name) }}</div>
            <div class="rm-machine">{{ tm(r.Machine) }}{{ r.Alternate ? ' [ALT]' : '' }}</div>
          </div>
        </div>
      </section>
    </aside>
  </div>
</template>

<script setup lang="ts">
const { parts, recipesByOutput } = useGameData()
const { chains, addChain, removeChain, calculateChain } = useCalculator()
const { translatePart, translateMachine, translateRecipe, getIconPath } = useTranslations()
const { locale, t } = useI18n()

const tp = (name: string) => translatePart(name, locale.value)
const tm = (name: string) => translateMachine(name, locale.value)
const tr = (name: string) => translateRecipe(name, locale.value)

const route = useRoute()

const partSearch = ref('')
const selectedPart = ref<string | null>(null)
const targetRate = ref(10)
const selectedRecipes = reactive<Record<string, string>>({})
const chainResult = ref<ReturnType<typeof calculateChain> | null>(null)

// Обработка параметра ?part= из URL
onMounted(() => {
  const qp = route.query.part
  if (qp && typeof qp === 'string') {
    selectedPart.value = qp
    recalculate()
  }
})

const filteredParts = computed(() => {
  const search = partSearch.value.toLowerCase().trim()
  let list = parts.value.filter(p => {
    const recipes = recipesByOutput.value.get(p.Name)
    return recipes && recipes.length > 0
  })
  if (search) {
    list = list.filter(p =>
      p.Name.toLowerCase().includes(search) ||
      translatePart(p.Name, 'ru').toLowerCase().includes(search)
    )
  }
  return list
})

const availableRecipes = computed(() => {
  if (!selectedPart.value) return []
  return recipesByOutput.value.get(selectedPart.value) || []
})

function selectTarget(partName: string) {
  selectedPart.value = partName
  recalculate()
}

function recalculate() {
  if (!selectedPart.value || targetRate.value <= 0) {
    chainResult.value = null
    return
  }
  chainResult.value = calculateChain(selectedPart.value, targetRate.value, selectedRecipes)
}

function onSelectRecipe(part: string, recipeName: string) {
  selectedRecipes[part] = recipeName
  recalculate()
}

function clearCalc() {
  selectedPart.value = null
  chainResult.value = null
  Object.keys(selectedRecipes).forEach(k => delete selectedRecipes[k])
}

function saveCurrentChain() {
  if (!selectedPart.value) return
  addChain(selectedPart.value, targetRate.value, `${selectedPart.value} x${targetRate.value}`)
}

function loadChain(chain: { targetPart: string; targetRate: number; selectedRecipes: Record<string, string> }) {
  selectedPart.value = chain.targetPart
  targetRate.value = chain.targetRate
  Object.keys(selectedRecipes).forEach(k => delete selectedRecipes[k])
  Object.assign(selectedRecipes, chain.selectedRecipes)
  recalculate()
}

useSeoMeta({
  title: () => t('title'),
  description: () => t('meta.description'),
})
</script>

<style scoped>
.calc-layout { display: grid; grid-template-columns: 280px 1fr 280px; min-height: calc(100vh - 53px); }
.panel { overflow-y: auto; max-height: calc(100vh - 53px); }
.panel-left { border-right: 1px solid var(--border); background: var(--bg2); }
.panel-center { background: var(--bg); padding: 20px; }
.panel-right { border-left: 1px solid var(--border); background: var(--bg2); }
.panel-section { padding: 14px; border-bottom: 1px solid var(--border); }

.search-input { margin-bottom: 10px; }

.part-list { display: flex; flex-direction: column; gap: 3px; max-height: calc(100vh - 180px); overflow-y: auto; }
.part-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; background: var(--bg); border: 1px solid var(--border);
  border-radius: 4px; cursor: pointer; transition: all .15s;
}
.part-item:hover { border-color: var(--orange); background: var(--bg3); }
.part-icon { width: 28px; height: 28px; object-fit: contain; flex-shrink: 0; }
.part-info { flex: 1; min-width: 0; }
.part-name { font-size: .73rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.part-tier { font-size: .58rem; color: var(--text3); }
.part-sink { font-size: .6rem; color: var(--text3); white-space: nowrap; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; gap: 16px; color: var(--text3); }
.empty-state p { font-size: .85rem; }
.empty-logo { width: 64px; height: 64px; opacity: .4; }

.calculator-main { }
.calc-header {
  display: flex; align-items: center; gap: 16px; padding-bottom: 16px;
  margin-bottom: 20px; border-bottom: 1px solid var(--border);
}
.calc-target { flex: 1; display: flex; align-items: center; gap: 12px; }
.target-icon { width: 40px; height: 40px; object-fit: contain; }
.target-label { font-size: .65rem; color: var(--text3); letter-spacing: 2px; text-transform: uppercase; }
.target-name { font-size: 1.1rem; font-weight: 700; color: var(--orange); margin-left: 8px; }
.rate-input { display: flex; align-items: center; gap: 8px; }
.rate-input label { font-size: .7rem; color: var(--text2); white-space: nowrap; }
.rate-input input { width: 80px; text-align: center; }

.save-btn { width: 100%; margin-bottom: 10px; }

.saved-list { display: flex; flex-direction: column; gap: 4px; }
.saved-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 8px; background: var(--bg); border: 1px solid var(--border);
  border-radius: 4px; cursor: pointer; transition: all .15s;
}
.saved-item:hover { border-color: var(--orange-glow); }
.saved-icon { width: 22px; height: 22px; object-fit: contain; }
.saved-name { font-size: .72rem; }
.saved-detail { font-size: .58rem; color: var(--text3); }
.rdel { background: none; border: none; color: var(--text3); cursor: pointer; font-size: .75rem; padding: 2px 6px; margin-left: auto; }
.rdel:hover { color: var(--red); }
.no-items { color: var(--text3); font-size: .72rem; text-align: center; padding: 16px; font-style: italic; }

.recipe-list-small { display: flex; flex-direction: column; gap: 4px; }
.recipe-mini {
  padding: 6px 8px; background: var(--bg); border: 1px solid var(--border);
  border-radius: 4px; font-size: .7rem; cursor: pointer; transition: all .15s;
}
.recipe-mini:hover { border-color: var(--border2); }
.recipe-mini.active { border-color: var(--orange); box-shadow: 0 0 8px var(--orange-glow); }
.rm-name { color: var(--text); }
.rm-machine { font-size: .58rem; color: var(--text3); }

@media (max-width: 1000px) {
  .calc-layout { grid-template-columns: 1fr; }
  .panel { max-height: none; }
  .panel-left, .panel-right { border: none; }
}
</style>
