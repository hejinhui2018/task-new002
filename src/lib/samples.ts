import type { Booth } from './types'

/**
 * 内置示例：「出口被堵」。
 * A1 / B1 / A2 三个展位在展厅中部连成一道隔墙，把 C1 困在南侧区域，
 * 而两个出口都在北墙 —— C1 的接待点因此无法到达任何出口。
 * 把 B1 拖开，通道打通，告警与疏散路径会立即更新。
 */
export function demoBooths(): Booth[] {
  return [
    { id: 'demo-a1', name: 'A1 展位', x: 0, y: 6, w: 7.5, h: 2, rotation: 180 },
    { id: 'demo-a2', name: 'A2 展位', x: 10, y: 6, w: 10, h: 2, rotation: 180 },
    { id: 'demo-b1', name: 'B1 展位', x: 7.5, y: 6, w: 2.5, h: 2, rotation: 180 },
    { id: 'demo-c1', name: 'C1 展位', x: 8.5, y: 10, w: 3, h: 2, rotation: 0 },
  ]
}
