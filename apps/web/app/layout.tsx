import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lopez Family Finances',
  description: 'Private household finance dashboard'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
