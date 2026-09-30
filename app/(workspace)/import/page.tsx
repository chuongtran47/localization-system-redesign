import { Suspense } from "react"

import { ImportPageClient } from "@/components/import/import-page-client"

export default function ImportPage() {
  return (
    <Suspense>
      <ImportPageClient />
    </Suspense>
  )
}
