"use client"

import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

import { ROW_GRID } from "@/components/translation-row"
import { Checkbox } from "@/components/ui/checkbox"
import type { TranslationRow } from "@/lib/locale-data"
import { cn } from "@/lib/utils"

/**
 * The key list, virtualized against the page's own scroller (`<main>`), so the
 * page still scrolls as one piece the way the rest of the workspace does.
 */
export function TranslationList({
  rows,
  languageName,
  allSelected,
  someSelected,
  onSelectAll,
  renderRow,
}: {
  rows: TranslationRow[]
  languageName: string
  allSelected: boolean
  someSelected: boolean
  onSelectAll: (selected: boolean) => void
  renderRow: (row: TranslationRow) => ReactNode
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    setScrollElement(listRef.current?.closest("main") ?? null)
  }, [])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => 72,
    overscan: 8,
    scrollMargin: listRef.current?.offsetTop ?? 0,
    getItemKey: (index) => rows[index].key,
  })

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
        <p className="text-sm font-medium">No strings found</p>
        <p className="mt-1 text-sm text-muted-foreground">Try a different status, group, version, or search term.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div
        className={cn(
          ROW_GRID,
          "items-center border-b border-l-2 border-border border-l-transparent bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
        )}
      >
        <span className="flex justify-center">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            aria-label={`Select all ${rows.length} keys in view`}
            onCheckedChange={(checked) => onSelectAll(checked === true)}
          />
        </span>
        <span>Key</span>
        <span>{languageName}</span>
        <span>Status</span>
        <span className="text-right">Actions</span>
      </div>

      <div ref={listRef} className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            ref={virtualizer.measureElement}
            data-index={item.index}
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)` }}
          >
            {renderRow(rows[item.index])}
          </div>
        ))}
      </div>
    </div>
  )
}
