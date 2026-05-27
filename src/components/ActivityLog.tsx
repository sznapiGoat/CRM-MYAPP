'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LeadActivity, STATUS_LABELS } from '@/types/lead'

interface Props {
  leadId: string
}

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('cs-CZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function ActivityRow({ a }: { a: LeadActivity }) {
  if (a.type === 'called') {
    return (
      <div className="flex gap-3 text-xs py-2 border-b border-zinc-800/50">
        <span className="text-zinc-600 shrink-0 w-[120px]">{fmtDateTime(a.created_at)}</span>
        <span className="text-blue-400 font-medium">Zavoláno</span>
        {a.note && <span className="text-zinc-500 truncate">{a.note}</span>}
      </div>
    )
  }

  if (a.type === 'status_change') {
    const from = a.old_status
      ? (STATUS_LABELS as Record<string, string>)[a.old_status] ?? a.old_status
      : '?'
    const to = a.new_status
      ? (STATUS_LABELS as Record<string, string>)[a.new_status] ?? a.new_status
      : '?'
    return (
      <div className="flex gap-3 text-xs py-2 border-b border-zinc-800/50">
        <span className="text-zinc-600 shrink-0 w-[120px]">{fmtDateTime(a.created_at)}</span>
        <span className="text-zinc-400">
          <span className="text-zinc-500">{from}</span>
          {' '}→{' '}
          <span className="text-zinc-200">{to}</span>
        </span>
      </div>
    )
  }

  if (a.type === 'note') {
    return (
      <div className="flex gap-3 text-xs py-2 border-b border-zinc-800/50">
        <span className="text-zinc-600 shrink-0 w-[120px]">{fmtDateTime(a.created_at)}</span>
        <span className="text-zinc-500 italic truncate">{a.note}</span>
      </div>
    )
  }

  return null
}

export default function ActivityLog({ leadId }: Props) {
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase
      .from('lead_activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setActivities((data ?? []) as LeadActivity[])
        setLoading(false)
      })
  }, [leadId])

  if (loading) {
    return <div className="text-xs text-zinc-600 py-4">Načítám historii…</div>
  }

  if (activities.length === 0) {
    return <div className="text-xs text-zinc-600 py-4">Zatím žádná aktivita.</div>
  }

  return (
    <div>
      {activities.map(a => <ActivityRow key={a.id} a={a} />)}
    </div>
  )
}
