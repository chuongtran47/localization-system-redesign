import { AlertTriangle, CheckCircle2, CircleDashed, History } from "lucide-react"

import { statusLabel, type TranslationStatus } from "@/lib/locale-data"
import { cn } from "@/lib/utils"

const config: Record<TranslationStatus, { icon: typeof CheckCircle2; className: string; dot: string }> = {
  translated: {
    icon: CheckCircle2,
    className: "bg-success/12 text-success border-success/20",
    dot: "bg-success",
  },
  missing: {
    icon: CircleDashed,
    className: "bg-destructive/10 text-destructive border-destructive/20",
    dot: "bg-destructive",
  },
  outdated: {
    icon: History,
    className: "bg-info/12 text-info border-info/25",
    dot: "bg-info",
  },
  needs_fix: {
    icon: AlertTriangle,
    className: "bg-warning/15 text-warning-foreground border-warning/30 dark:text-warning",
    dot: "bg-warning",
  },
}

export function StatusBadge({ status }: { status: TranslationStatus }) {
  const c = config[status]
  const Icon = c.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        c.className,
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {statusLabel[status]}
    </span>
  )
}

export function StatusDot({ status }: { status: TranslationStatus }) {
  return <span className={cn("size-2 rounded-full", config[status].dot)} aria-hidden="true" />
}
