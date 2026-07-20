import { ConvexHttpClient } from 'convex/browser'

const stripBom = (v: string) => (v.charCodeAt(0) === 0xfeff ? v.slice(1) : v)

const url = stripBom(process.env.NEXT_PUBLIC_CONVEX_URL ?? '')

// One-shot (non-reactive) Convex client. The app fetches on mount and applies
// optimistic updates locally, so it doesn't need the reactive subscription client.
export const convex = new ConvexHttpClient(url)
