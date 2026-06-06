import { Lead, LeadStatus } from '@/types/lead'

interface Props {
  leads: Lead[]
  onFilterStatus?: (status: LeadStatus | null) => void
  onFilterDueToday?: () => void
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

export default function StatsBar({ leads, onFilterStatus, onFilterDueToday }: Props) {
  const dueCount = leads.filter(l => isDueToday(l.follow_up_at)).length

  const stats: { label: string; value: number; amber: boolean; onClick?: () => void }[] = [
    {
      label: 'Celkem leadů',
      value: leads.length,
      amber: false,
      onClick: onFilterStatus ? () => onFilterStatus(null) : undefined,
    },
    {
      label: 'Zavoláno dnes',
      value: leads.filter(l => isToday(l.last_called_at)).length,
      amber: false,
    },
    {
      label: 'Zájem',
      value: leads.filter(l => l.status === 'zajem').length,
      amber: false,
      onClick: onFilterStatus ? () => onFilterStatus('zajem') : undefined,
    },
    {
      label: 'Demo posláno',
      value: leads.filter(l => l.status === 'demo_poslano').length,
      amber: false,
      onClick: onFilterStatus ? () => onFilterStatus('demo_poslano') : undefined,
    },
    {
      label: 'Sledovat dnes',
      value: dueCount,
      amber: true,
      onClick: onFilterDueToday,
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {stats.map(s => (
        <div
          key={s.label}
          onClick={s.onClick}
          className={`bg-zinc-900 border rounded-lg px-4 py-3 transition-colors ${
            s.amber && s.value > 0 ? 'border-amber-800' : 'border-zinc-800'
          } ${s.onClick ? 'cursor-pointer hover:border-zinc-600' : ''}`}
        >
          <div className={`text-2xl font-bold tabular-nums ${s.amber && s.value > 0 ? 'text-amber-400' : ''}`}>
            {s.value}
          </div>
          <div className={`text-xs mt-0.5 flex items-center gap-1 ${s.onClick ? 'text-zinc-400' : 'text-zinc-500'}`}>
            {s.label}
            {s.onClick && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="opacity-40">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
