"use client"

import { useMemo, useState } from "react"
import {
  Plus,
  Download,
  Lock,
  Upload,
  ChevronDown,
  Rocket,
  FlaskConical,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  projects,
  versions,
  sections,
  translations,
  sectionCounts,
  languages,
  type Language,
} from "@/lib/data"
import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { TranslationTable } from "@/components/translation-table"

export function TranslationWorkspace() {
  const [activeProject, setActiveProject] = useState(projects[0].id)
  const [version, setVersion] = useState("All")
  const [section, setSection] = useState("home")
  const [language, setLanguage] = useState<Language>(languages[0])

  const project = projects.find((p) => p.id === activeProject)!

  const rows = useMemo(
    () => translations.filter((t) => t.section === section),
    [section],
  )

  const stats = useMemo(() => {
    const total = translations.length
    const translated = translations.filter((t) => t.status === "translated").length
    const pending = translations.filter((t) => t.status === "pending").length
    const missing = translations.filter((t) => t.status === "missing").length
    return { total, translated, pending, missing, pct: Math.round((translated / total) * 100) }
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppSidebar activeId={activeProject} onSelect={setActiveProject} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar language={language} onLanguageChange={setLanguage} />

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-6 py-6">
            {/* Page header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{project.group}</span>
                  <span>/</span>
                  <span className="text-foreground">Translations</span>
                </div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance">
                  {project.name}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Managing{" "}
                  <span className="font-medium text-foreground">{language.name}</span>{" "}
                  translations · {stats.total} keys
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-medium transition-colors hover:bg-accent/40">
                  <Download className="size-4" />
                  Export
                </button>
                <button className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-medium transition-colors hover:bg-accent/40">
                  <Lock className="size-4" />
                  Lock
                </button>
                <PublishMenu />
                <button className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                  <Plus className="size-4" />
                  Add key
                </button>
              </div>
            </div>

            {/* Stat cards */}
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Translation progress" value={`${stats.pct}%`} accent="primary">
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${stats.pct}%` }}
                  />
                </div>
              </StatCard>
              <StatCard label="Translated" value={stats.translated} accent="success" />
              <StatCard label="Pending review" value={stats.pending} accent="warning" />
              <StatCard label="Missing" value={stats.missing} accent="destructive" />
            </div>

            {/* Version pills */}
            <div className="mt-6 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-muted-foreground">Version</span>
              {versions.map((v) => (
                <button
                  key={v}
                  onClick={() => setVersion(v)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    version === v
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Section tabs */}
            <div className="mt-5 flex items-center gap-1 border-b border-border">
              {sections.map((s) => {
                const count = sectionCounts[s]
                const active = section === s
                return (
                  <button
                    key={s}
                    onClick={() => setSection(s)}
                    className={cn(
                      "relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium capitalize transition-colors",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s}
                    {count > 0 && (
                      <span className="rounded-full bg-warning/20 px-1.5 text-[10px] font-semibold text-warning-foreground">
                        {count}
                      </span>
                    )}
                    {active && (
                      <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Table */}
            <div className="mt-4 pb-10">
              <TranslationTable rows={rows} />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
  children,
}: {
  label: string
  value: string | number
  accent: "primary" | "success" | "warning" | "destructive"
  children?: React.ReactNode
}) {
  const dot = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  }[accent]
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5">
        <span className={cn("size-2 rounded-full", dot)} />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {children}
    </div>
  )
}

function PublishMenu() {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-medium transition-colors hover:bg-accent/40"
      >
        <Upload className="size-4" />
        Publish
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>
      {open && (
        <>
          <button
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Close publish menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg shadow-black/5">
            <MenuItem icon={FlaskConical} label="Publish to Test" hint="Staging environment" />
            <MenuItem icon={Rocket} label="Publish to Live" hint="Production" />
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  hint,
}: {
  icon: typeof Rocket
  label: string
  hint: string
}) {
  return (
    <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent/50">
      <Icon className="size-4 text-muted-foreground" />
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
    </button>
  )
}
