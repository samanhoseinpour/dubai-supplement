// @ts-check
import base from '@ds/config-eslint/base'

export default [
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/node_modules/**',
      'packages/config-eslint/*.d.ts',
    ],
  },
  ...base,
]
