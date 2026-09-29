"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import { useDrafts } from "@/components/draft-provider"
import { clearAllSelected } from "@/lib/drafts"
import { capabilitiesOf, roleCookie, type Capabilities, type Role } from "@/lib/roles"

type RoleContextValue = {
  role: Role
  can: Capabilities
  setRole: (role: Role) => void
}

const RoleContext = createContext<RoleContextValue | null>(null)

/** The view the user chose. Lives inside `DraftProvider`, so losing a capability can drop the selection. */
export function RoleProvider({ initialRole, children }: { initialRole: Role; children: ReactNode }) {
  const router = useRouter()
  const { update } = useDrafts()
  const [role, setRoleState] = useState(initialRole)

  // Once the server has read the cookie again, it is the source of truth.
  const [served, setServed] = useState(initialRole)
  if (served !== initialRole) {
    setServed(initialRole)
    setRoleState(initialRole)
  }

  const setRole = (next: Role) => {
    // Written even when this tab already shows `next`: another tab may have
    // changed the cookie since, and this choice is the one to remember.
    document.cookie = roleCookie(next)
    if (next === role) {
      return
    }
    setRoleState(next)
    // A selection only exists to be deleted; a view that cannot delete must
    // not keep one around to bring back later.
    if (!capabilitiesOf(next).manageKeys) {
      update(clearAllSelected)
    }
    router.refresh()
  }

  return <RoleContext.Provider value={{ role, can: capabilitiesOf(role), setRole }}>{children}</RoleContext.Provider>
}

export function useRole(): RoleContextValue {
  const value = useContext(RoleContext)
  if (!value) {
    throw new Error("useRole must be used inside RoleProvider")
  }
  return value
}
