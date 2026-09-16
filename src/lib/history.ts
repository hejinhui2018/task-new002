export interface History<T> {
  past: T[]
  present: T
  future: T[]
}

/** 历史栈上限，防止无限增长 */
export const HISTORY_LIMIT = 100

export function createHistory<T>(initial: T): History<T> {
  return { past: [], present: initial, future: [] }
}

/** 提交一个新状态：当前状态入 past，清空 future */
export function commit<T>(h: History<T>, next: T): History<T> {
  if (Object.is(h.present, next)) return h
  const past = [...h.past, h.present]
  if (past.length > HISTORY_LIMIT) past.shift()
  return { past, present: next, future: [] }
}

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h
  const prev = h.past[h.past.length - 1]
  return {
    past: h.past.slice(0, -1),
    present: prev,
    future: [h.present, ...h.future],
  }
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h
  const [next, ...rest] = h.future
  return {
    past: [...h.past, h.present],
    present: next,
    future: rest,
  }
}

export function canUndo<T>(h: History<T>): boolean {
  return h.past.length > 0
}

export function canRedo<T>(h: History<T>): boolean {
  return h.future.length > 0
}
