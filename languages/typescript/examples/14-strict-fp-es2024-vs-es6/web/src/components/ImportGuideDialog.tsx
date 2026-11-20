import { createEffect, createSignal, onSettled } from 'solid-js';
import { writeClipboard } from '@solid-primitives/clipboard';

interface ImportGuideDialogProps {
  readonly open: () => boolean;
  readonly onClose: () => void;
}

const SUBPATH_SNIPPET = `// package.json (internal non-publishable subpath imports)
{
  "type": "module",
  "imports": {
    "#strata/es2024": "./examples/14-strict-fp-es2024-vs-es6/lib/es2024/index.ts",
    "#strata/es2024/*": "./examples/14-strict-fp-es2024-vs-es6/lib/es2024/*.ts",
    "#strata/es6": "./examples/14-strict-fp-es2024-vs-es6/lib/es6/index.ts",
    "#strata/es6/*": "./examples/14-strict-fp-es2024-vs-es6/lib/es6/*.ts"
  }
}

// Usage in TypeScript 7 + Node 26 + Vite 8:
import { groupBy, sortBy, debounce, R } from '#strata/es2024';
import { groupBy as groupByEs6, usingResource } from '#strata/es6';`;

export function ImportGuideDialog(props: ImportGuideDialogProps) {
  let dialogRef: HTMLDialogElement | undefined;
  const [copied, setCopied] = createSignal(false);

  createEffect(
    () => props.open(),
    (isOpen) => {
      const el = dialogRef;
      if (!el) return;
      if (isOpen && !el.open) {
        el.showModal();
      } else if (!isOpen && el.open) {
        el.close();
      }
    },
  );

  // Light-dismiss fallback when `<dialog closedby="any">` is unsupported.
  onSettled(() => {
    const el = dialogRef;
    if (!el || 'closedBy' in HTMLDialogElement.prototype) return;

    const isOutside = (e: PointerEvent): boolean => {
      const rect = el.getBoundingClientRect();
      return (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      );
    };

    let pressedOutside = false;
    const onDown = (e: PointerEvent): void => {
      pressedOutside = isOutside(e);
    };
    const onUp = (e: PointerEvent): void => {
      if (pressedOutside && isOutside(e)) el.close();
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
    };
  });

  const handleClose = (): void => {
    if (dialogRef) dialogRef.returnValue = '';
    props.onClose();
  };

  const handleCopy = async (): Promise<void> => {
    try {
      await writeClipboard(SUBPATH_SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable in restricted/headless contexts
    }
  };

  return (
    <dialog
      ref={(el) => {
        dialogRef = el;
      }}
      class="import-dialog"
      aria-labelledby="import-dialog-title"
      {...({ closedby: 'any' } as Record<string, string>)}
      onClose={handleClose}
    >
      <div class="dialog-head">
        <h2 id="import-dialog-title" style={{ margin: 0, 'font-size': '1rem' }}>
          Internal Library Subpath Imports (#strata/*)
        </h2>
        <form method="dialog" style={{ margin: 0 }}>
          <button type="submit" class="btn" autofocus>
            Close
          </button>
        </form>
      </div>
      <div class="dialog-body">
        <p style={{ margin: 0, 'font-size': '0.88rem', color: 'var(--text-muted)' }}>
          Both editions are wired as internal non-publishable libraries using Node.js{' '}
          <code>package.json</code> <code>"imports"</code> subpath mappings, verified natively by
          TypeScript 7 (<code>moduleResolution: "NodeNext"</code>), Node 26 type stripping, and Vite
          8.
        </p>
        <div class="code-card">
          <div class="code-card-head">
            <span>Internal Subpath Configuration &amp; Usage</span>
            <button type="button" class="btn" onClick={handleCopy}>
              {copied() ? 'Copied' : 'Copy snippet'}
            </button>
          </div>
          <pre class="code-block">
            <code>{SUBPATH_SNIPPET}</code>
          </pre>
        </div>
        <div class="badge-row">
          <span class="badge badge-es2024">tsconfig.es2024.json · target ES2024 + Disposable</span>
          <span class="badge badge-es6">tsconfig.es6.json · target ES2015 + lib ["ES2015"]</span>
        </div>
      </div>
    </dialog>
  );
}
