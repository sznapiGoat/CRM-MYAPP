import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { Doc } from './_generated/dataModel'

function toNote(doc: Doc<'notes'>) {
  const { _id, _creationTime, ...rest } = doc
  return { id: _id, ...rest }
}

const noteUpdate = v.object({
  title: v.optional(v.string()),
  content: v.optional(v.string()),
  color: v.optional(v.string()),
  pinned: v.optional(v.boolean()),
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query('notes').collect()
    // pinned first, then most-recently updated
    docs.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updated_at.localeCompare(a.updated_at)
    })
    return docs.map(toNote)
  },
})

export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date().toISOString()
    const id = await ctx.db.insert('notes', {
      created_at: now,
      updated_at: now,
      title: '',
      content: '',
      color: 'default',
      pinned: false,
    })
    const doc = await ctx.db.get(id)
    return doc ? toNote(doc) : null
  },
})

export const update = mutation({
  args: { id: v.id('notes'), updates: noteUpdate },
  handler: async (ctx, { id, updates }) => {
    await ctx.db.patch(id, { ...updates, updated_at: new Date().toISOString() })
    const doc = await ctx.db.get(id)
    return doc ? toNote(doc) : null
  },
})

export const remove = mutation({
  args: { id: v.id('notes') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id)
  },
})
