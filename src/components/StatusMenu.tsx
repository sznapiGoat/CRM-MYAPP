'use client'

import { useEffect, useRef, useState } from 'react'
import { LeadStatus, STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from '@/types/lead'
import StatusPill from './StatusPill'

interface Props {
  status: LeadStatus
  onSelect: (status: LeadStatus) => void
}

export default function StatusMenu({ status, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <StatusPill status={status} onClick={() => setOpen(o => !o)} />

      {open && (
        <div className="absolute left-0 top-full mt-1 z-40 origin-top animate-[popIn_.12s_ease-out] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-1 flex flex-col gap-0.5 min-w-[140px]">
          {STATUS_ORDER.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => { setOpen(false); if (s !== status) onSelect(s) }}
              className={`flex items-center gap-2 text-left px-2 py-1.5 rounded text-xs transition-colors ${
                s === status ? 'bg-zinc-800' : 'hover:bg-zinc-800'
              }`}
            >
              <span className={`${STATUS_COLORS[s]} w-2.5 h-2.5 rounded-full shrink-0`} />
              <span className="text-zinc-200">{STATUS_LABELS[s]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
