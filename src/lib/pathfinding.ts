import type { Booth, ExitDoor, Point } from './types'
import { GRID, HALL_H, HALL_W } from './constants'
import { doorMidpoint, doorRect, effectiveRect } from './geometry'

const COLS = Math.round(HALL_W / GRID)
const ROWS = Math.round(HALL_H / GRID)
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const

function cellCenter(index: number): Point {
  const c = index % COLS
  const r = Math.floor(index / COLS)
  return { x: c * GRID + GRID / 2, y: r * GRID + GRID / 2 }
}

function cellOf(p: Point): number {
  const c = Math.min(COLS - 1, Math.max(0, Math.floor(p.x / GRID)))
  const r = Math.min(ROWS - 1, Math.max(0, Math.floor(p.y / GRID)))
  return r * COLS + c
}

/** 起点落在展位里时，向外找最近的可行走格 */
function nearestFree(start: number, blocked: Uint8Array): number | null {
  if (!blocked[start]) return start
  const sc = start % COLS
  const sr = Math.floor(start / COLS)
  for (let radius = 1; radius <= 3; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue
        const c = sc + dx
        const r = sr + dy
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue
        const i = r * COLS + c
        if (!blocked[i]) return i
      }
    }
  }
  return null
}

/** 出口门线内侧一格的所有格子（BFS 的目标集合） */
function exitCells(exit: ExitDoor): number[] {
  const cells: number[] = []
  const r = doorRect(exit)
  if (exit.wall === 'north' || exit.wall === 'south') {
    const row = exit.wall === 'north' ? 0 : ROWS - 1
    for (let c = 0; c < COLS; c++) {
      const cx = c * GRID + GRID / 2
      if (cx > r.x && cx < r.x + r.w) cells.push(row * COLS + c)
    }
  } else {
    const col = exit.wall === 'west' ? 0 : COLS - 1
    for (let rr = 0; rr < ROWS; rr++) {
      const cy = rr * GRID + GRID / 2
      if (cy > r.y && cy < r.y + r.h) cells.push(rr * COLS + col)
    }
  }
  return cells
}

/** 去掉共线的中间点，让折线更干净 */
function simplify(points: Point[]): Point[] {
  if (points.length <= 2) return points
  const out = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1]
    const b = points[i]
    const c = points[i + 1]
    const collinear = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)
    if (!collinear) out.push(b)
  }
  out.push(points[points.length - 1])
  return out
}

/**
 * 从 from（接待点）出发，在 0.5m 网格上 BFS 寻找通往任一出口的可走路径。
 * 展位占据的格子不可通行。返回世界坐标折线，找不到时返回 null。
 */
export function findEvacPath(booths: Booth[], from: Point, exits: ExitDoor[]): Point[] | null {
  const blocked = new Uint8Array(COLS * ROWS)
  const rects = booths.map(effectiveRect)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = c * GRID + GRID / 2
      const cy = r * GRID + GRID / 2
      for (const rect of rects) {
        if (cx > rect.x && cx < rect.x + rect.w && cy > rect.y && cy < rect.y + rect.h) {
          blocked[r * COLS + c] = 1
          break
        }
      }
    }
  }

  const start = nearestFree(cellOf(from), blocked)
  if (start === null) return null

  const exitOf = new Map<number, ExitDoor>()
  for (const exit of exits) {
    for (const cell of exitCells(exit)) {
      if (!blocked[cell]) exitOf.set(cell, exit)
    }
  }
  if (exitOf.size === 0) return null

  const prev = new Int32Array(COLS * ROWS).fill(-1)
  prev[start] = start
  const queue: number[] = [start]
  let found = -1
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (exitOf.has(cur)) {
      found = cur
      break
    }
    const cc = cur % COLS
    const cr = Math.floor(cur / COLS)
    for (const [dx, dy] of DIRS) {
      const nc = cc + dx
      const nr = cr + dy
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue
      const ni = nr * COLS + nc
      if (blocked[ni] || prev[ni] !== -1) continue
      prev[ni] = cur
      queue.push(ni)
    }
  }
  if (found < 0) return null

  const centers: Point[] = []
  let cur = found
  for (;;) {
    centers.push(cellCenter(cur))
    if (prev[cur] === cur) break
    cur = prev[cur]
  }
  centers.reverse()

  const points: Point[] = [from]
  for (const p of centers) {
    const last = points[points.length - 1]
    if (last.x !== p.x || last.y !== p.y) points.push(p)
  }
  points.push(doorMidpoint(exitOf.get(found)!))
  return simplify(points)
}
