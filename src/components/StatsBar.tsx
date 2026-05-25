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

export default function StatsBar({ leads }: Props) {
  const stats = [
    { label: 'Celkem leadů',   value: leads.length },
    { label: 'Zavoláno dnes',  value: leads.filter(l => isToday(l.last_called_at)).length },
    { label: 'Zájem',          value: leads.filter(l => l.status === 'zajem').length },
    { label: 'Demo posláno',   value: leads.filter(l => l.status === 'demo_poslano').length },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(s => (
        <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
          <div className="text-2xl font-bold tabular-nums">{s.value}</div>
          <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  )
}
