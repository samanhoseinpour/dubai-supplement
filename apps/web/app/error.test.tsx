import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ErrorPage from './error'

describe('error', () => {
  it('shows the mapped message for a coded error and retries', async () => {
    const reset = vi.fn()
    const error = Object.assign(new Error('boom'), { code: 'RATE_LIMITED' })
    render(<ErrorPage error={error} reset={reset} />)
    expect(screen.getByRole('heading', { level: 1, name: 'مشکلی پیش آمد' })).toBeInTheDocument()
    expect(screen.getByText(/تعداد درخواست‌ها/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('never shows an English message', () => {
    render(<ErrorPage error={new Error('ECONNREFUSED 127.0.0.1:9')} reset={() => undefined} />)
    expect(document.body.textContent).not.toMatch(/[A-Za-z]/)
  })
})
