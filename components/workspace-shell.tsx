"use client"

import { Suspense, type ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { DraftProvider } from "@/components/draft-provider"
import { RoleProvider } from "@/components/role-provider"
import { CoverageProvider } from "@/hooks/use-coverage"
import type { Role } from "@/lib/roles"

export function WorkspaceShell({ initialRole, children }: { initialRole: Role; children: ReactNode }) {
  return (
    <CoverageProvider>
      <DraftProvider>
        <RoleProvider initialRole={initialRole}>
          <div className="flex h-screen overflow-hidden bg-background text-foreground">
            <Suspense fallback={<aside className="w-72 shrink-0 border-r border-sidebar-border bg-sidebar" />}>
              <AppSidebar />
            </Suspense>
            <div className="flex min-w-0 flex-1 flex-col">
              <Suspense fallback={<header className="h-16 shrink-0 border-b border-border bg-card/60" />}>
                <AppTopbar />
              </Suspense>
              <main className="relative min-h-0 flex-1 overflow-y-auto">{children}</main>
            </div>
          </div>
        </RoleProvider>
      </DraftProvider>
    </CoverageProvider>
  )
}
