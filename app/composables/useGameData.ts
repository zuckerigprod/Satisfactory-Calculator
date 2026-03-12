import rawData from '~/assets/game_data.json'

export interface Machine {
  Name: string
  Tier: string
  AveragePower?: string
  MinPower?: string
  OverclockPowerExponent?: string
  MaxProductionShards?: number
  ProductionShardMultiplier?: string
  ProductionShardPowerExponent?: string
  BasePower?: string
  BasePowerBoost?: string
  FueledBasePowerBoost?: string
  Cost: { Part: string; Amount: string }[]
}

export interface MultiMachine {
  Name: string
  ShowPpm?: boolean
  AutoRound?: boolean
  DefaultMax?: string
  Machines?: { Name: string; PartsRatio?: string; Default?: boolean }[]
  Capacities?: { Name: string; PartsRatio?: string; PowerRatio?: string; Default?: boolean; Color?: number; Description?: string }[]
}

export interface Part {
  Name: string
  Tier: string
  SinkPoints: number
}

export interface RecipePart {
  Part: string
  Amount: string
}

export interface Recipe {
  Name: string
  Machine: string
  BatchTime: string
  Tier: string
  Alternate?: boolean
  MinPower?: string
  AveragePower?: string
  Parts: RecipePart[]
}

export interface GameData {
  Machines: Machine[]
  MultiMachines: MultiMachine[]
  Parts: Part[]
  Recipes: Recipe[]
}

function parseFraction(s: string): number {
  if (!s) return 0
  s = s.trim()
  if (s.includes('/')) {
    const [num, den] = s.split('/')
    return parseFloat(num) / parseFloat(den)
  }
  return parseFloat(s)
}

export function useGameData() {
  const data = rawData as GameData

  const machines = computed(() => data.Machines)
  const multiMachines = computed(() => data.MultiMachines)
  const parts = computed(() => data.Parts)
  const recipes = computed(() => data.Recipes)

  const machineMap = computed(() => {
    const map = new Map<string, Machine>()
    for (const m of data.Machines) map.set(m.Name, m)
    return map
  })

  const partMap = computed(() => {
    const map = new Map<string, Part>()
    for (const p of data.Parts) map.set(p.Name, p)
    return map
  })

  const recipesByOutput = computed(() => {
    const map = new Map<string, Recipe[]>()
    for (const r of data.Recipes) {
      for (const p of r.Parts) {
        const amount = parseFraction(p.Amount)
        if (amount > 0) {
          if (!map.has(p.Part)) map.set(p.Part, [])
          map.get(p.Part)!.push(r)
        }
      }
    }
    return map
  })

  const recipesByInput = computed(() => {
    const map = new Map<string, Recipe[]>()
    for (const r of data.Recipes) {
      for (const p of r.Parts) {
        const amount = parseFraction(p.Amount)
        if (amount < 0) {
          if (!map.has(p.Part)) map.set(p.Part, [])
          map.get(p.Part)!.push(r)
        }
      }
    }
    return map
  })

  const recipesByMachine = computed(() => {
    const map = new Map<string, Recipe[]>()
    for (const r of data.Recipes) {
      if (!map.has(r.Machine)) map.set(r.Machine, [])
      map.get(r.Machine)!.push(r)
    }
    return map
  })

  const multiMachineMap = computed(() => {
    const map = new Map<string, MultiMachine>()
    for (const mm of data.MultiMachines) map.set(mm.Name, mm)
    return map
  })

  /** Дефолтный тир для мультимашины. Возвращает null если это не мультимашина. */
  function getMultiMachineDefaults(machineName: string): {
    tierName: string
    tierRatio: number
    purityName: string
    purityRatio: number
  } | null {
    const mm = multiMachineMap.value.get(machineName)
    if (!mm) return null

    // Ищем дефолтный тир (или первый, если дефолт не отмечен)
    let tierName = machineName
    let tierRatio = 1
    if (mm.Machines && mm.Machines.length > 0) {
      const defaultTier = mm.Machines.find(m => m.Default) || mm.Machines[0]
      tierName = defaultTier.Name
      tierRatio = parseFraction(defaultTier.PartsRatio || '1')
    } else if (mm.DefaultMax) {
      // Нет вариантов тиров (напр. нефтяной экстрактор) — скорость уже в рецепте
      tierRatio = 1
    }

    // Ищем дефолтную чистоту ("Normal" = множитель 1)
    let purityName = 'Normal'
    let purityRatio = 1
    if (mm.Capacities && mm.Capacities.length > 0) {
      const defaultPurity = mm.Capacities.find(c => c.Default) || mm.Capacities[0]
      purityName = defaultPurity.Name
      purityRatio = parseFraction(defaultPurity.PartsRatio || '1')
    }

    return { tierName, tierRatio, purityName, purityRatio }
  }

  /** Получить все тиры мультимашины */
  function getMultiMachineTiers(machineName: string): { name: string; ratio: number; isDefault: boolean }[] {
    const mm = multiMachineMap.value.get(machineName)
    if (!mm || !mm.Machines || mm.Machines.length === 0) return []
    return mm.Machines.map(m => ({
      name: m.Name,
      ratio: parseFraction(m.PartsRatio || '1'),
      isDefault: !!m.Default,
    }))
  }

  function getRecipeRates(recipe: Recipe, tierName?: string) {
    const batchTime = parseFraction(recipe.BatchTime)
    const inputs: { part: string; perMin: number }[] = []
    const outputs: { part: string; perMin: number }[] = []

    // Множитель мультимашины
    let multiRatio = 1
    const mm = multiMachineMap.value.get(recipe.Machine)
    if (mm && mm.Machines && mm.Machines.length > 0) {
      // Есть варианты тиров — применяем PartsRatio тира
      const tier = tierName
        ? mm.Machines.find(m => m.Name === tierName)
        : (mm.Machines.find(m => m.Default) || mm.Machines[0])
      if (tier) {
        multiRatio = parseFraction(tier.PartsRatio || '1')
      }
    }
    // Чистота по умолчанию = Normal (множитель 1), доп. множитель не нужен

    for (const p of recipe.Parts) {
      const amount = parseFraction(p.Amount)
      const perMin = (Math.abs(amount) / batchTime) * 60 * multiRatio

      if (amount < 0) {
        inputs.push({ part: p.Part, perMin })
      } else {
        outputs.push({ part: p.Part, perMin })
      }
    }
    return { inputs, outputs, batchTime }
  }

  function getMachinePower(machineName: string, tierName?: string): number {
    // Если это мультимашина с тирами — берём мощность конкретного тира
    const mm = multiMachineMap.value.get(machineName)
    if (mm && mm.Machines && mm.Machines.length > 0) {
      const tier = tierName
        ? mm.Machines.find(m => m.Name === tierName)
        : (mm.Machines.find(m => m.Default) || mm.Machines[0])
      if (tier) {
        const tierMachine = machineMap.value.get(tier.Name)
        if (tierMachine) return Math.abs(parseFraction(tierMachine.AveragePower || '0'))
      }
    }
    const machine = machineMap.value.get(machineName)
    if (!machine) return 0
    return Math.abs(parseFraction(machine.AveragePower || '0'))
  }

  function getTierNumber(tier: string): number {
    if (!tier) return 0
    const [major, minor] = tier.split('-').map(Number)
    return major * 10 + minor
  }

  function getTierDisplay(tier: string): string {
    if (!tier) return ''
    const [major, minor] = tier.split('-')
    return `${major}-${minor}`
  }

  return {
    data,
    machines,
    multiMachines,
    parts,
    recipes,
    machineMap,
    multiMachineMap,
    partMap,
    recipesByOutput,
    recipesByInput,
    recipesByMachine,
    getRecipeRates,
    getMachinePower,
    getMultiMachineDefaults,
    getMultiMachineTiers,
    getTierNumber,
    getTierDisplay,
    parseFraction,
  }
}
