'use client'

import { ConvexProvider } from 'convex/react'
import { convexReact } from '@/lib/convexClient'
import { setCrmToken } from '@/lib/crmToken'

export default function Providers({ token, children }: { token: string; children: React.ReactNode }) {
  setCrmToken(token)
  return <ConvexProvider client={convexReact}>{children}</ConvexProvider>
}
