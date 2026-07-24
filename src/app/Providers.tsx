'use client'

import { ConvexProvider } from 'convex/react'
import { convexReact } from '@/lib/convexClient'

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ConvexProvider client={convexReact}>{children}</ConvexProvider>
}
