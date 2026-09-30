"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronDown, Download, FileUp, FlaskConical, Lock, Rocket, Upload } from "lucide-react"

import { outlineButton } from "@/components/button-styles"
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu"
import { useRole } from "@/components/role-provider"
import { groupLabel, kindLabel, targetOf, type Project } from "@/lib/projects"

export function WorkspaceHeader({
  project,
  section,
  subtitle,
  badges,
  canExport,
  onExport,
  children,
}: {
  project: Project
  section: string
  subtitle: ReactNode
  badges?: ReactNode
  canExport: boolean
  onExport: () => void
  children?: ReactNode
}) {
  const { can } = useRole()
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{groupLabel[project.group]}</span>
          <span>/</span>
          <span className="text-foreground">{section}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{project.name}</h1>
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {kindLabel[project.profile.kind]}
          </span>
          {!project.profile.measured && (
            <span
              className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
              title="Profile inferred, not measured"
            >
              Inferred
            </span>
          )}
          {badges}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canExport && (can.exchangeBundles || can.exchangeSheets) && (
          <button type="button" onClick={onExport} className={outlineButton}>
            <Download className="size-4" />
            Export
          </button>
        )}
        {canExport && (can.exchangeBundles || can.exchangeSheets) && (
          <Link href={`/import?target=${targetOf(project)}`} className={outlineButton}>
            <FileUp className="size-4" />
            Import
          </Link>
        )}
        {can.release && (
          <>
            <button type="button" className={outlineButton}>
              <Lock className="size-4" />
              Lock
            </button>
            <PublishMenu />
          </>
        )}
        {children}
      </div>
    </div>
  )
}

function PublishMenu() {
  return (
    <PopoverMenu
      label="publish menu"
      trigger={(toggle) => (
        <button type="button" onClick={toggle} className={outlineButton}>
          <Upload className="size-4" />
          Publish
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      )}
    >
      {() => (
        <>
          <PopoverMenuItem icon={FlaskConical} label="Publish to Test" hint="Staging environment" />
          <PopoverMenuItem icon={Rocket} label="Publish to Live" hint="Production" />
        </>
      )}
    </PopoverMenu>
  )
}
