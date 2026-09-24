import { bigint, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * The outbox (§5.6). Column names come from `casing: 'snake_case'`, so the
 * keys stay camelCase and the table is `aggregate_type`, `event_type`, …
 *
 * `last_error` is the first nullable column in the codebase and sets the
 * pattern for every one after it: an absent optional is a key the insert does
 * not name, never a value coerced into the column.
 */
export const outboxEvents = pgTable('outbox_events', {
  id: bigint('id', { mode: 'bigint' }).generatedAlwaysAsIdentity().primaryKey(),
  aggregateType: text().notNull(),
  aggregateId: uuid().notNull(),
  eventType: text().notNull(),
  payload: jsonb().$type<Record<string, unknown>>().notNull(),
  occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp({ withTimezone: true }),
  attempts: integer().notNull().default(0),
  lastError: text(),
})
