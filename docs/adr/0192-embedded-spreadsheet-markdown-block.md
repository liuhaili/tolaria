# 0192: Embedded spreadsheet Markdown blocks

Status: accepted for local development, 2026-10-09. Extends ADR 0187's embedded-block pattern to spreadsheets; does not replace whole-note sheet files.

## Context

Workbooks and Markdown tables solve different problems. A pipe table (`table` block) holds text cells only — no formulas, no cell references, no grid keyboard navigation. A sheet note (`_display: sheet`) has all of that, but it turns the *whole file* into a workbook, so a document cannot mix prose with a table, let alone several tables.

Users asked for the sheet surface *inside* a note: insert a table, edit it in place with Excel-like feel, keep the rest of the document as ordinary Markdown.

## Decision

Add a `sheetBlock` to the BlockNote schema and slash menu (`sheet`, `spreadsheet`, `excel`, `表格`, `电子表格`). The block renders the existing `SheetEditor` (IronCalc) inline, in a resizable frame with its own scrolling, lazily loaded in its own chunk exactly like the whole-note surface (`editor-content/EditorContentLayout`). Editing happens in the block; there is no dialog. Drag handles on the right edge, bottom edge and bottom-right corner resize the frame (minimum 280×200); width 0 means "follow the editor" and height defaults to 360px.

Persist through the existing durable Markdown codec pipeline, like drawio, tldraw, mind maps and mermaid: serialize a ```` ```sheet ```` fenced code block containing the sheet document — a CSV body, optionally prefixed by the `---` metadata block that carries column widths and formats. A user-resized frame is recorded in the fence info line as ```` ```sheet 640x420 ```` (0 stands for "unset" on either axis), so the size survives reloads while plain `sheet` fences keep their default frame. The block's `document` prop and the fence are the same string, so a whole-note sheet can be copied into a block and back. No sidecar, config or attachment files are created, and existing notes need no migration.

Autosave writes the serialized document back into the owning block's props and emits the rich-editor external-change event, reusing the existing note-save lifecycle. A payload that is not a valid sheet document (overlong, or containing NUL) stays readable code rather than becoming an empty grid.

IronCalc sizes its canvas from the container only when it renders, and re-renders itself only on browser-window resizes, so a frame that grows on its own keeps the old canvas and leaves blank space. The block therefore hands its frame size to `SheetEditor` (`viewportSize`), which bumps the workbook's `refreshId` when it changes — the workbook re-renders, re-measures the container and draws the extra rows/columns. Whole-note sheets pass no size and keep relying on window resizes.

## Consequences

Markdown files grow with table size, and other Markdown tools read the fenced payload as plain text instead of rendering a grid.

Each block owns one IronCalc workbook model, so a note with many tables holds many WASM models at once; unmounting a block releases its model. Blocks pass no vault entries, so cross-note sheet formulas and wikilink-backed cells do not resolve inside a block — embedded tables are self-contained. If that becomes a real need, revisit by threading vault entries through the block.

Serialization stays on the editor's existing debounce, so switching notes within that window can drop the last cell edit. Revisit if it shows up as user-visible loss.

Browser mouse QA must cover real slash insertion, in-place cell editing, Markdown disk persistence, and reopening the note. It does not replace native desktop QA or the repository's release gates.
