'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Lead, LeadStatus, STATUS_ORDER } from '@/types/lead'
import StatsBar from './StatsBar'
import FilterBar from './FilterBar'
import LeadsTable from './LeadsTable'
import LeadDrawer from './LeadDrawer'
import AddLeadModal from './AddLeadModal'

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState<LeadStatus | null>(null)
  const [filterKategorie, setFilterKategorie] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

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

  const updateLead = useCallback(async (id: string, updates: Partial<Lead>) => {
    // Optimistic update
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))
    setSelectedLead(prev => prev?.id === id ? { ...prev, ...updates } as Lead : prev)

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (!error && data) {
      // Sync with server response (picks up updated_at from trigger)
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ...(data as Lead) } : l))
      setSelectedLead(prev => prev?.id === id ? { ...prev, ...(data as Lead) } : prev)
    }
  }, [])

  const cycleStatus = useCallback((lead: Lead) => {
    const idx = STATUS_ORDER.indexOf(lead.status)
    const nextStatus = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]
    updateLead(lead.id, { status: nextStatus })
  }, [updateLead])

  const markAsCalled = useCallback((lead: Lead) => {
    const updates: Partial<Lead> = { last_called_at: new Date().toISOString() }
    if (lead.status === 'novy') updates.status = 'zavolano'
    updateLead(lead.id, updates)
  }, [updateLead])

  const kategorien = Array.from(new Set(leads.map(l => l.kategorie))).sort()

  const filteredLeads = leads.filter(lead => {
    if (filterStatus && lead.status !== filterStatus) return false
    if (filterKategorie && lead.kategorie !== filterKategorie) return false
    if (searchQuery) {
      const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      const q = norm(searchQuery)
      if (!norm(lead.nazev).includes(q) && !norm(lead.mesto).includes(q) && !norm(lead.telefon ?? '').includes(q)) return false
    }
    return true
  })

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100">
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-[#0f0f0f]/80 backdrop-blur border-b border-zinc-800 px-5 py-3.5 flex items-center justify-between">
        <h1 className="text-sm font-semibold tracking-tight text-zinc-100">CRM — Leady</h1>
        <div className="flex items-center gap-3">
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
            className="text-zinc-600 hover:text-zinc-300 transition-colors p-1 rounded"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
              <path d="M3 22v-6h6"/>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
          </button>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-6 space-y-5 max-w-[1600px] mx-auto">
        <StatsBar leads={leads} />

        <FilterBar
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterKategorie={filterKategorie}
          setFilterKategorie={setFilterKategorie}
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
              {filteredLeads.length} {filteredLeads.length === 1 ? 'lead' : filteredLeads.length < 5 ? 'leady' : 'leadů'}
              {leads.length !== filteredLeads.length && ` z ${leads.length}`}
            </p>
            <LeadsTable
              leads={filteredLeads}
              onCycleStatus={cycleStatus}
              onSelectLead={setSelectedLead}
            />
          </>
        )}
      </main>

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
        />
      )}
    </div>
  )
}
