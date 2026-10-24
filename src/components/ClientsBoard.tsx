'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import * as db from '@/lib/db'
import {
  Client, CLIENT_STATUS_LABELS, Project, PROJECT_STAV_COLORS, PROJECT_STAV_LABELS,
  Subscription, WeekStats, ZDROJ_LABELS, fmtDate, fmtKc, isActiveSub, mrrOf,
} from '@/types/client'
import ClientDrawer from './ClientDrawer'

type Overview = { clients: Client[]; projects: Project[]; subscriptions: Subscription[] }

const DAY = 24 * 60 * 60 * 1000

// Czech plural: 1 projekt, 2-4 projekty, 5+ projektů.
const plural = (n: number, one: string, few: string, many: string) =>
  `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`

// Things that need attention in the next 30 days: domains to renew and
// services that are about to end.
function upcoming(projects: Project[], subs: Subscription[], clients: Client[]) {
  const name = new Map(clients.map(c => [c.id, c.nazev]))
  const today = new Date().toISOString().slice(0, 10)
  const limit = new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10)
  const out: { date: string; label: string; clientId: string }[] = []
  for (const p of projects) {
    if (p.domena_obnova_at && p.domena_obnova_at <= limit) {
      out.push({ date: p.domena_obnova_at, label: `Obnova domény ${p.domena ?? ''}`.trim(), clientId: p.client_id })
    }
  }
  for (const s of subs) {
    if (s.stav === 'aktivni' && s.do && s.do >= today && s.do <= limit) {
      out.push({ date: s.do, label: 'Končí služba', clientId: s.client_id })
    }
  }
  return out
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(u => ({ ...u, client: name.get(u.clientId) ?? '' }))
}

export default function ClientsBoard() {
  const data = useQuery(api.clients.overview) as Overview | undefined
  const weeks = useQuery(api.activities.weeklyStats, { weeks: 8 }) as WeekStats[] | undefined
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showEnded, setShowEnded] = useState(false)

  // Deep link from the lead drawer: /klienti?client=<id> opens that client.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('client')
    if (id) setSelectedId(id)
  }, [])

  const clients = useMemo(() => data?.clients ?? [], [data])
  const projects = useMemo(() => data?.projects ?? [], [data])
  const subs = useMemo(() => data?.subscriptions ?? [], [data])

  const mrr = mrrOf(subs)
  const active = clients.filter(c => c.status === 'aktivni')
  const unpaid = projects.filter(p => p.stav === 'predano' || p.stav === 'rozpracovano')
  const offers = projects.filter(p => p.stav === 'nabidka')
  const sum = (list: Project[]) => list.reduce((s, p) => s + p.cena, 0)
  const attention = upcoming(projects, subs, clients)

  const visible = showEnded ? clients : clients.filter(c => c.status !== 'ukonceny')
  const selected = clients.find(c => c.id === selectedId) ?? null

  async function addClient() {
    const id = await db.createClient({
      lead_id: null,
      nazev: 'Nový klient',
      kontakt_jmeno: null,
      telefon: '',
      email: null,
      ico: null,
      mesto: '',
      kategorie: '',
      zdroj: 'doporuceni',
      status: 'aktivni',
      poznamka: null,
    })
    setSelectedId(id)
  }

  const stats = [
    { label: 'MRR', value: fmtKc(mrr), hint: 'měsíční opakovaný příjem' },
    { label: 'Aktivní klienti', value: String(active.length), hint: `${clients.length} celkem` },
    { label: 'Čeká na zaplacení', value: fmtKc(sum(unpaid)), hint: plural(unpaid.length, 'projekt', 'projekty', 'projektů') },
    { label: 'V nabídkách', value: fmtKc(sum(offers)), hint: plural(offers.length, 'nabídka', 'nabídky', 'nabídek') },
  ]

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100">
      <header className="sticky top-0 z-30 bg-[#0f0f0f]/80 backdrop-blur border-b border-zinc-800 px-5 py-3.5 flex items-center gap-3">
        <Link href="/" title="Zpět na leady" className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-sm font-semibold tracking-tight text-zinc-100 shrink-0">Klienti</h1>

        <div className="flex items-center gap-3 ml-auto">
          <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer select-none">
            <input type="checkbox" checked={showEnded} onChange={e => setShowEnded(e.target.checked)} className="accent-zinc-400" />
            Ukončení
          </label>
          <button
            onClick={addClient}
            className="bg-zinc-100 hover:bg-white text-zinc-900 rounded px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            Nový klient
          </button>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-6 space-y-6 max-w-[1400px] mx-auto">
        {data === undefined && <div className="text-center text-zinc-600 py-20 text-sm">Načítám…</div>}

        {data !== undefined && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {stats.map(s => (
                <div key={s.label} className="bg-gradient-to-b from-zinc-900 to-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3">
                  <div className="text-2xl font-bold tabular-nums tracking-tight text-zinc-100">{s.value}</div>
                  <div className="text-xs mt-0.5 text-zinc-400">{s.label}</div>
                  <div className="text-[11px] text-zinc-600">{s.hint}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <WeeklyTable weeks={weeks} />

              <section className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                <h2 className="text-xs font-semibold text-zinc-300 mb-3">Do 30 dní</h2>
                {attention.length === 0 ? (
                  <p className="text-xs text-zinc-600">Nic se neobnovuje ani nekončí.</p>
                ) : (
                  <ul className="space-y-2">
                    {attention.map((u, i) => (
                      <li key={i}>
                        <button onClick={() => setSelectedId(u.clientId)} className="w-full text-left text-xs flex gap-3 hover:text-zinc-100 text-zinc-400">
                          <span className="tabular-nums text-amber-400 shrink-0">{fmtDate(u.date)}</span>
                          <span className="truncate">{u.client}: {u.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {visible.length === 0 ? (
              <div className="text-center text-zinc-600 py-16 text-sm">
                Zatím žádní klienti. Převeďte uzavřený lead, nebo přidejte klienta z doporučení.
              </div>
            ) : (
              <div className="border border-zinc-800 rounded-xl overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-left text-[11px] text-zinc-500 border-b border-zinc-800">
                      <th className="px-4 py-2.5 font-medium">Klient</th>
                      <th className="px-4 py-2.5 font-medium">Zdroj</th>
                      <th className="px-4 py-2.5 font-medium">Projekty</th>
                      <th className="px-4 py-2.5 font-medium text-right">Měsíčně</th>
                      <th className="px-4 py-2.5 font-medium">Stav</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(c => {
                      const cp = projects.filter(p => p.client_id === c.id)
                      const cs = subs.filter(s => s.client_id === c.id && isActiveSub(s))
                      const monthly = cs.reduce((s, x) => s + x.cena_mesicne, 0)
                      return (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedId(c.id)}
                          className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/60 cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-zinc-100">{c.nazev}</div>
                            <div className="text-xs text-zinc-500">{[c.kategorie, c.mesto].filter(Boolean).join(' · ')}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-400">{ZDROJ_LABELS[c.zdroj] ?? c.zdroj}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {cp.length === 0 && <span className="text-xs text-zinc-600">žádné</span>}
                              {cp.map(p => (
                                <span key={p.id} className={`${PROJECT_STAV_COLORS[p.stav]} px-2 py-0.5 rounded text-[11px] whitespace-nowrap`}>
                                  {p.nazev}: {PROJECT_STAV_LABELS[p.stav]}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-zinc-200 whitespace-nowrap">{monthly ? fmtKc(monthly) : <span className="text-zinc-600">0</span>}</td>
                          <td className="px-4 py-3 text-xs text-zinc-400">{CLIENT_STATUS_LABELS[c.status] ?? c.status}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {selected && (
        <ClientDrawer
          key={selected.id}
          client={selected}
          projects={projects.filter(p => p.client_id === selected.id)}
          subscriptions={subs.filter(s => s.client_id === selected.id)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

function WeeklyTable({ weeks }: { weeks: WeekStats[] | undefined }) {
  const cols: { key: keyof Omit<WeekStats, 'week'>; label: string }[] = [
    { key: 'osloveno', label: 'Osloveno' },
    { key: 'zajem', label: 'Zájem' },
    { key: 'demo', label: 'Dema' },
    { key: 'zakazky', label: 'Zakázky' },
  ]
  const rows = weeks ? [...weeks].reverse() : []
  return (
    <section className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 overflow-x-auto">
      <h2 className="text-xs font-semibold text-zinc-300 mb-3">Obchod po týdnech</h2>
      {!weeks ? (
        <p className="text-xs text-zinc-600">Načítám…</p>
      ) : (
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr className="text-zinc-500 text-left">
              <th className="font-medium pb-2">Týden od</th>
              {cols.map(c => <th key={c.key} className="font-medium pb-2 text-right">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((w, i) => (
              <tr key={w.week} className={i === 0 ? 'text-zinc-100' : 'text-zinc-400'}>
                <td className="py-1">{i === 0 ? 'Tento týden' : fmtDate(w.week)}</td>
                {cols.map(c => (
                  <td key={c.key} className={`py-1 text-right ${w[c.key] === 0 ? 'text-zinc-700' : ''}`}>{w[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
