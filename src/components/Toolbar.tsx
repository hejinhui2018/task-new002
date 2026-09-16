interface ToolbarProps {
  canUndo: boolean
  canRedo: boolean
  hasSelection: boolean
  errorCount: number
  cautionCount: number
  onAdd: () => void
  onRotate: () => void
  onDelete: () => void
  onUndo: () => void
  onRedo: () => void
  onResetDemo: () => void
  onClear: () => void
}

export function Toolbar(props: ToolbarProps) {
  const status =
    props.errorCount > 0
      ? { cls: 'bad', text: `⛔ 错误 ${props.errorCount} 项 · ⚠️ 提醒 ${props.cautionCount} 项` }
      : props.cautionCount > 0
        ? { cls: 'warn', text: `⚠️ 提醒 ${props.cautionCount} 项` }
        : { cls: 'good', text: '✅ 无告警' }

  return (
    <div className="toolbar">
      <button onClick={props.onAdd}>＋ 添加展位</button>
      <span className="sep" />
      <button disabled={!props.hasSelection} onClick={props.onRotate} title="快捷键 R">
        ⟳ 旋转 90°
      </button>
      <button disabled={!props.hasSelection} onClick={props.onDelete} title="快捷键 Delete">
        🗑 删除
      </button>
      <span className="sep" />
      <button disabled={!props.canUndo} onClick={props.onUndo} title="Ctrl/⌘+Z">
        ↩ 撤销
      </button>
      <button disabled={!props.canRedo} onClick={props.onRedo} title="Ctrl/⌘+Shift+Z">
        ↪ 重做
      </button>
      <span className="sep" />
      <button onClick={props.onResetDemo} title="恢复为内置的「出口被堵」示例方案">
        重置为示例方案
      </button>
      <button onClick={props.onClear}>清空</button>
      <span className="spacer" />
      <span className={`status ${status.cls}`}>{status.text}</span>
    </div>
  )
}
