# Contributing to SeqShow

Bug reports, usability feedback, and focused pull requests are welcome.

## Report a problem

Open an [issue](https://github.com/KunxianWang/SeqShow/issues) with:

- What you tried, what you expected, and what happened.
- A small Mermaid example that reproduces the problem, with private content removed.
- Browser, operating system, viewport size if relevant, and whether this happened in the editor, showcase, or exported HTML.
- A screenshot or error message if useful.

Unsupported Mermaid constructs are currently product limitations. For a feature request, describe the presentation task you need to complete and provide an example rather than assuming full Mermaid compatibility.

## Set up locally

Use a Node version supported in [README.md](README.md), then:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173/. See the README for the complete user guide and production preview commands.

## Find the relevant code

| Location | Responsibility |
| --- | --- |
| `src/core/` | Restricted parser, semantic model, pure playback transitions |
| `src/renderer/` | Mermaid layout, semantic SVG bindings, SVG safety |
| `src/player.ts`, `src/player.css` | Shared browser and offline player |
| `src/main.ts`, `src/styles.css` | Source editor, preview lifecycle, downloads |
| `src/showcase.ts`, `src/showcase.css` | Guided interactive showcase |
| `src/export.ts` | Single-file HTML generation and safe data embedding |
| `src/examples.ts` | Built-in diagrams |
| `tests/` | Unit, integration, production-browser, and layout checks |
| `scripts/` | Player build, fixture validation, and demo capture |

Keep changes focused. Preserve source drafts, report unsupported input explicitly, and keep Parser/Model/Playback independent of DOM. Web and offline presentations share playback semantics. User labels are data, never executable HTML or configuration. English and Chinese example text are both intentional coverage.

Mermaid is pinned to 12.1.0. Changes to its version, layout configuration, or SVG adapter require fixture regression because its output structure is not a stable semantic API.

## Validate a change

Run checks appropriate to your change. For application changes, the standard checks are:

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
```

The last command builds production and tests it using an isolated preview at port 4174. It requires that port to be free. Reports are written to `artifacts/e2e/`; failed runs retain traces.

For Mermaid adapter changes, also run `npm run test:m0`. This fixture harness uses port 4173, so stop a production preview using that port first.

Firefox and WebKit projects are available after installing their browsers. Build first, then run `npx playwright test --project=webkit` or `--project=firefox`. System dependencies and platform support vary; record what you actually ran and any failure or untested scope.

For visual changes, inspect actual diagrams and narrow-screen controls. For export changes, download a real HTML file and open it offline in a fresh browser context; an HTTP preview alone is insufficient.

## Submit a pull request

Explain the problem, resulting behavior, and checks actually run. Include screenshots for visible changes and note limitations. Add meaningful regression coverage when fixing behavior; documentation-only edits do not require new application tests. Avoid generated build output, local notes, and unrelated formatting changes. Maintainers review changes before merging.
