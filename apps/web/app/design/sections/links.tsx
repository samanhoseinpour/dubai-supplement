import { buttonVariants } from '@/components/ui/button'
import { Link } from '@/components/ui/link'
import { copy } from '@/lib/copy'

export function LinksSection() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body prose">
        {copy.design.samples.linkSentence}{' '}
        <Link href="/design#links">{copy.design.samples.link}</Link>
      </p>
      <div>
        <Link
          variant="plain"
          href="/design#links"
          data-target=""
          className={buttonVariants({ variant: 'secondary' })}
        >
          {copy.design.states.inline}
        </Link>
      </div>
    </div>
  )
}
