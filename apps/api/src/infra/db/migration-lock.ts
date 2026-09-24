/**
 * The fixed advisory-lock key overlapping starts serialise on (§6.2).
 *
 * A leaf with no imports on purpose. `src/migrate.ts` locks with it and runs
 * the migration at module top level, so a consumer that imported the key from
 * there would migrate its own database just by naming the constant. Nothing
 * Nest-side may reach past this directory's barrel; `migrate.ts` imports this
 * file directly, because the barrel carries `DbModule` and with it
 * `ConfigModule`, which validates the environment at decoration time.
 */
export const MIGRATION_LOCK_KEY = 4_820_115
