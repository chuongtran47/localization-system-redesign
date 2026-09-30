"use client"

import { AlertTriangle, FileJson, FileSpreadsheet, X } from "lucide-react"

import { LanguagePicker } from "@/components/import/language-picker"
import { changeCount, type BundleDiff } from "@/lib/bundle-diff"
import type { StagedFile } from "@/lib/import-plan"
import { languageFlags } from "@/lib/language-flags"
import { languages, type LanguageCode } from "@/lib/locale-data"
import { cn } from "@/lib/utils"

/** One staged file: what it is, which language it claims, what it would cost. */
export function FileRow({
  file,
  diff,
  isSelected,
  isDuplicate,
  onSelect,
  onAssign,
  onRemove,
}: {
  file: StagedFile
  diff: BundleDiff | undefined
  isSelected: boolean
  isDuplicate: boolean
  onSelect: () => void
  onAssign: (language: LanguageCode) => void
  onRemove: () => void
}) {
  const changes = diff ? changeCount(diff.counts) : null

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 px-3 py-2 first:rounded-t-xl last:rounded-b-xl",
        isSelected && "bg-accent/40"
      )}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        {file.kind === "sheet" ? (
          <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <FileJson className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 truncate font-mono text-xs">{file.name}</span>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {file.kind === "sheet"
            ? `Sheet · ${(file.sheet?.rows.length ?? 0).toLocaleString()} rows`
            : `${Object.keys(file.values).length.toLocaleString()} keys`}
        </span>
        {changes !== null && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
              changes > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {changes.toLocaleString()} {changes === 1 ? "change" : "changes"}
          </span>
        )}
        {diff && diff.errors > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="size-3.5" />
            {diff.errors}
          </span>
        )}
      </button>

      {file.kind === "sheet" ? (
        // A sheet names its language in its own header - nothing to pick.
        <span
          aria-invalid={isDuplicate || undefined}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1 text-xs",
            isDuplicate && "border-destructive text-destructive"
          )}
        >
          <span className="leading-none">{file.language ? languageFlags[file.language] : ""}</span>
          {languages.find((item) => item.code === file.language)?.name}
        </span>
      ) : (
        <LanguagePicker value={file.language} invalid={isDuplicate} onChange={onAssign} />
      )}

      <button
        type="button"
        aria-label={`Remove ${file.name}`}
        onClick={onRemove}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
