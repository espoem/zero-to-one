import { startTransition, Suspense, useState } from 'react';

function Styled({ id, href }: { id: string; href: string }) {
  return (
    <section id={id} className="styled">
      <link rel="stylesheet" href={href} precedence="default" />
      {id}
    </section>
  );
}

export default function Stylesheets() {
  const [inner, setInner] = useState(false);
  const [urgent, setUrgent] = useState(false);
  return (
    <main>
      <button id="transition" onClick={() => startTransition(() => setInner(true))}>
        transition
      </button>
      <button id="urgent" onClick={() => setUrgent(true)}>
        urgent
      </button>
      <Suspense fallback={<p id="transition-fallback">loading</p>}>
        {inner ? <Styled id="transition-content" href="/slow-a.css" /> : <p id="old">old</p>}
      </Suspense>
      <Suspense fallback={<p id="urgent-fallback">loading</p>}>
        {urgent && <Styled id="urgent-content" href="/slow-b.css" />}
      </Suspense>
    </main>
  );
}
