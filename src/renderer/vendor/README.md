# Vendored renderer dependencies

These files are checked in on purpose: Donna's renderer runs under a strict
Content-Security-Policy (`script-src 'self'`, `style-src 'self'`), so nothing
can be loaded from a CDN at runtime. They are loaded by `index.html` as plain
local scripts/styles.

## Quill

- Files: `quill.js` (UMD build, exposes global `Quill`), `quill.snow.css`
- Version: 2.0.3
- Source: npm package `quill@2.0.3`, `dist/`
- License: BSD-3-Clause — see `quill.LICENSE`
- Used by: the Notes page (`views-pages.js`, `new Quill(...)`)

To refresh:

```sh
npm pack quill@2.0.3 && tar -xzf quill-2.0.3.tgz
cp package/dist/quill.js package/dist/quill.snow.css src/renderer/vendor/
```
