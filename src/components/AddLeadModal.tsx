'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Lead } from '@/types/lead'

interface Props {
  onClose: () => void
  onAdded: () => void
  existingLeads: Lead[]
}

const KATEGORIE = [
  'autoškola', 'elektrikář', 'instalatér', 'klempíř',
  'malíř', 'pokrývač', 'tesař', 'truhlář',
  'zahradník', 'zámečník', 'topenář', 'obkladač',
  'podlahář', 'stěhování', 'čistění',
]

const DUVODY = [
  'Přidán ručně',
  'Bez webu na Google Maps',
  'Zastaralá platforma',
  'Špatný web',
  'Doporučení',
]

const inputCls =
  'w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors'

function Field({
  label,
  children,
  col2,
}: {
  label: string
  children: React.ReactNode
  col2?: boolean
}) {
  return (
    <div className={col2 ? 'col-span-2' : ''}>
      <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

export default function AddLeadModal({ onClose, onAdded, existingLeads }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<Lead | null>(null)
  const [form, setForm] = useState({
    nazev: '',
    mesto: '',
    telefon: '',
    kategorie: '',
    adresa: '',
    web: '',
    duvod: 'Přidán ručně',
    poznamka: '',
  })

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function checkDuplicate(telefon: string) {
    const normalized = telefon.trim().replace(/[\s\-]/g, '')
    if (normalized.length < 7) { setDuplicate(null); return }
    const match = existingLeads.find(l =>
      l.telefon.replace(/[\s\-]/g, '') === normalized
    )
    setDuplicate(match ?? null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      nazev:           form.nazev.trim(),
      mesto:           form.mesto.trim(),
      telefon:         form.telefon.trim(),
      kategorie:       form.kategorie.trim(),
      adresa:          form.adresa.trim() || form.mesto.trim(),
      web:             form.web.trim() || null,
      duvod:           form.duvod.trim() || 'Přidán ručně',
      poznamka:        form.poznamka.trim() || null,
      google_maps_url: `manual:${crypto.randomUUID()}`,
    }

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }

      onAdded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neznámá chyba')
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-[#161616] border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl my-auto">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold">Přidat lead ručně</h2>
            <button
              onClick={onClose}
              aria-label="Zavřít"
              className="text-zinc-500 hover:text-zinc-100 p-1 rounded transition-colors"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">

              <Field label="Název *" col2>
                <input
                  required
                  autoFocus
                  value={form.nazev}
                  onChange={e => set('nazev', e.target.value)}
                  placeholder="Autoškola Novák"
                  className={inputCls}
                />
              </Field>

              <Field label="Město *">
                <input
                  required
                  value={form.mesto}
                  onChange={e => set('mesto', e.target.value)}
                  placeholder="Brno"
                  className={inputCls}
                />
              </Field>

              <Field label="Telefon *">
                <input
                  required
                  type="tel"
                  value={form.telefon}
                  onChange={e => { set('telefon', e.target.value); checkDuplicate(e.target.value) }}
                  placeholder="+420 777 000 111"
                  className={inputCls}
                />
              </Field>

              <Field label="Kategorie *">
                <input
                  required
                  list="kategorie-opts"
                  value={form.kategorie}
                  onChange={e => set('kategorie', e.target.value)}
                  placeholder="autoškola"
                  className={inputCls}
                />
                <datalist id="kategorie-opts">
                  {KATEGORIE.map(k => <option key={k} value={k} />)}
                </datalist>
              </Field>

              <Field label="Adresa" col2>
                <input
                  value={form.adresa}
                  onChange={e => set('adresa', e.target.value)}
                  placeholder="Náměstí 1, Brno (nebo nech prázdné)"
                  className={inputCls}
                />
              </Field>

              <Field label="Web" col2>
                <input
                  type="url"
                  value={form.web}
                  onChange={e => set('web', e.target.value)}
                  placeholder="https://example.cz"
                  className={inputCls}
                />
              </Field>

              <Field label="Důvod" col2>
                <input
                  list="duvod-opts"
                  value={form.duvod}
                  onChange={e => set('duvod', e.target.value)}
                  className={inputCls}
                />
                <datalist id="duvod-opts">
                  {DUVODY.map(d => <option key={d} value={d} />)}
                </datalist>
              </Field>

              <Field label="Poznámka" col2>
                <textarea
                  value={form.poznamka}
                  onChange={e => set('poznamka', e.target.value)}
                  rows={3}
                  placeholder="Volitelné…"
                  className={`${inputCls} resize-none`}
                />
              </Field>
            </div>

            {duplicate && (
              <div className="mt-3 bg-amber-950/60 border border-amber-800 rounded px-3 py-2 text-xs text-amber-300">
                Stejné telefonní číslo: <span className="font-medium">{duplicate.nazev}</span> ({duplicate.mesto}, {duplicate.status})
              </div>
            )}

            {error && (
              <p className="mt-3 text-xs text-red-400">{error}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm border border-zinc-700 text-zinc-400 rounded hover:text-zinc-200 hover:border-zinc-600 transition-colors"
              >
                Zrušit
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm bg-zinc-100 text-zinc-900 rounded font-medium hover:bg-white transition-colors disabled:opacity-40"
              >
                {loading ? 'Ukládám…' : 'Přidat lead'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
