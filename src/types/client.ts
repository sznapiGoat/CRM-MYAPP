export type ClientStatus = 'aktivni' | 'pozastaveny' | 'ukonceny'
export type ClientZdroj = 'cold_call' | 'doporuceni' | 'upwork' | 'jine'
export type ProjectTyp = 'web' | 'redesign' | 'jine'
export type ProjectStav = 'nabidka' | 'rozpracovano' | 'predano' | 'zaplaceno'
export type SubscriptionTyp = 'sprava' | 'seo' | 'ads' | 'jine'
export type SubscriptionStav = 'aktivni' | 'pozastaveno' | 'ukonceno'
export type Fakturace = 'mesicne' | 'rocne'

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  aktivni:     'Aktivní',
  pozastaveny: 'Pozastavený',
  ukonceny:    'Ukončený',
}

export const ZDROJ_LABELS: Record<ClientZdroj, string> = {
  cold_call:  'Cold call',
  doporuceni: 'Doporučení',
  upwork:     'Upwork',
  jine:       'Jiné',
}

export const PROJECT_TYP_LABELS: Record<ProjectTyp, string> = {
  web:      'Web',
  redesign: 'Redesign',
  jine:     'Jiné',
}

export const PROJECT_STAV_ORDER: ProjectStav[] = ['nabidka', 'rozpracovano', 'predano', 'zaplaceno']

export const PROJECT_STAV_LABELS: Record<ProjectStav, string> = {
  nabidka:      'Nabídka',
  rozpracovano: 'Rozpracováno',
  predano:      'Předáno',
  zaplaceno:    'Zaplaceno',
}

// Full class strings, Tailwind only picks up complete class names
export const PROJECT_STAV_COLORS: Record<ProjectStav, string> = {
  nabidka:      'bg-orange-900 text-orange-200',
  rozpracovano: 'bg-blue-900 text-blue-200',
  predano:      'bg-purple-900 text-purple-200',
  zaplaceno:    'bg-green-900 text-green-200',
}

export const SUB_TYP_LABELS: Record<SubscriptionTyp, string> = {
  sprava: 'Správa webu',
  seo:    'SEO',
  ads:    'Google Ads',
  jine:   'Jiné',
}

export const SUB_STAV_LABELS: Record<SubscriptionStav, string> = {
  aktivni:     'Běží',
  pozastaveno: 'Pozastaveno',
  ukonceno:    'Ukončeno',
}

export const SUB_STAV_COLORS: Record<SubscriptionStav, string> = {
  aktivni:     'bg-green-900 text-green-200',
  pozastaveno: 'bg-orange-900 text-orange-200',
  ukonceno:    'bg-zinc-700 text-zinc-300',
}

export const FAKTURACE_LABELS: Record<Fakturace, string> = {
  mesicne: 'měsíčně',
  rocne:   'ročně',
}

export interface Client {
  id:            string
  created_at:    string
  updated_at:    string
  lead_id:       string | null
  nazev:         string
  kontakt_jmeno: string | null
  telefon:       string
  email:         string | null
  ico:           string | null
  mesto:         string
  kategorie:     string
  zdroj:         ClientZdroj
  status:        ClientStatus
  poznamka:      string | null
}

export interface Project {
  id:               string
  created_at:       string
  updated_at:       string
  client_id:        string
  nazev:            string
  typ:              ProjectTyp
  stav:             ProjectStav
  cena:             number
  nabidka_at:       string | null
  spusteno_at:      string | null
  zaplaceno_at:     string | null
  domena:           string | null
  domena_obnova_at: string | null
  vercel_projekt:   string | null
  github_repo:      string | null
  poznamka:         string | null
}

export interface Subscription {
  id:           string
  created_at:   string
  updated_at:   string
  client_id:    string
  typ:          SubscriptionTyp
  cena_mesicne: number
  fakturace:    Fakturace
  od:           string
  do:           string | null
  stav:         SubscriptionStav
  poznamka:     string | null
}

export interface ClientActivity {
  id:         string
  created_at: string
  client_id:  string
  type:       'call' | 'email' | 'note'
  note:       string | null
}

export interface WeekStats {
  week:     string
  osloveno: number
  zajem:    number
  demo:     number
  zakazky:  number
}

export type ClientInput = Omit<Client, 'id' | 'created_at' | 'updated_at'>
export type ProjectInput = Omit<Project, 'id' | 'created_at' | 'updated_at' | 'client_id'>
export type SubscriptionInput = Omit<Subscription, 'id' | 'created_at' | 'updated_at' | 'client_id'>

export const fmtKc = (n: number) => `${n.toLocaleString('cs-CZ')} Kč`

export const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }) : ''

export const isActiveSub = (s: Subscription, today = new Date().toISOString().slice(0, 10)) =>
  s.stav === 'aktivni' && s.od <= today && (!s.do || s.do >= today)

export const mrrOf = (subs: Subscription[]) =>
  subs.filter(s => isActiveSub(s)).reduce((sum, s) => sum + s.cena_mesicne, 0)
