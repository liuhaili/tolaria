---
type: ADR
id: "0188"
title: "Vault tree structure and icons in tolaria/config/tree.yml"
status: active
date: 2026-10-09
supersedes: "0185"
---

## Context

ADR 0185 stores a note's visual parent in its own frontmatter as `_parent_note`, and ADR 0049 stores a per-note icon as `_icon`. Both work for Markdown, but frontmatter is a Markdown-only envelope:

- Non-Markdown vault entries cannot carry it. ADR 0186 records the consequence directly: draw.io diagrams "stay at tree root for now: Markdown `_parent_note` frontmatter must never be prepended to diagram XML".
- The same applies to every other `fileKind: text | binary` entry that ADR 0041 brought into the vault scanner — images, PDFs, `.csv`, `.drawio`.
- `_icon` has the identical blind spot, so non-Markdown entries fall back to generic `File` / `FileDashed` glyphs (`src/components/NoteItem.tsx`) and cannot be told apart in the sidebar tree.

ADR 0184 already reserved `{vault}/tolaria/config/` for this class of metadata and noted it "can store folder appearance metadata without putting an application-global setting in the vault root". No code writes there yet.

## Decision

**Tree structure and per-entry tree icons live in `{vault}/tolaria/config/tree.yml`, keyed by vault-relative path. The filesystem stays the source of truth for which entries exist (ADR 0002); `tree.yml` only describes how they are presented. `_parent_note` is superseded as the write target.**

```yaml
version: 1
nodes:
  "attachments/architecture.drawio":
    parent: "refactoring.md"
    order: 2
    icon: blueprint
  "project.md":
    order: 1
```

- Keys are vault-relative paths with forward slashes.
- `parent` is a vault-relative path; absent or null means a root node.
- `order` orders siblings. Absent means after every ordered sibling, then by title — the same rule Type sections already use.
- `icon` is a Phosphor icon name in kebab-case, the same vocabulary as `_icon`.

Resolution for a rendered node falls back in this order: `nodes[path]` in `tree.yml` → the entry's own frontmatter (`_parent_note`, `_icon`; Markdown only) → filesystem/default.

Tolaria stops writing `_parent_note`. Existing values remain readable as a fallback, so no vault is rewritten and the change is reversible. `_icon` keeps ADR 0049 semantics — frontmatter still wins for Markdown; `tree.yml` supplies an icon for entries that cannot carry frontmatter.

Parsing lives in Rust (`serde_yaml` is already a dependency and `scan_views` sets the precedent) and the parsed structure crosses to the frontend as JSON. No YAML parser is added to the renderer.

## Options considered

- **Keep frontmatter only** (status quo, ADR 0185): portable with each file and no central file to corrupt — but structurally cannot express non-Markdown entries, which is the entire problem.
- **Per-entry sidecar files** (`architecture.drawio.meta.yml`): keeps metadata beside the file, but doubles file count, litters user folders with app files, and still needs a central index to order siblings across a folder.
- **Central `tolaria/config/tree.yml`** (chosen): one location, covers every entry kind, matches the directory ADR 0184 already reserved, and is reviewable in git — at the cost of per-file portability.
- **Database**: rejected by ADR 0002.

## Consequences

- Non-Markdown entries — `.drawio` diagrams and every other `text` / `binary` file — can finally be nested and given distinct icons.
- The hierarchy is no longer portable with an individual file. Copying one Markdown file to another vault loses its position and icon; copying a whole vault keeps them. This is the price of the decision and the reason it supersedes ADR 0185.
- `tree.yml` must not become a competing source of truth:
  - A record whose path is absent from the scan is ignored for rendering and pruned on the next write.
  - Rename, move, and delete must rewrite keys through the existing rename transaction (ADR 0075). A missed rewrite degrades to "node returns to root", never to lost content.
  - Cyclic or self-referencing parents render at root, as they do today.
- Concurrent edits by two devices now conflict in one file instead of many. Resolution is manual but simpler; the trade is that every reorder touches that file. Sharding by top-level folder is the fallback if conflicts become user-visible.
- `tolaria/` is already hidden from the folder tree and excluded from indexing (ADR 0184), but the vault watcher's ignore list does not cover it, so writes may still trigger avoidable refresh passes.
- Triggers re-evaluation if: `tree.yml` conflicts become user-visible, or a per-file portable hierarchy is required again.
