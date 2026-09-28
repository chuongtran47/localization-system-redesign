"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Plus, RotateCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { destructiveButton, outlineButton, primaryButton } from "@/components/button-styles"
import { useDrafts } from "@/components/draft-provider"
import { SkeletonRows } from "@/components/skeleton-rows"
import { StatCard } from "@/components/stat-card"
import { TranslationList } from "@/components/translation-list"
import { TranslationRow } from "@/components/translation-row"
import { AddKeyDialog } from "@/components/translations/add-key-dialog"
import { DeleteKeysDialog } from "@/components/translations/delete-keys-dialog"
import { ExportDialog } from "@/components/translations/export-dialog"
import { GroupFilter } from "@/components/translations/group-filter"
import { ProjectProfileCard } from "@/components/translations/project-profile-card"
import { UnderlineTabs } from "@/components/underline-tabs"
import { WorkspaceHeader } from "@/components/workspace-header"
import { useCoverage } from "@/hooks/use-coverage"
import { useTranslationRows } from "@/hooks/use-translation-rows"
import { useWorkspaceParams } from "@/hooks/use-workspace-params"
import { messageOf, saveTranslations } from "@/lib/api"
import type { DeleteScope } from "@/lib/api-types"
import {
  clearSelected,
  commitSlot,
  discardSlot,
  pendingCount,
  pruneDeleted,
  selectedOf,
  setEdit,
  setKeep,
  setSelected,
  slotKeyOf,
  slotOf,
} from "@/lib/drafts"
import { displayedValueOf, languages } from "@/lib/locale-data"
import { targetOf, type Project } from "@/lib/projects"
import { ALL_VERSIONS, versions } from "@/lib/release"
import { cn } from "@/lib/utils"
import { ALL_GROUPS, resolveGroup, statusFilters, viewOf, type StatusFilter } from "@/lib/workspace-view"

/** Loose UI strings and message templates are different screens over the same route. */
export function TranslationWorkspace({ project }: { project: Project }) {
  if (project.profile.kind !== "ui") {
    return (
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <ProjectProfileCard
          project={project}
          title={`${project.name} templates`}
          message="The template editor for this channel is coming soon."
        />
      </div>
    )
  }
  return <UiWorkspace project={project} />
}

function UiWorkspace({ project }: { project: Project }) {
  const target = targetOf(project)

  const { filters, setParam, setParams } = useWorkspaceParams()
  const { language } = filters
  const { revision, refresh } = useCoverage()
  const { rows, isLoading, error } = useTranslationRows(target, language, revision)

  const group = resolveGroup(filters.group, rows, isLoading)
  const view = useMemo(
    () => viewOf(rows, { group, status: filters.status, version: filters.version, q: filters.q }),
    [rows, group, filters.status, filters.version, filters.q]
  )
  const rowsByKey = useMemo(() => new Map(rows.map((row) => [row.key, row])), [rows])

  const { drafts, update } = useDrafts()
  const slotKey = slotKeyOf(target, language)
  const slot = slotOf(drafts, slotKey)
  const selected = selectedOf(drafts, target)

  const [isSaving, setIsSaving] = useState(false)
  const [doomed, setDoomed] = useState<string[]>([])
  const [isAddOpen, setAddOpen] = useState(false)
  const [isExportOpen, setExportOpen] = useState(false)

  const languageInfo = languages.find((item) => item.code === language) ?? languages[0]
  const hasKeys = rows.length > 0
  const pending = pendingCount(slot)
  const selectedInView = view.visible.filter((row) => selected.has(row.key)).length
  const { totals, statusCounts } = view

  const handleChange = (key: string, value: string) => {
    const row = rowsByKey.get(key)
    if (row) {
      update((state) => setEdit(state, slotKey, key, value, displayedValueOf(row)))
    }
  }

  const handleKeep = (key: string) => update((state) => setKeep(state, slotKey, key))

  // An outdated value that still holds is confirmed by writing it back, which
  // refreshes its English snapshot on the server.
  const handleConfirm = (key: string) => {
    const row = rowsByKey.get(key)
    if (row) {
      update((state) => setEdit(state, slotKey, key, row.target, null))
    }
  }

  const handleSelect = (key: string, on: boolean) => update((state) => setSelected(state, target, [key], on))

  const handleSelectAll = (on: boolean) =>
    update((state) =>
      setSelected(
        state,
        target,
        view.visible.map((row) => row.key),
        on
      )
    )

  const handleSave = async () => {
    const saving = slot
    const savingKey = slotKey
    setIsSaving(true)
    try {
      const { saved, file } = await saveTranslations(target, language, saving.edits, [...saving.keeps])
      update((state) => commitSlot(state, savingKey, saving))
      refresh()
      toast.success(`Saved ${saved} ${saved === 1 ? "key" : "keys"}`, { description: `Written to ${file}` })
    } catch (cause: unknown) {
      toast.error("Could not save", { description: messageOf(cause) })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleted = (keys: string[], scope: DeleteScope) => {
    update((state) => pruneDeleted(state, target, keys, scope, language))
    refresh()
  }

  const handleCreated = (key: string) => {
    refresh()
    setParams({ q: key, status: null, group: null, version: null })
  }

  const statusTabs = statusFilters
    .filter((item) => item.id !== "new" || view.hasManual || filters.status === "new")
    .map((item) => ({ id: item.id, label: item.label, count: statusCounts[item.id] }))

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <WorkspaceHeader
        project={project}
        section="Translations"
        subtitle={
          <>
            Managing <span className="font-medium text-foreground">{languageInfo.name}</span> translations ·{" "}
            {rows.length.toLocaleString()} keys
          </>
        }
        canExport={hasKeys}
        onExport={() => setExportOpen(true)}
      >
        <button type="button" onClick={() => setAddOpen(true)} className={primaryButton}>
          <Plus className="size-4" />
          Add key
        </button>
      </WorkspaceHeader>

      {/* Stat cards */}
      {(isLoading || hasKeys) && (
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Translation progress"
            value={isLoading ? "—" : `${totals.percent}%`}
            accent="primary"
            active={filters.status === "all"}
            onClick={() => setParam("status", null)}
          >
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${totals.percent}%` }} />
            </div>
          </StatCard>
          <StatCard
            label="Translated"
            value={isLoading ? "—" : totals.translated.toLocaleString()}
            accent="success"
            active={filters.status === "translated"}
            onClick={() => setParam("status", "translated")}
          />
          <StatCard
            label="Needs fix"
            value={isLoading ? "—" : totals.needsFix.toLocaleString()}
            accent="warning"
            active={filters.status === "needs_fix"}
            onClick={() => setParam("status", "needs_fix")}
          />
          <StatCard
            label="Missing"
            value={isLoading ? "—" : totals.missing.toLocaleString()}
            detail={isLoading ? undefined : `${totals.outdated.toLocaleString()} outdated`}
            accent="destructive"
            active={filters.status === "missing" || filters.status === "outdated"}
            onClick={() => setParam("status", "missing")}
          />
        </div>
      )}

      {hasKeys && (
        <>
          {/* Version pills */}
          <div className="mt-6 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-muted-foreground">Version</span>
            {versions.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setParam("version", v === ALL_VERSIONS ? null : v)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  filters.version === v
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                )}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Status tabs, group and count */}
          <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-b border-border">
            <UnderlineTabs<StatusFilter>
              items={statusTabs}
              value={filters.status}
              onChange={(id) => setParam("status", id === "all" ? null : id)}
            />
            <div className="flex items-center gap-2 pb-2">
              <GroupFilter
                value={group}
                options={view.groupOptions}
                totalKeys={rows.length}
                onChange={(value) => setParam("group", value === ALL_GROUPS ? null : value)}
              />
              <span className="rounded-full border border-border bg-card px-2 py-1 text-xs font-medium tabular-nums text-muted-foreground">
                {view.visible.length.toLocaleString()} keys
              </span>
            </div>
          </div>
        </>
      )}

      {/* Body */}
      <div className="mt-4 pb-10">
        {error ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span>
              Could not load {project.name}: {error}
            </span>
            <button type="button" onClick={refresh} className={outlineButton}>
              <RotateCw className="size-4" />
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <SkeletonRows />
        ) : !hasKeys ? (
          <ProjectProfileCard
            project={project}
            title={`No keys in ${project.name} yet`}
            message="Add the first key below. It is created in this project only, and in every language at once."
            action={
              <button type="button" onClick={() => setAddOpen(true)} className={primaryButton}>
                <Plus className="size-4" />
                Add key
              </button>
            }
          />
        ) : (
          <TranslationList
            rows={view.visible}
            languageName={languageInfo.name}
            allSelected={view.visible.length > 0 && selectedInView === view.visible.length}
            someSelected={selectedInView > 0 && selectedInView < view.visible.length}
            onSelectAll={handleSelectAll}
            renderRow={(row) => {
              const isKeepPending = slot.keeps.has(row.key)
              const value = slot.edits[row.key] ?? (isKeepPending ? row.source : displayedValueOf(row))
              return (
                <TranslationRow
                  row={row}
                  value={value}
                  isDirty={row.key in slot.edits || isKeepPending}
                  isKeepPending={isKeepPending}
                  isSelected={selected.has(row.key)}
                  language={language}
                  profile={project.profile}
                  rtl={languageInfo.rtl ?? false}
                  onChange={handleChange}
                  onKeep={handleKeep}
                  onConfirm={handleConfirm}
                  onSelect={handleSelect}
                  onDelete={(key) => setDoomed([key])}
                />
              )
            }}
          />
        )}
      </div>

      {/* Trays: a selection and unsaved edits can both be open, so they stack. */}
      {(selected.size > 0 || pending > 0) && (
        <div className="sticky bottom-4 z-10 -mt-6 space-y-2">
          {selected.size > 0 && (
            <Tray>
              <span className="text-sm">
                {selected.size.toLocaleString()} selected
                {selected.size !== selectedInView && (
                  <span className="text-muted-foreground"> ({selectedInView.toLocaleString()} in view)</span>
                )}
              </span>
              <div className="ml-auto flex gap-2">
                <button type="button" className={outlineButton} onClick={() => update((state) => clearSelected(state, target))}>
                  Clear
                </button>
                <button type="button" className={destructiveButton} onClick={() => setDoomed([...selected])}>
                  <Trash2 className="size-4" />
                  Delete
                </button>
              </div>
            </Tray>
          )}
          {pending > 0 && (
            <Tray>
              <span className="text-sm">
                {pending} unsaved {pending === 1 ? "key" : "keys"}{" "}
                <span className="text-muted-foreground">in {languageInfo.name}</span>
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  className={outlineButton}
                  disabled={isSaving}
                  onClick={() => update((state) => discardSlot(state, slotKey))}
                >
                  Discard
                </button>
                <button type="button" className={primaryButton} disabled={isSaving} onClick={handleSave}>
                  {isSaving ? "Saving…" : "Save all"}
                </button>
              </div>
            </Tray>
          )}
        </div>
      )}

      <AddKeyDialog open={isAddOpen} onOpenChange={setAddOpen} project={project} onCreated={handleCreated} />
      {hasKeys && (
        <ExportDialog open={isExportOpen} onOpenChange={setExportOpen} project={project} language={language} />
      )}
      <DeleteKeysDialog
        project={project}
        language={language}
        keys={doomed}
        onClose={() => setDoomed([])}
        onDeleted={handleDeleted}
      />
    </div>
  )
}

function Tray({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg shadow-black/5 backdrop-blur animate-in fade-in slide-in-from-bottom-2">
      {children}
    </div>
  )
}
