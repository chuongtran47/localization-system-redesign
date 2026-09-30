"use client"

import { useState, type FormEvent } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"

import { pillActive, pillButton, pillIdle } from "@/components/button-styles"
import { Button } from "@/components/ui/button"
import { DialogClose, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCoverage } from "@/hooks/use-coverage"
import { useTranslationRows } from "@/hooks/use-translation-rows"
import { download, exportSheet, messageOf } from "@/lib/api"
import type { SheetFormat, SheetRows } from "@/lib/api-types"
import { languages, SOURCE_LANGUAGE, type LanguageCode } from "@/lib/locale-data"
import { targetOf, type Project } from "@/lib/projects"
import { TODO_STATUSES } from "@/lib/sheet"
import { cn } from "@/lib/utils"

const choices = languages.filter((item) => item.code !== SOURCE_LANGUAGE)

/** One language of one project as a sheet to fill in and import back. */
export function SheetExportForm({
  project,
  language: viewing,
  format,
  onDone,
}: {
  project: Project
  language: LanguageCode
  format: SheetFormat
  onDone: () => void
}) {
  const [language, setLanguage] = useState<LanguageCode>(viewing === SOURCE_LANGUAGE ? choices[0].code : viewing)
  const [scope, setScope] = useState<SheetRows>("todo")
  const [typedName, setTypedName] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const { revision } = useCoverage()
  const { rows, isLoading } = useTranslationRows(targetOf(project), language, revision)

  const todo = rows.filter((row) => TODO_STATUSES.includes(row.status)).length
  const count = scope === "todo" ? todo : rows.length
  const name = typedName ?? `${project.id}.${language}`
  const languageName = choices.find((item) => item.code === language)?.name ?? language
  const shown = (n: number) => (isLoading ? "…" : n.toLocaleString())

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsExporting(true)
    try {
      const { blob, filename } = await exportSheet({
        target: targetOf(project),
        language,
        rows: scope,
        format,
        name: name.replace(/\.(xlsx|csv)$/i, ""),
      })
      download(blob, filename)
      onDone()
      toast.success(`Exported ${filename}`, {
        description: `${count.toLocaleString()} ${count === 1 ? "string" : "strings"} · ${languageName}`,
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
        <Label htmlFor="sheet-language">Language</Label>
        <select
          id="sheet-language"
          value={language}
          onChange={(event) => setLanguage(event.target.value as LanguageCode)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {choices.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Rows</Label>
        <div role="group" aria-label="Rows" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={scope === "todo"}
            onClick={() => setScope("todo")}
            className={cn(pillButton, scope === "todo" ? pillActive : pillIdle)}
          >
            Strings to translate ({shown(todo)})
          </button>
          <button
            type="button"
            aria-pressed={scope === "all"}
            onClick={() => setScope("all")}
            className={cn(pillButton, scope === "all" ? pillActive : pillIdle)}
          >
            All strings ({shown(rows.length)})
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sheet-name">File name</Label>
        <div className="flex items-center gap-2">
          <Input
            id="sheet-name"
            value={name}
            onChange={(event) => setTypedName(event.target.value)}
            className="font-mono"
          />
          <span className="font-mono text-sm text-muted-foreground">.{format}</span>
        </div>
      </div>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" disabled={isExporting || isLoading || count === 0}>
          <Download data-icon="inline-start" />
          {isExporting ? "Exporting…" : "Download"}
        </Button>
      </DialogFooter>
    </form>
  )
}
