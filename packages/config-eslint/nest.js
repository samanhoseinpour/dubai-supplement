// @ts-check
import base from './base.js'

export default [
  ...base,
  {
    files: ['**/*.ts'],
    rules: {
      // A Nest module is an empty decorated class by design — the decorator
      // carries the wiring. The rule's own escape hatch is the right fit:
      // a bare empty class is still an error.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'class-validator', message: 'Contracts are Zod only (spec §5.5).' },
            { name: 'class-transformer', message: 'Contracts are Zod only (spec §5.5).' },
            {
              name: '@nestjs/event-emitter',
              message: 'Domain events go through the transactional outbox (spec §5.6).',
            },
            {
              name: '@nestjs/platform-express',
              message: 'The API runs on the Fastify adapter (spec §3).',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: '__dirname', message: 'ESM: use import.meta.url (spec §12.1).' },
        { name: '__filename', message: 'ESM: use import.meta.url (spec §12.1).' },
      ],
    },
  },
]
