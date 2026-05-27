'use client'

import { Lead } from '@/types/lead'
import StatusPill from './StatusPill'

interface Props {
  leads: Lead[]
  onCycleStatus: (lead: Lead) => void
  onSelectLead: (lead: Lead) => void
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleAll: () => void
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('cs-CZ')
}

function trunc(s: string | null, n: number) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}

function isDue(dateStr: string | null): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)
  return d <= todayEnd
}

export default function LeadsTable({
  leads,
  onCycleStatus,
  onSelectLead,
  selectedIds,
  onToggleSelect,
  onToggleAll,
}: Props) {
  if (leads.length === 0) {
    return (
      <div className="text-center text-zinc-600 py-20 text-sm">
        Žádné leady nenalezeny.
      </div>
    )
  }

  const allSelected = leads.length > 0 && leads.every(l => selectedIds.has(l.id))

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full text-sm min-w-[1060px]">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
            <th className="px-4 py-3 text-left w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                className="rounded border-zinc-600 bg-zinc-800 accent-zinc-400 cursor-pointer"
              />
            </th>
            {['Status','Název','Město','Telefon','Web','Důvod','Rating','Sledování','Přidáno','Poznámka'].map(h => (
              <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => {
            const due = isDue(lead.follow_up_at)
            const isSelected = selectedIds.has(lead.id)
            return (
              <tr
                key={lead.id}
                className={`border-b border-zinc-800/50 transition-colors ${
                  isSelected
                    ? 'bg-zinc-800/50'
                    : due
                    ? 'bg-amber-950/20 hover:bg-amber-950/30'
                    : 'hover:bg-zinc-900/60'
                }`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(lead.id)}
                    onClick={e => e.stopPropagation()}
                    className="rounded border-zinc-600 bg-zinc-800 accent-zinc-400 cursor-pointer"
                  />
                </td>

                <td className="px-4 py-3">
                  <StatusPill status={lead.status} onClick={() => onCycleStatus(lead)} />
                </td>

                <td className="px-4 py-3">
                  <button
                    onClick={() => onSelectLead(lead)}
                    className="font-medium text-left hover:underline underline-offset-2 text-zinc-100"
                  >
                    {lead.nazev}
                  </button>
                </td>

                <td className="px-4 py-3 text-zinc-400">{lead.mesto}</td>

                <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{lead.telefon}</td>

                <td className="px-4 py-3">
                  {lead.web ? (
                    <a
                      href={lead.web}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={lead.web}
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                      onClick={e => e.stopPropagation()}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </a>
                  ) : (
                    <span className="text-zinc-700">—</span>
                  )}
                </td>

                <td className="px-4 py-3 text-zinc-400">
                  <span title={lead.duvod}>{trunc(lead.duvod, 30)}</span>
                </td>

                <td className="px-4 py-3 text-zinc-400">
                  {lead.rating != null ? `★ ${lead.rating}` : '—'}
                </td>

                <td className="px-4 py-3 whitespace-nowrap">
                  {lead.follow_up_at ? (
                    <span className={`text-xs font-medium ${due ? 'text-amber-400' : 'text-zinc-500'}`}>
                      {fmtDate(lead.follow_up_at)}
                    </span>
                  ) : (
                    <span className="text-zinc-700">—</span>
                  )}
                </td>

                <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                  {fmtDate(lead.created_at)}
                </td>

                <td className="px-4 py-3 text-zinc-500 max-w-[180px]">
                  <span title={lead.poznamka ?? ''} className="block truncate">
                    {trunc(lead.poznamka, 40)}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
