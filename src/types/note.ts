export type NoteColor = 'default' | 'yellow' | 'blue' | 'green' | 'red' | 'purple'

export const NOTE_COLORS: NoteColor[] = ['default', 'yellow', 'blue', 'green', 'red', 'purple']

// Full class strings — must be complete for Tailwind to detect them
export const NOTE_COLOR_CLASSES: Record<NoteColor, string> = {
  default: 'bg-zinc-900 border-zinc-800',
  yellow:  'bg-yellow-950/40 border-yellow-900/60',
  blue:    'bg-blue-950/40 border-blue-900/60',
  green:   'bg-green-950/40 border-green-900/60',
  red:     'bg-red-950/40 border-red-900/60',
  purple:  'bg-purple-950/40 border-purple-900/60',
}

// Small swatch colors for the color picker
export const NOTE_COLOR_SWATCH: Record<NoteColor, string> = {
  default: 'bg-zinc-600',
  yellow:  'bg-yellow-500',
  blue:    'bg-blue-500',
  green:   'bg-green-500',
  red:     'bg-red-500',
  purple:  'bg-purple-500',
}

export interface Note {
  id:         string
  created_at: string
  updated_at: string
  title:      string
  content:    string
  color:      NoteColor
  pinned:     boolean
}
