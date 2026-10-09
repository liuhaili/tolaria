# ADR 0185: Store sidebar note hierarchy in Markdown frontmatter

## Status

Superseded by [0188](0188-vault-tree-structure-in-tolaria-config.md). Frontmatter cannot express non-Markdown entries, so the hierarchy moved to `tolaria/config/tree.yml`. `_parent_note` values remain readable as a fallback.

## Context

Filesystem folders cannot express the Notion-style relationship tree users expect: a Markdown file cannot be placed under another Markdown file, and moving files to simulate that relationship makes links and Git history noisier.

## Decision

Store a note's visual parent in its own frontmatter as `_parent_note: "[[canonical-path]]"`. The sidebar resolves those wikilinks into a `NoteTree`. Dropping onto a note updates the property; dropping onto the tree background removes it. Type documents and managed support folders are excluded from the tree. Reject a reparenting action that would create a cycle.

## Consequences

The hierarchy is portable with the Markdown files and does not change their locations. A manually created invalid or cyclic reference remains safe: it renders at the root until fixed. The property is internal UI metadata, not a type classification or filesystem operation.
