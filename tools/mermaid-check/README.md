# mermaid-check

Parses every fenced ` ```mermaid ` block in the repository's Markdown with **both** Mermaid 11 and Mermaid 12. That way each diagram renders on GitHub, whichever major GitHub currently ships. A diagram that fails either parser fails the check.

```bash
cd tools/mermaid-check
mise install && mise exec -- npm ci
mise exec -- node check.mjs ../..                       # whole repository
mise exec -- node check.mjs ../../technologies/solidjs  # one track
```

Common fixes:
- **Sequence diagrams:** `;` ends a statement, so write `#59;` inside message or note text.
- **Edge labels and node text:** quote any text containing `()`, `[]`, `{}`, `&`, `|`, `#` or `:`, e.g. `A -->|"provides css() & styled"| B` and `N["text (x)"]`.
- **`end` as a node id breaks flowcharts.** Rename the node or quote it.
