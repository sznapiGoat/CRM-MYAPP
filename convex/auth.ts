import { query, mutation, QueryCtx, MutationCtx } from './_generated/server'
import { v, ObjectType, PropertyValidators } from 'convex/values'

// Convex funkce jsou veřejné: kdo zná adresu deploymentu, může je volat bez
// hesla do CRM. Proto každá vyžaduje `token` = CRM_TOKEN (proměnná v Convexu
// i ve Vercelu). Server ho přidá sám, prohlížeč ho dostane až po přihlášení.

function assertToken(token: string) {
  const expected = process.env.CRM_TOKEN
  if (!expected || token !== expected) throw new Error('unauthorized')
}

export function crmQuery<A extends PropertyValidators, R>(def: {
  args: A
  handler: (ctx: QueryCtx, args: ObjectType<A>) => R
}) {
  return query({
    args: { ...def.args, token: v.string() },
    handler: (ctx, { token, ...args }) => {
      assertToken(token)
      return def.handler(ctx, args as ObjectType<A>)
    },
  })
}

export function crmMutation<A extends PropertyValidators, R>(def: {
  args: A
  handler: (ctx: MutationCtx, args: ObjectType<A>) => R
}) {
  return mutation({
    args: { ...def.args, token: v.string() },
    handler: (ctx, { token, ...args }) => {
      assertToken(token)
      return def.handler(ctx, args as ObjectType<A>)
    },
  })
}
