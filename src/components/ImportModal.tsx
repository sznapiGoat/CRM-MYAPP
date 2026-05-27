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
  { value: '',               label: '— přeskočit —' },
  { value: 'nazev',          label: 'Název *' },
  { value: 'telefon',        label: 'Telefon' },
  { value: 'mesto',          label: 'Město' },
  { value: 'adresa',         label: 'Adresa (→ město auto)' },
  { value: 'web',            label: 'Web' },
  { value: 'kategorie',      label: 'Kategorie' },
  { value: 'duvod',          label: 'Důvod' },
  { value: 'poznamka',       label: 'Poznámka' },
  { value: 'rating',         label: 'Rating' },
  { value: 'google_maps_url', label: 'Google Maps URL' },
]

// ── helpers ──────────────────────────────────────────────────────────────────

function normStr(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Strip ++:, --:, +: etc. prefix that n8n/scripts add to names */
function cleanName(s: string): string {
  return s.replace(/^[+\-]+:\s*/, '').trim()
}

/** +420XXXXXXXXX or 420XXXXXXXXX → +420XXXXXXXXX */
function normalizePhone(s: string): string {
  const p = s.replace(/[\s\-()]/g, '')
  if (!p) return ''
  if (/^42[01]\d{9}$/.test(p)) return '+' + p   // Czech/Slovak without +
  return s.trim()
}

/**
 * Extract city from a Czech address string.
 * "Růžová 1425, 434 01 Most 1, Česko" → "Most"
 * "Albrechtická 414/1, 434 01 Most 1, Česko" → "Most"
 */
function extractCity(address: string): string {
  // Match: ... ZIP CityName [DistrictNum], ...
  const m = address.match(
    /\d{3}\s+\d{2}\s+([A-Za-zÀ-ɏ][A-Za-zÀ-ɏ\s-]*?)(?:\s+\d+)?,/,
  )
  if (m) return m[1].trim()
  // Fallback: strip country and ZIP, return last meaningful segment
  const clean = address.replace(/,?\s*[Čč]esko\s*$/, '').trim()
  const parts = clean.split(',')
  const last = parts[parts.length - 1].replace(/^\d{3}\s*\d{2}\s*/, '').replace(/\s+\d+$/, '').trim()
  return last || clean.split(',')[0].trim()
}

/** True if the row looks like actual data (not column headers) */
function looksLikeDataRow(row: string[]): boolean {
  return row.some(c => {
    const v = c.trim()
    return (
      /^https?:\/\//i.test(v) ||          // any URL
      /\d{3}\s\d{2}\s/i.test(v) ||         // Czech ZIP inside text
      /česko|czech republic/i.test(v) ||    // country name
      /^\+?42[01]\d{7,}$/.test(v.replace(/[\s\-]/g, '')) // CZ/SK phone
    )
  })
}

/** Map each column index to a FieldKey by scanning all row values */
function detectColTypes(rows: string[][]): Record<number, FieldKey> {
  if (!rows.length) return {}
  const colCount = Math.max(...rows.map(r => r.length))
  const result: Record<number, FieldKey> = {}
  let nazevAssigned = false

  for (let i = 0; i < colCount; i++) {
    const vals = rows.map(r => (r[i] ?? '').trim()).filter(Boolean)
    if (!vals.length) { result[i] = ''; continue }

    const frac = (fn: (v: string) => boolean) => vals.filter(fn).length / vals.length

    if (frac(v => /google\.com\/maps/i.test(v)) > 0.3) {
      result[i] = 'google_maps_url'; continue
    }
    if (frac(v => /^https?:\/\//i.test(v)) > 0.5) {
      result[i] = 'web'; continue
    }
    if (frac(v => /\d{3}\s\d{2}\s/i.test(v) || /česko|czech/i.test(v)) > 0.3) {
      result[i] = 'adresa'; continue
    }
    if (frac(v => /^\+?[\d\s\-()]{7,16}$/.test(v) && /\d{6,}/.test(v.replace(/\D/g, ''))) > 0.2) {
      result[i] = 'telefon'; continue
    }
    if (!nazevAssigned) {
      result[i] = 'nazev'; nazevAssigned = true; continue
    }
    if (frac(v => /^bez|zastaral|špatný|přidán|import/i.test(v)) > 0.2) {
      result[i] = 'duvod'; continue
    }
    result[i] = ''
  }
  return result
}

// ── parser ────────────────────────────────────────────────────────────────────

interface Parsed {
  headers: string[]
  rows: string[][]
  noHeader: boolean
}

function parseText(raw: string): Parsed | null {
  const lines = raw.trim().split('\n').filter(l => l.trim())
  if (!lines.length) return null

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

  const firstRow = parseRow(lines[0])

  if (looksLikeDataRow(firstRow)) {
    // No header row — treat all lines as data, synthesize column labels
    const allRows = lines.map(parseRow)
    const maxCols = Math.max(...allRows.map(r => r.length))
    const headers = Array.from({ length: maxCols }, (_, i) =>
      `Sloupec ${String.fromCharCode(65 + Math.min(i, 25))}`,
    )
    return { headers, rows: allRows, noHeader: true }
  }

  return {
    headers: firstRow,
    rows: lines.slice(1).map(parseRow).filter(r => r.some(c => c)),
    noHeader: false,
  }
}

// ── header auto-map (when header row IS present) ──────────────────────────────

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

// ── component ─────────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors'

export default function ImportModal({ onClose, onImported, existingLeads }: Props) {
  const [inputMode, setInputMode] = useState<'paste' | 'file'>('paste')
  const [rawText, setRawText]     = useState('')
  const [parsed, setParsed]       = useState<Parsed | null>(null)
  const [mapping, setMapping]     = useState<Record<number, FieldKey>>({})
  const [defaultKat, setDefaultKat] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [skipDups, setSkipDups]   = useState(true)
  const [importing, setImporting] = useState(false)
  const [result, setResult]       = useState<{ ok: number; dup: number } | null>(null)

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
    if (!p) {
      setParseError('Nepodařilo se načíst data. Zkontroluj formát.')
      return
    }
    const m: Record<number, FieldKey> = p.noHeader
      ? detectColTypes(p.rows)
      : Object.fromEntries(p.headers.map((h, i) => [i, autoMap(h)]))
    setMapping(m)
    setParsed(p)
  }

  // ── build importable rows ─────────────────────────────────────────────────

  const readyRows = parsed ? parsed.rows.map(row => {
    const get = (f: FieldKey) => {
      const idx = Object.entries(mapping).find(([, v]) => v === f)?.[0]
      return idx !== undefined ? (row[Number(idx)] ?? '').trim() : ''
    }

    const rawAdresa = get('adresa')
    const hasMestoCol = Object.values(mapping).includes('mesto')
    const mesto = hasMestoCol
      ? (get('mesto') || (rawAdresa ? extractCity(rawAdresa) : 'Neznámé'))
      : (rawAdresa ? extractCity(rawAdresa) : 'Neznámé')

    return {
      nazev:           cleanName(get('nazev')),
      telefon:         normalizePhone(get('telefon')) || '—',
      mesto,
      adresa:          rawAdresa || mesto || 'Neznámé',
      web:             get('web') || null,
      kategorie:       get('kategorie') || defaultKat || 'neznámá',
      duvod:           get('duvod') || 'Import',
      poznamka:        get('poznamka') || null,
      rating:          get('rating') ? parseFloat(get('rating')) : null,
      google_maps_url: get('google_maps_url') || `manual:${crypto.randomUUID()}`,
      status:          'novy' as const,
    }
  }).filter(r => r.nazev) : []   // only nazev is strictly required

  const existingPhones = new Set(existingLeads.map(l => l.telefon.replace(/[\s\-]/g, '')))
  const dupCount   = readyRows.filter(r => r.telefon !== '—' && existingPhones.has(r.telefon.replace(/[\s\-]/g, ''))).length
  const importRows = skipDups
    ? readyRows.filter(r => r.telefon === '—' || !existingPhones.has(r.telefon.replace(/[\s\-]/g, '')))
    : readyRows
  const needsKat   = !Object.values(mapping).includes('kategorie')

  // ── import ────────────────────────────────────────────────────────────────

  async function handleImport() {
    if (!importRows.length) return
    setImporting(true)
    let ok = 0
    const CHUNK = 50
    for (let i = 0; i < importRows.length; i += CHUNK) {
      const chunk = importRows.slice(i, i + CHUNK)
      const { data, error } = await supabase
        .from('leads')
        .upsert(chunk, { onConflict: 'google_maps_url', ignoreDuplicates: true })
        .select('id')
      if (!error) ok += (data?.length ?? chunk.length)
    }
    setResult({ ok, dup: (skipDups ? dupCount : 0) + (importRows.length - ok) })
    setImporting(false)
    onImported()
  }

  // ── render ────────────────────────────────────────────────────────────────

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

            {/* ── done ── */}
            {result ? (
              <div className="text-center py-6 space-y-3">
                <div className="text-3xl font-bold text-zinc-100">{result.ok}</div>
                <div className="text-zinc-400 text-sm">leadů importováno</div>
                {result.dup > 0 && (
                  <div className="text-xs text-zinc-600">{result.dup} přeskočeno (duplicitní záznamy)</div>
                )}
                <button onClick={onClose} className="mt-4 px-5 py-2 text-sm bg-zinc-100 text-zinc-900 rounded font-medium hover:bg-white transition-colors">
                  Zavřít
                </button>
              </div>

            ) : !parsed ? (
              /* ── input stage ── */
              <>
                <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded p-1 w-fit">
                  {(['paste', 'file'] as const).map(m => (
                    <button key={m} onClick={() => setInputMode(m)}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${inputMode === m ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
                      {m === 'paste' ? 'Vložit text' : 'Nahrát CSV'}
                    </button>
                  ))}
                </div>

                {inputMode === 'paste' ? (
                  <div>
                    <p className="text-xs text-zinc-500 mb-2">
                      Vlož data z Google Sheets nebo z n8n exportu. Záhlaví je volitelné — sloupce budou rozpoznány automaticky.
                    </p>
                    <textarea
                      autoFocus
                      value={rawText}
                      onChange={e => setRawText(e.target.value)}
                      rows={8}
                      placeholder={'++: Autoškola Novák\tNáměstí 1, 434 01 Most 1, Česko\t420777000111\thttps://...\tBez webu\thttps://maps.google.com/...'}
                      className={`${inputCls} resize-none font-mono text-xs`}
                    />
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-zinc-500 mb-2">Nahraj CSV soubor. Záhlaví je volitelné.</p>
                    <input type="file" accept=".csv,.tsv,.txt" onChange={handleFile}
                      className="text-sm text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 transition-colors cursor-pointer"
                    />
                    {rawText && <p className="mt-2 text-xs text-green-500">Soubor načten ({rawText.split('\n').length} řádků)</p>}
                  </div>
                )}

                {parseError && <p className="text-xs text-red-400">{parseError}</p>}

                <div className="flex justify-end">
                  <button onClick={handleParse} disabled={!rawText.trim()}
                    className="px-4 py-2 text-sm bg-zinc-100 text-zinc-900 rounded font-medium hover:bg-white transition-colors disabled:opacity-40">
                    Načíst data →
                  </button>
                </div>
              </>

            ) : (
              /* ── mapping + preview stage ── */
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Mapování sloupců</h3>
                  <button onClick={() => setParsed(null)} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                    ← Zpět
                  </button>
                </div>

                {parsed.noHeader && (
                  <div className="text-xs text-blue-300 bg-blue-950/40 border border-blue-800/40 rounded px-3 py-2">
                    Záhlaví nebylo nalezeno — sloupce rozpoznány automaticky podle obsahu. Zkontroluj mapování níže.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {parsed.headers.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 bg-zinc-900 rounded px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-zinc-300 truncate">{h || `Sloupec ${i + 1}`}</div>
                        <div className="text-xs text-zinc-600 truncate">{parsed.rows[0]?.[i] ?? '—'}</div>
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
                    <input value={defaultKat} onChange={e => setDefaultKat(e.target.value)} placeholder="autoškola"
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
                    <table className="w-full text-xs min-w-[500px]">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-600 uppercase">
                          {(['nazev', 'telefon', 'mesto', 'duvod'] as const).map(f => (
                            <th key={f} className="px-3 py-2 text-left font-medium">{f}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {readyRows.slice(0, 3).map((r, i) => (
                          <tr key={i} className="border-b border-zinc-800/50">
                            <td className="px-3 py-2 text-zinc-300">{r.nazev}</td>
                            <td className={`px-3 py-2 ${r.telefon === '—' ? 'text-zinc-600 italic' : 'text-zinc-400'}`}>{r.telefon}</td>
                            <td className="px-3 py-2 text-zinc-400">{r.mesto}</td>
                            <td className="px-3 py-2 text-zinc-500">{r.duvod}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Duplicate control */}
                {dupCount > 0 && (
                  <div className="flex items-center justify-between bg-amber-950/40 border border-amber-800/60 rounded px-3 py-2.5">
                    <div className="text-xs text-amber-300">
                      <span className="font-semibold">{dupCount}</span> řádků má shodný telefon s existujícím leadem
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer shrink-0 ml-4">
                      <input type="checkbox" checked={skipDups} onChange={e => setSkipDups(e.target.checked)} className="rounded accent-amber-400" />
                      <span className="text-xs text-amber-300 whitespace-nowrap">Přeskočit duplicity</span>
                    </label>
                  </div>
                )}

                {/* Summary */}
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-zinc-300">
                    <span className="font-semibold text-zinc-100">{importRows.length}</span> leadů k importu
                    {skipDups && dupCount > 0 && <span className="text-zinc-600 ml-1">({dupCount} přeskočeno)</span>}
                  </span>
                  {readyRows.filter(r => r.telefon === '—').length > 0 && (
                    <span className="text-zinc-600">{readyRows.filter(r => r.telefon === '—').length} bez telefonu</span>
                  )}
                  {readyRows.length === 0 && (
                    <span className="text-red-400">Žádné platné řádky (musí mít alespoň Název)</span>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={onClose}
                    className="flex-1 px-4 py-2 text-sm border border-zinc-700 text-zinc-400 rounded hover:text-zinc-200 hover:border-zinc-600 transition-colors">
                    Zrušit
                  </button>
                  <button onClick={handleImport} disabled={importing || importRows.length === 0}
                    className="flex-1 px-4 py-2 text-sm bg-zinc-100 text-zinc-900 rounded font-medium hover:bg-white transition-colors disabled:opacity-40">
                    {importing ? 'Importuji…' : `Importovat ${importRows.length} leadů`}
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
