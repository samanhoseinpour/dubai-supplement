// @ts-check
import base from './base.js'

export default [
  ...base,
  {
    files: ['**/*.ts'],
    rules: {
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
