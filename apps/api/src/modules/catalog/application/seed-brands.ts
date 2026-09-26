import { Logger } from '@nestjs/common'
import type { CreateBrandInput } from '../domain/brand.js'
import type { BrandService } from './brand.service.js'

/**
 * The store's nine brands, read from the labels on Saman's shelf on
 * 2026-09-25 (foundation §5.7 as amended that day; Deviation 11). The names
 * are the spellings Iranian supplement shops use, verified by web research on
 * 2026-09-26 (§5.7 as amended that day); no name carries a ZWNJ now. Each
 * description is the one line the storefront's brand card shows (3c), and
 * states the brand's country and what it is known for; Aavelone Pharma
 * carries none, because its facts could not be verified. Persian here is
 * data, not copy: the API still speaks English. The entity normalises on
 * write, so «لیپو ۶» is stored as `لیپو 6` and displayed Persian. Saman may
 * still correct a spelling here — data, not a migration.
 */
export const SEED_BRANDS: readonly CreateBrandInput[] = [
  {
    slug: 'black-skull',
    name: 'بلک اسکال',
    description: 'برند برزیلی مکمل ورزشی؛ شناخته‌شده برای پروتئین وی و پیش‌تمرین بون کراشر',
  },
  {
    slug: 'nutriversum',
    name: 'ناتریورسام',
    description: 'برند مجارستانی مکمل ورزشی و سلامت؛ پروتئین، آمینواسید، کراتین و ویتامین',
  },
  {
    slug: 'applied-nutrition',
    name: 'اپلاید نوتریشن',
    description: 'برند بریتانیایی از لیورپول؛ شناخته‌شده برای پیش‌تمرین ABE و پروتئین‌های وی',
  },
  {
    slug: 'aavelone-pharma',
    name: 'اولون فارما',
  },
  {
    slug: 'belissima',
    name: 'بلیسیما',
    description: 'برند برزیلی مکمل‌های زیبایی پوست، مو و ناخن، از گروه سازندهٔ بلک اسکال',
  },
  {
    slug: 'labrada',
    name: 'لابرادا',
    description:
      'برند آمریکایی از هیوستون، بنیان‌گذاری‌شده به دست لی لابرادا؛ شناخته‌شده برای محصولات لین بادی',
  },
  {
    slug: 'galvanize',
    name: 'گالوانایز',
    description: 'برند مجارستانی مکمل ورزشی از بوداپست؛ پروتئین وی، آمینواسید و کراتین',
  },
  {
    slug: 'nutrex',
    name: 'ناترکس',
    description: 'برند آمریکایی از فلوریدا؛ شناخته‌شده برای چربی‌سوزهای لیپو ۶',
  },
  {
    slug: '7nutrition',
    name: 'سون نوتریشن',
    description: 'برند لهستانی مکمل ورزشی و سلامت؛ پروتئین وی، کراتین، آمینواسید و ویتامین',
  },
]

export type SeedReport = { readonly created: string[]; readonly skipped: string[] }

/**
 * Idempotent at the application level (§5.7): a slug that exists is skipped,
 * so a second run writes no row and emits no event, and a run after a crash
 * fills only the gap. Every write goes through the service — the seed never
 * issues a raw insert.
 */
export async function seedBrands(brands: BrandService): Promise<SeedReport> {
  const logger = new Logger('seed')
  const created: string[] = []
  const skipped: string[] = []
  for (const input of SEED_BRANDS) {
    if ((await brands.findBySlug(input.slug)) !== null) {
      skipped.push(input.slug)
      continue
    }
    await brands.create(input)
    created.push(input.slug)
    logger.log({ msg: 'brand seeded', slug: input.slug })
  }
  return { created, skipped }
}
