"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { parseFilters } from "@/lib/workspace-view"

/** The workspace filters live in the query string, so a view can be shared. */
export function useWorkspaceParams() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [name, value] of Object.entries(patch)) {
      if (value === null) {
        next.delete(name)
      } else {
        next.set(name, value)
      }
    }
    const search = next.toString()
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
  }

  return {
    filters: parseFilters(params),
    setParam: (name: string, value: string | null) => setParams({ [name]: value }),
    setParams,
  }
}
