import { Suspense } from "react"

import { ImportWizard } from "@/components/import/import-wizard"

export default function ImportPage() {
  return (
    <Suspense>
      <ImportWizard />
    </Suspense>
  )
}
