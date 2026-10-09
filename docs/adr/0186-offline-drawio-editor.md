# 0186: Offline draw.io editor

Status: accepted for local development, 2026-10-09.

## Context

Users need to create and edit flow diagrams without internet access. Loading the hosted editor or relying on a previous browser cache does not meet this requirement.

## Decision

Pin draw.io 32.4.1, verify the distribution archive by SHA-256, install its web assets locally, and bundle them with the desktop app. Keep its license and copyright notices. Startup/build only needs network access when installing these development assets for the first time.

Store diagrams as ordinary `.drawio` XML files in the selected vault. Native indexing classifies this extension as editable text. `LazyEditor` dispatches these files to `DrawioEditor`, bypassing the Markdown editor. The sidebar offers a named creation dialog.

Serve the desktop editor on a separate `tolaria-drawio` protocol origin with an offline-only CSP. Do not weaken the main app's script policy. The sandboxed iframe communicates using draw.io's JSON embed protocol. Accept events only from that iframe and origin; validate diagram XML, reject DTDs and oversized/invalid payloads, and write through the existing vault-contained native file commands. Serialize autosaves, report disk failures, and retry the retained draft without pretending it was saved.

Browser development uses locally served assets; this is not proof of the Windows custom protocol. Native mouse QA remains a separate check.

## Consequences

The app bundle grows. Network images, cloud storage, online icon search, and online fonts are not supported. This initial implementation supports standalone `.drawio` files; automatic Markdown SVG embedding is a follow-up. Diagrams stay at tree root for now: Markdown `_parent_note` frontmatter must never be prepended to diagram XML. `.drawio.svg` and `.drawio.png` are not routed to this editor yet.
