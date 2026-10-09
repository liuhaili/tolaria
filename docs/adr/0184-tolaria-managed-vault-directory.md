---
type: ADR
id: "0184"
title: "Tolaria-managed vault directory"
status: active
date: 2026-10-09
---

## Context

Vault roots should stay focused on the user's notes and folders. Attachments and vault-scoped Tolaria configuration need to sync with the vault, but should not look like ordinary note folders in the sidebar.

## Decision

Tolaria-managed vault data lives below a single visible-on-disk but hidden-in-app directory:

```text
{vault}/tolaria/
  attachments/
  config/
```

New image imports write to `tolaria/attachments/`. Portable Markdown links use the same `tolaria/attachments/...` path. `tolaria/` is reserved for Tolaria and is hidden from the normal folder tree.

Existing root `attachments/` paths remain readable and renameable. Tolaria does not move existing files automatically, so existing Markdown links remain valid. A future explicit migration may move legacy attachments only after updating their references atomically.

## Consequences

- A vault contains one predictable place for Tolaria-managed, syncable content.
- `tolaria/config/` can store folder appearance metadata without putting an application-global setting in the vault root.
- Frontend attachment-path conversion accepts both the new and legacy paths during the compatibility period.
- The reserved `tolaria/` directory must be excluded from normal note navigation and note indexing except for dedicated Tolaria readers.
