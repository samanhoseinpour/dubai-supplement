// @ts-check
// The physical-direction Tailwind ban, isolated so it can be unit-tested
// without type information. Consumed by next.js. Spec §7.2.
export const PHYSICAL_TAILWIND_SELECTOR = String.raw`/(^|\s)-?(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r)-|(^|\s)text-(left|right)(\s|$)/`

export const RTL_MESSAGE =
  'RTL: use logical utilities (ms- me- ps- pe- start- end- text-start) — spec §7.2.'

export const rtlRules = {
  'no-restricted-syntax': [
    'error',
    { selector: `Literal[value=${PHYSICAL_TAILWIND_SELECTOR}]`, message: RTL_MESSAGE },
    { selector: `TemplateElement[value.raw=${PHYSICAL_TAILWIND_SELECTOR}]`, message: RTL_MESSAGE },
  ],
}
