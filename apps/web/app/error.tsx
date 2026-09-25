'use client'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { copy } from '@/lib/copy'
import { describeError } from '@/lib/errors'
import { ICON_SIZE, IconAlert } from '@/lib/icons'

type ErrorPageProps = {
  error: Error & { digest?: string }
  /** Next's retry: a router refresh, then the boundary reset — the only action that can recover from a Server Component error. */
  retry: () => void
}

export default function ErrorPage({ error, retry }: ErrorPageProps) {
  return (
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
  )
}
