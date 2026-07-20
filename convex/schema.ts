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

  notes: defineTable({
    created_at: v.string(),
    updated_at: v.string(),
    title: v.string(),
    content: v.string(),
    color: v.string(),
    pinned: v.boolean(),
  }),
})
