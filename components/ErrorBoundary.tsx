import React from 'react';

interface State { error: Error | null; info: string | null; }

export default class ErrorBoundary extends React.Component<{children: React.ReactNode}, State> {
  state: State = { error: null, info: null };
  static getDerivedStateFromError(error: Error) { return { error, info: null }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
    this.setState({ error, info: info.componentStack || null });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', color: '#c00', background: '#fff', minHeight: '100vh' }}>
          <h2 style={{ color: '#c00' }}>⚠️ Something crashed</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{String(this.state.error?.stack || this.state.error)}</pre>
          {this.state.info && <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#555', marginTop: 12 }}>{this.state.info}</pre>}
          <button onClick={() => location.reload()} style={{ marginTop: 16, padding: '8px 16px' }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Also install a global error reporter at module load so errors outside React
// render (e.g. in event handlers or async code) show a visible banner too.
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    const root = document.getElementById('root');
    if (!root) return;
    // Don't overwrite if ErrorBoundary already rendered a message.
    if (root.querySelector('[data-global-error]')) return;
    const div = document.createElement('div');
    div.setAttribute('data-global-error', '1');
    div.style.cssText = 'position:fixed;inset:0;padding:24px;background:#fff;color:#c00;font-family:monospace;z-index:99999;overflow:auto;';
    div.innerHTML = '<h2 style="color:#c00">⚠️ Runtime error</h2><pre style="white-space:pre-wrap;font-size:13px">' +
      (e.error?.stack || e.message || String(e)) + '</pre>';
    document.body.appendChild(div);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const root = document.getElementById('root');
    if (!root) return;
    if (document.querySelector('[data-global-error]')) return;
    const div = document.createElement('div');
    div.setAttribute('data-global-error', '1');
    div.style.cssText = 'position:fixed;inset:0;padding:24px;background:#fff;color:#c00;font-family:monospace;z-index:99999;overflow:auto;';
    div.innerHTML = '<h2 style="color:#c00">⚠️ Unhandled promise rejection</h2><pre style="white-space:pre-wrap;font-size:13px">' +
      (e.reason?.stack || e.reason?.message || String(e.reason)) + '</pre>';
    document.body.appendChild(div);
  });
}
