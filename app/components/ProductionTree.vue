<template>
  <div class="tree" v-if="result">
    <!-- 2D Chain Map -->
    <div class="section">
      <div class="panel-title">{{ $t('calc.chainMap') }}</div>
      <ChainMap :result="result" :selected-recipes="selectedRecipes" />
    </div>

    <!-- Summary cards -->
    <div class="tree-summary">
      <div class="summary-item">
        <div class="summary-label">{{ $t('calc.totalPower') }}</div>
        <div class="summary-value" :class="result.totalPower < 0 ? 'consumption' : 'generation'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          {{ result.totalPower }} MW
        </div>
      </div>
      <div class="summary-item">
        <div class="summary-label">{{ $t('calc.totalMachines') }}</div>
        <div class="summary-value">{{ totalMachines }}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">{{ $t('calc.rawResources') }}</div>
        <div class="summary-value" style="font-size:.85rem">{{ result.rawResources.length }}</div>
      </div>
    </div>

    <!-- Raw Resources -->
    <div class="section">
      <div class="panel-title">{{ $t('calc.rawResources') }}</div>
      <div class="resource-grid">
        <div v-for="res in result.rawResources" :key="res.part" class="resource-item">
          <img :src="getIconPath(res.part)" :alt="res.part" class="res-icon" />
          <span class="res-name">{{ tp(res.part) }}</span>
          <span class="res-rate">{{ formatNum(res.perMin) }}/{{ $t('common.min') }}</span>
        </div>
      </div>
    </div>

    <!-- Production Steps (list view) -->
    <details class="section-details" open>
      <summary class="panel-title clickable">{{ $t('calc.productionSteps') }} ({{ result.nodes.length }})</summary>
      <div class="steps-list">
        <div v-for="node in result.nodes" :key="node.id" class="step-card">
          <div class="step-header">
            <img :src="getIconPath(node.targetOutput)" :alt="node.targetOutput" class="step-icon" />
            <div class="step-info">
              <span class="step-recipe">{{ tr(node.recipe.Name) }}</span>
              <span v-if="node.recipe.Alternate" class="badge badge-alt">ALT</span>
            </div>
            <div class="step-meta">
              <span class="step-machine">{{ tm(node.machineTier || node.recipe.Machine) }}</span>
              <span class="mul-value">x{{ formatNum(node.multiplier) }}</span>
            </div>
          </div>
          <div class="step-flow">
            <div class="step-inputs">
              <div v-for="inp in getNodeInputs(node)" :key="inp.part" class="sio">
                <img :src="getIconPath(inp.part)" class="sio-icon" />
                <span class="sio-rate input">-{{ formatNum(inp.perMin) }}</span>
                <span class="sio-part">{{ tp(inp.part) }}</span>
              </div>
            </div>
            <svg class="flow-arrow" width="20" height="14" viewBox="0 0 20 14"><path d="M0 7h16M12 2l5 5-5 5" fill="none" stroke="var(--orange)" stroke-width="1.5"/></svg>
            <div class="step-outputs">
              <div v-for="out in getNodeOutputs(node)" :key="out.part" class="sio">
                <img :src="getIconPath(out.part)" class="sio-icon" />
                <span class="sio-rate output">+{{ formatNum(out.perMin) }}</span>
                <span class="sio-part">{{ tp(out.part) }}</span>
              </div>
            </div>
            <div class="step-power" :class="getNodePower(node) < 0 ? 'consumption' : 'generation'">
              {{ formatNum(getNodePower(node)) }} MW
            </div>
          </div>
          <!-- Recipe selector -->
          <div class="step-recipe-select" v-if="getAlternatives(node.targetOutput).length > 1">
            <select :value="selectedRecipes[node.targetOutput] || node.recipe.Name" @change="$emit('selectRecipe', node.targetOutput, ($event.target as HTMLSelectElement).value)">
              <option v-for="r in getAlternatives(node.targetOutput)" :key="r.Name" :value="r.Name">
                {{ tr(r.Name) }} ({{ tm(r.Machine) }}){{ r.Alternate ? ' [ALT]' : '' }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </details>

    <!-- Parts Balance -->
    <details class="section-details">
      <summary class="panel-title clickable">{{ $t('calc.partsBalance') }} ({{ result.allParts.length }})</summary>
      <div class="balance-table">
        <div class="balance-header">
          <span></span>
          <span>{{ $t('calc.part') }}</span>
          <span>{{ $t('calc.produced') }}</span>
          <span>{{ $t('calc.consumed') }}</span>
          <span>{{ $t('calc.net') }}</span>
        </div>
        <div v-for="p in sortedParts" :key="p.part" class="balance-row" :class="{ surplus: p.net > 0.001, deficit: p.net < -0.001 }">
          <span class="bp-icon-col"><img :src="getIconPath(p.part)" class="bp-icon" /></span>
          <span class="bp-name">{{ tp(p.part) }}</span>
          <span class="bp-val produced">{{ p.produced > 0 ? formatNum(p.produced) : '-' }}</span>
          <span class="bp-val consumed">{{ p.consumed > 0 ? formatNum(p.consumed) : '-' }}</span>
          <span class="bp-val net" :class="{ positive: p.net > 0.001, negative: p.net < -0.001 }">
            {{ p.net > 0 ? '+' : '' }}{{ formatNum(p.net) }}
          </span>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import type { ChainResult, ProductionNode } from '~/composables/useCalculator'

const props = defineProps<{
  result: ChainResult
  selectedRecipes: Record<string, string>
}>()

defineEmits<{
  selectRecipe: [part: string, recipeName: string]
}>()

const { getRecipeRates, getMachinePower, recipesByOutput } = useGameData()
const { translatePart, translateMachine, translateRecipe, getIconPath } = useTranslations()
const { locale } = useI18n()

const tp = (n: string) => translatePart(n, locale.value)
const tm = (n: string) => translateMachine(n, locale.value)
const tr = (n: string) => translateRecipe(n, locale.value)

const totalMachines = computed(() =>
  props.result.nodes.reduce((sum, n) => sum + Math.ceil(n.multiplier), 0)
)

const sortedParts = computed(() =>
  [...props.result.allParts].sort((a, b) => {
    if (a.net < -0.001 && b.net >= -0.001) return -1
    if (b.net < -0.001 && a.net >= -0.001) return 1
    return a.part.localeCompare(b.part)
  })
)

function getNodeInputs(node: ProductionNode) {
  const rates = getRecipeRates(node.recipe, node.machineTier)
  return rates.inputs.map(i => ({ part: i.part, perMin: Math.round(i.perMin * node.multiplier * 1000) / 1000 }))
}

function getNodeOutputs(node: ProductionNode) {
  const rates = getRecipeRates(node.recipe, node.machineTier)
  return rates.outputs.map(o => ({ part: o.part, perMin: Math.round(o.perMin * node.multiplier * 1000) / 1000 }))
}

function getNodePower(node: ProductionNode) {
  return Math.round(getMachinePower(node.recipe.Machine, node.machineTier) * node.multiplier * 100) / 100
}

function getAlternatives(partName: string) {
  return recipesByOutput.value.get(partName) || []
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return n.toString()
  return n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}
</script>

<style scoped>
.tree { display: flex; flex-direction: column; gap: 20px; }

.tree-summary { display: flex; gap: 12px; }
.summary-item { flex: 1; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 12px; }
.summary-label { font-size: .6rem; color: var(--text3); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
.summary-value { font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 6px; }
.summary-value.consumption { color: var(--amber); }
.summary-value.generation { color: var(--green); }

.section { }
.section-details { }
.section-details > summary { cursor: pointer; list-style: none; }
.section-details > summary::-webkit-details-marker { display: none; }
.clickable:hover { color: var(--orange); }

.resource-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.resource-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  background: var(--bg); border: 1px solid var(--border); border-radius: 4px;
}
.res-icon { width: 24px; height: 24px; object-fit: contain; }
.res-name { font-size: .75rem; }
.res-rate { font-size: .72rem; color: var(--orange); font-weight: 600; }

.steps-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.step-card {
  background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
  padding: 10px 12px; transition: all .15s;
}
.step-card:hover { border-color: var(--border2); }
.step-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.step-icon { width: 24px; height: 24px; object-fit: contain; }
.step-info { flex: 1; display: flex; align-items: center; gap: 6px; }
.step-recipe { font-size: .78rem; font-weight: 600; }
.step-meta { display: flex; flex-direction: column; align-items: flex-end; }
.step-machine { font-size: .6rem; color: var(--text3); }
.mul-value { font-size: .9rem; color: var(--orange); font-weight: 700; }

.step-flow { display: flex; align-items: center; gap: 10px; }
.step-inputs, .step-outputs { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.sio { font-size: .72rem; display: flex; align-items: center; gap: 4px; }
.sio-icon { width: 16px; height: 16px; object-fit: contain; }
.sio-rate.input { color: var(--red); font-weight: 600; min-width: 50px; }
.sio-rate.output { color: var(--green); font-weight: 600; min-width: 50px; }
.sio-part { color: var(--text2); }
.flow-arrow { flex-shrink: 0; }

.step-power { font-size: .72rem; font-weight: 600; white-space: nowrap; margin-left: auto; }
.step-power.consumption { color: var(--amber); }
.step-power.generation { color: var(--green); }

.step-recipe-select { margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border); }
.step-recipe-select select {
  background: var(--bg2); border: 1px solid var(--border2); border-radius: 4px;
  color: var(--text); font-family: var(--font-mono); font-size: .7rem;
  padding: 4px 8px; cursor: pointer; width: 100%;
}
.step-recipe-select select:focus { border-color: var(--orange); outline: none; }

.balance-table { border: 1px solid var(--border); border-radius: 6px; overflow: hidden; margin-top: 10px; }
.balance-header, .balance-row { display: grid; grid-template-columns: 28px 1fr 80px 80px 80px; padding: 6px 12px; align-items: center; }
.balance-header {
  background: var(--bg3); font-size: .6rem; color: var(--text3);
  letter-spacing: 1px; text-transform: uppercase;
}
.balance-row { font-size: .72rem; border-top: 1px solid var(--border); background: var(--bg); }
.balance-row.surplus { background: rgba(0,255,136,0.03); }
.balance-row.deficit { background: rgba(255,51,85,0.03); }
.bp-icon-col { display: flex; align-items: center; }
.bp-icon { width: 18px; height: 18px; object-fit: contain; }
.bp-name { color: var(--text); }
.bp-val { text-align: right; }
.bp-val.produced { color: var(--green); }
.bp-val.consumed { color: var(--red); }
.bp-val.net.positive { color: var(--green); }
.bp-val.net.negative { color: var(--red); }
</style>
