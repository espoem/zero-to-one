import type { Page } from '@playwright/test';

/** Long enough for a real scheduler to commit: the positive controls prove it does. */
export const SETTLE_MS = 500;

export interface RecordedTransition {
  types: string[];
  pseudoElements: string[];
  animationNames: string[];
  matchesForward: boolean;
  finished: string;
}

declare global {
  interface Window {
    transitions: RecordedTransition[];
  }
}

/** Passes through to the browser's real API and samples what is animating at `ready`. */
export async function recordViewTransitions(page: Page) {
  await page.addInitScript(() => {
    window.transitions = [];
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = ((arg: StartViewTransitionOptions) => {
      const transition = start(arg);
      const entry: RecordedTransition = {
        types: [...(arg.types ?? [])],
        pseudoElements: [],
        animationNames: [],
        matchesForward: false,
        finished: 'pending',
      };
      window.transitions.push(entry);
      transition.ready
        .then(() => {
          const animations = document
            .getAnimations()
            .filter((a) => a.effect instanceof KeyframeEffect && a.effect.pseudoElement);
          entry.pseudoElements = animations.map(
            (a) => (a.effect as KeyframeEffect).pseudoElement ?? '',
          );
          entry.animationNames = animations.map((a) => (a as CSSAnimation).animationName ?? '');
          entry.matchesForward = document.documentElement.matches(
            ':active-view-transition-type(forward)',
          );
        })
        .catch(() => {});
      transition.finished.then(
        () => (entry.finished = 'finished'),
        (e: Error) => (entry.finished = e.name),
      );
      return transition;
    }) as typeof document.startViewTransition;
  });
}
