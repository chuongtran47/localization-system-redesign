import { Suspense } from "react"

import { ImportWizard } from "@/components/import/import-wizard"
import { RoleGate } from "@/components/role-gate"

export default function ImportPage() {
  return (
    <Suspense>
      <RoleGate capability="exchangeBundles" feature="Import">
        <ImportWizard />
      </RoleGate>
    </Suspense>
  )
}
