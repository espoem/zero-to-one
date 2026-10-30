export function withResource(r: Disposable): number {
  using held = r;
  return held ? 1 : 0;
}

export class Counter {
  #count = 0;
  increment(): number {
    return ++this.#count;
  }
}
