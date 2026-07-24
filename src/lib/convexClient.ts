import { ConvexHttpClient } from 'convex/browser'
import { ConvexReactClient } from 'convex/react'

const stripBom = (v: string) => (v.charCodeAt(0) === 0xfeff ? v.slice(1) : v)

const url = stripBom(process.env.NEXT_PUBLIC_CONVEX_URL ?? '')

// One-shot (non-reactive) Convex client — used by the mutation helpers in db.ts
// and for import/webhook paths that fire a single request.
export const convex = new ConvexHttpClient(url)

// Reactive client — powers live `useQuery` subscriptions in the UI so the lead
// list updates in real time (across tabs/devices) without a manual refresh.
export const convexReact = new ConvexReactClient(url)
