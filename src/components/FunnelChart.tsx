'use client'

import { Lead, LeadStatus, STATUS_LABELS, STATUS_ORDER } from '@/types/lead'

interface Props {
  leads: Lead[]
}

const FUNNEL_STAGES: LeadStatus[] = ['novy', 'zavolano', 'zajem', 'demo_poslano', 'ceka', 'zavreno']

const STAGE_COLORS: Record<LeadStatus, string> = {
  novy:         'bg-zinc-500',
  zavolano:     'bg-blue-600',
  zajem:        'bg-yellow-600',
  demo_poslano: 'bg-purple-600',
  ceka:         'bg-orange-600',
  zavreno:      'bg-green-600',
  nezajem:      'bg-red-800',
}

export default function FunnelChart({ leads }: Props) {
  const counts = Object.fromEntries(
    STATUS_ORDER.map(s => [s, leads.filter(l => l.status === s).length])
  ) as Record<LeadStatus, number>

  const total = leads.length
  const max = Math.max(...FUNNEL_STAGES.map(s => counts[s]), 1)
  const nezajem = counts['nezajem']

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Funnel</h3>
        <span className="text-xs text-zinc-600">{total} leadů celkem</span>
      </div>
      <div className="space-y-2">
        {FUNNEL_STAGES.map((s, i) => {
          const count = counts[s]
          const prev = i > 0 ? counts[FUNNEL_STAGES[i - 1]] : null
          const pct = prev && prev > 0 ? Math.round((count / prev) * 100) : null
          const barW = max > 0 ? Math.max((count / max) * 100, count > 0 ? 2 : 0) : 0

          return (
            <div key={s} className="flex items-center gap-3">
              <div className="w-24 shrink-0 text-xs text-zinc-500 text-right">{STATUS_LABELS[s]}</div>
              <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
                <div
                  className={`h-full ${STAGE_COLORS[s]} rounded transition-all duration-500`}
                  style={{ width: `${barW}%` }}
                />
              </div>
              <div className="w-6 text-xs text-zinc-300 tabular-nums text-right">{count}</div>
              <div className={`w-12 text-xs tabular-nums text-right ${
                pct === null ? 'text-transparent' :
                pct >= 60 ? 'text-green-500' :
                pct >= 30 ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {pct !== null ? `${pct}%` : ''}
              </div>
            </div>
          )
        })}

        {nezajem > 0 && (
          <div className="flex items-center gap-3 pt-2 border-t border-zinc-800 mt-1">
            <div className="w-24 shrink-0 text-xs text-zinc-500 text-right">Nezájem</div>
            <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
              <div
                className="h-full bg-red-900 rounded transition-all duration-500"
                style={{ width: `${Math.max((nezajem / max) * 100, 2)}%` }}
              />
            </div>
            <div className="w-6 text-xs text-zinc-300 tabular-nums text-right">{nezajem}</div>
            <div className="w-12 text-xs text-zinc-500 tabular-nums text-right">
              {total > 0 ? `${Math.round((nezajem / total) * 100)}%` : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
