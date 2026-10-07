# SeqShow
Present Mermaid sequence diagrams, step by step.

SeqShow turns existing Mermaid sequence diagrams into step-by-step technical presentations, with branch selection, focus mode, and standalone HTML export.

**Status:** M0 renderer validation is complete. A runnable fixture preview and standalone HTML player exist. The user-input parser, editor, and production application are still planned in M1–M5.

## Run the M0 preview

Requires Node >=22.12.0 and npm. Tested with Node 22.14.0 / npm 10.9.2.

```sh
npm ci
npm run m0:preview
```

Open http://127.0.0.1:4173. Choose a hand-authored fixture, play its selected path, toggle focus, or download a self-contained HTML presentation. This preview does not accept user Mermaid input yet.

```sh
npx playwright install chromium
npm run test:m0
```

The M0 check renders eight fixtures, verifies semantic bindings and stable geometry, tests shared playback, and opens actual exported files offline in fresh Chromium contexts. Generated HTML, screenshots, and the report are saved in artifacts/m0/.

For optional cross-browser checks, install the desired engines and run `node scripts/m0.mjs --browsers=chromium,webkit` (quote the argument in PowerShell). See the [M0 evidence and limitations](docs/validation/M0.md): Firefox is unverified because its test browser cannot launch; Windows WebKit uses remote-network interception for file:// validation. This is not release compatibility certification.

## Documentation

| Document | Purpose |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Repository rules, navigation, and contribution workflow |
| [Product](docs/PRODUCT.md) | Users, MVP scope, supported syntax, and Definition of Done |
| [Architecture](docs/ARCHITECTURE.md) | Parsing, model, playback, rendering, and export boundaries |
| [Design](docs/DESIGN.md) | Editor, preview, focus mode, controls, and error states |
| [Testing](docs/TESTING.md) | Unit, integration, browser, and offline export acceptance |
| [MVP plan](docs/exec-plans/active/mvp.md) | Milestones, decisions, progress, and verification records |
| [M0 validation](docs/validation/M0.md) | Reproducible renderer / offline proof, screenshots, and browser limitations |
| [Research](docs/research/2026-10-06-github-project-opportunities.md) | Project selection research and competitor snapshots |

The MVP targets a browser application, one default theme, one level of alt/else branching, stable diagram layout, focus mode, and a single self-contained HTML export. CLI tools, agent skills, AI generation, hosted sharing, and video export are deferred.

## Development workflow

The initial project documents are on main. Subsequent updates use branches beginning with ffang, such as ffang/m0-renderer-validation. Every merge requires the repository owner's explicit approval for that merge.

## License

[MIT](LICENSE), copyright 2026 Kunxian Wang.
