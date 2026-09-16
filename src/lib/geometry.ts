import type { Booth, Corner, ExitDoor, Point, Rect, Viewport } from './types'
import { AISLE, GRID, HALL_H, HALL_W, RECEPTION_OFFSET } from './constants'

/** 吸附到网格（默认 0.5m），并消除浮点误差 */
export function snap(value: number, grid: number = GRID): number {
  const s = Math.round(value / grid) * grid
  const r = Math.round(s * 1000) / 1000
  return r === 0 ? 0 : r
}

/** 世界坐标（米）→ 屏幕坐标（px） */
export function worldToScreen(p: Point, vp: Viewport): Point {
  return { x: vp.panX + p.x * vp.zoom, y: vp.panY + p.y * vp.zoom }
}

/** 屏幕坐标（px）→ 世界坐标（米）。缩放/平移后拖拽落点换算全靠它 */
export function screenToWorld(p: Point, vp: Viewport): Point {
  return { x: (p.x - vp.panX) / vp.zoom, y: (p.y - vp.panY) / vp.zoom }
}

/** 以屏幕上某点为锚点缩放：锚点下的世界坐标在缩放前后保持不动 */
export function zoomAt(vp: Viewport, center: Point, factor: number): Viewport {
  const zoom = Math.min(400, Math.max(10, vp.zoom * factor))
  const k = zoom / vp.zoom
  return {
    zoom,
    panX: center.x - (center.x - vp.panX) * k,
    panY: center.y - (center.y - vp.panY) * k,
  }
}

/** 让展厅完整居中显示的初始视口 */
export function fitViewport(width: number, height: number): Viewport {
  const margin = 96
  const zoom = Math.min((width - margin) / HALL_W, (height - margin) / HALL_H)
  return {
    zoom,
    panX: (width - HALL_W * zoom) / 2,
    panY: (height - HALL_H * zoom) / 2,
  }
}

/** 绕 center 旋转 deg（90 的倍数，屏幕坐标系下为顺时针） */
export function rotatePoint(p: Point, center: Point, deg: number): Point {
  let dx = p.x - center.x
  let dy = p.y - center.y
  const k = (((deg % 360) + 360) % 360) / 90
  for (let i = 0; i < k; i++) {
    const t = dx
    dx = -dy
    dy = t
  }
  return { x: center.x + dx, y: center.y + dy }
}

/** 展位旋转后的实际占位矩形（轴对齐） */
export function effectiveRect(b: Booth): Rect {
  const rotated = b.rotation === 90 || b.rotation === 270
  const w = rotated ? b.h : b.w
  const h = rotated ? b.w : b.h
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

/** effectiveRect 的逆运算：由目标占位矩形反推存储的 x/y/w/h（保持中心不变） */
export function storedFromEffective(orig: Booth, eff: Rect): Pick<Booth, 'x' | 'y' | 'w' | 'h'> {
  const rotated = orig.rotation === 90 || orig.rotation === 270
  const w = rotated ? eff.h : eff.w
  const h = rotated ? eff.w : eff.h
  const cx = eff.x + eff.w / 2
  const cy = eff.y + eff.h / 2
  return { x: snap(cx - w / 2), y: snap(cy - h / 2), w, h }
}

/** 接待点：正面（未旋转时的 +y 边）中点向外偏移，随旋转绕中心转动 */
export function receptionPoint(b: Booth): Point {
  const center = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  return rotatePoint({ x: b.x + b.w / 2, y: b.y + b.h + RECEPTION_OFFSET }, center, b.rotation)
}

/** 正面边缘的两个端点（用于图上标出朝向） */
export function frontEdge(b: Booth): [Point, Point] {
  const center = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  return [
    rotatePoint({ x: b.x, y: b.y + b.h }, center, b.rotation),
    rotatePoint({ x: b.x + b.w, y: b.y + b.h }, center, b.rotation),
  ]
}

/** 拖角缩放：corner 跟随 (px, py)，对角固定，边长不小于 min */
export function resizeEffective(eff: Rect, corner: Corner, px: number, py: number, min = 1): Rect {
  const right = eff.x + eff.w
  const bottom = eff.y + eff.h
  let { x, y, w, h } = eff
  if (corner.includes('e')) w = Math.max(min, px - x)
  if (corner.includes('s')) h = Math.max(min, py - y)
  if (corner.includes('w')) {
    x = Math.min(px, right - min)
    w = right - x
  }
  if (corner.includes('n')) {
    y = Math.min(py, bottom - min)
    h = bottom - y
  }
  return { x, y, w, h }
}

/** 面积意义上的重叠（仅边相接不算） */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/** 两个轴对齐矩形之间的最小间距（重叠时为 0） */
export function rectDistance(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)))
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)))
  return Math.hypot(dx, dy)
}

export function rectOutOfBounds(r: Rect, width: number, height: number): boolean {
  const eps = 1e-9
  return r.x < -eps || r.y < -eps || r.x + r.w > width + eps || r.y + r.h > height + eps
}

/** 门在墙面上的线段（退化的矩形） */
export function doorRect(exit: ExitDoor): Rect {
  switch (exit.wall) {
    case 'north':
      return { x: exit.offset, y: 0, w: exit.width, h: 0 }
    case 'south':
      return { x: exit.offset, y: HALL_H, w: exit.width, h: 0 }
    case 'west':
      return { x: 0, y: exit.offset, w: 0, h: exit.width }
    case 'east':
      return { x: HALL_W, y: exit.offset, w: 0, h: exit.width }
  }
}

export function doorMidpoint(exit: ExitDoor): Point {
  const r = doorRect(exit)
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

/** 出口门前必须保持空旷的净空区（向厅内延伸 AISLE 米） */
export function exitZone(exit: ExitDoor): Rect {
  switch (exit.wall) {
    case 'north':
      return { x: exit.offset, y: 0, w: exit.width, h: AISLE }
    case 'south':
      return { x: exit.offset, y: HALL_H - AISLE, w: exit.width, h: AISLE }
    case 'west':
      return { x: 0, y: exit.offset, w: AISLE, h: exit.width }
    case 'east':
      return { x: HALL_W - AISLE, y: exit.offset, w: AISLE, h: exit.width }
  }
}
