import { Logger } from '@nestjs/common'
import type { CreateBrandInput } from '../domain/brand.js'
import type { BrandService } from './brand.service.js'

/**
 * The store's nine brands, read from the labels on Saman's shelf on
 * 2026-09-25 (foundation §5.7 as amended that day; Deviation 11) — one with
 * a ZWNJ on purpose — each with the one-line description the storefront's
 * brand card shows (3c). Persian here is data, not copy: the API still
 * speaks English. The entity normalises on write, so «۱۰۰» is stored as
 * `100` and displayed Persian. Every spelling but «بلک اسکال» (Saman's) is a
 * transliteration he may correct here — data, not a migration.
 */
export const SEED_BRANDS: readonly CreateBrandInput[] = [
  {
    slug: 'black-skull',
    name: 'بلک اسکال',
    description:
      'برند برزیلی مکمل‌های ورزشی؛ وی ایزوله و وی اچ‌دی، گلوتامین، بتاآلانین، زد‌ام‌ای و کروم پیکولینات.',
  },
  {
    slug: 'nutriversum',
    name: 'نوتری‌ورسوم',
    description: 'آمینو انرژی با طعم بلک‌کارنت؛ ۲۷۰ گرم، ۴۵ سروینگ.',
  },
  {
    slug: 'applied-nutrition',
    name: 'اپلاید نوتریشن',
    description: 'برند بریتانیایی؛ اچ‌ام‌بی ۵۰۰ میلی‌گرمی، ۱۲۰ کپسول.',
  },
  {
    slug: 'aavelone-pharma',
    name: 'آولون فارما',
    description: 'تست بوستر ۳۲۰۰؛ ۱۲۰ کپسول، هر سروینگ چهار کپسول.',
  },
  {
    slug: 'belissima',
    name: 'بلیسیما',
    description: 'تغذیهٔ زیبایی؛ کلاژن پلاس با هیالورونیک اسید و بیوتین، طعم توت‌فرنگی، ۲۶۴ گرم.',
  },
  {
    slug: 'labrada',
    name: 'لابرادا',
    description: 'برند آمریکایی؛ کریالین، کراتین مونوهیدرات خالص، ۲۵۰ گرم، ۵۰ سروینگ.',
  },
  {
    slug: 'galvanize',
    name: 'گالوانایز',
    description: 'ای‌ای‌ای زیرو با طعم گیلاس؛ آمینواسیدهای ضروری برای عملکرد و ریکاوری.',
  },
  {
    slug: 'nutrex',
    name: 'نوترکس',
    description: 'برند آمریکایی؛ ال‌کارنیتین مایع ۳۰۰۰ برای رژیم و انرژی تمرین.',
  },
  {
    slug: '7nutrition',
    name: 'سون نوتریشن',
    description: 'ساخت لهستان؛ سی‌ال‌ای ۱۰۰۰، ۱۰۰ سافت‌ژل ۱۰۰۰ میلی‌گرمی.',
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
