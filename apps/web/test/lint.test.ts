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
