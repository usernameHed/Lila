import { Component, type ReactNode } from 'react';

/**
 * If a part of the tool fails to load or draw (for example a piece of an older version, right after a new one was
 * deployed), say so and offer a reload instead of leaving a blank page.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="loader failed" role="alert">
        <div className="loader-mark">LILA BLACK</div>
        <p>{this.props.label ?? 'This part of the tool could not load.'} A newer version may be out.</p>
        <button className="ds-use" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
