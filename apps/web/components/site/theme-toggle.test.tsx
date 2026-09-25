import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'next-themes'
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'
import { ThemeToggle } from './theme-toggle'

function renderToggle() {
  return render(
    <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem storageKey="ds-theme">
      <ThemeToggle />
    </ThemeProvider>,
  )
}

const SCRIPT_WARNING = 'Encountered a script tag while rendering React component'
let consoleError: MockInstance<typeof console.error>

beforeEach(() => {
  // next-themes' pre-paint <script> is server-rendered in the app; under a
  // client render React 19 warns about it once per file. Swallow exactly that
  // line and fail on anything else, so the log stays a guard.
  consoleError = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes(SCRIPT_WARNING)) return
    throw new Error(`unexpected console.error: ${args.map(String).join(' ')}`)
  })
})

afterEach(() => {
  consoleError.mockRestore()
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('ThemeToggle', () => {
  it('is a labelled, marked, 44 px trigger that opens a menu', () => {
    renderToggle()
    const trigger = screen.getByRole('button', { name: 'انتخاب طرح' })
    expect(trigger).toHaveAttribute('data-target')
    expect(trigger).toHaveClass('size-11')
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  })

  it('offers exactly the three themes as radio items and applies the choice', async () => {
    renderToggle()
    await userEvent.click(screen.getByRole('button', { name: 'انتخاب طرح' }))
    const items = await screen.findAllByRole('menuitemradio')
    expect(items.map((item) => item.textContent.trim())).toEqual(['روشن', 'تاریک', 'سیستم'])
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'تاریک' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(window.localStorage.getItem('ds-theme')).toBe('dark')
  })

  it('lets «سیستم» replace an unknown stored value it is already shown for', async () => {
    window.localStorage.setItem('ds-theme', 'blue')
    renderToggle()
    await userEvent.click(screen.getByRole('button', { name: 'انتخاب طرح' }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'سیستم' }))
    expect(window.localStorage.getItem('ds-theme')).toBe('system')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })
})
