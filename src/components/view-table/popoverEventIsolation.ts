import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'

/**
 * Stops popover interactions from reaching react-data-grid.
 *
 * Radix portals move a popover's DOM into `document.body`, but React keeps
 * dispatching synthetic events along the **React** tree rather than the DOM
 * tree. A popover rendered from inside a grid header or cell is still a React
 * child of that header/cell, so every click inside it also reached the grid's
 * own handlers.
 *
 * That silently reverted column edits: picking a type in the column menu first
 * committed the new column, then the grid's click-to-sort fired and committed
 * the *pre-change* table (from its stale closure) over the top of it, so the
 * type looked like it never changed.
 *
 * Spreading these onto the popover's content wrapper cuts the synthetic event
 * off at the popover boundary. Native focus/blur and Radix's own
 * outside-click dismissal are unaffected.
 */
export const isolatePopoverEvents = {
  onClick: (event: ReactMouseEvent) => event.stopPropagation(),
  onDoubleClick: (event: ReactMouseEvent) => event.stopPropagation(),
  onMouseDown: (event: ReactMouseEvent) => event.stopPropagation(),
  onPointerDown: (event: ReactPointerEvent) => event.stopPropagation(),
}
