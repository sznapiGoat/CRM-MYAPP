'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ActivityInput, Lead, LeadStatus, STATUS_LABELS, STATUS_ORDER } from '@/types/lead'
import StatsBar from './StatsBar'
import FilterBar from './FilterBar'
import LeadsTable from './LeadsTable'
import LeadDrawer from './LeadDrawer'
import AddLeadModal from './AddLeadModal'
import KanbanView from './KanbanView'
import FunnelChart from './FunnelChart'

type ViewMode = 'table' | 'kanban'

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [showFunnel, setShowFunnel] = useState(false)
  const [filterStatus, setFilterStatus] = useState<LeadStatus | null>(null)
  const [filterKategorie, setFilterKategorie] = useState<string | null>(null)
  const [filterDueToday, setFilterDueToday] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const fetchLeads = useCallback(async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setLeads((data ?? []) as Lead[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const updateLead = useCallback(async (id: string, updates: Partial<Lead>, activity?: ActivityInput) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))
    setSelectedLead(prev => prev?.id === id ? { ...prev, ...updates } as Lead : prev)

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (!error && data) {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ...(data as Lead) } : l))
      setSelectedLead(prev => prev?.id === id ? { ...prev, ...(data as Lead) } : prev)
    }

    if (activity) {
      await supabase.from('lead_activities').insert({ lead_id: id, ...activity })
    }
  }, [])

  const cycleStatus = useCallback((lead: Lead) => {
    const idx = STATUS_ORDER.indexOf(lead.status)
    const nextStatus = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]
    updateLead(lead.id, { status: nextStatus }, {
      type: 'status_change',
      old_status: lead.status,
      new_status: nextStatus,
    })
  }, [updateLead])

  const markAsCalled = useCallback(async (lead: Lead) => {
    const updates: Partial<Lead> = { last_called_at: new Date().toISOString() }
    if (lead.status === 'novy') updates.status = 'zavolano'
    await updateLead(lead.id, updates)
    await supabase.from('lead_activities').insert({ lead_id: lead.id, type: 'called' })
  }, [updateLead])

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
      if (!norm(lead.nazev).includes(q) && !norm(lead.mesto).includes(q) && !norm(lead.telefon ?? '').includes(q)) return false
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
    setLeads(prev => prev.map(l => selectedIds.has(l.id) ? { ...l, status } : l))
    setSelectedIds(new Set())
    await supabase.from('leads').update({ status }).in('id', ids)
  }, [selectedIds])

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds)
    const label = `${ids.length} lead${ids.length === 1 ? '' : 'ů'}`
    if (!window.confirm(`Smazat ${label}? Tato akce je nevratná.`)) return
    setLeads(prev => prev.filter(l => !selectedIds.has(l.id)))
    if (selectedLead && selectedIds.has(selectedLead.id)) setSelectedLead(null)
    setSelectedIds(new Set())
    await supabase.from('leads').delete().in('id', ids)
  }, [selectedIds, selectedLead])

  function exportCSV() {
    const headers = ['Název','Město','Telefon','Adresa','Web','Kategorie','Status','Důvod','Poznámka','Rating','Vytvořeno','Zavoláno','Sledování']
    const rows = filteredLeads.map(l => [
      l.nazev, l.mesto, l.telefon, l.adresa, l.web ?? '',
      l.kategorie, STATUS_LABELS[l.status], l.duvod, l.poznamka ?? '',
      l.rating ?? '', l.created_at, l.last_called_at ?? '', l.follow_up_at ?? '',
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

  const leadCount = filteredLeads.length
  const countLabel = leadCount === 1 ? 'lead' : leadCount < 5 ? 'leady' : 'leadů'

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100">
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-[#0f0f0f]/80 backdrop-blur border-b border-zinc-800 px-5 py-3.5 flex items-center justify-between gap-3">
        <h1 className="text-sm font-semibold tracking-tight text-zinc-100 shrink-0">CRM — Leady</h1>

        <div className="flex items-center gap-2 ml-auto">
          {/* View toggle */}
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
            title="Funnel"
            className={`px-2.5 py-1.5 rounded border text-xs transition-colors ${showFunnel ? 'bg-zinc-700 border-zinc-600 text-zinc-100' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M22 3H2l8 9.46V19l4 2V12.46z"/>
            </svg>
          </button>

          {/* CSV export */}
          <button
            onClick={exportCSV}
            title="Export CSV"
            className="px-2.5 py-1.5 rounded border border-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-zinc-100 hover:bg-white text-zinc-900 rounded px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Přidat lead
          </button>

          <button
            onClick={fetchLeads}
            title="Obnovit"
            className="text-zinc-600 hover:text-zinc-300 transition-colors p-1.5 rounded"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
              <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
          </button>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-6 space-y-5 max-w-[1600px] mx-auto">
        <StatsBar leads={leads} />

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

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded px-4 py-3 text-sm">
            Chyba: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <p className="text-xs text-zinc-600">
              {leadCount} {countLabel}
              {leads.length !== leadCount && ` z ${leads.length}`}
            </p>

            {viewMode === 'table' ? (
              <LeadsTable
                leads={filteredLeads}
                onCycleStatus={cycleStatus}
                onSelectLead={setSelectedLead}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onToggleAll={handleToggleAll}
              />
            ) : (
              <KanbanView
                leads={filteredLeads}
                onSelectLead={setSelectedLead}
                onCycleStatus={cycleStatus}
              />
            )}
          </>
        )}
      </main>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-zinc-900 border border-zinc-700 rounded-xl px-5 py-3 flex items-center gap-4 shadow-2xl">
          <span className="text-sm text-zinc-300 font-medium shrink-0">
            {selectedIds.size} vybraných
          </span>
          <select
            defaultValue=""
            onChange={e => { if (e.target.value) { handleBulkStatus(e.target.value as LeadStatus); e.target.value = '' } }}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none"
          >
            <option value="" disabled>Změnit status…</option>
            {STATUS_ORDER.map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <button
            onClick={handleBulkDelete}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Smazat
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Zrušit
          </button>
        </div>
      )}

      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={updateLead}
          onMarkAsCalled={markAsCalled}
        />
      )}

      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onAdded={fetchLeads}
          existingLeads={leads}
        />
      )}
    </div>
  )
}
