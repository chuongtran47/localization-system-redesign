import { CheckCircle2, Clock, CircleDashed } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TranslationStatus } from "@/lib/data"

const config: Record<
  TranslationStatus,
  { label: string; icon: typeof CheckCircle2; className: string; dot: string }
> = {
  translated: {
    label: "Translated",
    icon: CheckCircle2,
    className: "bg-success/12 text-success border-success/20",
    dot: "bg-success",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    className: "bg-warning/15 text-warning-foreground border-warning/30",
    dot: "bg-warning",
  },
  missing: {
    label: "Missing",
    icon: CircleDashed,
    className: "bg-destructive/10 text-destructive border-destructive/20",
    dot: "bg-destructive",
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
      {c.label}
    </span>
  )
}

export function StatusDot({ status }: { status: TranslationStatus }) {
  return <span className={cn("size-2 rounded-full", config[status].dot)} aria-hidden="true" />
}
