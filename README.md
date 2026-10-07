# SeqShow
Present Mermaid sequence diagrams, step by step.

SeqShow turns existing Mermaid sequence diagrams into step-by-step technical presentations, with branch selection, focus mode, and standalone HTML export.

**Status:** the product specification and implementation plan are ready. The application has not been implemented yet; there is no install command or runnable demo at this stage.

## Documentation

| Document | Purpose |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Repository rules, navigation, and contribution workflow |
| [Product](docs/PRODUCT.md) | Users, MVP scope, supported syntax, and Definition of Done |
| [Architecture](docs/ARCHITECTURE.md) | Parsing, model, playback, rendering, and export boundaries |
| [Design](docs/DESIGN.md) | Editor, preview, focus mode, controls, and error states |
| [Testing](docs/TESTING.md) | Unit, integration, browser, and offline export acceptance |
| [MVP plan](docs/exec-plans/active/mvp.md) | Milestones, decisions, progress, and verification records |
| [Research](docs/research/2026-10-06-github-project-opportunities.md) | Project selection research and competitor snapshots |

The MVP targets a browser application, one default theme, one level of alt/else branching, stable diagram layout, focus mode, and a single self-contained HTML export. CLI tools, agent skills, AI generation, hosted sharing, and video export are deferred.

## Development workflow

The initial project documents are on main. Subsequent updates use branches beginning with ffang, such as ffang/m0-renderer-validation. Every merge requires the repository owner's explicit approval for that merge.

## License

[MIT](LICENSE), copyright 2026 Kunxian Wang.
