import type { Recipe } from './useGameData'

export interface ProductionNode {
  id: string
  recipe: Recipe
  targetOutput: string       // какой предмет производит
  multiplier: number         // кол-во машин (дробное)
  overclockPercent: number   // 100 = по умолчанию
  children: ProductionNode[] // входные узлы (DAG — общие ссылки возможны)
  manualRate?: number        // общая потребность шт/мин
  machineTier?: string       // напр. "Miner Mk.1" для мультимашин
}

export interface ChainResult {
  nodes: ProductionNode[]
  totalPower: number
  rawResources: { part: string; perMin: number }[]
  allParts: { part: string; produced: number; consumed: number; net: number }[]
}

const STORAGE_KEY = 'sf_calculator_chains'

export function useCalculator() {
  const { getRecipeRates, getMachinePower, parseFraction, recipesByOutput, getMultiMachineDefaults } = useGameData()

  const chains = ref<{ name: string; targetPart: string; targetRate: number; selectedRecipes: Record<string, string> }[]>([])

  // Загрузка из localStorage
  if (import.meta.client) {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { chains.value = JSON.parse(saved) } catch {}
    }
  }

  function saveChains() {
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chains.value))
    }
  }

  function addChain(targetPart: string, targetRate: number, name?: string) {
    chains.value.push({
      name: name || targetPart,
      targetPart,
      targetRate,
      selectedRecipes: {},
    })
    saveChains()
  }

  function removeChain(index: number) {
    chains.value.splice(index, 1)
    saveChains()
  }

  /**
   * Оптимизированный расчёт производственной цепочки.
   * Строит DAG вместо дерева — одинаковые предметы объединяются в один узел
   * с суммарным спросом, чтобы не дублировать экстракторы и прочие машины.
   */
  function calculateChain(
    targetPart: string,
    targetRate: number,
    selectedRecipes: Record<string, string> = {},
  ): ChainResult {
    // --- Фаза 1: Обход графа — находим все детали и их рецепты (DFS) ---
    const partInfo = new Map<string, { recipe: Recipe; tierName?: string }>()
    const rawParts = new Set<string>()
    const inputEdges = new Map<string, string[]>() // деталь → [входные детали]
    const discovering = new Set<string>()

    function discover(part: string) {
      if (partInfo.has(part) || rawParts.has(part)) return
      if (discovering.has(part)) return // защита от циклов

      discovering.add(part)

      const recipes = recipesByOutput.value.get(part)
      if (!recipes || recipes.length === 0) {
        rawParts.add(part)
        discovering.delete(part)
        return
      }

      const selectedName = selectedRecipes[part]
      const recipe = selectedName
        ? (recipes.find(r => r.Name === selectedName) || recipes[0])
        : recipes[0]

      const mmDefaults = getMultiMachineDefaults(recipe.Machine)
      const tierName = mmDefaults?.tierName

      partInfo.set(part, { recipe, tierName })

      const rates = getRecipeRates(recipe, tierName)
      const inputs = rates.inputs.map(i => i.part)
      inputEdges.set(part, inputs)

      for (const inp of inputs) {
        discover(inp)
      }
      discovering.delete(part)
    }

    discover(targetPart)

    // --- Фаза 2: Распространяем спрос сверху вниз (обратный топологический порядок) ---
    // Считаем сколько узлов потребляют каждую деталь
    const consumerCount = new Map<string, number>()
    for (const part of [...partInfo.keys(), ...rawParts]) {
      consumerCount.set(part, 0)
    }
    for (const [, inputs] of inputEdges) {
      for (const inp of inputs) {
        consumerCount.set(inp, (consumerCount.get(inp) || 0) + 1)
      }
    }

    const demand = new Map<string, number>()
    demand.set(targetPart, targetRate)

    const remaining = new Map(consumerCount)
    const queue: string[] = [targetPart] // цель — 0 потребителей
    const processed = new Set<string>()

    while (queue.length > 0) {
      const part = queue.shift()!
      if (processed.has(part)) continue
      if ((remaining.get(part) || 0) > 0) continue // ещё не все потребители обработаны
      processed.add(part)

      if (rawParts.has(part)) continue

      const info = partInfo.get(part)
      if (!info) continue

      const rates = getRecipeRates(info.recipe, info.tierName)
      const outputRate = rates.outputs.find(o => o.part === part)
      if (!outputRate) continue

      const totalNeeded = demand.get(part) || 0
      const multiplier = totalNeeded / outputRate.perMin

      // Добавляем спрос на входные детали
      for (const inp of rates.inputs) {
        const inputNeeded = inp.perMin * multiplier
        demand.set(inp.part, (demand.get(inp.part) || 0) + inputNeeded)

        remaining.set(inp.part, (remaining.get(inp.part) || 1) - 1)
        if ((remaining.get(inp.part) || 0) <= 0) {
          queue.push(inp.part)
        }
      }
    }

    // --- Фаза 3: Создаём узлы (один на каждую производимую деталь) ---
    const nodes: ProductionNode[] = []
    const nodeMap = new Map<string, ProductionNode>()

    for (const [part, info] of partInfo) {
      const totalNeeded = demand.get(part) || 0
      if (totalNeeded <= 0) continue

      const rates = getRecipeRates(info.recipe, info.tierName)
      const outputRate = rates.outputs.find(o => o.part === part)
      if (!outputRate) continue

      const multiplier = totalNeeded / outputRate.perMin

      const node: ProductionNode = {
        id: `${info.recipe.Name}_${Math.random().toString(36).slice(2, 6)}`,
        recipe: info.recipe,
        targetOutput: part,
        multiplier,
        overclockPercent: 100,
        children: [],
        manualRate: totalNeeded,
        machineTier: info.tierName,
      }
      nodes.push(node)
      nodeMap.set(part, node)
    }

    // Связываем дочерние узлы (рёбра DAG)
    for (const node of nodes) {
      const inputs = inputEdges.get(node.targetOutput) || []
      for (const inp of inputs) {
        const childNode = nodeMap.get(inp)
        if (childNode) {
          node.children.push(childNode)
        }
      }
    }

    // --- Фаза 4: Подсчёт итогов ---
    let totalPower = 0
    const partTotals = new Map<string, { produced: number; consumed: number }>()

    for (const node of nodes) {
      const info = partInfo.get(node.targetOutput)!
      const rates = getRecipeRates(info.recipe, info.tierName)
      const power = getMachinePower(info.recipe.Machine, info.tierName)
      totalPower += power * node.multiplier

      for (const out of rates.outputs) {
        const t = partTotals.get(out.part) || { produced: 0, consumed: 0 }
        t.produced += out.perMin * node.multiplier
        partTotals.set(out.part, t)
      }
      for (const inp of rates.inputs) {
        const t = partTotals.get(inp.part) || { produced: 0, consumed: 0 }
        t.consumed += inp.perMin * node.multiplier
        partTotals.set(inp.part, t)
      }
    }

    // Сырые ресурсы
    const rawResources: { part: string; perMin: number }[] = []
    for (const part of rawParts) {
      const total = demand.get(part) || 0
      if (total > 0) {
        rawResources.push({ part, perMin: Math.round(total * 1000) / 1000 })
        const t = partTotals.get(part) || { produced: 0, consumed: 0 }
        t.consumed += total
        partTotals.set(part, t)
      }
    }

    const allParts = Array.from(partTotals.entries()).map(([part, totals]) => ({
      part,
      produced: Math.round(totals.produced * 1000) / 1000,
      consumed: Math.round(totals.consumed * 1000) / 1000,
      net: Math.round((totals.produced - totals.consumed) * 1000) / 1000,
    }))

    return {
      nodes,
      totalPower: Math.round(totalPower * 100) / 100,
      rawResources,
      allParts,
    }
  }

  return {
    chains,
    addChain,
    removeChain,
    saveChains,
    calculateChain,
  }
}
