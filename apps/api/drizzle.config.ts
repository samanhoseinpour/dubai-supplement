import { defineConfig } from 'drizzle-kit'

// A glob, so there is no aggregate schema file: each module owns its tables
// in its own schema.ts, and `shared-and-infra-are-leaves` holds (§6.2).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/**/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  casing: 'snake_case',
})
