"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

import { emptyDrafts, type DraftState } from "@/lib/drafts"

type DraftContextValue = {
  drafts: DraftState
  update: (fn: (state: DraftState) => DraftState) => void
}

const DraftContext = createContext<DraftContextValue | null>(null)

export function DraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<DraftState>(emptyDrafts)
  return <DraftContext.Provider value={{ drafts, update: setDrafts }}>{children}</DraftContext.Provider>
}

export function useDrafts(): DraftContextValue {
  const value = useContext(DraftContext)
  if (!value) {
    throw new Error("useDrafts must be used inside DraftProvider")
  }
  return value
}
