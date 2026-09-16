import { describe, expect, it } from 'vitest'
import {
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  commit,
  createHistory,
  redo,
  undo,
} from '../history'

describe('撤销 / 重做', () => {
  it('commit 记录历史并清空 future', () => {
    let h = createHistory<number>(0)
    h = commit(h, 1)
    h = commit(h, 2)
    h = undo(h)
    expect(h.present).toBe(1)
    h = commit(h, 5)
    expect(h.present).toBe(5)
    expect(canRedo(h)).toBe(false)
  })

  it('undo / redo 按顺序恢复状态', () => {
    let h = createHistory<string>('a')
    h = commit(h, 'b')
    h = commit(h, 'c')
    expect(canUndo(h)).toBe(true)

    h = undo(h)
    expect(h.present).toBe('b')
    h = undo(h)
    expect(h.present).toBe('a')
    expect(canUndo(h)).toBe(false)

    h = redo(h)
    expect(h.present).toBe('b')
    h = redo(h)
    expect(h.present).toBe('c')
    expect(canRedo(h)).toBe(false)
  })

  it('空历史上 undo / redo 是安全的无操作', () => {
    const h = createHistory<number>(0)
    expect(undo(h).present).toBe(0)
    expect(redo(h).present).toBe(0)
  })

  it('重置方案也是一次可撤销的提交', () => {
    let h = createHistory<number[]>([1, 2])
    h = commit(h, [])
    expect(h.present).toEqual([])
    h = undo(h)
    expect(h.present).toEqual([1, 2])
  })

  it('历史长度有上限', () => {
    let h = createHistory<number>(0)
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) h = commit(h, i)
    expect(h.past.length).toBe(HISTORY_LIMIT)
    expect(h.present).toBe(HISTORY_LIMIT + 20)
  })
})
