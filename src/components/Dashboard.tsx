'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useQuery } from 'convex/react'
import Link from 'next/link'
import * as db from '@/lib/db'
import { api } from '../../convex/_generated/api'
import { ActivityInput, Lead, LeadStatus, STATUS_LABELS, STATUS_ORDER } from '@/types/lead'
import StatsBar from './StatsBar'
import FilterBar from './FilterBar'
import LeadsTable from './LeadsTable'
import LeadDrawer from './LeadDrawer'
import AddLeadModal from './AddLeadModal'
import KanbanView from './KanbanView'
import FunnelChart from './FunnelChart'
import ImportModal from './ImportModal'
import UndoToast from './UndoToast'

type ViewMode = 'table' | 'kanban'

export type SortKey = 'nazev' | 'mesto' | 'rating' | 'follow_up_at' | 'created_at'
export type SortState = { key: SortKey; dir: 'asc' | 'desc' } | null

const stripDia = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function sortLeads(list: Lead[], sort: SortState): Lead[] {
  if (!sort) return list
  const dir = sort.dir === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    switch (sort.key) {
      case 'rating':
        return ((a.rating ?? -Infinity) - (b.rating ?? -Infinity)) * dir
      case 'follow_up_at':
        return (a.follow_up_at ?? '').localeCompare(b.follow_up_at ?? '') * dir
      case 'created_at':
        return a.created_at.localeCompare(b.created_at) * dir
      default:
        return stripDia(String(a[sort.key] ?? '')).localeCompare(stripDia(String(b[sort.key] ?? ''))) * dir
    }
  })
}

export default function Dashboard() {
  // Live, reactive lead list — updates in real time across tabs/devices.
  const leadsData = useQuery(api.leads.list) as Lead[] | undefined
  const loading = leadsData === undefined
  const leads = useMemo(() => leadsData ?? [], [leadsData])

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [showFunnel, setShowFunnel] = useState(false)
  const [filterStatus, setFilterStatus] = useState<LeadStatus | null>(null)
  const [filterKategorie, setFilterKategorie] = useState<string | null>(null)
  const [filterDueToday, setFilterDueToday] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkKat, setBulkKat]   = useState('')
  const [bulkDate, setBulkDate] = useState('')
  const [sort, setSort] = useState<SortState>(null)
  const [undo, setUndo] = useState<{ id: number; message: string; undo: () => void } | null>(null)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const undoSeq = useRef(0)

  const showUndo = useCallback((message: string, undoFn: () => void) => {
    setUndo({ id: ++undoSeq.current, message, undo: undoFn })
  }, [])

  const runUndo = useCallback(() => {
    undo?.undo()
    setUndo(null)
  }, [undo])

  const toggleSort = useCallback((key: SortKey) => {
    setSort(prev => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }, [])

  const selectedLead = useMemo(
    () => leads.find(l => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId],
  )

  // Mutations no longer touch local state — the reactive `leads` query above
  // reflects server changes automatically.
  const updateLead = useCallback(async (id: string, updates: Partial<Lead>, activity?: ActivityInput) => {
    await db.updateLead(id, updates)
    if (activity) {
      await db.insertActivity(id, activity)
    }
  }, [])

  const changeStatus = useCallback((lead: Lead, status: LeadStatus) => {
    if (status === lead.status) return
    const prevStatus = lead.status
    updateLead(lead.id, { status }, {
      type: 'status_change',
      old_status: prevStatus,
      new_status: status,
    })
    showUndo(`Přesunuto na „${STATUS_LABELS[status]}"`, () => {
      updateLead(lead.id, { status: prevStatus }, {
        type: 'status_change',
        old_status: status,
        new_status: prevStatus,
      })
    })
  }, [updateLead, showUndo])

  const setStatus = useCallback((lead: Lead, status: LeadStatus) => {
    changeStatus(lead, status)
  }, [changeStatus])

  const markAsCalled = useCallback(async (lead: Lead) => {
    const prevStatus = lead.status
    const prevCalled = lead.last_called_at
    const updates: Partial<Lead> = { last_called_at: new Date().toISOString() }
    if (lead.status === 'novy') updates.status = 'zavolano'
    await updateLead(lead.id, updates)
    await db.insertActivity(lead.id, { type: 'called' })
    showUndo('Označeno jako zavoláno', () => {
      updateLead(lead.id, { last_called_at: prevCalled, status: prevStatus })
    })
  }, [updateLead, showUndo])

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const kategorien = Array.from(new Set(leads.map(l => l.kategorie))).sort()

  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  const filteredLeads = leads.filter(lead => {
    if (hiddenIds.has(lead.id)) return false
    if (filterStatus && lead.status !== filterStatus) return false
    if (filterKategorie && lead.kategorie !== filterKategorie) return false
    if (filterDueToday) {
      if (!lead.follow_up_at) return false
      const d = new Date(lead.follow_up_at)
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)
      if (d > todayEnd) return false
    }
    if (searchQuery) {
      const q = norm(searchQuery)
      if (
        !norm(lead.nazev).includes(q) &&
        !norm(lead.mesto).includes(q) &&
        !norm(lead.telefon ?? '').includes(q) &&
        !norm(lead.kategorie).includes(q) &&
        !norm(lead.duvod).includes(q) &&
        !norm(lead.poznamka ?? '').includes(q)
      ) return false
    }
    return true
  })

  const handleToggleAll = useCallback(() => {
    setSelectedIds(prev => {
      if (filteredLeads.every(l => prev.has(l.id))) return new Set()
      return new Set(filteredLeads.map(l => l.id))
    })
  }, [filteredLeads])

  const handleBulkStatus = useCallback(async (status: LeadStatus) => {
    const ids = Array.from(selectedIds)
    setSelectedIds(new Set())
    await db.bulkUpdateLeads(ids, { status })
  }, [selectedIds])

  const unhide = useCallback((ids: string[]) => {
    setHiddenIds(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.delete(id))
      return next
    })
  }, [])

  // Deferred delete: hide immediately, commit to the server after the undo
  // window elapses. Undo cancels the commit and restores the rows.
  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setSelectedIds(new Set())
    setHiddenIds(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.add(id))
      return next
    })

    const timeoutId = setTimeout(async () => {
      await db.bulkDeleteLeads(ids)
      unhide(ids)
    }, 6000)

    const label = ids.length === 1 ? 'lead' : ids.length < 5 ? 'leady' : 'leadů'
    showUndo(`Smazáno ${ids.length} ${label}`, () => {
      clearTimeout(timeoutId)
      unhide(ids)
    })
  }, [selectedIds, showUndo, unhide])

  const handleBulkKategorie = useCallback(async (kategorie: string) => {
    if (!kategorie.trim()) return
    const ids = Array.from(selectedIds)
    setSelectedIds(new Set())
    await db.bulkUpdateLeads(ids, { kategorie: kategorie.trim() })
  }, [selectedIds])

  const handleBulkFollowUp = useCallback(async (date: string) => {
    const value = date ? new Date(date + 'T12:00:00').toISOString() : null
    const ids = Array.from(selectedIds)
    setSelectedIds(new Set())
    await db.bulkUpdateLeads(ids, { follow_up_at: value })
  }, [selectedIds])

  function exportLeadsCSV(leadsToExport: typeof leads) {
    const headers = ['Název','Město','Telefon','Adresa','Web','Kategorie','Status','Důvod','Poznámka','Rating','Vytvořeno','Zavoláno','Sledování','Další krok']
    const rows = leadsToExport.map(l => [
      l.nazev, l.mesto, l.telefon, l.adresa, l.web ?? '',
      l.kategorie, STATUS_LABELS[l.status], l.duvod, l.poznamka ?? '',
      l.rating ?? '', l.created_at, l.last_called_at ?? '', l.follow_up_at ?? '',
      l.next_action ?? '',
    ])
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leady-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportCSV() { exportLeadsCSV(filteredLeads) }

  const handleBulkExportCSV = useCallback(() => {
    exportLeadsCSV(leads.filter(l => selectedIds.has(l.id)))
    setSelectedIds(new Set())
  }, [selectedIds, leads]) // eslint-disable-line react-hooks/exhaustive-deps

  function escHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function exportPDF() {
    const date = new Date().toLocaleDateString('cs-CZ')
    const rows = filteredLeads.map(l => `
      <tr>
        <td>${escHtml(l.nazev)}</td>
        <td>${escHtml(l.mesto)}</td>
        <td>${escHtml(l.telefon)}</td>
        <td>${STATUS_LABELS[l.status]}</td>
        <td>${escHtml(l.kategorie)}</td>
        <td>${l.duvod ? escHtml(l.duvod.slice(0, 45)) : '—'}</td>
        <td>${l.next_action ? escHtml(l.next_action.slice(0, 45)) : '—'}</td>
        <td>${l.follow_up_at ? new Date(l.follow_up_at).toLocaleDateString('cs-CZ') : '—'}</td>
        <td>${new Date(l.created_at).toLocaleDateString('cs-CZ')}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html>
<html lang="cs"><head><meta charset="UTF-8"><title>CRM Leady</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size:10px; color:#111; padding:16px; }
  h1  { font-size:15px; margin-bottom:3px; }
  .meta { color:#888; font-size:9px; margin-bottom:14px; }
  table { width:100%; border-collapse:collapse; }
  thead tr { background:#1a1a1a; color:#fff; }
  th { padding:5px 7px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:.04em; white-space:nowrap; }
  td { padding:4px 7px; border-bottom:1px solid #e8e8e8; vertical-align:top; }
  tr:nth-child(even) td { background:#f6f6f6; }
  @page { margin:12mm; }
  @media print { body { padding:0; } }
</style></head><body>
<h1>CRM — Leady</h1>
<div class="meta">Export: ${date}&nbsp;·&nbsp;${filteredLeads.length} leadů${leads.length !== filteredLeads.length ? ` z ${leads.length}` : ''}</div>
<table>
<thead><tr>
  <th>Název</th><th>Město</th><th>Telefon</th><th>Status</th>
  <th>Kategorie</th><th>Důvod</th><th>Další krok</th><th>Sledování</th><th>Přidáno</th>
</tr></thead>
<tbody>${rows}</tbody>
</table></body></html>`

    const win = window.open('', '_blank', 'width=920,height=680')
    if (!win) { alert('Povolte popup okna pro export PDF.'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  const displayLeads = sortLeads(filteredLeads, sort)

  const leadCount = filteredLeads.length
  const countLabel = leadCount === 1 ? 'lead' : leadCount < 5 ? 'leady' : 'leadů'

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100">
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-[#0f0f0f]/80 backdrop-blur border-b border-zinc-800 px-5 py-3.5 flex items-center justify-between gap-3">
        <h1 className="text-sm font-semibold tracking-tight text-zinc-100 shrink-0">CRM — Leady</h1>

        <Link
          href="/notes"
          title="Poznámky"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-zinc-800 text-zinc-500 hover:text-zinc-300 text-xs transition-colors shrink-0"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>
          </svg>
          Poznámky
        </Link>

        <div className="flex items-center gap-2 ml-auto">
          {/* View controls group */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              title="Tabulka"
              className={`px-2.5 py-1.5 text-xs transition-colors ${viewMode === 'table' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>
              </svg>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              title="Kanban"
              className={`px-2.5 py-1.5 text-xs transition-colors ${viewMode === 'kanban' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="15" rx="1"/>
              </svg>
            </button>
          </div>

          {/* Funnel toggle */}
          <button
            onClick={() => setShowFunnel(v => !v)}
            title="Zobrazit přehled funnelu"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-medium transition-colors ${showFunnel ? 'bg-zinc-700 border-zinc-600 text-zinc-100' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M22 3H2l8 9.46V19l4 2V12.46z"/>
            </svg>
            Funnel
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-zinc-800" />

          {/* Data transfer group */}
          <button
            onClick={() => setShowImportModal(true)}
            title="Import z Google Sheets / CSV"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-zinc-800 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Import
          </button>

          <button
            onClick={exportCSV}
            title="Export CSV"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-zinc-800 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            CSV
          </button>

          <button
            onClick={exportPDF}
            title="Export PDF"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-zinc-800 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            PDF
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-zinc-800" />

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded px-3 py-1.5 text-xs font-semibold transition-colors shadow-sm shadow-indigo-900/40"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Přidat lead
          </button>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-6 space-y-5 max-w-[1600px] mx-auto">
        <StatsBar
          leads={leads}
          onFilterStatus={s => { setFilterStatus(s); setFilterDueToday(false) }}
          onFilterDueToday={() => { setFilterDueToday(v => !v) }}
        />

        {showFunnel && <FunnelChart leads={leads} />}

        <FilterBar
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterKategorie={filterKategorie}
          setFilterKategorie={setFilterKategorie}
          filterDueToday={filterDueToday}
          setFilterDueToday={setFilterDueToday}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          kategorien={kategorien}
        />

        {loading && (
          <div className="text-center text-zinc-600 py-20 text-sm">Načítám…</div>
        )}

        {!loading && (
          <>
            <p className="text-xs text-zinc-600">
              {leadCount} {countLabel}
              {leads.length !== leadCount && ` z ${leads.length}`}
            </p>

            {viewMode === 'table' ? (
              <LeadsTable
                leads={displayLeads}
                onSetStatus={setStatus}
                onSelectLead={l => setSelectedLeadId(l.id)}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onToggleAll={handleToggleAll}
                sort={sort}
                onSort={toggleSort}
              />
            ) : (
              <KanbanView
                leads={filteredLeads}
                onSelectLead={l => setSelectedLeadId(l.id)}
                onSetStatus={setStatus}
              />
            )}
          </>
        )}
      </main>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl flex-wrap max-w-[92vw]">
          <span className="text-sm text-zinc-300 font-medium shrink-0">{selectedIds.size} vybraných</span>

          <div className="w-px h-4 bg-zinc-700 shrink-0" />

          <select
            defaultValue=""
            onChange={e => { if (e.target.value) { handleBulkStatus(e.target.value as LeadStatus); e.target.value = '' } }}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none"
          >
            <option value="" disabled>Status…</option>
            {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>

          <input
            value={bulkKat}
            onChange={e => setBulkKat(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && bulkKat.trim()) { handleBulkKategorie(bulkKat); setBulkKat('') } }}
            list="bulk-kat-list"
            placeholder="Kategorie + Enter"
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none w-36 placeholder:text-zinc-600"
          />
          <datalist id="bulk-kat-list">
            {kategorien.map(k => <option key={k} value={k} />)}
          </datalist>

          <input
            type="date"
            value={bulkDate}
            title="Nastavit datum sledování"
            onChange={e => { setBulkDate(e.target.value); if (e.target.value) { handleBulkFollowUp(e.target.value); setBulkDate('') } }}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none [color-scheme:dark]"
          />

          <div className="w-px h-4 bg-zinc-700 shrink-0" />

          <button
            onClick={handleBulkExportCSV}
            title="Export vybraných do CSV"
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            CSV
          </button>

          <button onClick={handleBulkDelete} className="text-xs text-red-400 hover:text-red-300 transition-colors">Smazat</button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Zrušit</button>
        </div>
      )}

      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLeadId(null)}
          onUpdate={updateLead}
          onMarkAsCalled={markAsCalled}
        />
      )}

      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => {}}
          existingLeads={leads}
        />
      )}

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImported={() => {}}
          existingLeads={leads}
        />
      )}

      {undo && (
        <UndoToast
          key={undo.id}
          message={undo.message}
          onUndo={runUndo}
          onDismiss={() => setUndo(null)}
        />
      )}
    </div>
  )
}
