/**
 * Read-only access to React DOM's private fiber pointers, for teaching only.
 * These property names (`__reactFiber$<random>`, `__reactContainer$<random>`) and the
 * fiber fields are implementation details of react-dom@19.3.1. They are NOT a public API
 * and can change in any release; the tests pin the version, which is why they may use them.
 */
export interface Fiber {
  tag: number;
  key: string | null;
  type: unknown;
  elementType: unknown;
  stateNode: unknown;
  return: Fiber | null;
  child: Fiber | null;
  sibling: Fiber | null;
  index: number;
  alternate: Fiber | null;
  memoizedProps: unknown;
  memoizedState: unknown;
  flags: number;
  subtreeFlags: number;
  lanes: number;
  childLanes: number;
}

export interface FiberRoot {
  current: Fiber;
  containerInfo: Element;
}

function privateKey(node: object, prefix: string): string {
  const key = Object.keys(node).find((k) => k.startsWith(prefix));
  if (!key) throw new Error(`no ${prefix} key on node — not rendered by react-dom?`);
  return key;
}

/** The fiber that owns a host DOM node (tag 5 = HostComponent, 6 = HostText). */
export function fiberOf(node: Node): Fiber {
  return (node as unknown as Record<string, Fiber>)[privateKey(node, "__reactFiber$")]!;
}

/** The FiberRoot behind a createRoot() container. */
export function fiberRootOf(container: Element): FiberRoot {
  const hostRootFiber = (container as unknown as Record<string, Fiber>)[
    privateKey(container, "__reactContainer$")
  ]!;
  return hostRootFiber.stateNode as FiberRoot;
}

/** Work tags from ReactWorkTags.js (stable for many years, still internal). */
export const WorkTag = {
  FunctionComponent: 0,
  ClassComponent: 1,
  HostRoot: 3,
  HostPortal: 4,
  HostComponent: 5,
  HostText: 6,
  Fragment: 7,
  ContextProvider: 10,
  ForwardRef: 11,
  SuspenseComponent: 13,
  MemoComponent: 14,
  SimpleMemoComponent: 15,
  OffscreenComponent: 22,
} as const;
