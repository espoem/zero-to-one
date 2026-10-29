/**
 * A minimal, synchronous stand-in for the browser View Transitions API, enough for React's
 * <ViewTransition> integration to run in jsdom. It records each startViewTransition call,
 * the transition types React passed, and the inline styles React applied while the
 * update callback ran (React names elements with `view-transition-name` there).
 * Real animation behaviour needs a real browser (see module 11, "What jsdom cannot prove").
 */
export interface RecordedTransition {
  types: string[];
  stylesDuringUpdate: string[];
}

export function installFakeViewTransitions(observe: () => Element[]): RecordedTransition[] {
  const recorded: RecordedTransition[] = [];
  const doc = document as Document & { startViewTransition?: unknown };
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { status: "loaded", ready: Promise.resolve() },
  });
  doc.startViewTransition = (arg: { update: () => unknown; types?: string[] }) => {
    const entry: RecordedTransition = { types: [...(arg.types ?? [])], stylesDuringUpdate: [] };
    recorded.push(entry);
    const updateDone = Promise.resolve().then(async () => {
      await arg.update();
      entry.stylesDuringUpdate = observe().map((el) => el.getAttribute("style") ?? "");
    });
    return {
      updateCallbackDone: updateDone,
      ready: updateDone,
      finished: updateDone,
      skipTransition() {},
      types: new Set(arg.types ?? []),
    };
  };
  const root = document.documentElement as unknown as Record<string, unknown>;
  root.animate = () => ({ finished: Promise.resolve(), cancel() {} });
  root.getAnimations = () => [];
  return recorded;
}

export function uninstallFakeViewTransitions() {
  delete (document as { startViewTransition?: unknown }).startViewTransition;
  delete (document as { fonts?: unknown }).fonts;
}
