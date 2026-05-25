'use client'

import { LeadStatus, STATUS_COLORS, STATUS_LABELS } from '@/types/lead'

interface Props {
  status: LeadStatus
  onClick?: () => void
  active?: boolean
  size?: 'sm' | 'md'
}

export default function StatusPill({ status, onClick, active = true, size = 'sm' }: Props) {
  const base = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${STATUS_COLORS[status]} ${base} rounded font-medium whitespace-nowrap transition-opacity ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      } ${active ? 'opacity-100' : 'opacity-35 hover:opacity-60'}`}
    >
      {STATUS_LABELS[status]}
    </button>
  )
}
