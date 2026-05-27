'use client'

import { Lead, LeadStatus, STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from '@/types/lead'

interface Props {
  leads: Lead[]
  onSelectLead: (lead: Lead) => void
  onCycleStatus: (lead: Lead) => void
}

function isDue(dateStr: string | null): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)
  return d <= todayEnd
}

function LeadCard({
  lead,
  onSelect,
  onCycleStatus,
}: {
  lead: Lead
  onSelect: () => void
  onCycleStatus: () => void
}) {
  return (
    <div
      className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-1.5 cursor-pointer hover:border-zinc-600 transition-colors"
      onClick={onSelect}
    >
      <div className="font-medium text-sm text-zinc-100 leading-snug">{lead.nazev}</div>
      <div className="text-xs text-zinc-500">{lead.mesto}</div>
      {lead.telefon && (
        <div className="text-xs text-zinc-500">{lead.telefon}</div>
      )}
      {lead.follow_up_at && (
        <div className={`text-xs font-medium ${isDue(lead.follow_up_at) ? 'text-amber-400' : 'text-zinc-600'}`}>
          {new Date(lead.follow_up_at).toLocaleDateString('cs-CZ')}
        </div>
      )}
      <div className="flex items-center justify-between pt-0.5">
        {lead.rating != null
          ? <span className="text-xs text-zinc-600">★ {lead.rating}</span>
          : <span />
        }
        <button
          onClick={e => { e.stopPropagation(); onCycleStatus() }}
          title="Přesunout na další status"
          className="text-zinc-700 hover:text-zinc-400 transition-colors text-xs px-1"
        >
          →
        </button>
      </div>
    </div>
  )
}

export default function KanbanView({ leads, onSelectLead, onCycleStatus }: Props) {
  const byStatus = Object.fromEntries(
    STATUS_ORDER.map(s => [s, leads.filter(l => l.status === s)])
  ) as Record<LeadStatus, Lead[]>

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[400px]">
      {STATUS_ORDER.map(status => (
        <div key={status} className="shrink-0 w-56">
          <div className={`${STATUS_COLORS[status]} flex items-center justify-between px-3 py-2 rounded-t text-xs font-semibold`}>
            <span>{STATUS_LABELS[status]}</span>
            <span className="opacity-60">{byStatus[status].length}</span>
          </div>
          <div className="bg-zinc-950 border border-t-0 border-zinc-800 rounded-b p-2 space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
            {byStatus[status].length === 0 && (
              <div className="text-xs text-zinc-700 text-center py-8">Prázdné</div>
            )}
            {byStatus[status].map(lead => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onSelect={() => onSelectLead(lead)}
                onCycleStatus={() => onCycleStatus(lead)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
