"use client"

import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, ArrowLeft, FileUp, RotateCw, Upload } from "lucide-react"
import { toast } from "sonner"

import { outlineButton, primaryButton } from "@/components/button-styles"
import { useDrafts } from "@/components/draft-provider"
import { BundleDiffView } from "@/components/import/bundle-diff-view"
import { FileRow } from "@/components/import/file-row"
import { ImportResults, type ImportOutcome, type ImportResult } from "@/components/import/import-results"
import { ProjectPicker } from "@/components/import/project-picker"
import { useRole } from "@/components/role-provider"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useCoverage } from "@/hooks/use-coverage"
import { useTargetBundles } from "@/hooks/use-target-bundles"
import { deleteKeys, importBundle, messageOf, saveTranslations } from "@/lib/api"
import type { ImportMode } from "@/lib/api-types"
import { BundleFileError, changeCount, diffBundle, parseBundleFile, type BundleDiff } from "@/lib/bundle-diff"
import { clearTarget, pendingInTarget } from "@/lib/drafts"
import {
  afterImport,
  blockerOf,
  duplicatedLanguages,
  importOrder,
  languageFromName,
  retiredKeys,
  type StagedFile,
} from "@/lib/import-plan"
import { languages, type LanguageCode } from "@/lib/locale-data"
import { findProjectByTarget, projectPath, targetOf, type Project } from "@/lib/projects"
import {
  checkRulesOf,
  diffSheet,
  isSheetFileName,
  planSheet,
  readSheetFile,
  SheetFileError,
  skippedSummary,
  type SheetPlan,
} from "@/lib/sheet"
import type { Bytes } from "@/lib/zip"
import { cn } from "@/lib/utils"

/**
 * Route `/import?target=` - one delivery of language files into one project.
 * All four steps stay on one page so the reviewer reading the diff can still
 * see which project they picked. Nothing is written until Confirm.
 */
export function ImportWizard() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const project = findProjectByTarget(params.get("target") ?? "")
  const target = project ? targetOf(project) : null

  const [files, setFiles] = useState<StagedFile[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<ImportMode>("merge")
  const [isDragging, setIsDragging] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Ids only need to be unique on this page; `crypto.randomUUID` is missing outside a secure context.
  const fileSeq = useRef(0)

  const { revision, refresh } = useCoverage()
  const { drafts, update } = useDrafts()
  const { can } = useRole()

  // A file dropped anywhere but the zone would make the browser open it and
  // leave the page, taking the staged batch with it.
  useEffect(() => {
    const guard = (event: globalThis.DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) {
        event.preventDefault()
      }
    }
    window.addEventListener("dragover", guard)
    window.addEventListener("drop", guard)
    return () => {
      window.removeEventListener("dragover", guard)
      window.removeEventListener("drop", guard)
    }
  }, [])

  const codes = useMemo(
    () => [...new Set(files.map((file) => file.language).filter((code): code is LanguageCode => code !== null))],
    [files]
  )
  const bundles = useTargetBundles(target, codes, revision)

  const hasSheets = files.some((file) => file.kind === "sheet")
  const hasBundles = files.some((file) => file.kind === "bundle")
  // A sheet only ever fills in translations, and a view without bundles never replaces.
  const effectiveMode: ImportMode = hasSheets || !can.exchangeBundles ? "merge" : mode

  const plans = useMemo(() => {
    const out = new Map<string, SheetPlan>()
    for (const file of files) {
      const rows = file.language ? bundles.rows.get(file.language) : undefined
      if (file.kind === "sheet" && file.sheet && rows) {
        out.set(file.id, planSheet(file.sheet, rows))
      }
    }
    return out
  }, [files, bundles.rows])

  const diffs = useMemo(() => {
    const out = new Map<string, BundleDiff>()
    if (!project) {
      return out
    }
    for (const file of files) {
      const rows = file.language ? bundles.rows.get(file.language) : undefined
      if (!file.language || !rows) {
        continue
      }
      const plan = plans.get(file.id)
      out.set(
        file.id,
        file.kind === "sheet" && plan
          ? diffSheet(rows, plan, { language: file.language, rulesOf: (key) => checkRulesOf(project, key) })
          : diffBundle(rows, file.values, {
              mode: effectiveMode,
              language: file.language,
              lengthBudget: project.profile.lengthBudget,
              maxLength: project.profile.maxLength,
            })
      )
    }
    return out
  }, [files, bundles.rows, effectiveMode, project, plans])

  const totalChanges = [...diffs.values()].reduce((sum, diff) => sum + changeCount(diff.counts), 0)
  const duplicated = useMemo(() => duplicatedLanguages(files), [files])
  const retired = useMemo(() => retiredKeys(effectiveMode, [...bundles.rows.values()][0], files), [effectiveMode, bundles.rows, files])
  const unassigned = files.filter((file) => file.language === null).length
  const selected = files.find((file) => file.id === selectedId) ?? files[0] ?? null
  const draftCount = target ? pendingInTarget(drafts, target) : 0

  const blocker = blockerOf({
    hasTarget: target !== null,
    fileCount: files.length,
    mixed: hasSheets && hasBundles,
    unassigned,
    duplicated: duplicated.size,
    isLoading: bundles.isLoading,
    error: bundles.error,
    totalChanges,
  })

  // Any change to the batch makes the last result stale and Confirm usable again.
  const editFiles = (change: (current: StagedFile[]) => StagedFile[]) => {
    setFiles(change)
    setOutcome(null)
  }

  const setTarget = (next: Project) => {
    const search = new URLSearchParams(params.toString())
    search.set("target", targetOf(next))
    router.replace(`${pathname}?${search}`, { scroll: false })
    setOutcome(null)
  }

  const readFiles = async (list: FileList | File[]) => {
    const added: StagedFile[] = []
    const failed: string[] = []

    for (const file of Array.from(list)) {
      try {
        if (isSheetFileName(file.name)) {
          const sheet = await readSheetFile({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) as Bytes })
          added.push({
            id: `file-${(fileSeq.current += 1)}`,
            kind: "sheet",
            name: file.name,
            values: {},
            sheet,
            language: sheet.language,
          })
        } else if (!can.exchangeBundles) {
          failed.push(`${file.name} - JSON bundles are imported in the developer view`)
        } else {
          added.push({
            id: `file-${(fileSeq.current += 1)}`,
            kind: "bundle",
            name: file.name,
            values: parseBundleFile(await file.text()),
            language: languageFromName(file.name),
          })
        }
      } catch (cause: unknown) {
        failed.push(
          `${file.name} - ${cause instanceof BundleFileError || cause instanceof SheetFileError ? cause.message : messageOf(cause)}`
        )
      }
    }

    if (added.length > 0) {
      editFiles((current) => [...current, ...added])
      setSelectedId((current) => current ?? added[0].id)
    }
    if (failed.length > 0) {
      toast.error(`${failed.length} ${failed.length === 1 ? "file" : "files"} could not be read`, {
        description: failed.join("\n"),
      })
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (event.dataTransfer.files.length > 0) {
      void readFiles(event.dataTransfer.files)
    }
  }

  // One file at a time, English first, so a failure is the last line rather
  // than one of twelve interleaved ones.
  const handleImport = async () => {
    if (blocker || !project || !target) {
      return
    }

    setIsImporting(true)
    const done: ImportResult[] = []

    for (const file of importOrder(files)) {
      if (!file.language) {
        continue
      }
      try {
        const rows = bundles.rows.get(file.language)
        if (file.kind === "sheet" && file.sheet && rows) {
          // Planned again from the latest values; the server still checks each English (`sources`).
          const plan = planSheet(file.sheet, rows)
          const saved = await saveTranslations(target, file.language, plan.values, plan.keepKeys, plan.sources)
          done.push({
            id: file.id,
            name: file.name,
            language: file.language,
            response: null,
            sheet: { saved: saved.saved, stale: saved.stale.length, file: saved.file },
            error: null,
          })
        } else {
          const response = await importBundle(target, file.language, file.values, effectiveMode)
          done.push({ id: file.id, name: file.name, language: file.language, response, sheet: null, error: null })
        }
      } catch (cause: unknown) {
        done.push({
          id: file.id,
          name: file.name,
          language: file.language,
          response: null,
          sheet: null,
          error: messageOf(cause),
        })
      }
    }

    const failed = done.filter((result) => result.error).length
    const steps = afterImport({ mode: effectiveMode, succeeded: done.length - failed, failed, retired: retired.length })

    let retiredCount = 0
    let retireError: string | null = null
    if (steps.retire) {
      try {
        retiredCount = (await deleteKeys({ target, keys: retired, scope: "all" })).deleted
      } catch (cause: unknown) {
        retireError = messageOf(cause)
      }
    }
    if (steps.clearDrafts) {
      update((state) => clearTarget(state, target))
    }
    if (steps.refresh) {
      refresh()
    }

    setOutcome({ project, files: done, retired: retiredCount, retireError })
    setIsImporting(false)

    if (failed > 0) {
      toast.error(`${failed} of ${done.length} could not be written - see the results below`)
    } else if (retireError) {
      toast.error("Imported, but the keys left out could not be retired", { description: retireError })
    } else {
      toast.success(
        `Imported ${done.length} ${done.length === 1 ? "file" : "files"} into ${project.name}`,
        retiredCount > 0
          ? {
              description: `${retiredCount} ${retiredCount === 1 ? "key" : "keys"} no file carried were removed from the project.`,
            }
          : undefined
      )
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Tools</span>
            <span>/</span>
            <span className="text-foreground">Import</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {can.exchangeBundles ? "Import language files" : "Import translations"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Nothing is written until you confirm.</p>
        </div>
        {project && (
          <Link href={projectPath(project)} className={outlineButton}>
            <ArrowLeft className="size-4" />
            Back to {project.name}
          </Link>
        )}
      </div>

      <div className="mt-6 flex max-w-4xl flex-col gap-4 pb-10">
        <Step index={1} title="Which project" disabled={isImporting}>
          <ProjectPicker value={project} onChange={setTarget} />
        </Step>

        <Step index={2} title="The files" disabled={!project || isImporting}>
          <input
            ref={fileRef}
            type="file"
            accept={
              can.exchangeBundles
                ? "application/json,.json,.xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : ".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files && event.target.files.length > 0) {
                void readFiles(event.target.files)
              }
              event.target.value = ""
            }}
          />
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border border-dashed border-border text-center transition-colors",
              files.length > 0 ? "px-6 py-5" : "px-6 py-10",
              isDragging && "border-primary bg-accent/40"
            )}
          >
            <Upload className="size-6 text-muted-foreground" />
            <p className="text-sm">
              {can.exchangeBundles ? "Drop .json, .xlsx or .csv files here" : "Drop .xlsx or .csv files here"}
            </p>
            {files.length === 0 && can.exchangeBundles && (
              <p className="text-xs text-muted-foreground">
                Flat or nested - <code className="font-mono">{`{ "nav.home": "…" }`}</code> and{" "}
                <code className="font-mono">{`{ "nav": { "home": "…" } }`}</code> both read the same.
              </p>
            )}
            <button type="button" onClick={() => fileRef.current?.click()} className={outlineButton}>
              Choose files
            </button>
          </div>

          {files.length > 0 && (
            <div className="mt-3 divide-y divide-border rounded-xl border border-border">
              {files.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  diff={diffs.get(file.id)}
                  isSelected={selected?.id === file.id}
                  isDuplicate={file.language !== null && duplicated.has(file.language)}
                  onSelect={() => setSelectedId(file.id)}
                  onAssign={(language) =>
                    editFiles((current) => current.map((item) => (item.id === file.id ? { ...item, language } : item)))
                  }
                  onRemove={() => editFiles((current) => current.filter((item) => item.id !== file.id))}
                />
              ))}
            </div>
          )}
        </Step>

        <Step index={3} title="What it would change" disabled={files.length === 0 || isImporting}>
          {bundles.error ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <span>
                Could not read what {project?.name} holds today: {bundles.error}
              </span>
              <button type="button" onClick={refresh} className={outlineButton}>
                <RotateCw className="size-4" />
                Retry
              </button>
            </div>
          ) : bundles.isLoading ? (
            <div className="space-y-2">
              <div className="h-8 animate-pulse rounded-lg bg-muted" />
              <div className="h-40 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : (
            selected && <DiffForFile file={selected} diff={diffs.get(selected.id)} plan={plans.get(selected.id)} projectName={project?.name ?? ""} />
          )}

          {can.exchangeBundles && !hasSheets && (
            <Label className="mt-4 flex items-start gap-2 font-normal">
              <Checkbox
                checked={mode === "replace"}
                onCheckedChange={(checked) => {
                  setMode(checked === true ? "replace" : "merge")
                  setOutcome(null)
                }}
              />
              <span className="text-sm">Clear the keys these files leave out</span>
            </Label>
          )}

          {retired.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                {retired.length.toLocaleString()} {retired.length === 1 ? "key is" : "keys are"} in none of these files
                and will be deleted from {project?.name} entirely - the {retired.length === 1 ? "key" : "keys"} and{" "}
                {retired.length === 1 ? "its" : "their"} text in every language, not only the{" "}
                {codes.length === 1 ? "one" : codes.length} you are importing.{" "}
                <code className="font-mono">{retired.slice(0, 3).join(", ")}</code>
                {retired.length > 3 && ` and ${(retired.length - 3).toLocaleString()} more`}.
              </span>
            </div>
          )}
        </Step>

        <Step index={4} title="Confirm" disabled={files.length === 0}>
          {outcome ? (
            <ImportResults outcome={outcome} />
          ) : (
            <div className="flex flex-col gap-3">
              {draftCount > 0 && project && (
                <p className="flex items-center gap-1.5 text-sm text-warning-foreground dark:text-warning">
                  <AlertTriangle className="size-4 shrink-0" />
                  {draftCount} unsaved {draftCount === 1 ? "edit" : "edits"} in {project.name} will be discarded after
                  the import.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={blocker !== null || isImporting}
                  onClick={() => void handleImport()}
                  className={primaryButton}
                >
                  <FileUp className="size-4" />
                  {isImporting
                    ? "Importing…"
                    : `Import ${files.length} ${files.length === 1 ? "file" : "files"} · ${totalChanges.toLocaleString()} ${
                        totalChanges === 1 ? "change" : "changes"
                      }`}
                </button>
                {blocker && <span className="text-sm text-muted-foreground">{blocker}</span>}
              </div>
            </div>
          )}
        </Step>
      </div>
    </div>
  )
}

function Step({
  index,
  title,
  disabled = false,
  children,
}: {
  index: number
  title: string
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <section
      aria-disabled={disabled}
      inert={disabled}
      className={cn(
        "rounded-xl border border-border bg-card p-5 transition-opacity",
        disabled && "pointer-events-none opacity-40"
      )}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
          {index}
        </span>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function DiffForFile({
  file,
  diff,
  plan,
  projectName,
}: {
  file: StagedFile
  diff: BundleDiff | undefined
  plan: SheetPlan | undefined
  projectName: string
}) {
  const language = languages.find((item) => item.code === file.language)

  if (!language) {
    return (
      <p className="text-sm text-muted-foreground">
        Say which language <code className="font-mono text-xs">{file.name}</code> is, and its diff appears here.
      </p>
    )
  }
  if (!diff) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        <code className="font-mono text-foreground">{file.name}</code> → {language.name}
      </p>
      {plan && skippedSummary(plan.skipped, projectName) && (
        <p className="text-xs tabular-nums text-muted-foreground">{skippedSummary(plan.skipped, projectName)}</p>
      )}
      <BundleDiffView
        key={`${file.id}:${language.code}`}
        diff={diff}
        languageName={language.name}
        isRtl={language.rtl ?? false}
      />
      {diff.invalid.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {diff.invalid.length} {diff.invalid.length === 1 ? "key is" : "keys are"} named in a way this project cannot
          store and will be skipped - <code className="font-mono">{diff.invalid.slice(0, 3).join(", ")}</code>
          {diff.invalid.length > 3 && ` and ${diff.invalid.length - 3} more`}. A key is dot-separated segments -
          group.section.name.
        </p>
      )}
    </div>
  )
}
