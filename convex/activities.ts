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
