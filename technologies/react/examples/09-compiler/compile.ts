/**
 * Helpers that run the real React Compiler 1.0 (babel-plugin-react-compiler) and the real
 * eslint-plugin-react-hooks 7.1.1 on source strings.
 */
import { transformSync } from "@babel/core";
import { Linter } from "eslint";
import reactHooks from "eslint-plugin-react-hooks";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { transformWithOxc } from "vite";

export interface CompilerEvent {
  kind: string;
  reason?: string;
  category?: string;
}

export function compile(source: string, options: Record<string, unknown> = {}) {
  const events: CompilerEvent[] = [];
  const out = transformSync(source, {
    filename: "fixture.tsx",
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ["jsx", "typescript"] },
    plugins: [
      [
        "babel-plugin-react-compiler",
        {
          ...options,
          logger: {
            logEvent(_file: string, e: { kind: string; detail?: { reason?: string; category?: string; options?: { reason?: string; category?: string } } }) {
              events.push({
                kind: e.kind,
                reason: e.detail?.reason ?? e.detail?.options?.reason,
                category: e.detail?.category ?? e.detail?.options?.category,
              });
            },
          },
        },
      ],
    ],
  });
  return { code: out?.code ?? "", events };
}

/** Number of memo-cache slots the compiled function allocates: `_c(n)`. */
export const cacheSlots = (code: string) => [...code.matchAll(/_c\((\d+)\)/g)].map((m) => Number(m[1]));

// import.meta.dirname, not new URL(…, import.meta.url): jsdom replaces the global URL class.
const generatedDir = join(import.meta.dirname, ".generated");

/** Compile (optionally with the React Compiler), lower JSX with oxc, write to disk and import it. */
export async function load<T>(name: string, source: string, withCompiler: boolean): Promise<T> {
  const compiled = withCompiler ? compile(source).code : source;
  const { code } = await transformWithOxc(compiled, `${name}.tsx`, {
    lang: "tsx",
    jsx: { runtime: "automatic", development: false },
  });
  mkdirSync(generatedDir, { recursive: true });
  const file = join(generatedDir, `${name}-${withCompiler ? "compiled" : "plain"}.mjs`);
  writeFileSync(file, code);
  return (await import(/* @vite-ignore */ pathToFileURL(file).href)) as T;
}

const linter = new Linter({ configType: "flat" });
const lintConfig = [
  { files: ["**/*.jsx"], languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } } },
  { ...reactHooks.configs.flat.recommended, files: ["**/*.jsx"] },
];

/** Rule IDs reported by eslint-plugin-react-hooks' `recommended` flat preset. */
export function lint(source: string): string[] {
  return linter.verify(source, lintConfig as never, "fixture.jsx").map((m) => m.ruleId ?? "parse-error");
}
