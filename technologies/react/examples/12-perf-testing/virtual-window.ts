/**
 * The core of list virtualisation (what react-window / TanStack Virtual compute for fixed-height rows):
 * given the scroll position, return the half-open index range [start, end) of rows to render.
 *
 *   VISIBLE-RANGE(scrollTop, viewport, h, n, k)
 *     first ← ⌊scrollTop / h⌋                      ▷ first row intersecting the viewport
 *     last  ← ⌈(scrollTop + viewport) / h⌉          ▷ one past the last intersecting row
 *     return [max(0, first − k), min(n, last + k))  ▷ k rows of overscan on each side
 *
 * Invariant: every row intersecting [scrollTop, scrollTop + viewport) is inside the range,
 * and the range size is O(viewport / h + 2k), independent of n.
 */
export function visibleRange(o: {
  scrollTop: number;
  viewport: number;
  rowHeight: number;
  count: number;
  overscan: number;
}): { start: number; end: number } {
  const first = Math.floor(o.scrollTop / o.rowHeight);
  const last = Math.ceil((o.scrollTop + o.viewport) / o.rowHeight);
  const start = Math.min(o.count, Math.max(0, first - o.overscan));
  const end = Math.min(o.count, last + o.overscan);
  return { start, end: Math.max(start, end) };
}
