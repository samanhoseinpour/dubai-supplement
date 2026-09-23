// @ts-check
import base from './base.js'
import { rtlRules } from './rtl.js'

export default [
  ...base,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/font/google',
              message: 'Vazirmatn is vendored and loaded with next/font/local (spec §7.2).',
            },
          ],
        },
      ],
      ...rtlRules,
    },
  },
]
