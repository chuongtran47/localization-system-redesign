"use client"

import { useState } from "react"
import { Search, ChevronDown, Bell, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { languages, type Language } from "@/lib/data"

export function AppTopbar({
  language,
  onLanguageChange,
}: {
  language: Language
  onLanguageChange: (lang: Language) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card/60 px-6 backdrop-blur">
      {/* Global search */}
      <div className="relative max-w-xl flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search keys, source text, or translations…"
          className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-16 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Language selector */}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <span className="text-base leading-none">{language.flag}</span>
            <span>{language.name}</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {language.translated}/{language.total}
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>

          {open && (
            <>
              <button
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close language menu"
                onClick={() => setOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg shadow-black/5">
                <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Target language
                </p>
                {languages.map((lang) => {
                  const pct = Math.round((lang.translated / lang.total) * 100)
                  return (
                    <button
                      key={lang.code}
                      onClick={() => {
                        onLanguageChange(lang)
                        setOpen(false)
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/50"
                    >
                      <span className="text-base leading-none">{lang.flag}</span>
                      <span className="flex-1">{lang.name}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
                      {lang.code === language.code && (
                        <Check className="size-4 text-primary" />
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <button className="relative flex size-9 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground">
          <Bell className="size-4" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" />
        </button>

        {/* User */}
        <button className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-accent/40">
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground",
            )}
          >
            LL
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-xs font-medium">Logan Le</span>
            <span className="block text-[11px] text-muted-foreground">Maintainer</span>
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </div>
    </header>
  )
}
