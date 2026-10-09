import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { Sidebar } from './Sidebar'

it('forwards diagram creation through every sidebar layer', async () => {
  const create = vi.fn().mockResolvedValue(undefined)
  render(<Sidebar entries={[]} selection={{ kind: 'filter', filter: 'all' }} onSelect={vi.fn()} onCreateDiagram={create} />)
  fireEvent.click(screen.getByRole('button', { name: '新建流程图' }))
  fireEvent.change(screen.getByRole('textbox', { name: '流程图名称' }), { target: { value: '登录流程' } })
  fireEvent.click(screen.getByRole('button', { name: '创建' }))
  await waitFor(() => expect(create).toHaveBeenCalledWith('登录流程'))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
