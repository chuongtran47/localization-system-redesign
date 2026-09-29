"use client"

import { useState, type ReactNode } from "react"
import { Check, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export function PopoverMenu({
  label,
  widthClass = "w-52",
  trigger,
  children,
}: {
  label: string
  widthClass?: string
  trigger: (toggle: () => void) => ReactNode
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <div className="relative">
      {trigger(() => setOpen((value) => !value))}
      {open && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" aria-label={`Close ${label}`} onClick={close} />
          <div
            className={cn(
              "absolute right-0 z-20 mt-2 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg shadow-black/5",
              widthClass
            )}
          >
            {children(close)}
          </div>
        </>
      )}
    </div>
  )
}

export function PopoverMenuItem({
  icon: Icon,
  label,
  hint,
  selected,
  onClick,
}: {
  icon: LucideIcon
  label: string
  hint: string
  /** Marks the current choice in a menu of options. */
  selected?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent/50"
    >
      <Icon className="size-4 text-muted-foreground" />
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
      {selected && <Check className="size-4 shrink-0 text-primary" />}
    </button>
  )
}
