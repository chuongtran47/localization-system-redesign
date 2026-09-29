import type { ReactNode } from "react"
import { cookies } from "next/headers"

import { WorkspaceShell } from "@/components/workspace-shell"
import { parseRole, ROLE_COOKIE } from "@/lib/roles"

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const role = parseRole((await cookies()).get(ROLE_COOKIE)?.value)
  return <WorkspaceShell initialRole={role}>{children}</WorkspaceShell>
}
