import { Lead } from '@/types/lead'

interface Props {
  leads: Lead[]
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  )
}

function isDueToday(dateStr: string | null): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)
  return d <= todayEnd
}

export default function StatsBar({ leads }: Props) {
  const dueCount = leads.filter(l => isDueToday(l.follow_up_at)).length

  const stats = [
    { label: 'Celkem leadů',  value: leads.length,                                              amber: false },
    { label: 'Zavoláno dnes', value: leads.filter(l => isToday(l.last_called_at)).length,        amber: false },
    { label: 'Zájem',         value: leads.filter(l => l.status === 'zajem').length,             amber: false },
    { label: 'Demo posláno',  value: leads.filter(l => l.status === 'demo_poslano').length,      amber: false },
    { label: 'Sledovat dnes', value: dueCount,                                                   amber: true  },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {stats.map(s => (
        <div
          key={s.label}
          className={`bg-zinc-900 border rounded-lg px-4 py-3 ${
            s.amber && s.value > 0 ? 'border-amber-800' : 'border-zinc-800'
          }`}
        >
          <div className={`text-2xl font-bold tabular-nums ${s.amber && s.value > 0 ? 'text-amber-400' : ''}`}>
            {s.value}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  )
}
