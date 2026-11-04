# link-check

Checks every relative Markdown link, and every `#anchor`, in the repository's `.md` files. It needs no dependencies. Anchors are resolved with GitHub's heading-slug rules: lower-case, punctuation stripped, spaces turned into `-`, and `-1`, `-2` suffixes on duplicate headings. Links inside fenced or inline code are ignored.

```bash
mise exec -- node tools/link-check/check.mjs .                     # whole repository
mise exec -- node tools/link-check/check.mjs technologies/react    # one track
```

Links to tracks that are planned but not written yet can be allowed temporarily. These are reported as "pending" rather than broken:

```bash
LINK_CHECK_PENDING=technologies/nodejs,technologies/redis node tools/link-check/check.mjs .
```

Remove a track from the pending list as soon as it lands.
