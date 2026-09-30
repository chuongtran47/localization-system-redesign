"use client"

import { useMemo, useState, type FormEvent } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"

import { pillActive, pillButton, pillIdle } from "@/components/button-styles"
import { useRole } from "@/components/role-provider"
import { SheetExportForm } from "@/components/translations/sheet-export-form"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { download, exportBundle, messageOf } from "@/lib/api"
import type { ExportFile, SheetFormat } from "@/lib/api-types"
import { applyNamePattern, FILE_NAME_TOKEN, safeEntryName, safeFileName } from "@/lib/file-name"
import { languages, SOURCE_LANGUAGE, type LanguageCode } from "@/lib/locale-data"
import { targetOf, type Project } from "@/lib/projects"
import { cn } from "@/lib/utils"

const DEFAULT_PATTERN = `${FILE_NAME_TOKEN}.json`

type ExportFormat = SheetFormat | "json"

const formatLabel: Record<ExportFormat, string> = { xlsx: "Excel (.xlsx)", csv: "CSV", json: "JSON bundle" }

/**
 * One project out of the app: a JSON bundle of every language for developers,
 * or one language as a sheet to translate. The export is never the current
 * filters.
 */
export function ExportDialog({
  open,
  onOpenChange,
  project,
  language,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  language: LanguageCode
}) {
  const { can } = useRole()
  const formats: ExportFormat[] = can.exchangeBundles ? ["xlsx", "csv", "json"] : ["xlsx", "csv"]
  const initial: ExportFormat = can.exchangeBundles ? "json" : "xlsx"
  const [format, setFormat] = useState<ExportFormat>(initial)
  // Each opening starts over: the forms are keyed by it, and the format returns to the default.
  const [session, setSession] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSession((value) => value + 1)
      setFormat(initial)
    }
  }
  const done = () => onOpenChange(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Export {project.name}</DialogTitle>
          <DialogDescription>
            {format === "json"
              ? "Every key in the project, whatever the filters show."
              : "One language, to translate and import back."}
          </DialogDescription>
        </DialogHeader>

        <div role="group" aria-label="Format" className="flex flex-wrap gap-1.5">
          {formats.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={format === item}
              onClick={() => setFormat(item)}
              className={cn(pillButton, format === item ? pillActive : pillIdle)}
            >
              {formatLabel[item]}
            </button>
          ))}
        </div>

        {format === "json" ? (
          <BundleExportForm key={session} project={project} language={language} onDone={done} />
        ) : (
          <SheetExportForm key={`${session}:${format}`} project={project} language={language} format={format} onDone={done} />
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * One project as a zip of locale files, each named by whoever exports it. The
 * export is always the whole project, never the current filters.
 */
function BundleExportForm({ project, language, onDone }: { project: Project; language: LanguageCode; onDone: () => void }) {
  const defaultArchive = `${project.id}-translations`
  const defaults = () => new Set<LanguageCode>([SOURCE_LANGUAGE, language])

  const [selected, setSelected] = useState<Set<LanguageCode>>(defaults)
  const [pattern, setPattern] = useState(DEFAULT_PATTERN)
  const [renamed, setRenamed] = useState<Partial<Record<LanguageCode, string>>>({})
  const [archive, setArchive] = useState(defaultArchive)
  const [includeUntranslated, setIncludeUntranslated] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  const nameOf = (code: LanguageCode) => renamed[code] ?? applyNamePattern(pattern, code)

  const files: ExportFile[] = useMemo(
    () =>
      languages
        .filter((item) => selected.has(item.code))
        .map((item) => ({
          language: item.code,
          name: safeEntryName(renamed[item.code] ?? applyNamePattern(pattern, item.code), `${item.code}.json`),
        })),
    [selected, renamed, pattern]
  )

  const duplicate = useMemo(() => {
    const seen = new Set<string>()
    for (const file of files) {
      const name = file.name.toLowerCase()
      if (seen.has(name)) {
        return file.name
      }
      seen.add(name)
    }
    return null
  }, [files])

  const archiveName = safeFileName(archive, defaultArchive)

  const toggle = (code: LanguageCode, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(code)
      } else {
        next.delete(code)
      }
      return next
    })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (files.length === 0 || duplicate) {
      return
    }
    setIsExporting(true)
    try {
      const { blob, filename } = await exportBundle({
        target: targetOf(project),
        files,
        name: archiveName,
        includeUntranslated,
      })
      download(blob, filename)
      onDone()
      toast.success(`Exported ${filename}`, {
        description: `${files.length} ${files.length === 1 ? "file" : "files"} from ${project.name}.`,
      })
    } catch (cause: unknown) {
      toast.error("Could not export", { description: messageOf(cause) })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="contents">

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="export-pattern">File names</Label>
        <Input
          id="export-pattern"
          value={pattern}
          onChange={(event) => setPattern(event.target.value)}
          placeholder={DEFAULT_PATTERN}
          className="font-mono"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Label>Languages</Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {selected.size} of {languages.length}
          </span>
          <div className="ml-auto flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set(languages.map((item) => item.code)))}
            >
              All
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              None
            </Button>
          </div>
        </div>

        <ul className="max-h-64 divide-y divide-border overflow-auto rounded-xl border border-border">
          {languages.map((item) => {
            const isOn = selected.has(item.code)
            return (
              <li key={item.code} className="flex items-center gap-3 px-3 py-1.5">
                <Label className="flex w-44 shrink-0 items-center gap-2 font-normal">
                  <Checkbox checked={isOn} onCheckedChange={(checked) => toggle(item.code, checked === true)} />
                  <span className="truncate text-sm">{item.name}</span>
                </Label>
                <Input
                  value={nameOf(item.code)}
                  onChange={(event) => setRenamed((current) => ({ ...current, [item.code]: event.target.value }))}
                  disabled={!isOn}
                  aria-label={`File name for ${item.name}`}
                  className="h-7 font-mono text-xs"
                />
              </li>
            )
          })}
        </ul>

        {duplicate && (
          <p className="text-xs text-destructive">
            Two languages are both called <code className="font-mono">{duplicate}</code>. One would overwrite the
            other in the archive.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="export-archive">Archive name</Label>
        <div className="flex items-center gap-2">
          <Input
            id="export-archive"
            value={archive}
            onChange={(event) => setArchive(event.target.value)}
            placeholder={defaultArchive}
            className="font-mono"
          />
          <span className="font-mono text-sm text-muted-foreground">.zip</span>
        </div>
        {archiveName !== archive.replace(/\.zip$/i, "") && (
          <p className="text-xs text-muted-foreground">
            Saved as <code className="font-mono">{archiveName}.zip</code>
          </p>
        )}
      </div>

      <Label className="flex items-center gap-2 font-normal">
        <Checkbox
          checked={includeUntranslated}
          onCheckedChange={(checked) => setIncludeUntranslated(checked === true)}
        />
        <span className="text-sm">Include untranslated keys</span>
      </Label>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" disabled={isExporting || files.length === 0 || Boolean(duplicate)}>
          <Download data-icon="inline-start" />
          {isExporting ? "Exporting…" : "Export"}
        </Button>
      </DialogFooter>
    </form>
  )
}
