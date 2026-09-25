import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // `server-only` throws outside a React Server Components runtime; the
      // server entry is tested here as a plain module, as apps/web does it.
      'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: { include: ['src/**/*.test.ts'], clearMocks: true },
})
