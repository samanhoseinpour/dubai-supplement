import 'server-only'
import { z } from 'zod'

// Foundation §7.1. Parsed when called — by `publicApi` at request time from
// 3b onward — and never at import, so `next build` needs no API and DoD 9's
// build against `http://127.0.0.1:9` stays honest.
const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_INTERNAL_URL: z.url(),
})

export type ServerEnv = z.infer<typeof ServerEnvSchema>

export function getServerEnv(): ServerEnv {
  return ServerEnvSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    API_INTERNAL_URL: process.env.API_INTERNAL_URL,
  })
}
