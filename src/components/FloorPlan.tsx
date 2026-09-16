import { useEffect, useMemo, useRef, useState } from 'react'
import type { Booth, Corner, ExitDoor, Point, Rect, Viewport, Warning } from '../lib/types'
import { EXITS, GRID, HALL_H, HALL_W } from '../lib/constants'
import {
  doorMidpoint,
  effectiveRect,
  exitZone,
  fitViewport,
  frontEdge,
  receptionPoint,
  resizeEffective,
  screenToWorld,
  snap,
  storedFromEffective,
  zoomAt,
} from '../lib/geometry'
import type { Analysis } from '../lib/validation'

interface Props {
  booths: Booth[]
  selectedBoothId: string | null
  selectedWarning: Warning | null
  analysis: Analysis
  /** 拖拽过程中实时上报预览方案（用于告警/路径的即时刷新） */
  onPreview: (booths: Booth[] | null) => void
  /** 拖拽结束，提交一次可撤销的修改 */
  onCommit: (booths: Booth[]) => void
  onSelectBooth: (id: string | null) => void
}

type DragState =
  | { kind: 'move'; id: string; start: Point; orig: Booth }
  | { kind: 'resize'; id: string; corner: Corner; orig: Booth; origEff: Rect }
  | { kind: 'pan'; startX: number; startY: number; orig: Viewport; moved: boolean }

const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se']

const round3 = (v: number) => Math.round(v * 1000) / 1000
const MINOR_V: number[] = []
const MINOR_H: number[] = []
const MAJOR_V: number[] = []
const MAJOR_H: number[] = []
for (let x = 0; x <= HALL_W + 1e-9; x = round3(x + GRID)) {
  ;(Number.isInteger(x) ? MAJOR_V : MINOR_V).push(x)
}
for (let y = 0; y <= HALL_H + 1e-9; y = round3(y + GRID)) {
  ;(Number.isInteger(y) ? MAJOR_H : MINOR_H).push(y)
}

function cornerPoint(eff: Rect, corner: Corner): Point {
  return {
    x: corner.includes('w') ? eff.x : eff.x + eff.w,
    y: corner.includes('n') ? eff.y : eff.y + eff.h,
  }
}

/** 门在墙面上的绘制矩形（跨墙线） */
function exitDoorRectOnWall(exit: ExitDoor): Rect {
  const t = 0.28
  switch (exit.wall) {
    case 'north':
      return { x: exit.offset, y: -t / 2, w: exit.width, h: t }
    case 'south':
      return { x: exit.offset, y: HALL_H - t / 2, w: exit.width, h: t }
    case 'west':
      return { x: -t / 2, y: exit.offset, w: t, h: exit.width }
    case 'east':
      return { x: HALL_W - t / 2, y: exit.offset, w: t, h: exit.width }
  }
}

function exitLabelPos(exit: ExitDoor): Point {
  const mid = doorMidpoint(exit)
  switch (exit.wall) {
    case 'north':
      return { x: mid.x, y: -0.6 }
    case 'south':
      return { x: mid.x, y: HALL_H + 0.8 }
    case 'west':
      return { x: -0.6, y: mid.y }
    case 'east':
      return { x: HALL_W + 0.6, y: mid.y }
  }
}

export function FloorPlan(props: Props) {
  const { booths, selectedBoothId, selectedWarning, analysis } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [viewport, setViewport] = useState<Viewport | null>(null)
  const [overrides, setOverrides] = useState<Record<string, Partial<Booth>>>({})
  const [hover, setHover] = useState<Point | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props
  const stateRef = useRef({ viewport, booths, overrides })
  stateRef.current = { viewport, booths, overrides }

  // 跟踪容器尺寸
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const rect = entries[0].contentRect
      setSize({ w: rect.width, h: rect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 首次测量后自适应展厅
  useEffect(() => {
    if (size && !viewport) setViewport(fitViewport(size.w, size.h))
  }, [size, viewport])

  // 拖拽中的预览方案（overrides 是绝对值，重复应用幂等）
  const previewBooths = useMemo(
    () => booths.map(b => (overrides[b.id] ? { ...b, ...overrides[b.id] } : b)),
    [booths, overrides],
  )

  // overrides 变化时把预览方案上报给 App，让告警与疏散路径在拖拽过程中即时刷新
  useEffect(() => {
    const cur = stateRef.current
    if (Object.keys(overrides).length === 0) {
      propsRef.current.onPreview(null)
      return
    }
    propsRef.current.onPreview(
      cur.booths.map(b => (overrides[b.id] ? { ...b, ...overrides[b.id] } : b)),
    )
  }, [overrides])

  const toWorld = (clientX: number, clientY: number): Point => {
    const rect = svgRef.current!.getBoundingClientRect()
    const vp = stateRef.current.viewport!
    return screenToWorld({ x: clientX - rect.left, y: clientY - rect.top }, vp)
  }

  // 全局 pointer 监听：移动 / 缩放 / 平移
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      if (d.kind === 'pan') {
        const dx = e.clientX - d.startX
        const dy = e.clientY - d.startY
        if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
        setViewport({ ...d.orig, panX: d.orig.panX + dx, panY: d.orig.panY + dy })
        return
      }
      const rect = svgRef.current!.getBoundingClientRect()
      const vp = stateRef.current.viewport!
      const p = screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, vp)
      if (d.kind === 'move') {
        setOverrides({
          [d.id]: { x: snap(d.orig.x + p.x - d.start.x), y: snap(d.orig.y + p.y - d.start.y) },
        })
      } else {
        const eff = resizeEffective(d.origEff, d.corner, snap(p.x), snap(p.y))
        setOverrides({ [d.id]: storedFromEffective(d.orig, eff) })
      }
    }
    const onUp = () => {
      const d = dragRef.current
      dragRef.current = null
      if (!d) return
      if (d.kind === 'pan') {
        if (!d.moved) propsRef.current.onSelectBooth(null)
        return
      }
      const cur = stateRef.current
      if (Object.keys(cur.overrides).length > 0) {
        const final = cur.booths.map(b =>
          cur.overrides[b.id] ? { ...b, ...cur.overrides[b.id] } : b,
        )
        propsRef.current.onCommit(final)
      }
      setOverrides({})
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  // 滚轮缩放（需要 passive:false 才能 preventDefault）
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const vp = stateRef.current.viewport
      if (!vp) return
      const rect = svg.getBoundingClientRect()
      const center = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      setViewport(zoomAt(vp, center, e.deltaY < 0 ? 1.15 : 1 / 1.15))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  const warningsByBooth = useMemo(() => {
    const m = new Map<string, Warning[]>()
    for (const w of analysis.warnings) {
      for (const id of w.boothIds) {
        const arr = m.get(id) ?? []
        arr.push(w)
        m.set(id, arr)
      }
    }
    return m
  }, [analysis])

  const pathBoothIds = useMemo(() => {
    const s = new Set<string>()
    if (selectedBoothId) s.add(selectedBoothId)
    if (selectedWarning) for (const id of selectedWarning.boothIds) s.add(id)
    return s
  }, [selectedBoothId, selectedWarning])

  const onBackgroundDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const vp = stateRef.current.viewport
    if (!vp) return
    dragRef.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, orig: vp, moved: false }
  }

  const zoomBy = (factor: number) => {
    const vp = stateRef.current.viewport
    if (!vp || !size) return
    setViewport(zoomAt(vp, { x: size.w / 2, y: size.h / 2 }, factor))
  }

  const zoomPct =
    viewport && size ? Math.round((viewport.zoom / fitViewport(size.w, size.h).zoom) * 100) : null

  return (
    <div className="floorplan" ref={containerRef}>
      <svg
        ref={svgRef}
        width={size?.w ?? 0}
        height={size?.h ?? 0}
        onPointerDown={onBackgroundDown}
        onPointerMove={e => {
          if (!dragRef.current && stateRef.current.viewport) {
            setHover(toWorld(e.clientX, e.clientY))
          }
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <marker
            id="evac-arrow"
            viewBox="0 0 10 10"
            refX={8}
            refY={5}
            markerWidth={0.8}
            markerHeight={0.8}
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#0f766e" />
          </marker>
          <pattern
            id="error-hatch"
            width={0.35}
            height={0.35}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width={0.35} height={0.35} fill="rgba(220,38,38,0.07)" />
            <line x1={0} y1={0} x2={0} y2={0.35} stroke="rgba(220,38,38,0.4)" strokeWidth={0.05} />
          </pattern>
        </defs>
        {viewport && (
          <g transform={`translate(${viewport.panX} ${viewport.panY}) scale(${viewport.zoom})`}>
            {/* 背景（接收平移点击） */}
            <rect x={-1.5} y={-1.5} width={HALL_W + 3} height={HALL_H + 3} fill="#f8fafc" />
            {/* 网格：0.5m 细线 / 1m 粗线 */}
            {MINOR_V.map(x => (
              <line key={`mv${x}`} x1={x} y1={0} x2={x} y2={HALL_H} stroke="#e2e8f0" strokeWidth={0.025} />
            ))}
            {MINOR_H.map(y => (
              <line key={`mh${y}`} x1={0} y1={y} x2={HALL_W} y2={y} stroke="#e2e8f0" strokeWidth={0.025} />
            ))}
            {MAJOR_V.map(x => (
              <line key={`Mv${x}`} x1={x} y1={0} x2={x} y2={HALL_H} stroke="#cbd5e1" strokeWidth={0.04} />
            ))}
            {MAJOR_H.map(y => (
              <line key={`Mh${y}`} x1={0} y1={y} x2={HALL_W} y2={y} stroke="#cbd5e1" strokeWidth={0.04} />
            ))}
            {/* 刻度（米） */}
            {MAJOR_V.filter(x => x % 2 === 0).map(x => (
              <text key={`tx${x}`} x={x} y={-0.35} fontSize={0.32} textAnchor="middle" fill="#94a3b8">
                {x}
              </text>
            ))}
            {MAJOR_H.filter(y => y % 2 === 0).map(y => (
              <text key={`ty${y}`} x={-0.35} y={y + 0.11} fontSize={0.32} textAnchor="end" fill="#94a3b8">
                {y}
              </text>
            ))}
            {/* 外墙 */}
            <rect x={0} y={0} width={HALL_W} height={HALL_H} fill="none" stroke="#334155" strokeWidth={0.14} />

            {/* 出口与门前净空区 */}
            {EXITS.map(exit => {
              const zone = exitZone(exit)
              const door = exitDoorRectOnWall(exit)
              const label = exitLabelPos(exit)
              const highlighted = selectedWarning?.exitId === exit.id
              return (
                <g key={exit.id}>
                  <rect
                    x={zone.x}
                    y={zone.y}
                    width={zone.w}
                    height={zone.h}
                    fill="rgba(22,163,74,0.10)"
                    stroke={highlighted ? '#2563eb' : '#16a34a'}
                    strokeWidth={highlighted ? 0.09 : 0.045}
                    strokeDasharray="0.25 0.15"
                  />
                  <rect x={door.x} y={door.y} width={door.w} height={door.h} fill="#16a34a" />
                  <text x={label.x} y={label.y} fontSize={0.4} textAnchor="middle" fontWeight={600} fill="#15803d">
                    {exit.label}
                  </text>
                  <text
                    x={zone.x + zone.w / 2}
                    y={zone.y + zone.h / 2 + 0.11}
                    fontSize={0.3}
                    textAnchor="middle"
                    fill="#16a34a"
                  >
                    净空区
                  </text>
                </g>
              )
            })}

            {/* 疏散路径（选中展位 / 选中告警涉及的展位） */}
            {[...pathBoothIds].map(id => {
              const booth = previewBooths.find(b => b.id === id)
              if (!booth) return null
              const path = analysis.paths.get(id)
              const rp = receptionPoint(booth)
              if (!path) {
                return (
                  <g key={`nopath-${id}`}>
                    <circle cx={rp.x} cy={rp.y} r={0.32} fill="#fee2e2" stroke="#dc2626" strokeWidth={0.06} />
                    <text x={rp.x} y={rp.y + 0.14} fontSize={0.42} textAnchor="middle" fill="#dc2626">
                      ✕
                    </text>
                    <text x={rp.x} y={rp.y + 0.85} fontSize={0.32} textAnchor="middle" fill="#dc2626">
                      无法到达出口
                    </text>
                  </g>
                )
              }
              return (
                <polyline
                  key={`path-${id}`}
                  points={path.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="#0f766e"
                  strokeWidth={0.16}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="0.4 0.22"
                  markerEnd="url(#evac-arrow)"
                  opacity={0.85}
                />
              )
            })}

            {/* 展位 */}
            {previewBooths.map(b => {
              const eff = effectiveRect(b)
              const warnList = warningsByBooth.get(b.id) ?? []
              const hasError = warnList.some(w => w.severity === 'error')
              const isSelected = b.id === selectedBoothId
              const warnIndex = selectedWarning ? selectedWarning.boothIds.indexOf(b.id) : -1
              const rp = receptionPoint(b)
              const [f1, f2] = frontEdge(b)
              const bx = eff.x + eff.w
              const by = eff.y
              return (
                <g key={b.id}>
                  {warnIndex >= 0 && (
                    <rect
                      x={eff.x - 0.18}
                      y={eff.y - 0.18}
                      width={eff.w + 0.36}
                      height={eff.h + 0.36}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth={0.07}
                      strokeDasharray="0.3 0.18"
                    />
                  )}
                  <rect
                    x={eff.x}
                    y={eff.y}
                    width={eff.w}
                    height={eff.h}
                    fill={isSelected ? '#dbeafe' : '#ffffff'}
                    stroke={hasError ? '#dc2626' : warnList.length > 0 ? '#d97706' : '#475569'}
                    strokeWidth={isSelected ? 0.09 : 0.055}
                    style={{ cursor: 'move' }}
                    onPointerDown={e => {
                      e.stopPropagation()
                      if (e.button !== 0) return
                      propsRef.current.onSelectBooth(b.id)
                      dragRef.current = {
                        kind: 'move',
                        id: b.id,
                        start: toWorld(e.clientX, e.clientY),
                        orig: b,
                      }
                    }}
                  />
                  {hasError && (
                    <rect
                      x={eff.x}
                      y={eff.y}
                      width={eff.w}
                      height={eff.h}
                      fill="url(#error-hatch)"
                      pointerEvents="none"
                    />
                  )}
                  {/* 正面（接待侧）与接待点 */}
                  <line x1={f1.x} y1={f1.y} x2={f2.x} y2={f2.y} stroke="#0f766e" strokeWidth={0.12} pointerEvents="none" />
                  <circle cx={rp.x} cy={rp.y} r={0.1} fill="#0f766e" pointerEvents="none" />
                  {/* 名称与尺寸 */}
                  <text
                    x={eff.x + eff.w / 2}
                    y={eff.y + eff.h / 2 - 0.12}
                    fontSize={0.42}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#0f172a"
                    pointerEvents="none"
                  >
                    {b.name}
                  </text>
                  <text
                    x={eff.x + eff.w / 2}
                    y={eff.y + eff.h / 2 + 0.42}
                    fontSize={0.28}
                    textAnchor="middle"
                    fill="#64748b"
                    pointerEvents="none"
                  >
                    {eff.w}×{eff.h}m
                  </text>
                  {/* 告警徽标：三角形 + 感叹号（不依赖颜色也能识别） */}
                  {warnList.length > 0 && (
                    <g pointerEvents="none">
                      <path
                        d={`M ${bx} ${by - 0.3} L ${bx + 0.28} ${by + 0.18} L ${bx - 0.28} ${by + 0.18} Z`}
                        fill={hasError ? '#dc2626' : '#d97706'}
                        stroke="#ffffff"
                        strokeWidth={0.04}
                      />
                      <text x={bx} y={by + 0.11} fontSize={0.3} textAnchor="middle" fill="#ffffff" fontWeight={700}>
                        !
                      </text>
                    </g>
                  )}
                  {/* 选中告警时的序号徽标 */}
                  {warnIndex >= 0 && (
                    <g pointerEvents="none">
                      <circle cx={eff.x} cy={eff.y} r={0.24} fill="#2563eb" stroke="#ffffff" strokeWidth={0.05} />
                      <text x={eff.x} y={eff.y + 0.11} fontSize={0.32} textAnchor="middle" fill="#ffffff" fontWeight={700}>
                        {warnIndex + 1}
                      </text>
                    </g>
                  )}
                  {/* 缩放手柄 */}
                  {isSelected &&
                    CORNERS.map(corner => {
                      const pt = cornerPoint(eff, corner)
                      return (
                        <circle
                          key={corner}
                          cx={pt.x}
                          cy={pt.y}
                          r={0.17}
                          fill="#ffffff"
                          stroke="#2563eb"
                          strokeWidth={0.06}
                          style={{
                            cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
                          }}
                          onPointerDown={e => {
                            e.stopPropagation()
                            if (e.button !== 0) return
                            dragRef.current = { kind: 'resize', id: b.id, corner, orig: b, origEff: eff }
                          }}
                        />
                      )
                    })}
                </g>
              )
            })}
          </g>
        )}
      </svg>

      <div className="zoom-controls">
        <button onClick={() => zoomBy(1.25)} title="放大">
          ＋
        </button>
        <button onClick={() => zoomBy(1 / 1.25)} title="缩小">
          －
        </button>
        <button onClick={() => size && setViewport(fitViewport(size.w, size.h))} title="适应展厅">
          适应
        </button>
        {zoomPct !== null && <span className="zoom-pct">{zoomPct}%</span>}
      </div>

      <div className="coord-readout">
        {hover ? `X ${snap(hover.x).toFixed(1)} m · Y ${snap(hover.y).toFixed(1)} m` : '移动鼠标查看坐标'}
      </div>

      <div className="legend">
        <span>
          <i className="legend-dot" /> 接待点
        </span>
        <span>
          <i className="legend-line" /> 疏散路径
        </span>
        <span>
          <i className="legend-badge">!</i> 告警
        </span>
        <span>
          <i className="legend-zone" /> 出口净空区
        </span>
        <span>粗绿边 = 展位正面</span>
      </div>
    </div>
  )
}
