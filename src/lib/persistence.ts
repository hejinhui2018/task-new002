import type { Booth } from './types'

const KEY = 'expo-layout:v1'

export function loadBooths(): Booth[] | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) return null
    return data.filter(isBooth)
  } catch {
    return null
  }
}

export function saveBooths(booths: Booth[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(booths))
  } catch {
    // 存储失败（隐私模式等）时静默忽略，不影响编辑
  }
}

function isBooth(v: unknown): v is Booth {
  const b = v as Booth
  return (
    !!b &&
    typeof b.id === 'string' &&
    typeof b.name === 'string' &&
    [b.x, b.y, b.w, b.h].every(n => typeof n === 'number' && Number.isFinite(n)) &&
    [0, 90, 180, 270].includes(b.rotation)
  )
}
