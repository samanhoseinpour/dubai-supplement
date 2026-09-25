// @vitest-environment node
import { fileURLToPath } from 'node:url'
import { webRules } from '@ds/config-eslint/next'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

// The non-type-aware layers only (spec §11): every rule under test here is a
// class, syntax, import or boundary rule, none needs a TypeScript program, and
// a virtual file has none. The type-aware base is exercised by `pnpm lint`.
const cwd = fileURLToPath(new URL('../', import.meta.url))
const eslint = new ESLint({ cwd, overrideConfigFile: true, overrideConfig: webRules })

async function lint(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return (result?.messages ?? []).map((m) => `${m.ruleId ?? 'parse'}: ${m.message}`)
}

const jsx = (className: string) => `export const Fixture = () => <div className="${className}" />\n`
const rule = (id: string) => (message: string) => message.startsWith(`better-tailwindcss/${id}:`)

describe('logical properties (foundation §7.2)', () => {
  it.each([
    'ms-4 me-2 ps-1 pe-3 text-start',
    'rtl:rotate-180',
    'normal-case',
    'z-header leading-relaxed',
    'press focus-ring text-body font-medium text-foreground bg-primary rounded-md shadow-sm ease-out',
  ])('accepts "%s"', async (className) => {
    expect(await lint('components/ui/fixture.tsx', jsx(className))).toEqual([])
  })

  it.each([
    'w-full',
    'h-4',
    'size-11',
    'min-h-dvh',
    'max-w-3xl',
    'mt-4',
    'py-2',
    'top-0',
    'inset-y-0',
    'border-t',
    'border-y',
    'rounded-t-lg',
    'space-y-4',
    'md:mb-8',
  ])('accepts the block-axis or dimension utility "%s" — it never mirrors', async (className) => {
    expect(await lint('components/ui/fixture.tsx', jsx(className))).toEqual([])
  })

  it.each(['ml-4', 'md:ml-4', '-ml-2', 'pl-2', 'border-l-2', 'left-0'])(
    'rejects the physical utility "%s"',
    async (className) => {
      const messages = await lint('components/ui/fixture.tsx', jsx(className))
      expect(messages.some(rule('enforce-logical-properties'))).toBe(true)
    },
  )

  it('rejects a physical utility inside a template literal', async () => {
    const code = 'export const Fixture = () => <div className={`flex mr-2`} />\n'
    const messages = await lint('components/ui/fixture.tsx', code)
    expect(messages.some(rule('enforce-logical-properties'))).toBe(true)
  })
})

describe('unknown classes — the deleted scales (spec §5.1)', () => {
  it.each([
    'bg-blue-500',
    'text-xl',
    'shadow-lg',
    'rounded-xl',
    'ease-in-out',
    'font-light',
    'bg-white',
  ])('rejects "%s"', async (className) => {
    const messages = await lint('components/ui/fixture.tsx', jsx(className))
    expect(messages.some(rule('no-unknown-classes'))).toBe(true)
  })
})

describe('the dark variant (ADR-0021)', () => {
  // ADR-0021: one theme, the variant does not exist. Tailwind's built-in
  // `dark` is a `prefers-color-scheme` query, so the ban is by name.
  it.each(['dark:bg-card', 'dark:hover:bg-accent', 'md:dark:bg-card'])(
    'rejects "%s"',
    async (className) => {
      const messages = await lint('components/ui/fixture.tsx', jsx(className))
      expect(messages.some(rule('no-restricted-classes'))).toBe(true)
    },
  )
})

describe('restricted classes (spec §6.3, §11)', () => {
  it.each([
    'bg-[#ff0000]',
    'text-[rgb(0,0,0)]',
    'hover:border-[oklch(0.5_0.1_200)]',
    'tracking-tight',
    'md:tracking-wide',
    'leading-none',
    'leading-tight',
    'text-left',
    'text-right',
    'text-justify',
    'float-left',
    'rounded-tl-lg',
    'z-50',
    'z-[60]',
    '-z-10',
  ])('rejects "%s"', async (className) => {
    const messages = await lint('components/ui/fixture.tsx', jsx(className))
    expect(messages.some(rule('no-restricted-classes'))).toBe(true)
  })
})

describe('literal values (spec §5.1, §7.2, §11)', () => {
  it.each([
    // durations and delays — anything but the --duration-* tokens
    'duration-300',
    'delay-150',
    'md:duration-300',
    'duration-(--x)',
    'delay-[1s]',
    // literal lengths, anywhere
    'text-[13px]',
    'w-[13px]',
    'p-[7px]',
    'm-[1px_2px]',
    'gap-[3px]',
    'max-w-[42rem]',
    'ring-[3px]',
    'h-[100dvh]',
    'basis-[30%]',
    // the deleted scales: radius, shadow, easing, weight, leading, animation, z
    'rounded-[6px]',
    'rounded-ss-[6px]',
    'rounded-(--x)',
    'shadow-[0_1px_2px_rgba(0,0,0,0.1)]',
    'shadow-(--x)',
    'inset-shadow-[0_1px_0_#fff]',
    'ease-[cubic-bezier(0,0,1,1)]',
    'ease-(--x)',
    'font-[550]',
    'font-(--x)',
    'leading-[1.1]',
    'leading-(--x)',
    'animate-[wiggle_1s]',
    'animate-(--x)',
    'z-(--z-x)',
    'z-[5]',
    // variable, typed and keyword colours
    'bg-(--brand)',
    'bg-[var(--brand)]',
    'bg-[color:var(--brand)]',
    'bg-[--brand]',
    'bg-(color:--brand)',
    'text-[color:red]',
    'text-[red]',
    'border-s-(--brand)',
    'from-(--brand)',
    'ring-[var(--brand)]',
    // the important marker in either position
    'leading-none!',
    '!tracking-tight',
    'md:leading-none!',
    'md:!text-left',
    'text-left!',
  ])('rejects "%s"', async (className) => {
    const messages = await lint('components/ui/fixture.tsx', jsx(className))
    expect(messages.some(rule('no-restricted-classes'))).toBe(true)
  })

  it.each([
    'duration-(--duration-quick)',
    'delay-(--duration-fade)',
    'transition-colors duration-(--duration-quick) ease-(--ease-out)',
    // Separately: together they conflict on transition-timing-function.
    'ease-out',
    'ease-in',
    'press focus-ring text-body font-medium text-foreground bg-primary rounded-md shadow-sm',
    'hover:bg-primary/90 z-header',
    'w-full min-h-dvh size-11 gap-2 p-4 grid-cols-[1fr_auto]',
  ])('accepts "%s"', async (className) => {
    expect(await lint('components/ui/fixture.tsx', jsx(className))).toEqual([])
  })
})

describe('conflicts and duplicates', () => {
  it('rejects two classes that set the same property', async () => {
    const messages = await lint('components/ui/fixture.tsx', jsx('ps-2 ps-4'))
    expect(messages.some(rule('no-conflicting-classes'))).toBe(true)
  })

  it('rejects the same class twice', async () => {
    const messages = await lint('components/ui/fixture.tsx', jsx('ps-4 ps-4'))
    expect(messages.some(rule('no-duplicate-classes'))).toBe(true)
  })
})

describe('route segment configs (ADR-0006, spec §11)', () => {
  it.each(['dynamic', 'revalidate', 'fetchCache', 'runtime', 'dynamicParams'])(
    'rejects `export const %s` under app/',
    async (name) => {
      const messages = await lint('app/things/page.tsx', `export const ${name} = 'x'\n`)
      expect(messages.some((m) => m.includes('route-segment-config'))).toBe(true)
    },
  )

  it('accepts `export const metadata` under app/', async () => {
    expect(await lint('app/things/page.tsx', "export const metadata = { title: 'x' }\n")).toEqual(
      [],
    )
  })

  it('does not reach outside app/', async () => {
    expect(await lint('lib/things.ts', "export const dynamic = 'x'\n")).toEqual([])
  })
})

describe('restricted imports (foundation §7.2, spec §8.2)', () => {
  it('rejects lucide-react outside lib/icons.ts', async () => {
    const messages = await lint('components/ui/fixture.tsx', "import { Sun } from 'lucide-react'\n")
    expect(messages.some((m) => m.startsWith('no-restricted-imports:'))).toBe(true)
  })

  it('accepts lucide-react in lib/icons.ts', async () => {
    expect(await lint('lib/icons.ts', "export { Sun } from 'lucide-react'\n")).toEqual([])
  })

  it.each(['app/layout.tsx', 'lib/icons.ts'])('rejects next/font/google in %s', async (file) => {
    const messages = await lint(file, "import { Inter } from 'next/font/google'\n")
    expect(messages.some((m) => m.startsWith('no-restricted-imports:'))).toBe(true)
  })

  // pnpm's isolation makes `apps/api` unresolvable by name; a relative path
  // into it resolves fine, so the ban is on the specifier (north-star §2.3).
  it.each(['app/page.tsx', 'lib/icons.ts'])(
    'rejects a relative path into apps/api from %s',
    async (file) => {
      const messages = await lint(
        file,
        "import { x } from '../../api/src/modules/health/index.js'\n",
      )
      expect(
        messages.some((m) => m.startsWith('no-restricted-imports:') && m.includes('api-boundary')),
      ).toBe(true)
    },
  )

  it.each([
    [
      'lib/errors.ts',
      "import type { ErrorCode } from '@ds/contracts'\nexport type { ErrorCode }\n",
    ],
    [
      'components/ui/price.tsx',
      "import { formatToman } from '@ds/persian'\nexport { formatToman }\n",
    ],
  ])('accepts a workspace package from %s', async (file, code) => {
    expect(await lint(file, code)).toEqual([])
  })
})

describe('boundaries (spec §4.3)', () => {
  const boundary = (needle: string) => (m: string) =>
    m.startsWith('boundaries/dependencies:') && m.includes(needle)

  it('components/ui may not import app', async () => {
    const messages = await lint('components/ui/fixture.tsx', "import '../../app/layout'\n")
    expect(messages.some(boundary('ui-imports-lib-only'))).toBe(true)
  })

  it('components/site may not import app', async () => {
    const messages = await lint('components/site/fixture.tsx', "import '../../app/layout'\n")
    expect(messages.some(boundary('site-never-imports-app'))).toBe(true)
  })

  it('lib may not import a component or a route', async () => {
    const messages = await lint('lib/fixture.ts', "import '../app/layout'\n")
    expect(messages.some(boundary('lib-imports-packages-only'))).toBe(true)
  })

  it('resolves the @/ alias so an aliased violation is still a violation', async () => {
    const messages = await lint('lib/fixture.ts', "import '@/app/layout'\n")
    expect(messages.some(boundary('lib-imports-packages-only'))).toBe(true)
  })

  it('accepts app importing lib, and ui importing lib through the alias', async () => {
    expect(await lint('app/fixture.tsx', "import '../lib/env'\n")).toEqual([])
    expect(
      await lint('components/ui/fixture.tsx', "import { cn } from '@/lib/utils'\nexport { cn }\n"),
    ).toEqual([])
  })

  it('nothing imports a test file', async () => {
    const messages = await lint('app/fixture.tsx', "import '../test/tokens.test'\n")
    expect(messages.some(boundary('no-test-imports'))).toBe(true)
  })
})
