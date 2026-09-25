'use client'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { copy } from '@/lib/copy'
import { describeError } from '@/lib/errors'
import { ICON_SIZE, IconAlert } from '@/lib/icons'
import { vazirmatn } from './fonts'
import './globals.css'

type GlobalErrorProps = {
  error: Error & { digest?: string }
  /** Next's retry: a router refresh, then the boundary reset — the only action that can recover from a Server Component error. */
  retry: () => void
}

export default function GlobalError({ error, retry }: GlobalErrorProps) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="flex min-h-dvh flex-col">
        <main className="container-page grow py-8">
          <EmptyState
            as="h1"
            icon={<IconAlert size={ICON_SIZE.lg} />}
            title={copy.errors.title}
            description={describeError(error)}
            action={
              <Button variant="primary" onClick={retry}>
                {copy.actions.retry}
              </Button>
            }
          />
        </main>
      </body>
    </html>
  )
}
