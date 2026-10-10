/**
 * Turns a cell's stored media reference into something the webview can show.
 *
 * A cell holds one string: an `http(s)` URL, a `data:` URL, a vault-relative
 * attachment path (`tolaria/attachments/…`, the portable form that keeps the
 * note usable on another machine) or an absolute path. Everything local is
 * rendered through Tauri's asset protocol, which needs the vault root — hence
 * `vaultPath` on every call.
 */
import { isTauri } from '../../mock-tauri'
import {
  attachmentAssetUrlFromPath,
  filesystemPathFromAssetUrl,
  isPortableAttachmentPath,
  isTauriAssetUrl,
  vaultAttachmentPath,
} from '../../utils/vaultAttachments'

const REMOTE_URL_PATTERN = /^(https?:|data:|blob:)/i
const WINDOWS_DRIVE_PATH_PATTERN = /^[A-Za-z]:[\\/]/

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Absolute on-disk path for a local reference, or `null` when there is none. */
export function cellMediaPath(value: unknown, vaultPath?: string): string | null {
  const text = trimmed(value)
  if (text === '' || REMOTE_URL_PATTERN.test(text)) return null

  if (isTauriAssetUrl({ url: text })) return filesystemPathFromAssetUrl({ url: text })

  if (isPortableAttachmentPath({ path: text })) {
    const root = trimmed(vaultPath)
    return root === '' ? null : vaultAttachmentPath({ attachmentPath: text, vaultPath: root })
  }

  if (WINDOWS_DRIVE_PATH_PATTERN.test(text) || text.startsWith('/') || text.startsWith('\\\\')) {
    return text
  }

  const root = trimmed(vaultPath)
  return root === '' ? null : vaultAttachmentPath({ attachmentPath: text, vaultPath: root })
}

/** URL for an `<img src>`, or `null` when the reference cannot be displayed. */
export function cellMediaUrl(value: unknown, vaultPath?: string): string | null {
  const text = trimmed(value)
  if (text === '') return null
  if (REMOTE_URL_PATTERN.test(text)) return text
  if (isTauriAssetUrl({ url: text })) return text
  if (!isTauri()) return null

  const path = cellMediaPath(text, vaultPath)
  if (path === null) return null
  try {
    return attachmentAssetUrlFromPath({ path })
  } catch (error) {
    console.warn('[view-table] Failed to build an asset URL for cell media:', error)
    return null
  }
}

/** Last path segment, used as the chip label. */
export function cellFileName(value: unknown): string {
  const text = trimmed(value)
  if (text === '') return ''
  const withoutQuery = text.split(/[?#]/u)[0] ?? text
  const segments = withoutQuery.split(/[\\/]/u)
  const name = segments.at(-1) ?? withoutQuery
  try {
    return decodeURIComponent(name)
  } catch {
    return name
  }
}

/** Uppercase extension without the dot, for the chip badge. */
export function cellFileExtension(value: unknown): string {
  const name = cellFileName(value)
  const index = name.lastIndexOf('.')
  if (index <= 0 || index === name.length - 1) return ''
  return name.slice(index + 1).toUpperCase().slice(0, 5)
}

/** Extensions previewed inline as an image rather than as a file chip. */
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico'])

export function looksLikeImage(value: unknown): boolean {
  return IMAGE_EXTENSIONS.has(cellFileExtension(value).toLowerCase())
}
