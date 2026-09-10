export interface Toast {
  id: number
  text: string
  tone?: 'ok' | 'err' | 'info'
}

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone ?? 'info'}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}
