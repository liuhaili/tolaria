import { useState } from 'react'
import type { MindElixirInstance, NodeObj } from 'mind-elixir'
import { translate } from '../lib/i18n'
import { type MindmapAppearance } from '../utils/mindmapData'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { ColorSwatch } from './ColorInput'
import { EmojiPicker } from './EmojiPicker'
import { trackEvent } from '../lib/telemetry'

const t = (key: Parameters<typeof translate>[1]) => translate('zh-CN', key)
interface MindmapToolbarProps {
  selected: NodeObj | null
  theme: MindmapAppearance
  busy: boolean
  run: (action: (mind: MindElixirInstance) => void | Promise<void>) => void
  reshape: (patch: Partial<NodeObj>) => void
  changeTheme: (value: MindmapAppearance) => void
  changeLayout: (value: string) => void
  finish: () => Promise<void>
}

export function MindmapToolbar({ selected, theme, busy, run, reshape, changeTheme, changeLayout, finish }: MindmapToolbarProps) {
  const [emojiOpen, setEmojiOpen] = useState(false)
  const changeStyle = (patch: NonNullable<NodeObj['style']>) => {
    reshape({ style: { ...selected?.style, ...patch } })
    trackEvent('editor_mindmap_styled', { control: 'node' })
  }
  return <div className="flex flex-wrap items-center gap-2 py-2">
    <Button variant="outline" size="sm" disabled={busy} onClick={() => run(mind => mind.addChild(mind.currentNode ?? mind.findEle(mind.nodeData.id)))}>{t('mindmap.addChild')}</Button>
    <Button variant="outline" size="sm" disabled={busy || !selected} onClick={() => run(mind => mind.insertSibling('after'))}>{t('mindmap.addSibling')}</Button>
    <Button variant="ghost" size="sm" disabled={busy || !selected} onClick={() => run(mind => mind.beginEdit())}>{t('mindmap.rename')}</Button>
    <Button variant="ghost" size="sm" disabled={busy || !selected} onClick={() => run(mind => mind.removeNodes(mind.currentNodes))}>{t('mindmap.delete')}</Button>
    <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(mind => mind.undo())}>{t('mindmap.undo')}</Button>
    <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(mind => mind.redo())}>{t('mindmap.redo')}</Button>
    <Select value={theme} disabled={busy} onValueChange={value => changeTheme(value as MindmapAppearance)}>
      <SelectTrigger className="w-28" aria-label={t('mindmap.theme')}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="colorful">{t('mindmap.colorful')}</SelectItem>
        <SelectItem value="minimal">{t('mindmap.minimal')}</SelectItem>
        <SelectItem value="ocean">{t('mindmap.ocean')}</SelectItem>
      </SelectContent>
    </Select>
    <Select disabled={busy} onValueChange={changeLayout}>
      <SelectTrigger className="w-28" aria-label={t('mindmap.layout')}><SelectValue placeholder={t('mindmap.layout')} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="2">{t('mindmap.bothSides')}</SelectItem>
        <SelectItem value="1">{t('mindmap.right')}</SelectItem>
        <SelectItem value="3">{t('mindmap.down')}</SelectItem>
      </SelectContent>
    </Select>
    <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(mind => mind.scale(mind.scaleVal / 1.2))} aria-label={t('mindmap.zoomOut')}>−</Button>
    <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(mind => mind.scale(mind.scaleVal * 1.2))} aria-label={t('mindmap.zoomIn')}>+</Button>
    <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(mind => mind.scaleFit())}>{t('mindmap.fit')}</Button>
    <Button className="ml-auto" size="sm" disabled={busy} onClick={() => void finish()}>{t(busy ? 'mindmap.saving' : 'mindmap.finish')}</Button>
    <div className="flex w-full flex-wrap items-center gap-3 text-sm" aria-label={t('mindmap.nodeStyle')}>
      <span className="text-muted-foreground">{t('mindmap.nodeStyle')}</span>
      <Button variant="outline" size="sm" disabled={busy || !selected} aria-pressed={selected?.style?.fontWeight === 'bold'} onClick={() => changeStyle({ fontWeight: selected?.style?.fontWeight === 'bold' ? 'normal' : 'bold' })}>{t('mindmap.bold')}</Button>
      <Select value={selected?.style?.fontSize ?? '16px'} disabled={busy || !selected} onValueChange={value => changeStyle({ fontSize: value })}>
        <SelectTrigger className="w-24" aria-label={t('mindmap.fontSize')}><SelectValue /></SelectTrigger>
        <SelectContent>{[12, 14, 16, 18, 20, 24, 28, 32].map(size => <SelectItem key={size} value={`${size}px`}>{size}</SelectItem>)}</SelectContent>
      </Select>
      {!busy && selected && <>
        <span className="flex items-center gap-2">{t('mindmap.textColor')}<ColorSwatch color={selected.style?.color ?? '#64748b'} onChange={color => changeStyle({ color })} /></span>
        <span className="flex items-center gap-2">{t('mindmap.backgroundColor')}<ColorSwatch color={selected.style?.background ?? '#ffffff'} onChange={background => changeStyle({ background })} /></span>
        <span className="flex items-center gap-2">{t('mindmap.branchColor')}<ColorSwatch color={selected.branchColor ?? '#8b5cf6'} onChange={branchColor => { reshape({ branchColor }); trackEvent('editor_mindmap_styled', { control: 'branch' }) }} /></span>
      </>}
      <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
        <PopoverTrigger asChild><Button variant="outline" size="sm" disabled={busy || !selected}>{selected?.icons?.[0] ?? t('mindmap.emoji')}</Button></PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <EmojiPicker inline searchPlaceholder={t('tree.emoji.search')} emptyLabel={t('tree.emoji.empty')} onClose={() => setEmojiOpen(false)} onSelect={emoji => { reshape({ icons: [emoji] }); trackEvent('editor_mindmap_styled', { control: 'emoji' }) }} />
        </PopoverContent>
      </Popover>
    </div>
  </div>
}
