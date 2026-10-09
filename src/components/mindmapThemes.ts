import MindElixir, { type Theme } from 'mind-elixir'
import type { MindmapAppearance } from '../utils/mindmapData'

const PALETTES: Record<MindmapAppearance, string[]> = {
  colorful: ['#8b5cf6', '#3b82f6', '#14b8a6', '#f59e0b', '#ec4899', '#ef4444'],
  minimal: ['#64748b', '#94a3b8', '#475569', '#78716c'],
  ocean: ['#0284c7', '#06b6d4', '#14b8a6', '#6366f1', '#38bdf8'],
}

export function mindmapTheme(appearance: MindmapAppearance): Theme {
  const dark = document.documentElement.dataset.theme === 'dark'
  const base = dark ? MindElixir.DARK_THEME : MindElixir.THEME
  return { ...base, name: `tolaria-${appearance}`, palette: PALETTES[appearance], cssVar: {
    ...base.cssVar,
    '--bgcolor': dark ? '#1d2027' : '#fafbff',
    '--root-bgcolor': appearance === 'ocean' ? '#0284c7' : appearance === 'minimal' ? '#475569' : '#7c3aed',
    '--root-color': '#ffffff',
    '--root-border-color': 'transparent',
    '--root-radius': '18px',
    '--main-radius': '10px',
    '--topic-padding': '10px 16px',
    '--main-gap-x': '70px',
    '--main-gap-y': '22px',
    '--node-gap-x': '36px',
    '--node-gap-y': '14px',
  } }
}
