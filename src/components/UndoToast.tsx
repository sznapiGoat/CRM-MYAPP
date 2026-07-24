'use client'

import { useEffect } from 'react'

interface Props {
  message: string
  onUndo: () => void
  onDismiss: () => void
  duration?: number
}

export default function UndoToast({ message, onUndo, onDismiss, duration = 6000 }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [message, duration, onDismiss])

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-zinc-800 border border-zinc-700 rounded-xl pl-4 pr-2 py-2.5 shadow-2xl animate-[fadeInUp_.18s_ease-out]">
      <span className="text-sm text-zinc-200 whitespace-nowrap">{message}</span>
      <button
        onClick={onUndo}
        className="text-xs font-semibold text-blue-300 hover:text-blue-200 bg-zinc-900/60 hover:bg-zinc-900 rounded-lg px-3 py-1.5 transition-colors"
      >
        Vrátit zpět
      </button>
    </div>
  )
}
