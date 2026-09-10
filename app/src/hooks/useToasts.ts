import { useCallback, useRef, useState } from 'react'
import type { Toast } from '../components/Toasts'

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const id = useRef(0)
  const push = useCallback((text: string, tone: Toast['tone'] = 'info', ms = 2800) => {
    const t = { id: ++id.current, text, tone }
    setToasts((xs) => [...xs, t].slice(-4))
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== t.id)), ms)
  }, [])
  return { toasts, push }
}
