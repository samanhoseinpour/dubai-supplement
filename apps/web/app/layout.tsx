import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { vazirmatn } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  title: 'دبی ساپلیمنت',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
