'use client'

import { useState } from 'react'
import { Lead, LeadStatus, STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from '@/types/lead'

interface Props {
  leads: Lead[]
  onSelectLead: (lead: Lead) => void
  onSetStatus: (lead: Lead, status: LeadStatus) => void
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
  onDragStart,
  onDragEnd,
  dragging,
}: {
  lead: Lead
  onSelect: () => void
  onDragStart: () => void
  onDragEnd: () => void
  dragging: boolean
}) {
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragEnd={onDragEnd}
      className={`bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-1.5 cursor-grab active:cursor-grabbing hover:border-zinc-600 transition-colors ${
        dragging ? 'opacity-40' : ''
      }`}
      onClick={onSelect}
    >
      <div className="font-medium text-sm text-zinc-100 leading-snug">{lead.nazev}</div>
      <div className="text-xs text-zinc-500">{lead.mesto}</div>
      {lead.telefon && (
        <div className="text-xs text-zinc-500">{lead.telefon}</div>
      )}
      {lead.next_action && (
        <div className="text-xs text-blue-400 truncate" title={lead.next_action}>
          <span className="text-blue-600 mr-0.5">→</span>{lead.next_action}
        </div>
      )}
      {lead.follow_up_at && (
        <div className={`text-xs font-medium ${isDue(lead.follow_up_at) ? 'text-amber-400' : 'text-zinc-600'}`}>
          {new Date(lead.follow_up_at).toLocaleDateString('cs-CZ')}
        </div>
      )}
      {lead.rating != null && (
        <div className="text-xs text-zinc-600 pt-0.5">★ {lead.rating}</div>
      )}
    </div>
  )
}

export default function KanbanView({ leads, onSelectLead, onSetStatus }: Props) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<LeadStatus | null>(null)

  const byStatus = Object.fromEntries(
    STATUS_ORDER.map(s => [s, leads.filter(l => l.status === s)])
  ) as Record<LeadStatus, Lead[]>

  const dragLead = leads.find(l => l.id === dragId) ?? null

  const handleDrop = (status: LeadStatus) => {
    if (dragLead && dragLead.status !== status) onSetStatus(dragLead, status)
    setDragId(null)
    setDragOver(null)
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[400px]">
      {STATUS_ORDER.map(status => {
        const isTarget = dragOver === status && dragLead?.status !== status
        return (
          <div
            key={status}
            className="shrink-0 w-56"
            onDragOver={e => { if (dragLead) { e.preventDefault(); setDragOver(status) } }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(prev => prev === status ? null : prev) }}
            onDrop={e => { e.preventDefault(); handleDrop(status) }}
          >
            <div className={`${STATUS_COLORS[status]} flex items-center justify-between px-3 py-2 rounded-t text-xs font-semibold`}>
              <span>{STATUS_LABELS[status]}</span>
              <span className="opacity-60">{byStatus[status].length}</span>
            </div>
            <div className={`border border-t-0 rounded-b p-2 space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto transition-colors ${
              isTarget ? 'bg-zinc-800/60 border-zinc-500' : 'bg-zinc-950 border-zinc-800'
            }`}>
              {byStatus[status].length === 0 && (
                <div className="text-xs text-zinc-700 text-center py-8">
                  {isTarget ? 'Pustit sem' : 'Prázdné'}
                </div>
              )}
              {byStatus[status].map(lead => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  dragging={dragId === lead.id}
                  onSelect={() => onSelectLead(lead)}
                  onDragStart={() => setDragId(lead.id)}
                  onDragEnd={() => { setDragId(null); setDragOver(null) }}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
