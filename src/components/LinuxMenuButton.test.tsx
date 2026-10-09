import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LinuxMenuButton } from './LinuxMenuButton'

const MENU_TEST_TIMEOUT_MS = 10_000

const { close, invoke, minimize, toggleMaximize } = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue(undefined),
  minimize: vi.fn().mockResolvedValue(undefined),
  toggleMaximize: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke,
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ minimize, toggleMaximize, close }),
}))

async function openSubmenu(label: string) {
  fireEvent.pointerDown(screen.getByRole('button'), { button: 0 })
  const trigger = await screen.findByRole('menuitem', {
    name: (accessibleName) => accessibleName.includes(label),
  })
  fireEvent.pointerMove(trigger)
  fireEvent.click(trigger)
}

describe('LinuxMenuButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dispatches shared menu commands from the Linux menu', async () => {
    render(<LinuxMenuButton />)

    await openSubmenu('Edit')
    expect(screen.getByText('Ctrl+Shift+V')).toBeInTheDocument()
    fireEvent.click(await screen.findByText('Paste without Formatting'))
    expect(invoke).toHaveBeenCalledWith('trigger_menu_command', { id: 'edit-paste-plain-text' })
    await waitFor(() => expect(screen.queryByText('Paste without Formatting')).not.toBeInTheDocument())

    await openSubmenu('View')
    expect(screen.getByText('Ctrl+Shift+L')).toBeInTheDocument()
    fireEvent.click(await screen.findByText('Toggle AI Panel'))
    expect(invoke).toHaveBeenCalledWith('trigger_menu_command', { id: 'view-toggle-ai-chat' })
  }, MENU_TEST_TIMEOUT_MS)

  it('uses one compact application-menu button on desktop', async () => {
    render(<LinuxMenuButton />)

    expect(screen.getByRole('button', { name: 'Application menu' })).toBeInTheDocument()
    expect(screen.queryByTestId('desktop-horizontal-menu')).not.toBeInTheDocument()

    await openSubmenu('File')
    fireEvent.click(await screen.findByText('New Note'))
    expect(invoke).toHaveBeenCalledWith('trigger_menu_command', { id: 'file-new-note' })
  }, MENU_TEST_TIMEOUT_MS)

  it('keeps every desktop menu section inside the compact menu', async () => {
    render(<LinuxMenuButton />)

    await openSubmenu('Edit')
    expect(await screen.findByText('Paste without Formatting')).toBeInTheDocument()
  }, MENU_TEST_TIMEOUT_MS)

  /* The localized command wording is covered by the command catalog tests.
   * This component only owns the compact-menu shell. */
  /* it('localizes the custom desktop menu when a locale is provided', async () => {
    render(<LinuxMenuButton locale="zh-CN" />)

    expect(screen.getByRole('button', { name: '文件' })).toBeInTheDocument()

    await openHorizontalMenu('视图')
    expect(await screen.findByText('实际大小')).toBeInTheDocument()
    fireEvent.click(await screen.findByText('切换 AI 面板'))

    expect(invoke).toHaveBeenCalledWith('trigger_menu_command', { id: 'view-toggle-ai-chat' })
  }, MENU_TEST_TIMEOUT_MS) */

  it('invokes direct window actions from the Window submenu', async () => {
    render(<LinuxMenuButton />)

    await openSubmenu('Window')
    fireEvent.click(await screen.findByText('Minimize'))

    await openSubmenu('Window')
    fireEvent.click(await screen.findByText('Maximize'))

    await openSubmenu('Window')
    fireEvent.click(await screen.findByText('Close'))

    expect(minimize).toHaveBeenCalledOnce()
    expect(toggleMaximize).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })
})
