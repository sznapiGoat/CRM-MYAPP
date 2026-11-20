import { convex } from './convexClient'
import { crmToken } from './crmToken'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { Lead, LeadActivity, ActivityInput } from '@/types/lead'
import type { Note } from '@/types/note'
import type { ClientActivity, ClientInput, ProjectInput, SubscriptionInput } from '@/types/client'

// Thin data-access layer over Convex. Replaces the old Supabase query chains.
// Convex document ids are strings; components treat lead/note ids as plain
// strings, so we cast at the boundary.
const leadId = (id: string) => id as Id<'leads'>
const noteId = (id: string) => id as Id<'notes'>

// ---- Leads ----------------------------------------------------------------

export async function listLeads(): Promise<Lead[]> {
  return (await convex.query(api.leads.list, { token: crmToken() })) as unknown as Lead[]
}

export async function updateLead(
  id: string,
  updates: Partial<Lead>
): Promise<Lead | null> {
  return (await convex.mutation(api.leads.update, { token: crmToken(), 
    id: leadId(id),
    updates,
  })) as unknown as Lead | null
}

export async function bulkUpdateLeads(
  ids: string[],
  updates: Partial<Lead>
): Promise<void> {
  await convex.mutation(api.leads.bulkUpdate, { token: crmToken(),  ids: ids.map(leadId), updates })
}

export async function bulkDeleteLeads(ids: string[]): Promise<void> {
  await convex.mutation(api.leads.bulkDelete, { token: crmToken(),  ids: ids.map(leadId) })
}

export async function upsertLeads(
  rows: Record<string, unknown>[]
): Promise<{ inserted: number }> {
  return await convex.mutation(api.leads.upsert, { token: crmToken(),  rows })
}

// ---- Activities -----------------------------------------------------------

export async function listActivities(leadIdStr: string): Promise<LeadActivity[]> {
  return (await convex.query(api.activities.listByLead, { token: crmToken(), 
    lead_id: leadId(leadIdStr),
  })) as unknown as LeadActivity[]
}

export async function insertActivity(
  leadIdStr: string,
  input: ActivityInput
): Promise<void> {
  await convex.mutation(api.activities.insert, { token: crmToken(), 
    lead_id: leadId(leadIdStr),
    type: input.type,
    note: input.note ?? null,
    old_status: input.old_status ?? null,
    new_status: input.new_status ?? null,
  })
}

// ---- Notes ----------------------------------------------------------------

export async function listNotes(): Promise<Note[]> {
  return (await convex.query(api.notes.list, { token: crmToken() })) as unknown as Note[]
}

export async function createNote(): Promise<Note | null> {
  return (await convex.mutation(api.notes.create, { token: crmToken() })) as unknown as Note | null
}

export async function updateNote(
  id: string,
  updates: Partial<Note>
): Promise<Note | null> {
  return (await convex.mutation(api.notes.update, { token: crmToken(), 
    id: noteId(id),
    updates,
  })) as unknown as Note | null
}

export async function deleteNote(id: string): Promise<void> {
  await convex.mutation(api.notes.remove, { token: crmToken(),  id: noteId(id) })
}

// ---- Clients --------------------------------------------------------------

const clientId = (id: string) => id as Id<'clients'>

export async function createClient(fields: ClientInput): Promise<string> {
  return await convex.mutation(api.clients.create, { token: crmToken(), 
    fields: { ...fields, lead_id: fields.lead_id as Id<'leads'> | null },
  })
}

export async function updateClient(id: string, updates: Partial<ClientInput>): Promise<void> {
  const { lead_id: _ignored, ...rest } = updates
  await convex.mutation(api.clients.update, { token: crmToken(),  id: clientId(id), updates: rest })
}

export async function deleteClient(id: string): Promise<void> {
  await convex.mutation(api.clients.remove, { token: crmToken(),  id: clientId(id) })
}

export async function convertLeadToClient(leadIdStr: string): Promise<string> {
  return await convex.mutation(api.clients.convertLead, { token: crmToken(),  lead_id: leadId(leadIdStr) })
}

export async function addProject(clientIdStr: string, fields: ProjectInput): Promise<void> {
  await convex.mutation(api.clients.addProject, { token: crmToken(),  client_id: clientId(clientIdStr), fields })
}

export async function updateProject(id: string, updates: Partial<ProjectInput>): Promise<void> {
  await convex.mutation(api.clients.updateProject, { token: crmToken(),  id: id as Id<'projects'>, updates })
}

export async function deleteProject(id: string): Promise<void> {
  await convex.mutation(api.clients.removeProject, { token: crmToken(),  id: id as Id<'projects'> })
}

export async function addSubscription(clientIdStr: string, fields: SubscriptionInput): Promise<void> {
  await convex.mutation(api.clients.addSubscription, { token: crmToken(),  client_id: clientId(clientIdStr), fields })
}

export async function updateSubscription(id: string, updates: Partial<SubscriptionInput>): Promise<void> {
  await convex.mutation(api.clients.updateSubscription, { token: crmToken(),  id: id as Id<'subscriptions'>, updates })
}

export async function deleteSubscription(id: string): Promise<void> {
  await convex.mutation(api.clients.removeSubscription, { token: crmToken(),  id: id as Id<'subscriptions'> })
}

export async function addClientActivity(
  clientIdStr: string,
  type: ClientActivity['type'],
  note: string | null,
): Promise<void> {
  await convex.mutation(api.clients.addActivity, { token: crmToken(),  client_id: clientId(clientIdStr), type, note })
}
