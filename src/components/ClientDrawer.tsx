'use client'

import { useEffect, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import * as db from '@/lib/db'
import {
  Client, ClientActivity, CLIENT_STATUS_LABELS, FAKTURACE_LABELS, Project, PROJECT_STAV_COLORS,
  PROJECT_STAV_LABELS, PROJECT_STAV_ORDER, PROJECT_TYP_LABELS, Subscription, SUB_STAV_COLORS,
  SUB_STAV_LABELS, SUB_TYP_LABELS, ZDROJ_LABELS, fmtDate, fmtKc, isActiveSub,
} from '@/types/client'

interface Props {
  client: Client
  projects: Project[]
  subscriptions: Subscription[]
  onClose: () => void
}

const today = () => new Date().toISOString().slice(0, 10)
const inputCls = 'w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors [color-scheme:dark]'
const labelCls = 'block text-[10px] text-zinc-500 uppercase tracking-widest mb-1'
const sectionLabelCls = 'block text-[10px] text-zinc-500 uppercase tracking-widest mb-3'

// Text/number/date input that saves on blur (or Enter), like the lead drawer.
function Field({
  label, value, onCommit, type = 'text', placeholder,
}: {
  label: string
  value: string | number | null
  onCommit: (v: string) => void
  type?: 'text' | 'number' | 'date' | 'email' | 'tel'
  placeholder?: string
}) {
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  useEffect(() => { setDraft(value == null ? '' : String(value)) }, [value])
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input
        type={type}
        value={draft}
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { if (draft !== (value == null ? '' : String(value))) onCommit(draft) }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        className={inputCls}
      />
    </label>
  )
}

function Select<T extends string>({
  label, value, options, onChange,
}: {
  label: string
  value: T
  options: Record<T, string>
  onChange: (v: T) => void
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value as T)} className={inputCls}>
        {(Object.keys(options) as T[]).map(k => <option key={k} value={k}>{options[k]}</option>)}
      </select>
    </label>
  )
}

const orNull = (v: string) => (v.trim() ? v.trim() : null)
const toNumber = (v: string) => Math.max(0, Math.round(Number(v.replace(/\s/g, '')) || 0))

export default function ClientDrawer({ client, projects, subscriptions, onClose }: Props) {
  const [visible, setVisible] = useState(false)
  const [tab, setTab] = useState<'detail' | 'historie'>('detail')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => { cancelAnimationFrame(t); window.removeEventListener('keydown', onKey) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 260)
  }

  const save = (updates: Parameters<typeof db.updateClient>[1]) => db.updateClient(client.id, updates)

  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    await db.deleteClient(client.id)
    onClose()
  }

  const mrr = subscriptions.filter(s => isActiveSub(s)).reduce((s, x) => s + x.cena_mesicne, 0)

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-[260ms] ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-[520px] bg-[#141414] border-l border-zinc-800 z-50 flex flex-col transition-transform duration-[260ms] ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-start justify-between px-6 py-5 border-b border-zinc-800 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-tight truncate">{client.nazev}</h2>
            <p className="text-xs text-zinc-500 mt-1">
              {ZDROJ_LABELS[client.zdroj] ?? client.zdroj} · {mrr ? `${fmtKc(mrr)} měsíčně` : 'bez měsíční služby'}
            </p>
          </div>
          <button onClick={handleClose} aria-label="Zavřít" className="text-zinc-500 hover:text-zinc-100 p-1 rounded transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="flex border-b border-zinc-800 px-6 shrink-0">
          {(['detail', 'historie'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-2.5 mr-6 text-xs font-medium border-b-2 transition-colors ${
                tab === t ? 'border-zinc-200 text-zinc-100' : 'border-transparent text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {t === 'detail' ? 'Detail' : 'Historie'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'detail' ? (
            <div className="space-y-8">
              <section className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Field label="Název" value={client.nazev} onCommit={v => save({ nazev: v.trim() || client.nazev })} />
                </div>
                <Select label="Stav" value={client.status} options={CLIENT_STATUS_LABELS} onChange={v => save({ status: v })} />
                <Select label="Zdroj" value={client.zdroj} options={ZDROJ_LABELS} onChange={v => save({ zdroj: v })} />
                <Field label="Kontaktní osoba" value={client.kontakt_jmeno} onCommit={v => save({ kontakt_jmeno: orNull(v) })} />
                <Field label="Telefon" type="tel" value={client.telefon} onCommit={v => save({ telefon: v.trim() })} />
                <Field label="E-mail" type="email" value={client.email} onCommit={v => save({ email: orNull(v) })} />
                <Field label="IČO" value={client.ico} onCommit={v => save({ ico: orNull(v) })} />
                <Field label="Město" value={client.mesto} onCommit={v => save({ mesto: v.trim() })} />
                <Field label="Obor" value={client.kategorie} onCommit={v => save({ kategorie: v.trim() })} placeholder="autoškola, instalatér…" />
              </section>

              <ProjectsSection clientId={client.id} projects={projects} />
              <SubscriptionsSection clientId={client.id} subscriptions={subscriptions} />

              <section>
                <span className={sectionLabelCls}>Poznámka</span>
                <NoteArea value={client.poznamka} onCommit={v => save({ poznamka: orNull(v) })} />
                <p className="text-[11px] text-zinc-600 mt-1.5">Přístupy sem nepište, patří do správce hesel.</p>
              </section>

              <section className="pt-2 border-t border-zinc-800">
                <button
                  onClick={remove}
                  onBlur={() => setConfirmDelete(false)}
                  className={`text-xs transition-colors ${confirmDelete ? 'text-red-300 font-semibold' : 'text-red-400/70 hover:text-red-300'}`}
                >
                  {confirmDelete ? 'Opravdu smazat klienta i s projekty a službami?' : 'Smazat klienta'}
                </button>
              </section>
            </div>
          ) : (
            <History clientId={client.id} />
          )}
        </div>
      </div>
    </>
  )
}

function NoteArea({ value, onCommit }: { value: string | null; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => { setDraft(value ?? '') }, [value])
  return (
    <textarea
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { if (draft !== (value ?? '')) onCommit(draft) }}
      rows={4}
      className={`${inputCls} resize-y`}
    />
  )
}

function ProjectsSection({ clientId, projects }: { clientId: string; projects: Project[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const sorted = [...projects].sort((a, b) => b.created_at.localeCompare(a.created_at))

  async function add() {
    await db.addProject(clientId, {
      nazev: 'Web',
      typ: 'web',
      stav: 'nabidka',
      cena: 0,
      nabidka_at: today(),
      spusteno_at: null,
      zaplaceno_at: null,
      domena: null,
      domena_obnova_at: null,
      vercel_projekt: null,
      github_repo: null,
      poznamka: null,
    })
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <span className={sectionLabelCls.replace('mb-3', '')}>Projekty</span>
        <button onClick={add} className="text-xs text-zinc-400 hover:text-zinc-100 transition-colors">Přidat projekt</button>
      </div>
      {sorted.length === 0 && <p className="text-xs text-zinc-600">Žádné projekty.</p>}
      <div className="space-y-2">
        {sorted.map(p => (
          <div key={p.id} className="border border-zinc-800 rounded-lg">
            <button
              onClick={() => setOpenId(openId === p.id ? null : p.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
            >
              <span className="text-sm text-zinc-100 truncate flex-1">{p.nazev}</span>
              <span className="text-xs tabular-nums text-zinc-400">{fmtKc(p.cena)}</span>
              <span className={`${PROJECT_STAV_COLORS[p.stav]} px-2 py-0.5 rounded text-[11px]`}>{PROJECT_STAV_LABELS[p.stav]}</span>
            </button>
            {openId === p.id && <ProjectForm project={p} />}
          </div>
        ))}
      </div>
    </section>
  )
}

function ProjectForm({ project: p }: { project: Project }) {
  const [confirm, setConfirm] = useState(false)
  const save = (u: Parameters<typeof db.updateProject>[1]) => db.updateProject(p.id, u)

  // Moving to "zaplaceno" stamps the payment date unless one is already set.
  function setStav(stav: Project['stav']) {
    const u: Parameters<typeof db.updateProject>[1] = { stav }
    if (stav === 'zaplaceno' && !p.zaplaceno_at) u.zaplaceno_at = today()
    save(u)
  }

  return (
    <div className="grid grid-cols-2 gap-3 px-3 pb-3 pt-1 border-t border-zinc-800/60">
      <div className="col-span-2">
        <Field label="Název" value={p.nazev} onCommit={v => save({ nazev: v.trim() || p.nazev })} />
      </div>
      <Select label="Typ" value={p.typ} options={PROJECT_TYP_LABELS} onChange={v => save({ typ: v })} />
      <Select
        label="Stav"
        value={p.stav}
        options={Object.fromEntries(PROJECT_STAV_ORDER.map(s => [s, PROJECT_STAV_LABELS[s]])) as typeof PROJECT_STAV_LABELS}
        onChange={setStav}
      />
      <Field label="Cena (Kč)" type="number" value={p.cena} onCommit={v => save({ cena: toNumber(v) })} />
      <Field label="Nabídka" type="date" value={p.nabidka_at} onCommit={v => save({ nabidka_at: orNull(v) })} />
      <Field label="Spuštěno" type="date" value={p.spusteno_at} onCommit={v => save({ spusteno_at: orNull(v) })} />
      <Field label="Zaplaceno" type="date" value={p.zaplaceno_at} onCommit={v => save({ zaplaceno_at: orNull(v) })} />
      <Field label="Doména" value={p.domena} onCommit={v => save({ domena: orNull(v) })} placeholder="example.cz" />
      <Field label="Obnova domény" type="date" value={p.domena_obnova_at} onCommit={v => save({ domena_obnova_at: orNull(v) })} />
      <Field label="Vercel projekt" value={p.vercel_projekt} onCommit={v => save({ vercel_projekt: orNull(v) })} />
      <Field label="GitHub repo" value={p.github_repo} onCommit={v => save({ github_repo: orNull(v) })} placeholder="uzivatel/repo" />
      <div className="col-span-2">
        <span className={labelCls}>Poznámka</span>
        <NoteArea value={p.poznamka} onCommit={v => save({ poznamka: orNull(v) })} />
      </div>
      <div className="col-span-2 flex justify-end">
        <button
          onClick={() => (confirm ? db.deleteProject(p.id) : setConfirm(true))}
          onBlur={() => setConfirm(false)}
          className={`text-xs ${confirm ? 'text-red-300 font-semibold' : 'text-red-400/70 hover:text-red-300'}`}
        >
          {confirm ? 'Opravdu smazat?' : 'Smazat projekt'}
        </button>
      </div>
    </div>
  )
}

function SubscriptionsSection({ clientId, subscriptions }: { clientId: string; subscriptions: Subscription[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const sorted = [...subscriptions].sort((a, b) => b.od.localeCompare(a.od))

  async function add() {
    await db.addSubscription(clientId, {
      typ: 'sprava',
      cena_mesicne: 1490,
      fakturace: 'mesicne',
      od: today(),
      do: null,
      stav: 'aktivni',
      poznamka: null,
    })
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <span className={sectionLabelCls.replace('mb-3', '')}>Měsíční služby</span>
        <button onClick={add} className="text-xs text-zinc-400 hover:text-zinc-100 transition-colors">Přidat službu</button>
      </div>
      {sorted.length === 0 && <p className="text-xs text-zinc-600">Žádné měsíční služby.</p>}
      <div className="space-y-2">
        {sorted.map(s => (
          <div key={s.id} className="border border-zinc-800 rounded-lg">
            <button
              onClick={() => setOpenId(openId === s.id ? null : s.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
            >
              <span className="text-sm text-zinc-100 flex-1">{SUB_TYP_LABELS[s.typ] ?? s.typ}</span>
              <span className="text-xs tabular-nums text-zinc-400">{fmtKc(s.cena_mesicne)} / měs</span>
              <span className={`${SUB_STAV_COLORS[s.stav]} px-2 py-0.5 rounded text-[11px]`}>{SUB_STAV_LABELS[s.stav]}</span>
            </button>
            {openId === s.id && <SubscriptionForm sub={s} />}
          </div>
        ))}
      </div>
    </section>
  )
}

function SubscriptionForm({ sub: s }: { sub: Subscription }) {
  const [confirm, setConfirm] = useState(false)
  const save = (u: Parameters<typeof db.updateSubscription>[1]) => db.updateSubscription(s.id, u)

  // Ending a service without an end date sets it to today, so MRR drops now.
  function setStav(stav: Subscription['stav']) {
    const u: Parameters<typeof db.updateSubscription>[1] = { stav }
    if (stav === 'ukonceno' && !s.do) u.do = today()
    save(u)
  }

  return (
    <div className="grid grid-cols-2 gap-3 px-3 pb-3 pt-1 border-t border-zinc-800/60">
      <Select label="Služba" value={s.typ} options={SUB_TYP_LABELS} onChange={v => save({ typ: v })} />
      <Select label="Stav" value={s.stav} options={SUB_STAV_LABELS} onChange={setStav} />
      <Field label="Cena měsíčně (Kč)" type="number" value={s.cena_mesicne} onCommit={v => save({ cena_mesicne: toNumber(v) })} />
      <Select label="Fakturace" value={s.fakturace} options={FAKTURACE_LABELS} onChange={v => save({ fakturace: v })} />
      <Field label="Od" type="date" value={s.od} onCommit={v => { if (v) save({ od: v }) }} />
      <Field label="Do" type="date" value={s.do} onCommit={v => save({ do: orNull(v) })} />
      <div className="col-span-2">
        <span className={labelCls}>Poznámka</span>
        <NoteArea value={s.poznamka} onCommit={v => save({ poznamka: orNull(v) })} />
      </div>
      <div className="col-span-2 flex justify-end">
        <button
          onClick={() => (confirm ? db.deleteSubscription(s.id) : setConfirm(true))}
          onBlur={() => setConfirm(false)}
          className={`text-xs ${confirm ? 'text-red-300 font-semibold' : 'text-red-400/70 hover:text-red-300'}`}
        >
          {confirm ? 'Opravdu smazat?' : 'Smazat službu'}
        </button>
      </div>
    </div>
  )
}

const ACTIVITY_LABELS: Record<ClientActivity['type'], string> = {
  call:  'Hovor',
  email: 'E-mail',
  note:  'Poznámka',
}

function History({ clientId }: { clientId: string }) {
  const items = useQuery(api.clients.activities, { client_id: clientId as Id<'clients'> }) as ClientActivity[] | undefined
  const [type, setType] = useState<ClientActivity['type']>('call')
  const [note, setNote] = useState('')

  async function add() {
    if (!note.trim()) return
    await db.addClientActivity(clientId, type, note.trim())
    setNote('')
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex gap-2">
          {(Object.keys(ACTIVITY_LABELS) as ClientActivity['type'][]).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${type === t ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {ACTIVITY_LABELS[t]}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add() }}
          rows={3}
          placeholder="Co jste probrali?"
          className={`${inputCls} resize-y`}
        />
        <div className="flex justify-end">
          <button
            onClick={add}
            disabled={!note.trim()}
            className="bg-zinc-100 hover:bg-white disabled:opacity-30 text-zinc-900 rounded px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            Zapsat
          </button>
        </div>
      </div>

      {items === undefined && <p className="text-xs text-zinc-600">Načítám…</p>}
      {items?.length === 0 && <p className="text-xs text-zinc-600">Zatím žádná historie.</p>}
      <ul className="space-y-3">
        {items?.map(a => (
          <li key={a.id} className="border-l-2 border-zinc-800 pl-3">
            <div className="text-[11px] text-zinc-500">
              {ACTIVITY_LABELS[a.type] ?? a.type} · {fmtDate(a.created_at)}
            </div>
            {a.note && <p className="text-sm text-zinc-300 whitespace-pre-wrap mt-0.5">{a.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
