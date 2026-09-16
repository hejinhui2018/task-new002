import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Booth, Rotation } from './lib/types'
import { EXITS, HALL_H, HALL_W } from './lib/constants'
import { analyzeLayout } from './lib/validation'
import { canRedo, canUndo, commit, createHistory, redo, undo, type History } from './lib/history'
import { demoBooths } from './lib/samples'
import { loadBooths, saveBooths } from './lib/persistence'
import { effectiveRect, rectsOverlap, snap } from './lib/geometry'
import { Toolbar } from './components/Toolbar'
import { FloorPlan } from './components/FloorPlan'
import { WarningsPanel } from './components/WarningsPanel'
import { Inspector } from './components/Inspector'

let counter = 1
const nextId = () => `booth-${Date.now().toString(36)}-${counter++}`

/** 为新展位找一个不与现有展位重叠的空位（3×2，网格扫描） */
function findFreeSpot(booths: Booth[], w: number, h: number) {
  for (let y = 0; y + h <= HALL_H + 1e-9; y += 0.5) {
    for (let x = 0; x + w <= HALL_W + 1e-9; x += 0.5) {
      if (booths.every(b => !rectsOverlap({ x, y, w, h }, effectiveRect(b)))) return { x, y }
    }
  }
  return { x: snap(HALL_W / 2 - w / 2), y: snap(HALL_H / 2 - h / 2) }
}

export default function App() {
  const [history, setHistory] = useState<History<Booth[]>>(() =>
    createHistory(loadBooths() ?? demoBooths()),
  )
  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(null)
  const [selectedWarningId, setSelectedWarningId] = useState<string | null>(null)
  const [preview, setPreview] = useState<Booth[] | null>(null)

  const committed = history.present
  const booths = preview ?? committed
  const analysis = useMemo(() => analyzeLayout(booths, EXITS), [booths])
  const selectedWarning = analysis.warnings.find(w => w.id === selectedWarningId) ?? null
  const selectedBooth = booths.find(b => b.id === selectedBoothId) ?? null

  // 本地持久化（仅保存已提交的方案）
  useEffect(() => {
    saveBooths(committed)
  }, [committed])

  const applyCommit = useCallback((next: Booth[]) => {
    setHistory(h => commit(h, next))
    setPreview(null)
  }, [])

  const addBooth = useCallback(() => {
    const spot = findFreeSpot(committed, 3, 2)
    const booth: Booth = {
      id: nextId(),
      name: `展位 ${committed.length + 1}`,
      x: spot.x,
      y: spot.y,
      w: 3,
      h: 2,
      rotation: 0,
    }
    applyCommit([...committed, booth])
    setSelectedBoothId(booth.id)
  }, [committed, applyCommit])

  const changeBooth = useCallback(
    (id: string, patch: Partial<Booth>) => {
      applyCommit(committed.map(b => (b.id === id ? { ...b, ...patch } : b)))
    },
    [committed, applyCommit],
  )

  const rotateBooth = useCallback(
    (id: string) => {
      applyCommit(
        committed.map(b =>
          b.id === id ? { ...b, rotation: ((b.rotation + 90) % 360) as Rotation } : b,
        ),
      )
    },
    [committed, applyCommit],
  )

  const deleteBooth = useCallback(
    (id: string) => {
      applyCommit(committed.filter(b => b.id !== id))
      setSelectedBoothId(s => (s === id ? null : s))
    },
    [committed, applyCommit],
  )

  const resetDemo = useCallback(() => {
    applyCommit(demoBooths())
    setSelectedBoothId(null)
    setSelectedWarningId(null)
  }, [applyCommit])

  const clearAll = useCallback(() => {
    applyCommit([])
    setSelectedBoothId(null)
    setSelectedWarningId(null)
  }, [applyCommit])

  // 快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (mod && key === 'z') {
        e.preventDefault()
        setHistory(h => (e.shiftKey ? redo(h) : undo(h)))
      } else if (mod && key === 'y') {
        e.preventDefault()
        setHistory(h => redo(h))
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBoothId) {
        e.preventDefault()
        deleteBooth(selectedBoothId)
      } else if (key === 'r' && !mod && selectedBoothId) {
        rotateBooth(selectedBoothId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedBoothId, deleteBooth, rotateBooth])

  const errorCount = analysis.warnings.filter(w => w.severity === 'error').length
  const cautionCount = analysis.warnings.length - errorCount

  return (
    <div className="app">
      <header className="app-header">
        <div className="title-row">
          <h1>展位排布工作台</h1>
          <span className="hall-info">
            展厅 {HALL_W}m × {HALL_H}m · 网格 0.5m · 通道 ≥ 1.5m · 出口 2 个 · 展位 {booths.length} 个
          </span>
        </div>
        <Toolbar
          canUndo={canUndo(history)}
          canRedo={canRedo(history)}
          hasSelection={!!selectedBooth}
          errorCount={errorCount}
          cautionCount={cautionCount}
          onAdd={addBooth}
          onRotate={() => selectedBoothId && rotateBooth(selectedBoothId)}
          onDelete={() => selectedBoothId && deleteBooth(selectedBoothId)}
          onUndo={() => setHistory(h => undo(h))}
          onRedo={() => setHistory(h => redo(h))}
          onResetDemo={resetDemo}
          onClear={clearAll}
        />
      </header>
      <main>
        <section className="canvas-area">
          <FloorPlan
            booths={booths}
            selectedBoothId={selectedBoothId}
            selectedWarning={selectedWarning}
            analysis={analysis}
            onPreview={setPreview}
            onCommit={applyCommit}
            onSelectBooth={setSelectedBoothId}
          />
        </section>
        <aside>
          <WarningsPanel
            warnings={analysis.warnings}
            booths={booths}
            selectedWarningId={selectedWarningId}
            onSelectWarning={setSelectedWarningId}
            onSelectBooth={setSelectedBoothId}
          />
          <Inspector
            booth={selectedBooth}
            pathExists={selectedBooth ? analysis.paths.get(selectedBooth.id) != null : true}
            onChange={changeBooth}
            onRotate={rotateBooth}
            onDelete={deleteBooth}
          />
          <div className="panel help">
            <h2>操作提示</h2>
            <p className="muted">
              拖拽展位移动，拖动四角手柄缩放；滚轮缩放画布，拖拽空白处平移。
              <br />
              快捷键：R 旋转 · Delete 删除 · Ctrl/⌘+Z 撤销 · Ctrl/⌘+Shift+Z 重做。
              <br />
              所有修改自动保存在浏览器本地。
            </p>
          </div>
        </aside>
      </main>
    </div>
  )
}
