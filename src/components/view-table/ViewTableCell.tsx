import { useMemo, useState } from 'react'
import { Check, Plus } from '@phosphor-icons/react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { translate, type AppLocale } from '../../lib/i18n'
import {
  viewTableOptionColor,
  type ViewTableCellValue,
  type ViewTableColumn,
  type ViewTableOptionColor,
} from '../../utils/viewTableModel'
import { OptionColorPicker } from './OptionColorPalette'
import { isolatePopoverEvents } from './popoverEventIsolation'

export interface ViewTablePickerCellProps {
  column: ViewTableColumn
  value: ViewTableCellValue
  locale: AppLocale
  editable: boolean
  onChange: (value: ViewTableCellValue) => void
  onChangeOptions: (options: string[]) => void
  onChangeOptionColor: (option: string, color: ViewTableOptionColor | null) => void
}

/** Single choice: a chip that opens the option list (with inline "add option"). */
export function SelectCell({
  column,
  value,
  locale,
  editable,
  onChange,
  onChangeOptions,
  onChangeOptionColor,
}: ViewTablePickerCellProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const current = typeof value === 'string' ? value : ''
  const options = useMemo(() => {
    if (current === '' || column.options.includes(current)) return column.options
    return [current, ...column.options]
  }, [column.options, current])

  if (!editable) {
    if (current === '') return null
    return (
      <span
        className="view-table__chip view-table__chip--static"
        data-option-color={viewTableOptionColor(column, current) ?? undefined}
      >
        <span className="view-table__chip-label">{current}</span>
      </span>
    )
  }

  const addOption = () => {
    const next = draft.trim()
    setDraft('')
    if (next === '') return
    if (!column.options.includes(next)) onChangeOptions([...column.options, next])
    onChange(next)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={current === '' ? 'view-table__chip view-table__chip--empty' : 'view-table__chip'}
          data-option-color={current === '' ? undefined : viewTableOptionColor(column, current) ?? undefined}
          aria-label={column.name}
        >
          <span className="view-table__chip-label">
            {current === '' ? translate(locale, 'viewTable.emptyCell') : current}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="view-table__menu" data-testid="view-table-select-picker" {...isolatePopoverEvents}>
        <div className="view-table__option-list">
          {options.length === 0 && (
            <span className="view-table__placeholder">{translate(locale, 'viewTable.noOptions')}</span>
          )}
          {options.map((option) => (
            <div className="view-table__option-row" key={option}>
              <button
                type="button"
                className="view-table__option-pick"
                data-active={option === current}
                onClick={() => {
                  onChange(option)
                  setOpen(false)
                }}
              >
                <span
                  className="view-table__option-dot"
                  data-option-color={viewTableOptionColor(column, option) ?? undefined}
                  aria-hidden
                />
                <span className="view-table__option-name">{option}</span>
                {option === current && <Check size={12} aria-hidden />}
              </button>
              <OptionColorPicker
                locale={locale}
                color={viewTableOptionColor(column, option)}
                onChange={(color) => onChangeOptionColor(option, color)}
              />
            </div>
          ))}
        </div>
        <div className="view-table__menu-separator" />
        <div className="flex items-center gap-1.5">
          <Input
            className="view-table__menu-input"
            value={draft}
            placeholder={translate(locale, 'viewTable.addOption')}
            aria-label={translate(locale, 'viewTable.addOption')}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addOption()
              }
            }}
          />
          <button
            type="button"
            className="view-table__icon-button"
            aria-label={translate(locale, 'viewTable.addOption')}
            onClick={addOption}
          >
            <Plus size={12} />
          </button>
        </div>
        {current !== '' && (
          <>
            <div className="view-table__menu-separator" />
            <button
              type="button"
              className="view-table__menu-action"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
            >
              {translate(locale, 'viewTable.clearValue')}
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** Multiple choices: tags that open a checkbox list. */
export function MultiSelectCell({
  column,
  value,
  locale,
  editable,
  onChange,
  onChangeOptions,
  onChangeOptionColor,
}: ViewTablePickerCellProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const selected = useMemo(() => (Array.isArray(value) ? value : []), [value])
  const options = useMemo(() => {
    const list = [...column.options]
    for (const item of selected) {
      if (!list.includes(item)) list.push(item)
    }
    return list
  }, [column.options, selected])

  const toggle = (option: string) => {
    const next = selected.includes(option)
      ? selected.filter((candidate) => candidate !== option)
      : [...selected, option]
    onChange(next.length === 0 ? null : next)
  }

  const commitDraft = () => {
    const next = draft.trim()
    setDraft('')
    if (next === '') return
    if (!column.options.includes(next)) onChangeOptions([...column.options, next])
    if (!selected.includes(next)) onChange([...selected, next])
  }

  const visible = selected.slice(0, 3)
  const overflow = selected.length - visible.length

  if (!editable) {
    if (selected.length === 0) return null
    return (
      <span className="view-table__tags">
        {selected.map((item) => (
          <span
            className="view-table__tag"
            key={item}
            data-option-color={viewTableOptionColor(column, item) ?? undefined}
          >
            {item}
          </span>
        ))}
      </span>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={selected.length === 0 ? 'view-table__chip view-table__chip--empty' : 'view-table__chip'}
          aria-label={column.name}
        >
          {selected.length === 0
            ? <span className="view-table__chip-label">{translate(locale, 'viewTable.emptyCell')}</span>
            : (
              <span className="view-table__chip-label">
                {visible.join(', ')}
                {overflow > 0 ? ` +${overflow}` : ''}
              </span>
            )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="view-table__menu" data-testid="view-table-multiselect-picker" {...isolatePopoverEvents}>
        <div className="view-table__option-list">
          {options.length === 0 && (
            <span className="view-table__placeholder">{translate(locale, 'viewTable.noOptions')}</span>
          )}
          {options.map((option) => (
            <div className="view-table__option-row" key={option}>
              <label>
                <Checkbox checked={selected.includes(option)} onCheckedChange={() => toggle(option)} />
                <span
                  className="view-table__option-dot"
                  data-option-color={viewTableOptionColor(column, option) ?? undefined}
                  aria-hidden
                />
                <span className="view-table__option-name">{option}</span>
              </label>
              <OptionColorPicker
                locale={locale}
                color={viewTableOptionColor(column, option)}
                onChange={(color) => onChangeOptionColor(option, color)}
              />
            </div>
          ))}
        </div>
        <div className="view-table__menu-separator" />
        <div className="flex items-center gap-1.5">
          <Input
            className="view-table__menu-input"
            value={draft}
            placeholder={translate(locale, 'viewTable.addOption')}
            aria-label={translate(locale, 'viewTable.addOption')}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitDraft()
              }
            }}
          />
          <button
            type="button"
            className="view-table__icon-button"
            aria-label={translate(locale, 'viewTable.addOption')}
            onClick={commitDraft}
          >
            <Plus size={12} />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
