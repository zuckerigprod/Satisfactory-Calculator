<template>
  <div class="chain-map-wrapper" ref="wrapperRef">
    <div class="map-toolbar">
      <button class="map-btn" @click="zoomIn" title="+">+</button>
      <button class="map-btn" @click="zoomOut" title="-">-</button>
      <button class="map-btn" @click="fitView">{{ $t('calc.resetView') }}</button>
    </div>
    <div
      class="chain-viewport"
      ref="viewportRef"
      @mousedown.prevent="onCanvasMouseDown"
      @wheel.prevent="onWheel"
    >
      <div
        class="chain-canvas"
        :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }"
      >
        <!-- Стрелки между узлами -->
        <svg class="arrows-layer" :width="canvasW" :height="canvasH">
          <defs>
            <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="var(--orange)" />
            </marker>
          </defs>
          <g v-for="arrow in arrows" :key="arrow.id">
            <line
              :x1="arrow.x1" :y1="arrow.y1"
              :x2="arrow.x2" :y2="arrow.y2"
              stroke="var(--border2)" stroke-width="2"
              marker-end="url(#ah)"
            />
            <!-- Подпись на стрелке -->
            <g :transform="`translate(${(arrow.x1+arrow.x2)/2}, ${(arrow.y1+arrow.y2)/2 - 12})`">
              <rect
                x="-75" y="-11" width="150" height="18" rx="3"
                fill="var(--bg2)" stroke="var(--border)" stroke-width="0.5"
              />
              <image
                :href="getIconPath(arrow.part)"
                x="-71" y="-8" width="12" height="12"
              />
              <text x="-55" y="3" fill="var(--text2)" font-size="9.5" font-family="var(--font-mono)">
                {{ tp(arrow.part) }}
              </text>
              <text x="71" y="3" fill="var(--orange)" font-size="9.5" font-family="var(--font-mono)" text-anchor="end" font-weight="600">
                {{ formatNum(arrow.rate) }}/{{ minLabel }}
              </text>
            </g>
          </g>
        </svg>

        <!-- Блоки машин (перетаскиваемые) -->
        <div
          v-for="node in layoutNodes"
          :key="node.id"
          class="machine-node"
          :class="{ raw: node.isRaw, final: node.isFinal, dragging: dragNodeId === node.id }"
          :style="{ left: node.x + 'px', top: node.y + 'px', width: NODE_W + 'px' }"
          @mousedown.stop.prevent="onNodeMouseDown($event, node)"
        >
          <div class="node-top">
            <img :src="getIconPath(node.iconName)" class="node-icon" />
            <div class="node-title">
              <div class="node-machine">{{ node.machineName }}</div>
              <div class="node-product">{{ node.productName }}</div>
            </div>
            <div class="node-count" v-if="node.multiplier > 0">x{{ formatNum(node.multiplier) }}</div>
          </div>
          <div class="node-io">
            <div v-for="out in node.outputs" :key="'o'+out.part" class="io-row out">
              <img :src="getIconPath(out.part)" class="io-icon" />
              <span class="io-rate green">{{ formatNum(out.perMin) }}/{{ minLabel }}</span>
              <span class="io-name">{{ tp(out.part) }}</span>
            </div>
            <div v-for="inp in node.inputs" :key="'i'+inp.part" class="io-row inp">
              <img :src="getIconPath(inp.part)" class="io-icon" />
              <span class="io-rate red">-{{ formatNum(inp.perMin) }}/{{ minLabel }}</span>
              <span class="io-name">{{ tp(inp.part) }}</span>
            </div>
          </div>
          <div class="node-power" :class="{ neg: node.power < 0 }" v-if="node.power !== 0">
            {{ formatNum(node.power) }} MW
          </div>
        </div>

        <!-- Бейдж финального продукта -->
        <div
          v-if="finalBadge"
          class="final-badge"
          :style="{ left: finalBadge.x + 'px', top: finalBadge.y + 'px' }"
        >
          <img :src="getIconPath(finalBadge.part)" class="final-icon" />
          <div class="final-info">
            <div class="final-rate">{{ formatNum(finalBadge.rate) }}/{{ minLabel }}</div>
            <div class="final-name">{{ tp(finalBadge.part) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChainResult, ProductionNode } from '~/composables/useCalculator'

const props = defineProps<{
  result: ChainResult
  selectedRecipes: Record<string, string>
}>()

const { getRecipeRates, getMachinePower } = useGameData()
const { translatePart, translateMachine, translateRecipe, getIconPath } = useTranslations()
const { locale } = useI18n()

const tp = (n: string) => translatePart(n, locale.value)
const tm = (n: string) => translateMachine(n, locale.value)
const minLabel = computed(() => locale.value === 'ru' ? 'мин' : 'min')

const NODE_W = 230
const NODE_H_BASE = 56
const IO_H = 20
const NODE_GAP_X = 200
const NODE_GAP_Y = 24

const viewportRef = ref<HTMLElement>()
const wrapperRef = ref<HTMLElement>()

const zoom = ref(1)
const pan = reactive({ x: 40, y: 20 })
let canvasDragging = false
let dragStart = { x: 0, y: 0 }

// Перетаскивание узлов
const dragNodeId = ref<string | null>(null)
let nodeDragStart = { x: 0, y: 0, nodeX: 0, nodeY: 0 }

interface MNode {
  id: string
  x: number
  y: number
  h: number
  iconName: string
  machineName: string
  productName: string
  multiplier: number
  power: number
  isRaw: boolean
  isFinal: boolean
  outputs: { part: string; perMin: number }[]
  inputs: { part: string; perMin: number }[]
  col: number
}

interface Arrow {
  id: string
  x1: number; y1: number
  x2: number; y2: number
  part: string
  rate: number
  fromId: string
  toId: string
}

const layoutNodes = ref<MNode[]>([])
const arrows = ref<Arrow[]>([])
const canvasW = ref(1200)
const canvasH = ref(600)
const finalBadge = ref<{ x: number; y: number; part: string; rate: number } | null>(null)

// Исходные данные стрелок (для пересчёта позиций при перетаскивании)
interface ArrowDef {
  id: string
  fromId: string
  toId: string
  part: string
  rate: number
}
const arrowDefs = ref<ArrowDef[]>([])

function recalcArrows() {
  const nodeMap = new Map<string, MNode>()
  for (const n of layoutNodes.value) nodeMap.set(n.id, n)

  arrows.value = arrowDefs.value.map(def => {
    const from = nodeMap.get(def.fromId)
    const to = nodeMap.get(def.toId)
    if (!from || !to) return null
    return {
      ...def,
      x1: from.x + NODE_W,
      y1: from.y + from.h / 2,
      x2: to.x,
      y2: to.y + to.h / 2,
    }
  }).filter(Boolean) as Arrow[]
}

function buildLayout() {
  const nodes: MNode[] = []
  const defs: ArrowDef[] = []
  const nodeById = new Map<string, MNode>()

  // Вычисляем глубину каждого узла в DAG (макс. расстояние от корней)
  // Корневые узлы — те, которых нет в дочерних ни у кого
  const childIds = new Set<string>()
  for (const n of props.result.nodes) {
    for (const c of n.children) childIds.add(c.id)
  }
  const rootNodes = props.result.nodes.filter(n => !childIds.has(n.id))

  // BFS для назначения глубин — берём макс. глубину для каждого узла
  const nodeDepth = new Map<string, number>()
  const visited = new Set<string>()
  let maxDepth = 0

  function assignDepth(pn: ProductionNode, depth: number) {
    const current = nodeDepth.get(pn.id) || 0
    if (depth > current || !nodeDepth.has(pn.id)) {
      nodeDepth.set(pn.id, depth)
      if (depth > maxDepth) maxDepth = depth
    }
    // Всегда пробрасываем вглубь чтобы найти максимальную глубину
    if (!visited.has(pn.id)) {
      visited.add(pn.id)
      for (const c of pn.children) assignDepth(c, depth + 1)
      visited.delete(pn.id)
    }
  }
  for (const r of rootNodes) assignDepth(r, 0)

  // Создаём MNode для каждого уникального узла производства
  const processedIds = new Set<string>()
  for (const pn of props.result.nodes) {
    if (processedIds.has(pn.id)) continue
    processedIds.add(pn.id)

    const rates = getRecipeRates(pn.recipe, pn.machineTier)
    const power = getMachinePower(pn.recipe.Machine, pn.machineTier)
    const outputs = rates.outputs.map(o => ({
      part: o.part, perMin: Math.round(o.perMin * pn.multiplier * 100) / 100
    }))
    const inputs = rates.inputs.map(i => ({
      part: i.part, perMin: Math.round(i.perMin * pn.multiplier * 100) / 100
    }))
    const h = NODE_H_BASE + (outputs.length + inputs.length) * IO_H + 8

    const depth = nodeDepth.get(pn.id) || 0
    const col = maxDepth - depth
    const displayMachine = pn.machineTier || pn.recipe.Machine

    const mnode: MNode = {
      id: pn.id,
      x: 0, y: 0, h,
      iconName: displayMachine,
      machineName: tm(displayMachine),
      productName: tp(pn.targetOutput),
      multiplier: pn.multiplier,
      power: Math.round(power * pn.multiplier * 100) / 100,
      isRaw: false,
      isFinal: rootNodes.some(r => r.id === pn.id),
      outputs, inputs,
      col,
    }
    nodes.push(mnode)
    nodeById.set(pn.id, mnode)
  }

  // Узлы сырых ресурсов
  for (const raw of props.result.rawResources) {
    const h = NODE_H_BASE + 1 * IO_H + 8
    nodes.push({
      id: `raw_${raw.part}`,
      x: 0, y: 0, h,
      iconName: raw.part,
      machineName: locale.value === 'ru' ? 'Ресурс' : 'Resource',
      productName: tp(raw.part),
      multiplier: 0,
      power: 0,
      isRaw: true,
      isFinal: false,
      outputs: [{ part: raw.part, perMin: raw.perMin }],
      inputs: [],
      col: 0,
    })
  }

  // Раскладка по колонкам
  const cols = new Map<number, MNode[]>()
  for (const n of nodes) {
    if (!cols.has(n.col)) cols.set(n.col, [])
    cols.get(n.col)!.push(n)
  }

  const maxCol = Math.max(...Array.from(cols.keys()), 0)
  let totalH = 0

  for (let c = 0; c <= maxCol; c++) {
    const colNodes = cols.get(c) || []
    const colX = c * (NODE_W + NODE_GAP_X)
    let colY = 0
    for (const n of colNodes) {
      n.x = colX
      n.y = colY
      colY += n.h + NODE_GAP_Y
    }
    totalH = Math.max(totalH, colY)
  }

  canvasW.value = (maxCol + 1) * (NODE_W + NODE_GAP_X) + 250
  canvasH.value = totalH + 100

  // Строим стрелки по рёбрам DAG (без дубликатов)
  const arrowSet = new Set<string>()
  for (const pn of props.result.nodes) {
    for (const child of pn.children) {
      const key = `${child.id}->${pn.id}`
      if (arrowSet.has(key)) continue
      arrowSet.add(key)

      // Считаем сколько ресурса идёт по этому ребру
      const childRates = getRecipeRates(child.recipe, child.machineTier)
      const parentRates = getRecipeRates(pn.recipe, pn.machineTier)
      // Сколько потребляет родитель из выхода дочернего узла
      const parentInput = parentRates.inputs.find(i => i.part === child.targetOutput)
      const rate = parentInput ? Math.round(parentInput.perMin * pn.multiplier * 100) / 100 : 0

      defs.push({
        id: key,
        fromId: child.id,
        toId: pn.id,
        part: child.targetOutput,
        rate,
      })
    }
  }

  // Стрелки от сырья к потребителям
  for (const rawNode of nodes.filter(n => n.isRaw)) {
    const rawPart = rawNode.outputs[0]?.part
    if (!rawPart) continue
    const consumers = nodes.filter(n => !n.isRaw && n.inputs.some(i => i.part === rawPart))
    for (const consumer of consumers) {
      const key = `${rawNode.id}->${consumer.id}`
      if (arrowSet.has(key)) continue
      arrowSet.add(key)

      // Считаем сколько этот потребитель требует сырья
      const pn = props.result.nodes.find(n => n.id === consumer.id)
      let rate = rawNode.outputs[0]?.perMin || 0
      if (pn) {
        const rates = getRecipeRates(pn.recipe, pn.machineTier)
        const inp = rates.inputs.find(i => i.part === rawPart)
        if (inp) rate = Math.round(inp.perMin * pn.multiplier * 100) / 100
      }

      defs.push({
        id: key,
        fromId: rawNode.id,
        toId: consumer.id,
        part: rawPart,
        rate,
      })
    }
  }

  layoutNodes.value = nodes
  arrowDefs.value = defs
  recalcArrows()

  // Бейдж финального продукта
  if (rootNodes.length > 0) {
    const rootMN = nodeById.get(rootNodes[0].id)
    if (rootMN) {
      const rootRates = getRecipeRates(rootNodes[0].recipe, rootNodes[0].machineTier)
      const mainOut = rootRates.outputs.find(o => o.part === rootNodes[0].targetOutput)
      finalBadge.value = {
        x: rootMN.x + NODE_W + 60,
        y: rootMN.y + rootMN.h / 2 - 30,
        part: rootNodes[0].targetOutput,
        rate: mainOut ? Math.round(mainOut.perMin * rootNodes[0].multiplier * 100) / 100 : 0,
      }
    }
  } else {
    finalBadge.value = null
  }
}

// --- Node dragging ---
function onNodeMouseDown(e: MouseEvent, node: MNode) {
  dragNodeId.value = node.id
  nodeDragStart = {
    x: e.clientX,
    y: e.clientY,
    nodeX: node.x,
    nodeY: node.y,
  }

  const onMove = (ev: MouseEvent) => {
    if (!dragNodeId.value) return
    const dx = (ev.clientX - nodeDragStart.x) / zoom.value
    const dy = (ev.clientY - nodeDragStart.y) / zoom.value
    node.x = nodeDragStart.nodeX + dx
    node.y = nodeDragStart.nodeY + dy
    recalcArrows()
    // Обновляем позицию бейджа если тащим финальный узел
    if (finalBadge.value && node.isFinal) {
      finalBadge.value.x = node.x + NODE_W + 60
      finalBadge.value.y = node.y + node.h / 2 - 30
    }
  }
  const onUp = () => {
    dragNodeId.value = null
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

// --- Canvas panning ---
function onCanvasMouseDown(e: MouseEvent) {
  // Двигаем канвас только при клике по фону
  canvasDragging = true
  dragStart = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  const onMove = (ev: MouseEvent) => {
    if (!canvasDragging) return
    pan.x = ev.clientX - dragStart.x
    pan.y = ev.clientY - dragStart.y
  }
  const onUp = () => {
    canvasDragging = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function onWheel(e: WheelEvent) {
  const delta = e.deltaY > 0 ? -0.08 : 0.08
  zoom.value = Math.max(0.2, Math.min(2, zoom.value + delta))
}

function zoomIn() { zoom.value = Math.min(2, zoom.value + 0.15) }
function zoomOut() { zoom.value = Math.max(0.2, zoom.value - 0.15) }
function fitView() {
  zoom.value = 1
  pan.x = 40
  pan.y = 20
}

function formatNum(n: number): string {
  if (n === 0) return '0'
  if (Number.isInteger(n)) return n.toString()
  return n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

watch(() => props.result, () => buildLayout(), { immediate: true, deep: true })
watch(locale, () => buildLayout())
</script>

<style scoped>
.chain-map-wrapper {
  position: relative;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  background: #0a0a0f;
  min-height: 300px;
}
.map-toolbar {
  position: absolute; top: 8px; right: 8px; z-index: 10;
  display: flex; gap: 4px;
}
.map-btn {
  padding: 4px 10px; background: var(--bg2); border: 1px solid var(--border2);
  border-radius: 4px; color: var(--text2); cursor: pointer;
  font-family: var(--font-mono); font-size: .7rem; transition: all .15s;
}
.map-btn:hover { border-color: var(--orange); color: var(--orange); }

.chain-viewport {
  width: 100%;
  height: 450px;
  overflow: hidden;
  cursor: grab;
}
.chain-viewport:active { cursor: grabbing; }

.chain-canvas {
  position: relative;
  will-change: transform;
}

.arrows-layer {
  position: absolute;
  top: 0; left: 0;
  pointer-events: none;
}

/* Блок машины */
.machine-node {
  position: absolute;
  background: var(--card);
  border: 1.5px solid var(--border);
  border-radius: 8px;
  padding: 0;
  overflow: hidden;
  transition: border-color .15s, box-shadow .15s;
  font-family: var(--font-mono);
  cursor: grab;
  user-select: none;
}
.machine-node:hover { border-color: var(--orange); }
.machine-node.dragging { border-color: var(--orange); box-shadow: 0 0 16px var(--orange-glow); cursor: grabbing; z-index: 20; }
.machine-node.raw { border-color: #1a3a1a; background: #0d150d; }
.machine-node.raw:hover { border-color: #00ff88; }
.machine-node.final { border-color: var(--orange); box-shadow: 0 0 12px var(--orange-glow); }

.node-top {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  background: var(--bg3);
}
.node-icon { width: 32px; height: 32px; object-fit: contain; flex-shrink: 0; pointer-events: none; }
.node-title { flex: 1; min-width: 0; }
.node-machine { font-size: .78rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.node-product { font-size: .6rem; color: var(--text3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.node-count {
  font-size: 1.1rem; font-weight: 700; color: var(--orange);
  white-space: nowrap; flex-shrink: 0;
}

.node-io { padding: 6px 10px; }
.io-row {
  display: flex; align-items: center; gap: 5px;
  font-size: .68rem; line-height: 1.6;
}
.io-icon { width: 14px; height: 14px; object-fit: contain; flex-shrink: 0; pointer-events: none; }
.io-rate { font-weight: 600; min-width: 58px; }
.io-rate.green { color: #00ff88; }
.io-rate.red { color: #ff3355; }
.io-name { color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.node-power {
  padding: 4px 10px 6px;
  font-size: .65rem; font-weight: 600;
  color: var(--green);
  text-align: right;
}
.node-power.neg { color: var(--amber); }

/* Бейдж финального продукта */
.final-badge {
  position: absolute;
  display: flex; align-items: center; gap: 10px;
  background: var(--bg3);
  border: 2px solid var(--orange);
  border-radius: 10px;
  padding: 12px 18px;
  box-shadow: 0 0 20px var(--orange-glow);
}
.final-icon { width: 48px; height: 48px; object-fit: contain; }
.final-rate { font-size: 1.2rem; font-weight: 700; color: var(--orange); }
.final-name { font-size: .75rem; color: var(--text); }
</style>
