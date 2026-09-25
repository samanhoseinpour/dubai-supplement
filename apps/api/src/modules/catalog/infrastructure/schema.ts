import { sql, type SQL } from 'drizzle-orm'
import { check, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

/**
 * `brands` (foundation §6.3). Keys are camelCase; `casing: 'snake_case'`
 * derives the real names. `search_text` is the search pattern: the name with
 * every ZWNJ turned into a space, stored, and indexed with pg_trgm so a
 * search for «ماسل تک» finds «ماسل‌تک». Display reads `name`, never this.
 * The checks repeat the entity's invariants at the table (db.md).
 */
export const brands = pgTable(
  'brands',
  {
    id: uuid().primaryKey(),
    slug: text().notNull(),
    name: text().notNull(),
    description: text(),
    searchText: text().generatedAlwaysAs((): SQL => sql`replace(${brands.name}, chr(8204), ' ')`),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [
    unique('brands_slug_key').on(t.slug),
    index('brands_search_text_idx').using('gin', t.searchText.op('gin_trgm_ops')),
    check('brands_slug_check', sql`${t.slug} ~ '^[a-z0-9-]+$' and char_length(${t.slug}) <= 64`),
    check('brands_name_check', sql`char_length(${t.name}) between 1 and 200`),
    check(
      'brands_description_check',
      sql`${t.description} is null or char_length(${t.description}) between 1 and 2000`,
    ),
  ],
)
