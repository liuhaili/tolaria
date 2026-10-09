# 0188: Offline embedded mind maps

Status: accepted for local development, 2026-10-09. Extends ADR 0187's embedded-diagram pattern; does not replace draw.io.

## Context

The owner wants a dedicated, attractive, designable mind-map editor inside Markdown notes, available without a network connection. draw.io remains a general drawing tool. Mind maps need drag-and-drop hierarchy editing, themes, node styling and a durable preview.

## Decision

Pin MIT-licensed `mind-elixir` 5.15.1 (stable, not the registry's prerelease default). Bundle its JavaScript and CSS locally through Vite; lazy-load the editor when a `mindmapBlock` dialog opens. No CDN, backend, remote fonts, network image picker, or extra native protocol is required. Disable upstream toolbar/context-menu controls and reuse Tolaria shadcn controls, the existing Unicode emoji picker and color swatch component.

Add `/脑图`, `/思维导图` and `/mindmap` to the existing slash menu. Use the existing durable Markdown codec registry for a `mindmap` fence containing version-1 JSON `{version, data, appearance, svg}`. Editable node data, layout, colors, font sizes, emoji and theme choice travel with the MD file. SVG is a passive cached preview, not the source of truth. No attachment/config file is created.

Validate imported and saved data: bounded snapshot/node/depth/text sizes, unique portable node IDs, supported layout and theme names, and whitelisted node style fields. Reject active HTML, links and images before sending data to the DOM renderer; sanitize synthetic clipboard nodes before upstream paste operations. Relationship arrows and summaries are outside this first version; nonempty values remain readable fenced code rather than being silently converted. Preview generation strips only the exporter’s exact fixed legacy DTD declaration and then uses the existing SVG sanitizer/image URL boundary.

Operations debounce document-block updates and dispatch the existing external-change event, so normal note autosave remains authoritative. Save-and-return commits inline text, exports the preview, updates the owning live block and closes only on success. Failures keep the editor and latest in-memory draft available; invalid stored fences remain raw code. Closing a note flushes pending changes only through the live owning-block check. UI status describes document updates, not independent successful disk writes.

## Consequences

The dependency and diagram snapshots increase bundle/note size. Other Markdown tools can read the JSON but do not render the interactive map automatically. Themes, node style and hierarchy work locally; third-party XMind import/export and free-form graph/summary editing are not part of this initial integration.

Owner explicitly approved local-only implementation under the recorded analyzer exception and delegated testing to themselves. No tests, builds, native QA, commit, push or release are asserted. Full repository release gates remain required before publishing.
