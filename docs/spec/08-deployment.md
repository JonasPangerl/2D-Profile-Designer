# 08 - Deployment

- GitHub Actions: typecheck, Vitest, build
- GitHub Pages for the standalone app, purely static
- Embedding on the target website as a **custom element with shadow DOM**
  (`<foil-designer>`), built as a single ESM bundle. One
  `<script type="module">` plus one tag. Shadow DOM isolates the website CSS
  without the drawbacks of an iframe (height, focus, deep links).

## Constraints that follow

`ADDED 2026-09-30`:

- Vite `base` is relative (`"./"`) so the built bundle works at any URL path.
- No asset is fetched from a CDN at runtime; everything is served
  same-origin. Fonts, if any, are bundled.
- The embed bundle ships its styles inside the shadow root. Nothing is
  injected into the host document's `<head>`.
- The embed element reads its initial document from a `src` attribute, an
  inline `<script type="application/json">` child, or a `document` property
  set from JavaScript. All three paths go through the same loader, in line
  with golden rule G7.
