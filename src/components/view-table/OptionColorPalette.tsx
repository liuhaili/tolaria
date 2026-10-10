import { useState } from 'react'
import { PaintBrush, Prohibit } from '@phosphor-icons/react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { translate, type AppLocale, type TranslationKey } from '../../lib/i18n'
import {
  VIEW_TABLE_OPTION_COLORS,
  type ViewTableOptionColor,
} from '../../utils/viewTableModel'
import { isolatePopoverEvents } from './popoverEventIsolation'

const COLOR_LABEL_KEYS: Record<ViewTableOptionColor, TranslationKey> = {
  gray: 'viewTable.color.gray',
  brown: 'viewTable.color.brown',
  orange: 'viewTable.color.orange',
  yellow: 'viewTable.color.yellow',
  green: 'viewTable.color.green',
  teal: 'viewTable.color.teal',
  blue: 'viewTable.color.blue',
  purple: 'viewTable.color.purple',
  pink: 'viewTable.color.pink',
  red: 'viewTable.color.red',
}

/** The ten palette entries plus "no colour". */
export function OptionColorPalette({
  locale,
  color,
  onPick,
}: {
  locale: AppLocale
  color: ViewTableOptionColor | null
  onPick: (color: ViewTableOptionColor | null) => void
}) {
  return (
    // The palette is its own popover layer, so it needs the same event guard
    // as every other menu here (see popoverEventIsolation).
    <div className="view-table__color-grid" data-testid="view-table-color-palette" {...isolatePopoverEvents}>
      {VIEW_TABLE_OPTION_COLORS.map((candidate) => {
        const label = translate(locale, COLOR_LABEL_KEYS[candidate])
        return (
          <Button
            key={candidate}
            type="button"
            variant="ghost"
            size="icon-xs"
            className="view-table__color-swatch"
            data-option-color={candidate}
            data-active={candidate === color}
            aria-label={label}
            title={label}
            onClick={() => onPick(candidate)}
          />
        )
      })}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="view-table__color-swatch view-table__color-swatch--none"
        data-active={color === null}
        aria-label={translate(locale, 'viewTable.colorNone')}
        title={translate(locale, 'viewTable.colorNone')}
        onClick={() => onPick(null)}
      >
        <Prohibit size={10} aria-hidden />
      </Button>
    </div>
  )
}

/**
 * Swatch trigger + palette, shown on every choice row.
 *
 * Nested inside another popover on purpose: the surrounding select menu or
 * column menu stays open while a choice is being coloured.
 */
export function OptionColorPicker({
  locale,
  color,
  onChange,
}: {
  locale: AppLocale
  color: ViewTableOptionColor | null
  onChange: (color: ViewTableOptionColor | null) => void
}) {
  const [open, setOpen] = useState(false)
  const label = translate(locale, 'viewTable.optionColor')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="view-table__color-trigger"
          data-option-color={color ?? undefined}
          data-active={open}
          aria-label={label}
          title={label}
          data-testid="view-table-color-trigger"
        >
          <PaintBrush size={11} aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="right"
        className="view-table__menu view-table__menu--colors"
        data-testid="view-table-color-popover"
        {...isolatePopoverEvents}
      >
        <OptionColorPalette
          locale={locale}
          color={color}
          onPick={(next) => {
            onChange(next)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
