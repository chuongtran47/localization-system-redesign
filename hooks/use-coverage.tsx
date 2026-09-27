"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

import { fetchCoverage, messageOf } from "@/lib/api"
import type { CoverageResponse } from "@/lib/api-types"

type CoverageState = {
  coverage: CoverageResponse | null
  error: string | null
  /** Bumped by `refresh`; data hooks refetch when it moves. */
  revision: number
  refresh: () => void
}

const CoverageContext = createContext<CoverageState | null>(null)

export function CoverageProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0)
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchCoverage()
      .then((response) => {
        if (!cancelled) {
          setCoverage(response)
          setError(null)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(messageOf(cause))
        }
      })
    return () => {
      cancelled = true
    }
  }, [revision])

  const refresh = useCallback(() => setRevision((value) => value + 1), [])

  return (
    <CoverageContext.Provider value={{ coverage, error, revision, refresh }}>{children}</CoverageContext.Provider>
  )
}

export function useCoverage(): CoverageState {
  const state = useContext(CoverageContext)
  if (!state) {
    throw new Error("useCoverage must be used inside CoverageProvider")
  }
  return state
}
