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

type EditDraft = {
  nazev: string
  mesto: string
  telefon: string
  kategorie: string
  adresa: string
  web: string
  duvod: string
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

const editInputCls = 'w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-400 transition-colors'

export default function LeadDrawer({ lead, onClose, onUpdate, onMarkAsCalled }: Props) {
  const [visible, setVisible]       = useState(false)
  const [poznamka, setPoznamka]     = useState(lead.poznamka ?? '')
  const [nextAction, setNextAction] = useState(lead.next_action ?? '')
  const [tab, setTab]               = useState<'detail' | 'historie'>('detail')
  const [editMode, setEditMode]     = useState(false)
  const [editDraft, setEditDraft]   = useState<EditDraft>({
    nazev:     lead.nazev,
    mesto:     lead.mesto,
    telefon:   lead.telefon,
    kategorie: lead.kategorie,
    adresa:    lead.adresa,
    web:       lead.web ?? '',
    duvod:     lead.duvod,
  })
  const [showEmail, setShowEmail]     = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody]     = useState('')
  const [emailCopied, setEmailCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    setPoznamka(lead.poznamka ?? '')
  }, [lead.id, lead.poznamka])

  useEffect(() => {
    setNextAction(lead.next_action ?? '')
  }, [lead.id, lead.next_action])

  // Reset edit state when a different lead is opened
  useEffect(() => {
    setEditMode(false)
    setShowEmail(false)
    setEditDraft({
      nazev:     lead.nazev,
      mesto:     lead.mesto,
      telefon:   lead.telefon,
      kategorie: lead.kategorie,
      adresa:    lead.adresa,
      web:       lead.web ?? '',
      duvod:     lead.duvod,
    })
  }, [lead.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
      onUpdate(lead.id, { poznamka: value }, value ? { type: 'note', note: value } : undefined)
    }
  }

  function handleNextActionBlur() {
    const value = nextAction.trim() || null
    if (value !== (lead.next_action ?? null)) {
      onUpdate(lead.id, { next_action: value })
    }
  }

  function setStatus(s: LeadStatus) {
    if (s !== lead.status) {
      onUpdate(lead.id, { status: s }, { type: 'status_change', old_status: lead.status, new_status: s })
    }
  }

  function handleFollowUpChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const value = raw ? new Date(raw + 'T12:00:00').toISOString() : null
    onUpdate(lead.id, { follow_up_at: value })
  }

  function setDraft(field: keyof EditDraft, value: string) {
    setEditDraft(prev => ({ ...prev, [field]: value }))
  }

  function handleSaveEdit() {
    const updates: Partial<Lead> = {}
    const t = (s: string) => s.trim()
    if (t(editDraft.nazev)     && t(editDraft.nazev)     !== lead.nazev)     updates.nazev     = t(editDraft.nazev)
    if (t(editDraft.mesto)     && t(editDraft.mesto)     !== lead.mesto)     updates.mesto     = t(editDraft.mesto)
    if (t(editDraft.telefon)   && t(editDraft.telefon)   !== lead.telefon)   updates.telefon   = t(editDraft.telefon)
    if (t(editDraft.kategorie) && t(editDraft.kategorie) !== lead.kategorie) updates.kategorie = t(editDraft.kategorie)
    if (t(editDraft.adresa)    && t(editDraft.adresa)    !== lead.adresa)    updates.adresa    = t(editDraft.adresa)
    if (t(editDraft.duvod)     && t(editDraft.duvod)     !== lead.duvod)     updates.duvod     = t(editDraft.duvod)
    const web = t(editDraft.web) || null
    if (web !== lead.web) updates.web = web
    if (Object.keys(updates).length > 0) onUpdate(lead.id, updates)
    setEditMode(false)
  }

  function handleCancelEdit() {
    setEditDraft({
      nazev:     lead.nazev,
      mesto:     lead.mesto,
      telefon:   lead.telefon,
      kategorie: lead.kategorie,
      adresa:    lead.adresa,
      web:       lead.web ?? '',
      duvod:     lead.duvod,
    })
    setEditMode(false)
  }

  function openEmail() {
    const subject = `Nabídka webové prezentace — ${lead.nazev}`
    const body = lead.web
      ? `Dobrý den,\n\nrád bych Vám nabídl vytvoření moderní webové prezentace pro ${lead.nazev} v ${lead.mesto}.\n\nNavštívil jsem Váš aktuální web a věřím, že s profesionálním redesignem by přinesl výrazně více zákazníků.\n\nRád Vám zdarma připravím ukázkový návrh bez jakýchkoli závazků.\n\nS pozdravem,`
      : `Dobrý den,\n\nrád bych Vám nabídl vytvoření moderní webové prezentace pro ${lead.nazev} v ${lead.mesto}.\n\nZjistil jsem, že zatím nemáte vlastní web — to je skvělá příležitost, jak se odlišit od konkurence.\n\nRád Vám zdarma připravím ukázkový návrh bez jakýchkoli závazků.\n\nS pozdravem,`
    setEmailSubject(subject)
    setEmailBody(body)
    setShowEmail(true)
  }

  function openMailto() {
    window.open(`mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`)
  }

  async function copyEmail() {
    await navigator.clipboard.writeText(`Předmět: ${emailSubject}\n\n${emailBody}`)
    setEmailCopied(true)
    setTimeout(() => setEmailCopied(false), 2000)
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
          <div className="pr-2 min-w-0 flex-1">
            {editMode ? (
              <input
                autoFocus
                value={editDraft.nazev}
                onChange={e => setDraft('nazev', e.target.value)}
                className="text-base font-semibold bg-zinc-800 border border-zinc-600 rounded px-2 py-0.5 w-full text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            ) : (
              <h2 className="text-base font-semibold leading-tight truncate">{lead.nazev}</h2>
            )}
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              {editMode ? (
                <>
                  <input
                    value={editDraft.kategorie}
                    onChange={e => setDraft('kategorie', e.target.value)}
                    className="text-xs text-zinc-300 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 w-28 focus:outline-none focus:border-zinc-500"
                    placeholder="kategorie"
                  />
                  <span className="text-zinc-700">·</span>
                  <input
                    value={editDraft.mesto}
                    onChange={e => setDraft('mesto', e.target.value)}
                    className="text-xs text-zinc-300 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 w-28 focus:outline-none focus:border-zinc-500"
                    placeholder="město"
                  />
                </>
              ) : (
                <p className="text-xs text-zinc-500">{lead.kategorie} · {lead.mesto}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!editMode && (
              <button
                onClick={() => setEditMode(true)}
                title="Upravit údaje"
                className="text-zinc-600 hover:text-zinc-300 p-1 rounded transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            )}
            <button
              onClick={handleClose}
              aria-label="Zavřít"
              className="text-zinc-500 hover:text-zinc-100 p-1 rounded transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 px-6 shrink-0">
          {(['detail', 'historie'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-2.5 px-0 mr-6 text-xs font-medium border-b-2 transition-colors ${
                tab === t ? 'border-zinc-200 text-zinc-100' : 'border-transparent text-zinc-600 hover:text-zinc-400'
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

              {/* Next action — always editable, shown at top */}
              <section>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Příští krok</label>
                <input
                  value={nextAction}
                  onChange={e => setNextAction(e.target.value)}
                  onBlur={handleNextActionBlur}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  placeholder="Jaký je příští krok?"
                  className={`w-full bg-zinc-900 border rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none transition-colors ${
                    nextAction ? 'border-blue-800 focus:border-blue-600' : 'border-zinc-700 focus:border-zinc-500'
                  }`}
                />
              </section>

              {/* Status */}
              <section>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-3">Status</label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_ORDER.map(s => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`${STATUS_COLORS[s]} px-3 py-1 rounded text-xs font-medium transition-all ${
                        lead.status === s ? 'opacity-100 ring-2 ring-white/20' : 'opacity-35 hover:opacity-65'
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
                {editMode ? (
                  <div className="space-y-2">
                    <EditRow label="Telefon">
                      <input type="tel" value={editDraft.telefon} onChange={e => setDraft('telefon', e.target.value)} className={editInputCls} />
                    </EditRow>
                    <EditRow label="Web">
                      <input type="url" value={editDraft.web} onChange={e => setDraft('web', e.target.value)} placeholder="https://..." className={editInputCls} />
                    </EditRow>
                    <EditRow label="Adresa">
                      <input value={editDraft.adresa} onChange={e => setDraft('adresa', e.target.value)} className={editInputCls} />
                    </EditRow>
                  </div>
                ) : (
                  <dl className="space-y-2.5">
                    <Row label="Telefon">
                      <a href={`tel:${lead.telefon}`} className="text-blue-400 hover:text-blue-300 transition-colors">{lead.telefon}</a>
                    </Row>
                    {lead.web && (
                      <Row label="Web">
                        <a href={lead.web} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors truncate block max-w-[280px]">{lead.web}</a>
                      </Row>
                    )}
                    <Row label="Maps">
                      <a href={lead.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">Otevřít Google Maps ↗</a>
                    </Row>
                    <Row label="Adresa">
                      <span className="text-zinc-300">{lead.adresa}</span>
                    </Row>
                    {lead.rating != null && (
                      <Row label="Rating"><span className="text-zinc-300">★ {lead.rating}</span></Row>
                    )}
                  </dl>
                )}
              </section>

              {/* Info */}
              <section>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-3">Informace</label>
                {editMode ? (
                  <EditRow label="Důvod">
                    <input value={editDraft.duvod} onChange={e => setDraft('duvod', e.target.value)} className={editInputCls} />
                  </EditRow>
                ) : (
                  <dl className="space-y-2.5">
                    <Row label="Důvod"><span className="text-zinc-300">{lead.duvod}</span></Row>
                    <Row label="Přidáno"><span className="text-zinc-400">{fmtDateTime(lead.created_at)}</span></Row>
                    <Row label="Upraveno"><span className="text-zinc-400">{fmtDateTime(lead.updated_at)}</span></Row>
                    {lead.last_called_at && (
                      <Row label="Zavoláno"><span className="text-zinc-400">{fmtDateTime(lead.last_called_at)}</span></Row>
                    )}
                  </dl>
                )}
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
        {editMode ? (
          <div className="shrink-0 px-6 py-4 border-t border-zinc-800 flex gap-2">
            <button
              onClick={handleCancelEdit}
              className="flex-1 px-4 py-2 text-sm border border-zinc-700 text-zinc-400 rounded hover:text-zinc-200 hover:border-zinc-600 transition-colors"
            >
              Zrušit
            </button>
            <button
              onClick={handleSaveEdit}
              className="flex-1 px-4 py-2 text-sm bg-zinc-100 text-zinc-900 rounded font-medium hover:bg-white transition-colors"
            >
              Uložit změny
            </button>
          </div>
        ) : (
          <div className="shrink-0 border-t border-zinc-800">
            {/* Email template panel */}
            {showEmail && (
              <div className="px-6 py-4 border-b border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">Email šablona</span>
                  <button onClick={() => setShowEmail(false)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
                <input
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors"
                  placeholder="Předmět"
                />
                <textarea
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  rows={7}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 resize-none font-mono leading-relaxed transition-colors"
                />
                <div className="flex gap-2">
                  <button
                    onClick={openMailto}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded transition-colors"
                  >
                    Otevřít v emailu
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </button>
                  <button
                    onClick={copyEmail}
                    className={`px-4 py-2 text-xs border rounded transition-colors ${
                      emailCopied ? 'border-green-700 text-green-400' : 'border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                    }`}
                  >
                    {emailCopied ? 'Zkopírováno ✓' : 'Zkopírovat'}
                  </button>
                </div>
              </div>
            )}
            <div className="px-6 py-4 flex gap-2">
              <button
                onClick={() => onMarkAsCalled(lead)}
                className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded px-4 py-2.5 text-sm font-medium transition-colors"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.6 3.41 2 2 0 0 1 3.6 1.2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.4A16 16 0 0 0 15 16.5l1.27-.87a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 23 17v-.08z"/>
                </svg>
                Označit jako zavoláno
              </button>
              <button
                onClick={openEmail}
                title="Email šablona"
                className={`px-3 py-2.5 rounded border text-sm transition-colors ${
                  showEmail ? 'bg-zinc-700 border-zinc-600 text-zinc-200' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                }`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </button>
            </div>
          </div>
        )}
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

function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <dt className="w-20 shrink-0 text-xs text-zinc-500">{label}</dt>
      <dd className="flex-1">{children}</dd>
    </div>
  )
}
