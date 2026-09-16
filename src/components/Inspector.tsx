import { useEffect, useState } from 'react'
import type { Booth, Rotation } from '../lib/types'
import { MIN_BOOTH } from '../lib/constants'
import { receptionPoint, snap } from '../lib/geometry'

interface Props {
  booth: Booth | null
  pathExists: boolean
  onChange: (id: string, patch: Partial<Booth>) => void
  onRotate: (id: string) => void
  onDelete: (id: string) => void
}

/** 数值输入：本地编辑，失焦 / 回车时吸附并提交（避免每次击键都产生一条历史） */
function NumberField(props: { label: string; value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(props.value))
  useEffect(() => setText(String(props.value)), [props.value])
  const commit = () => {
    const v = parseFloat(text)
    if (Number.isFinite(v)) props.onCommit(v)
    else setText(String(props.value))
  }
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type="number"
        step={0.5}
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </label>
  )
}

function TextField(props: { label: string; value: string; onCommit: (v: string) => void }) {
  const [text, setText] = useState(props.value)
  useEffect(() => setText(props.value), [props.value])
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => {
          if (text.trim()) props.onCommit(text.trim())
          else setText(props.value)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </label>
  )
}

export function Inspector({ booth, pathExists, onChange, onRotate, onDelete }: Props) {
  if (!booth) {
    return (
      <div className="panel inspector">
        <h2>展位属性</h2>
        <p className="muted">未选中展位。点击画布中的展位查看和编辑属性；点击右侧告警可定位相关展位。</p>
      </div>
    )
  }
  const rp = receptionPoint(booth)
  return (
    <div className="panel inspector">
      <h2>展位属性</h2>
      <TextField label="名称" value={booth.name} onCommit={v => onChange(booth.id, { name: v })} />
      <div className="field-row">
        <NumberField label="X (m)" value={booth.x} onCommit={v => onChange(booth.id, { x: snap(v) })} />
        <NumberField label="Y (m)" value={booth.y} onCommit={v => onChange(booth.id, { y: snap(v) })} />
      </div>
      <div className="field-row">
        <NumberField
          label="宽 (m)"
          value={booth.w}
          onCommit={v => onChange(booth.id, { w: Math.max(MIN_BOOTH, snap(v)) })}
        />
        <NumberField
          label="深 (m)"
          value={booth.h}
          onCommit={v => onChange(booth.id, { h: Math.max(MIN_BOOTH, snap(v)) })}
        />
      </div>
      <label className="field">
        <span>正面朝向</span>
        <select
          value={booth.rotation}
          onChange={e => onChange(booth.id, { rotation: Number(e.target.value) as Rotation })}
        >
          <option value={0}>朝南（向下）</option>
          <option value={90}>朝西（向左）</option>
          <option value={180}>朝北（向上）</option>
          <option value={270}>朝东（向右）</option>
        </select>
      </label>
      <p className="muted">
        接待点：({rp.x.toFixed(2)}, {rp.y.toFixed(2)})，位于正面外侧 0.25 m。
      </p>
      <p className={pathExists ? 'ok' : 'bad'}>
        {pathExists ? '✅ 疏散路径可达出口' : '⛔ 疏散路径不通，无法到达任何出口'}
      </p>
      <div className="inspector-actions">
        <button onClick={() => onRotate(booth.id)}>⟳ 旋转 90°</button>
        <button className="danger" onClick={() => onDelete(booth.id)}>
          🗑 删除展位
        </button>
      </div>
    </div>
  )
}
