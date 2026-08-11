import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // Keep the fallback focused on recovery; app-level logging can be added later.
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="app-shell error-screen">
          <section className="message-panel" role="alert">
            <h1>Something went wrong</h1>
            <p>Refresh the page to try loading the dashboard again.</p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
