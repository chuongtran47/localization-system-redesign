"use client"

import { useState } from "react"
import { History, Trash2, Pencil, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/status-badge"
import type { TranslationString, TranslationStatus } from "@/lib/data"

type Edit = { value: string; status: TranslationStatus }

export function TranslationTable({ rows }: { rows: TranslationString[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [edits, setEdits] = useState<Record<string, Edit>>({})

  function startEdit(row: TranslationString) {
    setEditingId(row.id)
    setDraft(edits[row.id]?.value ?? row.value)
  }

  function save(id: string) {
    setEdits((e) => ({
      ...e,
      [id]: { value: draft, status: draft.trim() ? "translated" : "missing" },
    }))
    setEditingId(null)
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
        <p className="text-sm font-medium">No strings found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try a different section, version, or search term.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1.4fr)_8.5rem_auto] items-center gap-4 border-b border-border bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="text-center">#</span>
        <span>Key</span>
        <span>Translation</span>
        <span>Status</span>
        <span className="text-right">Actions</span>
      </div>

      <ul className="divide-y divide-border">
        {rows.map((row, i) => {
          const editing = editingId === row.id
          const value = edits[row.id]?.value ?? row.value
          const status = edits[row.id]?.status ?? row.status
          return (
            <li
              key={row.id}
              className="group grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1.4fr)_8.5rem_auto] items-center gap-4 px-4 py-2.5 transition-colors hover:bg-accent/30"
            >
              <span className="text-center text-xs tabular-nums text-muted-foreground">
                {i + 1}
              </span>

              <div className="min-w-0">
                <code className="block truncate font-mono text-[13px] text-foreground">
                  {row.key}
                </code>
                <span className="block truncate text-xs text-muted-foreground">
                  {row.source}
                </span>
              </div>

              <div className="min-w-0">
                {editing ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") save(row.id)
                      if (e.key === "Escape") setEditingId(null)
                    }}
                    className="h-8 w-full rounded-md border border-ring bg-background px-2.5 text-sm outline-none ring-2 ring-ring/30"
                  />
                ) : (
                  <button
                    onClick={() => startEdit(row)}
                    className={cn(
                      "block w-full truncate rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-muted",
                      value ? "text-foreground" : "italic text-muted-foreground",
                    )}
                  >
                    {value || "Add translation…"}
                  </button>
                )}
              </div>

              <div>
                <StatusBadge status={status} />
              </div>

              <div className="flex items-center justify-end gap-0.5">
                {editing ? (
                  <>
                    <button
                      onClick={() => save(row.id)}
                      className="flex size-7 items-center justify-center rounded-md text-success transition-colors hover:bg-success/10"
                      aria-label="Save"
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
                      aria-label="Cancel"
                    >
                      <X className="size-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      onClick={() => startEdit(row)}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Edit translation"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="View history"
                    >
                      <History className="size-3.5" />
                    </button>
                    <button
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete string"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
