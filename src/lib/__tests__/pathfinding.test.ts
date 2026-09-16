import { describe, expect, it } from 'vitest'
import type { Booth } from '../types'
import { EXITS, HALL_H, HALL_W } from '../constants'
import { doorMidpoint, effectiveRect, receptionPoint } from '../geometry'
import { findEvacPath } from '../pathfinding'
import { demoBooths } from '../samples'

const booth = (id: string, patch: Partial<Booth> = {}): Booth => ({
  id,
  name: id,
  x: 0,
  y: 0,
  w: 2,
  h: 2,
  rotation: 0,
  ...patch,
})

describe('疏散路径', () => {
  it('空旷展厅中接待点可以到达出口，路径从接待点出发、到门口结束', () => {
    const b = booth('a', { x: 8, y: 10, w: 3, h: 2 })
    const from = receptionPoint(b)
    const path = findEvacPath([b], from, EXITS)
    expect(path).not.toBeNull()
    expect(path![0]).toEqual(from)
    const last = path![path!.length - 1]
    const mids = EXITS.map(doorMidpoint)
    expect(mids.some(m => m.x === last.x && m.y === last.y)).toBe(true)
  })

  it('示例方案中 C1 的疏散路径被堵死', () => {
    const demo = demoBooths()
    const c1 = demo.find(b => b.id === 'demo-c1')!
    expect(findEvacPath(demo, receptionPoint(c1), EXITS)).toBeNull()
  })

  it('移开堵路的 B1 后，C1 的路径立即恢复', () => {
    const moved = demoBooths().map(b => (b.id === 'demo-b1' ? { ...b, x: 3, y: 10 } : b))
    const c1 = moved.find(b => b.id === 'demo-c1')!
    expect(findEvacPath(moved, receptionPoint(c1), EXITS)).not.toBeNull()
  })

  it('路径不穿过任何展位，且始终保持在展厅范围内', () => {
    const layout = demoBooths().map(b => (b.id === 'demo-b1' ? { ...b, x: 3, y: 10 } : b))
    for (const b of layout) {
      const path = findEvacPath(layout, receptionPoint(b), EXITS)
      expect(path).not.toBeNull()
      const others = layout.filter(o => o.id !== b.id).map(effectiveRect)
      for (const p of path!) {
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.x).toBeLessThanOrEqual(HALL_W)
        expect(p.y).toBeGreaterThanOrEqual(0)
        expect(p.y).toBeLessThanOrEqual(HALL_H)
        for (const rect of others) {
          const inside =
            p.x > rect.x && p.x < rect.x + rect.w && p.y > rect.y && p.y < rect.y + rect.h
          expect(inside).toBe(false)
        }
      }
    }
  })

  it('接待点被其他展位压住时仍尝试从最近空位寻路', () => {
    // b 的接待点 (2, 2.25) 被 a (1..4, 2..4) 覆盖，但旁边就是空地
    const a = booth('a', { x: 1, y: 2, w: 3, h: 2 })
    const b = booth('b', { x: 1, y: 0, w: 2, h: 2 })
    expect(findEvacPath([a, b], receptionPoint(b), EXITS)).not.toBeNull()
  })
})
