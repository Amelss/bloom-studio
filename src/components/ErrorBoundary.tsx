import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Bloom Studio crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="font-display text-2xl text-bloom-700">Something wilted.</h1>
          <p className="max-w-md text-sm text-bloom-ink/70">
            Bloom Studio hit an unexpected error. Your design is autosaved locally — reload to
            pick up where you left off.
          </p>
          <button className="btn" onClick={() => window.location.reload()}>
            Reload the studio
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
