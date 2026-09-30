/**
 * Who is looking at the app, and what that lets them do. Screens ask for a
 * capability - `can.manageKeys` - never for a role by name, so the rules live
 * here and nowhere else.
 */

export type Role = "developer" | "translator"

export const ROLES: readonly Role[] = ["developer", "translator"]

export const DEFAULT_ROLE: Role = "developer"

/** Read by the workspace layout on the server, so the first render is already the right view. */
export const ROLE_COOKIE = "lingua-role"

export const roleLabel: Record<Role, string> = {
  developer: "Developer",
  translator: "Translator",
}

export const roleHint: Record<Role, string> = {
  developer: "Keys, imports and releases",
  translator: "View and translate strings",
}

export type Capabilities = {
  /** Add key, delete keys, select rows. */
  manageKeys: boolean
  /** Edit the English source. */
  editSource: boolean
  /** Import and export JSON bundles. */
  exchangeBundles: boolean
  /** Download and upload Excel/CSV sheets of translations. */
  exchangeSheets: boolean
  /** Lock, Publish, the version filter, and the keys added here. */
  release: boolean
  /** New application. */
  manageApps: boolean
}

const capabilities: Record<Role, Capabilities> = {
  developer: { manageKeys: true, editSource: true, exchangeBundles: true, exchangeSheets: true, release: true, manageApps: true },
  translator: { manageKeys: false, editSource: false, exchangeBundles: false, exchangeSheets: true, release: false, manageApps: false },
}

export const capabilitiesOf = (role: Role): Capabilities => capabilities[role]

/** Anything but a known role - a missing cookie, one edited by hand - is the default. */
export function parseRole(value: string | null | undefined): Role {
  return ROLES.includes(value as Role) ? (value as Role) : DEFAULT_ROLE
}

/** A year, site-wide: the choice outlives the tab, as a remembered setting should. */
export const roleCookie = (role: Role) => `${ROLE_COOKIE}=${role}; path=/; max-age=31536000; samesite=lax`
