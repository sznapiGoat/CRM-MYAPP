import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

// Strip Convex system fields into the app-facing shape (id + string timestamps),
// same convention as leads.ts / notes.ts.
function strip<T extends { _id: string; _creationTime: number }>(doc: T) {
  const { _id, _creationTime, ...rest } = doc
  return { id: _id, ...rest }
}

const str = v.string()
const strOrNull = v.union(v.string(), v.null())

const clientFields = {
  nazev: str,
  kontakt_jmeno: strOrNull,
  telefon: str,
  email: strOrNull,
  ico: strOrNull,
  mesto: str,
  kategorie: str,
  zdroj: str,
  status: str,
  poznamka: strOrNull,
}

const projectFields = {
  nazev: str,
  typ: str,
  stav: str,
  cena: v.number(),
  nabidka_at: strOrNull,
  spusteno_at: strOrNull,
  zaplaceno_at: strOrNull,
  domena: strOrNull,
  domena_obnova_at: strOrNull,
  vercel_projekt: strOrNull,
  github_repo: strOrNull,
  poznamka: strOrNull,
}

const subscriptionFields = {
  typ: str,
  cena_mesicne: v.number(),
  fakturace: str,
  od: str,
  do: strOrNull,
  stav: str,
  poznamka: strOrNull,
}

// Partial-update validators: every field optional.
const clientUpdate = v.object({
  nazev: v.optional(str),
  kontakt_jmeno: v.optional(strOrNull),
  telefon: v.optional(str),
  email: v.optional(strOrNull),
  ico: v.optional(strOrNull),
  mesto: v.optional(str),
  kategorie: v.optional(str),
  zdroj: v.optional(str),
  status: v.optional(str),
  poznamka: v.optional(strOrNull),
})

const projectUpdate = v.object({
  nazev: v.optional(str),
  typ: v.optional(str),
  stav: v.optional(str),
  cena: v.optional(v.number()),
  nabidka_at: v.optional(strOrNull),
  spusteno_at: v.optional(strOrNull),
  zaplaceno_at: v.optional(strOrNull),
  domena: v.optional(strOrNull),
  domena_obnova_at: v.optional(strOrNull),
  vercel_projekt: v.optional(strOrNull),
  github_repo: v.optional(strOrNull),
  poznamka: v.optional(strOrNull),
})

const subscriptionUpdate = v.object({
  typ: v.optional(str),
  cena_mesicne: v.optional(v.number()),
  fakturace: v.optional(str),
  od: v.optional(str),
  do: v.optional(strOrNull),
  stav: v.optional(str),
  poznamka: v.optional(strOrNull),
})

// ---- Queries --------------------------------------------------------------

// Everything the client page needs in one reactive subscription. The tables
// stay small (tens of rows), so a full read is cheaper than per-client queries.
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const clients = await ctx.db.query('clients').collect()
    const projects = await ctx.db.query('projects').collect()
    const subscriptions = await ctx.db.query('subscriptions').collect()
    clients.sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'))
    return {
      clients: clients.map(strip),
      projects: projects.map(strip),
      subscriptions: subscriptions.map(strip),
    }
  },
})

export const byLead = query({
  args: { lead_id: v.id('leads') },
  handler: async (ctx, { lead_id }) => {
    const doc = await ctx.db
      .query('clients')
      .withIndex('by_lead_id', (q) => q.eq('lead_id', lead_id))
      .first()
    return doc ? strip(doc) : null
  },
})

export const activities = query({
  args: { client_id: v.id('clients') },
  handler: async (ctx, { client_id }) => {
    const docs = await ctx.db
      .query('client_activities')
      .withIndex('by_client_id', (q) => q.eq('client_id', client_id))
      .collect()
    docs.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return docs.map(strip)
  },
})

// ---- Clients --------------------------------------------------------------

export const create = mutation({
  args: { fields: v.object({ ...clientFields, lead_id: v.union(v.id('leads'), v.null()) }) },
  handler: async (ctx, { fields }) => {
    const now = new Date().toISOString()
    return await ctx.db.insert('clients', { ...fields, created_at: now, updated_at: now })
  },
})

export const update = mutation({
  args: { id: v.id('clients'), updates: clientUpdate },
  handler: async (ctx, { id, updates }) => {
    await ctx.db.patch(id, { ...updates, updated_at: new Date().toISOString() })
  },
})

export const remove = mutation({
  args: { id: v.id('clients') },
  handler: async (ctx, { id }) => {
    // Cascade: projects, subscriptions and history belong to the client.
    for (const table of ['projects', 'subscriptions', 'client_activities'] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex('by_client_id', (q) => q.eq('client_id', id))
        .collect()
      for (const r of rows) await ctx.db.delete(r._id)
    }
    await ctx.db.delete(id)
  },
})

// Turn a closed lead into a client. Idempotent: a lead converts at most once,
// a second call returns the existing client. Also moves the lead to 'zavreno'
// and logs the status change so the weekly numbers count the deal.
export const convertLead = mutation({
  args: { lead_id: v.id('leads') },
  handler: async (ctx, { lead_id }) => {
    const existing = await ctx.db
      .query('clients')
      .withIndex('by_lead_id', (q) => q.eq('lead_id', lead_id))
      .first()
    if (existing) return existing._id

    const lead = await ctx.db.get(lead_id)
    if (!lead) throw new Error('Lead neexistuje')

    const now = new Date().toISOString()
    const id = await ctx.db.insert('clients', {
      created_at: now,
      updated_at: now,
      lead_id,
      nazev: lead.nazev,
      kontakt_jmeno: null,
      telefon: lead.telefon,
      email: null,
      ico: null,
      mesto: lead.mesto,
      kategorie: lead.kategorie,
      zdroj: 'cold_call',
      status: 'aktivni',
      poznamka: lead.poznamka,
    })

    if (lead.status !== 'zavreno') {
      await ctx.db.patch(lead_id, { status: 'zavreno', updated_at: now })
      await ctx.db.insert('lead_activities', {
        created_at: now,
        lead_id,
        type: 'status_change',
        note: null,
        old_status: lead.status,
        new_status: 'zavreno',
      })
    }
    return id
  },
})

// ---- Projects -------------------------------------------------------------

export const addProject = mutation({
  args: { client_id: v.id('clients'), fields: v.object(projectFields) },
  handler: async (ctx, { client_id, fields }) => {
    const now = new Date().toISOString()
    return await ctx.db.insert('projects', { ...fields, client_id, created_at: now, updated_at: now })
  },
})

export const updateProject = mutation({
  args: { id: v.id('projects'), updates: projectUpdate },
  handler: async (ctx, { id, updates }) => {
    await ctx.db.patch(id, { ...updates, updated_at: new Date().toISOString() })
  },
})

export const removeProject = mutation({
  args: { id: v.id('projects') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id)
  },
})

// ---- Subscriptions --------------------------------------------------------

export const addSubscription = mutation({
  args: { client_id: v.id('clients'), fields: v.object(subscriptionFields) },
  handler: async (ctx, { client_id, fields }) => {
    const now = new Date().toISOString()
    return await ctx.db.insert('subscriptions', { ...fields, client_id, created_at: now, updated_at: now })
  },
})

export const updateSubscription = mutation({
  args: { id: v.id('subscriptions'), updates: subscriptionUpdate },
  handler: async (ctx, { id, updates }) => {
    await ctx.db.patch(id, { ...updates, updated_at: new Date().toISOString() })
  },
})

export const removeSubscription = mutation({
  args: { id: v.id('subscriptions') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id)
  },
})

// ---- History --------------------------------------------------------------

export const addActivity = mutation({
  args: { client_id: v.id('clients'), type: v.string(), note: strOrNull },
  handler: async (ctx, { client_id, type, note }) => {
    await ctx.db.insert('client_activities', {
      created_at: new Date().toISOString(),
      client_id,
      type,
      note,
    })
  },
})
