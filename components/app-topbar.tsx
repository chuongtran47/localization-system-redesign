"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Bell, Check, ChevronDown, Code2, Languages, RotateCcw, Search, type LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { useDrafts } from "@/components/draft-provider"
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu"
import { useRole } from "@/components/role-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import { useCoverage } from "@/hooks/use-coverage"
import { useWorkspaceParams } from "@/hooks/use-workspace-params"
import { messageOf, resetData } from "@/lib/api"
import { targetLanguageCoverage } from "@/lib/coverage"
import { emptyDrafts } from "@/lib/drafts"
import { languageFlags } from "@/lib/language-flags"
import { languages, SOURCE_LANGUAGE, type LanguageCode } from "@/lib/locale-data"
import { findProjectByPath, targetOf } from "@/lib/projects"
import { ROLES, roleHint, roleLabel, type Role } from "@/lib/roles"

const roleIcon: Record<Role, LucideIcon> = { developer: Code2, translator: Languages }

export function AppTopbar() {
  const { filters, setParam } = useWorkspaceParams()
  const project = findProjectByPath(usePathname())
  const { coverage, refresh } = useCoverage()
  const { update } = useDrafts()
  const { role, can, setRole } = useRole()
  const searchRef = useRef<HTMLInputElement>(null)

  // Typed text is local while the field has focus, so a slow URL update never
  // eats a keystroke; an outside change to `q` (the add-key dialog) shows up
  // once the field is not being typed in.
  const [search, setSearch] = useState(filters.q)
  const [isSearchFocused, setSearchFocused] = useState(false)
  if (!isSearchFocused && search !== filters.q) {
    setSearch(filters.q)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const current = languages.find((item) => item.code === filters.language) ?? languages[0]
  const countsOf = (code: LanguageCode) =>
    project ? targetLanguageCoverage(coverage, targetOf(project), code) : null
  const currentCounts = countsOf(current.code)

  const handleReset = async () => {
    try {
      await resetData()
      update(() => emptyDrafts)
      refresh()
      toast.success("Demo data reset", { description: "Every project is back to the sample data." })
    } catch (cause: unknown) {
      toast.error("Could not reset", { description: messageOf(cause) })
    }
  }

  // No backdrop filter here: it would make the header a stacking context and
  // the containing block of `fixed` children, so its menus would paint under
  // <main> and their click-outside layer would cover the header only. Nothing
  // scrolls behind the header anyway - <main> scrolls below it.
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card/60 px-6">
      {/* Global search */}
      <div className="relative max-w-xl flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={searchRef}
          value={search}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          onChange={(event) => {
            setSearch(event.target.value)
            setParam("q", event.target.value || null)
          }}
          placeholder="Search keys, source text, or translations…"
          className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-16 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Language selector */}
        <PopoverMenu
          label="language menu"
          widthClass="w-64"
          trigger={(toggle) => (
            <button
              type="button"
              onClick={toggle}
              className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <span className="text-base leading-none">{languageFlags[current.code]}</span>
              <span>{current.name}</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                {currentCounts ? `${currentCounts.translated}/${currentCounts.total}` : "—"}
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          )}
        >
          {(close) => (
            <div className="max-h-96 overflow-y-auto">
              <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Target language
              </p>
              {languages.map((lang) => {
                const counts = countsOf(lang.code)
                const pct = counts && counts.total ? Math.round((counts.translated / counts.total) * 100) : null
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setParam("lang", lang.code)
                      close()
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/50"
                  >
                    <span className="text-base leading-none">{languageFlags[lang.code]}</span>
                    <span className="flex-1">
                      {lang.name}
                      {lang.code === SOURCE_LANGUAGE && !can.editSource && (
                        <span className="text-muted-foreground"> · view only</span>
                      )}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">{pct === null ? "—" : `${pct}%`}</span>
                    {lang.code === current.code && <Check className="size-4 text-primary" />}
                  </button>
                )
              })}
            </div>
          )}
        </PopoverMenu>

        <ThemeToggle />

        <button className="relative flex size-9 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground">
          <Bell className="size-4" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" />
        </button>

        {/* User */}
        <PopoverMenu
          label="user menu"
          widthClass="w-64"
          trigger={(toggle) => (
            <button
              type="button"
              onClick={toggle}
              className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-accent/40"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                LL
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-xs font-medium">Logan Le</span>
                <span className="block text-[11px] text-muted-foreground">{roleLabel[role]} view</span>
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          )}
        >
          {(close) => (
            <>
              <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                View as
              </p>
              {ROLES.map((item) => (
                <PopoverMenuItem
                  key={item}
                  icon={roleIcon[item]}
                  label={roleLabel[item]}
                  hint={roleHint[item]}
                  selected={item === role}
                  onClick={() => {
                    close()
                    setRole(item)
                  }}
                />
              ))}
              <div className="my-1 h-px bg-border" />
              <PopoverMenuItem
                icon={RotateCcw}
                label="Reset demo data"
                hint="Re-seed every project from the sample data"
                onClick={() => {
                  close()
                  void handleReset()
                }}
              />
            </>
          )}
        </PopoverMenu>
      </div>
    </header>
  )
}
