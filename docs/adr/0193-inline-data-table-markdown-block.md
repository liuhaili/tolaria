# 0193: Inline data-table blocks (self-contained Markdown)

Status: accepted for local development, 2026-10-09. Replaces the collection-view design that briefly occupied this number the same day; extends ADR 0187's embedded-block pattern.

## Context

Notes needed a Notion-style database they can hold inline: a real table with typed columns that you edit in place. The ready-made answers (Obsidian Bases, Dataview, SiYuan databases) are host plugins — they bind to their host's vault API, file model and editor, so none can be mounted in Tolaria's BlockNote + Tauri stack. What is reusable is the *shape*: a fenced block that renders a table of records with per-column types.

Two ownership models were on the table, and the distinction is the whole point of this ADR:

1. **A view over the vault** — rows are notes, columns are frontmatter properties, and editing a cell edits that note. This is ADR 0144's collection model.
2. **A data store** — the block owns its rows, and editing a cell edits the block.

The requirement was explicitly the second: an editable data store, not a table of notes.

## Decision

Add a `viewTableBlock` to the BlockNote schema and the slash menu (`view`, `database`, `db`, `data`, `数据表`, `数据库`, `视图`). The block renders an editable table and **owns its data**.

**The rows live in the fence.** The ```` ```view ```` fence body is the table itself, as JSON:

````
```view
{
  "title": "Tasks",
  "columns": [
    { "id": "c1", "name": "Name", "type": "text" },
    { "id": "c2", "name": "Status", "type": "select", "options": ["To do", "Doing", "Done"] },
    { "id": "c3", "name": "Due", "type": "date" }
  ],
  "rows": [
    { "c1": "Write the ADR", "c2": "Doing", "c3": "2026-10-10" }
  ]
}
```
````

The `source` prop and the fence are the same string, so a table travels with the note it is copied into. No sidecar, config or attachment file is created, nothing is migrated, and no other note is ever read or written — cell edits rewrite this block's payload through the normal editor-change pipeline (same autosave, history and conflict handling as any other block).

**A row is a column-id → value map**, which keeps the JSON readable and hand-editable, and makes a column rename free (the id, not the label, is the key). `columns[].width` is an optional pixel width; `rows[].id` does not exist on purpose — row identity is positional, and rows are reordered explicitly from the row menu.

**Column types are the block's own vocabulary** (`utils/viewTableModel`): `text`, `number`, `date`, `checkbox`, `select`, `multiSelect`, `url`. A type decides how a cell is rendered and edited, and changing a column's type re-coerces every existing cell, so text → number cannot leave strings the number editor cannot read. `select`/`multiSelect` carry an `options` list that the column menu edits and that the cells extend inline when a custom value is typed.

**Everything is editable from the block**: add/delete/duplicate/reorder rows, add/delete/reorder columns, rename a column, retype it, edit its choices, drag column widths, and search rows (search is transient and never persisted). Text-like cells keep a local draft and commit on blur/Enter, so typing does not push one block update per keystroke.

**Sorting and filtering are part of the payload**, not a display-only mode: `sort: { columnId, direction }` and `filters: [{ id, columnId, op, value }]` live in the fence next to the rows, so a saved table reopens with the same view. Filters are AND-combined, each operator is restricted to the operators its column type can express, and a condition whose value is still empty is ignored rather than hiding every row. Sorting is stable (authored order breaks ties) and empty cells always sink to the bottom in either direction. Search stays transient. Changing a column's type re-seats conditions its new type cannot express, and deleting a column drops the filters and sort that pointed at it.

**Event isolation comes from BlockNote, not from the block.** For a `content: "none"` block, BlockNote's own node view already answers `stopEvent` with "always" for every event and blurs the editor on mousedown, so ProseMirror never sees anything that happens inside the block — the sheet and mind-map blocks rely on exactly that. A hand-rolled isolation layer was tried first and had to be removed: it ran before the editor element and stopped React's own bubbling handlers with it, which silenced the grid's keyboard handling and editing outright. Two smaller guards remain: popovers rendered *from* a header or cell spread `isolatePopoverEvents` onto their content (Radix portals move the DOM to `body`, but React still routes clicks along the React tree, so a menu click would bubble into react-data-grid's click-to-sort and overwrite a just-made edit with stale data), and the picture/attachment pickers prevent dismissal on focus-outside, because the grid hands focus back to the cell right after the popover opens and read that as "focus left the popover".

**Untrusted input degrades, never throws.** A fence body that is not JSON, or exceeds `MAX_VIEW_TABLE_SOURCE_LENGTH` (200 kB), stays a code block under its original fence language instead of becoming an empty grid; normalization caps a table at 50 columns and 2000 rows and drops malformed columns, cells and options rather than rejecting the file.

**Division of labour with `sheetBlock` (ADR 0192).** A sheet is a free grid — formulas, arbitrary cells, Excel feel. This block is a record table: typed columns are the point, and there is no formula engine. Both persist inside the note, and a note may contain any number of each.

## Consequences

Deleting the block deletes its data — there is no vault note behind it, and no other surface to recover it from. That is the intended trade for self-containment: the table is editable Markdown that can be copied, hand-edited or version-controlled like anything else in the file.

Rows are rendered from the payload on every change, so a large table (thousands of rows) costs a full re-serialize per edit; the caps above bound that. Editing a cell is a block update, so it participates in undo/redo at block granularity rather than cell granularity.

Not implemented, deliberately: grouping/board/calendar presentations, column formulas, row drag handles, multi-column sort, cross-block references (a cell cannot point at another block's row), and filter expressions beyond the per-column operators above. Block height can be pinned by hand with `"height": 480` in the fence; there is no drag handle for it yet.

Browser mouse QA must cover slash insertion, every column type's editor, column type changes re-coercing values, row/column add/delete/reorder, column resize, the search box, the filter and sort controls, and reopening the note to confirm the fence round-trips. It does not replace native desktop QA or the repository's release gates.

## Amendment: choice colours, picture and attachment columns (2026-10-10)

**Choices are coloured by name, not by hex.** A `select`/`multiSelect` column carries `optionColors: { [option]: colorName }` next to `options`; the names come from a fixed ten-entry palette (`gray brown orange yellow green teal blue purple pink red`, exported as `VIEW_TABLE_OPTION_COLORS`). Chips, tags, dots and the palette swatches are painted by CSS from `data-option-color`, mapped onto the app's `--accent-*` tokens, so one fence stays readable in both themes. Parsing drops colours that name an unknown palette entry, a removed choice, or a non-choice column; serialization rewrites the map from the live choices, so a stale colour can never survive in the fence. Switching a text-like column to `select`/`multiSelect` seeds the choices from the values already in the cells (capped at 50), so retyping does not leave an empty picker.

**`image` and `attachment` columns hold one string each** — an `http(s)`/`data:` URL, a vault-relative attachment path (`tolaria/attachments/…`, the portable form), an `asset://` URL or an absolute path. The cell resolves that reference through `cellMedia.ts`: pictures render as thumbnails through Tauri's asset protocol, attachments render as a file chip that opens with the OS default app. Both need the vault root, which blocks cannot receive as a prop; `activeVaultPath.ts` is a module store that `Editor` keeps in sync, the same pattern as `useDocumentLocale`. Importing a file goes through the editor's own `uploadFile` hook (so it lands in the shared `tolaria/attachments` folder and the asset scope is already synced) and stores the *portable* relative path; a `data:`-URL result (upload with no vault open) is refused rather than copied verbatim into the fence. Single value per cell, on purpose: a row points at one file, which keeps the fence hand-editable; `multiSelect`-style arrays remain available if a multi-file cell is ever needed.
