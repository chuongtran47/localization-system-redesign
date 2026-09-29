"use client"

import type { ReactNode } from "react"
import { Lock } from "lucide-react"

import { outlineButton } from "@/components/button-styles"
import { useRole } from "@/components/role-provider"
import type { Capabilities } from "@/lib/roles"

/**
 * A page that belongs to the developer view. Opened from another view it says
 * so, rather than redirecting somewhere the link did not point.
 */
export function RoleGate({
  capability,
  feature,
  children,
}: {
  capability: keyof Capabilities
  feature: string
  children: ReactNode
}) {
  const { can, setRole } = useRole()
  if (can[capability]) {
    return <>{children}</>
  }
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="rounded-xl border border-dashed border-border bg-card p-8">
        <div className="mx-auto flex max-w-2xl flex-col items-start gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Lock className="size-4" />
            </div>
            <h2 className="text-base font-semibold tracking-tight">{feature} is part of the developer view</h2>
          </div>
          <button type="button" className={outlineButton} onClick={() => setRole("developer")}>
            Switch to developer view
          </button>
        </div>
      </div>
    </div>
  )
}
