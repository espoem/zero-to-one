import { startTransition, useEffect, useOptimistic, useState, useTransition } from 'react';
import { createRoot } from 'react-dom/client';

declare global {
  interface Window {
    settleAction: () => void;
  }
}

function SecondRoot() {
  const [value, setValue] = useState('old');
  return (
    <div>
      <output id="second-root">{value}</output>
      <button id="second-transition" onClick={() => startTransition(() => setValue('new'))}>
        second root transition
      </button>
    </div>
  );
}

export default function HungAction() {
  const [todos] = useState(['a']);
  const [optimistic, addOptimistic] = useOptimistic(todos, (cur, t: string) => [
    ...cur,
    `${t} (saving)`,
  ]);
  const [other, setOther] = useState('old');
  const [isPending, startAction] = useTransition();

  useEffect(() => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    root.render(<SecondRoot />);
    return () => queueMicrotask(() => root.unmount());
  }, []);

  return (
    <main>
      <output id="todos">{optimistic.join(',')}</output>
      <output id="other">{other}</output>
      <output id="pending">{String(isPending)}</output>
      <button
        id="hang"
        onClick={() =>
          startAction(async () => {
            addOptimistic('b');
            await new Promise<void>((resolve) => {
              window.settleAction = resolve;
            });
          })
        }
      >
        hang
      </button>
      <button id="transition" onClick={() => startTransition(() => setOther('transition'))}>
        transition
      </button>
      <button id="urgent" onClick={() => setOther('urgent')}>
        urgent
      </button>
    </main>
  );
}
