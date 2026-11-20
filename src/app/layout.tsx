import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from './Providers'

export const dynamic = 'force-dynamic'

const inter = Inter({ subsets: ['latin', 'latin-ext'] })

export const metadata: Metadata = {
  title: 'CRM — Leady',
  description: 'CRM pro freelance webdesignéra',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body className={inter.className}>
        <Providers token={process.env.CRM_TOKEN ?? ''}>{children}</Providers>
      </body>
    </html>
  )
}
