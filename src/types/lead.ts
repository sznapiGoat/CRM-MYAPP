export type LeadStatus =
  | 'novy'
  | 'zavolano'
  | 'zajem'
  | 'demo_poslano'
  | 'ceka'
  | 'zavreno'
  | 'nezajem'

export const STATUS_ORDER: LeadStatus[] = [
  'novy',
  'zavolano',
  'zajem',
  'demo_poslano',
  'ceka',
  'zavreno',
  'nezajem',
]

export const STATUS_LABELS: Record<LeadStatus, string> = {
  novy:         'Nový',
  zavolano:     'Zavoláno',
  zajem:        'Zájem',
  demo_poslano: 'Demo posláno',
  ceka:         'Čeká',
  zavreno:      'Zavřeno',
  nezajem:      'Nezájem',
}

// Full class strings — must be complete for Tailwind to detect them
export const STATUS_COLORS: Record<LeadStatus, string> = {
  novy:         'bg-zinc-700 text-zinc-200',
  zavolano:     'bg-blue-900 text-blue-200',
  zajem:        'bg-yellow-900 text-yellow-200',
  demo_poslano: 'bg-purple-900 text-purple-200',
  ceka:         'bg-orange-900 text-orange-200',
  zavreno:      'bg-green-900 text-green-200',
  nezajem:      'bg-red-900 text-red-200',
}

export interface Lead {
  id:             string
  created_at:     string
  updated_at:     string
  nazev:          string
  mesto:          string
  telefon:        string
  adresa:         string
  web:            string | null
  google_maps_url:string
  kategorie:      string
  duvod:          string
  status:         LeadStatus
  poznamka:       string | null
  rating:         number | null
  last_called_at: string | null
}
