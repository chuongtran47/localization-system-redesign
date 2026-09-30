"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"

import { changeCount, type BundleDiff, type DiffEntry, type DiffKind } from "@/lib/bundle-diff"
import {
  flattenGroups,
  groupsOf,
  numberEntries,
  pinnedHeader,
  type DiffFilter,
  type GroupDiff,
  type LineNumbers,
} from "@/lib/diff-groups"
import { cn } from "@/lib/utils"

const filters: { id: DiffFilter; label: string }[] = [
  { id: "changes", label: "Changes" },
  { id: "new", label: "New" },
  { id: "added", label: "Added" },
  { id: "changed", label: "Changed" },
  { id: "removed", label: "Removed" },
  { id: "unchanged", label: "Unchanged" },
]

const kindLabel: Record<DiffKind, string> = {
  new: "New key",
  added: "Added",
  changed: "Changed",
  removed: "Removed",
  unchanged: "Unchanged",
}

const kindTone: Record<DiffKind, string> = {
  new: "border-primary/30 bg-primary/10 text-primary",
  added: "border-success/20 bg-success/12 text-success",
  changed: "border-warning/30 bg-warning/15 text-warning-foreground dark:text-warning",
  removed: "border-destructive/20 bg-destructive/10 text-destructive",
  unchanged: "border-border text-muted-foreground",
}

/**
 * What the import would do, laid out the way a pull request lays out its files:
 * a key group is the file, each key a hunk, `-` today and `+` after.
 */
export function BundleDiffView({
  diff,
  languageName,
  isRtl = false,
}: {
  diff: BundleDiff
  languageName: string
  isRtl?: boolean
}) {
  const [filter, setFilter] = useState<DiffFilter>("changes")
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set<string>())

  const totals = useMemo(() => ({ ...diff.counts, changes: changeCount(diff.counts) }), [diff.counts])
  const numbers = useMemo(() => numberEntries(diff.entries), [diff.entries])
  const groups = useMemo(() => groupsOf(diff.entries, filter), [diff.entries, filter])
  const stat = useMemo(
    () =>
      groups.reduce(
        (sum, group) => ({
          additions: sum.additions + group.additions,
          deletions: sum.deletions + group.deletions,
          keys: sum.keys + group.entries.length,
        }),
        { additions: 0, deletions: 0, keys: 0 }
      ),
    [groups]
  )
  const rows = useMemo(() => flattenGroups(groups, collapsed), [groups, collapsed])

  const toggle = (name: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (!next.delete(name)) {
        next.add(name)
      }
      return next
    })

  const allCollapsed = groups.length > 0 && collapsed.size >= groups.length
  const toggleAll = () => setCollapsed(allCollapsed ? new Set<string>() : new Set(groups.map((group) => group.name)))

  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    // Keyed by row, so a measured hunk keeps its height when a group above collapses.
    getItemKey: useCallback(
      (index: number) => {
        const row = rows[index]
        return row.type === "header" ? `@${row.group.name}` : row.entry.key
      },
      [rows]
    ),
    estimateSize: useCallback((index: number) => (rows[index]?.type === "header" ? 41 : 104), [rows]),
    overscan: 6,
  })

  const items = virtualizer.getVirtualItems()
  const pinned = pinnedHeader(rows, items, virtualizer.scrollOffset ?? 0)

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={totals[item.id] === 0}
            onClick={() => setFilter(item.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
              filter === item.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            )}
          >
            {item.label}
            <span className="tabular-nums opacity-80">{totals[item.id].toLocaleString()}</span>
          </button>
        ))}
        {diff.errors > 0 && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="size-3.5 shrink-0" />
            {diff.errors} would fail a check
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
          <span className="text-xs font-medium tabular-nums">
            {count(groups.length, "group")}
            <span className="text-muted-foreground"> · {count(stat.keys, "key")}</span>
          </span>
          <DiffStat additions={stat.additions} deletions={stat.deletions} />
          {groups.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="ml-auto rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {allCollapsed ? "Expand all" : "Collapse all"}
            </button>
          )}
        </div>

        <div className="relative">
          {/* Drawn over the list rather than `sticky`: the virtualizer's rows are
              absolutely positioned, which sticky cannot see past. */}
          {pinned && (
            <div className="absolute inset-x-0 top-0 z-10 shadow-sm">
              <GroupHeader group={pinned} isCollapsed={collapsed.has(pinned.name)} onToggle={() => toggle(pinned.name)} />
            </div>
          )}

          <div ref={scrollRef} className="h-[min(46vh,24rem)] overflow-auto overscroll-contain">
            {rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{emptyMessage(filter, languageName)}</p>
            ) : (
              <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
                {items.map((item) => {
                  const row = rows[item.index]
                  return (
                    <div
                      key={item.key}
                      ref={virtualizer.measureElement}
                      data-index={item.index}
                      className="absolute left-0 top-0 w-full"
                      style={{ transform: `translateY(${item.start}px)` }}
                    >
                      {row.type === "header" ? (
                        <GroupHeader
                          group={row.group}
                          isCollapsed={collapsed.has(row.group.name)}
                          onToggle={() => toggle(row.group.name)}
                        />
                      ) : (
                        <Hunk entry={row.entry} numbers={numbers.get(row.entry.key)} isRtl={isRtl} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function GroupHeader({
  group,
  isCollapsed,
  onToggle,
}: {
  group: GroupDiff
  isCollapsed: boolean
  onToggle: () => void
}) {
  const Chevron = isCollapsed ? ChevronRight : ChevronDown
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!isCollapsed}
      className="flex w-full items-center gap-2 border-b border-border bg-muted/60 px-3 py-2 text-left backdrop-blur-sm transition-colors hover:bg-muted"
    >
      <Chevron className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium">{group.name}</span>
      {group.errors > 0 && <AlertTriangle className="size-3.5 shrink-0 text-destructive" />}
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{count(group.entries.length, "key")}</span>
      <DiffStat additions={group.additions} deletions={group.deletions} />
    </button>
  )
}

function Hunk({ entry, numbers, isRtl }: { entry: DiffEntry; numbers: LineNumbers | undefined; isRtl: boolean }) {
  const before = numbers?.before ?? null
  const after = numbers?.after ?? null

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 bg-accent/50 px-3 py-1 text-muted-foreground">
        <span className="shrink-0 font-mono text-[11px]">@@ {entry.key} @@</span>
        <span className="min-w-0 flex-1 truncate text-xs italic">{entry.source}</span>
        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium", kindTone[entry.kind])}>
          {kindLabel[entry.kind]}
        </span>
        {entry.keep && (
          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Keep English
          </span>
        )}
      </div>

      {entry.kind === "unchanged" ? (
        <Line sign=" " before={before} after={after} text={entry.after} isRtl={isRtl} />
      ) : (
        <>
          {entry.before !== "" && <Line sign="-" before={before} after={null} text={entry.before} isRtl={isRtl} />}
          {entry.after !== "" && <Line sign="+" before={null} after={after} text={entry.after} isRtl={isRtl} />}
        </>
      )}

      {entry.issues.map((issue) => (
        <p
          key={issue.id}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 text-xs",
            issue.level === "error" ? "text-destructive" : "text-muted-foreground"
          )}
        >
          <AlertTriangle className="size-3.5 shrink-0" />
          {issue.message}
        </p>
      ))}
    </div>
  )
}

function Line({
  sign,
  before,
  after,
  text,
  isRtl,
}: {
  sign: "-" | "+" | " "
  before: number | null
  after: number | null
  text: string
  isRtl: boolean
}) {
  const tone = sign === "-" ? "removed" : sign === "+" ? "added" : "none"
  return (
    <div
      className={cn(
        "flex text-sm",
        tone === "removed" && "bg-destructive/10 text-destructive",
        tone === "added" && "bg-success/12 text-success",
        tone === "none" && "text-muted-foreground"
      )}
    >
      <Gutter value={before} />
      <Gutter value={after} />
      <span aria-hidden className="w-4 shrink-0 select-none py-1 pl-2 font-mono">
        {sign.trim()}
      </span>
      <span dir={isRtl ? "rtl" : undefined} className="min-w-0 flex-1 whitespace-pre-wrap wrap-break-word py-1 pr-3">
        {text}
      </span>
    </div>
  )
}

function Gutter({ value }: { value: number | null }) {
  return (
    <span
      aria-hidden
      className="w-9 shrink-0 select-none border-r border-border px-2 py-1 text-right font-mono text-[11px] tabular-nums text-muted-foreground"
    >
      {value ?? ""}
    </span>
  )
}

const BLOCKS = 5

function DiffStat({ additions, deletions }: { additions: number; deletions: number }) {
  const total = additions + deletions
  const green = total === 0 ? 0 : blocksOf(additions, total)
  const red = total === 0 ? 0 : Math.min(BLOCKS - green, blocksOf(deletions, total))
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums">
      <span className="text-success">+{additions}</span>
      <span className="text-destructive">−{deletions}</span>
      <span className="flex gap-px">
        {Array.from({ length: BLOCKS }, (_, index) => (
          <span
            key={index}
            className={cn(
              "size-2 rounded-[1px]",
              index < green ? "bg-success" : index < green + red ? "bg-destructive" : "bg-muted-foreground/25"
            )}
          />
        ))}
      </span>
    </span>
  )
}

/** A side that changed anything is owed a square, however small its share. */
function blocksOf(part: number, total: number) {
  return part === 0 ? 0 : Math.max(1, Math.round((part / total) * BLOCKS))
}

function count(value: number, noun: string) {
  return `${value.toLocaleString()} ${noun}${value === 1 ? "" : "s"}`
}

function emptyMessage(filter: DiffFilter, languageName: string) {
  if (filter === "changes") {
    return `This file changes nothing in ${languageName}.`
  }
  if (filter === "new") {
    return "Every key in this file is already in the project."
  }
  return `No ${kindLabel[filter].toLowerCase()} keys.`
}
