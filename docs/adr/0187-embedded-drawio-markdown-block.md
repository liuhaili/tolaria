# 0187: Embedded draw.io Markdown blocks

Status: accepted for local development, 2026-10-09. Extends standalone diagrams in ADR 0186; does not replace their file format.

## Context

Users need `/drawio` inside a note, an in-document preview, and click-to-edit offline. A link to an independent file does not provide that workflow. Diagram data must travel with the document rather than relying on machine-local caches.

## Decision

Add a `drawioBlock` to the existing BlockNote schema and slash menu (`drawio`, `draw.io`, `流程图`). Reuse the offline editor from ADR 0186 in a shadcn dialog. Display its preview through an image element, not injected SVG markup.

Use the existing durable Markdown codec pipeline, like tldraw. Serialize a `drawio` fenced code block containing versioned JSON `{version: 1, xml, svg}`. XML remains editable; SVG is the cached visual preview. A standalone `.drawio` file still uses its original native file-save path. Embedded diagrams create no sidecar/config/attachment files and need no migration of existing notes.

Autosave updates the owning document block's XML and emits the rich-editor external-change event, using the existing note-save lifecycle. It does not falsely report an independent disk write. Explicit Save or Save-and-return exports a local SVG, updates the block, and closes the dialog. Deleted/replaced owning blocks reject late callbacks. Invalid snapshot versions/XML remain readable code rather than becoming empty diagrams. SVG previews remove active content and remote resources before display.

## Consequences

Markdown files grow with diagram complexity because they carry both source and preview. Other Markdown tools can read/copy the fenced payload but do not automatically render it as a diagram. Raw-mode switching, reopen and serialization use the same durable codec path. This is a self-contained embedded format, not a second copy of an independently edited `.drawio` file. Online libraries/cloud services remain unavailable.

Browser mouse QA must cover real slash insertion, offline editing, Markdown disk persistence, preview and reopening. It does not replace native desktop QA or the repository's release gates.
