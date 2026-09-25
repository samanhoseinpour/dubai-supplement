import { formatJalaliYear } from '@ds/persian'
import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import type { ReactNode } from 'react'
import { Footer } from '@/components/site/footer'
import { Header } from '@/components/site/header'
import { Providers } from '@/components/site/providers'
import { copy, SITE_NAME } from '@/lib/copy'
import { siteUrl } from '@/lib/site'
import { vazirmatn } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: copy.tagline,
  openGraph: { type: 'website', locale: 'fa_IR', siteName: SITE_NAME },
}

// Cache Components reject `new Date()` in a prerendered component. Inside
// 'use cache' it is the entry's creation time, refreshed daily — which is
// exactly what a copyright year is. The directive is allowed only on an async
// function, and this one has nothing to await.
// eslint-disable-next-line @typescript-eslint/require-await -- 'use cache' requires async
async function CopyrightYear() {
  'use cache'
  cacheLife('days')
  return formatJalaliYear(new Date())
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-toast focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            {copy.skipToContent}
          </a>
          <Header />
          <main id="main" tabIndex={-1} className="container-page grow py-8">
            {children}
          </main>
          <Footer year={<CopyrightYear />} />
        </Providers>
      </body>
    </html>
  )
}
