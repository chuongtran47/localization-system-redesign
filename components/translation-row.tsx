"use client"

import { AlertTriangle, ClipboardPaste, Copy, History, Info, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/status-badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { copyText } from "@/lib/clipboard"
import { formatDateTime } from "@/lib/format-date"
import { SOURCE_LANGUAGE, type LanguageCode, type TranslationRow as Row } from "@/lib/locale-data"
import type { ProjectProfile } from "@/lib/projects"
import { cn } from "@/lib/utils"
import { checkTranslation } from "@/lib/validation"

/** Above this, the English is a sentence and gets a growing textarea. */
const SHORT_SOURCE = 60

/** Shared by the list header and every row so the columns line up. */
export const ROW_GRID =
  "grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1.4fr)_8.5rem_7.5rem] gap-4"

const iconButton =
  "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"

const textButton =
  "rounded-md px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-accent/50"

export type TranslationRowProps = {
  row: Row
  value: string
  isDirty: boolean
  isKeepPending: boolean
  isSelected: boolean
  language: LanguageCode
  profile: ProjectProfile
  rtl: boolean
  onChange: (key: string, value: string) => void
  onKeep: (key: string) => void
  onConfirm: (key: string) => void
  onSelect: (key: string, selected: boolean) => void
  onDelete: (key: string) => void
}

export function TranslationRow({
  row,
  value,
  isDirty,
  isKeepPending,
  isSelected,
  language,
  profile,
  rtl,
  onChange,
  onKeep,
  onConfirm,
  onSelect,
  onDelete,
}: TranslationRowProps) {
  const issues = checkTranslation(row.source, value, {
    language,
    lengthBudget: profile.lengthBudget,
    maxLength: profile.maxLength,
  })
  const hasError = issues.some((issue) => issue.level === "error")
  const hasWarning = !hasError && issues.length > 0
  const isKept = isKeepPending || (row.keptSource && value === row.source)
  // A kept value that went outdated is kept again rather than confirmed:
  // confirming would save the old English as if it were a translation.
  const isStaleKeep = row.status === "outdated" && row.keptSource
  const canKeep =
    (row.status === "missing" || isStaleKeep) &&
    !isKeepPending &&
    row.source !== "" &&
    language !== SOURCE_LANGUAGE
  const showOutdated = row.status === "outdated" && !isDirty

  const handleCopy = async () => {
    if (await copyText(row.source)) {
      toast.success("English copied to the clipboard")
    } else {
      toast.error("Could not copy", { description: "The browser blocked clipboard access for this page." })
    }
  }

  const field = {
    value,
    dir: rtl ? ("rtl" as const) : undefined,
    placeholder: row.source || "Add translation…",
    "aria-label": `Translation for ${row.key}`,
    onChange: (event: { target: { value: string } }) => onChange(row.key, event.target.value),
  }

  return (
    <div
      className={cn(
        ROW_GRID,
        "group items-start border-b border-l-2 border-border border-l-transparent px-4 py-2.5 transition-colors",
        !isDirty && !isSelected && "hover:bg-accent/30",
        isSelected && "bg-destructive/5",
        hasWarning && "border-l-warning",
        isDirty && "border-l-primary bg-accent/30",
        hasError && "border-l-destructive"
      )}
    >
      <div className="flex h-8 items-center justify-center">
        <Checkbox
          checked={isSelected}
          aria-label={`Select ${row.key}`}
          onCheckedChange={(checked) => onSelect(row.key, checked === true)}
        />
      </div>

      <div className="min-w-0 pt-1">
        <div className="flex items-center gap-1.5">
          <code className="block truncate font-mono text-[13px] text-foreground">{row.key}</code>
          {row.origin === "manual" && (
            <span className="shrink-0 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-foreground">
              New
            </span>
          )}
        </div>
        <span className="block text-xs text-muted-foreground">
          {row.source || <em>No English yet</em>}
        </span>
      </div>

      <div className="min-w-0 space-y-1.5">
        {row.source.length <= SHORT_SOURCE ? (
          <Input {...field} className="h-8" />
        ) : (
          <Textarea {...field} className="min-h-16 resize-y" />
        )}

        {(canKeep || showOutdated) && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {showOutdated && (
              <span className="flex items-center gap-1.5 text-info">
                <History className="size-3.5 shrink-0" />
                English changed since this was translated.
              </span>
            )}
            {showOutdated && !isStaleKeep && (
              <button type="button" className={textButton} onClick={() => onConfirm(row.key)}>
                Still correct
              </button>
            )}
            {canKeep && (
              <button type="button" className={textButton} onClick={() => onKeep(row.key)}>
                Keep English
              </button>
            )}
          </div>
        )}

        {issues.map((issue) => (
          <p
            key={issue.id}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              issue.level === "error" ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {issue.level === "error" ? (
              <AlertTriangle className="size-3.5 shrink-0" />
            ) : (
              <Info className="size-3.5 shrink-0" />
            )}
            {issue.message}
          </p>
        ))}
      </div>

      <div className="flex flex-col items-start gap-1 pt-1">
        <StatusBadge status={row.status} />
        {isKept && <span className="text-[11px] text-muted-foreground">Kept as English</span>}
      </div>

      <div className="flex items-center justify-end gap-0.5 pt-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button type="button" className={iconButton} aria-label={`Copy the English for ${row.key}`} onClick={handleCopy}>
          <Copy className="size-3.5" />
        </button>
        <button
          type="button"
          className={iconButton}
          aria-label={`Paste the English into ${row.key}`}
          onClick={() => onChange(row.key, row.source)}
        >
          <ClipboardPaste className="size-3.5" />
        </button>
        <Tooltip>
          <TooltipTrigger render={<button type="button" className={iconButton} aria-label="View history" />}>
            <History className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent className="grid gap-0.5 tabular-nums">
            <span>
              Created by {row.created.by} · {formatDateTime(row.created.at)}
            </span>
            <span>
              {row.updated
                ? `Updated by ${row.updated.by} · ${formatDateTime(row.updated.at)}`
                : "Not translated yet"}
            </span>
          </TooltipContent>
        </Tooltip>
        <button
          type="button"
          className={cn(iconButton, "hover:bg-destructive/10 hover:text-destructive")}
          aria-label={`Delete ${row.key}`}
          onClick={() => onDelete(row.key)}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
