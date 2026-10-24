import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { Doc } from './_generated/dataModel'

function toActivity(doc: Doc<'lead_activities'>) {
  const { _id, _creationTime, ...rest } = doc
  return { id: _id, ...rest }
}

export const listByLead = query({
  args: { lead_id: v.id('leads') },
  handler: async (ctx, { lead_id }) => {
    const docs = await ctx.db
      .query('lead_activities')
      .withIndex('by_lead', (q) => q.eq('lead_id', lead_id))
      .collect()
    docs.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return docs.map(toActivity)
  },
})

export const insert = mutation({
  args: {
    lead_id: v.id('leads'),
    type: v.string(),
    note: v.optional(v.union(v.string(), v.null())),
    old_status: v.optional(v.union(v.string(), v.null())),
    new_status: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('lead_activities', {
      created_at: new Date().toISOString(),
      lead_id: args.lead_id,
      type: args.type,
      note: args.note ?? null,
      old_status: args.old_status ?? null,
      new_status: args.new_status ?? null,
    })
  },
})

// Monday (UTC) of the week an ISO timestamp falls in, as 'YYYY-MM-DD'.
function weekStart(iso: string): string {
  const d = new Date(iso)
  const day = (d.getUTCDay() + 6) % 7 // 0 = Monday
  d.setUTCDate(d.getUTCDate() - day)
  return d.toISOString().slice(0, 10)
}

// Sales funnel per week, derived from the activity log: how many leads were
// reached, how many showed interest, got a demo, and closed. Counts distinct
// leads per week so re-clicking a status does not inflate the numbers.
export const weeklyStats = query({
  args: { weeks: v.number() },
  handler: async (ctx, { weeks }) => {
    const since = new Date()
    since.setUTCDate(since.getUTCDate() - weeks * 7)
    const sinceIso = weekStart(since.toISOString())

    const docs = await ctx.db.query('lead_activities').collect()
    const buckets = new Map<string, { osloveno: Set<string>; zajem: Set<string>; demo: Set<string>; zakazky: Set<string> }>()
    const bucket = (w: string) => {
      let b = buckets.get(w)
      if (!b) {
        b = { osloveno: new Set(), zajem: new Set(), demo: new Set(), zakazky: new Set() }
        buckets.set(w, b)
      }
      return b
    }

    for (const a of docs) {
      const w = weekStart(a.created_at)
      if (w < sinceIso) continue
      const b = bucket(w)
      const lead = a.lead_id as string
      if (a.type === 'called' || (a.type === 'status_change' && a.old_status === 'novy')) b.osloveno.add(lead)
      if (a.type !== 'status_change') continue
      if (a.new_status === 'zajem' || a.new_status === 'ceka') b.zajem.add(lead)
      if (a.new_status === 'demo_poslano') b.demo.add(lead)
      if (a.new_status === 'zavreno') b.zakazky.add(lead)
    }

    const out = []
    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - i * 7)
      const w = weekStart(d.toISOString())
      const b = buckets.get(w)
      out.push({
        week: w,
        osloveno: b?.osloveno.size ?? 0,
        zajem: b?.zajem.size ?? 0,
        demo: b?.demo.size ?? 0,
        zakazky: b?.zakazky.size ?? 0,
      })
    }
    return out
  },
})
