"use client"

import Link from "next/link"
import { AlertTriangle, History } from "lucide-react"

import { outstandingOf } from "@/lib/coverage"
import { formatDate } from "@/lib/format-date"
import { projectPath } from "@/lib/projects"
import { categoryLabel, type TemplateChannel, type TemplateEntry } from "@/lib/template-data"
import { ownerProject } from "@/lib/template-view"
import { cn } from "@/lib/utils"
import { smsInfo } from "@/lib/validation"

const head = "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
const cell = "px-4 py-3 align-top"

/** One row per message, opened for translation by clicking it. */
export function TemplateTable({
  channel,
  entries,
  openId,
  showProgress,
  onOpen,
}: {
  channel: TemplateChannel
  entries: TemplateEntry[]
  openId?: string
  showProgress: boolean
  onOpen: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className={head}>Template</th>
            <th className={cn(head, "w-32")}>Recipient</th>
            <th className={cn(head, "w-48")}>Sent from</th>
            <th className={cn(head, "w-40")}>Created</th>
            <th className={cn(head, "w-40")}>Updated</th>
            {channel === "sms" && <th className={cn(head, "w-28 text-right")}>Segments</th>}
            {showProgress && <th className={cn(head, "w-64")}>Translation</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((entry) => {
            const { template } = entry
            const isOpen = template.id === openId
            const needsWork = showProgress && outstandingOf(entry) > 0
            const owner = ownerProject(template.owner)

            return (
              <tr
                key={template.id}
                onClick={() => onOpen(template.id)}
                className={cn("cursor-pointer transition-colors hover:bg-accent/30", isOpen && "bg-accent/40")}
              >
                <td
                  className={cn(
                    cell,
                    isOpen
                      ? "shadow-[inset_2px_0_0_var(--color-primary)]"
                      : needsWork && "shadow-[inset_2px_0_0_var(--color-warning)]"
                  )}
                >
                  {/* The row opens on click; this is the same action for the keyboard. */}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpen(template.id)
                    }}
                    className="grid gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  >
                    <span className="font-medium">{template.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{template.id}</span>
                  </button>
                </td>
                <td className={cell}>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {categoryLabel[template.category]}
                  </span>
                </td>
                <td className={cell}>
                  {owner.project ? (
                    <Link
                      href={projectPath(owner.project)}
                      onClick={(event) => event.stopPropagation()}
                      className="hover:underline"
                    >
                      {owner.label}
                    </Link>
                  ) : (
                    <span>{owner.label}</span>
                  )}
                </td>
                <td className={cell}>
                  <Stamp by={template.createdBy} at={template.createdAt} />
                </td>
                <td className={cell}>
                  {entry.updated ? (
                    <Stamp by={entry.updated.by} at={entry.updated.at} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                {channel === "sms" && (
                  <td className={cn(cell, "text-right")}>
                    <Segments entry={entry} />
                  </td>
                )}
                {showProgress && (
                  <td className={cell}>
                    <Progress entry={entry} />
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Stamp({ by, at }: { by: string; at: string }) {
  return (
    <div className="grid gap-0.5">
      <span>{by}</span>
      <span className="text-xs text-muted-foreground">{formatDate(at)}</span>
    </div>
  )
}

function Segments({ entry }: { entry: TemplateEntry }) {
  const message = entry.fields.find((field) => field.field === "message")
  if (!message?.target) {
    return <span className="text-muted-foreground">—</span>
  }
  const target = smsInfo(message.target)
  const source = smsInfo(message.source)
  return (
    <span
      className={cn(
        "font-mono text-xs tabular-nums",
        target.segments > source.segments ? "text-warning-foreground dark:text-warning" : "text-muted-foreground"
      )}
    >
      {target.segments}/{source.segments}
    </span>
  )
}

function Progress({ entry }: { entry: TemplateEntry }) {
  const percent = entry.total ? Math.round((entry.translated / entry.total) * 100) : 0
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums">
        {entry.translated}/{entry.total}
      </span>
      {entry.outdated > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-info/12 px-1.5 py-0.5 text-[11px] font-semibold text-info">
          <History className="size-3" />
          {entry.outdated} outdated
        </span>
      )}
      {entry.needsFix > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-warning/15 px-1.5 py-0.5 text-[11px] font-semibold text-warning-foreground dark:text-warning">
          <AlertTriangle className="size-3" />
          {entry.needsFix} to fix
        </span>
      )}
    </div>
  )
}
