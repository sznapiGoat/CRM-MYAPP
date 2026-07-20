import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { Doc } from './_generated/dataModel'

// Map a Convex document to the app-facing Lead shape (id + string timestamps),
// so components keep using `id`, `created_at`, `updated_at` unchanged.
function toLead(doc: Doc<'leads'>) {
  const { _id, _creationTime, ...rest } = doc
  return { id: _id, ...rest }
}

// Validator for a partial lead update — every column optional.
const leadUpdate = v.object({
  nazev: v.optional(v.string()),
  mesto: v.optional(v.string()),
  telefon: v.optional(v.string()),
  adresa: v.optional(v.string()),
  web: v.optional(v.union(v.string(), v.null())),
  google_maps_url: v.optional(v.string()),
  kategorie: v.optional(v.string()),
  duvod: v.optional(v.string()),
  status: v.optional(v.string()),
  poznamka: v.optional(v.union(v.string(), v.null())),
  rating: v.optional(v.union(v.number(), v.null())),
  last_called_at: v.optional(v.union(v.string(), v.null())),
  follow_up_at: v.optional(v.union(v.string(), v.null())),
  next_action: v.optional(v.union(v.string(), v.null())),
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query('leads').collect()
    docs.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return docs.map(toLead)
  },
})

export const update = mutation({
  args: { id: v.id('leads'), updates: leadUpdate },
  handler: async (ctx, { id, updates }) => {
    await ctx.db.patch(id, { ...updates, updated_at: new Date().toISOString() })
    const doc = await ctx.db.get(id)
    return doc ? toLead(doc) : null
  },
})

export const bulkUpdate = mutation({
  args: { ids: v.array(v.id('leads')), updates: leadUpdate },
  handler: async (ctx, { ids, updates }) => {
    const now = new Date().toISOString()
    for (const id of ids) {
      await ctx.db.patch(id, { ...updates, updated_at: now })
    }
  },
})

export const bulkDelete = mutation({
  args: { ids: v.array(v.id('leads')) },
  handler: async (ctx, { ids }) => {
    for (const id of ids) {
      // Cascade: remove the lead's activities first
      const acts = await ctx.db
        .query('lead_activities')
        .withIndex('by_lead', (q) => q.eq('lead_id', id))
        .collect()
      for (const a of acts) await ctx.db.delete(a._id)
      await ctx.db.delete(id)
    }
  },
})

// Upsert-by-google_maps_url with ignoreDuplicates semantics (matches the old
// Supabase .upsert({ onConflict: 'google_maps_url', ignoreDuplicates: true })).
// Accepts partial rows (import/webhook) and fills required fields with defaults.
export const upsert = mutation({
  args: { rows: v.array(v.any()) },
  handler: async (ctx, { rows }) => {
    let inserted = 0
    for (const row of rows) {
      const gmurl = row.google_maps_url
      if (!gmurl || typeof gmurl !== 'string') continue

      const existing = await ctx.db
        .query('leads')
        .withIndex('by_google_maps_url', (q) => q.eq('google_maps_url', gmurl))
        .first()
      if (existing) continue // ignoreDuplicates

      const now = new Date().toISOString()
      await ctx.db.insert('leads', {
        created_at: now,
        updated_at: now,
        nazev: row.nazev ?? '',
        mesto: row.mesto ?? '',
        telefon: row.telefon ?? '',
        adresa: row.adresa ?? '',
        web: row.web ?? null,
        google_maps_url: gmurl,
        kategorie: row.kategorie ?? '',
        duvod: row.duvod ?? '',
        status: row.status ?? 'novy',
        poznamka: row.poznamka ?? null,
        rating: row.rating ?? null,
        last_called_at: row.last_called_at ?? null,
        follow_up_at: row.follow_up_at ?? null,
        next_action: row.next_action ?? null,
      })
      inserted++
    }
    return { inserted }
  },
})
