import { useState } from 'react'
import { FlowArrow } from '@phosphor-icons/react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { translate } from '../lib/i18n'

export function DiagramCreateButton({ onCreate }: { onCreate: (title: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const t = (key: Parameters<typeof translate>[1]) => translate('zh-CN', key)
  const create = async () => {
    if (!title.trim() || busy) return
    setBusy(true)
    setError(false)
    try { await onCreate(title.trim()); setOpen(false); setTitle('') }
    catch { setError(true) }
    finally { setBusy(false) }
  }
  return <>
    <Button variant="ghost" size="icon-xs" title={t('drawio.new')} aria-label={t('drawio.new')} onClick={() => setOpen(true)}><FlowArrow size={16} /></Button>
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value) }}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{t('drawio.new')}</DialogTitle></DialogHeader>
        <Input aria-label={t('drawio.name')} placeholder={t('drawio.name')} value={title} disabled={busy} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) void create() }} />
        {error && <p role="alert">{t('drawio.error')}</p>}
        <Button disabled={busy || !title.trim()} onClick={() => void create()}>{t('drawio.create')}</Button>
      </DialogContent>
    </Dialog>
  </>
}
