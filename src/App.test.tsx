import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

// jsdom has no WebGL: stub the canvas host. The scene itself is covered by
// the camera/grid/geometry unit tests and browser verification.
vi.mock('./components/canvas/PixiStage', () => ({
  PixiStage: () => <div role="application" aria-label="Design canvas" />,
}))

describe('App', () => {
  it('renders the studio with the starter bouquet document', () => {
    render(<App />)
    expect(screen.getByText('Bloom Studio')).toBeInTheDocument()
    expect(screen.getByRole('application', { name: 'Design canvas' })).toBeInTheDocument()
    // The library is populated…
    expect(screen.getByRole('button', { name: 'Add Peony to the canvas' })).toBeInTheDocument()
    // …the recipe panel is live and counting the starter template…
    expect(screen.getByText('Suggested retail')).toBeInTheDocument()
    // "Garden Rose" appears in the library card AND the live recipe rows.
    expect(screen.getAllByText('Garden Rose').length).toBeGreaterThanOrEqual(2)
    // …the canvas footer exposes zoom controls…
    expect(screen.getByRole('button', { name: /Zoom in/ })).toBeInTheDocument()
    // …and the left tool rail exposes the cursor and grid tools.
    expect(screen.getByRole('button', { name: /Select tool/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Grid & snapping' })).toBeInTheDocument()
  })
})
