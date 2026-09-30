"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ChevronsUpDown, FileUp, Languages, Plus, Search } from "lucide-react"

import { useRole } from "@/components/role-provider"
import { useCoverage } from "@/hooks/use-coverage"
import { useWorkspaceParams } from "@/hooks/use-workspace-params"
import { outstandingOf, targetLanguageCoverage } from "@/lib/coverage"
import { findProjectByPath, projectGroups, projectPath, projects, targetOf, type Project } from "@/lib/projects"
import { cn } from "@/lib/utils"

export function AppSidebar() {
  const [query, setQuery] = useState("")
  const pathname = usePathname()
  const active = findProjectByPath(pathname)
  const lang = useSearchParams().get("lang")
  const { filters } = useWorkspaceParams()
  const { coverage } = useCoverage()
  const { can } = useRole()

  const filtered = projects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))

  const pendingOf = (project: Project) => {
    const entry = targetLanguageCoverage(coverage, targetOf(project), filters.language)
    return entry ? outstandingOf(entry) : 0
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Languages className="size-4.5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">Lingua</p>
          <p className="text-[11px] text-muted-foreground">Localization Cloud</p>
        </div>
      </div>

      {/* Workspace switcher */}
      <div className="px-3 pt-3">
        <button className="flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-card px-2.5 py-2 text-left transition-colors hover:bg-accent/40">
          <div className="flex size-7 items-center justify-center rounded-md bg-accent text-xs font-semibold text-accent-foreground">
            GS
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">GrapeSEED Inc.</p>
            <p className="truncate text-[11px] text-muted-foreground">Enterprise plan</p>
          </div>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter applications"
            className="h-8 w-full rounded-lg border border-input bg-card pl-8 pr-2.5 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
      </div>

      {/* Project list */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {projectGroups.map((group) => {
          const items = filtered.filter((p) => p.group === group.id)
          if (items.length === 0) return null
          return (
            <div key={group.id} className="mb-3">
              <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {items.map((p) => (
                  <SidebarItem
                    key={p.id}
                    project={p}
                    href={lang ? `${projectPath(p)}?lang=${encodeURIComponent(lang)}` : projectPath(p)}
                    active={p === active}
                    pending={pendingOf(p)}
                  />
                ))}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Footer - developer tools only; a view without them has no footer at all. */}
      {(can.exchangeBundles || can.exchangeSheets || can.manageApps) && (
        <div className="space-y-2 border-t border-sidebar-border p-3">
          {(can.exchangeBundles || can.exchangeSheets) && (
            <Link
              href={lang ? `/import?lang=${encodeURIComponent(lang)}` : "/import"}
              className={cn(
                "flex w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors",
                pathname === "/import"
                  ? "border-transparent bg-sidebar-accent text-sidebar-accent-foreground"
                  : "border-sidebar-border text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              )}
            >
              <FileUp className="size-3.5" />
              Import files
            </Link>
          )}
          {can.manageApps && (
            <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-sidebar-border px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
              <Plus className="size-3.5" />
              New application
            </button>
          )}
        </div>
      )}
    </aside>
  )
}

function SidebarItem({
  project,
  href,
  active,
  pending,
}: {
  project: Project
  href: string
  active: boolean
  pending: number
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors",
          active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-foreground hover:bg-accent/40"
        )}
      >
        <span className={cn("size-1.5 shrink-0 rounded-full", active ? "bg-primary" : "bg-muted-foreground/30")} />
        <span className="min-w-0 flex-1 truncate">{project.name}</span>
        {pending > 0 && (
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
              active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {pending.toLocaleString()}
          </span>
        )}
      </Link>
    </li>
  )
}
