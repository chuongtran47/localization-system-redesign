"use client"

import { ImportWizard } from "@/components/import/import-wizard"
import { RoleGate } from "@/components/role-gate"
import { useRole } from "@/components/role-provider"

/**
 * The page is a Server Component, so the view is read here. The wizard is keyed
 * by it: changing views drops a staged batch - a JSON file must not carry over
 * into a view that cannot import one.
 */
export function ImportPageClient() {
  const { role } = useRole()
  return (
    <RoleGate capability="exchangeSheets" feature="Import">
      <ImportWizard key={role} />
    </RoleGate>
  )
}
