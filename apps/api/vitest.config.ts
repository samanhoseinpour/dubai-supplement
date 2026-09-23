import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: './',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    clearMocks: true,
  },
})
