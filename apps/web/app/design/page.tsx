import type { Metadata } from 'next'
import type { ComponentType } from 'react'
import { copy } from '@/lib/copy'
import { BadgesSection } from './sections/badges'
import { ButtonsSection } from './sections/buttons'
import { ColorsSection } from './sections/colors'
import { EmptyStateSection } from './sections/empty-state'
import { LinksSection } from './sections/links'
import { PriceSection } from './sections/price'
import { SkeletonsSection } from './sections/skeletons'
import { SurfacesSection } from './sections/surfaces'
import { TextFieldsSection } from './sections/text-fields'
import { TypographySection } from './sections/typography'

// D14: a real route, statically rendered, never indexed. Spec §4.5: a
// primitive or state that is not here does not exist. One theme (ADR-0021):
// each section renders once, on the page's own surface.
export const metadata: Metadata = {
  title: copy.design.title,
  robots: { index: false, follow: false },
}

const SECTIONS: ReadonlyArray<{ id: string; title: string; Section: ComponentType }> = [
  { id: 'colors', title: copy.design.sections.colors, Section: ColorsSection },
  { id: 'typography', title: copy.design.sections.typography, Section: TypographySection },
  { id: 'buttons', title: copy.design.sections.buttons, Section: ButtonsSection },
  { id: 'links', title: copy.design.sections.links, Section: LinksSection },
  { id: 'surfaces', title: copy.design.sections.surfaces, Section: SurfacesSection },
  { id: 'text-fields', title: copy.design.sections.textFields, Section: TextFieldsSection },
  { id: 'badges', title: copy.design.sections.badges, Section: BadgesSection },
  { id: 'skeletons', title: copy.design.sections.skeletons, Section: SkeletonsSection },
  { id: 'price', title: copy.design.sections.price, Section: PriceSection },
  { id: 'empty-state', title: copy.design.sections.emptyState, Section: EmptyStateSection },
]

export default function DesignPage() {
  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-headline font-bold">{copy.design.title}</h1>
        <p className="text-body text-muted-foreground prose">{copy.design.intro}</p>
      </div>
      {SECTIONS.map(({ id, title, Section }) => (
        <section key={id} id={id} aria-labelledby={`${id}-title`} className="flex flex-col gap-4">
          <h2 id={`${id}-title`} className="text-title font-bold">
            {title}
          </h2>
          <div className="flex flex-col gap-6 rounded-lg border p-6">
            <Section />
          </div>
        </section>
      ))}
    </div>
  )
}
