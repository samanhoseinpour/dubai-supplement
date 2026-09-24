import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('./', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      // The `@/` alias tsconfig.json declares (and shadcn writes).
      '@': root,
      // `server-only` throws outside a React Server Components runtime; the
      // components that import it are rendered here as plain functions.
      'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)),
    },
  },
  // Vite 8 transforms .tsx with Oxc. Automatic is its default; stated so the
  // absence of @vitejs/plugin-react (plan deviation 5) is visibly deliberate.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'jsdom',
    // Unit only. test/budget.test.ts needs a production build and runs under
    // vitest.budget.config.ts (Task 10).
    include: [
      'app/**/*.test.{ts,tsx}',
      'components/**/*.test.{ts,tsx}',
      'lib/**/*.test.{ts,tsx}',
      'test/*.test.{ts,tsx}',
    ],
    exclude: ['test/budget.test.ts'],
    setupFiles: ['./test/setup.ts'],
    clearMocks: true,
    css: false,
  },
})
