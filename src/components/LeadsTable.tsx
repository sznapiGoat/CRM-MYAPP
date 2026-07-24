'use client'

import { Lead, LeadStatus } from '@/types/lead'
import type { SortKey, SortState } from './Dashboard'
import StatusMenu from './StatusMenu'

interface Props {
  leads: Lead[]
  onSetStatus: (lead: Lead, status: LeadStatus) => void
  onSelectLead: (lead: Lead) => void
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleAll: () => void
  sort: SortState
  onSort: (key: SortKey) => void
}

// Column header definitions — `key` present => sortable.
const COLUMNS: { label: string; key?: SortKey }[] = [
  { label: 'Status' },
  { label: 'Název', key: 'nazev' },
  { label: 'Město', key: 'mesto' },
  { label: 'Telefon' },
  { label: 'Web' },
  { label: 'Důvod' },
  { label: 'Rating', key: 'rating' },
  { label: 'Sledování', key: 'follow_up_at' },
  { label: 'Přidáno', key: 'created_at' },
  { label: 'Poznámka' },
]

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
  onSetStatus,
  onSelectLead,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  sort,
  onSort,
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
            {COLUMNS.map(col => {
              const active = col.key && sort?.key === col.key
              return (
                <th key={col.label} className="px-4 py-3 text-left font-medium">
                  {col.key ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.key!)}
                      className={`flex items-center gap-1 uppercase tracking-wide transition-colors ${
                        active ? 'text-zinc-200' : 'hover:text-zinc-300'
                      }`}
                    >
                      {col.label}
                      <span className="text-[9px] leading-none">
                        {active ? (sort!.dir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => {
            const due = isDue(lead.follow_up_at)
            const isSelected = selectedIds.has(lead.id)
            return (
              <tr
                key={lead.id}
                onClick={() => onSelectLead(lead)}
                className={`border-b border-zinc-800/50 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-800/50'
                    : due
                    ? 'bg-amber-950/20 hover:bg-amber-950/30'
                    : 'hover:bg-zinc-900/60'
                }`}
              >
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(lead.id)}
                    className="rounded border-zinc-600 bg-zinc-800 accent-zinc-400 cursor-pointer"
                  />
                </td>

                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <StatusMenu status={lead.status} onSelect={s => onSetStatus(lead, s)} />
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-zinc-100 hover:underline underline-offset-2">{lead.nazev}</span>
                    {lead.next_action && (
                      <span title={lead.next_action} className="text-blue-500 shrink-0 opacity-70">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-3 text-zinc-400">{lead.mesto}</td>

                <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{lead.telefon}</td>

                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  {lead.web ? (
                    <a
                      href={lead.web}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={lead.web}
                      className="text-blue-400 hover:text-blue-300 transition-colors"
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
