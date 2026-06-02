import { StrictMode, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Catches any unhandled render errors so users never see a blank white page.
class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Tohid Meta Port] Render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: 'fixed', inset: 0, background: '#08090d',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '16px', padding: '32px', color: '#fff', fontFamily: 'monospace',
          }}
        >
          <div style={{ fontSize: '2rem' }}>⚠️</div>
          <p style={{ fontSize: '14px', color: '#94a3b8', textAlign: 'center', maxWidth: '420px' }}>
            An unexpected error occurred. Please reload the page.
          </p>
          <p style={{ fontSize: '11px', color: '#475569', maxWidth: '420px', wordBreak: 'break-all', textAlign: 'center' }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#0e7490', color: '#fff', border: 'none',
              borderRadius: '8px', padding: '10px 24px', cursor: 'pointer',
              fontSize: '13px', fontWeight: 'bold',
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
