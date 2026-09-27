"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { GroupOption } from "@/lib/locale-data"
import { cn } from "@/lib/utils"
import { ALL_GROUPS } from "@/lib/workspace-view"

/** Dozens of groups is too many for tabs - a searchable combobox instead. */
export function GroupFilter({
  value,
  options,
  totalKeys,
  onChange,
}: {
  value: string
  options: GroupOption[]
  totalKeys: number
  onChange: (group: string) => void
}) {
  const [open, setOpen] = useState(false)

  const select = (group: string) => {
    onChange(group)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex h-8 w-56 items-center justify-between gap-2 rounded-lg border border-input bg-card px-2.5 text-sm transition-colors hover:bg-accent/40"
          />
        }
      >
        <span className={cn("truncate", value !== ALL_GROUPS && "font-mono text-[13px]")}>
          {value === ALL_GROUPS ? "All groups" : value}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Command>
          <CommandInput placeholder="Filter group key…" />
          <CommandList>
            <CommandEmpty>No group found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="all groups" onSelect={() => select(ALL_GROUPS)}>
                <Check className={cn("size-4", value === ALL_GROUPS ? "opacity-100" : "opacity-0")} />
                <span>All groups</span>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">{totalKeys}</span>
              </CommandItem>
              {options.map((option) => (
                <CommandItem key={option.group} value={option.group} onSelect={() => select(option.group)}>
                  <Check className={cn("size-4", value === option.group ? "opacity-100" : "opacity-0")} />
                  <span className="truncate font-mono text-xs">{option.group}</span>
                  <span className="ml-auto flex items-center gap-1.5 text-xs tabular-nums">
                    {option.outstanding > 0 && (
                      <span className="rounded-full bg-warning/15 px-1.5 font-semibold text-warning-foreground dark:text-warning">
                        {option.outstanding}
                      </span>
                    )}
                    <span className="text-muted-foreground">{option.total}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
