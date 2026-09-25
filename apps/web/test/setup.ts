import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Testing Library only auto-cleans when `afterEach` is a global; it is not.
afterEach(() => {
  cleanup()
})

// jsdom has neither. Base UI reads matchMedia for its media queries, and its
// positioning observes element sizes. Both stubs are inert, and both are
// installed only when missing so a future jsdom that ships them wins. Missing
// is judged by value, not by key: Vitest's jsdom environment defines every
// browser global it knows as an accessor on `window`, so `'matchMedia' in
// window` is true while `window.matchMedia` is undefined. The `typeof window`
// guard is for test/lint.test.ts and test/tokens.test.ts, which run under
// `@vitest-environment node` and have no window at all.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  })
}
if (typeof window !== 'undefined' && typeof window.ResizeObserver !== 'function') {
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
}
