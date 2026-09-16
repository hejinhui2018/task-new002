export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type Rotation = 0 | 90 | 180 | 270

export interface Booth {
  id: string
  name: string
  /** 未旋转状态下左上角坐标（米），吸附到 0.5m 网格 */
  x: number
  y: number
  /** 未旋转状态下的宽（沿 x）与深（沿 y），单位米 */
  w: number
  h: number
  /** 绕中心顺时针（屏幕坐标系）旋转角度，仅支持 90° 的倍数 */
  rotation: Rotation
}

export type Wall = 'north' | 'south' | 'east' | 'west'

export interface ExitDoor {
  id: string
  label: string
  wall: Wall
  /** 沿墙方向的起始偏移（米） */
  offset: number
  /** 门宽（米） */
  width: number
}

export interface Viewport {
  /** 缩放：每米对应的屏幕像素 */
  zoom: number
  panX: number
  panY: number
}

export type Corner = 'nw' | 'ne' | 'sw' | 'se'

export type WarningType =
  | 'out-of-bounds'
  | 'overlap'
  | 'aisle'
  | 'exit-obstructed'
  | 'exit-unreachable'

export interface Warning {
  id: string
  type: WarningType
  severity: 'error' | 'caution'
  /** 相关展位 id，用于图上高亮 */
  boothIds: string[]
  /** 相关出口 id（仅出口类告警） */
  exitId?: string
  message: string
  detail: string
}
