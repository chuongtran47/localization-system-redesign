"use client"

import { Check, ChevronDown } from "lucide-react"

import { PopoverMenu } from "@/components/popover-menu"
import { languageFlags } from "@/lib/language-flags"
import { languages, type LanguageCode } from "@/lib/locale-data"
import { cn } from "@/lib/utils"

export function LanguagePicker({
  value,
  invalid,
  onChange,
}: {
  value: LanguageCode | null
  invalid: boolean
  onChange: (code: LanguageCode) => void
}) {
  const current = languages.find((item) => item.code === value)

  return (
    <PopoverMenu
      label="language menu"
      widthClass="w-56"
      trigger={(toggle) => (
        <button
          type="button"
          onClick={toggle}
          aria-invalid={invalid || undefined}
          className={cn(
            "flex h-8 w-48 items-center justify-between gap-2 rounded-lg border bg-card px-2.5 text-sm transition-colors hover:bg-accent/40",
            invalid ? "border-destructive" : "border-input"
          )}
        >
          <span className={cn("flex min-w-0 items-center gap-2 truncate", !current && "text-muted-foreground")}>
            {current ? (
              <>
                <span className="text-base leading-none">{languageFlags[current.code]}</span>
                {current.name}
              </>
            ) : (
              "Choose a language…"
            )}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      )}
    >
      {(close) => (
        <div className="max-h-80 overflow-y-auto">
          {languages.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => {
                onChange(item.code)
                close()
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent/50"
            >
              <span className="text-base leading-none">{languageFlags[item.code]}</span>
              <span className="flex-1">{item.name}</span>
              {item.code === value && <Check className="size-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </PopoverMenu>
  )
}
