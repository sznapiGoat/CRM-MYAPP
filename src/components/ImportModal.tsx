'use client'

import { ChangeEvent, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Lead } from '@/types/lead'

interface Props {
  onClose: () => void
  onImported: () => void
  existingLeads: Lead[]
}

// ── data cleanup helpers ──────────────────────────────────────────────────────

/** Strip ++:, --:, +:  prefixes added by n8n/scripts */
function cleanName(s: string): string {
  return s.replace(/^[+\-]+:\s*/, '').trim()
}

/** 420XXXXXXXXX or 420XXXXXXXXX without + → +420XXXXXXXXX */
function normalizePhone(s: string): string {
  const p = s.replace(/[\s\-()]/g, '')
  if (/^42[01]\d{9}$/.test(p)) return '+' + p
  return s.trim()
}

/** "Růžová 1425, 434 01 Most 1, Česko" → "Most" */
function extractCity(address: string): string {
  const m = address.match(/\d{3}\s+\d{2}\s+([A-Za-zÀ-ɏ][A-Za-zÀ-ɏ\s-]*?)(?:\s+\d+)?,/)
  if (m) return m[1].trim()
  const clean = address.replace(/,?\s*[Čč]esko\s*$/, '').trim()
  const parts = clean.split(',')
  const last = parts[parts.length - 1].replace(/^\d{3}\s*\d{2}\s*/, '').replace(/\s+\d+$/, '').trim()
  return last || clean.split(',')[0].trim()
}

// ── smart per-segment classifier ─────────────────────────────────────────────

interface SmartRow {
  nazev: string
  telefon: string
  adresa: string
  mesto: string
  web: string | null
  duvod: string
  google_maps_url: string
  kategorie?: string
}

function classifySegment(seg: string): 'maps' | 'web' | 'adresa' | 'telefon' | 'duvod' | 'text' {
  const s = seg.trim()
  if (/google\.com\/maps/i.test(s)) return 'maps'
  if (/^https?:\/\//i.test(s)) return 'web'
  if (/\d{3}\s+\d{2}\s/i.test(s) || /[Čč]esko/.test(s)) return 'adresa'
  if (/^\+?[\d\s\-()]{7,16}$/.test(s) && /\d{6,}/.test(s.replace(/\D/g, ''))) return 'telefon'
  if (/^bez\b|zastaral|špatný web|přidán|doporučení/i.test(s)) return 'duvod'
  return 'text'
}

function extractRow(line: string): SmartRow {
  // Split by tabs first, then fall back to 2+ consecutive spaces
  const segments = line.includes('\t')
    ? line.split('\t').map(s => s.trim()).filter(Boolean)
    : line.split(/  +/).map(s => s.trim()).filter(Boolean)

  let nazev = '', telefon = '', adresa = '', web = '', duvod = '', mapsUrl = ''

  for (const seg of segments) {
    const kind = classifySegment(seg)
    if (kind === 'maps'    && !mapsUrl)  { mapsUrl  = seg; continue }
    if (kind === 'web'     && !web)      { web      = seg; continue }
    if (kind === 'adresa'  && !adresa)   { adresa   = seg; continue }
    if (kind === 'telefon' && !telefon)  { telefon  = seg; continue }
    if (kind === 'duvod'   && !duvod)    { duvod    = seg; continue }
    if (kind === 'text'    && !nazev)    { nazev    = seg }
  }

  const mesto = adresa ? extractCity(adresa) : 'Neznámé'

  return {
    nazev:           cleanName(nazev),
    telefon:         normalizePhone(telefon) || '—',
    adresa:          adresa || 'Neznámé',
    mesto,
    web:             web || null,
    duvod:           duvod || 'Import',
    google_maps_url: mapsUrl || `manual:${crypto.randomUUID()}`,
  }
}

// ── column-based parser (for CSV with headers) ────────────────────────────────

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

/** True when a row clearly contains actual data, not header names */
function looksLikeDataRow(row: string[]): boolean {
  return row.some(c => {
    const v = c.trim()
    return (
      /^https?:\/\//i.test(v) ||
      /\d{3}\s\d{2}\s/i.test(v) ||
      /[Čč]esko/.test(v) ||
      /^\+?42[01]\d{7,}$/.test(v.replace(/[\s\-]/g, ''))
    )
  })
}

interface ColumnParsed { mode: 'columns'; headers: string[]; rows: string[][] }
interface SmartParsed  { mode: 'smart';   lines: string[] }
type ParseResult = ColumnParsed | SmartParsed

function parseInput(raw: string): ParseResult | null {
  const lines = raw.trim().split('\n').filter(l => l.trim())
  if (!lines.length) return null

  // Detect delimiter for column mode
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

  // If first row has no headers (looks like data), use smart per-line extraction
  if (looksLikeDataRow(firstRow) || (!lines[0].includes('\t') && !lines[0].includes(','))) {
    return { mode: 'smart', lines }
  }

  return {
    mode: 'columns',
    headers: firstRow,
    rows: lines.slice(1).map(parseRow).filter(r => r.some(c => c)),
  }
}

// ── component ─────────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors'

export default function ImportModal({ onClose, onImported, existingLeads }: Props) {
  const [inputMode, setInputMode]     = useState<'paste' | 'file'>('paste')
  const [rawText, setRawText]         = useState('')
  const [parsed, setParsed]           = useState<ParseResult | null>(null)
  const [mapping, setMapping]         = useState<Record<number, FieldKey>>({})
  const [defaultKat, setDefaultKat]   = useState('')
  const [parseError, setParseError]   = useState<string | null>(null)
  const [skipDups, setSkipDups]       = useState(true)
  const [importing, setImporting]     = useState(false)
  const [result, setResult]           = useState<{ ok: number; dup: number } | null>(null)

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
    const p = parseInput(rawText)
    if (!p) { setParseError('Nepodařilo se načíst data.'); return }

    if (p.mode === 'columns') {
      setMapping(Object.fromEntries(p.headers.map((h, i) => [i, autoMap(h)])))
    }
    setParsed(p)
  }

  // ── build rows for import ─────────────────────────────────────────────────

  const smartRows: SmartRow[] = parsed?.mode === 'smart'
    ? parsed.lines.map(extractRow).map(r => ({ ...r, kategorie: defaultKat || 'neznámá' })).filter(r => r.nazev)
    : []

  const columnRows = parsed?.mode === 'columns'
    ? parsed.rows.map(row => {
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
      }).filter(r => r.nazev)
    : []

  const readyRows = parsed?.mode === 'smart'
    ? smartRows.map(r => ({ ...r, poznamka: null as null, rating: null as null, status: 'novy' as const }))
    : columnRows

  const existingPhones = new Set(existingLeads.map(l => l.telefon.replace(/[\s\-]/g, '')))
  const dupCount   = readyRows.filter(r => r.telefon !== '—' && existingPhones.has(r.telefon.replace(/[\s\-]/g, ''))).length
  const importRows = skipDups
    ? readyRows.filter(r => r.telefon === '—' || !existingPhones.has(r.telefon.replace(/[\s\-]/g, '')))
    : readyRows
  const noPhoneCount = readyRows.filter(r => r.telefon === '—').length
  const needsKat = parsed?.mode === 'columns' && !Object.values(mapping).includes('kategorie')

  // ── import ────────────────────────────────────────────────────────────────

  async function handleImport() {
    if (!importRows.length) return
    setImporting(true)
    let ok = 0
    for (let i = 0; i < importRows.length; i += 50) {
      const chunk = importRows.slice(i, i + 50)
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
                {result.dup > 0 && <div className="text-xs text-zinc-600">{result.dup} přeskočeno (duplikáty)</div>}
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
                      Vlož data z Google Sheets nebo n8n. Záhlaví není nutné — obsah je rozpoznán automaticky.
                    </p>
                    <textarea
                      autoFocus
                      value={rawText}
                      onChange={e => setRawText(e.target.value)}
                      rows={8}
                      placeholder={'++: Autoškola Novák\tRůžová 1, 434 01 Most 1, Česko\t420777000111\thttps://...\tBez webu\thttps://maps.google.com/...'}
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
              /* ── preview / mapping stage ── */
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-widest">
                      {parsed.mode === 'smart' ? 'Automaticky rozpoznáno' : 'Mapování sloupců'}
                    </h3>
                    {parsed.mode === 'smart' && (
                      <span className="text-xs bg-blue-950/60 border border-blue-800/50 text-blue-300 px-2 py-0.5 rounded">
                        Smart
                      </span>
                    )}
                  </div>
                  <button onClick={() => setParsed(null)} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                    ← Zpět
                  </button>
                </div>

                {/* Column mapping — only for CSV-with-headers mode */}
                {parsed.mode === 'columns' && (
                  <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                    {parsed.headers.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 bg-zinc-900 rounded px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-zinc-300 truncate">{h || `Sloupec ${i + 1}`}</div>
                          <div className="text-xs text-zinc-600 truncate">{parsed.rows[0]?.[i] ?? '—'}</div>
                        </div>
                        <select value={mapping[i] ?? ''} onChange={e => setMapping(prev => ({ ...prev, [i]: e.target.value as FieldKey }))}
                          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none shrink-0">
                          {FIELD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {(needsKat || parsed.mode === 'smart') && (
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-zinc-500 whitespace-nowrap">Kategorie pro všechny:</label>
                    <input value={defaultKat} onChange={e => setDefaultKat(e.target.value)} placeholder="autoškola"
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                    />
                  </div>
                )}

                {/* Preview table */}
                <div>
                  <p className="text-xs text-zinc-500 mb-2">Náhled prvních 3 řádků:</p>
                  <div className="overflow-x-auto rounded border border-zinc-800">
                    <table className="w-full text-xs min-w-[520px]">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-600 uppercase">
                          <th className="px-3 py-2 text-left">Název</th>
                          <th className="px-3 py-2 text-left">Telefon</th>
                          <th className="px-3 py-2 text-left">Město</th>
                          <th className="px-3 py-2 text-left">Web</th>
                          <th className="px-3 py-2 text-left">Důvod</th>
                        </tr>
                      </thead>
                      <tbody>
                        {readyRows.slice(0, 3).map((r, i) => (
                          <tr key={i} className="border-b border-zinc-800/50">
                            <td className="px-3 py-2 text-zinc-200 font-medium">{r.nazev || <span className="text-red-500 italic">chybí</span>}</td>
                            <td className={`px-3 py-2 ${r.telefon === '—' ? 'text-zinc-600 italic' : 'text-zinc-300'}`}>{r.telefon}</td>
                            <td className="px-3 py-2 text-zinc-400">{r.mesto}</td>
                            <td className="px-3 py-2 text-zinc-500 max-w-[120px] truncate">{r.web ?? '—'}</td>
                            <td className="px-3 py-2 text-zinc-500">{r.duvod}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Duplicate warning */}
                {dupCount > 0 && (
                  <div className="flex items-center justify-between bg-amber-950/40 border border-amber-800/60 rounded px-3 py-2.5">
                    <span className="text-xs text-amber-300">
                      <span className="font-semibold">{dupCount}</span> řádků — shodný telefon v CRM
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer ml-4 shrink-0">
                      <input type="checkbox" checked={skipDups} onChange={e => setSkipDups(e.target.checked)} className="rounded accent-amber-400" />
                      <span className="text-xs text-amber-300 whitespace-nowrap">Přeskočit</span>
                    </label>
                  </div>
                )}

                {/* Summary */}
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span><span className="text-zinc-100 font-semibold">{importRows.length}</span> leadů k importu</span>
                  {skipDups && dupCount > 0 && <span>({dupCount} duplikátů přeskočeno)</span>}
                  {noPhoneCount > 0 && <span>{noPhoneCount}× bez telefonu</span>}
                  {readyRows.length === 0 && <span className="text-red-400">Žádné platné řádky (musí mít Název)</span>}
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
