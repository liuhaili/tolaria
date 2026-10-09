import { memo, useCallback, type MouseEvent as ReactMouseEvent } from 'react'
import type { FolderCreationParent, FolderNode, SidebarSelection, VaultEntry } from '../../types'
import { FolderNameInput } from './FolderNameInput'
import { FolderItemRow } from './FolderItemRow'
import { FOLDER_ROW_CONTENT_INSET, getFolderConnectorLeft, getFolderDepthIndent } from './folderTreeLayout'
import { folderNodeKey } from './folderTreeUtils'
import { translate, type AppLocale } from '../../lib/i18n'
import { hasManagedVaultSegment, isInsideTolariaWorkspace } from '../../utils/managedVaultPaths'
import { VaultTreeEntryRow } from './VaultTreeEntryRow'

interface FolderTreeRowProps {
  depth: number
  expanded: Record<string, boolean>
  node: FolderNode
  entries?: VaultEntry[]
  creationParent?: FolderCreationParent
  isCreating?: boolean
  onCancelCreateFolder?: () => void
  onCreateFolderSubmit?: (value: string) => Promise<boolean>
  onDeleteFolder?: (folderPath: string) => void
  onOpenMenu: (node: FolderNode, event: ReactMouseEvent<HTMLElement>) => void
  onRenameFolder?: (folderPath: string, nextName: string) => Promise<boolean> | boolean
  onSelect: (selection: SidebarSelection) => void
  onSelectNote?: (entry: VaultEntry) => void
  onStartRenameFolder?: (folderPath: string) => void
  onToggle: (path: string) => void
  onCancelRenameFolder?: () => void
  onCanDropNote?: (notePath: string, folderPath: string) => boolean
  onMoveNoteToFolder?: (notePath: string, folderPath: string) => Promise<unknown> | unknown
  locale?: AppLocale
  renamingFolderPath?: string | null
  rootPath?: string
  selection: SidebarSelection
}

function FolderRenameRow({
  contentInset,
  depthIndent,
  node,
  locale,
  onCancelRenameFolder,
  onRenameFolder,
}: {
  contentInset: number
  depthIndent: number
  node: FolderNode
  locale: AppLocale
  onCancelRenameFolder: () => void
  onRenameFolder: (folderPath: string, nextName: string) => Promise<boolean> | boolean
}) {
  return (
    <div style={{ paddingLeft: depthIndent }}>
      <FolderNameInput
        ariaLabel={translate(locale, 'sidebar.folder.name')}
        initialValue={node.name}
        placeholder={translate(locale, 'sidebar.folder.name')}
        leftInset={contentInset}
        selectTextOnFocus={true}
        submitOnBlur={true}
        testId="rename-folder-input"
        onCancel={onCancelRenameFolder}
        onSubmit={(nextName) => onRenameFolder(node.path, nextName)}
      />
    </div>
  )
}

function FolderCreateRow({
  contentInset,
  depth,
  node,
  locale,
  onCancelCreateFolder,
  onCreateFolderSubmit,
}: {
  contentInset: number
  depth: number
  node: FolderNode
  locale: AppLocale
  onCancelCreateFolder: () => void
  onCreateFolderSubmit: (value: string) => Promise<boolean>
}) {
  return (
    <div data-testid={`folder-create-parent:${node.path}`} style={{ paddingLeft: getFolderDepthIndent(depth + 1) }}>
      <FolderNameInput
        ariaLabel={translate(locale, 'sidebar.folder.newName')}
        initialValue=""
        leftInset={contentInset}
        placeholder={translate(locale, 'sidebar.folder.name')}
        submitOnBlur={true}
        testId="new-folder-input"
        onCancel={onCancelCreateFolder}
        onSubmit={onCreateFolderSubmit}
      />
    </div>
  )
}

function FolderCreateRowSlot(options: {
  contentInset: number
  creationParent?: FolderCreationParent
  depth: number
  isCreating: boolean
  node: FolderNode
  locale: AppLocale
  onCancelCreateFolder?: () => void
  onCreateFolderSubmit?: (value: string) => Promise<boolean>
  rootPath?: string
}) {
  const {
    contentInset,
    creationParent,
    depth,
    isCreating,
    node,
    locale,
    onCancelCreateFolder,
    onCreateFolderSubmit,
    rootPath,
  } = options
  if (!isCreating) return null
  if (!creationParentMatchesNode(creationParent, node, rootPath)) return null
  if (!onCancelCreateFolder || !onCreateFolderSubmit) return null

  return (
    <FolderCreateRow
      contentInset={contentInset}
      depth={depth}
      node={node}
      locale={locale}
      onCancelCreateFolder={onCancelCreateFolder}
      onCreateFolderSubmit={onCreateFolderSubmit}
    />
  )
}

function FolderChildren(options: FolderTreeRowProps) {
  const {
    creationParent,
    depth,
    expanded,
    entries = [],
    isCreating,
    node,
    onCancelCreateFolder,
    onCreateFolderSubmit,
    onDeleteFolder,
    onOpenMenu,
    onRenameFolder,
    onSelect,
    onSelectNote,
    onStartRenameFolder,
    onToggle,
    onCancelRenameFolder,
    onCanDropNote,
    onMoveNoteToFolder,
    locale,
    renamingFolderPath,
    rootPath,
    selection,
  } = options
  const isExpanded = expanded[folderNodeKey({ path: node.path, rootPath: node.rootPath ?? rootPath })] ?? false
  const directEntries = entriesForFolder(entries, node.path, node.rootPath ?? rootPath)
  const hasChildren = node.children.length > 0 || directEntries.length > 0
  if (!isExpanded || !hasChildren) return null

  return (
    <div className="relative" data-testid={`folder-children:${node.path}`}>
      <div
        className="absolute top-0 bottom-0 bg-border"
        data-testid={`folder-connector:${node.path}`}
        style={{ left: getFolderConnectorLeft(depth), width: 1 }}
      />
      {node.children.map((child) => (
        <FolderTreeRow
          key={folderNodeKey({
            path: child.path,
            rootPath: child.rootPath ?? rootPath,
          })}
          depth={depth + 1}
          expanded={expanded}
          node={child}
          entries={entries}
          creationParent={creationParent}
          isCreating={isCreating}
          onCancelCreateFolder={onCancelCreateFolder}
          onCreateFolderSubmit={onCreateFolderSubmit}
          onDeleteFolder={onDeleteFolder}
          onOpenMenu={onOpenMenu}
          onRenameFolder={onRenameFolder}
          onSelect={onSelect}
          onSelectNote={onSelectNote}
          onStartRenameFolder={onStartRenameFolder}
          onToggle={onToggle}
          onCancelRenameFolder={onCancelRenameFolder}
          onCanDropNote={onCanDropNote}
          onMoveNoteToFolder={onMoveNoteToFolder}
          locale={locale}
          renamingFolderPath={renamingFolderPath}
          rootPath={rootPath}
          selection={selection}
        />
      ))}
      {onSelectNote && directEntries.map((entry) => (
        <VaultTreeEntryRow key={entry.path} depth={depth + 1} entry={entry} onSelect={onSelectNote} />
      ))}
    </div>
  )
}

function creationParentMatchesNode(
  creationParent: FolderCreationParent | undefined,
  node: FolderNode,
  defaultRootPath?: string,
): boolean {
  if (!creationParent || creationParent.path !== node.path) return false
  const nodeRootPath = node.rootPath ?? defaultRootPath
  const creationRootPath = creationParent.rootPath ?? defaultRootPath
  return nodeRootPath === creationRootPath
}

function folderSelectionMatches(selection: SidebarSelection, node: FolderNode, defaultRootPath?: string): boolean {
  if (selection.kind !== 'folder' || selection.path !== node.path) return false

  const nodeRootPath = node.rootPath ?? defaultRootPath
  if (!nodeRootPath) return !selection.rootPath
  if (selection.rootPath) return selection.rootPath === nodeRootPath
  return nodeRootPath === defaultRootPath
}

function selectionForFolder(path: string, rootPath?: string): SidebarSelection {
  return rootPath ? { kind: 'folder', path, rootPath } : { kind: 'folder', path }
}

export const FolderTreeRow = memo(function FolderTreeRow(options: FolderTreeRowProps) {
  const {
    creationParent,
    depth,
    expanded,
    isCreating = false,
    node,
    entries = [],
    onCancelCreateFolder,
    onCreateFolderSubmit,
    onDeleteFolder,
    onOpenMenu,
    onRenameFolder,
    onSelect,
    onSelectNote,
    onStartRenameFolder,
    onToggle,
    onCancelRenameFolder,
    onCanDropNote,
    onMoveNoteToFolder,
    locale = 'en',
    renamingFolderPath,
    rootPath,
    selection,
  } = options
  const { nodeKey, nodeRootPath, isExpanded, isSelected, canUseDefaultFolderActions, canMutateFolder, isRenaming } = resolveFolderTreeRowState(options)
  const depthIndent = getFolderDepthIndent(depth)
  const contentInset = FOLDER_ROW_CONTENT_INSET
  const selectFolder = useCallback(() => {
    onSelect(selectionForFolder(node.path, nodeRootPath))
  }, [node.path, nodeRootPath, onSelect])
  const row = (
    <FolderItemRow
      canOpenMenu={canUseDefaultFolderActions}
      contentInset={contentInset}
      depthIndent={depthIndent}
      isExpanded={isExpanded}
      isSelected={isSelected}
      node={node}
      hasEntries={entriesForFolder(entries, node.path, nodeRootPath).length > 0}
      onOpenMenu={onOpenMenu}
      onSelect={selectFolder}
      onStartRenameFolder={canMutateFolder ? onStartRenameFolder : undefined}
      onToggle={() => onToggle(nodeKey)}
      onCanDropNote={onCanDropNote}
      onMoveNoteToFolder={onMoveNoteToFolder}
    />
  )

  return (
    <>
      {isRenaming && onRenameFolder && onCancelRenameFolder ? (
        <FolderRenameRow
          contentInset={contentInset}
          depthIndent={depthIndent}
          node={node}
          locale={locale}
          onCancelRenameFolder={onCancelRenameFolder}
          onRenameFolder={onRenameFolder}
        />
      ) : (
        row
      )}
      <FolderCreateRowSlot
        contentInset={contentInset}
        creationParent={creationParent}
        depth={depth}
        isCreating={isCreating}
        node={node}
        locale={locale}
        onCancelCreateFolder={onCancelCreateFolder}
        onCreateFolderSubmit={onCreateFolderSubmit}
        rootPath={rootPath}
      />
      <FolderChildren
        creationParent={creationParent}
        depth={depth}
        expanded={expanded}
        entries={entries}
        isCreating={isCreating}
        node={node}
        onCancelCreateFolder={onCancelCreateFolder}
        onCreateFolderSubmit={onCreateFolderSubmit}
        onDeleteFolder={onDeleteFolder}
        onOpenMenu={onOpenMenu}
        onRenameFolder={onRenameFolder}
        onSelect={onSelect}
        onSelectNote={onSelectNote}
        onStartRenameFolder={onStartRenameFolder}
        onToggle={onToggle}
        onCancelRenameFolder={onCancelRenameFolder}
        onCanDropNote={onCanDropNote}
        onMoveNoteToFolder={onMoveNoteToFolder}
        locale={locale}
        renamingFolderPath={renamingFolderPath}
        rootPath={rootPath}
        selection={selection}
      />
    </>
  )
})

export function entriesForFolder(entries: VaultEntry[], folderPath: string, rootPath?: string): VaultEntry[] {
  const normalizedRootPath = normalizePath(rootPath ?? '')
  const normalizedFolderPath = normalizePath(folderPath)
  const resolvedEntries = entries.map((entry) => ({
    entry,
    relativeEntryPath: relativePath(entry.path, normalizedRootPath),
  }))
  const hasResolvedVaultPath = resolvedEntries.some(({ relativeEntryPath }) => relativeEntryPath !== null)

  if (!hasResolvedVaultPath && !normalizedFolderPath) {
    return entries.filter((entry) => !hasManagedVaultSegment(entry.path))
  }

  return resolvedEntries.filter(({ relativeEntryPath }) => {
    if (!relativeEntryPath || isInsideTolariaWorkspace(relativeEntryPath)) return false
    const parentPath = relativeEntryPath.includes('/')
      ? relativeEntryPath.slice(0, relativeEntryPath.lastIndexOf('/'))
      : ''
    return parentPath === normalizedFolderPath
  }).map(({ entry }) => entry)
}

function normalizePath(path: string): string {
  const withForwardSlashes = path.replace(/\\/g, '/')
  return withForwardSlashes
    .replace(/^\/\/\?\//, '')
    .replace(/^\/+|\/+$/g, '')
}

function relativePath(entryPath: string, rootPath: string): string | null {
  const normalizedEntryPath = normalizePath(entryPath)
  if (!rootPath) return normalizedEntryPath
  const normalizedRootPath = normalizePath(rootPath)
  const rootPrefix = `${normalizedRootPath}/`
  const isWindowsPath = /^[a-z]:\//i.test(normalizedRootPath)
  const matchesRoot = normalizedEntryPath.startsWith(rootPrefix)
    || (isWindowsPath && normalizedEntryPath.toLocaleLowerCase().startsWith(rootPrefix.toLocaleLowerCase()))
  if (!matchesRoot) return null
  return normalizedEntryPath.slice(normalizedRootPath.length + 1)
}

function resolveFolderTreeRowState(options: Pick<FolderTreeRowProps, 'expanded' | 'node' | 'renamingFolderPath' | 'rootPath' | 'selection'>) {
  const { expanded, node, renamingFolderPath, rootPath, selection } = options
  const nodeRootPath = node.rootPath ?? rootPath
  const nodeKey = folderNodeKey({ path: node.path, rootPath: nodeRootPath })
  const canUseDefaultFolderActions = !nodeRootPath || nodeRootPath === rootPath
  const canMutateFolder = node.path.length > 0 && canUseDefaultFolderActions
  return {
    nodeKey,
    nodeRootPath,
    isExpanded: (Reflect.get(expanded, nodeKey) as boolean | undefined) ?? false,
    isSelected: folderSelectionMatches(selection, { ...node, rootPath: nodeRootPath }, rootPath),
    canUseDefaultFolderActions,
    canMutateFolder,
    isRenaming: canMutateFolder && renamingFolderPath === node.path,
  }
}
