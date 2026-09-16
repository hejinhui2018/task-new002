import type { Booth, Warning, WarningType } from '../lib/types'

interface Props {
  warnings: Warning[]
  booths: Booth[]
  selectedWarningId: string | null
  onSelectWarning: (id: string | null) => void
  onSelectBooth: (id: string) => void
}

const TYPE_ORDER: WarningType[] = [
  'out-of-bounds',
  'overlap',
  'exit-unreachable',
  'exit-obstructed',
  'aisle',
]

const TYPE_META: Record<WarningType, { icon: string; label: string }> = {
  'out-of-bounds': { icon: '⛔', label: '超出展厅边界' },
  overlap: { icon: '⛔', label: '展位重叠' },
  'exit-unreachable': { icon: '🚪', label: '疏散路径不通' },
  'exit-obstructed': { icon: '🚪', label: '出口净空区被占用' },
  aisle: { icon: '⚠️', label: '通道不足 1.5 m' },
}

export function WarningsPanel({
  warnings,
  booths,
  selectedWarningId,
  onSelectWarning,
  onSelectBooth,
}: Props) {
  const nameOf = (id: string) => booths.find(b => b.id === id)?.name ?? id

  return (
    <div className="panel warnings">
      <h2>告警（{warnings.length}）</h2>
      {warnings.length === 0 && <p className="ok">✅ 当前方案没有发现问题</p>}
      {TYPE_ORDER.map(type => {
        const items = warnings.filter(w => w.type === type)
        if (items.length === 0) return null
        const meta = TYPE_META[type]
        return (
          <section key={type}>
            <h3>
              {meta.icon} {meta.label}（{items.length}）
            </h3>
            {items.map(w => (
              <div
                key={w.id}
                role="button"
                tabIndex={0}
                className={`warning-item ${w.severity} ${w.id === selectedWarningId ? 'selected' : ''}`}
                onClick={() => onSelectWarning(w.id === selectedWarningId ? null : w.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectWarning(w.id === selectedWarningId ? null : w.id)
                  }
                }}
              >
                <span className="warning-message">{w.message}</span>
                <span className="warning-detail">{w.detail}</span>
                <span className="warning-booths">
                  {w.boothIds.map((id, i) => (
                    <span
                      key={id}
                      className="chip"
                      title="点击定位展位"
                      onClick={e => {
                        e.stopPropagation()
                        onSelectBooth(id)
                      }}
                    >
                      <b>{i + 1}</b> {nameOf(id)}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
