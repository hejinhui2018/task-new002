import type { Booth, ExitDoor, Point, Warning } from './types'
import { AISLE, HALL_H, HALL_W } from './constants'
import {
  effectiveRect,
  exitZone,
  receptionPoint,
  rectDistance,
  rectOutOfBounds,
  rectsOverlap,
} from './geometry'
import { findEvacPath } from './pathfinding'

export interface Analysis {
  warnings: Warning[]
  /** 每个展位的疏散路径（null 表示被堵） */
  paths: Map<string, Point[] | null>
}

/** 对当前方案做全量校验：越界、重叠、通道净空、出口净空、疏散可达性 */
export function analyzeLayout(booths: Booth[], exits: ExitDoor[]): Analysis {
  const warnings: Warning[] = []
  const rects = booths.map(booth => ({ booth, rect: effectiveRect(booth) }))

  // 1. 越界
  for (const { booth, rect } of rects) {
    if (rectOutOfBounds(rect, HALL_W, HALL_H)) {
      warnings.push({
        id: `out-of-bounds:${booth.id}`,
        type: 'out-of-bounds',
        severity: 'error',
        boothIds: [booth.id],
        message: `「${booth.name}」超出展厅边界`,
        detail: `展位必须完全位于 ${HALL_W}m × ${HALL_H}m 的展厅范围内，请调整位置或尺寸。`,
      })
    }
  }

  // 2. 重叠 / 通道净空
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]
      const b = rects[j]
      const ids = [a.booth.id, b.booth.id].sort()
      if (rectsOverlap(a.rect, b.rect)) {
        warnings.push({
          id: `overlap:${ids[0]}:${ids[1]}`,
          type: 'overlap',
          severity: 'error',
          boothIds: [a.booth.id, b.booth.id],
          message: `「${a.booth.name}」与「${b.booth.name}」重叠`,
          detail: '两个展位占用了同一区域，请移动其中一个。',
        })
      } else {
        const d = rectDistance(a.rect, b.rect)
        if (d < AISLE - 1e-6) {
          warnings.push({
            id: `aisle:${ids[0]}:${ids[1]}`,
            type: 'aisle',
            severity: 'caution',
            boothIds: [a.booth.id, b.booth.id],
            message: `「${a.booth.name}」与「${b.booth.name}」之间通道仅 ${d.toFixed(2)} m`,
            detail: `展位之间需要保留至少 ${AISLE} m 通道，还差 ${(AISLE - d).toFixed(2)} m。`,
          })
        }
      }
    }
  }

  // 3. 出口门前净空区被占用
  for (const exit of exits) {
    const zone = exitZone(exit)
    for (const { booth, rect } of rects) {
      if (rectsOverlap(rect, zone)) {
        warnings.push({
          id: `exit-obstructed:${booth.id}:${exit.id}`,
          type: 'exit-obstructed',
          severity: 'error',
          boothIds: [booth.id],
          exitId: exit.id,
          message: `「${booth.name}」占用${exit.label}门前净空区`,
          detail: `${exit.label}前 ${AISLE} m 范围内不得摆放展位。`,
        })
      }
    }
  }

  // 4. 疏散路径可达性
  const paths = new Map<string, Point[] | null>()
  for (const booth of booths) {
    const path = findEvacPath(booths, receptionPoint(booth), exits)
    paths.set(booth.id, path)
    if (!path) {
      warnings.push({
        id: `exit-unreachable:${booth.id}`,
        type: 'exit-unreachable',
        severity: 'error',
        boothIds: [booth.id],
        message: `「${booth.name}」的接待点无法到达任何出口`,
        detail: '从展位正面到任一出口的可走路径被其他展位堵死，请留出通道。',
      })
    }
  }

  return { warnings, paths }
}
