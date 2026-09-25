/** @type {import("prettier").Config} */
export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindStylesheet: './apps/web/app/globals.css',
  tailwindFunctions: ['cn', 'cva'],
  overrides: [{ files: '*.md', options: { proseWrap: 'preserve' } }],
}
