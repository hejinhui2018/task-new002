import { describe, expect, it } from 'vitest'
import type { Booth } from '../types'
import {
  effectiveRect,
  frontEdge,
  receptionPoint,
  rectDistance,
  rectOutOfBounds,
  rectsOverlap,
  resizeEffective,
  screenToWorld,
  snap,
  storedFromEffective,
  worldToScreen,
  zoomAt,
} from '../geometry'

const booth = (patch: Partial<Booth>): Booth => ({
  id: 'b1',
  name: 'B1',
  x: 0,
  y: 0,
  w: 2,
  h: 2,
  rotation: 0,
  ...patch,
})

const r = (x: number, y: number, w: number, h: number) => ({ x, y, w, h })

describe('网格吸附', () => {
  it('吸附到 0.5m 网格', () => {
    expect(snap(0.3)).toBe(0.5)
    expect(snap(0.24)).toBe(0)
    expect(snap(1.26)).toBe(1.5)
    expect(snap(-0.3)).toBe(-0.5)
    expect(snap(2.5)).toBe(2.5)
    expect(snap(2.75)).toBe(3)
  })

  it('支持自定义网格', () => {
    expect(snap(0.6, 1)).toBe(1)
    expect(snap(2.3, 0.25)).toBe(2.25)
  })
})

describe('画布坐标换算', () => {
  it('worldToScreen 与 screenToWorld 互逆（含缩放和平移）', () => {
    const vp = { zoom: 37.5, panX: 123, panY: -45 }
    const w = { x: 12.5, y: 3.25 }
    const s = worldToScreen(w, vp)
    expect(s.x).toBe(591.75)
    expect(s.y).toBe(76.875)
    const back = screenToWorld(s, vp)
    expect(back.x).toBeCloseTo(w.x, 10)
    expect(back.y).toBeCloseTo(w.y, 10)
  })

  it('缩放时锚点下的世界坐标保持不变', () => {
    const vp = { zoom: 40, panX: 100, panY: 60 }
    const cursor = { x: 300, y: 200 }
    const vp2 = zoomAt(vp, cursor, 1.5)
    expect(vp2.zoom).toBeCloseTo(60, 10)
    const anchor = screenToWorld(cursor, vp)
    const after = worldToScreen(anchor, vp2)
    expect(after.x).toBeCloseTo(cursor.x, 8)
    expect(after.y).toBeCloseTo(cursor.y, 8)
  })

  it('缩放后的屏幕落点换算回世界坐标仍能精确吸附到 0.5m 网格', () => {
    const vp = { zoom: 66.6, panX: 31.7, panY: 77.2 }
    const world = screenToWorld({ x: 500.3, y: 211.8 }, vp)
    const snapped = snap(world.x)
    expect(Math.abs(snapped * 2 - Math.round(snapped * 2))).toBeLessThan(1e-9)
  })
})

describe('旋转与有效占位', () => {
  it('旋转 90° 后宽高互换且中心不变', () => {
    expect(effectiveRect(booth({ x: 2, y: 2, w: 4, h: 2, rotation: 90 }))).toEqual(r(3, 1, 2, 4))
    expect(effectiveRect(booth({ x: 2, y: 2, w: 4, h: 2, rotation: 270 }))).toEqual(r(3, 1, 2, 4))
    expect(effectiveRect(booth({ x: 2, y: 2, w: 4, h: 2, rotation: 180 }))).toEqual(r(2, 2, 4, 2))
  })

  it('storedFromEffective 是 effectiveRect 的逆运算', () => {
    const b = booth({ x: 2, y: 2, w: 4, h: 2, rotation: 90 })
    expect(storedFromEffective(b, effectiveRect(b))).toEqual({ x: 2, y: 2, w: 4, h: 2 })
  })

  it('接待点随旋转位于正面外侧', () => {
    expect(receptionPoint(booth({ x: 2, y: 2, w: 4, h: 2, rotation: 0 }))).toEqual({ x: 4, y: 4.25 })
    expect(receptionPoint(booth({ x: 2, y: 2, w: 4, h: 2, rotation: 180 }))).toEqual({ x: 4, y: 1.75 })
    expect(receptionPoint(booth({ x: 2, y: 2, w: 4, h: 2, rotation: 90 }))).toEqual({ x: 2.75, y: 3 })
    expect(receptionPoint(booth({ x: 2, y: 2, w: 4, h: 2, rotation: 270 }))).toEqual({ x: 5.25, y: 3 })
  })

  it('frontEdge 给出正面两端点', () => {
    const [a, b] = frontEdge(booth({ x: 2, y: 2, w: 4, h: 2, rotation: 0 }))
    expect(a).toEqual({ x: 2, y: 4 })
    expect(b).toEqual({ x: 6, y: 4 })
  })
})

describe('矩形关系', () => {
  it('重叠判定（仅边相接不算重叠）', () => {
    expect(rectsOverlap(r(0, 0, 2, 2), r(1, 1, 2, 2))).toBe(true)
    expect(rectsOverlap(r(0, 0, 2, 2), r(2, 0, 2, 2))).toBe(false)
  })

  it('间距计算', () => {
    expect(rectDistance(r(0, 0, 2, 2), r(3.5, 0, 2, 2))).toBeCloseTo(1.5, 10)
    expect(rectDistance(r(0, 0, 2, 2), r(2, 0, 2, 2))).toBe(0)
    expect(rectDistance(r(0, 0, 2, 2), r(3, 3, 1, 1))).toBeCloseTo(Math.SQRT2, 10)
  })

  it('越界判定', () => {
    expect(rectOutOfBounds(r(0, 0, 20, 14), 20, 14)).toBe(false)
    expect(rectOutOfBounds(r(19.5, 0, 1, 2), 20, 14)).toBe(true)
    expect(rectOutOfBounds(r(-0.5, 0, 1, 2), 20, 14)).toBe(true)
  })

  it('拖角缩放换算（含最小尺寸限制）', () => {
    expect(resizeEffective(r(2, 2, 4, 2), 'se', 8, 6)).toEqual(r(2, 2, 6, 4))
    expect(resizeEffective(r(2, 2, 4, 2), 'nw', 3, 3)).toEqual(r(3, 3, 3, 1))
    expect(resizeEffective(r(2, 2, 4, 2), 'se', 2.2, 2.2)).toEqual(r(2, 2, 1, 1))
  })
})
