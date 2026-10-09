# Tree emoji local development record

## Approved local-only Markdown tree storage change

Local handoff (not a release): removed standalone draw.io creation from App/Sidebar/NoteTree; filtered the visible note collection to Markdown-kind `.md` entries; stopped mounting `useVaultTree` and removed tree.yml overrides. Parent/emoji mutations use existing frontmatter callbacks (`_parent_note` / `_icon`); sibling order reads `_order`. Live hidden parent patching now matches native extraction. Cycles are rejected, write failures surface in the tree, and the emoji dialog closes only after the callback succeeds. No user-vault data migration, deletion, or direct content changes were performed; old sidecar files and standalone diagrams remain on disk and sidecar-only relationships/icons are not shown. Embedded draw.io/mind-map blocks remain unchanged.

Scan manifest, existing added/modified code for this follow-up: `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/NoteTree.tsx`, `src/utils/noteTree.ts`, `src/hooks/frontmatterOps.ts`, `src/lib/locales/en.json`, `src/lib/locales/zh-CN.json`. No new code file for this follow-up. Docs: ADR 0190, ARCHITECTURE, ABSTRACTIONS, this handoff. CodeScene/Codacy baselines, before/after reviews, parity, safeguard/change-set and local/dashboard counts remain unavailable under the approved exception, not zero. No tests/lint/typecheck/build/coverage/native QA/commit/push were run; existing sidecar-focused tests have not been updated or represented passing. Localization: en/zh-CN copy; translation/validation deferred per owner direction. PostHog: existing `tree_emoji_changed` retained; `note_tree_reparented` emits only safe target metadata. Refactoring: resolver no longer depends on the sidecar; health score unmeasured. No Todoist connector; release gates remain outstanding.

On 2026-10-09 the owner directed "直接修改不必迁移旧数据" after being informed that the analyzers remain unavailable. This authorizes local code changes only, without migration, tests, builds, commit or push. CodeScene/Codacy MCP discovery remains empty after retry; no baseline, parity or score is available. Affected scope: App/Sidebar/NoteTree, noteTree resolver, frontmatter entry patching, en/zh catalogs and architecture/abstraction/new ADR docs. Risk: runtime and analyzer regressions remain unverified; preexisting tree.yml relationships/icons will no longer be displayed. Compensation: reuse native frontmatter write/delete and note autosave/flush paths, existing parser fields and emoji picker; preserve all old sidecar/non-MD files and user note bodies. Approver: repository owner in this conversation. Expiry: 2026-10-12 18:00 Asia/Shanghai; review/remove within seven days and before release. No analyzer findings represented as zero and no release claimed.

## Approved local-only mind-map integration exception

### Implementation handoff (not a release)

- Implemented locally: `/脑图`, `/思维导图`, `/mindmap`; lazy offline editor; hierarchy dragging, child/sibling creation, delete, undo/redo, three themes, side/right/down layouts, zoom/fit, node font size/weight/colors and the existing emoji picker. App keyboard dispatch yields to the scoped mind-map surface. Versioned JSON plus sanitized SVG preview is embedded in the MD note; no independent database, attachment or config folder is created. Export/import of XMind files and free-form relations are not implemented.
- Scan manifest, existing files: `package.json`, `pnpm-lock.yaml`, `src/components/editorSchema.tsx`, `src/components/tolariaEditorFormattingConfig.ts`, `src/hooks/appKeyboardShortcuts.ts`, `src/utils/editorDurableMarkdown.ts`, `src/lib/locales/en.json`, `src/lib/locales/zh-CN.json`. New code: `src/components/MindmapBlock.tsx`, `src/components/MindmapEditor.tsx`, `src/components/MindmapEditor.css`, `src/components/MindmapToolbar.tsx`, `src/components/mindmapBlockSpec.ts`, `src/components/mindmapThemes.ts`, `src/components/useMindmapEditor.ts`, `src/utils/mindmapData.ts`, `src/utils/mindmapMarkdown.ts`. Docs: ADR 0188, architecture, abstractions and this record.
- CodeScene/Codacy: unavailable before and after; no project/file scores, safeguard/change-set result, analyzer parity, local per-file counts or exact-SHA dashboard counts are claimed. Owner-approved local exception above covers the integration, including keyboard ownership; release gates remain outstanding.
- QA/tests/coverage: none run, per owner instruction. No lint/typecheck/build/automated test/native interaction or screenshot. Coverage unmeasured. Static inspection of pinned upstream types/exporter informed implementation, not a substitute for runtime proof. Owner should check mouse drag, slash insertion, styling, keyboard shortcuts, save-and-return, raw-mode round trip, reopen/restart and offline behavior.
- Dependency installed with scripts disabled; lockfile restricted to the pinned new dependency and its integrity entry, preserving existing package resolutions and platform metadata. No commit or push.
- Localization: new copy is in en/zh-CN catalogs; translation/validation commands not run under owner's Chinese-only/local-only direction. Other target languages and the localization gate remain outstanding.
- PostHog: `editor_mindmap_inserted`, `editor_mindmap_opened`, `editor_mindmap_saved`, `editor_mindmap_styled` (safe format/control/theme metadata, no titles, paths, content or emoji).
- Refactoring: new lifecycle/data/toolbar/theme/codec separated; health improvement unmeasured. ADR: 0188. Docs: ARCHITECTURE/ABSTRACTIONS. No real vault or demo fixture modified; demo-vault status was empty at handoff. No Todoist connector/task available; this is the local handoff record, not release certification.

On 2026-10-09 the owner explicitly approved continuing local modifications for a new offline mind-map dependency despite unavailable CodeScene/Codacy checks: "允许，继续本地修改". Discovery was retried and neither MCP analyzer is exposed; `cs`, Bash and configured CodeScene API credentials remain unavailable. Project/file baselines, analyzer parity and final findings therefore cannot be established (not counted as zero). Scope: package/lockfile, new mind-map editor/block/codec/style files, existing editor schema, durable Markdown registry, slash menu, en/zh catalogs, new ADR and architecture/abstraction docs. Risk: analyzer findings and runtime regressions are unverified. Compensation: pinned stable dependency, inspect upstream API/source, reuse existing Markdown round-trip and shadcn controls, validate stored data, no user-vault mutation, no commit/push/release. No tests/build/UI QA per explicit owner instruction; owner verifies. Approver: repository owner in this conversation. Expiry: 2026-10-12 18:00 Asia/Shanghai; review/remove within seven days and before release. Release remains blocked on all normal gates and full localization.

Owner direction: on 2026-10-09 the repository owner explicitly said “直接改” after being informed that CodeScene/Codacy checks were unavailable. This permits local implementation and functional checks only, not a verified release or bypassed push.

Blocked checks: CodeScene MCP discovery twice returned no tools; `cs --version` failed (command unavailable), with a repeated CLI/API configuration check confirming no CLI or `CODESCENE_PAT`/`CODESCENE_PROJECT_ID`. Codacy MCP discovery twice returned no tools; the fallback `.codacy/cli.sh` exists but Bash is unavailable, and dashboard analyzer parity cannot be queried.

Scope: existing `NoteTree.tsx`, `NoteTree.test.tsx`, `Sidebar.tsx`, `EmojiPicker.tsx`, `vaultTree.ts`, `vaultTree.test.ts`, English/Chinese catalogs, documentation, and a new browser regression test. Risk: analyzer findings cannot be ruled out. Compensation: reuse the existing Unicode emoji picker, existing tree persistence, focused regression tests, TypeScript/build/lint checks, and no real-user-vault QA. No scanner count is represented as zero. Approval: repository owner in this conversation. Exception expiry: 2026-10-12 18:00 Asia/Shanghai; review/remove within seven days and before release. Chinese-only UI follows the owner's earlier direction; full localization/release gates remain outstanding.

## Local implementation and QA handoff

Added a hover/focus emoji button beside each tree title, an existing shadcn dialog with the existing Unicode emoji picker, and right-click set/change/remove actions. No icon library or image upload is offered. Emoji actions do not open the note or start dragging; the title remains the navigation/drag target. `Sidebar` forwards the existing vault root so saved tree keys stay relative. Empty `icon: ""` is preserved as an explicit hide override, preventing legacy frontmatter icons from returning after removal; parent/order are preserved. Tree icons are sidebar presentation, not a rewrite of source file contents.

Analytics: `tree_emoji_changed`, safe metadata `action: set | remove`, with no paths, titles, emoji value, or note content. Docs: updated abstractions; no new dependency, Tauri command, or storage location. Localization: six English/Chinese keys, remaining languages deferred under the owner's Chinese-only direction.

Checks before the owner's interruption: 102 targeted Vitest tests passed; targeted ESLint and TypeScript build passed; browser note-tree mouse drag passed. The new browser emoji disk-fixture test failed to observe a write through its dynamically imported store binding; it remains unresolved and is not a native persistence pass. Native UI and full coverage/release/analyzer gates are unverified. No real user vault or demo fixture was changed; no commit/push performed.

The owner then explicitly instructed: “你无需测试，以后都是我来测试”. Stop initiating automated tests, builds, and UI QA; hand over verification to the owner. Existing regression tests are retained, not represented as all passing. Release readiness still requires owner direction for the outstanding gates.

## Follow-up: progressive emoji rendering

Owner requested the first few dozen emoji immediately and the rest gradually. `EmojiPicker` now initially renders at most 64 buttons, waits for an animation frame plus 250 ms, then appends up to 64 every frame plus 100 ms using interruptible React transitions. Already rendered buttons and completed groups are memoized; all categories remain available in their original order. Search results use the same batching, reset on query change, and match the full catalog rather than only loaded buttons. Closing the picker cancels pending batch and focus timers. `NoteTree` memoizes filtered entries and hierarchy so opening the picker does not rebuild its relationships. No new UI copy, dependency, storage strategy or analytics event (rendering optimization only). No tests, builds or UI QA run for this follow-up, per owner direction. No commit/push.

## Follow-up: remove update detection and prompts

Owner requested removal of app update detection and notifications. The shell stops mounting `useUpdater`/`UpdateBanner` and removes manual update dispatch; the shared menu and palette no longer offer check-for-updates, the build number remains visible without a check tooltip/action, and settings omit update-channel/automatic-check controls. English/Chinese sync heading/description now refer only to vault synchronization. Native updater code, release packaging and stored preference fields are retained, but no shell flow calls the updater. Vault sync is unchanged. Additional existing-file scope: `App.tsx`, `SettingsPanel.tsx`, `status-bar/StatusBarSections.tsx`, `hooks/commands/settingsCommands.ts`, `shared/appCommandManifest.json`, existing catalogs and abstractions. Same local-only analyzer exception applies; no new dependency/ADR/storage strategy, and no event needed for removal of an action. No tests, build, native QA, commit or push initiated; owner handles verification. Older update-feature tests have not been updated/run and are not claimed passing.

## Follow-up: keep custom-titlebar space stable

Owner requested fixing the vertical jump when opening menus. Static inspection found `body.custom-window-chrome { padding-top: 32px }` conflicted with the installed popup scroll-lock dependency: in its default margin mode it reads `body.marginTop` (zero) and injects unlayered `body[data-scroll-locked] { padding-top: 0px }`, overriding the layered titlebar padding. Moved the 32px reservation to `body.custom-window-chrome #root` in existing `src/index.css`, leaving body scroll locking and native titlebar positioning unchanged. No global `!important`, dependency edits, UI copy, analytics, or new abstraction. No tests/build/UI QA performed per owner direction; no commit/push. Analyzer exception and outstanding release gates above still apply.

## Follow-up: remove footer history/contribute/docs links

Removed the history/Pulse badge and contribution/documentation buttons from existing `status-bar/StatusBarSections.tsx`, including unused footer-only button helpers/imports. Their functions remain available elsewhere; vault controls, Git synchronization, version display, theme and settings remain unchanged. No UI copy change, new dependency, data change or analytics event needed for removal of these footer links. No tests/build/UI QA, commit or push, per owner direction. The earlier local-only analyzer exception/release limitations remain in effect. The reported emoji loss after restart remains unresolved; the recently re-added `project-dashboard.md` emoji is not evidence that previous emoji survived.

Owner subsequently reported a render-error screenshot: `ReferenceError: FeedbackButton is not defined` in `StatusBarSecondarySection`. Footer removal had been applied in two writes (helper deletion, then call-site/import removal), exposing an intermediate invalid module to Vite HMR. Current source and the served module were inspected read-only: HTTP 200 and neither `FeedbackButton` nor `DocsButton` references remain. The screenshot is not a verified failure of that final module; reload/reopen is needed to clear the latched root render-error page. No runtime recovery or successful native restart is claimed. Future related symbol/call-site removal must be a single file write to avoid this intermediate state. No automated tests run.

## Follow-up: rounded workspace and hidden favorites

Subsequent owner request removes the favorite, organized-status and neighborhood/map buttons from the top toolbar in existing `BreadcrumbBar.tsx`, including their unused helpers/configurations/imports. Underlying note properties and other command/menu access are unchanged. No UI copy changes or new analytics action. No tests/build/QA/commit/push per owner direction; existing local-only analyzer exception and release limitations apply.

Owner provided a rounded-panel reference and requested favorites hidden by default and no horizontal rules. Existing `App.css` adds a 6px workspace inset and 12px rounded, clipped sidebar/editor panels, using existing surface tokens and preserving resizing. Existing `EditorTheme.css` removes the generated H1 underline; note-tree, titlebar, breadcrumb and status-bar decorative horizontal borders are removed without removing Markdown horizontal-rule blocks or changing note contents. Existing `SidebarSectionVisibility` gains optional `favorites`; the sidebar favorites section renders only when explicitly true, so old callers default to hidden. Favorite data, keyboard/menu actions and existing toolbar controls remain. Existing-file scope additionally includes `types.ts`, `App.css`, `EditorTheme.css`, `LinuxTitlebar.tsx`, `StatusBar.tsx`. No new copy, dependency, storage location, or meaningful analytics action. No tests/build/QA/commit/push performed per owner direction; local analyzer exception and release limitations remain.

Owner's follow-up screenshot identified the remaining rule above the document tree. Static inspection found `SidebarTopNav` retained a bottom border even with every navigation item hidden, and `SidebarTitleBar` retained a separate bottom border. Removed both border classes in existing `sidebar/SidebarTopNav.tsx` and `sidebar/SidebarSections.tsx`, preserving controls and spacing. Styling-only follow-up; no copy, data, analytics, tests, builds, native QA, commit or push. The same local-only analyzer exception and outstanding release gates apply; visual confirmation remains with the owner.
# Local image-width restoration record - 2026-10-09

- Owner explicitly approved local-only code changes to restore PS5 image sizes
  and retain dimensions on later saves: "是的". No tests, builds, commit or push.
- Before editing, CodeScene/Codacy tool discovery was retried: neither MCP is
  exposed; `cs`/Bash remain unavailable. Required project/file baselines,
  analyzer parity and per-file scans cannot be produced. Blocked operations:
  CodeScene score/review/safeguard/change-set and Codacy local/dashboard scans.
  Missing evidence is unavailable, never zero findings or a passing gate.
- Scope/manifest: existing `src/utils/vaultImages.ts`,
  `src/utils/richEditorMarkdown.ts`; new `src/utils/imageWidthMarkdown.ts`.
  Documentation: ADR 0191, ARCHITECTURE, ABSTRACTIONS and this record.
- Risk: parsing, save/reopen, duplicate/nested images and analyzer results are
  unverified. Compensation: inspect existing/upstream parser and serializer,
  reuse native image blocks and attachment-path handling, bounded numeric
  widths, skip code fences/inline code, no dependency or security suppression.
- Data work: owner's `Desktop/笔记测试2/ps5项目流程.md` retains all 18 attached
  images, with widths restored from the SiYuan source's image styles.
  An unmodified pre-edit note copy is retained under the Windows temporary
  `tolaria-ps5-widths-*` directories. SiYuan source files are unchanged.
- Approver: repository owner in this conversation. Expiry: 2026-10-12 18:00
  Asia/Shanghai; review/remove within seven days and before release.
- QA/tests/coverage: not run, per owner direction; owner performs verification.
  CodeScene and Codacy before/after results remain unavailable; release gates
  remain outstanding. Localization: no UI copy changes. PostHog: no new event
  because this repairs persistence of an existing image-resize/paste action,
  without a new discovery flow. Refactoring: shared token rewrite extracted;
  code-health improvement not measured. ADR/docs updated; no release claimed.

## Inline image placement follow-up - 2026-10-09

- Owner reported that copied SiYuan images belong after their associated text,
  and that the imported literal bold-markup around the check symbol was wrong.
  The PS5 note now uses plain check symbols and has its attachments after the
  intended text. The SiYuan source was not modified.
- Markdown images now parse as an inlineImage editor node rather than an
  independent image block. Its width comes from the existing portable Markdown
  title and direct serialization preserves it. Scope: editor schema, direct
  Markdown serializer, rich-editor pipeline and theme; ADR 0191, architecture,
  abstractions and this record were revised.
- CodeScene/Codacy remain unavailable as recorded above; this is covered by
  the same owner-approved local-only exception and expiry. No test, build,
  native QA, commit or push was run. Owner must verify visual placement,
  save/reopen and image resizing before release.

The first inline-image attempt still allowed BlockNote's default image parser
to claim image elements first, which displayed them as large independent
blocks. The inline node is now ordered before that default parser. This was
corrected by static inspection only; no runtime verification is claimed.

