import {
  CalendarBlank,
  CaretCircleDown,
  CheckSquare,
  Hash,
  Image,
  LinkSimple,
  Paperclip,
  Tag,
  TextT,
} from '@phosphor-icons/react'
import { translate, type AppLocale, type TranslationKey } from '../../lib/i18n'
import type { ViewTableColumnType } from '../../utils/viewTableModel'

/** Icon shown on a column header and in the type picker. */
export const VIEW_TABLE_TYPE_ICONS: Record<ViewTableColumnType, typeof TextT> = {
  text: TextT,
  number: Hash,
  date: CalendarBlank,
  checkbox: CheckSquare,
  select: CaretCircleDown,
  multiSelect: Tag,
  url: LinkSimple,
  image: Image,
  attachment: Paperclip,
}

const TYPE_LABEL_KEYS: Record<ViewTableColumnType, TranslationKey> = {
  text: 'viewTable.type.text',
  number: 'viewTable.type.number',
  date: 'viewTable.type.date',
  checkbox: 'viewTable.type.checkbox',
  select: 'viewTable.type.select',
  multiSelect: 'viewTable.type.multiSelect',
  url: 'viewTable.type.url',
  image: 'viewTable.type.image',
  attachment: 'viewTable.type.attachment',
}

export function viewTableTypeLabel(locale: AppLocale, type: ViewTableColumnType): string {
  return translate(locale, TYPE_LABEL_KEYS[type])
}
