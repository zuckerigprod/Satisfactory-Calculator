<template>
  <div class="recipe-card" :class="{ alternate: recipe.Alternate }">
    <div class="recipe-header">
      <span class="recipe-name">{{ tr(recipe.Name) }}</span>
      <span v-if="recipe.Alternate" class="badge badge-alt">ALT</span>
      <span class="recipe-machine">{{ tm(recipe.Machine) }}</span>
    </div>
    <div class="recipe-flow">
      <div class="recipe-inputs">
        <div v-for="inp in rates.inputs" :key="inp.part" class="flow-item input">
          <img :src="getIconPath(inp.part)" :alt="inp.part" class="flow-icon" />
          <span class="flow-rate">{{ formatNum(inp.perMin) }}/{{ $t('common.min') }}</span>
          <span class="flow-part">{{ tp(inp.part) }}</span>
        </div>
      </div>
      <div class="flow-arrow">
        <svg width="20" height="14" viewBox="0 0 20 14"><path d="M0 7h16M12 2l5 5-5 5" fill="none" stroke="var(--orange)" stroke-width="1.5"/></svg>
        <span class="batch-time">{{ formatNum(batchTime) }}s</span>
      </div>
      <div class="recipe-outputs">
        <div v-for="out in rates.outputs" :key="out.part" class="flow-item output">
          <img :src="getIconPath(out.part)" :alt="out.part" class="flow-icon" />
          <span class="flow-rate">{{ formatNum(out.perMin) }}/{{ $t('common.min') }}</span>
          <span class="flow-part">{{ tp(out.part) }}</span>
        </div>
      </div>
    </div>
    <div class="recipe-footer">
      <span class="power" :class="power < 0 ? 'consumption' : 'generation'">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        {{ power > 0 ? '+' : '' }}{{ power }} MW
      </span>
      <span class="tier">T{{ recipe.Tier }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Recipe } from '~/composables/useGameData'

const props = defineProps<{ recipe: Recipe }>()
const { getRecipeRates, getMachinePower, parseFraction } = useGameData()
const { translatePart, translateMachine, translateRecipe, getIconPath } = useTranslations()
const { locale } = useI18n()

const tp = (name: string) => translatePart(name, locale.value)
const tm = (name: string) => translateMachine(name, locale.value)
const tr = (name: string) => translateRecipe(name, locale.value)

const rates = computed(() => getRecipeRates(props.recipe))
const batchTime = computed(() => parseFraction(props.recipe.BatchTime))
const power = computed(() => getMachinePower(props.recipe.Machine))

function formatNum(n: number): string {
  if (Number.isInteger(n)) return n.toString()
  return n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}
</script>

<style scoped>
.recipe-card {
  background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
  padding: 12px; transition: all .15s;
}
.recipe-card:hover { border-color: var(--border2); }
.recipe-card.alternate { border-left: 2px solid var(--purple); }
.recipe-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.recipe-name { font-size: .8rem; font-weight: 600; color: var(--text); }
.recipe-machine { margin-left: auto; font-size: .65rem; color: var(--text3); }
.recipe-flow { display: flex; align-items: center; gap: 10px; }
.recipe-inputs, .recipe-outputs { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.flow-item { display: flex; align-items: center; gap: 6px; font-size: .72rem; }
.flow-item.input { color: var(--red); }
.flow-item.output { color: var(--green); }
.flow-icon { width: 20px; height: 20px; object-fit: contain; flex-shrink: 0; }
.flow-rate { font-weight: 600; min-width: 50px; text-align: right; }
.flow-part { color: var(--text2); }
.flow-arrow { display: flex; flex-direction: column; align-items: center; gap: 2px; flex-shrink: 0; }
.batch-time { font-size: .55rem; color: var(--text3); }
.recipe-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); }
.power { font-size: .68rem; display: flex; align-items: center; gap: 4px; }
.power.consumption { color: var(--amber); }
.power.generation { color: var(--green); }
.tier { font-size: .62rem; color: var(--text3); }
</style>
