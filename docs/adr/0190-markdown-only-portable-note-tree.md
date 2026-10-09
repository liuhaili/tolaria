# 0190: Markdown-only portable note tree

Status: accepted for local development, 2026-10-09. Supersedes ADR 0188's vault-tree sidecar storage decision; restores the frontmatter ownership from ADR 0185.

## Context

The owner wants the note browser to contain only MD documents, with hierarchy and emoji portable inside each note. Standalone draw.io creation is no longer needed; embedded `/drawio` and `/脑图` remain useful. The owner explicitly said not to migrate old data.

## Decision

The visible note collection and sidebar tree include only Markdown-kind `.md` entries. Keep other files on disk for attachments and embedded media; do not delete `.drawio`, images, or legacy sidecar files. Existing low-level file preview/native commands remain compatibility capabilities, not standalone creation actions in the note tree.

Store the child note's parent in `_parent_note: "[[canonical-parent-target]]"`, using the existing workspace-aware wikilink resolver. Moving a note to the root deletes the field. Cycles/self-parenting are rejected. Store the per-note emoji in `_icon`; removal deletes this metadata using the existing alias-aware property command. Read optional sibling ordering from `_order`. Reuse the existing frontmatter mutation lifecycle, including dirty-note flush, native path validation, state/cache refresh, and history; do not write or relocate note bodies manually.

Stop mounting the vault-tree sidecar loader and stop using its in-memory overrides in App/NoteTree. No migration or sidecar deletion is performed. Old tree.yml-only parents and emoji are no longer applied; any existing MD frontmatter remains authoritative. Frontend frontmatter patches explicitly preserve the hidden `_parent_note` in indexed properties (matching the existing Rust parser), without turning it into a visible property or a graph relationship.

Remove standalone draw.io creation from App/sidebar/tree. Retain embedded diagram editing and the dedicated embedded mind-map editor. Note-tree emoji persistence awaits the frontmatter callback and reports failures; no optimistic sidecar-only success is presented.

## Consequences

Copying an MD file preserves its emoji and parent reference. A missing parent resolves at the root; copying the parent too restores the hierarchy. Paths/aliases still follow normal wikilink resolution rules. Users must reassign sidecar-only hierarchy/icons manually, as requested. Legacy tree backend/helper code remains unused by the active note-tree UI for compatibility; no new native build is required for the existing frontmatter commands.

Implementation is local-only under the owner's recorded analyzer exception. No tests/build/QA/commit/push or release readiness is asserted.
