'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Note, NoteColor, NOTE_COLORS, NOTE_COLOR_CLASSES, NOTE_COLOR_SWATCH } from '@/types/note'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function NotesBoard() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })

    if (error) setError(error.message)
    else setNotes((data ?? []) as Note[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  const addNote = useCallback(async () => {
    const { data, error } = await supabase
      .from('notes')
      .insert({ title: '', content: '', color: 'default', pinned: false })
      .select()
      .single()

    if (!error && data) setNotes(prev => [data as Note, ...prev])
  }, [])

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n))
    const { data } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (data) setNotes(prev => prev.map(n => n.id === id ? { ...n, ...(data as Note) } : n))
  }, [])

  const deleteNote = useCallback(async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id))
    await supabase.from('notes').delete().eq('id', id)
  }, [])

  const q = searchQuery.trim() ? norm(searchQuery) : ''
  const filtered = q
    ? notes.filter(n => norm(n.title).includes(q) || norm(n.content).includes(q))
    : notes

  // keep pinned first even after client-side filtering
  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.updated_at.localeCompare(a.updated_at)
  })

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100">
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-[#0f0f0f]/80 backdrop-blur border-b border-zinc-800 px-5 py-3.5 flex items-center gap-3">
        <Link href="/" title="Zpět na leady" className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-sm font-semibold tracking-tight text-zinc-100 shrink-0">Poznámky</h1>

        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Hledat…"
              className="bg-zinc-900 border border-zinc-800 rounded pl-8 pr-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600 w-44 placeholder:text-zinc-600"
            />
          </div>

          <button
            onClick={addNote}
            className="flex items-center gap-1.5 bg-zinc-100 hover:bg-white text-zinc-900 rounded px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nová poznámka
          </button>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto">
        {loading && <div className="text-center text-zinc-600 py-20 text-sm">Načítám…</div>}

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded px-4 py-3 text-sm">
            Chyba: {error}
          </div>
        )}

        {!loading && !error && sorted.length === 0 && (
          <div className="text-center text-zinc-600 py-24 text-sm">
            {q ? 'Žádné poznámky neodpovídají hledání.' : 'Zatím žádné poznámky. Vytvořte první.'}
          </div>
        )}

        {!loading && !error && sorted.length > 0 && (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
            {sorted.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                onUpdate={updateNote}
                onDelete={deleteNote}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function NoteCard({
  note,
  onUpdate,
  onDelete,
}: {
  note: Note
  onUpdate: (id: string, updates: Partial<Note>) => void
  onDelete: (id: string) => void
}) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [showColors, setShowColors] = useState(false)

  // keep local state in sync if the note is replaced by the server response
  useEffect(() => { setTitle(note.title) }, [note.title])
  useEffect(() => { setContent(note.content) }, [note.content])

  const commitTitle = () => { if (title !== note.title) onUpdate(note.id, { title }) }
  const commitContent = () => { if (content !== note.content) onUpdate(note.id, { content }) }

  const handleDelete = () => {
    if (title.trim() || content.trim()) {
      if (!window.confirm('Smazat tuto poznámku? Tato akce je nevratná.')) return
    }
    onDelete(note.id)
  }

  return (
    <div className={`group relative flex flex-col rounded-lg border ${NOTE_COLOR_CLASSES[note.color]} p-3 transition-colors`}>
      {note.pinned && (
        <span className="absolute -top-1.5 -left-1.5 text-amber-400" title="Připnuto">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 3l5 5-4 1-3 3 1 5-3-2-3 3-1-1 3-3-2-3 5-1 3-3z" />
          </svg>
        </span>
      )}

      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        onBlur={commitTitle}
        placeholder="Nadpis"
        className="bg-transparent text-sm font-semibold text-zinc-100 focus:outline-none placeholder:text-zinc-600 mb-1.5"
      />

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        onBlur={commitContent}
        placeholder="Napište poznámku…"
        rows={5}
        className="bg-transparent text-xs leading-relaxed text-zinc-300 focus:outline-none placeholder:text-zinc-600 resize-y min-h-[80px] flex-1"
      />

      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-zinc-800/60">
        <span className="text-[10px] text-zinc-600 mr-auto">
          {new Date(note.updated_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: '2-digit' })}
        </span>

        {/* Color picker */}
        <div className="relative">
          <button
            onClick={() => setShowColors(v => !v)}
            title="Barva"
            className={`w-3.5 h-3.5 rounded-full ${NOTE_COLOR_SWATCH[note.color]} ring-1 ring-zinc-700 hover:ring-zinc-400 transition-all`}
          />
          {showColors && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowColors(false)} />
              <div className="absolute bottom-6 right-0 z-20 flex gap-1.5 bg-zinc-800 border border-zinc-700 rounded-lg p-1.5 shadow-xl">
                {NOTE_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => { onUpdate(note.id, { color: c as NoteColor }); setShowColors(false) }}
                    className={`w-4 h-4 rounded-full ${NOTE_COLOR_SWATCH[c]} ring-1 transition-all ${note.color === c ? 'ring-zinc-100' : 'ring-zinc-600 hover:ring-zinc-300'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => onUpdate(note.id, { pinned: !note.pinned })}
          title={note.pinned ? 'Odepnout' : 'Připnout'}
          className={`p-1 rounded transition-colors ${note.pinned ? 'text-amber-400' : 'text-zinc-600 hover:text-zinc-300'}`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={note.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 3l5 5-4 1-3 3 1 5-3-2-3 3-1-1 3-3-2-3 5-1 3-3z" />
          </svg>
        </button>

        <button
          onClick={handleDelete}
          title="Smazat"
          className="p-1 rounded text-zinc-600 hover:text-red-400 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
