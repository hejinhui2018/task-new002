import type { ExitDoor } from './types'

/** 展厅宽（米） */
export const HALL_W = 20
/** 展厅高（米） */
export const HALL_H = 14
/** 吸附网格（米） */
export const GRID = 0.5
/** 展位之间需要保留的最小通道宽度（米） */
export const AISLE = 1.5
/** 展位最小边长（米） */
export const MIN_BOOTH = 1
/** 接待点距正面边缘的外移距离（米） */
export const RECEPTION_OFFSET = 0.25

/** 两个固定出口，均位于北墙 */
export const EXITS: ExitDoor[] = [
  { id: 'exit-a', label: '出口 A', wall: 'north', offset: 1, width: 2 },
  { id: 'exit-b', label: '出口 B', wall: 'north', offset: 17, width: 2 },
]
