import {
  addTransitionType,
  startTransition,
  Suspense,
  use,
  useState,
  ViewTransition,
  type ViewTransitionInstance,
} from 'react';

declare global {
  interface Window {
    vtEvents: { prop: string; instanceKeys: string[]; types: string[] }[];
    resolveData: () => void;
  }
}
window.vtEvents = [];

function record(prop: string) {
  return (instance: ViewTransitionInstance, types: string[]) => {
    window.vtEvents.push({ prop, instanceKeys: Object.keys(instance), types: [...types] });
  };
}

const css = `
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) {
    animation-duration: 400ms;
  }
  @keyframes forward-kf { from { opacity: 0.2; } }
  @keyframes back-kf { from { opacity: 0.4; } }
  ::view-transition-new(.forward-class) { animation-name: forward-kf; }
  ::view-transition-new(.back-class) { animation-name: back-kf; }
`;

let dataPromise: Promise<string> | undefined;
function data() {
  dataPromise ??= new Promise((resolve) => {
    window.resolveData = () => resolve('loaded');
  });
  return dataPromise;
}
function Slow() {
  return <p id="content">{use(data())}</p>;
}

export default function ViewTransitions() {
  const [count, setCount] = useState(0);
  const [shown, setShown] = useState(false);
  const [place, setPlace] = useState<'left' | 'right'>('left');
  const [typed, setTyped] = useState(0);
  const [slow, setSlow] = useState(false);
  return (
    <main>
      <style>{css}</style>
      <button id="transition" onClick={() => startTransition(() => setCount((c) => c + 1))}>
        transition
      </button>
      <button id="urgent" onClick={() => setCount((c) => c + 1)}>
        urgent
      </button>
      <button
        id="forward"
        onClick={() =>
          startTransition(() => {
            addTransitionType('forward');
            setTyped((n) => n + 1);
          })
        }
      >
        forward
      </button>
      <button
        id="back"
        onClick={() =>
          startTransition(() => {
            addTransitionType('back');
            setTyped((n) => n + 1);
          })
        }
      >
        back
      </button>
      <button id="toggle" onClick={() => startTransition(() => setShown((s) => !s))}>
        toggle
      </button>
      <button
        id="move"
        onClick={() => startTransition(() => setPlace((p) => (p === 'left' ? 'right' : 'left')))}
      >
        move
      </button>
      <button id="suspend" onClick={() => setSlow(true)}>
        suspend
      </button>

      <ViewTransition onUpdate={record('onUpdate')}>
        <p id="counter">{count}</p>
      </ViewTransition>

      <ViewTransition update={{ forward: 'forward-class', back: 'back-class', default: 'none' }}>
        <p id="typed">{typed}</p>
      </ViewTransition>

      {shown && (
        <ViewTransition onEnter={record('onEnter')} onExit={record('onExit')}>
          <p id="box">box</p>
        </ViewTransition>
      )}

      <div id="left">
        {place === 'left' && (
          <ViewTransition name="photo" onShare={record('onShare')}>
            <img alt="" width={40} height={40} />
          </ViewTransition>
        )}
      </div>
      <div id="right">
        {place === 'right' && (
          <ViewTransition name="photo" onShare={record('onShare')}>
            <img alt="" width={80} height={80} />
          </ViewTransition>
        )}
      </div>

      {slow && (
        <ViewTransition update="auto" default="none">
          <Suspense fallback={<p id="fallback">loading</p>}>
            <Slow />
          </Suspense>
        </ViewTransition>
      )}
    </main>
  );
}
