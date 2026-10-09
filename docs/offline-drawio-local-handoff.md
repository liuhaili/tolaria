# Offline draw.io local development handoff — 2026-10-09

## Follow-up: embedded slash workflow

The later approved `/drawio` request adds embedded diagrams (ADR 0187). `/drawio`, `/draw.io`, and `/流程图` insert a persistent `drawioBlock`. The offline dialog saves XML into the note; explicit Save exports an SVG preview and returns to the document. Clicking the preview reopens it. Version-1 source/preview JSON is saved inside a Markdown `drawio` fence, not a sidecar or machine-local cache. The earlier standalone-only limitation below describes the initial implementation, not this follow-up.

Browser QA: real slash typing/clicking, adding a shape, Save-and-return, preview display, actual Markdown disk persistence in a fresh temporary directory, reload from disk and click-to-edit all passed with external-host requests blocked. Also added codec/corrupt-payload/security-preview/slash/embedded-save tests. Native desktop mouse QA remains unavailable. English/Chinese copy was added per the existing temporary Chinese-only direction; other catalogs and release gates remain outstanding. PostHog events: `editor_drawio_inserted` and `editor_drawio_saved` with only safe format metadata. New source: `drawioMarkdown.ts`, `drawioPreview.ts`, `DrawioBlock.tsx`, `drawioBlockSpec.ts`, their tests, and `embedded-drawio.spec.ts`. Existing source modified: `drawio.ts`, `DrawioEditor.tsx`/tests, `editorSchema.tsx`, `tolariaEditorFormattingConfig.ts`, and `editorDurableMarkdown.ts`. No existing diagram files were migrated, and no real user vault was used for QA.

Follow-up checks: production frontend build passed, targeted ESLint passed, 10 related Vitest files passed (36 tests), embedded and standalone offline Playwright tests passed. Coverage and release-wide analyzer/localization/native gates remain unverified as listed below; no commit/push or release claim is made. Source and preview are in the note itself; “updated in document” is deliberately distinguished from a confirmed disk write in the editor status.

This is the task evidence record because no Todoist task was available. **Not a release-ready completion record:** no commit or push was performed. Existing user changes remain in the working tree.

## Implemented

- Named new-diagram dialog in the note-tree toolbar; creates an exclusive `.drawio` XML file in the active note's vault (default vault when no note is active), reloads the index and opens it.
- Local draw.io 32.4.1 editor, Chinese labels, local autosave, manual Save/Ctrl+S, serialized writes and draft-preserving save retry.
- Pinned/checksummed asset installation, bundled resources, license/notice, isolated native protocol and offline-only editor CSP. No hosted editor/browser cache dependency.
- Protect diagram XML from Markdown hierarchy writes. Diagrams currently remain root documents; Markdown embedding and `.drawio.svg`/`.drawio.png` editing are not implemented.
- Fixed two previous-layout compilation leftovers: unused breadcrumb-only components and missing sidebar-toggle description props. No unrelated user changes reverted.

## QA and checks

- `pnpm build`: passed; `pnpm exec tsc -b`: passed again after the last source change. Build emitted existing bundle-size/dynamic-import warnings.
- Targeted ESLint across the draw.io integration and affected app/sidebar/editor modules: passed. Whole-repository `pnpm lint`: failed on existing `FolderTreeRow.tsx:336` (`react-refresh/only-export-components`); no suppression added.
- Eight targeted Vitest files: **160 tests passed**, covering bridge validation/source rejection, creation callback forwarding, failed-write retry, serialized writes, filename safety and existing sidebar/tree/settings behavior.
- Edge Playwright: **two tests passed** (note-tree mouse drag; draw.io real editor). Draw.io test blocks external hosts, uses a fresh temporary directory, adds a real shape with the mouse, verifies autosave to disk, uses Ctrl+S, reopens the saved XML and asserts no external host requests. The temporary test files were removed.
- Browser harness is not a substitute for Windows native interaction. The Tauri development build compiled/restarted and `tolaria.exe` is running; native mouse/keyboard verification was **not performed** because the available computer-use surface cannot control native windows.
- `cargo check --manifest-path src-tauri/Cargo.toml --lib`: passed with existing Windows warnings. `cargo test --manifest-path src-tauri/Cargo.toml --lib drawio_protocol::tests`: blocked during compilation by existing Unix-only test imports in `commands/system.rs`, `git/clone.rs`, and `vault_watcher.rs`. The new protocol test has not run natively.
- Full frontend/Rust coverage and the full pre-push suite were **not run**. No coverage percentage is claimed. Rust formatting CLI is not installed in the current toolchain.
- `git status --short -- demo-vault demo-vault-v2`: empty; no QA modifications in a real user vault.

## Release gates still outstanding

- CodeScene: no project/touched-file starting or final scores, safeguard or change-set verdict produced. Codacy: no local or exact-SHA dashboard finding counts/parity proof produced. The user's earlier instruction was “先不用这两个检查，直接改”; this record does not claim those gates passed or authorize release. Any owner-approved exception must be reviewed before release and expire no later than **2026-10-12 14:15 Asia/Shanghai**; otherwise obtain the required checks and approval. Security/data-loss compensation here is pinned assets, isolated CSP, source/origin and XML validation, existing vault-contained writes, regression tests and no push.
- Localization: new copy in `en.json` and manually translated `zh-CN.json`, following the user's temporary Chinese-only direction. Also translated five previous sidebar-setting labels that were falling back to English. `pnpm l10n:validate` fails because the other target catalogs lack 14 keys; the mandatory release translation/validation gate remains outstanding. No localization release pass is claimed.
- PostHog: `diagram_created`, `diagram_opened`, `diagram_saved` (manual saves only), safe metadata `{ format: 'drawio' }`; no paths, names, XML or note content. Autosave does not create per-keystroke analytics noise.
- Refactoring: previous compilation leftovers noted above; no broad refactor. ADR: new 0186. Docs: architecture, abstractions, upstream installation/license instructions.
- Complete the native mouse path, full lint/test/coverage/analyzer/translation gates before any direct-to-main push. No `--no-verify` or quality-rule suppression used.

## Integration scan scope

New scorable code: `scripts/install-drawio.mjs`, `src-tauri/src/drawio_protocol.rs`, `src/components/DiagramCreateButton.tsx`, `src/components/DiagramCreateButton.test.tsx`, `src/components/DrawioEditor.tsx`, `src/components/DrawioEditor.test.tsx`, `src/utils/drawio.ts`, `src/utils/drawio.test.ts`, `tests/smoke/offline-drawio.spec.ts`.

Modified existing code/config for this integration: `package.json`, `eslint.config.js`, `src-tauri/tauri.conf.json`, `src-tauri/src/lib.rs`, `src-tauri/src/vault/mod.rs`, `src-tauri/src/vault/cache.rs`, `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/NoteTree.tsx`, `src/components/Editor.tsx`, `src/components/LazyEditor.tsx`, `src/components/BreadcrumbBar.tsx`, `src/components/VaultContentSettingsSection.tsx`, `src/utils/noteTree.ts`, and English/Chinese catalogs. `NoteTree.tsx` and `noteTree.ts` were already untracked user work at turn start; existing content was preserved.

Local and dashboard analyzer results for all paths above: **unknown / not scanned**, not zero. The working tree also contains earlier user changes outside this integration; a future release scan must regenerate the full ACMR/untracked manifest and include those changes.
