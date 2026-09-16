import { describe, expect, it } from 'vitest'
import type { Booth } from '../types'
import { EXITS } from '../constants'
import { analyzeLayout } from '../validation'
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

describe('布局校验', () => {
  it('展位越界时报错并关联该展位', () => {
    const { warnings } = analyzeLayout([booth('a', { x: 19, w: 2 })], EXITS)
    const w = warnings.find(w => w.type === 'out-of-bounds')
    expect(w).toBeDefined()
    expect(w?.boothIds).toEqual(['a'])
    expect(w?.severity).toBe('error')
  })

  it('两个展位重叠时报错并关联双方', () => {
    const { warnings } = analyzeLayout(
      [booth('a', { x: 4, y: 4 }), booth('b', { x: 5, y: 4 })],
      EXITS,
    )
    const w = warnings.find(w => w.type === 'overlap')
    expect(w).toBeDefined()
    expect(w?.boothIds).toEqual(['a', 'b'])
  })

  it('间距恰好 1.5m 不报通道告警，1.4m 报提醒', () => {
    const ok = analyzeLayout([booth('a', { x: 2, y: 4 }), booth('b', { x: 5.5, y: 4 })], EXITS)
    expect(ok.warnings.filter(w => w.type === 'aisle')).toHaveLength(0)

    const bad = analyzeLayout([booth('a', { x: 2, y: 4 }), booth('b', { x: 5.4, y: 4 })], EXITS)
    const aisle = bad.warnings.find(w => w.type === 'aisle')
    expect(aisle).toBeDefined()
    expect(aisle?.severity).toBe('caution')
    expect(aisle?.boothIds).toEqual(['a', 'b'])
  })

  it('重叠的展位不再重复报通道告警', () => {
    const { warnings } = analyzeLayout(
      [booth('a', { x: 4, y: 4 }), booth('b', { x: 5, y: 4 })],
      EXITS,
    )
    expect(warnings.filter(w => w.type === 'aisle')).toHaveLength(0)
  })

  it('占用出口净空区时报错并关联出口', () => {
    const { warnings } = analyzeLayout([booth('a', { x: 1, y: 0, w: 2, h: 1 })], EXITS)
    const w = warnings.find(w => w.type === 'exit-obstructed')
    expect(w).toBeDefined()
    expect(w?.exitId).toBe('exit-a')
  })

  it('合规方案没有任何告警', () => {
    const { warnings } = analyzeLayout([booth('a', { x: 8, y: 6, w: 3, h: 2 })], EXITS)
    expect(warnings).toHaveLength(0)
  })

  it('内置示例方案触发「出口被堵」告警，且只关联被堵的 C1', () => {
    const { warnings } = analyzeLayout(demoBooths(), EXITS)
    const w = warnings.find(w => w.type === 'exit-unreachable')
    expect(w).toBeDefined()
    expect(w?.boothIds).toEqual(['demo-c1'])
  })
})
