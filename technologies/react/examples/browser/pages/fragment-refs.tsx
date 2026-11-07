import { Fragment, useRef, useState, type FragmentInstance } from 'react';

declare global {
  interface Window {
    fragment: FragmentInstance;
    seen: { intersecting: string[]; resized: string[]; clicks: string[] };
  }
}
window.seen = { intersecting: [], resized: [], clicks: [] };

function Card({ id }: { id: string }) {
  return (
    <div id={id} className="card" style={{ height: 80 }}>
      <button id={`${id}-button`}>{id}</button>
    </div>
  );
}

export default function FragmentRefs() {
  const [extra, setExtra] = useState(false);
  const observed = useRef(false);
  return (
    <main>
      <button id="add" onClick={() => setExtra(true)}>
        add
      </button>
      <section id="before" />
      <div style={{ height: 3000 }} />
      <Fragment
        ref={(instance: FragmentInstance | null) => {
          if (!instance || observed.current) return;
          observed.current = true;
          window.fragment = instance;
          const id = (t: EventTarget | Element) => (t as Element).id;
          instance.observeUsing(
            new IntersectionObserver((entries) => {
              for (const e of entries)
                if (e.isIntersecting) window.seen.intersecting.push(id(e.target));
            }),
          );
          instance.observeUsing(
            new ResizeObserver((entries) => {
              for (const e of entries) window.seen.resized.push(id(e.target));
            }),
          );
          instance.addEventListener('click', (e) => {
            window.seen.clicks.push(id(e.currentTarget!));
          });
        }}
      >
        <Card id="a" />
        <Card id="b" />
        {extra && <Card id="c" />}
      </Fragment>
      <div style={{ height: 3000 }} />
    </main>
  );
}
