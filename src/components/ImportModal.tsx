'use client'

import { ChangeEvent, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Lead } from '@/types/lead'

interface Props {
  onClose: () => void
  onImported: () => void
  existingLeads: Lead[]
}

type FieldKey =
  | 'nazev' | 'telefon' | 'mesto' | 'adresa'
  | 'web' | 'kategorie' | 'duvod' | 'poznamka'
  | 'rating' | 'google_maps_url' | ''

const FIELD_OPTIONS: { value: FieldKey; label: string }[] = [
  { value: '',              label: '— přeskočit —' },
  { value: 'nazev',         label: 'Název *' },
  { value: 'telefon',       label: 'Telefon *' },
  { value: 'mesto',         label: 'Město' },
  { value: 'adresa',        label: 'Adresa' },
  { value: 'web',           label: 'Web' },
  { value: 'kategorie',     label: 'Kategorie' },
  { value: 'duvod',         label: 'Důvod' },
  { value: 'poznamka',      label: 'Poznámka' },
  { value: 'rating',        label: 'Rating' },
  { value: 'google_maps_url', label: 'Google Maps URL' },
]

function normStr(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function autoMap(header: string): FieldKey {
  const n = normStr(header)
  if (/nazev|name|firma|jmeno|nazov|company/.test(n)) return 'nazev'
  if (/mesto|city|obec|location|lokalita/.test(n)) return 'mesto'
  if (/telefon|phone|tel\b|mobil|gsm/.test(n)) return 'telefon'
  if (/adresa|address|addr|ulice/.test(n)) return 'adresa'
  if (/\bweb\b|url|website|www/.test(n)) return 'web'
  if (/kategori|categor|\btyp\b|\btype\b|obor/.test(n)) return 'kategorie'
  if (/duvod|reason|proc\b|popis/.test(n)) return 'duvod'
  if (/poznamka|poznamky|note|notes|koment/.test(n)) return 'poznamka'
  if (/rating|hodnoceni|skore|score|stars/.test(n)) return 'rating'
  if (/google|maps|gm_url|maps_url/.test(n)) return 'google_maps_url'
  return ''
}

function parseText(raw: string): { headers: string[]; rows: string[][] } | null {
  const lines = raw.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return null

  const delim = lines[0].includes('\t') ? '\t' : ','

  function parseRow(line: string): string[] {
    if (delim === '\t') return line.split('\t').map(c => c.trim())
    const cols: string[] = []
    let cur = ''; let inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    cols.push(cur.trim())
    return cols
  }

  return {
    headers: parseRow(lines[0]),
    rows:    lines.slice(1).map(parseRow).filter(r => r.some(c => c)),
  }
}

const inputCls = 'w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors'

export default function ImportModal({ onClose, onImported, existingLeads }: Props) {
  const [inputMode, setInputMode]       = useState<'paste' | 'file'>('paste')
  const [rawText, setRawText]           = useState('')
  const [parsed, setParsed]             = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const [mapping, setMapping]           = useState<Record<number, FieldKey>>({})
  const [defaultKat, setDefaultKat]     = useState('')
  const [parseError, setParseError]     = useState<string | null>(null)
  const [importing, setImporting]       = useState(false)
  const [result, setResult]             = useState<{ ok: number; dup: number } | null>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setRawText(String(ev.target?.result ?? ''))
    reader.readAsText(file, 'utf-8')
  }

  function handleParse() {
    setParseError(null)
    const p = parseText(rawText)
    if (!p || !p.headers.length) {
      setParseError('Nepodařilo se načíst data. Zkontroluj formát (první řádek = záhlaví).')
      return
    }
    const m: Record<number, FieldKey> = {}
    p.headers.forEach((h, i) => { m[i] = autoMap(h) })
    setMapping(m)
    setParsed(p)
  }

  // Rows ready for import
  const readyRows = parsed ? parsed.rows.map(row => {
    const get = (f: FieldKey) => {
      const idx = Object.entries(mapping).find(([, v]) => v === f)?.[0]
      return idx !== undefined ? (row[Number(idx)] ?? '').trim() : ''
    }
    const phone = get('telefon')
    const mapsUrl = get('google_maps_url') || `manual:${crypto.randomUUID()}`
    return {
      nazev:           get('nazev'),
      telefon:         phone,
      mesto:           get('mesto')    || 'Neznámé',
      adresa:          get('adresa')   || get('mesto') || 'Neznámé',
      web:             get('web')      || null,
      kategorie:       get('kategorie') || defaultKat || 'neznámá',
      duvod:           get('duvod')    || 'Import',
      poznamka:        get('poznamka') || null,
      rating:          get('rating') ? parseFloat(get('rating')) : null,
      google_maps_url: mapsUrl,
      status:          'novy' as const,
    }
  }).filter(r => r.nazev && r.telefon) : []

  const existingPhones = new Set(existingLeads.map(l => l.telefon.replace(/[\s\-]/g, '')))
  const dupCount = readyRows.filter(r => existingPhones.has(r.telefon.replace(/[\s\-]/g, ''))).length
  const needsKat = !Object.values(mapping).includes('kategorie')

  async function handleImport() {
    if (!readyRows.length) return
    setImporting(true)

    let ok = 0
    const CHUNK = 50
    for (let i = 0; i < readyRows.length; i += CHUNK) {
      const chunk = readyRows.slice(i, i + CHUNK)
      const { data, error } = await supabase
        .from('leads')
        .upsert(chunk, { onConflict: 'google_maps_url', ignoreDuplicates: true })
        .select('id')
      if (!error) ok += (data?.length ?? chunk.length)
    }

    setResult({ ok, dup: readyRows.length - ok })
    setImporting(false)
    onImported()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-[#161616] border border-zinc-800 rounded-xl w-full max-w-2xl shadow-2xl my-auto">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold">Hromadný import leadů</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 p-1 rounded transition-colors">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div className="px-6 py-5 space-y-5">
            {result ? (
              /* Done state */
              <div className="text-center py-6 space-y-3">
                <div className="text-3xl font-bold text-zinc-100">{result.ok}</div>
                <div className="text-zinc-400 text-sm">leadů importováno</div>
                {result.dup > 0 && (
                  <div className="text-xs text-zinc-600">{result.dup} přeskočeno (duplicitní záznamy)</div>
                )}
                <button
                  onClick={onClose}
                  className="mt-4 px-5 py-2 text-sm bg-zinc-100 text-zinc-900 rounded font-medium hover:bg-white transition-colors"
                >
                  Zavřít
                </button>
              </div>
            ) : !parsed ? (
              /* Input stage */
              <>
                <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded p-1 w-fit">
                  {(['paste', 'file'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setInputMode(m)}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${inputMode === m ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      {m === 'paste' ? 'Vložit text' : 'Nahrát CSV'}
                    </button>
                  ))}
                </div>

                {inputMode === 'paste' ? (
                  <div>
                    <p className="text-xs text-zinc-500 mb-2">
                      Zkopíruj buňky z Google Sheets (včetně záhlaví) a vlož sem.
                    </p>
                    <textarea
                      autoFocus
                      value={rawText}
                      onChange={e => setRawText(e.target.value)}
                      rows={8}
                      placeholder={'Název\tMěsto\tTelefon\t…\nAutoškola Novák\tBrno\t+420777000111\t…'}
                      className={`${inputCls} resize-none font-mono text-xs`}
                    />
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-zinc-500 mb-2">
                      Nahraj CSV soubor (první řádek = záhlaví).
                    </p>
                    <input
                      type="file"
                      accept=".csv,.tsv,.txt"
                      onChange={handleFile}
                      className="text-sm text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 transition-colors cursor-pointer"
                    />
                    {rawText && (
                      <p className="mt-2 text-xs text-green-500">Soubor načten ({rawText.split('\n').length} řádků)</p>
                    )}
                  </div>
                )}

                {parseError && <p className="text-xs text-red-400">{parseError}</p>}

                <div className="flex justify-end">
                  <button
                    onClick={handleParse}
                    disabled={!rawText.trim()}
                    className="px-4 py-2 text-sm bg-zinc-100 text-zinc-900 rounded font-medium hover:bg-white transition-colors disabled:opacity-40"
                  >
                    Načíst data →
                  </button>
                </div>
              </>
            ) : (
              /* Mapping + preview stage */
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Mapování sloupců</h3>
                  <button onClick={() => setParsed(null)} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                    ← Zpět
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {parsed.headers.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 bg-zinc-900 rounded px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-zinc-300 truncate">{h || `Sloupec ${i + 1}`}</div>
                        <div className="text-xs text-zinc-600 truncate">{parsed.rows[0]?.[i] ?? ''}</div>
                      </div>
                      <select
                        value={mapping[i] ?? ''}
                        onChange={e => setMapping(prev => ({ ...prev, [i]: e.target.value as FieldKey }))}
                        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none shrink-0"
                      >
                        {FIELD_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {needsKat && (
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-zinc-500 whitespace-nowrap">Výchozí kategorie:</label>
                    <input
                      value={defaultKat}
                      onChange={e => setDefaultKat(e.target.value)}
                      placeholder="autoškola"
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                    />
                  </div>
                )}

                {/* Preview */}
                <div>
                  <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-2">
                    Náhled ({Math.min(3, readyRows.length)} z {readyRows.length})
                  </h3>
                  <div className="overflow-x-auto rounded border border-zinc-800">
                    <table className="w-full text-xs min-w-[400px]">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-600 uppercase">
                          {(['nazev', 'telefon', 'mesto', 'kategorie'] as const).map(f => (
                            <th key={f} className="px-3 py-2 text-left font-medium">{f}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {readyRows.slice(0, 3).map((r, i) => (
                          <tr key={i} className="border-b border-zinc-800/50">
                            <td className="px-3 py-2 text-zinc-300">{r.nazev}</td>
                            <td className="px-3 py-2 text-zinc-400">{r.telefon}</td>
                            <td className="px-3 py-2 text-zinc-400">{r.mesto}</td>
                            <td className="px-3 py-2 text-zinc-400">{r.kategorie}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary */}
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-zinc-300">
                    <span className="font-semibold text-zinc-100">{readyRows.length}</span> leadů k importu
                  </span>
                  {dupCount > 0 && (
                    <span className="text-amber-400">{dupCount} má shodný telefon s existujícím leadem</span>
                  )}
                  {readyRows.length === 0 && (
                    <span className="text-red-400">Žádné platné řádky (chybí Název nebo Telefon)</span>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 text-sm border border-zinc-700 text-zinc-400 rounded hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                  >
                    Zrušit
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing || readyRows.length === 0}
                    className="flex-1 px-4 py-2 text-sm bg-zinc-100 text-zinc-900 rounded font-medium hover:bg-white transition-colors disabled:opacity-40"
                  >
                    {importing ? 'Importuji…' : `Importovat ${readyRows.length} leadů`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
