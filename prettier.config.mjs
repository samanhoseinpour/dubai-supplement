/** @type {import("prettier").Config} */
export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  overrides: [{ files: '*.md', options: { proseWrap: 'preserve' } }],
}
