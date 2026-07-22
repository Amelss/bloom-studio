import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { useAuth } from './domain/auth'

// jsdom has no WebGL: stub the canvas host. The scene itself is covered by
// the camera/grid/geometry unit tests and browser verification.
vi.mock('./components/canvas/PixiStage', () => ({
  PixiStage: () => <div role="application" aria-label="Design canvas" />,
}))

describe('App routing', () => {
  beforeEach(() => {
    // A resolved, signed-in session by default.
    useAuth.setState({ loading: false, user: { id: 'u1' } as never, session: null, profile: null })
  })

  it('renders the editor + starter document for a signed-in user at /design/:id', () => {
    render(
      <MemoryRouter initialEntries={['/design/test-1']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('application', { name: 'Design canvas' })).toBeInTheDocument()
    // The library is populated…
    expect(screen.getByRole('button', { name: 'Add Peony to the canvas' })).toBeInTheDocument()
    // …the recipe panel is live…
    expect(screen.getByText('Suggested retail')).toBeInTheDocument()
    // …and the left tool rail is present.
    expect(screen.getByRole('button', { name: /Select tool/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Grid & snapping' })).toBeInTheDocument()
  })

  it('redirects a signed-out user to the login screen', () => {
    useAuth.setState({ loading: false, user: null, session: null, profile: null })
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /Continue with Google/ })).toBeInTheDocument()
  })
})
