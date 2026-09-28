"use client"

import { Check, ChevronDown } from "lucide-react"

import { PopoverMenu } from "@/components/popover-menu"
import { groupLabel, projectGroups, projects, targetOf, type Project } from "@/lib/projects"
import { cn } from "@/lib/utils"

export function ProjectPicker({ value, onChange }: { value: Project | null; onChange: (project: Project) => void }) {
  return (
    <PopoverMenu
      label="project menu"
      widthClass="w-72"
      trigger={(toggle) => (
        <button
          type="button"
          onClick={toggle}
          className="flex h-9 w-72 items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-sm transition-colors hover:bg-accent/40"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? `${groupLabel[value.group]} · ${value.name}` : "Choose a project…"}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      )}
    >
      {(close) => (
        <div className="max-h-96 overflow-y-auto">
          {projectGroups.map((group) => (
            <div key={group.id} className="py-1">
              <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              {projects
                .filter((project) => project.group === group.id)
                .map((project) => (
                  <button
                    key={targetOf(project)}
                    type="button"
                    onClick={() => {
                      onChange(project)
                      close()
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent/50"
                  >
                    <span className="flex-1 truncate">{project.name}</span>
                    {project === value && <Check className="size-4 text-primary" />}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </PopoverMenu>
  )
}
