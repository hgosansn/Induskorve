import { Component, type ReactNode } from 'react';
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error('Induskorve could not render', error);
  }
  render() {
    return this.state.failed ? (
      <main className="grid min-h-dvh place-content-center gap-4 p-8">
        <h1 className="text-xl">The city could not be displayed.</h1>
        <p>Your browser save has been preserved.</p>
        <a className="underline" href={location.href}>
          Reload city
        </a>
      </main>
    ) : (
      this.props.children
    );
  }
}
