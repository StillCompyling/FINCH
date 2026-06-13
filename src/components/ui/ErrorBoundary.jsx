import { Component } from 'react'

/**
 * Section-level error boundary. Catches render errors in any child tree and
 * shows a minimal recovery UI instead of crashing the whole app.
 * Charts (Recharts) can throw on malformed data — this is the main guard.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', this.props.label ?? '', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-[8px] border-[1.5px] border-ink/20 bg-paper-raised px-5 py-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-soft">
            {this.props.label ?? 'This section'} couldn&rsquo;t load
          </p>
          <p className="text-sm text-ink-soft">
            Something went wrong. Your data is safe — try refreshing.
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="rounded-[6px] border-[1.5px] border-ink bg-paper px-4 py-2 font-mono
              text-xs font-bold uppercase tracking-[0.06em] text-ink shadow-card
              transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
