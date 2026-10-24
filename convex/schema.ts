import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// CRM Leady — Convex schema (migrated from Supabase Postgres)
export default defineSchema({
  leads: defineTable({
    // created_at / updated_at kept as ISO strings so the app-facing shape stays
    // identical to the old Supabase rows. Convex also stores _creationTime.
    created_at: v.string(),
    updated_at: v.string(),
    nazev: v.string(),
    mesto: v.string(),
    telefon: v.string(),
    adresa: v.string(),
    web: v.union(v.string(), v.null()),
    google_maps_url: v.string(),
    kategorie: v.string(),
    duvod: v.string(),
    status: v.string(),
    poznamka: v.union(v.string(), v.null()),
    rating: v.union(v.number(), v.null()),
    // Number of Google reviews behind `rating`. Optional: rows imported before
    // this field existed simply don't have it.
    reviews_count: v.optional(v.union(v.number(), v.null())),
    // Outreach priority computed by the n8n lead-gen workflow from the website
    // URL: 2 = runs on an outdated site builder, 1 = no website at all.
    // (custom_domain leads score 0 and are never sent here.) Optional — rows
    // imported before the scoring step exist without it.
    priority_score: v.optional(v.union(v.number(), v.null())),
    // Which builder the site runs on, e.g. 'webnode' / 'estranky'. null when
    // the lead has no website.
    platform_tag: v.optional(v.union(v.string(), v.null())),
    last_called_at: v.union(v.string(), v.null()),
    follow_up_at: v.union(v.string(), v.null()),
    next_action: v.optional(v.union(v.string(), v.null())),
  }).index('by_google_maps_url', ['google_maps_url']),

  lead_activities: defineTable({
    created_at: v.string(),
    lead_id: v.id('leads'),
    type: v.string(), // 'called' | 'note' | 'status_change'
    note: v.union(v.string(), v.null()),
    old_status: v.union(v.string(), v.null()),
    new_status: v.union(v.string(), v.null()),
  }).index('by_lead', ['lead_id']),

  // Paying clients. A lead converts into a client once it closes; clients that
  // came from referrals (no lead in the CRM) have lead_id null.
  clients: defineTable({
    created_at: v.string(),
    updated_at: v.string(),
    lead_id: v.union(v.id('leads'), v.null()),
    nazev: v.string(),
    kontakt_jmeno: v.union(v.string(), v.null()),
    telefon: v.string(),
    email: v.union(v.string(), v.null()),
    ico: v.union(v.string(), v.null()),
    mesto: v.string(),
    kategorie: v.string(),
    zdroj: v.string(), // 'cold_call' | 'doporuceni' | 'upwork' | 'jine'
    status: v.string(), // 'aktivni' | 'pozastaveny' | 'ukonceny'
    poznamka: v.union(v.string(), v.null()),
  })
    .index('by_lead_id', ['lead_id'])
    .index('by_status', ['status']),

  // One-off work for a client (web, redesign, SK version…).
  projects: defineTable({
    created_at: v.string(),
    updated_at: v.string(),
    client_id: v.id('clients'),
    nazev: v.string(),
    typ: v.string(), // 'web' | 'redesign' | 'jine'
    stav: v.string(), // 'nabidka' | 'rozpracovano' | 'predano' | 'zaplaceno'
    cena: v.number(), // whole CZK
    nabidka_at: v.union(v.string(), v.null()),
    spusteno_at: v.union(v.string(), v.null()),
    zaplaceno_at: v.union(v.string(), v.null()),
    domena: v.union(v.string(), v.null()),
    domena_obnova_at: v.union(v.string(), v.null()),
    vercel_projekt: v.union(v.string(), v.null()),
    github_repo: v.union(v.string(), v.null()),
    poznamka: v.union(v.string(), v.null()),
  })
    .index('by_client_id', ['client_id'])
    .index('by_stav', ['stav']),

  // Recurring monthly services. MRR = sum of cena_mesicne over active rows.
  subscriptions: defineTable({
    created_at: v.string(),
    updated_at: v.string(),
    client_id: v.id('clients'),
    typ: v.string(), // 'sprava' | 'seo' | 'ads' | 'jine'
    cena_mesicne: v.number(), // whole CZK
    fakturace: v.string(), // 'mesicne' | 'rocne'
    od: v.string(),
    do: v.union(v.string(), v.null()), // null = still running
    stav: v.string(), // 'aktivni' | 'pozastaveno' | 'ukonceno'
    poznamka: v.union(v.string(), v.null()),
  })
    .index('by_client_id', ['client_id'])
    .index('by_stav', ['stav']),

  client_activities: defineTable({
    created_at: v.string(),
    client_id: v.id('clients'),
    type: v.string(), // 'call' | 'email' | 'note'
    note: v.union(v.string(), v.null()),
  }).index('by_client_id', ['client_id']),

  notes: defineTable({
    created_at: v.string(),
    updated_at: v.string(),
    title: v.string(),
    content: v.string(),
    color: v.string(),
    pinned: v.boolean(),
  }),
})
