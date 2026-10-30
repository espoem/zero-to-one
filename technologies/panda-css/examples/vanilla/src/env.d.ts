// TypeScript 7 enables `noUncheckedSideEffectImports` by default, so `import './index.css'`
// needs a module declaration (vite/client also provides one).
declare module '*.css'
