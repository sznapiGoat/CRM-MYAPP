import { Lead, LeadStatus, STATUS_COLORS } from '@/types/lead'

interface Props {
  leads: Lead[]
  onFilterStatus?: (status: LeadStatus | null) => void
  onFilterDueToday?: () => void
}

// Extract just the `bg-*` class so we can render a small status dot.
function statusDot(status: LeadStatus): string {
  return STATUS_COLORS[status].split(' ').find(c => c.startsWith('bg-')) ?? 'bg-zinc-500'
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

  const stats: { label: string; value: number; amber: boolean; dot?: LeadStatus; onClick?: () => void }[] = [
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
      dot: 'zajem',
      onClick: onFilterStatus ? () => onFilterStatus('zajem') : undefined,
    },
    {
      label: 'Demo posláno',
      value: leads.filter(l => l.status === 'demo_poslano').length,
      amber: false,
      dot: 'demo_poslano',
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
          className={`bg-gradient-to-b from-zinc-900 to-zinc-900/60 border rounded-xl px-4 py-3 transition-all duration-150 ${
            s.amber && s.value > 0 ? 'border-amber-800/80' : 'border-zinc-800'
          } ${s.onClick ? 'cursor-pointer hover:border-zinc-600 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30' : ''}`}
        >
          <div className={`text-2xl font-bold tabular-nums tracking-tight ${s.amber && s.value > 0 ? 'text-amber-400' : 'text-zinc-100'}`}>
            {s.value}
          </div>
          <div className={`text-xs mt-0.5 flex items-center gap-1.5 ${s.onClick ? 'text-zinc-400' : 'text-zinc-500'}`}>
            {s.dot && <span className={`${statusDot(s.dot)} w-2 h-2 rounded-full shrink-0`} />}
            {s.label}
            {s.onClick && !s.dot && (
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
