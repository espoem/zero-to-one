import { Component, type ReactNode, useState } from 'react';

declare global {
  interface Window {
    caught: string[];
  }
}
window.caught = [];

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error) {
    window.caught.push(`${error.name}: ${error.message}`);
  }
  override render() {
    return this.state.failed ? <p id="failed">failed</p> : this.props.children;
  }
}

// Only registered policy; the page's CSP allows exactly this name.
const policy = (window as any).trustedTypes?.createPolicy('app', { createHTML: (s: string) => s });

export default function TrustedTypes() {
  const [mode, setMode] = useState('none');
  const html = '<b id="inner">hello</b>';
  return (
    <main>
      {['trusted', 'string', 'script', 'async-script'].map((m) => (
        <button key={m} id={m} onClick={() => setMode(m)}>
          {m}
        </button>
      ))}
      <Boundary>
        {mode === 'trusted' && (
          <div
            id="host"
            dangerouslySetInnerHTML={{ __html: policy!.createHTML(html) as unknown as string }}
          />
        )}
        {mode === 'string' && <div id="host" dangerouslySetInnerHTML={{ __html: html }} />}
        {mode === 'script' && <script id="rendered-script" />}
        {mode === 'async-script' && <script async src="/hoisted.js" />}
        {mode !== 'none' && <p id="rendered">rendered</p>}
      </Boundary>
    </main>
  );
}
