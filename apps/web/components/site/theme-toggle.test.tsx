import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'next-themes'
import { afterEach, describe, expect, it } from 'vitest'
import { ThemeToggle } from './theme-toggle'

function renderToggle() {
  return render(
    <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem storageKey="ds-theme">
      <ThemeToggle />
    </ThemeProvider>,
  )
}

afterEach(() => {
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
})
