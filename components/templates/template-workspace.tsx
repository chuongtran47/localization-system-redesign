"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Check, ChevronDown, RotateCw } from "lucide-react"

import { outlineButton } from "@/components/button-styles"
import { PopoverMenu } from "@/components/popover-menu"
import { useRole } from "@/components/role-provider"
import { SkeletonRows } from "@/components/skeleton-rows"
import { StatCard } from "@/components/stat-card"
import { TemplateDialog } from "@/components/templates/template-dialog"
import { TemplateTable } from "@/components/templates/template-table"
import { ExportDialog } from "@/components/translations/export-dialog"
import { UnderlineTabs } from "@/components/underline-tabs"
import { WorkspaceHeader } from "@/components/workspace-header"
import { useCoverage } from "@/hooks/use-coverage"
import { useTemplates } from "@/hooks/use-templates"
import { useWorkspaceParams } from "@/hooks/use-workspace-params"
import { languages, SOURCE_LANGUAGE } from "@/lib/locale-data"
import { targetOf, type Project } from "@/lib/projects"
import { categoryLabel, type TemplateCategory, type TemplateChannel } from "@/lib/template-data"
import {
  TEMPLATE_ALL,
  categoriesOf,
  filterTemplates,
  ownersOf,
  parseTemplateFilters,
  resolveOwner,
  summarise,
} from "@/lib/template-view"

/** Route `/messages/:channel` - the channel's templates, and the dialog that translates one. */
export function TemplateWorkspace({ project }: { project: Project }) {
  const target = targetOf(project)
  const channel = project.profile.kind as TemplateChannel
  const filters = parseTemplateFilters(useSearchParams())
  const { setParam } = useWorkspaceParams()
  const { language } = filters
  const { revision, refresh } = useCoverage()
  const { templates, isLoading, error } = useTemplates(target, language, revision)
  const [isExportOpen, setExportOpen] = useState(false)
  const { role, can } = useRole()
  // Export forgets it was open when the view changes - it must not come back with the capability.
  const [openedAs, setOpenedAs] = useState(role)
  if (openedAs !== role) {
    setOpenedAs(role)
    setExportOpen(false)
  }

  const owner = resolveOwner(filters.owner, templates, isLoading)
  const beforeCategory = useMemo(
    () => filterTemplates(templates, { category: TEMPLATE_ALL, owner, status: filters.status, q: filters.q }),
    [templates, owner, filters.status, filters.q]
  )
  const visible = useMemo(
    () => filterTemplates(beforeCategory, { category: filters.category, owner: TEMPLATE_ALL, status: "all", q: "" }),
    [beforeCategory, filters.category]
  )
  const categories = useMemo(() => categoriesOf(templates, beforeCategory), [templates, beforeCategory])
  const owners = useMemo(() => ownersOf(templates), [templates])
  const totals = useMemo(() => summarise(templates), [templates])

  const languageInfo = languages.find((item) => item.code === language) ?? languages[0]
  const isSource = language === SOURCE_LANGUAGE
  const hasTemplates = templates.length > 0
  const open = filters.template ? templates.find((entry) => entry.template.id === filters.template) : undefined

  const tabs = [
    { id: TEMPLATE_ALL as TemplateCategory | typeof TEMPLATE_ALL, label: "All", count: beforeCategory.length },
    ...categories.map((item) => ({ id: item.category, label: categoryLabel[item.category], count: item.count })),
  ]

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <WorkspaceHeader
        project={project}
        section="Templates"
        badges={
          isSource ? (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
              View only
            </span>
          ) : null
        }
        subtitle={
          <>
            Managing <span className="font-medium text-foreground">{languageInfo.name}</span> translations ·{" "}
            {templates.length} {templates.length === 1 ? "template" : "templates"}
          </>
        }
        canExport={hasTemplates}
        onExport={() => setExportOpen(true)}
      />

      {!isSource && (isLoading || hasTemplates) && (
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

      {hasTemplates && (
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-b border-border">
          <UnderlineTabs
            items={tabs}
            value={filters.category}
            onChange={(id) => setParam("category", id === TEMPLATE_ALL ? null : id)}
          />
          <div className="flex items-center gap-2 pb-2">
            <ProductFilter
              value={owner}
              owners={owners}
              onChange={(key) => setParam("owner", key === TEMPLATE_ALL ? null : key)}
            />
            <span className="rounded-full border border-border bg-card px-2 py-1 text-xs font-medium tabular-nums text-muted-foreground">
              {visible.length} {visible.length === 1 ? "template" : "templates"}
            </span>
          </div>
        </div>
      )}

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
        ) : !hasTemplates ? (
          <p className="rounded-xl border border-dashed border-border bg-card py-16 text-center text-sm text-muted-foreground">
            No templates in this channel yet.
          </p>
        ) : visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card py-16 text-center text-sm text-muted-foreground">
            No templates match these filters.
          </p>
        ) : (
          <TemplateTable
            channel={channel}
            entries={visible}
            openId={open?.template.id}
            showProgress={!isSource}
            onOpen={(id) => setParam("template", id)}
          />
        )}
      </div>

      {open && (
        <TemplateDialog
          key={`${open.template.id}:${language}`}
          entry={open}
          project={project}
          language={language}
          onClose={() => setParam("template", null)}
          onSaved={refresh}
        />
      )}
      {hasTemplates && can.exchangeBundles && (
        <ExportDialog open={isExportOpen} onOpenChange={setExportOpen} project={project} language={language} />
      )}
    </div>
  )
}

function ProductFilter({
  value,
  owners,
  onChange,
}: {
  value: string
  owners: { key: string; label: string }[]
  onChange: (key: string) => void
}) {
  const current = owners.find((item) => item.key === value)
  const options = [{ key: TEMPLATE_ALL, label: "All products" }, ...owners]

  return (
    <div className="w-fit">
      <PopoverMenu
        label="product menu"
        widthClass="w-60"
        trigger={(toggle) => (
          <button
            type="button"
            onClick={toggle}
            className="flex h-8 w-52 items-center justify-between gap-2 rounded-lg border border-input bg-card px-2.5 text-sm transition-colors hover:bg-accent/40"
          >
            <span className="truncate">{current?.label ?? "All products"}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        )}
      >
        {(close) => (
          <div className="max-h-80 overflow-y-auto">
            {options.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onChange(item.key)
                  close()
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent/50"
              >
                <span className="flex-1 truncate">{item.label}</span>
                {item.key === value && <Check className="size-4 text-primary" />}
              </button>
            ))}
          </div>
        )}
      </PopoverMenu>
    </div>
  )
}
