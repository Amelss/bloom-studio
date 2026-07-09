import { describe, expect, it, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

beforeAll(() => {
  // jsdom lacks ResizeObserver, which the canvas uses to scale.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

describe('App', () => {
  it('renders the studio with the starter bouquet', () => {
    render(<App />)
    expect(screen.getByText('Bloom Studio')).toBeInTheDocument()
    expect(screen.getByRole('application', { name: 'Design canvas' })).toBeInTheDocument()
    // Starter template stems are on the canvas…
    expect(screen.getAllByRole('button', { name: /Garden Rose, Blush/ }).length).toBeGreaterThan(0)
    // …the library is populated…
    expect(screen.getByRole('button', { name: 'Add Peony to the canvas' })).toBeInTheDocument()
    // …and the recipe panel is live.
    expect(screen.getByText('Suggested retail')).toBeInTheDocument()
  })
})
