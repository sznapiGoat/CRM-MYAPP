'use client'

import { LeadStatus, STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from '@/types/lead'
import type { RatingFilter, WebFilter } from './Dashboard'

interface Props {
  filterStatus: LeadStatus | null
  setFilterStatus: (s: LeadStatus | null) => void
  filterKategorie: string | null
  setFilterKategorie: (k: string | null) => void
  filterDuvod: string | null
  setFilterDuvod: (d: string | null) => void
  filterWeb: WebFilter
  setFilterWeb: (w: WebFilter) => void
  minRating: RatingFilter
  setMinRating: (r: RatingFilter) => void
  minReviews: number | null
  setMinReviews: (n: number | null) => void
  filterDueToday: boolean
  setFilterDueToday: (v: boolean) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  kategorien: string[]
  duvody: string[]
  onBestLeads: () => void
  bestActive: boolean
}

export default function FilterBar({
  filterStatus,
  setFilterStatus,
  filterKategorie,
  setFilterKategorie,
  filterDuvod,
  setFilterDuvod,
  filterWeb,
  setFilterWeb,
  minRating,
  setMinRating,
  minReviews,
  setMinReviews,
  filterDueToday,
  setFilterDueToday,
  searchQuery,
  setSearchQuery,
  kategorien,
  duvody,
  onBestLeads,
  bestActive,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex gap-3 flex-wrap">
        <input
          id="lead-search"
          type="search"
          placeholder="Hledat název nebo město…  ( / )"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[200px] bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-600 transition-colors"
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
        <select
          value={filterDuvod ?? ''}
          onChange={e => setFilterDuvod(e.target.value || null)}
          className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors"
        >
          <option value="">Všechny důvody</option>
          {duvody.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          value={filterWeb ?? ''}
          onChange={e => setFilterWeb((e.target.value || null) as WebFilter)}
          title="Má lead existující web (redesign), nebo se dělá od nuly?"
          className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors"
        >
          <option value="">Web: vše</option>
          <option value="ma">Má web (redesign)</option>
          <option value="bez">Bez webu (od nuly)</option>
        </select>
        <select
          value={minRating === null ? '' : String(minRating)}
          onChange={e => {
            const v = e.target.value
            setMinRating(v === '' ? null : v === 'none' ? 'none' : Number(v))
          }}
          title="Hodnocení na Google"
          className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors"
        >
          <option value="">Hodnocení: vše</option>
          <option value="4.5">★ 4,5+</option>
          <option value="4">★ 4,0+</option>
          <option value="3.5">★ 3,5+</option>
          <option value="3">★ 3,0+</option>
          <option value="none">Bez hodnocení</option>
        </select>
        <select
          value={minReviews ?? ''}
          onChange={e => setMinReviews(e.target.value ? Number(e.target.value) : null)}
          title="Minimální počet recenzí na Google"
          className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors"
        >
          <option value="">Recenzí: vše</option>
          <option value="50">50+ recenzí</option>
          <option value="20">20+ recenzí</option>
          <option value="10">10+ recenzí</option>
          <option value="1">Aspoň 1 recenze</option>
        </select>
        <button
          onClick={onBestLeads}
          title="Leady s existujícím webem na redesign a dobrým hodnocením na Google, seřazeno podle skóre"
          className={`px-3 py-2 rounded text-xs font-medium transition-colors whitespace-nowrap ${
            bestActive
              ? 'bg-indigo-900/60 text-indigo-200 border border-indigo-600'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-200'
          }`}
        >
          ★ Nejlepší leady
        </button>
        <button
          onClick={() => setFilterDueToday(!filterDueToday)}
          className={`px-3 py-2 rounded text-xs font-medium transition-colors whitespace-nowrap ${
            filterDueToday
              ? 'bg-amber-900/60 text-amber-200 border border-amber-700'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-200'
          }`}
        >
          Sledovat dnes
        </button>
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
