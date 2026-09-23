/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['api', 'web', 'contracts', 'api-client', 'persian', 'config', 'docs', 'infra', 'ci', 'deps'],
    ],
    'body-max-line-length': [0],
  },
}
