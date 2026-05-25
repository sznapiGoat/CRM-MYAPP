'use client'

import { LeadStatus, STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from '@/types/lead'

interface Props {
  filterStatus: LeadStatus | null
  setFilterStatus: (s: LeadStatus | null) => void
  filterKategorie: string | null
  setFilterKategorie: (k: string | null) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  kategorien: string[]
}

export default function FilterBar({
  filterStatus,
  setFilterStatus,
  filterKategorie,
  setFilterKategorie,
  searchQuery,
  setSearchQuery,
  kategorien,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex gap-3 flex-wrap">
        <input
          type="search"
          placeholder="Hledat název nebo město…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[200px] bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
        />
        <select
          value={filterKategorie ?? ''}
          onChange={e => setFilterKategorie(e.target.value || null)}
          className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors"
        >
          <option value="">Všechny kategorie</option>
          {kategorien.map(k => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterStatus(null)}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            filterStatus === null
              ? 'bg-zinc-600 text-zinc-100'
              : 'bg-zinc-800 text-zinc-500 hover:text-zinc-200'
          }`}
        >
          Vše
        </button>
        {STATUS_ORDER.map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? null : s)}
            className={`${STATUS_COLORS[s]} px-3 py-1 rounded text-xs font-medium transition-opacity ${
              filterStatus === s ? 'opacity-100' : 'opacity-35 hover:opacity-70'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  )
}
