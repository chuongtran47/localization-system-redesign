import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** A status summary that is also a filter, so the work queue is one click away. */
export function StatCard({
  label,
  value,
  accent,
  detail,
  active,
  onClick,
  children,
}: {
  label: string
  value: string
  accent: "primary" | "success" | "warning" | "destructive"
  detail?: string
  active: boolean
  onClick: () => void
  children?: ReactNode
}) {
  const dot = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  }[accent]
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        active && "border-primary/60 bg-accent/30"
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn("size-2 rounded-full", dot)} />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
      {children}
    </button>
  )
}
