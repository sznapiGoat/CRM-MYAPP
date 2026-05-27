'use client'

import { useEffect, useRef, useState } from 'react'
import { ActivityInput, Lead, LeadStatus, STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from '@/types/lead'
import ActivityLog from './ActivityLog'

interface Props {
  lead: Lead
  onClose: () => void
  onUpdate: (id: string, updates: Partial<Lead>, activity?: ActivityInput) => Promise<void>
  onMarkAsCalled: (lead: Lead) => Promise<void>
}

function fmtDateTime(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('cs-CZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function isDue(dateStr: string | null): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)
  return d <= todayEnd
}

export default function LeadDrawer({ lead, onClose, onUpdate, onMarkAsCalled }: Props) {
  const [visible, setVisible] = useState(false)
  const [poznamka, setPoznamka] = useState(lead.poznamka ?? '')
  const [tab, setTab] = useState<'detail' | 'historie'>('detail')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    setPoznamka(lead.poznamka ?? '')
  }, [lead.id, lead.poznamka])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 260)
  }

  function handlePoznamkaBlur() {
    const value = poznamka.trim() || null
    if (value !== (lead.poznamka ?? null)) {
      onUpdate(
        lead.id,
        { poznamka: value },
        value ? { type: 'note', note: value } : undefined,
      )
    }
  }

  function setStatus(s: LeadStatus) {
    if (s !== lead.status) {
      onUpdate(lead.id, { status: s }, {
        type: 'status_change',
        old_status: lead.status,
        new_status: s,
      })
    }
  }

  function handleFollowUpChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const value = raw ? new Date(raw + 'T12:00:00').toISOString() : null
    onUpdate(lead.id, { follow_up_at: value })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-[260ms] ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-[480px] bg-[#141414] border-l border-zinc-800 z-50 flex flex-col transition-transform duration-[260ms] ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-zinc-800 shrink-0">
          <div className="pr-4 min-w-0">
            <h2 className="text-base font-semibold leading-tight truncate">{lead.nazev}</h2>
            <p className="text-xs text-zinc-500 mt-1">{lead.kategorie} · {lead.mesto}</p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Zavřít"
            className="shrink-0 text-zinc-500 hover:text-zinc-100 p-1 rounded transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 px-6 shrink-0">
          {(['detail', 'historie'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-2.5 px-0 mr-6 text-xs font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-zinc-200 text-zinc-100'
                  : 'border-transparent text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {t === 'detail' ? 'Detail' : 'Historie'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'detail' ? (
            <div className="space-y-7">

              {/* Status */}
              <section>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-3">Status</label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_ORDER.map(s => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`${STATUS_COLORS[s]} px-3 py-1 rounded text-xs font-medium transition-all ${
                        lead.status === s
                          ? 'opacity-100 ring-2 ring-white/20'
                          : 'opacity-35 hover:opacity-65'
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </section>

              {/* Follow-up */}
              <section>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Sledování</label>
                <input
                  type="date"
                  value={toDateInputValue(lead.follow_up_at)}
                  onChange={handleFollowUpChange}
                  className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors [color-scheme:dark]"
                />
                {lead.follow_up_at && isDue(lead.follow_up_at) && (
                  <p className="text-xs text-amber-400 mt-1.5">Po termínu</p>
                )}
              </section>

              {/* Contact */}
              <section>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-3">Kontakt</label>
                <dl className="space-y-2.5">
                  <Row label="Telefon">
                    <a href={`tel:${lead.telefon}`} className="text-blue-400 hover:text-blue-300 transition-colors">
                      {lead.telefon}
                    </a>
                  </Row>
                  {lead.web && (
                    <Row label="Web">
                      <a href={lead.web} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors truncate block max-w-[280px]">
                        {lead.web}
                      </a>
                    </Row>
                  )}
                  <Row label="Maps">
                    <a href={lead.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                      Otevřít Google Maps ↗
                    </a>
                  </Row>
                  <Row label="Adresa">
                    <span className="text-zinc-300">{lead.adresa}</span>
                  </Row>
                  {lead.rating != null && (
                    <Row label="Rating">
                      <span className="text-zinc-300">★ {lead.rating}</span>
                    </Row>
                  )}
                </dl>
              </section>

              {/* Info */}
              <section>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-3">Informace</label>
                <dl className="space-y-2.5">
                  <Row label="Důvod">
                    <span className="text-zinc-300">{lead.duvod}</span>
                  </Row>
                  <Row label="Přidáno">
                    <span className="text-zinc-400">{fmtDateTime(lead.created_at)}</span>
                  </Row>
                  <Row label="Upraveno">
                    <span className="text-zinc-400">{fmtDateTime(lead.updated_at)}</span>
                  </Row>
                  {lead.last_called_at && (
                    <Row label="Zavoláno">
                      <span className="text-zinc-400">{fmtDateTime(lead.last_called_at)}</span>
                    </Row>
                  )}
                </dl>
              </section>

              {/* Notes */}
              <section>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Poznámka</label>
                <textarea
                  ref={textareaRef}
                  value={poznamka}
                  onChange={e => setPoznamka(e.target.value)}
                  onBlur={handlePoznamkaBlur}
                  rows={5}
                  placeholder="Přidat poznámku…"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors resize-none"
                />
              </section>
            </div>
          ) : (
            <ActivityLog leadId={lead.id} />
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-zinc-800">
          <button
            onClick={() => onMarkAsCalled(lead)}
            className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded px-4 py-2.5 text-sm font-medium transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.6 3.41 2 2 0 0 1 3.6 1.2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.4A16 16 0 0 0 15 16.5l1.27-.87a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 23 17v-.08z"/>
            </svg>
            Označit jako zavoláno
          </button>
        </div>
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="w-20 shrink-0 text-xs text-zinc-500 pt-0.5">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}
