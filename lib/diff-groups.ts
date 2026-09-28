import { CHANGED_KINDS, type DiffEntry, type DiffKind } from "@/lib/bundle-diff"

/** `changes` is every kind that would be written - the view worth reading. */
export type DiffFilter = DiffKind | "changes"

/** Where a key sits in its group, counted the way `git` counts lines. */
export type LineNumbers = {
  before: number | null
  after: number | null
}

/** One group, read as the file it stands in for. */
export type GroupDiff = {
  name: string
  entries: DiffEntry[]
  additions: number
  deletions: number
  errors: number
}

/** A row of the virtualized list: a group's header, or one key inside it. */
export type DiffRow = { type: "header"; group: GroupDiff } | { type: "hunk"; entry: DiffEntry }

/** A side with no text has no number, so an addition has an empty left gutter. */
export function numberEntries(entries: DiffEntry[]): Map<string, LineNumbers> {
  const counters = new Map<string, { before: number; after: number }>()
  const numbers = new Map<string, LineNumbers>()

  for (const entry of entries) {
    let counter = counters.get(entry.group)
    if (!counter) {
      counter = { before: 0, after: 0 }
      counters.set(entry.group, counter)
    }
    if (entry.before !== "") {
      counter.before += 1
    }
    if (entry.after !== "") {
      counter.after += 1
    }
    numbers.set(entry.key, {
      before: entry.before === "" ? null : counter.before,
      after: entry.after === "" ? null : counter.after,
    })
  }

  return numbers
}

/** A changed key costs one addition and one deletion, an unchanged key neither. */
export function groupsOf(entries: DiffEntry[], filter: DiffFilter): GroupDiff[] {
  const byGroup = new Map<string, GroupDiff>()

  for (const entry of entries) {
    const keep = filter === "changes" ? CHANGED_KINDS.includes(entry.kind) : entry.kind === filter
    if (!keep) {
      continue
    }

    let group = byGroup.get(entry.group)
    if (!group) {
      group = { name: entry.group, entries: [], additions: 0, deletions: 0, errors: 0 }
      byGroup.set(entry.group, group)
    }

    group.entries.push(entry)

    if (entry.kind !== "unchanged") {
      if (entry.before !== "") {
        group.deletions += 1
      }
      if (entry.after !== "") {
        group.additions += 1
      }
    }

    if (entry.issues.some((issue) => issue.level === "error")) {
      group.errors += 1
    }
  }

  return [...byGroup.values()]
}

export function flattenGroups(groups: GroupDiff[], collapsed: ReadonlySet<string>): DiffRow[] {
  const rows: DiffRow[] = []
  for (const group of groups) {
    rows.push({ type: "header", group })
    if (collapsed.has(group.name)) {
      continue
    }
    for (const entry of group.entries) {
      rows.push({ type: "hunk", entry })
    }
  }
  return rows
}

/**
 * The nearest header at or above the top edge, once it has scrolled under it.
 * Walks back from the first rendered row, because a group taller than the pane
 * has its header far outside the rendered window.
 */
export function pinnedHeader(
  rows: DiffRow[],
  items: { index: number; start: number }[],
  offset: number
): GroupDiff | null {
  const first = items[0]
  if (!first || offset <= 0) {
    return null
  }

  let index = Math.min(first.index, rows.length - 1)
  while (index >= 0 && rows[index]?.type !== "header") {
    index -= 1
  }

  const row = index >= 0 ? rows[index] : undefined
  if (!row || row.type !== "header") {
    return null
  }

  if (index === first.index && first.start >= offset) {
    return null
  }

  return row.group
}
