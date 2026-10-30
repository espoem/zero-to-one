// @vitest-environment jsdom
/**
 * Module 11 — Animation & DOM platform integration. react-dom@19.3.1 in jsdom.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  Fragment,
  Suspense,
  ViewTransition,
  act,
  addTransitionType,
  createContext,
  startTransition,
  use,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal, preconnect, preinit, preload } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { installFakeViewTransitions, uninstallFakeViewTransitions } from "./fake-view-transitions.ts";

let roots: Root[] = [];
async function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(node));
  return { container, root };
}
afterEach(() => {
  for (const r of roots) act(() => r.unmount());
  roots = [];
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  uninstallFakeViewTransitions();
  vi.restoreAllMocks();
});
const flush = () => act(async () => new Promise((r) => setTimeout(r, 20)));

describe("<ViewTransition> (stable in 19.3)", () => {
  function Counter({ onSet }: { onSet: (s: (n: number) => void) => void }) {
    const [n, setN] = useState(0);
    onSet(setN);
    return (
      <ViewTransition>
        <p>{n}</p>
      </ViewTransition>
    );
  }

  test("only Transition updates start a view transition; urgent updates do not animate", async () => {
    const recorded = installFakeViewTransitions(() => [...document.querySelectorAll("p")]);
    let set!: (n: number) => void;
    const { container } = await mount(<Counter onSet={(s) => (set = s)} />);
    expect(recorded).toHaveLength(0); // the initial mount is not a transition
    await act(async () => set(1));
    expect(recorded).toHaveLength(0); // urgent update: no animation
    expect(container.textContent).toBe("1");
    await act(async () => startTransition(() => set(2)));
    await flush();
    expect(recorded).toHaveLength(1);
    expect(container.textContent).toBe("2");
  });

  test("addTransitionType passes the cause to the browser as a view-transition type", async () => {
    const recorded = installFakeViewTransitions(() => [...document.querySelectorAll("p")]);
    let set!: (n: number) => void;
    await mount(<Counter onSet={(s) => (set = s)} />);
    await act(async () =>
      startTransition(() => {
        addTransitionType("forward");
        set(1);
      }),
    );
    await flush();
    expect(recorded[0]!.types).toEqual(["forward"]);
  });

  test("React assigns a view-transition-name to the boundary's element during the update", async () => {
    const recorded = installFakeViewTransitions(() => [...document.querySelectorAll("p")]);
    let set!: (n: number) => void;
    await mount(<Counter onSet={(s) => (set = s)} />);
    await act(async () => startTransition(() => set(1)));
    await flush();
    expect(recorded[0]!.stylesDuringUpdate[0]).toMatch(/view-transition-name:\s*_t_\d+_/); // auto-generated name (19.3.1 format)
  });

  test("without the browser API (jsdom, old browsers) updates still commit, just without animation", async () => {
    let set!: (n: number) => void;
    const { container } = await mount(<Counter onSet={(s) => (set = s)} />);
    await act(async () => startTransition(() => set(5)));
    expect(container.textContent).toBe("5");
  });
});

describe("Fragment refs: FragmentInstance (stable in 19.3)", () => {
  function Group({ onInstance }: { onInstance: (f: FragmentInstanceLike) => void }) {
    const ref = useRef<FragmentInstanceLike | null>(null);
    useEffect(() => {
      onInstance(ref.current!);
    }, [onInstance]);
    return (
      <Fragment ref={ref as never}>
        <button>first</button>
        <span>text</span>
        <button>last</button>
      </Fragment>
    );
  }
  type FragmentInstanceLike = {
    addEventListener(t: string, l: (e: Event) => void): void;
    removeEventListener(t: string, l: (e: Event) => void): void;
    focus(): void;
    focusLast(): void;
    getClientRects(): DOMRect[];
    observeUsing(o: { observe(el: Element): void; unobserve(el: Element): void }): void;
    unobserveUsing(o: { observe(el: Element): void; unobserve(el: Element): void }): void;
    compareDocumentPosition(n: Node): number;
  };

  test("the ref is a FragmentInstance with group-level DOM methods", async () => {
    let inst!: FragmentInstanceLike;
    await mount(<Group onInstance={(f) => (inst = f)} />);
    expect(inst.constructor.name).toBe("FragmentInstance");
    for (const m of ["addEventListener", "focus", "focusLast", "blur", "observeUsing", "getClientRects", "scrollIntoView"]) {
      expect(typeof (inst as unknown as Record<string, unknown>)[m]).toBe("function");
    }
  });

  test("addEventListener attaches to every first-level child", async () => {
    let inst!: FragmentInstanceLike;
    const { container } = await mount(<Group onInstance={(f) => (inst = f)} />);
    const hits: string[] = [];
    const l = (e: Event) => hits.push((e.currentTarget as Element).tagName);
    inst.addEventListener("click", l);
    container.querySelectorAll("button, span").forEach((el) => (el as HTMLElement).click());
    expect(hits).toEqual(["BUTTON", "SPAN", "BUTTON"]);
    inst.removeEventListener("click", l);
    (container.querySelector("button") as HTMLButtonElement).click();
    expect(hits).toHaveLength(3);
  });

  test("focus() and focusLast() move focus to the first/last focusable child", async () => {
    let inst!: FragmentInstanceLike;
    await mount(<Group onInstance={(f) => (inst = f)} />);
    inst.focus();
    expect(document.activeElement!.textContent).toBe("first");
    inst.focusLast();
    expect(document.activeElement!.textContent).toBe("last");
  });

  test("observeUsing connects an observer (IntersectionObserver/ResizeObserver) to each child", async () => {
    let inst!: FragmentInstanceLike;
    await mount(<Group onInstance={(f) => (inst = f)} />);
    const observed: string[] = [];
    const fakeObserver = { observe: (el: Element) => observed.push(el.tagName), unobserve: vi.fn() };
    inst.observeUsing(fakeObserver);
    expect(observed).toEqual(["BUTTON", "SPAN", "BUTTON"]);
    inst.unobserveUsing(fakeObserver);
    expect(fakeObserver.unobserve).toHaveBeenCalledTimes(3);
  });
});

describe("portals", () => {
  test("content renders into another DOM node, but events bubble through the React tree", async () => {
    const modalRoot = document.createElement("div");
    modalRoot.id = "modal-root";
    document.body.append(modalRoot);
    const clicks: string[] = [];
    function App() {
      return (
        <div onClick={() => clicks.push("react parent saw it")}>
          {createPortal(<button>in modal</button>, modalRoot)}
        </div>
      );
    }
    const { container } = await mount(<App />);
    expect(container.querySelector("button")).toBeNull();
    const button = modalRoot.querySelector("button")!;
    button.click();
    expect(clicks).toEqual(["react parent saw it"]); // not a DOM ancestor, still notified
  });

  test("context flows into portals", async () => {
    const Theme = createContext("light");
    const target = document.createElement("aside");
    document.body.append(target);
    function Label() {
      return <b>{use(Theme)}</b>;
    }
    await mount(<Theme value="dark">{createPortal(<Label />, target)}</Theme>);
    expect(target.textContent).toBe("dark");
  });
});

describe("document metadata and resources (React 19)", () => {
  test("<title>, <meta>, <link> rendered anywhere are hoisted into <head> on the client", async () => {
    function Post() {
      return (
        <article>
          <title>My post</title>
          <meta name="description" content="about" />
          <link rel="canonical" href="https://example.com/post" />
          <p>body</p>
        </article>
      );
    }
    const { container } = await mount(<Post />);
    expect(document.head.querySelector("title")!.textContent).toBe("My post");
    expect(document.head.querySelector('meta[name="description"]')).not.toBeNull();
    expect(container.innerHTML).toBe("<article><p>body</p></article>");
  });

  test("SSR: stylesheets with precedence are deduplicated and ordered by precedence in <head>", () => {
    function Widget() {
      return (
        <>
          <link rel="stylesheet" href="/base.css" precedence="default" />
          <link rel="stylesheet" href="/theme.css" precedence="high" />
          <link rel="stylesheet" href="/base.css" precedence="default" />
          <p>w</p>
        </>
      );
    }
    const html = renderToString(
      <html>
        <head />
        <body>
          <Widget />
          <Widget />
        </body>
      </html>,
    );
    const head = html.slice(html.indexOf("<head>"), html.indexOf("</head>"));
    expect(head.match(/base\.css/g)).toHaveLength(1);
    expect(head.indexOf("base.css")).toBeLessThan(head.indexOf("theme.css"));
    expect(head).toContain('data-precedence="default"');
  });

  test("SSR: preload / preinit / preconnect called during render emit <head> hints", () => {
    function App() {
      preconnect("https://cdn.example.com");
      preload("/font.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
      preinit("/analytics.js", { as: "script" });
      return <p>app</p>;
    }
    const html = renderToString(
      <html>
        <head />
        <body>
          <App />
        </body>
      </html>,
    );
    expect(html).toContain('<link rel="preconnect" href="https://cdn.example.com"/>');
    expect(html).toContain('<link rel="preload" href="/font.woff2" as="font" crossorigin="" type="font/woff2"/>');
    expect(html).toContain('<script src="/analytics.js" async="">');
  });

  test("client: preload() inserts a single hint even when called repeatedly", async () => {
    function A() {
      preload("/hero.jpg", { as: "image" });
      return null;
    }
    await mount(
      <>
        <A />
        <A />
      </>,
    );
    expect(document.head.querySelectorAll('link[rel="preload"][href="/hero.jpg"]')).toHaveLength(1);
  });
});

describe("Suspense + ViewTransition pattern", () => {
  test("a boundary wrapped in <ViewTransition update='auto' default='none'> still reveals normally", async () => {
    let resolve!: (v: string) => void;
    const data = new Promise<string>((r) => (resolve = r));
    function Content() {
      return <p>{use(data)}</p>;
    }
    const { container } = await mount(
      <ViewTransition update="auto" default="none">
        <Suspense fallback={<i>…</i>}>
          <Content />
        </Suspense>
      </ViewTransition>,
    );
    expect(container.textContent).toBe("…");
    await act(async () => resolve("ready"));
    expect(container.textContent).toBe("ready");
  });
});
