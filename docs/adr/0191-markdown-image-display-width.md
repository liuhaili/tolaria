# ADR 0191: Preserve image display width in Markdown

Date: 2026-10-09
Status: Accepted for owner-approved local work; release gates outstanding.

## Context

BlockNote's Markdown image output discards the native image block's
previewWidth. SiYuan copies and manual resizing therefore lose their display
size when Tolaria saves or reopens a note.

## Decision

Use a reserved Markdown image title: `![alt](path "tolaria-width=50")`.
Attachment URLs continue using the existing portable-path conversion.
At load time, a custom inline image node reads the title, so images remain
in the same paragraph as the surrounding text. Saving preserves its width
metadata. Legacy block images retain the same title through the existing
block-width serializer. Raw HTML parsing is not required.
Only finite widths from 1 to 10000 pixels are accepted. Images without
dimensions retain their existing Markdown syntax. Fenced and inline code
are excluded from dimension rewriting.

## Consequences

The note and attachments remain self-contained; no configuration or sidecar
file is needed. Other Markdown readers still display the image, but need
not honor the title's dimension hint. This is a width-only, aspect-ratio-
preserving representation. Existing widthless notes cannot recover lost
dimensions without an original source. No dependency is added.

The owner's PS5 note was restored from its original SiYuan image styles and
its copied images were placed back after the text they annotate;
the source workspace was not modified.
