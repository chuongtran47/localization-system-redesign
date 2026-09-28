import { cn } from "@/lib/utils"

export function UnderlineTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { id: T; label: string; count: number }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              {item.count.toLocaleString()}
            </span>
            {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        )
      })}
    </div>
  )
}
